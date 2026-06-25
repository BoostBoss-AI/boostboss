/**
 * Boost Boss — Creative Assets API
 *
 * One reusable asset library per advertiser. Feeds all 37 placements
 * across the 4 doors (browser / extension / computer / mobile). See
 * db/33_creative_assets.sql for the column shape + the
 * [[advertiser-pilot-model]] memory for the strategic frame.
 *
 * Endpoints:
 *   GET   /api/creative-assets                load the authed advertiser's library
 *   PATCH /api/creative-assets                upsert any subset of fields
 *
 * Image + video files are NOT uploaded through this endpoint. They go
 * directly from the browser to Supabase Storage's 'creative-assets'
 * bucket (RLS-restricted to /{advertiser_id}/* writes per the migration).
 * After upload, the client PATCHes the resulting public URL into the
 * right text/text[] column here.
 *
 * Auth: Bearer JWT. advertiser_id derived server-side via sb.auth.getUser;
 * never trusted from the request body.
 */

"use strict";

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

let _sbAdmin = null;
function sbAdmin() {
  if (_sbAdmin) return _sbAdmin;
  if (!HAS_SUPABASE) return null;
  _sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return _sbAdmin;
}

let _sbAnon = null;
function sbAnon() {
  if (_sbAnon) return _sbAnon;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
  if (!SUPABASE_URL || !anonKey) return null;
  _sbAnon = createClient(SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  return _sbAnon;
}

async function getAuthUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = sbAnon();
  if (!anon) return null;
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

async function requireAdvertiser(req) {
  const user = await getAuthUser(req);
  if (!user) return { error: "unauthorized", status: 401 };
  const sb = sbAdmin();
  if (!sb) return { error: "Supabase not configured", status: 500 };
  const { data: prof } = await sb
    .from("advertisers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  // Auto-derive: if the JWT user has no advertiser row (e.g. publisher
  // crossing over), we still treat user.id as the advertiser_id — the
  // FK to advertisers will fail loudly if they're truly not registered.
  // The unified account model (see memory) makes this safe.
  return { user, advertiserId: prof ? prof.id : user.id };
}

// Whitelist of writable fields. Anything not in this list is dropped from
// the PATCH body so the client can't sneak advertiser_id, library_ready,
// timestamps, etc. into the row.
const TEXT_FIELDS = new Set([
  "brand_name",
  "brand_logo_url",
  "brand_favicon_url",
  "brand_color",
  "brand_domain",
  "video_landscape_url",
  "video_portrait_url",
  "video_poster_url",
  "voucher_value_text",
  "voucher_code",
  "voucher_redemption_url",
]);

const ARRAY_FIELDS = new Set([
  "headlines_short",
  "headlines_medium",
  "headlines_long",
  "body_short",
  "body_medium",
  "body_long",
  "cta_labels",
  "images_16_9",
  "images_9_16",
  "images_3_1",
  "images_2_1",
]);

// Per-field max-length for the variant arrays. The DB doesn't enforce
// these (text type with no check constraint) — we trim/cap here so the
// rendered SDK output stays bounded.
const TEXT_CAPS = {
  brand_name: 40,
  brand_color: 16,
  brand_domain: 120,
  voucher_value_text: 80,
  voucher_code: 32,
};

const ARRAY_CAPS = {
  headlines_short: { itemLen: 30, maxItems: 10 },
  headlines_medium: { itemLen: 55, maxItems: 10 },
  headlines_long: { itemLen: 90, maxItems: 10 },
  body_short: { itemLen: 80, maxItems: 10 },
  body_medium: { itemLen: 140, maxItems: 10 },
  body_long: { itemLen: 280, maxItems: 10 },
  cta_labels: { itemLen: 20, maxItems: 5 },
  images_16_9: { itemLen: 500, maxItems: 10 },
  images_9_16: { itemLen: 500, maxItems: 10 },
  images_3_1: { itemLen: 500, maxItems: 10 },
  images_2_1: { itemLen: 500, maxItems: 10 },
};

function sanitizeBody(body) {
  const out = {};
  if (!body || typeof body !== "object") return out;
  for (const k of Object.keys(body)) {
    const v = body[k];
    if (TEXT_FIELDS.has(k)) {
      if (v === null || v === "") { out[k] = null; continue; }
      if (typeof v !== "string") continue;
      const cap = TEXT_CAPS[k] || 500;
      out[k] = v.trim().slice(0, cap);
    } else if (ARRAY_FIELDS.has(k)) {
      if (!Array.isArray(v)) continue;
      const { itemLen, maxItems } = ARRAY_CAPS[k];
      out[k] = v
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0)
        .map((s) => s.slice(0, itemLen))
        .slice(0, maxItems);
    }
    // silently drop anything else (advertiser_id, library_ready, etc.)
  }
  return out;
}

function defaultRow(advertiserId) {
  return {
    advertiser_id: advertiserId,
    brand_name: null,
    brand_logo_url: null,
    brand_favicon_url: null,
    brand_color: null,
    brand_domain: null,
    headlines_short: [],
    headlines_medium: [],
    headlines_long: [],
    body_short: [],
    body_medium: [],
    body_long: [],
    cta_labels: [],
    images_16_9: [],
    images_9_16: [],
    images_3_1: [],
    images_2_1: [],
    video_landscape_url: null,
    video_portrait_url: null,
    video_poster_url: null,
    voucher_value_text: null,
    voucher_code: null,
    voucher_redemption_url: null,
    library_ready: false,
  };
}

async function handleGet(req, res, sb, advertiserId) {
  const { data, error } = await sb
    .from("creative_assets")
    .select("*")
    .eq("advertiser_id", advertiserId)
    .maybeSingle();
  if (error) {
    console.warn("[creative-assets] GET error:", error.message);
    return res.status(500).json({ error: error.message });
  }
  // No row yet → return the default shape so the client can render its
  // empty-state form without a separate code path.
  return res.json({ assets: data || defaultRow(advertiserId) });
}

async function handlePatch(req, res, sb, advertiserId) {
  const sanitized = sanitizeBody(req.body || {});
  if (Object.keys(sanitized).length === 0) {
    return res.status(400).json({ error: "No writable fields in body" });
  }
  // Upsert by advertiser_id (unique constraint).
  const payload = { advertiser_id: advertiserId, ...sanitized };
  const { data, error } = await sb
    .from("creative_assets")
    .upsert(payload, { onConflict: "advertiser_id" })
    .select("*")
    .single();
  if (error) {
    console.warn("[creative-assets] PATCH error:", error.message);
    return res.status(500).json({ error: error.message });
  }
  return res.json({ assets: data });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = sbAdmin();
  if (!sb) return res.status(500).json({ error: "Supabase not configured" });

  const auth = await requireAdvertiser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    if (req.method === "GET") return handleGet(req, res, sb, auth.advertiserId);
    if (req.method === "PATCH") return handlePatch(req, res, sb, auth.advertiserId);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[creative-assets] handler error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
};
