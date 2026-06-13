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
const { sendPurchaseConfirmation } = require("./_lib/emails/send.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const PUBLIC_BASE = process.env.PUBLIC_BASE || process.env.PUBLIC_BASE_URL || "https://boostboss.ai";

// ─────────────────────────────────────────────────────────────────────
// Commission model (post-2026-06-13 policy change)
// ─────────────────────────────────────────────────────────────────────
//
// The seller picks ONE number: affiliate_pool_pct on the product. From it:
//
//   affiliate_pool   = order_amount × (affiliate_pool_pct / 100)
//   bb_take          = affiliate_pool × BB_POOL_SHARE        (30%)
//   affiliate_payout = affiliate_pool × (1 - BB_POOL_SHARE)  (70%)
//   seller_net       = order_amount  - affiliate_pool
//
// BB no longer takes a top-line cut from the seller. BB's revenue comes
// entirely out of the seller's chosen affiliate marketing budget.
//
// If a sale has no attributed affiliate (direct visit, bb_click missing),
// the pool isn't allocated at all — seller gets 100% of the gross, BB
// gets nothing on that sale. This matches the "BB shares the affiliate
// budget" mental model: no affiliate involved, no budget to share.
// ─────────────────────────────────────────────────────────────────────
const BB_POOL_SHARE = 0.30;

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

// Voucher code generator — BB-XXXX-XXXX-XXXX format using a
// legibility-safe alphabet (no 0/O/1/l/I) so buyers can type the
// code without errors. 32^12 ≈ 1.15e18 possibilities; collision
// risk at any reasonable scale is negligible, but the caller can
// still retry on the UNIQUE constraint.
const VOUCHER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  // 32 chars
function generateVoucherCode() {
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += VOUCHER_ALPHABET[bytes[i] % VOUCHER_ALPHABET.length];
  return `BB-${out.slice(0,4)}-${out.slice(4,8)}-${out.slice(8,12)}`;
}

// Fire the seller's fulfillment webhook with a signed payload.
// Best-effort: failures are logged but don't block the buyer experience.
// The seller can pull from their dashboard if their webhook missed
// (Phase 6 — Transactions tab in advertiser dashboard).
async function fireFulfillmentWebhook(product, tx, voucher) {
  if (!product.fulfillment_webhook_url) return { sent: false, reason: "no_webhook_url" };

  const payload = {
    event:           "purchase.completed",
    transaction_id:  tx.id,
    product_id:      product.id,
    product_name:    product.name,
    buyer_email:     tx.buyer_email,
    voucher_code:    voucher.code,
    voucher_id:      voucher.id,
    expires_at:      voucher.expires_at,
    amount:          tx.amount,
    currency:        tx.currency,
    sku_type:        product.sku_type,
    package_duration_days: product.package_duration_days || null,
    paypal_capture_id: tx.paypal_capture_id,
    captured_at:     tx.captured_at,
  };
  const body = JSON.stringify(payload);

  // HMAC-SHA256 signature using the seller's webhook secret. Header
  // format mirrors GitHub / Stripe / Twilio so seller-side libraries
  // already know the pattern.
  const headers = {
    "Content-Type": "application/json",
    "User-Agent":   "BoostBoss-Fulfillment/1.0",
    "X-BB-Event":   "purchase.completed",
  };
  if (product.fulfillment_webhook_secret) {
    const sig = crypto
      .createHmac("sha256", product.fulfillment_webhook_secret)
      .update(body)
      .digest("hex");
    headers["X-BB-Signature"] = `sha256=${sig}`;
  }

  try {
    const r = await fetch(product.fulfillment_webhook_url, {
      method: "POST",
      headers,
      body,
      // 8s soft timeout — seller webhooks shouldn't be slow but we don't
      // want to block our own response on a slow seller.
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });
    if (!r.ok) {
      console.warn(`[Checkout] seller webhook returned ${r.status} for tx ${tx.id}`);
      return { sent: true, status: r.status, ok: false };
    }
    return { sent: true, status: r.status, ok: true };
  } catch (e) {
    console.warn(`[Checkout] seller webhook failed for tx ${tx.id}:`, e.message);
    return { sent: false, reason: "fetch_error", error: e.message };
  }
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
//
// Body params:
//   product_id    (required) — BB product UUID
//   buyer_email   (required)
//   bb_click      (optional) — affiliate attribution UUID from the URL
//   plan_id       (optional) — specific pricing_plans.id to buy
//                              defaults to the product's first approved+active
//                              plan (sort_order ASC) if omitted
//
// Plan selection
// ──────────────
// Every purchasable product has at least one pricing_plan row (the migration
// backfilled one for every legacy product). The plan carries the price; the
// product carries the seller's chosen affiliate_pool_pct. We snapshot both
// onto the transaction so future rate changes don't retroactively rewrite
// historical splits.
//
// Audit gate
// ──────────
// Only pricing_plans with audit_status='approved' AND is_active=true are
// purchasable. A non-approved plan returns 403 with a code the frontend
// can show as "this plan is pending review."
async function handleCreateOrder(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const body = req.body || {};
  const productId  = (body.product_id  || "").toString().trim();
  const buyerEmail = (body.buyer_email || "").toString().trim().toLowerCase();
  const bbClick    = (body.bb_click    || "").toString().trim();
  const planIdArg  = (body.plan_id     || "").toString().trim();

  if (!productId) {
    return res.status(400).json({ error: "product_id is required" });
  }
  if (!buyerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) {
    return res.status(400).json({ error: "buyer_email is required and must be a valid email" });
  }

  // Resolve product (must be active + audit-approved at the PRODUCT level)
  // See [[pricing-plans-audit-policy]] — audit_status lives on products now.
  const { data: product, error: prodErr } = await client
    .from("products")
    .select("id, advertiser_id, name, currency, status, audit_status, affiliate_pool_pct, default_commission_pct")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr) return res.status(500).json({ error: prodErr.message });
  if (!product || product.status !== "active") {
    return res.status(404).json({ error: "Product not found or unavailable" });
  }
  if (product.audit_status !== "approved") {
    return res.status(403).json({
      error: "This product is awaiting audit and isn't yet purchasable.",
      code:  "product_pending_audit",
    });
  }

  // ── Resolve the pricing plan ──────────────────────────────────────
  // Plans are children of an approved product. They no longer carry
  // their own audit_status — they just need to be active and belong to
  // the product. If the caller passed plan_id, validate ownership;
  // otherwise pick the lowest sort_order active plan as the default.
  let plan = null;
  if (planIdArg) {
    if (!/^[0-9a-f-]{36}$/i.test(planIdArg)) {
      return res.status(400).json({ error: "plan_id must be a UUID" });
    }
    const { data: planRow } = await client
      .from("pricing_plans")
      .select("id, product_id, plan_name, price, currency, billing_period, is_active")
      .eq("id", planIdArg)
      .maybeSingle();
    if (!planRow || planRow.product_id !== product.id) {
      return res.status(404).json({ error: "Plan not found for this product" });
    }
    plan = planRow;
  } else {
    const { data: planRow } = await client
      .from("pricing_plans")
      .select("id, product_id, plan_name, price, currency, billing_period, is_active")
      .eq("product_id", product.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    plan = planRow || null;
  }

  if (!plan) {
    return res.status(400).json({
      error: "This product has no active pricing plans available for purchase.",
      code:  "no_plan_available",
    });
  }
  if (!plan.is_active) {
    return res.status(400).json({
      error: "This plan is not active.",
      code:  "plan_inactive",
    });
  }
  const price = Number(plan.price);
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: "Plan has no valid price." });
  }

  // ── Resolve affiliate attribution from bb_click (if present + valid)
  const { affiliateId, shareLinkId } = await resolveAttribution(bbClick);

  // ── Compute split under the new commission model ──────────────────
  //
  //   No affiliate? Seller gets 100% of gross. BB gets nothing this sale.
  //   This is the "BB shares the affiliate marketing budget" model —
  //   no affiliate involved, no budget to share.
  //
  //   Affiliate? pool = price × pool_pct; bb_take = pool × 30%;
  //              affiliate_payout = pool × 70%; seller = price - pool.
  const round2 = (n) => Math.round(n * 100) / 100;
  const poolPctSnapshot = Number(product.affiliate_pool_pct);
  const effectivePoolPct = (affiliateId && Number.isFinite(poolPctSnapshot)) ? poolPctSnapshot : 0;
  const affiliatePool   = round2(price * effectivePoolPct / 100);
  const bbTake          = round2(affiliatePool * BB_POOL_SHARE);
  const affiliatePayout = round2(affiliatePool - bbTake);  // floats-safe (matches pool × 0.70)
  const sellerNet       = round2(price - affiliatePool);

  // Mint a transaction row in 'pending' state. PayPal will reference this
  // via invoice_id; the capture webhook will look it up to mark captured.
  const txRow = {
    product_id:           product.id,
    pricing_plan_id:      plan.id,
    advertiser_id:        product.advertiser_id,
    affiliate_id:         affiliateId,
    share_link_id:        shareLinkId,
    bb_click:             bbClick && /^[0-9a-fA-F-]{8,40}$/.test(bbClick) ? bbClick : null,
    buyer_email:          buyerEmail,
    buyer_ip:             clientIp(req),
    amount:               price,
    currency:             plan.currency || product.currency || "USD",
    // ── snapshot the seller's pool %, store the calculated pool $$ —
    //    so the split is auditable in DB even if we tweak the formula later
    commission_pct:       effectivePoolPct,        // snapshot of affiliate_pool_pct at sale time
    affiliate_pool:       affiliatePool,
    affiliate_commission: affiliatePayout,         // what affiliate actually gets (70% of pool)
    bb_take_pct:          BB_POOL_SHARE * 100,     // 30 — kept for reporting compat
    bb_take:              bbTake,
    seller_settlement:    sellerNet,
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
      productName:   product.name + (plan.plan_name && plan.plan_name !== "Standard" ? ` (${plan.plan_name})` : ""),
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
    plan: {
      id:             plan.id,
      name:           plan.plan_name,
      price:          price,
      currency:       plan.currency || product.currency || "USD",
      billing_period: plan.billing_period,
    },
  });
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/checkout?action=capture_order
// ──────────────────────────────────────────────────────────────────────
//
// Full post-capture flow (MoR #5):
//   1. Capture funds via PayPal Capture API
//   2. Mark storefront_transactions row as 'captured'
//   3. Generate voucher code, write vouchers row (linked to tx)
//   4. Fire seller's fulfillment_webhook_url (signed, best-effort)
//   5. Send buyer the branded purchase-confirmation email with voucher +
//      permanent affiliate-attribution link for repeat purchases
//   6. Return the voucher to the frontend for the /buy/<id>/success page
//
// All idempotent — re-running with the same paypal_order_id returns the
// existing voucher rather than charging twice or sending duplicate emails.
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

  // Already captured? Idempotent — return the existing voucher if there is one.
  if (tx.status === "captured" || tx.status === "settled") {
    const { data: existingVoucher } = await client
      .from("vouchers").select("id, code, expires_at, status")
      .eq("transaction_id", tx.id).maybeSingle();
    return res.json({
      success: true,
      transaction_id: tx.id,
      status: tx.status,
      deduped: true,
      voucher: existingVoucher || null,
    });
  }

  // ── Step 1: Capture via PayPal ──────────────────────────────────────
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

  const captureId = (cap && cap.capture_id) || (cap.raw && cap.raw.purchase_units
                    && cap.raw.purchase_units[0] && cap.raw.purchase_units[0].payments
                    && cap.raw.purchase_units[0].payments.captures
                    && cap.raw.purchase_units[0].payments.captures[0]
                    && cap.raw.purchase_units[0].payments.captures[0].id);
  const paypalPayerEmail = cap.raw && cap.raw.payer && cap.raw.payer.email_address;

  // ── Step 2: Mark transaction captured ───────────────────────────────
  const capturedAt = new Date().toISOString();
  const txUpdates = {
    status:             "captured",
    captured_at:        capturedAt,
    paypal_capture_id:  captureId || null,
  };
  if (paypalPayerEmail) txUpdates.paypal_payer_email = paypalPayerEmail;
  await client.from("storefront_transactions").update(txUpdates).eq("id", tx.id);

  // Re-fetch the merged row so subsequent code has captured_at, etc.
  const txFresh = Object.assign({}, tx, txUpdates);

  // Need the full product row for redemption URL, webhook URL, sku_type, etc.
  const { data: product } = await client
    .from("products")
    .select("id, name, sku_type, package_duration_days, redemption_window_days, fulfillment_redirect_url, fulfillment_webhook_url, fulfillment_webhook_secret, external_marketing_url")
    .eq("id", tx.product_id)
    .maybeSingle();

  if (!product) {
    console.error(`[Checkout] tx ${tx.id} captured but product ${tx.product_id} not found — manual intervention needed`);
    return res.json({
      success: true, transaction_id: tx.id, status: "captured",
      warning: "Product was removed after purchase — contact support@boostboss.ai",
    });
  }

  // ── Step 3: Generate voucher (with retry-on-collision) ──────────────
  const redemptionWindowDays = product.redemption_window_days || 90;
  const expiresAt = new Date(Date.now() + redemptionWindowDays * 86400 * 1000).toISOString();

  let voucher = null;
  let lastVoucherErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const candidate = generateVoucherCode();
    const { data: created, error: vErr } = await client
      .from("vouchers")
      .insert({
        transaction_id: tx.id,
        code:           candidate,
        product_id:     tx.product_id,
        buyer_email:    tx.buyer_email,
        voucher_type:   "paid_purchase",
        status:         "issued",
        expires_at:     expiresAt,
      })
      .select()
      .maybeSingle();
    if (!vErr) { voucher = created; break; }
    lastVoucherErr = vErr;
    // Only retry on unique-violation; bail on other errors.
    if (!/duplicate|unique/i.test(vErr.message || "")) break;
  }

  if (!voucher) {
    console.error(`[Checkout] tx ${tx.id} captured but voucher mint failed:`, lastVoucherErr && lastVoucherErr.message);
    // Don't fail the response — the payment IS captured. Ops can mint
    // a voucher manually using the failed-row's transaction_id.
    return res.json({
      success: true, transaction_id: tx.id, status: "captured",
      warning: "Payment received but voucher generation failed — support will email you shortly.",
    });
  }

  // Link voucher_id back onto the transaction for fast lookups.
  await client.from("storefront_transactions")
    .update({ voucher_id: voucher.id })
    .eq("id", tx.id);

  // ── Step 4: Fire seller's fulfillment webhook (best-effort) ─────────
  // Non-blocking conceptually but we await so we can record the result.
  // The buyer waits ~8s max (the fetch timeout) for this — acceptable
  // for the post-purchase confirmation page.
  const webhookResult = await fireFulfillmentWebhook(product, txFresh, voucher);
  if (!webhookResult.ok) {
    // Log but don't expose to buyer — the seller's failure isn't the
    // buyer's problem. Ops + seller's own dashboard handle the retry.
    await client.from("storefront_transactions")
      .update({ metadata: Object.assign({}, tx.metadata || {}, { webhook: webhookResult }) })
      .eq("id", tx.id);
  }

  // ── Step 5: Send buyer the purchase confirmation email ──────────────
  // ACTIVATION LINK MODEL (default since 2026-06-13):
  // The buyer clicks the email CTA → lands on the seller's signup/activation
  // page with the voucher code embedded in the URL as `?bb_token=<code>`.
  // The seller's signup endpoint validates the token via BB's API at
  // form-submit time and creates the account already-paid. The token
  // param is named bb_token to disambiguate from seller's internal params.
  //
  // The permanent repeat-purchase URL preserves the original bb_click so
  // the same affiliate gets credit on future buys (see
  // [[mor-product-page-model]] "Receipt-attribution trick").
  const PUBLIC_BASE_LOCAL = PUBLIC_BASE;
  const redemptionUrl = product.fulfillment_redirect_url
    ? (product.fulfillment_redirect_url.includes("?")
        ? `${product.fulfillment_redirect_url}&bb_token=${encodeURIComponent(voucher.code)}`
        : `${product.fulfillment_redirect_url}?bb_token=${encodeURIComponent(voucher.code)}`)
    : `${PUBLIC_BASE_LOCAL}/redeem?bb_token=${encodeURIComponent(voucher.code)}`;

  const repeatPurchaseUrl = tx.bb_click
    ? `${PUBLIC_BASE_LOCAL}/p/${product.id}?bb_click=${encodeURIComponent(tx.bb_click)}`
    : null;

  try {
    await sendPurchaseConfirmation({
      to:                    tx.buyer_email,
      productName:           product.name,
      voucherCode:           voucher.code,
      redemptionUrl,
      repeatPurchaseUrl,
      amountUsd:             tx.amount,
      currency:              tx.currency,
      transactionId:         tx.id,
      redemptionWindowDays,
      packageDurationDays:   product.package_duration_days,
      skuType:               product.sku_type,
    });
  } catch (e) {
    // Email failure shouldn't block the response. The voucher is in the
    // DB and the buyer can see it on the success page; we'll log so ops
    // can re-send manually if needed.
    console.error(`[Checkout] email send failed for tx ${tx.id}:`, e.message);
  }

  // ── Step 6: Return everything to the frontend ───────────────────────
  return res.json({
    success:        true,
    transaction_id: tx.id,
    capture_id:     captureId,
    status:         "captured",
    voucher: {
      code:          voucher.code,
      expires_at:    voucher.expires_at,
      redemption_url: redemptionUrl,
    },
    seller_webhook_ok: webhookResult.ok === true,
  });
}

