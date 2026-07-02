/**
 * Boost Boss — advertiser auth helper
 *
 * Resolves the advertiser making a request from EITHER:
 *   • a Boost Boss API key   (Authorization: Bearer bb_live_…)
 *   • a Supabase session JWT (the dashboard login)
 *
 * API keys are show-once: we store only a SHA-256 hash + a short display
 * prefix, never the raw key. See db/api-keys.sql + api/api-keys.js.
 */
const crypto = require("crypto");

const KEY_PREFIX_LIVE = "bb_live_";
const PREFIX_DISPLAY_LEN = 16; // chars of the full key kept for display

function generateApiKey() {
  // url-safe, ~32 random chars after the bb_live_ prefix
  return KEY_PREFIX_LIVE + crypto.randomBytes(24).toString("base64url");
}

function hashApiKey(key) {
  return crypto.createHash("sha256").update(String(key), "utf8").digest("hex");
}

function keyPrefix(key) {
  return String(key).slice(0, PREFIX_DISPLAY_LEN);
}

function looksLikeApiKey(token) {
  return typeof token === "string" && /^bb_(live|test)_/.test(token);
}

// API key → advertiser_id via the advertiser_api_keys table (service client).
// Best-effort last_used_at bump (fire-and-forget). Returns id or null.
async function resolveApiKeyToAdvertiser(key, sb) {
  if (!sb || !looksLikeApiKey(key)) return null;
  const hash = hashApiKey(key);
  const { data, error } = await sb
    .from("advertiser_api_keys")
    .select("advertiser_id")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;
  try {
    sb.from("advertiser_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", hash)
      .then(() => {}, () => {});
  } catch (_) {}
  return data.advertiser_id;
}

/**
 * Unified advertiser identity resolver.
 * @returns {Promise<{advertiserId:string, via:'api_key'|'session'} | {error:string, status:number}>}
 *
 * IMPORTANT: callers must use the returned advertiserId as the source of
 * truth — never trust an advertiser_id from the request body/query when a
 * key or session is present, or you reopen the 2026-06-25 cross-tenant leak.
 */
async function resolveAdvertiser(req, sb) {
  const authHeader = (req.headers && req.headers.authorization) || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return { error: "Bearer token required", status: 401 };

  if (looksLikeApiKey(bearer)) {
    const advId = await resolveApiKeyToAdvertiser(bearer, sb);
    if (!advId) return { error: "Invalid or revoked API key", status: 401 };
    return { advertiserId: advId, via: "api_key" };
  }

  try {
    const { data, error } = await sb.auth.getUser(bearer);
    if (error || !data || !data.user) {
      return { error: "Invalid or expired session", status: 401 };
    }
    return { advertiserId: data.user.id, via: "session" };
  } catch (_) {
    return { error: "Auth check failed", status: 401 };
  }
}

module.exports = {
  KEY_PREFIX_LIVE,
  generateApiKey,
  hashApiKey,
  keyPrefix,
  looksLikeApiKey,
  resolveApiKeyToAdvertiser,
  resolveAdvertiser,
};
