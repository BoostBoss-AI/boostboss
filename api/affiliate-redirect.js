/**
 * Boost Boss — Affiliate share-link redirect
 *
 * Endpoint reached via the vercel.json rewrite:
 *   /s/:token  →  /api/affiliate-redirect?token=:token
 *
 * Flow:
 *   1. Look up the share_link by token (using the bbx_bump_share_link_click
 *      RPC, which atomically increments click_count + last_click_at in a
 *      single round trip).
 *   2. If found and not revoked, fire a best-effort click-log INSERT into
 *      affiliate_clicks (does NOT block the redirect — if it fails we still
 *      redirect, we just lose one analytics row).
 *   3. Set the bb_aff_<saved_ad_id> attribution cookie so a future conversion
 *      postback can match this click back to the affiliate within the cookie
 *      window (30 days, industry standard).
 *   4. Append UTM params + bb_aff hint to the target_url so the advertiser's
 *      analytics can also see this came from a Boost Boss affiliate.
 *   5. 302 redirect to the augmented target URL.
 *
 * If the token is invalid, revoked, or missing target_url, redirect to the
 * Boost Boss homepage rather than serving a 404 — failed share-links shouldn't
 * dead-end the audience.
 */

"use strict";

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const PUBLIC_BASE = process.env.PUBLIC_BASE || process.env.PUBLIC_BASE_URL || "https://boostboss.ai";
const COOKIE_DAYS = 30;  // industry-standard attribution window

let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return _sb;
}

function clientIp(req) {
  // Vercel sets x-forwarded-for; take the first hop.
  const xff = req.headers["x-forwarded-for"] || "";
  const first = String(xff).split(",")[0].trim();
  return first || req.socket?.remoteAddress || null;
}

// Append UTM params + Boost Boss attribution hints to the target URL.
// Preserves any existing query params the advertiser put on their own URL.
//
// The load-bearing param is bb_click=<click_id> — the UUID we minted for
// THIS specific click. The advertiser preserves it through their funnel
// as a hidden form field and echoes it via trackConversion. Click ID
// survives Safari ITP, ad blockers, and mobile app handoffs because it
// lives in the URL, not in a cookie. See [[commission-attribution-model]].
function decorateUrl(targetUrl, affiliateId, savedAdId, clickId) {
  let url;
  try { url = new URL(targetUrl); }
  catch (_) { return targetUrl; }  // malformed target → just return as-is

  // Only add UTMs if the advertiser didn't already set them — respecting
  // any campaign-side analytics tagging the advertiser chose.
  if (!url.searchParams.has("utm_source"))   url.searchParams.set("utm_source",   "boostboss_affiliate");
  if (!url.searchParams.has("utm_medium"))   url.searchParams.set("utm_medium",   "share");
  if (!url.searchParams.has("utm_campaign")) url.searchParams.set("utm_campaign", String(affiliateId).slice(0, 24));

  // The primary attribution identifier. Without this, conversion-postbacks
  // fall back to the (less reliable) bb_aff cookie. With it, we get
  // deterministic (affiliate, share_link, product) resolution that survives
  // ITP / ad-blocker stripping.
  if (clickId) url.searchParams.set("bb_click", String(clickId));

  // Always add bb_aff — backup attribution hint independent of cookies and
  // independent of click_id (so the affiliate is still identifiable even
  // if the advertiser drops the click_id by accident).
  url.searchParams.set("bb_aff", String(affiliateId));
  if (savedAdId) url.searchParams.set("bb_sa", String(savedAdId));

  return url.toString();
}