// ──────────────────────────────────────────────────────────────────────
// GET /api/checkout?action=get_voucher&tx=<id>
// Used by the success page to fetch the voucher for display.
// Returns ONLY the buyer-safe slice of the transaction + voucher state.
// ──────────────────────────────────────────────────────────────────────
async function handleGetVoucher(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const txId = (req.query && req.query.tx) || "";
  if (!txId) return res.status(400).json({ error: "tx is required" });

  const { data: tx, error: txErr } = await client
    .from("storefront_transactions")
    .select("id, status, amount, currency, buyer_email, captured_at, product_id, voucher_id")
    .eq("id", txId)
    .maybeSingle();
  if (txErr) return res.status(500).json({ error: txErr.message });
  if (!tx)   return res.status(404).json({ error: "Transaction not found" });

  // Pull the product (for name + redemption URL) and voucher (for code +
  // expiry) in parallel.
  const [{ data: product }, { data: voucher }] = await Promise.all([
    client.from("products")
      .select("name, fulfillment_redirect_url, sku_type, package_duration_days")
      .eq("id", tx.product_id).maybeSingle(),
    tx.voucher_id
      ? client.from("vouchers").select("code, expires_at, status").eq("id", tx.voucher_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Activation URL — same format as the email CTA (bb_token query param).
  // See checkout.js handleCaptureOrder for the model rationale.
  const redemptionUrl = (voucher && product && product.fulfillment_redirect_url)
    ? (product.fulfillment_redirect_url.includes("?")
        ? `${product.fulfillment_redirect_url}&bb_token=${encodeURIComponent(voucher.code)}`
        : `${product.fulfillment_redirect_url}?bb_token=${encodeURIComponent(voucher.code)}`)
    : null;

  return res.json({
    success: true,
    transaction: {
      id:           tx.id,
      status:       tx.status,
      amount:       tx.amount,
      currency:     tx.currency,
      buyer_email:  tx.buyer_email,
      captured_at:  tx.captured_at,
    },
    product: product ? {
      name:                  product.name,
      sku_type:              product.sku_type,
      package_duration_days: product.package_duration_days,
    } : null,
    voucher: voucher ? {
      code:           voucher.code,
      expires_at:     voucher.expires_at,
      status:         voucher.status,
      redemption_url: redemptionUrl,
    } : null,
  });
}

// ──────────────────────────────────────────────────────────────────────
//                              HANDLER
// ──────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = (req.query && req.query.action) || (req.body && req.body.action) || null;
  try {
    if (req.method === "GET" && action === "get_voucher") return await handleGetVoucher(req, res);
    if (req.method === "POST" && action === "create_order")  return await handleCreateOrder(req, res);
    if (req.method === "POST" && action === "capture_order") return await handleCaptureOrder(req, res);
    return res.status(400).json({ error: "Unknown action. Use POST create_order, POST capture_order, or GET get_voucher." });
  } catch (err) {
    console.error("[checkout] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
