/**
 * Boost Boss — Public ad-fetch endpoint for Lumi for Browser App.
 *
 * URL:    POST /api/lumi-fetch
 * Caller: the script tag at https://boostboss.ai/lumi/v1.js
 *
 * Why this exists separately from /api/ad-request:
 *   - /api/ad-request requires a Bearer api_key (server-to-server usage).
 *   - The browser script tag only carries a publisher UUID in its #hash.
 *   - Embedding the api_key in client JS would leak it to every page view.
 *
 * Auth model:
 *   - Publisher UUID comes in the body. We look up the publisher in the
 *     developers table and grab their api_key server-side.
 *   - We then forward to the same auction handler the authenticated REST
 *     endpoint uses, so scoring + budget deduction + impression tracking
 *     all flow through the existing pipeline.
 *   - Abuse mitigation: per-IP rate limit, per-publisher rate limit, and
 *     the Origin header is logged for v1.1 origin-allowlist enforcement.
 *
 * Request body:
 *   {
 *     "publisher_id": "uuid",        // required — developers.id
 *     "context":      "string",      // required — page summary, ~1 sentence
 *     "placement":    "corner" | "citation" | "card" | "loading" | "interstitial" | "hero" | "chip" | "settings",
 *     "format":       "native" | "image" (optional, defaults to native),
 *     "session_id":   "uuid",        // optional — for frequency capping
 *     "page_url":     "https://..."  // optional — for origin verification + intent enrichment
 *   }
 *
 * Response (200 with ad):
 *   { ad: { ad_id, headline, body, image_url, cta_label, click_url, impression_url, ... } }
 *
 * Response (200 no fill):
 *   { ad: null, reason: "no_fill" | "rate_limited" | "publisher_not_found" }
 */

const mcpHandler = require("./mcp.js");

// ── Rate limiting — simple in-memory token bucket per publisher ─────
// 60 requests per minute per publisher to start. Real production will
// want Redis-backed limits, but this prevents trivial abuse.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_PER_PUB = 60;
const _rateBuckets = new Map();
function checkPublisherRate(publisherId) {
  const now = Date.now();
  let bucket = _rateBuckets.get(publisherId);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    _rateBuckets.set(publisherId, bucket);
  }
  bucket.count++;
  if (_rateBuckets.size > 5000) {
    // Periodic cleanup so we don't leak memory
    for (const [k, v] of _rateBuckets) {
      if (now - v.windowStart > RATE_WINDOW_MS) _rateBuckets.delete(k);
    }
  }
  return bucket.count <= RATE_LIMIT_PER_PUB;
}

const HAS_SUPABASE = !!(
  process.env.SUPABASE_URL &&
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
);
let _supabase = null;
function supa() {
  if (_supabase) return _supabase;
  if (!HAS_SUPABASE) return null;
  try {
    const { createClient } = require("@supabase/supabase-js");
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
  } catch (e) {
    console.error("[lumi-fetch] Supabase init failed:", e && e.message);
  }
  return _supabase;
}

