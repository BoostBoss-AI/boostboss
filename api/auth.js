/**
 * Boost Boss — Auth API
 *
 * Two execution modes:
 *  • PRODUCTION  — Supabase (when SUPABASE_URL + SUPABASE_ANON_KEY are set)
 *  • IN-MEMORY   — HMAC-signed JWTs against an in-process user map. Used
 *                  for local dev, CI, and the BBX sandbox where there is
 *                  no Supabase configured. NOT a user-facing "demo mode".
 *
 * Both modes expose the same interface so the front-end never has to branch.
 *
 *   POST /api/auth?action=signup      { email, password, role, company_name?, app_name? }
 *   POST /api/auth?action=login       { email, password }
 *   POST /api/auth?action=oauth_sync  { role }  Authorization: Bearer <supabase-oauth-token>
 *   POST /api/auth?action=me          Authorization: Bearer <token>
 *   POST /api/auth?action=logout      Authorization: Bearer <token>
 *
 * The legacy `action=demo` quick-start endpoint was removed 2026-05-28
 * when the "Try the demo" buttons were dropped from the dashboards and
 * signup pages — no live demo accounts are offered any more.
 */

const crypto = require("crypto");

// ── environment sniff ───────────────────────────────────────────────
const HAS_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
const JWT_SECRET = process.env.JWT_SECRET || "bbx-demo-jwt-secret-do-not-use-in-prod";
const TOKEN_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

// ── lazy Supabase loader (so demo mode has zero deps) ───────────────
let _createClient = null;
function loadSupabase() {
  if (_createClient) return _createClient;
  try {
    _createClient = require("@supabase/supabase-js").createClient;
  } catch (e) {
    console.warn("[Auth] @supabase/supabase-js not installed — demo mode only.");
  }
  return _createClient;
}

// ── HMAC-signed JWT (HS256) ─────────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}
function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", JWT_SECRET).update(header + "." + body).digest());
  return header + "." + body + "." + sig;
}
function verifyJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  const expected = b64url(crypto.createHmac("sha256", JWT_SECRET).update(h + "." + b).digest());
  if (s !== expected) return null;
  try {
    const payload = JSON.parse(b64urlDecode(b));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ── deterministic demo user IDs ─────────────────────────────────────
function userIdFromEmail(email) {
  return "u_" + crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 16);
}
function makeApiKey(prefix, userId) {
  const seed = crypto.createHash("sha256").update(prefix + ":" + userId + ":" + JWT_SECRET).digest("hex");
  return `bb_${prefix}_live_${seed.slice(0, 32)}`;
}

// ── Affiliate share-link helpers ───────────────────────────────────────
// makeToken: 8-char base62 → ~218 trillion possibilities. Collision risk
// at any reasonable scale is negligible; the affiliate_share_links table
// has a UNIQUE constraint on token so a collision throws and the caller
// retries with a fresh value.
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // skip 0/O/1/l/I for legibility
function makeToken(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

// buildShareUrl: assemble the public-facing share URL for a token. Uses
// PUBLIC_BASE if set (production = https://boostboss.ai), falls back to
// the request's own origin so dev / preview deploys work without env vars.
function buildShareUrl(req, token) {
  const fromEnv = process.env.PUBLIC_BASE || process.env.PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "") + "/s/" + token;
  const host = (req && req.headers && req.headers.host) || "boostboss.ai";
  const proto = (req && req.headers && req.headers["x-forwarded-proto"]) || "https";
  return proto + "://" + host + "/s/" + token;
}

// ── demo-mode in-process user store (resets on cold start; that's fine) ──
const DEMO_USERS = new Map(); // userId → user row

function demoUpsert(email, role, extras = {}) {
  const id = userIdFromEmail(email);
  const existing = DEMO_USERS.get(id);
  const now = new Date().toISOString();
  const user = existing || {
    id, email, role,
    created_at: now,
    profile: role === "advertiser"
      ? {
          company_name: extras.company_name || email.split("@")[0],
          balance: 5000.00,
          monthly_spend: 12480.32,
          active_campaigns: 4,
          impressions_30d: 2_140_817,
          api_key: makeApiKey("adv", id),
        }
      : {
          app_name: extras.app_name || "My AI App",
          monthly_revenue: 18920.55,
          active_publishers: 1,
          ad_requests_30d: 4_312_006,
          fill_rate: 0.812,
          api_key: makeApiKey("dev", id),
        },
  };
  DEMO_USERS.set(id, user);
  return user;
}

function tokenFor(user) {
  return signJwt({
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
    iss: "boostboss.ai",
  });
}

// ────────────────────────────────────────────────────────────────────
//                  bb_session COOKIE — cross-origin auth
// ────────────────────────────────────────────────────────────────────
// Used purely so benna.ai (different root domain) can ask "is this user
// signed in?" via a CORS fetch with credentials: 'include'. The same JWT
// value also lives in localStorage on boostboss.ai for everything else —
// the cookie is purely additive.
//
// Security model:
//   - HttpOnly  → JS can't read the cookie; only the browser sends it.
//                 Reduces XSS impact (a stolen XSS payload can't exfil
//                 the session token from document.cookie).
//   - Secure    → only sent over HTTPS.
//   - SameSite=None → required so the browser sends it on the
//                     cross-origin fetch from benna.ai to boostboss.ai.
//   - Path=/    → available on every endpoint on boostboss.ai.
//
// CSRF: the cookie is used ONLY for the read-only me_cors action, which
// returns just { email, app_name, role }. State-changing endpoints
// still require the Bearer token in the Authorization header — which a
// CSRF attacker can't forge cross-origin. So the cookie identifies who;
// the Bearer token still authorizes what.
function setSessionCookie(res, token) {
  if (!token) return;
  const cookie = [
    "bb_session=" + token,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Max-Age=" + TOKEN_TTL_SEC,
  ].join("; ");
  // Append rather than overwrite so we don't clobber any other Set-Cookie
  // headers the response is already carrying.
  const prior = res.getHeader("Set-Cookie");
  if (!prior) {
    res.setHeader("Set-Cookie", cookie);
  } else if (Array.isArray(prior)) {
    res.setHeader("Set-Cookie", prior.concat(cookie));
  } else {
    res.setHeader("Set-Cookie", [prior, cookie]);
  }
}

// Read the bb_session value from the Cookie request header. Returns the
// JWT string (or null). Robust against extra cookies and missing header.
function readSessionCookie(req) {
  const raw = req.headers && req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === "bb_session") return part.slice(eq + 1).trim();
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────
//                              HANDLER
// ────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Restrict CORS in production. Two trust circles:
  //   1. Same-origin (boostboss.ai, www.) — the main dashboard
  //   2. Cross-origin benna.ai — marketing site that needs to know whether
  //      the user is signed in so it can render an avatar + name lockup
  //      instead of the Sign-up CTA.
  // Cross-origin requests from benna.ai MUST send credentials (the
  // bb_session cookie) to read the me_cors response, so we have to:
  //   - echo the exact Origin header back (wildcard not allowed with credentials)
  //   - set Access-Control-Allow-Credentials: true
  //   - include cookie in Vary so cached responses don't leak across origins.
  const PUBLIC_BASE = process.env.BOOSTBOSS_BASE_URL || "https://boostboss.ai";
  const ALLOWED_ORIGINS = [
    "https://boostboss.ai",
    "https://www.boostboss.ai",
    "https://benna.ai",
    "https://www.benna.ai",
    PUBLIC_BASE,
  ];
  const reqOrigin = req.headers && req.headers.origin;
  if (HAS_SUPABASE) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : PUBLIC_BASE
    );
  } else {
    // Demo / dev — echo any origin so localhost works, but only when there
    // IS an origin (browsers send it on cross-origin fetches).
    res.setHeader("Access-Control-Allow-Origin", reqOrigin || "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin, Cookie");
  res.setHeader("x-auth-mode", HAS_SUPABASE ? "supabase" : "demo");
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = (req.query && req.query.action) || (req.body && req.body.action);
  const body = req.body || {};

  // Read-only actions allowed via GET. These are idempotent fetches with
  // no side effects; pagination params go in the query string. Everything
  // else still requires POST.
  //   - me_cors: benna.ai logged-in lockup (legacy)
  //   - affiliate_list_saved: affiliate dashboard saved-ads list
  //   - affiliate_list_share_links: affiliate dashboard share-links list
  const GET_ALLOWED = new Set([
    "me_cors",
    "affiliate_list_saved",
    "affiliate_list_share_links",
  ]);
  if (req.method === "GET" && !GET_ALLOWED.has(action)) {
    return res.status(405).json({ error: "GET not allowed for this action" });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    // ── DEMO MODE ─────────────────────────────────────────────────
    if (!HAS_SUPABASE) return demoHandler(action, body, req, res);

    // ── SUPABASE MODE ─────────────────────────────────────────────
    return supabaseHandler(action, body, req, res);
  } catch (err) {
    console.error("[Auth Error]", err);
    return res.status(500).json({ error: err.message });
  }
};