function setAttributionCookie(res, savedAdId, affiliateId) {
  if (!savedAdId || !affiliateId) return;
  // Path /, SameSite=Lax so it survives third-party redirects but isn't
  // sent in cross-site iframes. Not HttpOnly — JS may need to read it
  // for client-side conversion pixels (rare today, but cheap to allow).
  // Secure flag in production only.
  const maxAge = COOKIE_DAYS * 24 * 3600;
  const secure = process.env.NODE_ENV !== "development" ? " Secure;" : "";
  // Cookie name embeds the saved_ad id so multiple share-link clicks on
  // different ads don't overwrite each other — a single user can be
  // attributed to multiple affiliates for different products.
  const name = "bb_aff_" + String(savedAdId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const value = String(affiliateId);
  const setCookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax;${secure}`;
  // Append to existing Set-Cookie headers (Vercel allows multiple Set-Cookie).
  const existing = res.getHeader("Set-Cookie");
  if (Array.isArray(existing))        res.setHeader("Set-Cookie", existing.concat(setCookie));
  else if (typeof existing === "string") res.setHeader("Set-Cookie", [existing, setCookie]);
  else                                res.setHeader("Set-Cookie", setCookie);
}

module.exports = async function handler(req, res) {
  const token = (req.query && req.query.token) || "";
  const safeFallback = PUBLIC_BASE + "/?_aff=invalid";

  if (!token || !/^[A-Za-z0-9]{4,32}$/.test(token)) {
    return res.redirect(302, safeFallback);
  }
  const client = sb();
  if (!client) {
    console.error("[AffiliateRedirect] Supabase not configured");
    return res.redirect(302, safeFallback);
  }

  // Atomic lookup + counter bump.
  let row = null;
  try {
    const { data, error } = await client.rpc("bbx_bump_share_link_click", { p_token: token });
    if (error) {
      console.error("[AffiliateRedirect] RPC failed:", error.message);
    } else if (Array.isArray(data) && data.length > 0) {
      row = data[0];
    }
  } catch (e) {
    console.error("[AffiliateRedirect] RPC threw:", e.message);
  }

  if (!row) {
    // Token not found OR already revoked. Fall back to home.
    return res.redirect(302, safeFallback);
  }

  // Mint a fresh click_id UUID for this redirect. Generated server-side
  // (not by Postgres default) so we have it BEFORE the INSERT and can
  // pass it into decorateUrl on the SAME request. The DB still has a
  // default in case any future code path inserts without supplying one.
  const clickId = crypto.randomUUID();

  // Best-effort click log. Doesn't block the redirect — if the INSERT
  // fails we still 302 the user; we just lose one analytics row.
  // click_id is included so the postback handler can resolve attribution
  // back to (affiliate, share_link, product) via this row.
  try {
    await client.from("affiliate_clicks").insert({
      click_id:      clickId,
      share_link_id: row.id,
      affiliate_id:  row.affiliate_id,
      saved_ad_id:   row.saved_ad_id,
      ip:            clientIp(req),
      user_agent:    (req.headers["user-agent"] || "").slice(0, 500),
      referrer:      (req.headers["referer"]    || "").slice(0, 500),
    });
  } catch (e) {
    console.warn("[AffiliateRedirect] click log failed:", e.message);
  }

  // Set attribution cookie (works for both MoR and legacy redirect paths).
  setAttributionCookie(res, row.saved_ad_id, row.affiliate_id);

  // ── MoR routing — if the share link is tied to a BB-hosted product,
  // route through the product page instead of the seller's raw URL.
  //
  // The /s/<token> redirect doesn't know whether this is a MoR product
  // upfront (the RPC returns only the share_link row). Do a small lookup:
  // if share_link.product_id is set AND that product is active with a
  // price > 0, we treat it as a MoR product and land on /p/<uuid> (which
  // gates by bb_click — only present in this URL). Otherwise fall back
  // to the legacy redirect-to-seller behavior (postback model).
  //
  // See [[mor-product-page-model]] + [[commission-attribution-model]].
  let target = safeFallback;
  if (row.target_url) {
    target = decorateUrl(row.target_url, row.affiliate_id, row.saved_ad_id, clickId);
  }

  // The RPC's RETURNING list doesn't include product_id, so look it up
  // separately. One small query — adds ~5ms but enables the routing.
  try {
    const { data: link } = await client
      .from("affiliate_share_links")
      .select("product_id")
      .eq("id", row.id)
      .maybeSingle();
    if (link && link.product_id) {
      const { data: product } = await client
        .from("products")
        .select("id, status, price")
        .eq("id", link.product_id)
        .maybeSingle();
      if (product && product.status === "active" && Number(product.price) > 0) {
        // MoR product — route to BB-hosted product page. The /p/<uuid>
        // page is itself gated by bb_click (see [[mor-product-page-model]]
        // "The gate"), so we MUST include it in the URL or the page will
        // gate the buyer who just came through the affiliate's link.
        target = `${PUBLIC_BASE}/p/${encodeURIComponent(product.id)}?bb_click=${encodeURIComponent(clickId)}`;
      }
    }
  } catch (e) {
    // Best-effort MoR check — if the lookup fails, fall back to legacy
    // target_url. Worst case: a MoR product behaves like a postback
    // product (buyer lands on seller's site instead of BB-hosted page).
    console.warn("[AffiliateRedirect] MoR product lookup failed:", e.message);
  }

  return res.redirect(302, target);
};
