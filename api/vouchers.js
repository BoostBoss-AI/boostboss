/**
 * Boost Boss — Voucher validation + redemption API for sellers
 *
 * This is what sellers integrate on their redemption page (e.g.
 * seller.com/bb-redeem). Two endpoints:
 *
 *   POST /v1/vouchers/validate { code, seller_secret }
 *     Read-only check. Returns voucher status, product info, buyer
 *     email, expiry. Used to verify a code BEFORE granting access.
 *
 *   POST /v1/vouchers/redeem   { code, seller_secret, buyer_metadata? }
 *     State-changing. Flips voucher status 'issued' → 'redeemed'.
 *     Idempotent: re-redeeming the same code returns the existing
 *     redemption record without flipping anything.
 *
 * Authentication
 * ──────────────
 * Each product has a `fulfillment_webhook_secret` set by the seller
 * during product registration. That same secret authenticates these
 * voucher API calls — seller's redemption page passes it in the body
 * as `seller_secret`. Server checks it matches the product the voucher
 * was issued for; mismatched secret → 401.
 *
 * Compare HMAC equality with constant-time comparison to avoid timing
 * leaks (a determined attacker can guess valid secrets one char at a
 * time if string equality is naive).
 *
 * See [[mor-product-page-model]] for the full integration model.
 */

"use strict";

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return _sb;
}

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"] || "";
  const first = String(xff).split(",")[0].trim();
  return first || req.socket?.remoteAddress || null;
}

// Constant-time string comparison. Prevents timing attacks where an
// attacker measures response time to deduce secret bytes incrementally.
function secretEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (_) {
    return false;
  }
}

// Normalize a voucher code: trim, uppercase, strip any spaces sellers
// might wrap around the code in form fields. The code format is
// BB-XXXX-XXXX-XXXX so we accept both with and without hyphens (some
// sellers' form validation strips them).
function normalizeCode(input) {
  if (!input) return "";
  let s = String(input).trim().toUpperCase().replace(/\s/g, "");
  // Re-insert hyphens if missing (BB-XXXX-XXXX-XXXX is the canonical form)
  if (/^BB[0-9A-Z]{12}$/.test(s)) {
    s = `BB-${s.slice(2,6)}-${s.slice(6,10)}-${s.slice(10,14)}`;
  }
  return s;
}

// Common voucher + product + seller-auth lookup used by both endpoints.
// Returns either { error, status } for any auth/lookup failure, or
// { voucher, product } on success.
async function loadVoucherForSeller(client, code, sellerSecret) {
  if (!code) return { error: "code is required", status: 400 };
  if (!sellerSecret) return { error: "seller_secret is required", status: 400 };

  const { data: voucher, error: vErr } = await client
    .from("vouchers")
    .select("id, code, status, voucher_type, product_id, transaction_id, buyer_email, expires_at, redeemed_at, refunded_at, revoked_at, created_at, redeemer_metadata")
    .eq("code", code)
    .maybeSingle();
  if (vErr) return { error: vErr.message, status: 500 };
  if (!voucher) return { error: "Voucher not found", status: 404, code: "voucher_not_found" };

  const { data: product, error: pErr } = await client
    .from("products")
    .select("id, name, sku_type, package_duration_days, redemption_window_days, fulfillment_webhook_secret")
    .eq("id", voucher.product_id)
    .maybeSingle();
  if (pErr) return { error: pErr.message, status: 500 };
  if (!product) return { error: "Product no longer exists", status: 404, code: "product_missing" };

  // Seller auth — constant-time secret compare
  if (!product.fulfillment_webhook_secret) {
    return { error: "This product has no seller secret configured. Set fulfillment_webhook_secret in the Products dashboard.", status: 401, code: "no_secret" };
  }
  if (!secretEquals(sellerSecret, product.fulfillment_webhook_secret)) {
    return { error: "Invalid seller_secret", status: 401, code: "bad_secret" };
  }

  return { voucher, product };
}

// Build the buyer-facing voucher payload returned by both endpoints.
function shapeVoucherResponse(voucher, product) {
  const now = new Date();
  const expired = voucher.expires_at && new Date(voucher.expires_at) < now;
  return {
    code:           voucher.code,
    status:         voucher.status,
    voucher_type:   voucher.voucher_type,
    expires_at:     voucher.expires_at,
    redeemed_at:    voucher.redeemed_at,
    refunded_at:    voucher.refunded_at,
    issued_at:      voucher.created_at,
    expired,
    product: {
      id:                    product.id,
      name:                  product.name,
      sku_type:              product.sku_type,
      package_duration_days: product.package_duration_days,
    },
    buyer: {
      email: voucher.buyer_email,
    },
    transaction_id: voucher.transaction_id,
  };
}