// ──────────────── IN-MEMORY MODE IMPLEMENTATION ─────────────────────
// Runs when Supabase isn't configured (local dev, CI, sandbox). Calls
// itself "demo" in error responses for historical compat; this is not
// the same as the user-facing "Try the demo" button (which was removed
// 2026-05-28).
function demoHandler(action, body, req, res) {
  if (action === "signup") {
    const { email, password, role, company_name, app_name } = body;
    if (!email || !password || !role) return res.status(400).json({ error: "Missing email, password, or role" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    if (!["advertiser", "developer"].includes(role)) return res.status(400).json({ error: "role must be advertiser or developer" });
    const user = demoUpsert(email, role, { company_name, app_name });
    const token = tokenFor(user);
    setSessionCookie(res, token);
    return res.json({
      success: true,
      mode: "demo",
      user: { id: user.id, email: user.email, role: user.role },
      profile: user.profile,
      session: { access_token: token, expires_in: TOKEN_TTL_SEC, token_type: "Bearer" },
    });
  }

  if (action === "login") {
    const { email, password } = body;
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });
    // In demo mode, any login auto-creates an advertiser if unknown — friction-free for evaluators.
    const id = userIdFromEmail(email);
    let user = DEMO_USERS.get(id);
    if (!user) user = demoUpsert(email, "advertiser");
    const token = tokenFor(user);
    setSessionCookie(res, token);
    return res.json({
      success: true,
      mode: "demo",
      user: { id: user.id, email: user.email, role: user.role },
      profile: user.profile,
      session: { access_token: token, expires_in: TOKEN_TTL_SEC, token_type: "Bearer" },
    });
  }

  // Cross-origin read-only auth check used by benna.ai.
  //   GET /api/auth?action=me_cors with Cookie: bb_session=<jwt>
  // Returns a minimal {email, app_name, role} so benna.ai can render
  // the avatar + name lockup. Never returns sensitive data.
  if (action === "me_cors") {
    const token = readSessionCookie(req);
    if (!token) return res.status(401).json({ error: "Not signed in" });
    const claims = verifyJwt(token);
    if (!claims) return res.status(401).json({ error: "Invalid or expired token" });
    let user = DEMO_USERS.get(claims.sub);
    if (!user) user = demoUpsert(claims.email, claims.role);
    const p = user.profile || {};
    return res.json({
      mode: "demo",
      email:        user.email,
      role:         user.role,
      app_name:     p.app_name || null,
      company_name: p.company_name || null,
    });
  }

  if (action === "me") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const claims = verifyJwt(token);
    if (!claims) return res.status(401).json({ error: "Invalid or expired token" });
    let user = DEMO_USERS.get(claims.sub);
    if (!user) user = demoUpsert(claims.email, claims.role); // re-hydrate if cold-start lost it
    return res.json({
      mode: "demo",
      user: { id: user.id, email: user.email, role: user.role },
      profile: user.profile,
    });
  }

  if (action === "logout") {
    // JWTs are stateless — client just discards the token. Acknowledge for UX symmetry.
    // Also clear the bb_session cookie so benna.ai's me_cors check
    // returns 401 on the next page load.
    res.setHeader("Set-Cookie",
      "bb_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0");
    return res.json({ success: true, mode: "demo" });
  }

  // Update a publisher's accepted ad formats. The auction reads this to filter
  // campaigns so publishers only receive formats they've opted into.
  if (action === "update_formats") {
    const { api_key, formats } = body;
    if (!api_key || !formats) return res.status(400).json({ error: "Missing api_key or formats" });
    // Demo mode: find the developer by api_key and update in-memory.
    for (const user of DEMO_USERS.values()) {
      if (user.profile?.api_key === api_key) {
        user.profile.formats = { ...(user.profile.formats || {}), ...formats };
        return res.json({ success: true, mode: "demo", formats: user.profile.formats });
      }
    }
    return res.status(404).json({ error: "Developer not found" });
  }

  // Update which placements the publisher has switched off (demo path).
  if (action === "update_placements") {
    const { api_key, disabled_placements } = body;
    if (!api_key || !Array.isArray(disabled_placements)) {
      return res.status(400).json({ error: "Missing api_key or disabled_placements[]" });
    }
    for (const user of DEMO_USERS.values()) {
      if (user.profile?.api_key === api_key) {
        user.profile.disabled_placements = disabled_placements.map(String);
        return res.json({ success: true, mode: "demo", disabled_placements: user.profile.disabled_placements });
      }
    }
    return res.status(404).json({ error: "Developer not found" });
  }

  // Update a user's notification preferences (publisher or advertiser).
  // Demo mode: match by api_key when supplied; otherwise just acknowledge
  // (demo state is in-memory and ephemeral, so persistence isn't critical).
  if (action === "update_notif_prefs") {
    const prefs = body && body.prefs;
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
      return res.status(400).json({ error: "prefs must be an object" });
    }
    if (body.api_key) {
      for (const user of DEMO_USERS.values()) {
        if (user.profile && user.profile.api_key === body.api_key) {
          user.profile.notification_prefs = { ...(user.profile.notification_prefs || {}), ...prefs };
          return res.json({ success: true, mode: "demo", notification_prefs: user.profile.notification_prefs });
        }
      }
    }
    return res.json({ success: true, mode: "demo", notification_prefs: prefs });
  }

  // Update a publisher's account-level brand-safety blocklists.
  if (action === "update_brand_safety") {
    const cats = Array.isArray(body && body.blocked_categories) ? body.blocked_categories : null;
    const doms = Array.isArray(body && body.blocked_advertiser_domains) ? body.blocked_advertiser_domains : null;
    if (cats === null && doms === null) {
      return res.status(400).json({ error: "Provide blocked_categories and/or blocked_advertiser_domains arrays" });
    }
    if (body.api_key) {
      for (const user of DEMO_USERS.values()) {
        if (user.profile && user.profile.api_key === body.api_key) {
          if (cats) user.profile.blocked_categories = cats;
          if (doms) user.profile.blocked_advertiser_domains = doms;
          return res.json({
            success: true, mode: "demo",
            blocked_categories: user.profile.blocked_categories || [],
            blocked_advertiser_domains: user.profile.blocked_advertiser_domains || [],
          });
        }
      }
    }
    return res.json({ success: true, mode: "demo", blocked_categories: cats || [], blocked_advertiser_domains: doms || [] });
  }

  if (action === "change_password") {
    return res.status(400).json({ error: "Password change requires a real account — not available in demo mode." });
  }

  if (action === "oauth_sync") {
    // No Supabase configured; OAuth isn't available here.
    return res.status(501).json({ error: "Google sign-in requires Supabase — this deployment isn't configured for OAuth. Use email + password." });
  }

  return res.status(400).json({ error: "Unknown action. Use: signup, login, oauth_sync, me, logout, update_formats, update_placements" });
}

