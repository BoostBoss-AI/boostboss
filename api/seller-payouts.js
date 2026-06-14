/**
 * Boost Boss — Seller (advertiser) payouts API
 *
 * Lets sellers see their pending balance, configure their PayPal email,
 * and view payout history. The seller dashboard's Payouts page is the
 * primary consumer.
 *
 *   GET   /api/seller-payouts?action=balance
 *     Aggregate: unsettled captured amount, next payout date, lifetime
 *     paid, lifetime captured. Computed live from storefront_transactions.
 *
 *   GET   /api/seller-payouts?action=method
 *     Returns the seller's payout method row (or empty if not configured).
 *
 *   POST  /api/seller-payouts?action=set_method
 *     Body: { paypal_email, display_name?, country_code? }
 *     Upsert the seller's payout method. Validates the PayPal email format
 *     server-side as a defensive check on top of the DB CHECK constraint.
 *
 *   GET   /api/seller-payouts?action=history
 *     Paginated list of dispatched payouts from advertiser_payouts table.
 *     Default newest-first, limit 50.
 *
 *   GET   /api/seller-payouts?action=upcoming_transactions
 *     The captured-but-unsettled storefront_transactions that WILL be in
 *     the next payout batch. Helps sellers see the line items they'll be
 *     paid for.
 *
 * Auth: seller signs in as an advertiser. Same Bearer JWT pattern as
 * api/products.js requireAdvertiser.
 *
 * See [[payouts_cycle]] and [[taiwan_entity_single_provider]].
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

async function requireAdvertiser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: "unauthorized", status: 401 };
  const anon = sbAnon();
  if (!anon) return { error: "Supabase not configured", status: 500 };
  const { data: { user }, error } = await anon.auth.getUser(token);
  if (error || !user) return { error: "Invalid token", status: 401 };
  return { advertiserId: user.id, email: user.email, client: sb() };
}

// Next biweekly Friday — Friday 12:00 UTC, every 2 weeks. We anchor to a
// fixed Friday and add 14-day increments. See [[payouts_cycle]].
const ANCHOR_FRIDAY = new Date(Date.UTC(2026, 5, 12, 12, 0, 0));  // 2026-06-12 12:00 UTC
function nextPayoutDate() {
  const now = Date.now();
  const anchor = ANCHOR_FRIDAY.getTime();
  if (now < anchor) return new Date(anchor);
  const elapsed = now - anchor;
  const period = 14 * 24 * 3600 * 1000;
  const cyclesPassed = Math.floor(elapsed / period);
  const nextTs = anchor + (cyclesPassed + 1) * period;
  return new Date(nextTs);
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const validEmail = (s) => typeof s === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

// ──────────────────────────────────────────────────────────────────────
// GET ?action=balance
// ──────────────────────────────────────────────────────────────────────
async function handleBalance(req, res) {
  const auth = await requireAdvertiser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { advertiserId, client } = auth;

  // Pull every captured/settled transaction for this advertiser. At MVP
  // scale this is cheap; we can move to a SQL aggregate if any single
  // seller starts crossing 10k rows.
  const { data: txs, error } = await client
    .from("storefront_transactions")
    .select("status, seller_settlement, advertiser_settled_at, captured_at, refunded_at")
    .eq("advertiser_id", advertiserId);
  if (error) return res.status(500).json({ error: error.message });
  const rows = txs || [];

  let unsettled = 0;          // captured but not yet paid out (your "Available for next payout")
  let lifetimeCaptured = 0;   // sum of all captures (gross to seller before refunds)
  let lifetimePaid = 0;       // already paid out to seller
  let refundedAmount = 0;
  let unsettledCount = 0;

  for (const t of rows) {
    const sellerNet = Number(t.seller_settlement) || 0;
    if (t.status === "captured") {
      lifetimeCaptured += sellerNet;
      if (!t.advertiser_settled_at) {
        unsettled += sellerNet;
        unsettledCount += 1;
      }
    } else if (t.status === "settled") {
      lifetimeCaptured += sellerNet;
      lifetimePaid += sellerNet;
    } else if (t.status === "refunded") {
      refundedAmount += sellerNet;
    }
  }

  // Has the seller configured a payout method?
  const { data: method } = await client
    .from("advertiser_payout_methods")
    .select("paypal_email")
    .eq("advertiser_id", advertiserId)
    .maybeSingle();
  const payoutReady = !!(method && method.paypal_email);

  return res.json({
    balance: {
      available_for_payout: round2(unsettled),
      unsettled_count:      unsettledCount,
      lifetime_paid:        round2(lifetimePaid),
      lifetime_captured:    round2(lifetimeCaptured),
      refunded:             round2(refundedAmount),
    },
    next_payout: {
      date_iso:      nextPayoutDate().toISOString(),
      payout_ready:  payoutReady,
      hold_reason:   payoutReady ? null : "no_payout_method",
    },
  });
}

// ──────────────────────────────────────────────────────────────────────
// GET ?action=method   /   POST ?action=set_method
// ──────────────────────────────────────────────────────────────────────
async function handleGetMethod(req, res) {
  const auth = await requireAdvertiser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { data, error } = await auth.client
    .from("advertiser_payout_methods")
    .select("paypal_email, display_name, country_code, tax_form_status, updated_at")
    .eq("advertiser_id", auth.advertiserId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ method: data || null });
}

async function handleSetMethod(req, res) {
  const auth = await requireAdvertiser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const body = req.body || {};
  const paypal_email = (body.paypal_email || "").toString().trim().toLowerCase();
  const display_name = body.display_name ? String(body.display_name).trim().slice(0, 240) : null;
  const country_code = body.country_code ? String(body.country_code).trim().toUpperCase().slice(0, 2) : null;

  if (!validEmail(paypal_email)) {
    return res.status(400).json({ error: "Provide a valid PayPal email address" });
  }
  if (country_code && !/^[A-Z]{2}$/.test(country_code)) {
    return res.status(400).json({ error: "country_code must be a 2-letter ISO code" });
  }

  const { data, error } = await auth.client
    .from("advertiser_payout_methods")
    .upsert({
      advertiser_id: auth.advertiserId,
      paypal_email,
      display_name,
      country_code,
    }, { onConflict: "advertiser_id" })
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true, method: data });
}

// ──────────────────────────────────────────────────────────────────────
// GET ?action=history&limit=50&offset=0
// ──────────────────────────────────────────────────────────────────────
async function handleHistory(req, res) {
  const auth = await requireAdvertiser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const q = req.query || {};
  const limit  = Math.min(parseInt(q.limit, 10)  || 50, 200);
  const offset = Math.max(parseInt(q.offset, 10) || 0, 0);

  const { data, count, error } = await auth.client
    .from("advertiser_payouts")
    .select("id, amount, currency, status, paypal_email, paypal_batch_id, dispatched_at, completed_at, failed_at, failure_reason, created_at, transaction_ids", { count: "exact" })
    .eq("advertiser_id", auth.advertiserId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({
    payouts: (data || []).map((p) => ({
      id:             p.id,
      amount:         p.amount,
      currency:       p.currency,
      status:         p.status,
      paypal_email:   p.paypal_email,
      paypal_batch_id:p.paypal_batch_id,
      dispatched_at:  p.dispatched_at,
      completed_at:   p.completed_at,
      failed_at:      p.failed_at,
      failure_reason: p.failure_reason,
      created_at:     p.created_at,
      tx_count:       Array.isArray(p.transaction_ids) ? p.transaction_ids.length : 0,
    })),
    total: count || 0,
  });
}

// ──────────────────────────────────────────────────────────────────────
// GET ?action=upcoming_transactions
//   The captured-but-unsettled rows that will be in the next payout.
// ──────────────────────────────────────────────────────────────────────
async function handleUpcomingTransactions(req, res) {
  const auth = await requireAdvertiser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { data, error } = await auth.client
    .from("storefront_transactions")
    .select(`
      id, amount, currency, seller_settlement, buyer_email, captured_at,
      product_id, products(name)
    `)
    .eq("advertiser_id", auth.advertiserId)
    .eq("status", "captured")
    .is("advertiser_settled_at", null)
    .order("captured_at", { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({
    transactions: (data || []).map((t) => ({
      id:                t.id,
      amount:            t.amount,
      currency:          t.currency,
      seller_settlement: t.seller_settlement,
      buyer_email_masked: maskEmail(t.buyer_email),
      captured_at:       t.captured_at,
      product_name:      (t.products && t.products.name) || null,
      product_id:        t.product_id,
    })),
  });
}

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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = (req.query && req.query.action) || null;
  try {
    if (req.method === "GET") {
      if (action === "balance")               return await handleBalance(req, res);
      if (action === "method")                return await handleGetMethod(req, res);
      if (action === "history")               return await handleHistory(req, res);
      if (action === "upcoming_transactions") return await handleUpcomingTransactions(req, res);
      return res.status(400).json({ error: "Unknown GET action" });
    }
    if (req.method === "POST") {
      if (action === "set_method") return await handleSetMethod(req, res);
      return res.status(400).json({ error: "Unknown POST action" });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[seller-payouts] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
