/**
 * Boost Boss — Affiliate Sales API (MoR storefront)
 *
 * Powers the affiliate dashboard's "Sales Report", home-page metric cards,
 * and Commission Bill summary, reading from storefront_transactions
 * (which is the real money trail — actual PayPal captures BB processed
 * on the affiliate's behalf).
 *
 * Differs from /api/conversions (postback model) in three ways:
 *   1. Money has actually moved (vs. attributed-but-uninvoiced)
 *   2. No clawback timer — captured = real; refunds are PayPal-driven
 *   3. Settlement is BB → affiliate, not advertiser → BB → affiliate
 *
 * Endpoints (all require affiliate Bearer auth):
 *   GET /api/affiliate-sales?action=summary
 *     Aggregate totals — captured count, lifetime revenue, lifetime
 *     commission, pending settlement.
 *   GET /api/affiliate-sales
 *     Paginated list of storefront_transactions for the Sales Report.
 *
 * See [[mor-product-page-model]].
 */

"use strict";

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

let _sbAnon = null;
function sbAnon() {
  if (_sbAnon) return _sbAnon;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
  if (!SUPABASE_URL || !anonKey) return null;
  _sbAnon = createClient(SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  return _sbAnon;
}

// Auth helper — pull affiliate id from Bearer token, 401 if missing/invalid.
async function requireAffiliate(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: "No token", status: 401 };
  const anon = sbAnon();
  if (!anon) return { error: "Supabase not configured", status: 500 };
  const { data: { user }, error } = await anon.auth.getUser(token);
  if (error || !user) return { error: "Invalid token", status: 401 };
  const client = sb();
  const { data: aff } = await client
    .from("affiliates").select("id").eq("id", user.id).maybeSingle();
  if (!aff) return { error: "Not an affiliate", code: "not_affiliate", status: 403 };
  return { affiliateId: user.id, client };
}

// ──────────────────────────────────────────────────────────────────────
// GET /api/affiliate-sales?action=summary
// ──────────────────────────────────────────────────────────────────────
//
// Returns the headline numbers for the home dashboard:
//   counts: { total, captured, refunded, settled }
//   money:  { revenue, pending_commission, confirmed_commission, paid_commission }
//
// "Pending" = captured but not yet settled (sitting in BB's PayPal awaiting
// the next biweekly payout cycle). "Confirmed" matches semantics from the
// conversions endpoint for UI consistency but in the MoR model captured ==
// confirmed (no clawback timer; refunds are PayPal-driven, not advertiser-driven).
async function handleSummary(req, res) {
  const auth = await requireAffiliate(req);
  if (auth.error) {
    return res.status(auth.status).json(auth.code ? { error: auth.error, code: auth.code } : { error: auth.error });
  }
  const client = auth.client;

  // Pull all rows for this affiliate. Small per-affiliate volume at MVP
  // scale; if any affiliate ever crosses ~10k rows we'd want a SQL aggregate
  // RPC instead. For now the client-side sum is honest and predictable.
  const { data, error } = await client
    .from("storefront_transactions")
    .select("status, amount, affiliate_commission, currency, settled_at")
    .eq("affiliate_id", auth.affiliateId);
  if (error) return res.status(500).json({ error: error.message });

  const rows = data || [];
  const captured = rows.filter((r) => r.status === "captured");
  const refunded = rows.filter((r) => r.status === "refunded");
  const settled  = rows.filter((r) => r.status === "settled");

  const sumCommission = (arr) => arr.reduce((a, r) => a + (Number(r.affiliate_commission) || 0), 0);
  const sumAmount     = (arr) => arr.reduce((a, r) => a + (Number(r.amount) || 0), 0);

  // Lifetime revenue (advertiser-side top-line we drove)
  const revenue = sumAmount(rows.filter((r) => r.status !== "refunded"));

  return res.json({
    counts: {
      total:    rows.length,
      captured: captured.length,
      refunded: refunded.length,
      settled:  settled.length,
    },
    money: {
      // Pending = captured commission BB is holding for next payout
      pending_commission:   Math.round(sumCommission(captured) * 100) / 100,
      // Confirmed semantics: in MoR all captured rows are confirmed
      // (no clawback timer). Surface both keys so the UI matches the
      // postback-model summary shape it already understands.
      confirmed_commission: Math.round(sumCommission(captured) * 100) / 100,
      paid_commission:      Math.round(sumCommission(settled) * 100) / 100,
      revenue:              Math.round(revenue * 100) / 100,
    },
  });
}

// ──────────────────────────────────────────────────────────────────────
// GET /api/affiliate-sales
// ──────────────────────────────────────────────────────────────────────
//
// Paginated list for the Sales Report table. Joins product name for the
// table column. Filters: status, date range.
async function handleList(req, res) {
  const auth = await requireAffiliate(req);
  if (auth.error) {
    return res.status(auth.status).json(auth.code ? { error: auth.error, code: auth.code } : { error: auth.error });
  }
  const client = auth.client;

  const q = req.query || {};
  const limit  = Math.min(parseInt(q.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(q.offset, 10) || 0, 0);
  const status = ["pending", "captured", "refunded", "settled", "failed", "cancelled"].includes(q.status) ? q.status : null;
  const fromDate = q.from && /^\d{4}-\d{2}-\d{2}/.test(q.from) ? q.from : null;
  const toDate   = q.to   && /^\d{4}-\d{2}-\d{2}/.test(q.to)   ? q.to   : null;

  let query = client
    .from("storefront_transactions")
    .select(`
      id, status, amount, currency, affiliate_commission, bb_take,
      seller_settlement, buyer_email, paypal_capture_id,
      created_at, captured_at, settled_at, refunded_at,
      product_id, products(name, image_url)
    `, { count: "exact" })
    .eq("affiliate_id", auth.affiliateId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status)   query = query.eq("status", status);
  if (fromDate) query = query.gte("created_at", fromDate);
  if (toDate)   query = query.lte("created_at", toDate + " 23:59:59");

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Flatten the joined product fields and drop the buyer's full email
  // (privacy — affiliates don't need to see who bought). Show only the
  // local-part-masked form: a***@example.com.
  const sales = (data || []).map((r) => ({
    id:                   r.id,
    status:               r.status,
    amount:               r.amount,
    currency:             r.currency,
    affiliate_commission: r.affiliate_commission,
    bb_take:              r.bb_take,
    seller_settlement:    r.seller_settlement,
    buyer_email_masked:   maskEmail(r.buyer_email),
    paypal_capture_id:    r.paypal_capture_id,
    created_at:           r.created_at,
    captured_at:          r.captured_at,
    settled_at:           r.settled_at,
    refunded_at:          r.refunded_at,
    product: r.products ? { name: r.products.name, image_url: r.products.image_url } : null,
  }));

  return res.json({ sales, total: count || 0 });
}

// "user@example.com" → "u***@example.com" — privacy preserving but lets
// the affiliate recognize specific repeat customers if needed.
function maskEmail(e) {
  if (!e || typeof e !== "string") return null;
  const at = e.indexOf("@");
  if (at <= 0) return e;
  return e[0] + "***" + e.slice(at);
}

// ──────────────────────────────────────────────────────────────────────
//                              HANDLER
// ──────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const action = (req.query && req.query.action) || null;
  try {
    if (action === "summary") return await handleSummary(req, res);
    return await handleList(req, res);
  } catch (err) {
    console.error("[affiliate-sales] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