// ─────────────────── SUPABASE IMPLEMENTATION ────────────────────────
async function supabaseHandler(action, body, req, res) {
  const createClient = loadSupabase();
  if (!createClient) {
    return res.status(500).json({ error: "Supabase configured but @supabase/supabase-js not installed" });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const supabaseAdmin = createClient(process.env.SUPABASE_URL, serviceKey);
  const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  // The `action === "demo"` quick-start branch was removed 2026-05-28.
  // The dashboards no longer expose a "Try the demo" button, so there's
  // no caller for it — users go through normal signup or OAuth.

  if (action === "signup") return signupSupabase(supabaseAdmin, supabaseAnon, body, res);

  if (action === "login") {
    const { email, password, role: wantedRoleRaw } = body;
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) {
      // Phase 3A: catch the specific "email not confirmed" error and return
      // a structured response so the signup page can render a "resend
      // confirmation" button instead of a generic error.
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed") || msg.includes("confirm")) {
        return res.status(403).json({
          error: "Please confirm your email before signing in. Check your inbox for the confirmation link.",
          requires_confirmation: true,
          email,
        });
      }
      return res.status(401).json({ error: error.message });
    }

    // Two-product sign-in: the role is decided by the URL the user came
    // from (e.g. /publish/signin vs /ads/signin). We only return the
    // profile matching that role — so a publisher signing in on /ads
    // gets a clean "no advertiser account, sign up first" error.
    const wantedRole =
      wantedRoleRaw === "developer" || wantedRoleRaw === "advertiser"
        ? wantedRoleRaw
        : (data.user?.user_metadata?.role || "advertiser");

    let profile = null;
    if (wantedRole === "advertiser") {
      const { data: adv } = await supabaseAdmin.from("advertisers").select("*").eq("id", data.user.id).maybeSingle();
      profile = adv;
    } else if (wantedRole === "developer") {
      const { data: dev } = await supabaseAdmin.from("developers").select("*").eq("id", data.user.id).maybeSingle();
      profile = dev;
      if (profile && !profile.api_key) {
        const apiKey = makeApiKey("dev", data.user.id);
        await supabaseAdmin.from("developers").update({ api_key: apiKey }).eq("id", data.user.id);
        profile.api_key = apiKey;
      }
    }

    if (!profile) {
      // Cross-role sign-in path (added 2026-06-14). The auth user exists
      // (their email+password is valid), but they don't have a profile row
      // for the dashboard they just tried to enter. Instead of forcing them
      // back to /signup with terms re-check and a second welcome email, we
      // return a structured response so the signin page can pop an inline
      // questionnaire — they finish onboarding right there and land on the
      // dashboard.
      //
      // The session IS returned so the signin page can immediately call
      // the follow-up complete_role_profile endpoint with the Bearer token.
      // Setting the session cookie too keeps benna.ai in sync.
      setSessionCookie(res, data.session.access_token);
      return res.json({
        success:       true,
        mode:          "supabase",
        needs_profile: wantedRole,                 // 'advertiser' | 'developer'
        user:          { id: data.user.id, email: data.user.email, role: wantedRole },
        session:       { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
      });
    }

    // Set the cross-origin session cookie alongside the existing
    // Bearer token. benna.ai reads this cookie via /api/auth?action=me_cors
    // to know whether to render the avatar lockup or the Sign-up CTA.
    setSessionCookie(res, data.session.access_token);

    return res.json({
      success: true, mode: "supabase",
      user: { id: data.user.id, email: data.user.email, role: wantedRole },
      profile,
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    });
  }

  // ── Cross-role onboarding: complete the missing profile ──
  // Companion endpoint to the login `needs_profile` branch. The user has
  // already authenticated at the Supabase auth level (their email+password
  // worked). They land on /ads/signin while only having a developer row
  // (or vice versa). The signin page captures the Bearer access_token from
  // the login response and POSTs here with the role-specific fields the
  // questionnaire collected. We insert the missing row, return the full
  // session/profile, and the page redirects to the dashboard.
  //
  // Why this is separate from signup:
  //   • Terms are already accepted from the original signup
  //   • The auth user already exists — Supabase will not fire a second
  //     "Confirm signup" email (we use signInWithPassword identity, not
  //     supabaseAnon.auth.signUp)
  //   • user_metadata.roles[] gets the new role appended so future logins
  //     remember this account is enrolled in both products
  //
  // Body: { role: 'advertiser' | 'developer', company_name?, app_name? }
  // Auth: Authorization: Bearer <access_token from the login response>
  if (action === "complete_role_profile") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Missing access token. Sign in first." });

    const { role: roleRaw, company_name, app_name, integration_door: doorRaw } = body || {};
    const role = roleRaw === "advertiser" || roleRaw === "developer" ? roleRaw : null;
    if (!role) return res.status(400).json({ error: "Missing or invalid role" });
    // Whitelist the integration door so a misbehaving client can't shove
    // arbitrary strings into the column behind the CHECK constraint.
    const ALLOWED_DOORS = new Set(["mcp", "js_snippet", "npm_sdk", "rest"]);
    const integration_door = (role === "developer" && ALLOWED_DOORS.has(doorRaw)) ? doorRaw : null;

    const { data: { user }, error: meErr } = await supabaseAnon.auth.getUser(token);
    if (meErr || !user) return res.status(401).json({ error: "Invalid or expired token. Sign in again." });

    const table = role === "advertiser" ? "advertisers" : "developers";

    // Don't double-insert. If the row already exists this user clicked
    // back/forward to a stale modal — surface a clean error.
    const { data: existing } = await supabaseAdmin
      .from(table).select("id").eq("id", user.id).maybeSingle();
    if (existing) {
      const product = role === "advertiser" ? "SuperBoost Ads" : "Lumi SDK";
      return res.status(409).json({ error: `Already enrolled in ${product}. Please sign in normally.` });
    }

    // Insert the new role's profile row. Defaults mirror the original
    // signup path so downstream surfaces (campaign create, payouts) find
    // the columns they expect.
    let inserted = null;
    if (role === "advertiser") {
      const { data, error } = await supabaseAdmin
        .from("advertisers")
        .insert({
          id:           user.id,
          email:        user.email,
          company_name: company_name || (user.email || "").split("@")[0],
          balance:      0,
        })
        .select("*").maybeSingle();
      if (error) return res.status(500).json({ error: "Could not create advertiser profile: " + error.message });
      inserted = data;
    } else {
      const apiKey = makeApiKey("dev", user.id);
      const { data, error } = await supabaseAdmin
        .from("developers")
        .insert({
          id:                user.id,
          email:             user.email,
          app_name:          app_name || (user.email || "").split("@")[0],
          api_key:           apiKey,
          integration_door:  integration_door,  // nullable; whitelisted above
        })
        .select("*").maybeSingle();
      if (error) return res.status(500).json({ error: "Could not create developer profile: " + error.message });
      inserted = data;
    }

    // Merge the new role into user_metadata.roles[] so the next login on
    // either side knows this account spans both products.
    try {
      const existingMeta = user.user_metadata || {};
      const existingRoles = existingMeta.roles || (existingMeta.role ? [existingMeta.role] : []);
      const mergedRoles = Array.from(new Set([].concat(existingRoles, [role])));
      const newMeta = Object.assign({}, existingMeta, { role, roles: mergedRoles });
      if (role === "advertiser" && company_name) newMeta.company_name = company_name;
      if (role === "developer"  && app_name)     newMeta.app_name     = app_name;
      await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: newMeta });
    } catch (e) {
      console.warn("[Auth] complete_role_profile: user_metadata merge failed:", e.message);
    }

    return res.json({
      success: true,
      mode:    "supabase",
      user:    { id: user.id, email: user.email, role },
      profile: inserted,
    });
  }

  // Cross-origin read-only auth check used by benna.ai.
  // Same shape as the demo branch's me_cors above.
  if (action === "me_cors") {
    const token = readSessionCookie(req);
    if (!token) return res.status(401).json({ error: "Not signed in" });
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid or expired token" });
    // Pull the matching profile for whichever role the user last signed
    // in with. We don't know the route they're coming from on benna.ai,
    // so fall back to user_metadata.role.
    const role = user.user_metadata?.role || "advertiser";
    let appName = null, companyName = null;
    if (role === "advertiser") {
      const { data: adv } = await supabaseAdmin
        .from("advertisers")
        .select("company_name")
        .eq("id", user.id)
        .maybeSingle();
      companyName = adv && adv.company_name;
    } else if (role === "developer") {
      const { data: dev } = await supabaseAdmin
        .from("developers")
        .select("app_name")
        .eq("id", user.id)
        .maybeSingle();
      appName = dev && dev.app_name;
    }
    return res.json({
      mode: "supabase",
      email:        user.email,
      role,
      app_name:     appName,
      company_name: companyName,
    });
  }

  if (action === "me") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token" });
    // An account can hold profiles for BOTH products (/publish dev + /ads
    // advertiser). The caller tells us which product's dashboard it is,
    // via { role: "developer" | "advertiser" } in the body. When the
    // caller doesn't specify, fall back to user_metadata.role (the last
    // role the user actively signed in with).
    const wantedRaw = body && body.role;
    const role = (wantedRaw === "developer" || wantedRaw === "advertiser")
      ? wantedRaw
      : (user.user_metadata?.role || "unknown");
    let profile = null;
    if (role === "advertiser") {
      const { data } = await supabaseAdmin.from("advertisers").select("*").eq("id", user.id).maybeSingle();
      profile = data;
    } else if (role === "developer") {
      const { data } = await supabaseAdmin.from("developers").select("*").eq("id", user.id).maybeSingle();
      profile = data;
      if (profile && !profile.api_key) {
        const apiKey = makeApiKey("dev", user.id);
        await supabaseAdmin.from("developers").update({ api_key: apiKey }).eq("id", user.id);
        profile.api_key = apiKey;
      }
    }
    return res.json({ mode: "supabase", user: { id: user.id, email: user.email, role }, profile });
  }

  if (action === "oauth_sync") {
    // Called after a successful Google OAuth return. The frontend sends
    // the Supabase access_token + the role implied by the URL path. We
    // verify the token, ensure the profile row for THAT role exists
    // (creating it on first visit, adding it alongside any other role
    // the user may already have), and return the same shape as
    // signup/login so the frontend can persist the session and redirect.
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid OAuth token" });

    // Role ALWAYS comes from the URL path the user is on (passed in body),
    // not from existing user_metadata. Publisher and Advertiser are two
    // separate products on the same auth user.
    const role = body.role === "developer" ? "developer" : "advertiser";

    // Ensure the profile row for this role exists (create on first time).
    // `wasNewProfile` triggers the branded welcome email further down.
    let profile = null;
    let wasNewProfile = false;
    if (role === "advertiser") {
      const { data: existing } = await supabaseAdmin
        .from("advertisers").select("*").eq("id", user.id).maybeSingle();
      if (existing) {
        profile = existing;
      } else {
        const fullName = user.user_metadata?.full_name
                      || user.user_metadata?.name
                      || (user.email || "").split("@")[0];
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("advertisers")
          .insert({ id: user.id, email: user.email, company_name: fullName, balance: 0 })
          .select("*").single();
        if (insErr) return res.status(500).json({ error: "Profile create failed: " + insErr.message });
        profile = inserted;
        wasNewProfile = true;
      }
    } else {
      const { data: existing } = await supabaseAdmin
        .from("developers").select("*").eq("id", user.id).maybeSingle();
      if (existing) {
        profile = existing;
        if (!profile.api_key) {
          const apiKey = makeApiKey("dev", user.id);
          await supabaseAdmin.from("developers").update({ api_key: apiKey }).eq("id", user.id);
          profile.api_key = apiKey;
        }
      } else {
        const apiKey = makeApiKey("dev", user.id);
        const fullName = user.user_metadata?.full_name
                      || user.user_metadata?.name
                      || "My AI App";
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("developers")
          .insert({ id: user.id, email: user.email, app_name: fullName, api_key: apiKey, status: "active" })
          .select("*").single();
        if (insErr) return res.status(500).json({ error: "Profile create failed: " + insErr.message });
        profile = inserted;
        wasNewProfile = true;
      }
    }

    // Phase 4: send the branded welcome email on FIRST successful sign-in
    // for this role. Fire-and-forget — don't block the response on email
    // delivery. If `wasNewProfile` is false (returning user, or user adding
    // a second product to an existing account), we skip the welcome.
    if (wasNewProfile && user.email) {
      try {
        const { sendWelcome } = require("./_lib/emails/send");
        const firstName = (user.user_metadata?.full_name || user.user_metadata?.name || "")
          .toString().split(" ")[0] || "";
        sendWelcome({ to: user.email, role, firstName })
          .catch((e) => console.error("[Auth oauth_sync] sendWelcome threw:", e.message));
      } catch (e) {
        console.warn("[Auth oauth_sync] welcome email skipped:", e.message);
      }
    }

    // Merge the role into user_metadata.roles[] so future signins know
    // which products this account has profiles for.
    try {
      const existingMeta = user.user_metadata || {};
      const existingRoles = existingMeta.roles || (existingMeta.role ? [existingMeta.role] : []);
      const mergedRoles = Array.from(new Set([].concat(existingRoles, [role])));
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: Object.assign({}, existingMeta, { role, roles: mergedRoles }),
      });
    } catch (e) {
      console.warn("[Auth oauth_sync] user_metadata update failed:", e.message);
    }

    // Set the cross-origin session cookie so benna.ai can detect the
    // logged-in user. Google OAuth is the most common sign-in path, so
    // this branch absolutely has to set the cookie — missing this was
    // the bug that left benna.ai showing Sign-up after every OAuth
    // sign-in.
    setSessionCookie(res, token);

    return res.json({
      success: true, mode: "supabase",
      user: { id: user.id, email: user.email, role },
      profile,
      session: { access_token: token, refresh_token: null },
    });
  }

  if (action === "logout") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (token) await supabaseAnon.auth.signOut();
    // Clear the cross-origin session cookie so benna.ai notices.
    res.setHeader("Set-Cookie",
      "bb_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0");
    return res.json({ success: true, mode: "supabase" });
  }

  // ── Phase 3A: Resend the email-confirmation message ──
  // Called from either the /check-email page ("Didn't get the email?") or
  // from the signup page when a login fails with requires_confirmation.
  if (action === "resend_confirmation") {
    const { email, role: roleRaw } = body;
    if (!email) return res.status(400).json({ error: "Missing email" });
    const role = roleRaw === "developer" ? "developer" : "advertiser";
    const { error } = await supabaseAnon.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: confirmRedirectFor(role) },
    });
    if (error) {
      // Don't leak whether the email exists — return a generic success
      // even on "user not found" to avoid email enumeration.
      console.warn("[Auth] resend_confirmation error:", error.message);
    }
    return res.json({ success: true });
  }

  // ── Phase 3B: Request password reset email ──
  // Triggered by the /forgot-password page. Email contains a link to
  // /ads/reset-password (or /publish/reset-password) where the user lands
  // with the recovery access_token in the URL hash. The reset-password
  // page uses that token to authenticate, then calls action=update_password
  // to set the new value.
  //
  // We always return success even if the email doesn't exist, to avoid
  // letting attackers enumerate registered emails.
  if (action === "request_password_reset") {
    const { email, role: roleRaw } = body;
    if (!email) return res.status(400).json({ error: "Missing email" });
    const role = roleRaw === "developer" ? "developer" : "advertiser";
    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectFor(role),
    });
    if (error) {
      console.warn("[Auth] request_password_reset error:", error.message);
    }
    return res.json({ success: true });
  }

  // ── Phase 3B: Update password using a recovery-flow access_token ──
  // The /reset-password page extracts the access_token from the URL hash
  // (set by Supabase after verifying the recovery link), then POSTs it
  // here with the new password. We use the user-scoped Supabase client
  // (not admin) so that the access_token is what authorizes the update,
  // not our service role key — that way the token actually has to be
  // valid + non-expired + of recovery type.
  if (action === "update_password") {
    const { access_token, password } = body;
    if (!access_token || !password) {
      return res.status(400).json({ error: "Missing access_token or password" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const createClient = loadSupabase();
    if (!createClient) return res.status(500).json({ error: "Supabase client unavailable" });
    // User-scoped client — uses the recovery access_token as the bearer.
    const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${access_token}` } },
    });
    const { error } = await supabaseUser.auth.updateUser({ password });
    if (error) {
      return res.status(400).json({
        error: error.message || "Could not update password. The reset link may have expired.",
      });
    }
    return res.json({ success: true });
  }

  if (action === "update_formats") {
    const { api_key, formats } = body;
    if (!api_key || !formats) return res.status(400).json({ error: "Missing api_key or formats" });
    // Schema stores format prefs as individual boolean columns for indexing
    // clarity (format_native, format_image, format_corner, format_video,
    // format_fullscreen). Translate the JSON toggles the client sent into
    // column updates, ignoring unknown keys.
    const columnMap = {
      native:     "format_native",
      image:      "format_image",
      corner:     "format_corner",
      video:      "format_video",
      fullscreen: "format_fullscreen",
    };
    const updates = {};
    for (const [key, value] of Object.entries(formats)) {
      const col = columnMap[key];
      if (col) updates[col] = !!value;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No recognized format keys" });
    }
    const { data: dev, error: lookupErr } = await supabaseAdmin
      .from("developers")
      .select("id")
      .eq("api_key", api_key)
      .single();
    if (lookupErr || !dev) return res.status(404).json({ error: "Developer not found" });
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("developers")
      .update(updates)
      .eq("id", dev.id)
      .select("format_native, format_image, format_corner, format_video, format_fullscreen")
      .single();
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    return res.json({
      success: true,
      mode: "supabase",
      formats: {
        native:     updated.format_native,
        image:      updated.format_image,
        corner:     updated.format_corner,
        video:      updated.format_video,
        fullscreen: updated.format_fullscreen,
      },
    });
  }

  // Update which placements the publisher has switched off — db/20.
  if (action === "update_placements") {
    const { api_key, disabled_placements } = body;
    if (!api_key || !Array.isArray(disabled_placements)) {
      return res.status(400).json({ error: "Missing api_key or disabled_placements[]" });
    }
    const clean = [...new Set(disabled_placements.map(String).filter(Boolean))];
    const { data: dev, error: lookupErr } = await supabaseAdmin
      .from("developers").select("id").eq("api_key", api_key).single();
    if (lookupErr || !dev) return res.status(404).json({ error: "Developer not found" });
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("developers")
      .update({ disabled_placements: clean })
      .eq("id", dev.id)
      .select("disabled_placements")
      .single();
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    return res.json({ success: true, mode: "supabase", disabled_placements: updated.disabled_placements });
  }

  // Update notification preferences — token-verified, works for both
  // publisher (developers) and advertiser (advertisers) accounts.
  if (action === "update_notif_prefs") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Invalid token" });
    const prefs = body && body.prefs;
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
      return res.status(400).json({ error: "prefs must be an object" });
    }
    const table = (body && body.role === "advertiser") ? "advertisers" : "developers";
    const { data, error: upErr } = await supabaseAdmin
      .from(table)
      .update({ notification_prefs: prefs })
      .eq("id", user.id)
      .select("notification_prefs")
      .single();
    if (upErr) return res.status(500).json({ error: upErr.message });
    return res.json({ success: true, mode: "supabase", notification_prefs: (data && data.notification_prefs) || prefs });
  }

  // Update a publisher's account-level brand-safety blocklists — token-verified.
  if (action === "update_brand_safety") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Invalid token" });
    const updates = {};
    if (Array.isArray(body && body.blocked_categories)) {
      updates.blocked_categories = body.blocked_categories
        .filter((s) => typeof s === "string" && s.length <= 32).slice(0, 100);
    }
    if (Array.isArray(body && body.blocked_advertiser_domains)) {
      updates.blocked_advertiser_domains = body.blocked_advertiser_domains
        .filter((s) => typeof s === "string")
        .map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
        .filter(Boolean).slice(0, 200);
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Provide blocked_categories and/or blocked_advertiser_domains arrays" });
    }
    const { data, error: upErr } = await supabaseAdmin
      .from("developers").update(updates).eq("id", user.id)
      .select("blocked_categories, blocked_advertiser_domains").single();
    if (upErr) return res.status(500).json({ error: upErr.message });
    return res.json({
      success: true, mode: "supabase",
      blocked_categories: (data && data.blocked_categories) || [],
      blocked_advertiser_domains: (data && data.blocked_advertiser_domains) || [],
    });
  }

  // Change account password — re-verifies the current password, then sets
  // the new one via the Supabase admin API. Role-agnostic (auth is shared).
  if (action === "change_password") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Invalid token" });
    const currentPassword = body && body.current_password;
    const newPassword = body && body.new_password;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "current_password and new_password are required" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }
    // Re-verify the current password before allowing the change.
    const { error: signInErr } = await supabaseAnon.auth.signInWithPassword({
      email: user.email, password: currentPassword,
    });
    if (signInErr) return res.status(401).json({ error: "Current password is incorrect" });
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (updErr) return res.status(500).json({ error: updErr.message });
    return res.json({ success: true, mode: "supabase" });
  }

  // ── MFA (TOTP) ──────────────────────────────────────────────────────────
  // Four actions plus a step-up verify used by cashout / bank-change flows:
  //
  //   mfa_status        → { enrolled, enrolled_at? }
  //   mfa_enroll_init   → server generates secret + otpauth URI; the secret
  //                       round-trips back on enroll_verify (stateless pattern,
  //                       no pending_enrollments table needed)
  //   mfa_enroll_verify → { secret_b32, code } — verifies, then writes user_mfa
  //   mfa_disable       → { code } — verifies current factor, then deletes
  //   verify_totp       → { code } — step-up auth for cashout / bank changes
  //                       Sets user_mfa.last_step_up_at as an audit trail.
  if (action === "mfa_status" || action === "mfa_enroll_init"
      || action === "mfa_enroll_verify" || action === "mfa_disable"
      || action === "verify_totp") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

    const totp = require("./_lib/totp.js");

    if (action === "mfa_status") {
      const { data, error } = await supabaseAdmin
        .from("user_mfa")
        .select("enrolled_at, last_used_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({
        enrolled: !!data,
        enrolled_at: data ? data.enrolled_at : null,
        last_used_at: data ? data.last_used_at : null,
      });
    }

    if (action === "mfa_enroll_init") {
      // Check the user isn't already enrolled. Disable-then-re-enroll is
      // the supported path; we don't allow silent overwrite.
      const { data: existing } = await supabaseAdmin
        .from("user_mfa").select("user_id").eq("user_id", user.id).maybeSingle();
      if (existing) {
        return res.status(409).json({ error: "Two-factor is already enabled. Disable it first to re-enroll." });
      }
      const secret = totp.generateBase32Secret();
      const uri = totp.buildOtpauthURI({ secret, accountName: user.email || "publisher" });
      return res.json({ secret_b32: secret, qr_uri: uri });
    }

    if (action === "mfa_enroll_verify") {
      const { secret_b32, code } = body || {};
      if (!secret_b32 || !code) {
        return res.status(400).json({ error: "secret_b32 and code are required" });
      }
      if (!totp.verifyCode(secret_b32, code, 1)) {
        return res.status(401).json({ error: "That code doesn't match. Make sure you're using the latest one shown in your authenticator app." });
      }
      // Idempotent-ish upsert: if a row somehow exists, replace it. We
      // already 409 in init, but a race during enrollment shouldn't 500.
      const { error } = await supabaseAdmin
        .from("user_mfa")
        .upsert({
          user_id: user.id,
          totp_secret: secret_b32,
          friendly_name: "Authenticator",
          enrolled_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          failed_attempts: 0,
        }, { onConflict: "user_id" });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, enrolled_at: new Date().toISOString() });
    }

    if (action === "mfa_disable") {
      const { code } = body || {};
      if (!code) return res.status(400).json({ error: "code is required" });
      const { data: row, error: readErr } = await supabaseAdmin
        .from("user_mfa")
        .select("totp_secret, failed_attempts")
        .eq("user_id", user.id)
        .maybeSingle();
      if (readErr) return res.status(500).json({ error: readErr.message });
      if (!row) return res.status(404).json({ error: "Two-factor is not currently enabled on this account." });
      if ((row.failed_attempts || 0) >= 10) {
        return res.status(429).json({ error: "Too many failed attempts. Email support@boostboss.ai to recover access." });
      }
      if (!totp.verifyCode(row.totp_secret, code, 1)) {
        await supabaseAdmin
          .from("user_mfa")
          .update({ failed_attempts: (row.failed_attempts || 0) + 1 })
          .eq("user_id", user.id);
        return res.status(401).json({ error: "That code doesn't match. Try the latest one from your authenticator app." });
      }
      const { error: delErr } = await supabaseAdmin
        .from("user_mfa").delete().eq("user_id", user.id);
      if (delErr) return res.status(500).json({ error: delErr.message });
      return res.json({ success: true });
    }

    if (action === "verify_totp") {
      // Step-up auth: used by cashout and bank-detail-change flows. Marks
      // last_step_up_at as an audit trail; downstream caller checks recency.
      const { code } = body || {};
      if (!code) return res.status(400).json({ error: "code is required" });
      const { data: row, error: readErr } = await supabaseAdmin
        .from("user_mfa")
        .select("totp_secret, failed_attempts")
        .eq("user_id", user.id)
        .maybeSingle();
      if (readErr) return res.status(500).json({ error: readErr.message });
      if (!row) return res.status(404).json({ error: "Two-factor is not enabled. Enable it in Settings to continue." });
      if ((row.failed_attempts || 0) >= 10) {
        return res.status(429).json({ error: "Too many failed attempts. Email support@boostboss.ai to recover access." });
      }
      if (!totp.verifyCode(row.totp_secret, code, 1)) {
        await supabaseAdmin
          .from("user_mfa")
          .update({ failed_attempts: (row.failed_attempts || 0) + 1 })
          .eq("user_id", user.id);
        return res.status(401).json({ error: "That code doesn't match. Try the latest one from your authenticator app." });
      }
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("user_mfa")
        .update({ last_used_at: now, last_step_up_at: now, failed_attempts: 0 })
        .eq("user_id", user.id);
      return res.json({ success: true, verified_at: now });
    }
  }

  // ── Payout method (PayPal email) ───────────────────────────────────────
  // Two actions: read the current method, and save (insert or replace) the
  // method with a step-up password + TOTP verification. The frontend calls
  // get to populate the read-only summary or to pre-fill the edit form, and
  // save to commit changes after the publisher re-enters their password and
  // a fresh authenticator code in the inline confirm step.
  //
  // Provider revision 2026-06-11: pivoted from bank-transfer (Payoneer-era)
  // to PayPal email (single field). Taiwan-entity legal constraint forces
  // single-provider pay-in + payout; PayPal handles both until Singapore
  // corp. The publisher_payout_methods table gains a `paypal_email` column;
  // old bank columns stay in schema for now but are no longer written or
  // validated. The bank_snapshot jsonb on payout_requests still keys off
  // `bank_snapshot` (column name preserved to avoid migration), but contents
  // change to { paypal_email, currency, captured_at } instead of full bank
  // fields. See taiwan_entity_single_provider memory for rationale.
  if (action === "get_payout_method" || action === "save_payout_method") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

    if (action === "get_payout_method") {
      const { data, error } = await supabaseAdmin
        .from("publisher_payout_methods")
        .select("paypal_email, currency, created_at, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      // Only treat the row as "having a method" if paypal_email is populated.
      // A legacy bank-only row from before the pivot looks identical to no
      // row here because we don't select bank fields anymore — explicit
      // shape lets the frontend decide cleanly.
      const method = (data && data.paypal_email) ? data : null;
      return res.json({ method });
    }

    if (action === "save_payout_method") {
      const {
        current_password, totp_code,
        paypal_email,
      } = body || {};

      // Validate required fields before doing any auth work — fail-fast.
      const required = { current_password, totp_code, paypal_email };
      for (const k of Object.keys(required)) {
        if (!required[k] || String(required[k]).trim() === "") {
          return res.status(400).json({ error: `Missing required field: ${k}` });
        }
      }

      // Loose RFC-5322-ish email validation. PayPal will do the strict check
      // when we dispatch the payout (and reject with INVALID_FIELD_NAME if
      // the address can't receive money) — our job here is just to filter
      // obvious typos before saving.
      const emailClean = String(paypal_email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
        return res.status(400).json({ error: "That doesn't look like a valid email address." });
      }
      if (emailClean.length > 254) {
        return res.status(400).json({ error: "Email address is too long." });
      }

      // Step-up: re-verify the password against Supabase, then verify the TOTP
      // code against user_mfa. Both must succeed — this is the single highest-
      // impact write a publisher can make, since it rewrites where their money
      // goes.
      const { error: pwErr } = await supabaseAnon.auth.signInWithPassword({
        email: user.email, password: current_password,
      });
      if (pwErr) return res.status(401).json({ error: "Your password is incorrect." });

      const { data: mfaRow, error: mfaReadErr } = await supabaseAdmin
        .from("user_mfa")
        .select("totp_secret, failed_attempts")
        .eq("user_id", user.id)
        .maybeSingle();
      if (mfaReadErr) return res.status(500).json({ error: mfaReadErr.message });
      if (!mfaRow) {
        return res.status(412).json({
          error: "Enable two-factor authentication first (Settings → Security → Two-factor authentication).",
          code: "mfa_required",
        });
      }
      if ((mfaRow.failed_attempts || 0) >= 10) {
        return res.status(429).json({ error: "Too many failed attempts. Email support@boostboss.ai to recover access." });
      }
      const totp = require("./_lib/totp.js");
      if (!totp.verifyCode(mfaRow.totp_secret, totp_code, 1)) {
        await supabaseAdmin
          .from("user_mfa")
          .update({ failed_attempts: (mfaRow.failed_attempts || 0) + 1 })
          .eq("user_id", user.id);
        return res.status(401).json({ error: "That authenticator code doesn't match. Use the latest one." });
      }

      const nowIso = new Date().toISOString();
      // Reset MFA failure counter on success + mark step-up.
      await supabaseAdmin
        .from("user_mfa")
        .update({ last_used_at: nowIso, last_step_up_at: nowIso, failed_attempts: 0 })
        .eq("user_id", user.id);

      const row = {
        user_id:      user.id,
        paypal_email: emailClean,
        currency:     "USD",
        updated_at:   nowIso,
      };
      const { error: upErr } = await supabaseAdmin
        .from("publisher_payout_methods")
        .upsert(row, { onConflict: "user_id" });
      if (upErr) return res.status(500).json({ error: upErr.message });
      return res.json({ success: true, saved_at: nowIso });
    }
  }

  // ── Onboarding questionnaire ───────────────────────────────────────────
  // Required for every new signup before they can interact with the
  // dashboard. The frontend gates the dashboard with a modal that posts
  // here. Allowed values match the CHECK constraints in
  // launch-kit/MIGRATION-onboarding-questionnaire.sql; we don't validate
  // exhaustively here because the DB will reject anything off-list.
  //
  // Role-specific shape:
  //   advertiser → { industry, product_type, digital_dau_range?, annual_revenue_range }
  //   developer  → { ai_app_category, surface_type, daily_users_range, monetization_model }
  //
  // Sets onboarding_completed_at as the gate signal — frontend reads this
  // from the `me` response on every dashboard load and decides whether to
  // show the modal.
  if (action === "save_onboarding") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

    const role = (body && body.role) === "developer" ? "developer" : "advertiser";
    const nowIso = new Date().toISOString();

    if (role === "advertiser") {
      const {
        industry, product_type, digital_dau_range, annual_revenue_range,
      } = body || {};

      // Required: industry + product_type + annual_revenue_range. DAU is
      // only required when product_type='digital' — otherwise it's null.
      if (!industry || !String(industry).trim()) {
        return res.status(400).json({ error: "Industry is required" });
      }
      if (!product_type) {
        return res.status(400).json({ error: "Product type is required" });
      }
      if (!annual_revenue_range) {
        return res.status(400).json({ error: "Annual revenue range is required" });
      }
      const dauForRow = product_type === "digital" ? (digital_dau_range || null) : null;
      if (product_type === "digital" && !dauForRow) {
        return res.status(400).json({ error: "Daily active users range is required for digital products" });
      }

      const row = {
        industry:                 String(industry).trim().slice(0, 80),
        product_type:             String(product_type),
        digital_dau_range:        dauForRow,
        annual_revenue_range:     String(annual_revenue_range),
        onboarding_completed_at:  nowIso,
        updated_at:               nowIso,
      };
      const { error: upErr } = await supabaseAdmin
        .from("advertisers")
        .update(row)
        .eq("id", user.id);
      if (upErr) return res.status(500).json({ error: upErr.message });
      return res.json({ success: true, role, saved_at: nowIso });
    }

    // developer (publisher) path
    const {
      ai_app_category, surface_type, daily_users_range, monetization_model,
    } = body || {};

    if (!ai_app_category) return res.status(400).json({ error: "AI app category is required" });
    if (!surface_type)    return res.status(400).json({ error: "Surface type is required" });
    if (!daily_users_range) return res.status(400).json({ error: "Daily users range is required" });
    if (!monetization_model) return res.status(400).json({ error: "Monetization model is required" });

    const row = {
      ai_app_category:          String(ai_app_category),
      surface_type:             String(surface_type),
      daily_users_range:        String(daily_users_range),
      monetization_model:       String(monetization_model),
      onboarding_completed_at:  nowIso,
      updated_at:               nowIso,
    };
    const { error: upErr } = await supabaseAdmin
      .from("developers")
      .update(row)
      .eq("id", user.id);
    if (upErr) return res.status(500).json({ error: upErr.message });
    return res.json({ success: true, role, saved_at: nowIso });
  }

  // ── Admin: list/search users with performance summary ─────────────────
  // Powers the /admin Users panel. Returns advertiser + publisher rows
  // with their onboarding answers + lightweight performance metrics so
  // the admin can spot active accounts, big spenders, top earners, and
  // anyone stuck in onboarding without opening Supabase directly.
  //
  // Auth: BBX_ADMIN_KEY or ADMIN_TOKEN bearer (same pattern as
  // api/payouts.js requireAdmin).
  //
  // Query params (all optional, via JSON body or query string):
  //   role       — "advertiser" | "developer" | "all" (default: "all")
  //   q          — search string; matched against email + company/app name
  //   limit      — page size, default 50, max 200
  //   offset     — pagination offset
  //
  // Response shape:
  //   { users: [{id, role, email, name, balance, signup_date,
  //              onboarding_completed, profile_summary, performance}], total }
  if (action === "admin_list_users") {
    const authHeader = req.headers && req.headers.authorization;
    const adminToken = authHeader && authHeader.replace(/^Bearer\s+/i, "");
    const staticKeys = [process.env.BBX_ADMIN_KEY, process.env.ADMIN_TOKEN].filter(Boolean);
    if (!adminToken || !staticKeys.includes(adminToken)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }

    const params = Object.assign({}, req.query || {}, body || {});
    const role = (params.role || "all").toString();
    const q = (params.q || "").toString().trim().toLowerCase();
    const limit = Math.min(parseInt(params.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(params.offset, 10) || 0, 0);

    // Helper — build the per-table query with optional fuzzy search.
    async function fetchTable(table, nameField) {
      let query = supabaseAdmin
        .from(table)
        .select(`id, email, ${nameField}, balance, created_at, onboarding_completed_at, industry, product_type, digital_dau_range, annual_revenue_range, ai_app_category, surface_type, daily_users_range, monetization_model`, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (q) {
        // Match either email or name field. Supabase .or() syntax.
        const safe = q.replace(/[%,]/g, "");
        query = query.or(`email.ilike.%${safe}%,${nameField}.ilike.%${safe}%`);
      }
      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    }

    try {
      const wantAdvertisers = (role === "all" || role === "advertiser");
      const wantPublishers  = (role === "all" || role === "developer");

      const [advResult, devResult] = await Promise.all([
        wantAdvertisers ? fetchTable("advertisers", "company_name") : Promise.resolve({ rows: [], count: 0 }),
        wantPublishers  ? fetchTable("developers",  "app_name")     : Promise.resolve({ rows: [], count: 0 }),
      ]);

      // Compute performance per row. Keep cheap: aggregate from campaigns
      // (advertisers) and payout_requests (publishers). Best-effort — if
      // a table column is missing, fall through with zeros.
      const advIds = advResult.rows.map((r) => r.id);
      const devIds = devResult.rows.map((r) => r.id);

      let spendByAdv = new Map();
      let campaignsByAdv = new Map();
      if (advIds.length > 0) {
        try {
          const { data: campaigns } = await supabaseAdmin
            .from("campaigns")
            .select("advertiser_id, spent")
            .in("advertiser_id", advIds);
          (campaigns || []).forEach((c) => {
            const adv = c.advertiser_id;
            spendByAdv.set(adv, (spendByAdv.get(adv) || 0) + Number(c.spent || 0));
            campaignsByAdv.set(adv, (campaignsByAdv.get(adv) || 0) + 1);
          });
        } catch (_) { /* column may not exist on every env — best effort */ }
      }

      let paidByDev = new Map();
      let payoutCountByDev = new Map();
      if (devIds.length > 0) {
        try {
          const { data: payouts } = await supabaseAdmin
            .from("payout_requests")
            .select("publisher_id, amount_usd, status")
            .in("publisher_id", devIds)
            .eq("status", "paid");
          (payouts || []).forEach((p) => {
            const d = p.publisher_id;
            paidByDev.set(d, (paidByDev.get(d) || 0) + Number(p.amount_usd || 0));
            payoutCountByDev.set(d, (payoutCountByDev.get(d) || 0) + 1);
          });
        } catch (_) { /* best effort */ }
      }

      const users = [];
      for (const r of advResult.rows) {
        users.push({
          id: r.id,
          role: "advertiser",
          email: r.email,
          name: r.company_name || null,
          balance: Number(r.balance) || 0,
          signup_date: r.created_at,
          onboarding_completed: !!r.onboarding_completed_at,
          profile_summary: {
            industry:             r.industry             || null,
            product_type:         r.product_type         || null,
            digital_dau_range:    r.digital_dau_range    || null,
            annual_revenue_range: r.annual_revenue_range || null,
          },
          performance: {
            lifetime_spend_usd: spendByAdv.get(r.id) || 0,
            campaign_count:     campaignsByAdv.get(r.id) || 0,
          },
        });
      }
      for (const r of devResult.rows) {
        users.push({
          id: r.id,
          role: "developer",
          email: r.email,
          name: r.app_name || null,
          balance: Number(r.balance) || 0,
          signup_date: r.created_at,
          onboarding_completed: !!r.onboarding_completed_at,
          profile_summary: {
            ai_app_category:    r.ai_app_category    || null,
            surface_type:       r.surface_type       || null,
            daily_users_range:  r.daily_users_range  || null,
            monetization_model: r.monetization_model || null,
          },
          performance: {
            lifetime_paid_usd: paidByDev.get(r.id) || 0,
            payout_count:      payoutCountByDev.get(r.id) || 0,
          },
        });
      }

      // Sort the combined set by signup date desc so newest signups
      // surface first regardless of role.
      users.sort((a, b) => {
        const da = a.signup_date ? Date.parse(a.signup_date) : 0;
        const db = b.signup_date ? Date.parse(b.signup_date) : 0;
        return db - da;
      });

      return res.json({
        users,
        total: advResult.count + devResult.count,
        counts: { advertisers: advResult.count, developers: devResult.count },
      });
    } catch (e) {
      console.error("[Admin] admin_list_users failed:", e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //          AFFILIATE — third role alongside advertiser + publisher
  // ════════════════════════════════════════════════════════════════════
  //
  // MVP scope: an affiliate can sign up, log in, and view a dashboard
  // listing ads they've "saved" via the SDK's save-to-affiliate button
  // (the SDK button itself ships in a follow-up). Future scope: share
  // links, commission tracking, payouts.
  //
  // Backed by:
  //   public.affiliates           — profile keyed by auth.users.id
  //   public.affiliate_saved_ads  — saved ad impressions
  //
  // Auth: same Supabase auth as advertiser + publisher. user_metadata
  // gets role: "affiliate" so the same email can be all three roles.

  // ── Strict role separation ──
  // Affiliate is its own role. Having a Supabase auth user (from being an
  // advertiser/publisher) does NOT grant affiliate access. To use the
  // affiliate dashboard you must explicitly sign up via affiliate_signup,
  // which creates a row in public.affiliates. The login + me + save
  // endpoints all check for that row and return 403 if it's missing.
  //
  // Why this matters: an attacker with a leaked advertiser password
  // shouldn't automatically gain affiliate access; a publisher shouldn't
  // see affiliate data they didn't sign up for; the role audit trail
  // stays accurate.
  if (action === "affiliate_signup") {
    const {
      email, password, display_name,
      // v2 onboarding fields — collected in the multi-step signup. All
      // optional from the API's perspective (the dashboard surfaces them
      // via Settings later), but the frontend form requires them.
      account_type, primary_platform, platform_handle, followers_range,
      audience_topic, phone, referral_code_used,
    } = body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    // Validate enum-like fields against the same vocabulary as the DB
    // CHECK constraints. Belt-and-suspenders so we return a friendlier
    // error than the raw Postgres constraint violation.
    const ALLOWED_ACCOUNT_TYPES   = ["individual", "enterprise"];
    const ALLOWED_PLATFORMS       = ["twitter", "tiktok", "youtube", "instagram", "reddit", "discord", "telegram", "linkedin", "newsletter", "blog", "podcast", "twitch", "other"];
    const ALLOWED_FOLLOWERS_RANGES = ["under_1k", "1k_10k", "10k_100k", "100k_1m", "over_1m", "other"];
    if (account_type && !ALLOWED_ACCOUNT_TYPES.includes(account_type)) {
      return res.status(400).json({ error: "Invalid account_type" });
    }
    if (primary_platform && !ALLOWED_PLATFORMS.includes(primary_platform)) {
      return res.status(400).json({ error: "Invalid primary_platform" });
    }
    if (followers_range && !ALLOWED_FOLLOWERS_RANGES.includes(followers_range)) {
      return res.status(400).json({ error: "Invalid followers_range" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    let userId = null;

    // Try to create a brand-new Supabase auth user first.
    const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: String(password),
      email_confirm: true,  // skip confirmation email — speedy affiliate signup
      user_metadata: { role: "affiliate" },
    });

    if (createErr) {
      // Common case: email already exists in Supabase auth (advertiser
      // or publisher signup elsewhere). The affiliate signup can still
      // proceed for this user — BUT only if they can prove they own the
      // existing account by providing the correct password. This stops
      // an attacker from "registering" with a known email + arbitrary
      // password and gaining affiliate access.
      if (/already.*registered|already.*exists|duplicate/i.test(createErr.message || "")) {
        const { data: existSignin, error: existErr } = await supabaseAnon.auth.signInWithPassword({
          email:    cleanEmail,
          password: String(password),
        });
        if (existErr || !existSignin || !existSignin.user) {
          return res.status(401).json({
            error: "This email already has a Boost Boss account. Use that account’s password to sign up for the affiliate dashboard, or reset the password first.",
          });
        }
        userId = existSignin.user.id;
      } else {
        return res.status(400).json({ error: createErr.message });
      }
    } else if (createData && createData.user) {
      userId = createData.user.id;
    } else {
      return res.status(500).json({ error: "Signup failed" });
    }

    // Reject if affiliates row already exists — they should LOG IN, not sign up.
    const { data: existingAff } = await supabaseAdmin
      .from("affiliates").select("id").eq("id", userId).maybeSingle();
    if (existingAff) {
      return res.status(409).json({
        error: "You already have an affiliate account on this email. Try signing in instead.",
      });
    }

    // Create the affiliates row — this is what gates affiliate access from
    // here on out. The v2 onboarding fields are captured here too so the
    // dashboard Settings + future marketplace targeting has them from
    // signup onward.
    const nowIso = new Date().toISOString();
    const { error: insErr } = await supabaseAdmin.from("affiliates").insert({
      id:                        userId,
      email:                     cleanEmail,
      display_name:              display_name ? String(display_name).slice(0, 80) : null,
      account_type:              account_type || null,
      primary_platform:          primary_platform || null,
      platform_handle:           platform_handle ? String(platform_handle).trim().slice(0, 120) : null,
      followers_range:           followers_range || null,
      audience_topic:            audience_topic ? String(audience_topic).trim().slice(0, 120) : null,
      phone:                     phone ? String(phone).trim().slice(0, 40) : null,
      referral_code_used:        referral_code_used ? String(referral_code_used).trim().slice(0, 40) : null,
      // Mark onboarding complete only if the new structured fields were
      // provided. If a legacy caller passes only email+password, leave the
      // timestamp null so we know to prompt for the rest on first dashboard
      // load.
      onboarding_completed_at:   (account_type && primary_platform && followers_range) ? nowIso : null,
    });
    if (insErr) return res.status(500).json({ error: insErr.message });

    // Sign them in to mint a JWT for the dashboard.
    const { data: sessData, error: sessErr } = await supabaseAnon.auth.signInWithPassword({
      email:    cleanEmail,
      password: String(password),
    });
    if (sessErr || !sessData || !sessData.session) {
      return res.status(500).json({ error: "Created but sign-in failed: " + (sessErr && sessErr.message) });
    }
    return res.json({
      success: true,
      token: sessData.session.access_token,
      user:  { id: userId, email: cleanEmail, role: "affiliate" },
    });
  }

  if (action === "affiliate_login") {
    const { email, password } = body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email:    String(email).trim().toLowerCase(),
      password: String(password),
    });
    if (error || !data || !data.session) {
      return res.status(401).json({ error: error ? error.message : "Invalid email or password" });
    }
    // STRICT: require affiliates row. Don't auto-create. If the user
    // exists in Supabase auth but has no affiliates row, they have not
    // signed up for the affiliate dashboard yet — bounce them to signup.
    const { data: aff } = await supabaseAdmin
      .from("affiliates").select("id").eq("id", data.user.id).maybeSingle();
    if (!aff) {
      return res.status(403).json({
        error: "No affiliate account on this email. Sign up to create one.",
        code:  "not_affiliate",
      });
    }
    return res.json({
      success: true,
      token: data.session.access_token,
      user:  { id: data.user.id, email: data.user.email, role: "affiliate" },
    });
  }

  if (action === "affiliate_me") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token" });
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("affiliates")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (pErr) return res.status(500).json({ error: pErr.message });
    // STRICT: no auto-create. If they don't have an affiliates row, they
    // haven't signed up for the affiliate role yet — return 403 with a
    // code the frontend can detect and route to signup view.
    if (!profile) {
      return res.status(403).json({ error: "Not an affiliate", code: "not_affiliate" });
    }
    const { count } = await supabaseAdmin
      .from("affiliate_saved_ads")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", user.id);
    return res.json({
      user: { id: user.id, email: user.email, role: "affiliate" },
      profile,
      saved_count: count || 0,
    });
  }

  // SDK calls this when an affiliate clicks "save to affiliate" on an ad
  // render. STRICT: requires affiliates row — without one the user is
  // not an affiliate and can't save, even if they have a valid Supabase
  // JWT from another role.
  if (action === "affiliate_save_ad") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token" });

    const { data: aff } = await supabaseAdmin
      .from("affiliates").select("id").eq("id", user.id).maybeSingle();
    if (!aff) {
      return res.status(403).json({ error: "Not an affiliate", code: "not_affiliate" });
    }

    const {
      campaign_id, advertiser_id, headline, body: adBody, image_url,
      target_url, source_placement_id, source_surface, notes,
    } = body || {};

    // Resolve the campaign's parent product (if any) at save time so the
    // affiliate's saved list groups by product. See [[products-as-parent]].
    // Failure is non-fatal — we still save the ad, just without the
    // product_id linkage. Stale/missing campaign_id is treated as "no
    // product attached" rather than 404'ing the save.
    let resolvedProductId = null;
    if (campaign_id) {
      try {
        const { data: camp } = await supabaseAdmin
          .from("campaigns")
          .select("product_id")
          .eq("id", campaign_id)
          .maybeSingle();
        if (camp && camp.product_id) resolvedProductId = camp.product_id;
      } catch (_) { /* swallow — save proceeds without product link */ }
    }

    // If the affiliate has already saved this product, return the existing
    // row instead of inserting a duplicate. Dedupe is per (affiliate,
    // product) — one product = one card in My Saves regardless of how many
    // different campaign renders they've seen for it.
    if (resolvedProductId) {
      const { data: existing } = await supabaseAdmin
        .from("affiliate_saved_ads")
        .select("*")
        .eq("affiliate_id", user.id)
        .eq("product_id", resolvedProductId)
        .maybeSingle();
      if (existing) {
        return res.json({ success: true, saved: existing, deduped: true });
      }
    }

    const row = {
      affiliate_id:         user.id,
      campaign_id:          campaign_id || null,
      advertiser_id:        advertiser_id || null,
      product_id:           resolvedProductId,
      headline:             headline ? String(headline).slice(0, 240) : null,
      body:                 adBody ? String(adBody).slice(0, 2000) : null,
      image_url:            image_url ? String(image_url).slice(0, 2000) : null,
      target_url:           target_url ? String(target_url).slice(0, 2000) : null,
      source_placement_id:  source_placement_id ? String(source_placement_id).slice(0, 120) : null,
      source_surface:       source_surface || null,
      notes:                notes ? String(notes).slice(0, 1000) : null,
    };
    const { data, error: insErr } = await supabaseAdmin
      .from("affiliate_saved_ads")
      .insert(row)
      .select()
      .maybeSingle();
    if (insErr) return res.status(500).json({ error: insErr.message });
    return res.json({ success: true, saved: data });
  }

  // ── Share-links (affiliate #2) ─────────────────────────────────────
  // affiliate_create_share_link
  //   Idempotent. Mints a tokenized URL for an affiliate's saved ad.
  //   If a share_link already exists for (affiliate_id, saved_ad_id),
  //   returns the existing token. The token is what appears in the
  //   boostboss.ai/s/<token> URL the affiliate pastes everywhere.
  if (action === "affiliate_create_share_link") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token" });

    const { data: aff } = await supabaseAdmin
      .from("affiliates").select("id").eq("id", user.id).maybeSingle();
    if (!aff) return res.status(403).json({ error: "Not an affiliate", code: "not_affiliate" });

    // Three mint paths supported (in priority order):
    //  1) saved_ad_id     — legacy SDK-save flow, idempotent per saved_ad
    //  2) product_id      — catalog "Get Link" flow, idempotent per product
    //  3) target_url      — Custom Link flow, accepts any URL (non-idempotent
    //                        across re-submits unless the URL matches exactly)
    // At least one MUST be supplied.
    const savedAdId  = (body && body.saved_ad_id)  || null;
    const productId  = (body && body.product_id)   || null;
    const rawUrl     = (body && body.target_url)   || null;
    if (!savedAdId && !productId && !rawUrl) {
      return res.status(400).json({ error: "Provide saved_ad_id, product_id, or target_url" });
    }

    // Resolve the target URL the redirect will use. Priority:
    //  - saved_ad_id: pulled from the saved_ads row
    //  - product_id:  pulled from the products row
    //  - target_url:  used as-is after http(s):// validation
    let resolvedTargetUrl = null;
    if (savedAdId) {
      // Verify the saved_ad belongs to THIS affiliate. Stops one affiliate
      // from minting share-links over another affiliate's saved ads.
      const { data: sa } = await supabaseAdmin
        .from("affiliate_saved_ads")
        .select("id, affiliate_id, target_url")
        .eq("id", savedAdId)
        .maybeSingle();
      if (!sa || sa.affiliate_id !== user.id) {
        return res.status(404).json({ error: "Saved ad not found" });
      }
      resolvedTargetUrl = sa.target_url || null;
    } else if (productId) {
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("id, default_url, status")
        .eq("id", productId)
        .maybeSingle();
      if (!prod || prod.status !== "active") {
        return res.status(404).json({ error: "Product not found or archived" });
      }
      resolvedTargetUrl = prod.default_url || null;
    } else if (rawUrl) {
      const u = String(rawUrl).trim();
      if (!/^https?:\/\//i.test(u)) {
        return res.status(400).json({ error: "target_url must start with http:// or https://" });
      }
      resolvedTargetUrl = u.slice(0, 2000);
    }

    // Idempotency lookup. We only dedupe when we have a stable parent key
    // (saved_ad_id or product_id). Pure target_url mints always create a
    // new row — re-submitting the same URL is treated as a new link request
    // because the affiliate may want different sub_ids attached.
    if (savedAdId || productId) {
      let q = supabaseAdmin
        .from("affiliate_share_links")
        .select("*")
        .eq("affiliate_id", user.id);
      if (savedAdId) q = q.eq("saved_ad_id", savedAdId);
      else           q = q.eq("product_id",  productId);
      const { data: existing } = await q.maybeSingle();
      if (existing) {
        return res.json({
          share_link: existing,
          url: buildShareUrl(req, existing.token),
          new: false,
        });
      }
    }

    // Mint a new one. Token is 8 chars of base62 — collision risk at
    // 62^8 ≈ 2e14 is negligible at any scale we'll hit. If it collides
    // anyway, the unique index throws and we retry with a fresh token.
    let newToken = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const candidate = makeToken(8);
      const { data: created, error: insErr } = await supabaseAdmin
        .from("affiliate_share_links")
        .insert({
          affiliate_id: user.id,
          saved_ad_id:  savedAdId  || null,
          product_id:   productId  || null,
          token:        candidate,
          target_url:   resolvedTargetUrl,
        })
        .select()
        .maybeSingle();
      if (!insErr) {
        return res.json({
          share_link: created,
          url: buildShareUrl(req, candidate),
          new: true,
        });
      }
      lastErr = insErr;
      // Only retry on unique-violation; bail on other errors.
      if (!/duplicate|unique/i.test(insErr.message || "")) break;
    }
    return res.status(500).json({ error: (lastErr && lastErr.message) || "Could not mint token" });
  }

  if (action === "affiliate_list_share_links") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token" });

    const { data: aff } = await supabaseAdmin
      .from("affiliates").select("id").eq("id", user.id).maybeSingle();
    if (!aff) return res.status(403).json({ error: "Not an affiliate", code: "not_affiliate" });

    const params = Object.assign({}, req.query || {}, body || {});
    const limit  = Math.min(parseInt(params.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(params.offset, 10) || 0, 0);

    // Join saved_ad headline for the dashboard display (avoid a second
    // round-trip from the frontend).
    const { data, error: listErr } = await supabaseAdmin
      .from("affiliate_share_links")
      .select("id, token, target_url, created_at, click_count, last_click_at, revoked_at, saved_ad_id, affiliate_saved_ads(headline, image_url)")
      .eq("affiliate_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (listErr) return res.status(500).json({ error: listErr.message });

    // Aggregate total clicks for the dashboard home stat.
    const totalClicks = (data || []).reduce((a, r) => a + (r.click_count || 0), 0);

    // Flatten the joined headline so the frontend has a simple shape.
    const links = (data || []).map((r) => ({
      id:           r.id,
      token:        r.token,
      url:          buildShareUrl(req, r.token),
      target_url:   r.target_url,
      created_at:   r.created_at,
      click_count:  r.click_count,
      last_click_at: r.last_click_at,
      revoked_at:   r.revoked_at,
      saved_ad_id:  r.saved_ad_id,
      headline:     r.affiliate_saved_ads ? r.affiliate_saved_ads.headline : null,
      image_url:    r.affiliate_saved_ads ? r.affiliate_saved_ads.image_url : null,
    }));
    return res.json({ links, total_clicks: totalClicks });
  }

  if (action === "affiliate_revoke_share_link") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token" });

    const linkId = (body && body.id) || null;
    if (!linkId) return res.status(400).json({ error: "id is required" });

    // Scoped by affiliate_id so an affiliate can only revoke their own.
    const { data, error: upErr } = await supabaseAdmin
      .from("affiliate_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId)
      .eq("affiliate_id", user.id)
      .select()
      .maybeSingle();
    if (upErr) return res.status(500).json({ error: upErr.message });
    if (!data) return res.status(404).json({ error: "Share link not found" });
    return res.json({ success: true, share_link: data });
  }

  if (action === "affiliate_list_saved") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token" });

    // STRICT: require affiliates row, no leak across roles.
    const { data: aff } = await supabaseAdmin
      .from("affiliates").select("id").eq("id", user.id).maybeSingle();
    if (!aff) {
      return res.status(403).json({ error: "Not an affiliate", code: "not_affiliate" });
    }

    const params = Object.assign({}, req.query || {}, body || {});
    const limit  = Math.min(parseInt(params.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(params.offset, 10) || 0, 0);
    const status = params.status && ["active", "shared", "archived"].includes(params.status)
      ? params.status : null;

    let q = supabaseAdmin
      .from("affiliate_saved_ads")
      .select("*", { count: "exact" })
      .eq("affiliate_id", user.id)
      .order("saved_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) q = q.eq("status", status);

    const { data, count, error: listErr } = await q;
    if (listErr) return res.status(500).json({ error: listErr.message });
    return res.json({ saved: data || [], total: count || 0 });
  }

  return res.status(400).json({ error: "Unknown action. Use: signup, login, oauth_sync, complete_role_profile, me, me_cors, logout, resend_confirmation, request_password_reset, update_password, update_formats, update_placements, update_notif_prefs, update_brand_safety, change_password, mfa_status, mfa_enroll_init, mfa_enroll_verify, mfa_disable, verify_totp, get_payout_method, save_payout_method, save_onboarding, admin_list_users, affiliate_signup, affiliate_login, affiliate_me, affiliate_save_ad, affiliate_list_saved, affiliate_create_share_link, affiliate_list_share_links, affiliate_revoke_share_link" });
}

// ── helper: build the email confirmation redirect URL for a given role ──
// Email links in the confirmation email land here after Supabase verifies
// the token. /ads/confirm vs /publish/confirm so the user sees the right
// product branding and lands at the right dashboard afterward.
function confirmRedirectFor(role) {
  const base = process.env.PUBLIC_BASE || "https://boostboss.ai";
  return role === "developer" ? `${base}/publish/confirm` : `${base}/ads/confirm`;
}
function resetRedirectFor(role) {
  const base = process.env.PUBLIC_BASE || "https://boostboss.ai";
  return role === "developer" ? `${base}/publish/reset-password` : `${base}/ads/reset-password`;
}

async function signupSupabase(supabaseAdmin, supabaseAnon, body, res) {
  const { email, password, role, company_name, app_name, integration_door: doorRaw } = body;
  if (!email || !password || !role) return res.status(400).json({ error: "Missing email, password, or role" });
  if (role !== "advertiser" && role !== "developer") {
    return res.status(400).json({ error: "Invalid role" });
  }
  // Whitelist integration_door before it touches the DB CHECK constraint.
  const ALLOWED_DOORS = new Set(["mcp", "js_snippet", "npm_sdk", "rest"]);
  const integration_door = (role === "developer" && ALLOWED_DOORS.has(doorRaw)) ? doorRaw : null;

  // Phase 3A change (2026-06-10): replaced the previous
  // `supabaseAdmin.auth.admin.createUser({ email_confirm: true })` bypass
  // with real email confirmation. Two reasons:
  //   1. Compliance — an ad network handling money shouldn't let users
  //      register with email addresses they don't own. Auto-confirm meant
  //      spammers could register under any address.
  //   2. Custom-domain branding (Phase 2) — the confirmation email link
  //      uses auth.boostboss.ai now, which only matters if confirmation
  //      emails actually exist.
  //
  // New flow:
  //   - supabaseAnon.auth.signUp() creates the user with email_confirmed=false
  //     and sends the Supabase "Confirm signup" email
  //   - Profile row is still inserted at signup time so it's ready the moment
  //     the user confirms (no race conditions, no webhook setup needed)
  //   - We return { requires_confirmation: true } instead of a session,
  //     so the signup page redirects to /ads/check-email (or /publish/check-email)
  //     instead of straight to the dashboard
  //   - Login is then gated on email_confirmed_at being non-null
  //
  // IMPORTANT — Supabase project setting: this requires "Confirm email" to
  // be enabled in Supabase Dashboard → Authentication → Sign In / Providers
  // → Email → Confirm email. If that's off, signUp returns a session and
  // we'd be back to the bypass.

  const initialMeta = { role };
  if (role === "advertiser" && company_name) initialMeta.company_name = company_name;
  if (role === "developer"  && app_name)     initialMeta.app_name     = app_name;

  // signUp may return null user (if Supabase rejects), or a user with
  // session=null (if email confirmation is required). Both are fine —
  // we don't return a session at this stage either way.
  const { data: signUpData, error: signUpErr } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: {
      data: initialMeta,
      emailRedirectTo: confirmRedirectFor(role),
    },
  });

  let userId = null;
  let existingMeta = {};
  let isExistingUser = false;

  if (signUpErr) {
    // User already exists OR password doesn't meet Supabase requirements.
    // Try signInWithPassword to see if it's the "already registered" case
    // where we should attach a new role to an existing user.
    const { data: siData, error: siErr } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (siErr || !siData.user) {
      // Most likely: weak password, invalid email format, or rate limit.
      return res.status(400).json({
        error: signUpErr.message || "Could not create account. Please check your email and password.",
      });
    }
    // Existing user, correct password. Could be:
    //   - Adding a second product (advertiser already, now signing up as publisher)
    //   - Re-running signup after confirming a different product
    userId = siData.user.id;
    existingMeta = siData.user.user_metadata || {};
    isExistingUser = true;

    // Refuse if this role's profile already exists — they should sign in instead.
    const table = role === "advertiser" ? "advertisers" : "developers";
    const { data: existingProfile } = await supabaseAdmin
      .from(table).select("id").eq("id", userId).maybeSingle();
    if (existingProfile) {
      const product = role === "advertiser" ? "SuperBoost Ads" : "Lumi SDK";
      return res.status(400).json({
        error: "This email is already registered for " + product + ". Please sign in instead.",
      });
    }
  } else {
    userId = signUpData.user?.id;
  }

  if (!userId) {
    return res.status(500).json({ error: "Account created but no user ID returned. Please contact support." });
  }

  // Merge the new role into user_metadata.roles (array) so future logins can
  // see which products this account has profiles for.
  const existingRoles = existingMeta.roles || (existingMeta.role ? [existingMeta.role] : []);
  const mergedRoles = Array.from(new Set([].concat(existingRoles, [role])));
  const newMeta = Object.assign({}, existingMeta, { role, roles: mergedRoles });
  if (role === "advertiser" && company_name) newMeta.company_name = company_name;
  if (role === "developer"  && app_name)     newMeta.app_name     = app_name;
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: newMeta });
  } catch (e) {
    console.warn("[Auth] user_metadata update failed:", e.message);
  }

  // Insert the missing profile row for this role. We do this even before
  // confirmation so it's ready the moment they click the email link.
  if (role === "advertiser") {
    const { error } = await supabaseAdmin.from("advertisers").insert({
      id: userId, email, company_name: company_name || email.split("@")[0], balance: 0,
    });
    if (error) console.error("[Auth] Advertiser insert error:", error.message);
  } else {
    const apiKey = makeApiKey("dev", userId);
    const { error } = await supabaseAdmin.from("developers").insert({
      id: userId, email, app_name: app_name || "My AI App",
      api_key: apiKey, status: "active",
      integration_door: integration_door,  // nullable; whitelisted above
    });
    if (error) console.error("[Auth] Developer insert error:", error.message);
  }

  // Existing users (adding a second product) who are ALREADY confirmed
  // can sign in immediately for the new product — they've already proven
  // they own the email. Brand-new users must confirm first.
  if (isExistingUser) {
    const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({ email, password });
    let profile;
    if (role === "advertiser") {
      profile = { company_name: company_name || email.split("@")[0], balance: 0 };
    } else {
      const apiKey = makeApiKey("dev", userId);
      profile = { app_name: app_name || "My AI App", api_key: apiKey };
    }
    if (!signInErr && signInData && signInData.session) {
      setSessionCookie(res, signInData.session.access_token);
    }
    return res.json({
      success: true, mode: "supabase", requires_confirmation: false,
      user: { id: userId, email, role },
      profile,
      session: signInErr ? null : {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    });
  }

  // Brand-new signup — redirect to check-email page, no session yet.
  return res.json({
    success: true, mode: "supabase", requires_confirmation: true,
    user: { id: userId, email, role },
  });
}

// ── exports for testing ─────────────────────────────────────────────
module.exports.signJwt = signJwt;
module.exports.verifyJwt = verifyJwt;
module.exports.userIdFromEmail = userIdFromEmail;
module.exports.HAS_SUPABASE = HAS_SUPABASE;
