/**
 * Boost Boss — advertiser API key management
 *
 *   GET  /api/api-keys              → current key metadata (prefix, scopes) — no secret
 *   POST /api/api-keys              → create/regenerate (revokes old, returns the full key ONCE)
 *   POST /api/api-keys?action=revoke → revoke the active key
 *
 * Auth: the advertiser's own Supabase session (dashboard login). API keys
 * themselves cannot manage keys — you must be signed in.
 *
 * Show-once: only a SHA-256 hash + display prefix are stored (db/api-keys.sql).
 * The full key is returned exactly once, at create/regenerate.
 */
const { createClient } = require("@supabase/supabase-js");
const { generateApiKey, hashApiKey, keyPrefix } = require("./_lib/advertiser_auth.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

const DEFAULT_SCOPES = [
  "campaigns.read", "campaigns.write",
  "products.read", "products.write",
  "reporting.read",
];

let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (!HAS_SUPABASE) return null;
  _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return _sb;
}

// Demo (no Supabase): a single per-lambda in-memory record so the flow works
// locally. advertiserId -> { key_prefix, created_at, hash }
const _demo = new Map();
const DEMO_ADV = "adv_demo";

// The advertiser must be signed in (session JWT) to manage keys.
async function currentAdvertiser(req, cli) {
  const bearer = ((req.headers && req.headers.authorization) || "")
    .replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return null;
  if (!cli) return DEMO_ADV; // demo mode: any bearer maps to the demo advertiser
  try {
    const { data, error } = await cli.auth.getUser(bearer);
    if (error || !data || !data.user) return null;
    return data.user.id;
  } catch (_) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    HAS_SUPABASE ? (process.env.BOOSTBOSS_BASE_URL || "https://boostboss.ai") : "*"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const cli = sb();
  const advId = await currentAdvertiser(req, cli);
  if (!advId) return res.status(401).json({ error: "Sign in required" });

  const action = (req.query && req.query.action) || (req.body && req.body.action) || "";

  // ── GET — metadata only, never the secret ──
  if (req.method === "GET") {
    if (!cli) {
      const d = _demo.get(advId);
      return res.json({
        has_key: !!d, key_prefix: d ? d.key_prefix : null,
        scopes: DEFAULT_SCOPES, created_at: d ? d.created_at : null,
      });
    }
    const { data } = await cli
      .from("advertiser_api_keys")
      .select("key_prefix, scopes, created_at, last_used_at")
      .eq("advertiser_id", advId).is("revoked_at", null).maybeSingle();
    return res.json({
      has_key: !!data,
      key_prefix: data ? data.key_prefix : null,
      scopes: data ? data.scopes : DEFAULT_SCOPES,
      created_at: data ? data.created_at : null,
      last_used_at: data ? data.last_used_at : null,
    });
  }

  if (req.method === "POST") {
    // ── Revoke ──
    if (action === "revoke") {
      if (!cli) { _demo.delete(advId); return res.json({ ok: true }); }
      await cli.from("advertiser_api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("advertiser_id", advId).is("revoked_at", null);
      return res.json({ ok: true });
    }

    // ── Create / regenerate — revoke old, issue new, return full key ONCE ──
    const fullKey = generateApiKey();
    const hash = hashApiKey(fullKey);
    const prefix = keyPrefix(fullKey);

    if (!cli) {
      _demo.set(advId, { key_prefix: prefix, created_at: new Date().toISOString(), hash });
      return res.json({ ok: true, api_key: fullKey, key_prefix: prefix, scopes: DEFAULT_SCOPES });
    }
    // Revoke any existing active key first (one active key per advertiser).
    await cli.from("advertiser_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("advertiser_id", advId).is("revoked_at", null);
    const { error } = await cli.from("advertiser_api_keys").insert({
      advertiser_id: advId, key_hash: hash, key_prefix: prefix, scopes: DEFAULT_SCOPES,
    });
    if (error) {
      console.error("api-keys create error:", error.message);
      return res.status(500).json({ error: "Could not create key. Please try again." });
    }
    return res.json({ ok: true, api_key: fullKey, key_prefix: prefix, scopes: DEFAULT_SCOPES });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