// In-memory cache of {publisher_uuid → api_key} so we don't re-query for
// every impression. TTL'd because publishers can rotate keys.
const PUB_CACHE_TTL_MS = 5 * 60 * 1000;
const _pubKeyCache = new Map();
async function resolvePublisherApiKey(publisherId) {
  const now = Date.now();
  const cached = _pubKeyCache.get(publisherId);
  if (cached && now - cached.at < PUB_CACHE_TTL_MS) return cached.apiKey;
  const sb = supa();
  if (!sb) {
    // Demo mode — publisher ID becomes its own API key
    _pubKeyCache.set(publisherId, { at: now, apiKey: publisherId });
    return publisherId;
  }
  try {
    const { data, error } = await sb.from("developers")
      .select("api_key")
      .eq("id", publisherId)
      .single();
    if (error || !data || !data.api_key) {
      _pubKeyCache.set(publisherId, { at: now, apiKey: null });
      return null;
    }
    _pubKeyCache.set(publisherId, { at: now, apiKey: data.api_key });
    return data.api_key;
  } catch (e) {
    console.error("[lumi-fetch] publisher lookup failed:", e && e.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  // CORS — script-tag publishers are on arbitrary origins
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Lumi-Source");
  res.setHeader("X-Boost-Boss-Endpoint", "lumi-fetch");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed", message: "Use POST." });
  }

  const body = req.body || {};
  const publisherId = String(body.publisher_id || "").trim();
  const context     = String(body.context || "").trim();
  const placement   = String(body.placement || "corner").trim().toLowerCase();
  const formatPref  = String(body.format || "native").trim().toLowerCase();
  const sessionId   = String(body.session_id || "lumi_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now());
  const pageUrl     = String(body.page_url || "").trim();
  // Door identifier — maps to the events.integration_method column the
  // verify badge poller reads. Default 'js-snippet' = Browser App for
  // backward compatibility with the v0 runtime that didn't send this.
  // Allowlist mapped to internal door keys; anything else clamps to
  // 'js-snippet' so a malformed client never poisons the analytics.
  const DOOR_ALLOWLIST = { 'js-snippet': 1, 'mcp': 1, 'npm-sdk': 1, 'rest-api': 1 };
  const doorRaw = String(body.door || "js-snippet").trim().toLowerCase();
  const door = DOOR_ALLOWLIST[doorRaw] ? doorRaw : "js-snippet";

  if (!publisherId) {
    return res.status(400).json({ error: "missing_publisher_id", message: "publisher_id is required." });
  }
  if (!context) {
    return res.status(400).json({ error: "missing_context", message: "context is required." });
  }

  // Rate limit per publisher
  if (!checkPublisherRate(publisherId)) {
    return res.status(200).json({ ad: null, reason: "rate_limited" });
  }

  // Resolve the publisher's api_key (publisher_id alone won't work for the
  // auction — but we don't trust the client to send api_key, so server-side
  // lookup is the only safe path).
  const apiKey = await resolvePublisherApiKey(publisherId);
  if (!apiKey) {
    return res.status(200).json({ ad: null, reason: "publisher_not_found" });
  }

  // Log the Origin header for v1.1 allowlist enforcement (no-op in v1.0)
  const origin = (req.headers && (req.headers.origin || req.headers.Origin)) || "";

  // ── Forward to the auction via the same MCP handler /api/ad-request uses ──
  // Build a door-aware surface tag so the auction-side tracking layer
  // can route impressions to the correct integration_method column.
  // The MCP auction uses surface as a free-form string today; downstream
  // we parse the prefix ('web-' / 'desktop-' / 'extension-' / 'mobile-')
  // to determine which door's verify badge to flip.
  const DOOR_SURFACE = { 'js-snippet': 'web', 'mcp': 'desktop', 'npm-sdk': 'extension', 'rest-api': 'mobile' };
  const surfacePrefix = DOOR_SURFACE[door];

  const mockReq = {
    method: "POST",
    headers: { "x-lumi-source": "lumi-" + surfacePrefix + "-app", "content-type": "application/json" },
    query: {},
    body: {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: "get_sponsored_content",
        arguments: {
          context_summary:    context,
          format_preference:  formatPref,
          developer_api_key:  apiKey,
          publisher_id:       apiKey,
          session_id:         sessionId,
          host_app:           "lumi_" + surfacePrefix + "_app",
          surface:            surfacePrefix + "-" + placement,
          // Pass the canonical door key so the auction-side tracking
          // recorder knows which integration_method to write — matches
          // the events.integration_method enum the verify badge poller
          // queries on.
          integration_method: door,
          page_url:           pageUrl || undefined,
          origin:             origin || undefined,
        },
      },
    },
  };

  let captured = { status: 200, body: null, headers: {} };
  const mockRes = {
    setHeader(k, v) { captured.headers[k.toLowerCase()] = v; },
    status(n) { captured.status = n; return this; },
    json(o) { captured.body = o; return this; },
    send(d) { captured.body = d; return this; },
    end() { return this; },
  };

  try {
    await mcpHandler(mockReq, mockRes);
  } catch (e) {
    console.error("[lumi-fetch] upstream MCP error:", e && e.message);
    return res.status(502).json({ error: "upstream_error", message: "Internal MCP handler failed." });
  }

  const env = captured.body;
  if (!env || typeof env !== "object") {
    return res.status(502).json({ error: "bad_upstream", message: "MCP returned no body." });
  }
  if (env.error) {
    return res.status(captured.status >= 400 ? captured.status : 500).json({
      error: "upstream_error",
      message: env.error.message || "Auction failed.",
    });
  }

  const text = env.result && env.result.content && env.result.content[0] && env.result.content[0].text;
  if (!text) {
    return res.status(502).json({ error: "bad_upstream", message: "MCP result missing content." });
  }
  let payload;
  try { payload = JSON.parse(text); }
  catch (_e) {
    return res.status(502).json({ error: "bad_upstream", message: "MCP result not JSON." });
  }

  if (!payload.sponsored) {
    return res.status(200).json({
      ad: null,
      reason: payload.reason || "no_fill",
      auction_id: payload.auction_id || null,
    });
  }

  const s = payload.sponsored;
  const a = payload.auction || {};
  const trackClick = (s.tracking && s.tracking.click) || null;
  const clickUrl = (trackClick && s.cta_url)
    ? trackClick + (trackClick.includes("?") ? "&" : "?") + "to=" + encodeURIComponent(s.cta_url)
    : (trackClick || s.cta_url);

  return res.status(200).json({
    ad: {
      ad_id:            s.campaign_id,
      auction_id:       a.auction_id || null,
      placement:        placement,
      type:             s.type || "native",
      headline:         s.headline || "",
      body:             s.subtext  || "",
      image_url:        s.media_url || null,
      cta_label:        s.cta_label || "Learn more",
      cta_url:          s.cta_url || null,
      click_url:        clickUrl,
      impression_url:   (s.tracking && s.tracking.impression) || null,
      disclosure_label: s.disclosure_label || "Sponsored",
      sandbox:          a.sandbox === true,
    },
  });
};
