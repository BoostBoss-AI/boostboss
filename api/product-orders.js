/**
 * Boost Boss — Product Orders + Analytics (advertiser sub-dashboard)
 *
 * Powers the per-product "Orders" sub-page in the advertiser dashboard.
 * One product = one control panel surfacing every order, every voucher,
 * and the affiliate promotion metrics that drove them.
 *
 * Endpoints (all require advertiser auth + ownership of product_id):
 *
 *   GET   /api/product-orders?action=summary&product_id=X
 *     Top-line numbers — # affiliates promoting, total clicks, total
 *     purchases, lifetime revenue, BB take, seller settlement.
 *
 *   GET   /api/product-orders?action=orders&product_id=X
 *     Paginated orders list with buyer email (full — advertiser owns
 *     the order so privacy mask doesn't apply here), voucher code,
 *     voucher status, redemption state, capture id.
 *
 *   GET   /api/product-orders?action=timeseries&product_id=X&days=30
 *     Daily series of clicks + purchases over the last N days
 *     (default 30, max 90). Frontend renders this in Chart.js.
 *
 *   GET   /api/product-orders?action=affiliates&product_id=X
 *     Per-affiliate breakdown — who's promoting, how many clicks,
 *     how many conversions, total commission earned. Powers the
 *     "affiliates promoting" table on the sub-page.
 *
 *   POST  /api/product-orders?action=revoke_voucher
 *     Body: { voucher_id }. Flips voucher.status → 'revoked', stamps
 *     revoked_at. Idempotent. Intended for manual buyer-support cases
 *     (chargeback before refund, fraud, etc.). Does NOT initiate a
 *     PayPal refund — that's separate by design (refunds carry money
 *     consequences; revocation just prevents redemption).
 *
 * Ownership check
 * ───────────────
 * Every endpoint resolves product → advertiser_id and compares against
 * the authenticated advertiser. Mismatched IDs return 403 — an advertiser
 * cannot read orders for someone else's product even if they know the
 * UUID.
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

// ── auth helpers ───────────────────────────────────────────────────────

async function getAuthUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = sbAnon();
  if (!anon) return null;
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

// Verify the caller is an advertiser AND owns the specified product.
// Returns { client, advertiserId, product } on success or { error, status }.
async function requireProductOwner(req, productId) {
  if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) {
    return { error: "Invalid product_id", status: 400 };
  }
  const user = await getAuthUser(req);
  if (!user) return { error: "unauthorized", status: 401 };
  const client = sbAdmin();
  if (!client) return { error: "Supabase not configured", status: 500 };

  // Fetch product + ownership check in one query
  const { data: product, error } = await client
    .from("products")
    .select("id, name, image_url, price, currency, sku_type, status, default_commission_pct, advertiser_id, created_at")
    .eq("id", productId)
    .maybeSingle();
  if (error)   return { error: error.message, status: 500 };
  if (!product) return { error: "Product not found", status: 404 };
  if (product.advertiser_id && product.advertiser_id !== user.id) {
    return { error: "Forbidden", status: 403 };
  }

  return { client, advertiserId: user.id, product };
}

// ──────────────────────────────────────────────────────────────────────
// GET ?action=summary&product_id=X
// ──────────────────────────────────────────────────────────────────────
//
// Returns top-line numbers for the per-product control panel header:
//   affiliates:  number of distinct affiliates with a share link for this product
//   share_links: total share links minted (some affiliates have >1)
//   clicks:      lifetime click count across all share links
//   orders:      { total, captured, refunded, settled, pending, cancelled }
//   money:       { revenue, bb_take, seller_settlement, refunded_amount }
async function handleSummary(req, res) {
  const productId = req.query.product_id;
  const auth = await requireProductOwner(req, productId);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { client, product } = auth;

  // 1) Share links for this product
  const { data: links, error: lErr } = await client
    .from("affiliate_share_links")
    .select("id, affiliate_id, click_count")
    .eq("product_id", productId);
  if (lErr) return res.status(500).json({ error: lErr.message });

  const distinctAffiliates = new Set();
  let totalClickCount = 0;
  (links || []).forEach((l) => {
    if (l.affiliate_id) distinctAffiliates.add(l.affiliate_id);
    totalClickCount += Number(l.click_count) || 0;
  });

  // 2) Storefront transactions for this product
  const { data: txs, error: tErr } = await client
    .from("storefront_transactions")
    .select("status, amount, bb_take, seller_settlement, affiliate_commission")
    .eq("product_id", productId);
  if (tErr) return res.status(500).json({ error: tErr.message });

  const counts = { total: 0, captured: 0, refunded: 0, settled: 0, pending: 0, cancelled: 0, failed: 0 };
  let revenue = 0, bbTake = 0, sellerSettlement = 0, refundedAmount = 0, affiliateCommission = 0;
  (txs || []).forEach((t) => {
    counts.total += 1;
    if (counts.hasOwnProperty(t.status)) counts[t.status] += 1;
    const amt = Number(t.amount) || 0;
    if (t.status === "captured" || t.status === "settled") {
      revenue          += amt;
      bbTake           += Number(t.bb_take)           || 0;
      sellerSettlement += Number(t.seller_settlement) || 0;
      affiliateCommission += Number(t.affiliate_commission) || 0;
    }
    if (t.status === "refunded") {
      refundedAmount += amt;
    }
  });

  // 3) Voucher status counts
  const { data: vouchers, error: vErr } = await client
    .from("vouchers")
    .select("status")
    .eq("product_id", productId);
  if (vErr) return res.status(500).json({ error: vErr.message });

  const voucherCounts = { issued: 0, redeemed: 0, expired: 0, revoked: 0, refunded: 0, total: 0 };
  (vouchers || []).forEach((v) => {
    voucherCounts.total += 1;
    if (voucherCounts.hasOwnProperty(v.status)) voucherCounts[v.status] += 1;
  });

  return res.json({
    product: {
      id:       product.id,
      name:     product.name,
      image_url:product.image_url,
      price:    product.price,
      currency: product.currency || "USD",
      sku_type: product.sku_type,
      status:   product.status,
      default_commission_pct: product.default_commission_pct,
      created_at: product.created_at,
    },
    affiliates:   distinctAffiliates.size,
    share_links:  (links || []).length,
    clicks:       totalClickCount,
    orders:       counts,
    vouchers:     voucherCounts,
    money: {
      revenue:              Math.round(revenue * 100) / 100,
      bb_take:              Math.round(bbTake * 100) / 100,
      seller_settlement:    Math.round(sellerSettlement * 100) / 100,
      affiliate_commission: Math.round(affiliateCommission * 100) / 100,
      refunded:             Math.round(refundedAmount * 100) / 100,
    },
  });
}

// ──────────────────────────────────────────────────────────────────────
// GET ?action=orders&product_id=X
// ──────────────────────────────────────────────────────────────────────
//
// Paginated buyer/order list. Joins voucher + affiliate display name
// for the table. No buyer email masking — the advertiser owns the order
// row, they have a legitimate reason to see the customer's email.
async function handleOrders(req, res) {
  const productId = req.query.product_id;
  const auth = await requireProductOwner(req, productId);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { client } = auth;

  const limit  = Math.min(parseInt(req.query.limit, 10)  || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const status = ["pending", "captured", "refunded", "settled", "failed", "cancelled"].includes(req.query.status) ? req.query.status : null;

  let query = client
    .from("storefront_transactions")
    .select(`
      id, status, amount, currency, affiliate_commission, bb_take, seller_settlement,
      buyer_email, paypal_payer_email, paypal_capture_id, paypal_order_id,
      created_at, captured_at, settled_at, refunded_at, cancelled_at,
      affiliate_id, share_link_id, voucher_id
    `, { count: "exact" })
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) query = query.eq("status", status);

  const { data: rows, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Fan-out: fetch related vouchers + affiliate display names in batch.
  // Cheaper than per-row joins via PostgREST, and avoids RLS surprises.
  const voucherIds   = (rows || []).map((r) => r.voucher_id).filter(Boolean);
  const affiliateIds = (rows || []).map((r) => r.affiliate_id).filter(Boolean);

  let vouchersById  = {};
  let affiliatesById = {};

  if (voucherIds.length) {
    const { data: vs } = await client
      .from("vouchers")
      .select("id, code, status, redeemed_at, expires_at, revoked_at, refunded_at")
      .in("id", voucherIds);
    (vs || []).forEach((v) => { vouchersById[v.id] = v; });
  }
  if (affiliateIds.length) {
    const { data: affs } = await client
      .from("affiliates")
      .select("id, email, display_name")
      .in("id", affiliateIds);
    (affs || []).forEach((a) => { affiliatesById[a.id] = a; });
  }

  const orders = (rows || []).map((r) => ({
    id:                  r.id,
    status:              r.status,
    amount:              r.amount,
    currency:            r.currency,
    bb_take:             r.bb_take,
    seller_settlement:   r.seller_settlement,
    affiliate_commission:r.affiliate_commission,
    buyer_email:         r.buyer_email,
    paypal_payer_email:  r.paypal_payer_email,
    paypal_capture_id:   r.paypal_capture_id,
    paypal_order_id:     r.paypal_order_id,
    created_at:          r.created_at,
    captured_at:         r.captured_at,
    settled_at:          r.settled_at,
    refunded_at:         r.refunded_at,
    cancelled_at:        r.cancelled_at,
    voucher: r.voucher_id && vouchersById[r.voucher_id] ? {
      id:          vouchersById[r.voucher_id].id,
      code:        vouchersById[r.voucher_id].code,
      status:      vouchersById[r.voucher_id].status,
      redeemed_at: vouchersById[r.voucher_id].redeemed_at,
      expires_at:  vouchersById[r.voucher_id].expires_at,
      revoked_at:  vouchersById[r.voucher_id].revoked_at,
      refunded_at: vouchersById[r.voucher_id].refunded_at,
    } : null,
    affiliate: r.affiliate_id && affiliatesById[r.affiliate_id] ? {
      id:           affiliatesById[r.affiliate_id].id,
      email:        affiliatesById[r.affiliate_id].email,
      display_name: affiliatesById[r.affiliate_id].display_name,
    } : null,
  }));

  return res.json({ orders, total: count || 0 });
}

// ──────────────────────────────────────────────────────────────────────
// GET ?action=timeseries&product_id=X&days=30
// ──────────────────────────────────────────────────────────────────────
//
// Returns daily counts for the last N days. Two parallel series:
//   clicks    — number of affiliate_clicks rows whose share_link points
//               to this product, bucketed by clicked_at::date
//   purchases — number of storefront_transactions rows in captured or
//               settled status, bucketed by captured_at::date
//
// JS does the bucketing rather than a SQL GROUP BY date_trunc — keeps
// the API portable across Supabase versions, and the data volumes at
// MVP scale are tiny.
async function handleTimeseries(req, res) {
  const productId = req.query.product_id;
  const auth = await requireProductOwner(req, productId);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { client } = auth;

  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const sinceIso = since.toISOString();

  // 1) Find share links for this product (we need IDs to filter clicks)
  const { data: links } = await client
    .from("affiliate_share_links")
    .select("id")
    .eq("product_id", productId);
  const linkIds = (links || []).map((l) => l.id);

  // 2) Clicks within window — only if there are any share links to filter on
  let clicks = [];
  if (linkIds.length) {
    const { data: cks, error: cErr } = await client
      .from("affiliate_clicks")
      .select("clicked_at")
      .in("share_link_id", linkIds)
      .gte("clicked_at", sinceIso)
      .limit(50000);  // generous safety cap
    if (cErr) return res.status(500).json({ error: cErr.message });
    clicks = cks || [];
  }

  // 3) Purchases within window — captured + settled count as completed
  const { data: txs, error: tErr } = await client
    .from("storefront_transactions")
    .select("captured_at, status, amount")
    .eq("product_id", productId)
    .gte("created_at", sinceIso)
    .limit(50000);
  if (tErr) return res.status(500).json({ error: tErr.message });

  // Build a date-keyed bucket map: { 'YYYY-MM-DD': {clicks, purchases, revenue} }
  const buckets = {};
  const dayKey = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  };

  // Pre-fill empty buckets so the chart renders the full window even on
  // quiet days — Chart.js axis labels stay continuous.
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000);
    const k = d.toISOString().slice(0, 10);
    buckets[k] = { date: k, clicks: 0, purchases: 0, revenue: 0 };
  }

  clicks.forEach((c) => {
    const k = dayKey(c.clicked_at);
    if (k && buckets[k]) buckets[k].clicks += 1;
  });
  (txs || []).forEach((t) => {
    if (t.status !== "captured" && t.status !== "settled") return;
    const k = dayKey(t.captured_at);
    if (k && buckets[k]) {
      buckets[k].purchases += 1;
      buckets[k].revenue   += Number(t.amount) || 0;
    }
  });

  const series = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));

  return res.json({ series, days });
}

// ──────────────────────────────────────────────────────────────────────
// GET ?action=affiliates&product_id=X
// ──────────────────────────────────────────────────────────────────────
//
// Per-affiliate breakdown — for the "Affiliates promoting" table.
async function handleAffiliates(req, res) {
  const productId = req.query.product_id;
  const auth = await requireProductOwner(req, productId);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { client } = auth;

  // 1) Share links for this product
  const { data: links } = await client
    .from("affiliate_share_links")
    .select("id, affiliate_id, click_count, created_at, last_click_at, token")
    .eq("product_id", productId);

  const byAffiliate = {};
  (links || []).forEach((l) => {
    if (!l.affiliate_id) return;
    if (!byAffiliate[l.affiliate_id]) {
      byAffiliate[l.affiliate_id] = {
        affiliate_id: l.affiliate_id,
        share_links:  0,
        clicks:       0,
        last_click_at: null,
        first_promoted_at: null,
        conversions:  0,
        commission:   0,
        sample_token: null,
      };
    }
    const a = byAffiliate[l.affiliate_id];
    a.share_links += 1;
    a.clicks += Number(l.click_count) || 0;
    if (!a.sample_token) a.sample_token = l.token;
    if (l.last_click_at && (!a.last_click_at || l.last_click_at > a.last_click_at)) a.last_click_at = l.last_click_at;
    if (l.created_at && (!a.first_promoted_at || l.created_at < a.first_promoted_at)) a.first_promoted_at = l.created_at;
  });

  // 2) Conversions + commission per affiliate
  const { data: txs } = await client
    .from("storefront_transactions")
    .select("affiliate_id, status, affiliate_commission")
    .eq("product_id", productId);
  (txs || []).forEach((t) => {
    if (!t.affiliate_id) return;
    if (!byAffiliate[t.affiliate_id]) {
      // Edge case: affiliate has txs but no share_link row (shouldn't
      // happen normally, but be defensive).
      byAffiliate[t.affiliate_id] = {
        affiliate_id: t.affiliate_id,
        share_links: 0, clicks: 0, last_click_at: null, first_promoted_at: null,
        conversions: 0, commission: 0, sample_token: null,
      };
    }
    if (t.status === "captured" || t.status === "settled") {
      byAffiliate[t.affiliate_id].conversions += 1;
      byAffiliate[t.affiliate_id].commission  += Number(t.affiliate_commission) || 0;
    }
  });

  // 3) Affiliate display info — batch fetch
  const affiliateIds = Object.keys(byAffiliate);
  let displays = {};
  if (affiliateIds.length) {
    const { data: affs } = await client
      .from("affiliates")
      .select("id, email, display_name")
      .in("id", affiliateIds);
    (affs || []).forEach((a) => { displays[a.id] = a; });
  }

  const rows = affiliateIds.map((id) => ({
    ...byAffiliate[id],
    commission: Math.round(byAffiliate[id].commission * 100) / 100,
    email:        (displays[id] && displays[id].email)        || null,
    display_name: (displays[id] && displays[id].display_name) || null,
  })).sort((a, b) => b.clicks - a.clicks);  // most promoted first

  return res.json({ affiliates: rows });
}

// ──────────────────────────────────────────────────────────────────────
// POST ?action=revoke_voucher  Body: { voucher_id }
// ──────────────────────────────────────────────────────────────────────
//
// Manual voucher revocation by the product owner. Used for:
//   - Chargeback received before refund completes
//   - Fraud / abuse cases
//   - Customer-requested cancellation pre-redemption
//
// Does NOT trigger a PayPal refund (refunds carry money consequences and
// should be initiated from PayPal or a future /refund endpoint). This
// just blocks redemption.
async function handleRevokeVoucher(req, res) {
  const body = req.body || {};
  const voucherId = body.voucher_id;
  if (!voucherId || !/^[0-9a-f-]{36}$/i.test(voucherId)) {
    return res.status(400).json({ error: "voucher_id required" });
  }

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const client = sbAdmin();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  // Lookup voucher → check that its product belongs to this advertiser
  const { data: voucher, error: vErr } = await client
    .from("vouchers")
    .select("id, status, product_id")
    .eq("id", voucherId)
    .maybeSingle();
  if (vErr) return res.status(500).json({ error: vErr.message });
  if (!voucher) return res.status(404).json({ error: "Voucher not found" });

  const { data: product, error: pErr } = await client
    .from("products")
    .select("id, advertiser_id")
    .eq("id", voucher.product_id)
    .maybeSingle();
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (product.advertiser_id !== user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Idempotent: already revoked → return success
  if (voucher.status === "revoked") {
    return res.json({ success: true, deduped: true, status: "revoked" });
  }

  // Only allow revoking 'issued' or 'expired' vouchers. A redeemed voucher
  // means the seller already gave value; revocation there is meaningless.
  if (voucher.status === "redeemed") {
    return res.status(409).json({ error: "Already redeemed — issue a refund instead", code: "already_redeemed" });
  }
  if (voucher.status === "refunded") {
    return res.status(409).json({ error: "Already refunded", code: "already_refunded" });
  }

  const { error: upErr } = await client
    .from("vouchers")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", voucherId);
  if (upErr) return res.status(500).json({ error: upErr.message });

  return res.json({ success: true, status: "revoked" });
}

// ──────────────────────────────────────────────────────────────────────
//                              HANDLER
// ──────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = (req.query && req.query.action) || null;

  try {
    if (req.method === "GET") {
      if (action === "summary")     return await handleSummary(req, res);
      if (action === "orders")      return await handleOrders(req, res);
      if (action === "timeseries")  return await handleTimeseries(req, res);
      if (action === "affiliates")  return await handleAffiliates(req, res);
      return res.status(400).json({ error: "Unknown action. Use summary, orders, timeseries, or affiliates." });
    }
    if (req.method === "POST") {
      if (action === "revoke_voucher") return await handleRevokeVoucher(req, res);
      return res.status(400).json({ error: "Unknown action. Use revoke_voucher." });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[product-orders] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
