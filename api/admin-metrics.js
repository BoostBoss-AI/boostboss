/**
 * Boost Boss — Platform-wide affiliate-program metrics (admin)
 *
 * The dashboard answer to "across the whole platform, how is the
 * affiliate program performing?" Aggregates storefront_transactions
 * under the new commission model:
 *
 *   pool   = order_amount × affiliate_pool_pct
 *   payout = pool × 0.70   (affiliate gets this)
 *   take   = pool × 0.30   (BB gets this)
 *   net    = order_amount − pool  (seller keeps this)
 *
 * Endpoints (all require ADMIN_TOKEN bearer):
 *
 *   GET /api/admin-metrics?action=affiliate_program&range=30
 *     Returns:
 *       totals: { sales, gross, pool, affiliate_payout, bb_take, seller_net,
 *                 refunded_count, refunded_amount }
 *       by_product:    [ { id, name, sales, gross, ... } ]   top 10 by gross
 *       by_affiliate:  [ { id, email, sales, payout, ... } ] top 10 by payout
 *       by_day:        [ { date, sales, gross, payout, take } ]  for charting
 *     `range` parameter: 7, 30, 90, or 'all'. Defaults to 30.
 *
 * Only captured + settled rows contribute to revenue numbers (refunded
 * rows are counted separately under refunded_count + refunded_amount).
 * Pending rows are ignored — they represent buyer-abandoned PayPal sessions.
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

function requireAdmin(req) {
  const authHeader = (req.headers && req.headers.authorization) || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const staticKeys = [process.env.BBX_ADMIN_KEY, process.env.ADMIN_TOKEN].filter(Boolean);
  if (staticKeys.length && staticKeys.includes(token)) {
    return { role: "admin", source: "static_key" };
  }
  return null;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Parse the `range` query param into a (sinceIso, label) pair.
function resolveRange(rangeArg) {
  const raw = (rangeArg || "30").toString();
  if (raw === "all" || raw === "0") {
    return { sinceIso: null, label: "all" };
  }
  const days = Math.min(Math.max(parseInt(raw, 10) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  return { sinceIso: since.toISOString(), label: String(days) };
}

// Captured + settled are the "money has moved" statuses. Refunded is
// counted separately so the headline numbers stay honest.
const COMPLETED_STATUSES = new Set(["captured", "settled"]);

// ──────────────────────────────────────────────────────────────────────
// GET ?action=affiliate_program&range=30
// ──────────────────────────────────────────────────────────────────────
async function handleAffiliateProgram(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const { sinceIso, label } = resolveRange(req.query && req.query.range);

  // Pull every transaction in the window. At MVP scale a single SELECT
  // works fine; if volume grows we'd move to a SQL aggregate RPC.
  let txQuery = client
    .from("storefront_transactions")
    .select("id, status, amount, currency, affiliate_pool, affiliate_commission, bb_take, seller_settlement, product_id, affiliate_id, advertiser_id, created_at, captured_at, refunded_at")
    .order("created_at", { ascending: false })
    .limit(50000);
  if (sinceIso) txQuery = txQuery.gte("created_at", sinceIso);

  const { data: txs, error: txErr } = await txQuery;
  if (txErr) return res.status(500).json({ error: txErr.message });
  const rows = txs || [];

  // ── Top-line totals ───────────────────────────────────────────────
  const totals = {
    sales:            0,   // count of completed
    gross:            0,
    pool:             0,
    affiliate_payout: 0,
    bb_take:          0,
    seller_net:       0,
    refunded_count:   0,
    refunded_amount:  0,
    pending_count:    0,
  };

  // For sums per product / per affiliate
  const productAgg   = new Map();
  const affiliateAgg = new Map();

  // For the time-series chart — pre-fill empty buckets so quiet days show 0
  const buckets = new Map();
  const days = sinceIso
    ? Math.min(Math.ceil((Date.now() - new Date(sinceIso).getTime()) / 86400000), 365)
    : 30;
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    const k = d.toISOString().slice(0, 10);
    buckets.set(k, { date: k, sales: 0, gross: 0, payout: 0, take: 0 });
  }
  const dayKey = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  };

  for (const t of rows) {
    if (t.status === "pending") { totals.pending_count += 1; continue; }
    if (t.status === "cancelled" || t.status === "failed") continue;

    const amt    = Number(t.amount) || 0;
    const pool   = Number(t.affiliate_pool) || 0;
    const payout = Number(t.affiliate_commission) || 0;
    const take   = Number(t.bb_take) || 0;
    const net    = Number(t.seller_settlement) || 0;

    if (t.status === "refunded") {
      totals.refunded_count += 1;
      totals.refunded_amount += amt;
      continue;
    }
    if (!COMPLETED_STATUSES.has(t.status)) continue;

    totals.sales            += 1;
    totals.gross            += amt;
    totals.pool             += pool;
    totals.affiliate_payout += payout;
    totals.bb_take          += take;
    totals.seller_net       += net;

    // Per product
    if (t.product_id) {
      const slot = productAgg.get(t.product_id) || { product_id: t.product_id, sales: 0, gross: 0, pool: 0, payout: 0, take: 0 };
      slot.sales  += 1; slot.gross += amt; slot.pool += pool;
      slot.payout += payout; slot.take += take;
      productAgg.set(t.product_id, slot);
    }
    // Per affiliate (only when an affiliate is attributed — pool is 0
    // for direct-traffic sales under the new model)
    if (t.affiliate_id) {
      const slot = affiliateAgg.get(t.affiliate_id) || { affiliate_id: t.affiliate_id, sales: 0, gross: 0, payout: 0, take: 0 };
      slot.sales  += 1; slot.gross += amt;
      slot.payout += payout; slot.take += take;
      affiliateAgg.set(t.affiliate_id, slot);
    }
    // Time series
    const k = dayKey(t.captured_at || t.created_at);
    if (k && buckets.has(k)) {
      const b = buckets.get(k);
      b.sales += 1; b.gross += amt;
      b.payout += payout; b.take += take;
    }
  }

  // Round the totals once at the end
  ["gross", "pool", "affiliate_payout", "bb_take", "seller_net", "refunded_amount"].forEach((k) => { totals[k] = round2(totals[k]); });

  // ── Hydrate product + affiliate display info ──────────────────────
  const productIds   = Array.from(productAgg.keys());
  const affiliateIds = Array.from(affiliateAgg.keys());

  const [{ data: prodRows } , { data: affRows }] = await Promise.all([
    productIds.length
      ? client.from("products").select("id, name, image_url, advertiser_id").in("id", productIds)
      : Promise.resolve({ data: [] }),
    affiliateIds.length
      ? client.from("affiliates").select("id, email, display_name").in("id", affiliateIds)
      : Promise.resolve({ data: [] }),
  ]);
  const prodById = {};
  (prodRows || []).forEach((p) => { prodById[p.id] = p; });
  const affById = {};
  (affRows || []).forEach((a) => { affById[a.id] = a; });

  // ── Top 10 by gross / by payout ───────────────────────────────────
  const by_product = Array.from(productAgg.values())
    .map((p) => Object.assign({}, p, {
      gross:  round2(p.gross),
      pool:   round2(p.pool),
      payout: round2(p.payout),
      take:   round2(p.take),
      name:      (prodById[p.product_id] && prodById[p.product_id].name)      || "—",
      image_url: (prodById[p.product_id] && prodById[p.product_id].image_url) || null,
    }))
    .sort((a, b) => b.gross - a.gross)
    .slice(0, 10);

  const by_affiliate = Array.from(affiliateAgg.values())
    .map((a) => Object.assign({}, a, {
      gross:  round2(a.gross),
      payout: round2(a.payout),
      take:   round2(a.take),
      email:        (affById[a.affiliate_id] && affById[a.affiliate_id].email)        || null,
      display_name: (affById[a.affiliate_id] && affById[a.affiliate_id].display_name) || null,
    }))
    .sort((a, b) => b.payout - a.payout)
    .slice(0, 10);

  // Time series oldest-first
  const by_day = Array.from(buckets.values())
    .map((b) => ({ date: b.date, sales: b.sales, gross: round2(b.gross), payout: round2(b.payout), take: round2(b.take) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return res.json({
    range:        label,
    totals,
    by_product,
    by_affiliate,
    by_day,
    counts: {
      products_with_sales:  by_product.length,
      affiliates_with_sales: by_affiliate.length,
    },
  });
}

// ──────────────────────────────────────────────────────────────────────
//                              HANDLER
// ──────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const action = (req.query && req.query.action) || null;
  try {
    if (action === "affiliate_program") return await handleAffiliateProgram(req, res);
    return res.status(400).json({ error: "Unknown action. Use affiliate_program." });
  } catch (err) {
    console.error("[admin-metrics] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
