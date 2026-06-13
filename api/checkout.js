/**
 * Boost Boss — MoR Storefront Checkout API
 *
 * Two endpoints used by the buyer-facing /buy/<product-token> checkout page:
 *
 *   POST /api/checkout?action=create_order
 *     Buyer hit the PayPal button. We resolve the product, mint a BB
 *     storefront_transactions row (status='pending'), create a PayPal
 *     Order with invoice_id=<our_tx_uuid>, return the PayPal order_id
 *     to the front-end SDK.
 *
 *   POST /api/checkout?action=capture_order
 *     Buyer approved on PayPal's UI. The PayPal SDK invokes this with the
 *     order id, we call PayPal Capture API, and (in MoR #4 scope) just
 *     mark the transaction captured. MoR #5 fleshes out: split the money
 *     internally, issue voucher, email buyer, fire seller webhook.
 *
 * Auth model:
 *   Buyers are anonymous. No JWT required. The product is fetched
 *   server-side from BB's DB via the product UUID in the request.
 *
 * See [[mor-product-page-model]] and [[commission-attribution-model]].
 */

"use strict";

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const paypal = require("./_lib/payin/paypal.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const PUBLIC_BASE = process.env.PUBLIC_BASE || process.env.PUBLIC_BASE_URL || "https://boostboss.ai";

// Boost Boss take rate — split-time, hardcoded for now. Future: per-advertiser
// overrides via a take_rate column on products or advertisers.
// See [[mor-product-page-model]].
const BB_TAKE_PCT = 15.00;

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

// Resolve affiliate attribution from bb_click. Returns
//   { affiliateId, shareLinkId } if the click was found, or
//   { affiliateId: null, shareLinkId: null } if missing/invalid.
async function resolveAttribution(bbClick) {
  if (!bbClick || !/^[0-9a-fA-F-]{8,40}$/.test(bbClick)) {
    return { affiliateId: null, shareLinkId: null };
  }
  const client = sb();
  if (!client) return { affiliateId: null, shareLinkId: null };
  const { data } = await client
    .from("affiliate_clicks")
    .select("affiliate_id, share_link_id")
    .eq("click_id", bbClick)
    .maybeSingle();
  return data
    ? { affiliateId: data.affiliate_id, shareLinkId: data.share_link_id }
    : { affiliateId: null, shareLinkId: null };
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/checkout?action=create_order
// ──────────────────────────────────────────────────────────────────────
async function handleCreateOrder(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const body = req.body || {};
  const productId = (body.product_id || "").toString().trim();
  const buyerEmail = (body.buyer_email || "").toString().trim().toLowerCase();
  const bbClick = (body.bb_click || "").toString().trim();

  if (!productId) {
    return res.status(400).json({ error: "product_id is required" });
  }
  if (!buyerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) {
    return res.status(400).json({ error: "buyer_email is required and must be a valid email" });
  }

  // Resolve product (must be active + purchasable, i.e. have a price)
  const { data: product, error: prodErr } = await client
    .from("products")
    .select("id, advertiser_id, name, price, currency, status, default_commission_pct")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr) return res.status(500).json({ error: prodErr.message });
  if (!product || product.status !== "active") {
    return res.status(404).json({ error: "Product not found or unavailable" });
  }
  const price = Number(product.price);
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: "Product is not configured for direct purchase (no price set)" });
  }

  // Resolve affiliate attribution from bb_click (if present + valid)
  const { affiliateId, shareLinkId } = await resolveAttribution(bbClick);

  // Compute commission + BB take + seller settlement up front. Snapshot
  // commission_pct so the split is stable even if the seller changes
  // their rate later.
  const commissionPct = affiliateId ? (Number(product.default_commission_pct) || 0) : 0;
  const affiliateCommission = Math.round((price * commissionPct / 100) * 100) / 100;
  const bbTake             = Math.round((price * BB_TAKE_PCT / 100) * 100) / 100;
  const sellerSettlement   = Math.round((price - affiliateCommission - bbTake) * 100) / 100;

  // Mint a transaction row in 'pending' state. PayPal will reference this
  // via invoice_id; the capture webhook will look it up to mark captured.
  const txRow = {
    product_id:           product.id,
    advertiser_id:        product.advertiser_id,
    affiliate_id:         affiliateId,
    share_link_id:        shareLinkId,
    bb_click:             bbClick && /^[0-9a-fA-F-]{8,40}$/.test(bbClick) ? bbClick : null,
    buyer_email:          buyerEmail,
    buyer_ip:             clientIp(req),
    amount:               price,
    currency:             product.currency || "USD",
    commission_pct:       commissionPct,
    affiliate_commission: affiliateCommission,
    bb_take_pct:          BB_TAKE_PCT,
    bb_take:              bbTake,
    seller_settlement:    sellerSettlement,
    status:               "pending",
  };
  const { data: tx, error: txErr } = await client
    .from("storefront_transactions")
    .insert(txRow)
    .select()
    .maybeSingle();
  if (txErr) return res.status(500).json({ error: txErr.message });

  // Create the PayPal Order — invoice_id is BB's transaction UUID.
  let order;
  try {
    order = await paypal.createCheckoutOrder({
      transactionId: tx.id,
      productName:   product.name,
      amountUsd:     price,
      bbClick:       bbClick || null,
      affiliateId:   affiliateId,
      productId:     product.id,
      buyerEmail:    buyerEmail,
      returnUrl:     `${PUBLIC_BASE}/buy/${product.id}/success?tx=${tx.id}`,
      cancelUrl:     `${PUBLIC_BASE}/buy/${product.id}/cancelled?tx=${tx.id}`,
      requestId:     tx.id,  // PayPal idempotency on retries
    });
  } catch (e) {
    // PayPal create failed — mark tx as failed so we don't have a dangling pending row.
    await client.from("storefront_transactions")
      .update({ status: "failed", failed_at: new Date().toISOString(),
                metadata: { paypal_create_error: e.message || String(e) } })
      .eq("id", tx.id);
    return res.status(502).json({ error: "Payment provider unavailable", detail: e.message });
  }

  // Store the PayPal order id on our row so capture-webhook lookups work.
  await client.from("storefront_transactions")
    .update({ paypal_order_id: order.order_id })
    .eq("id", tx.id);

  return res.json({
    success:        true,
    transaction_id: tx.id,
    order_id:       order.order_id,
    approval_url:   order.approval_url,
    mode:           order.mode,  // 'paypal' in prod, 'demo' if creds missing
  });
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/checkout?action=capture_order
// ──────────────────────────────────────────────────────────────────────
//
// MoR #4 scope: capture the PayPal payment, mark the transaction as
// 'captured'. The post-capture work (voucher issuance, buyer email,
// seller webhook, money split) lands in MoR #5 — for now we just confirm
// the payment landed.
//
// MoR #5 will move all the post-capture logic into a PAYMENT.CAPTURE.COMPLETED
// webhook handler so it runs reliably even if the buyer closes the tab.
// This endpoint will become a thin "tell me the current status" lookup.
async function handleCaptureOrder(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const body = req.body || {};
  const orderId = (body.order_id || "").toString().trim();
  if (!orderId) return res.status(400).json({ error: "order_id is required" });

  // Look up our transaction by PayPal order id
  const { data: tx, error: txErr } = await client
    .from("storefront_transactions")
    .select("*")
    .eq("paypal_order_id", orderId)
    .maybeSingle();
  if (txErr) return res.status(500).json({ error: txErr.message });
  if (!tx)   return res.status(404).json({ error: "Transaction not found" });

  // Already captured? Idempotent return.
  if (tx.status === "captured" || tx.status === "settled") {
    return res.json({ success: true, transaction_id: tx.id, status: tx.status, deduped: true });
  }

  // Capture via PayPal
  let cap;
  try {
    cap = await paypal.captureOrder(orderId);
  } catch (e) {
    await client.from("storefront_transactions")
      .update({ status: "failed", failed_at: new Date().toISOString(),
                metadata: Object.assign({}, tx.metadata || {}, { capture_error: e.message }) })
      .eq("id", tx.id);
    return res.status(502).json({ error: "Capture failed", detail: e.message });
  }

  // Persist capture details. MoR #5 will add: voucher issuance, buyer
  // email, seller webhook fire, etc. all in the same transaction.
  const captureId = (cap && cap.capture_id) || (cap.raw && cap.raw.purchase_units
                    && cap.raw.purchase_units[0] && cap.raw.purchase_units[0].payments
                    && cap.raw.purchase_units[0].payments.captures
                    && cap.raw.purchase_units[0].payments.captures[0]
                    && cap.raw.purchase_units[0].payments.captures[0].id);

  const paypalPayerEmail = cap.raw && cap.raw.payer && cap.raw.payer.email_address;

  const updates = {
    status:             "captured",
    captured_at:        new Date().toISOString(),
    paypal_capture_id:  captureId || null,
  };
  if (paypalPayerEmail) updates.paypal_payer_email = paypalPayerEmail;

  await client.from("storefront_transactions")
    .update(updates)
    .eq("id", tx.id);

  return res.json({
    success:        true,
    transaction_id: tx.id,
    capture_id:     captureId,
    status:         "captured",
    // MoR #4 stub — voucher comes in MoR #5
    next:           "Voucher issuance + delivery email lands in MoR #5.",
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
    return res.status(405).json({ error: "POST only" });
  }

  const action = (req.query && req.query.action) || (req.body && req.body.action) || null;
  try {
    if (action === "create_order")  return await handleCreateOrder(req, res);
    if (action === "capture_order") return await handleCaptureOrder(req, res);
    return res.status(400).json({ error: "Unknown action. Use create_order or capture_order." });
  } catch (err) {
    console.error("[checkout] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