// ──────────────────────────────────────────────────────────────────────
// POST /v1/vouchers/validate { code, seller_secret }
// ──────────────────────────────────────────────────────────────────────
async function handleValidate(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const body = req.body || {};
  const code = normalizeCode(body.code);
  const sellerSecret = (body.seller_secret || "").toString();

  const r = await loadVoucherForSeller(client, code, sellerSecret);
  if (r.error) return res.status(r.status).json({ error: r.error, code: r.code });

  // Auto-expire vouchers that are past their window — keeps state honest
  // for subsequent lookups even if no redemption ever happens.
  const now = new Date();
  if (r.voucher.expires_at && new Date(r.voucher.expires_at) < now && r.voucher.status === "issued") {
    await client.from("vouchers").update({ status: "expired" }).eq("id", r.voucher.id);
    r.voucher.status = "expired";
  }

  const voucherShape = shapeVoucherResponse(r.voucher, r.product);
  return res.json({
    success: true,
    // 'valid' is the simple boolean the seller's redemption page should
    // check before granting access. True only when status === 'issued'.
    valid:   r.voucher.status === "issued",
    voucher: voucherShape,
  });
}

// ──────────────────────────────────────────────────────────────────────
// POST /v1/vouchers/redeem { code, seller_secret, buyer_metadata? }
// ──────────────────────────────────────────────────────────────────────
//
// State-changing. Flips voucher status 'issued' → 'redeemed'.
// Idempotent: if already redeemed, returns success with the existing
// redemption record. Refunded / expired / revoked vouchers return 409
// so the seller can show the buyer a clear error.
//
// buyer_metadata is optional JSON the seller can attach for their own
// audit (e.g. { account_id: "u_123", plan_chosen: "pro" }). Capped at 2KB.
async function handleRedeem(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const body = req.body || {};
  const code = normalizeCode(body.code);
  const sellerSecret = (body.seller_secret || "").toString();

  const r = await loadVoucherForSeller(client, code, sellerSecret);
  if (r.error) return res.status(r.status).json({ error: r.error, code: r.code });

  // Already redeemed? Idempotent return — let the seller treat re-submits
  // as "we already gave them access" without re-flipping anything.
  if (r.voucher.status === "redeemed") {
    return res.json({
      success:  true,
      redeemed: true,
      deduped:  true,
      voucher:  shapeVoucherResponse(r.voucher, r.product),
    });
  }

  // Refunded / expired / revoked → not redeemable. Return 409 with a
  // specific reason so the seller's UI can show "this voucher was refunded
  // — please contact support" rather than a generic error.
  if (r.voucher.status !== "issued") {
    return res.status(409).json({
      success: false,
      redeemed: false,
      reason:  r.voucher.status,  // 'refunded' | 'expired' | 'revoked'
      voucher: shapeVoucherResponse(r.voucher, r.product),
    });
  }

  // Auto-expire if past window (same logic as validate). Caller may
  // have skipped validate and gone straight to redeem.
  const now = new Date();
  if (r.voucher.expires_at && new Date(r.voucher.expires_at) < now) {
    await client.from("vouchers").update({ status: "expired" }).eq("id", r.voucher.id);
    return res.status(409).json({
      success: false,
      redeemed: false,
      reason:  "expired",
      voucher: Object.assign({}, shapeVoucherResponse(r.voucher, r.product), { status: "expired", expired: true }),
    });
  }

  // Cap buyer_metadata so a misbehaving seller can't flood our DB.
  let buyerMetadata = null;
  if (body.buyer_metadata && typeof body.buyer_metadata === "object") {
    try {
      const json = JSON.stringify(body.buyer_metadata);
      if (json.length <= 2048) buyerMetadata = body.buyer_metadata;
      else buyerMetadata = { _truncated: true };
    } catch (_) { buyerMetadata = null; }
  }

  // Flip status → 'redeemed', stamp redeemed_at, record IP + metadata
  const redeemedAt = new Date().toISOString();
  const { data: updated, error: upErr } = await client
    .from("vouchers")
    .update({
      status:            "redeemed",
      redeemed_at:       redeemedAt,
      redeemer_ip:       clientIp(req),
      redeemer_metadata: buyerMetadata || {},
    })
    .eq("id", r.voucher.id)
    .select("id, code, status, voucher_type, product_id, transaction_id, buyer_email, expires_at, redeemed_at, refunded_at, created_at, redeemer_metadata")
    .maybeSingle();
  if (upErr) return res.status(500).json({ error: upErr.message });

  return res.json({
    success:  true,
    redeemed: true,
    voucher:  shapeVoucherResponse(updated || r.voucher, r.product),
  });
}

// ──────────────────────────────────────────────────────────────────────
//                              HANDLER
// ──────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only — use /v1/vouchers/validate or /v1/vouchers/redeem" });
  }

  const action = (req.query && req.query.action) || (req.body && req.body.action) || null;
  try {
    if (action === "validate") return await handleValidate(req, res);
    if (action === "redeem")   return await handleRedeem(req, res);
    return res.status(400).json({ error: "Unknown action. Use validate or redeem." });
  } catch (err) {
    console.error("[vouchers] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
