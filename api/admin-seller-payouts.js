/**
 * Boost Boss — Admin seller-payout dispatcher
 *
 * Phase 2 of seller payouts. Phase 1 (api/seller-payouts.js) gave sellers
 * visibility into what BB owes them; this surface lets admin (or the
 * scheduled cron) actually dispatch the money via PayPal Payouts API.
 *
 * Endpoints (all require ADMIN_TOKEN bearer OR Vercel cron header):
 *
 *   GET   /api/admin-seller-payouts?action=eligible_sellers
 *     Returns sellers with unsettled captures >= MIN_USD whose payout
 *     method is configured. One row per eligible seller, with totals.
 *
 *   POST  /api/admin-seller-payouts?action=dispatch_batch
 *     Body (optional): { advertiser_ids?: [uuid] }
 *     If advertiser_ids omitted → dispatches ALL eligible sellers.
 *     For each one:
 *       1. Sum unsettled storefront_transactions.seller_settlement
 *       2. INSERT advertiser_payouts row (status='pending')
 *       3. Mark the captured rows: advertiser_payout_id=<new id>
 *       4. Call PayPal Payouts API (batch send) with one item per seller
 *       5. On success: status='dispatched', stamp paypal_batch_id +
 *          paypal_item_id, set storefront_transactions.advertiser_settled_at
 *       6. On failure: status='failed' + failure_reason; storefront_transactions
 *          stay unsettled so the next run picks them up.
 *
 *   POST  /api/admin-seller-payouts?action=mark_completed
 *   POST  /api/admin-seller-payouts?action=mark_failed
 *     Manual webhook-substitute for now. Reconciliation when PayPal
 *     webhook integration ships will replace these.
 *
 * Cron auth: cron callers (Vercel scheduled functions) hit this with
 * the same ADMIN_TOKEN env var in their Authorization header. We don't
 * use a separate cron secret because Vercel's scheduled triggers run
 * in the same project context — adding ADMIN_TOKEN to the cron config
 * inside vercel.json is enough.
 */

"use strict";

const { createClient } = require("@supabase/supabase-js");
const paypalPayouts = require("./_lib/payout/paypal.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return _sb;
}

// Admin auth — accepts ADMIN_TOKEN bearer (manual admin trigger from UI)
// OR a Vercel cron request that includes the same token.
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

const MIN_PAYOUT_USD = Number(process.env.SELLER_PAYOUT_MIN_USD) || 1.00;  // $1 floor
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// ──────────────────────────────────────────────────────────────────────
// GET ?action=eligible_sellers
// ──────────────────────────────────────────────────────────────────────
async function handleEligibleSellers(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  // 1. Pull every unsettled captured transaction in one query.
  //    The partial index storefront_transactions_advertiser_unsettled_idx
  //    makes this O(active sellers × unsettled per seller).
  const { data: txs, error: txErr } = await client
    .from("storefront_transactions")
    .select("advertiser_id, seller_settlement, captured_at, id")
    .eq("status", "captured")
    .is("advertiser_settled_at", null)
    .order("captured_at", { ascending: true })
    .limit(50000);
  if (txErr) return res.status(500).json({ error: txErr.message });

  // 2. Bucket by advertiser, compute totals
  const buckets = new Map();
  for (const t of txs || []) {
    if (!t.advertiser_id) continue;
    const slot = buckets.get(t.advertiser_id) || {
      advertiser_id: t.advertiser_id,
      total:         0,
      sales:         0,
      tx_ids:        [],
      earliest:      t.captured_at,
    };
    slot.total += Number(t.seller_settlement) || 0;
    slot.sales += 1;
    slot.tx_ids.push(t.id);
    if (t.captured_at && t.captured_at < slot.earliest) slot.earliest = t.captured_at;
    buckets.set(t.advertiser_id, slot);
  }

  if (buckets.size === 0) {
    return res.json({ eligible: [], not_eligible_no_method: [], not_eligible_below_min: [] });
  }

  // 3. Pull payout method config for all sellers with balance
  const advIds = Array.from(buckets.keys());
  const { data: methods, error: mErr } = await client
    .from("advertiser_payout_methods")
    .select("advertiser_id, paypal_email, display_name")
    .in("advertiser_id", advIds);
  if (mErr) return res.status(500).json({ error: mErr.message });
  const methodByAdv = {};
  (methods || []).forEach((m) => { methodByAdv[m.advertiser_id] = m; });

  // 4. Pull advertiser display info (best-effort)
  let advNames = {};
  try {
    const { data: advs } = await client
      .from("advertisers")
      .select("id, email, company_name, display_name")
      .in("id", advIds);
    (advs || []).forEach((a) => { advNames[a.id] = a; });
  } catch (_) { /* table may not exist in early demos */ }

  const eligible = [];
  const not_method = [];
  const not_min = [];
  for (const [id, slot] of buckets.entries()) {
    const m = methodByAdv[id];
    const adv = advNames[id];
    const row = {
      advertiser_id:   id,
      paypal_email:    m ? m.paypal_email : null,
      seller_name:     (m && m.display_name) || (adv && (adv.company_name || adv.display_name)) || (adv && adv.email) || id.slice(0, 8) + '...',
      seller_email:    (adv && adv.email) || null,
      total_usd:       round2(slot.total),
      sales:           slot.sales,
      earliest_captured: slot.earliest,
      tx_ids:          slot.tx_ids,
    };
    if (!m || !m.paypal_email)   { not_method.push(row); continue; }
    if (row.total_usd < MIN_PAYOUT_USD) { not_min.push(row); continue; }
    eligible.push(row);
  }
  eligible.sort((a, b) => b.total_usd - a.total_usd);

  return res.json({
    eligible,
    not_eligible_no_method: not_method,
    not_eligible_below_min: not_min,
    min_payout_usd: MIN_PAYOUT_USD,
  });
}

// ──────────────────────────────────────────────────────────────────────
// POST ?action=dispatch_batch
//   Body: { advertiser_ids?: [uuid] }   (omit = dispatch all eligible)
// ──────────────────────────────────────────────────────────────────────
async function handleDispatchBatch(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  // Reuse the eligibility logic so dispatch + display use the same definition
  const eligibilityReq = { headers: req.headers, query: {} };
  const eligibilityRes = {
    _payload: null,
    _status:  200,
    status(s) { this._status = s; return this; },
    json(p)   { this._payload = p; return p; },
  };
  await handleEligibleSellers(eligibilityReq, eligibilityRes);
  if (eligibilityRes._status >= 400) {
    return res.status(eligibilityRes._status).json(eligibilityRes._payload);
  }
  let eligible = (eligibilityRes._payload && eligibilityRes._payload.eligible) || [];

  // Optional filter — only dispatch the specified advertiser_ids
  const filterIds = (req.body && Array.isArray(req.body.advertiser_ids))
    ? new Set(req.body.advertiser_ids.filter((x) => typeof x === "string"))
    : null;
  if (filterIds) eligible = eligible.filter((r) => filterIds.has(r.advertiser_id));

  if (eligible.length === 0) {
    return res.json({ success: true, dispatched_count: 0, dispatched: [], message: "No eligible sellers" });
  }

  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const senderBatchId = `bb-seller-${runStamp.slice(0, 19)}-${Math.random().toString(36).slice(2, 8)}`;

  // 1. INSERT advertiser_payouts rows first so we have ids to reference
  const pendingRows = eligible.map((e) => ({
    advertiser_id:   e.advertiser_id,
    amount:          e.total_usd,
    currency:        "USD",
    status:          "pending",
    paypal_email:    e.paypal_email,
    transaction_ids: e.tx_ids,
    bank_snapshot:   { paypal_email: e.paypal_email, seller_name: e.seller_name },
  }));
  const { data: createdPayouts, error: insErr } = await client
    .from("advertiser_payouts")
    .insert(pendingRows)
    .select();
  if (insErr) return res.status(500).json({ error: insErr.message });

  // 2. Mark the underlying storefront_transactions as belonging to this payout
  //    (advertiser_settled_at stays NULL until PayPal confirms — gives us a
  //    way to identify "queued but not yet dispatched" vs "fully settled").
  for (const payout of createdPayouts || []) {
    if (!payout.transaction_ids || !payout.transaction_ids.length) continue;
    await client
      .from("storefront_transactions")
      .update({ advertiser_payout_id: payout.id })
      .in("id", payout.transaction_ids);
  }

  // 3. Build PayPal batch items
  const items = (createdPayouts || []).map((p) => ({
    senderItemId:    p.id,                 // payout uuid is our reconciliation key
    receiverEmail:   p.paypal_email,
    amountUsd:       Number(p.amount),
    note:            "Boost Boss seller payout · " + senderBatchId,
  }));

  // 4. Dispatch the batch
  let batchResult;
  try {
    batchResult = await paypalPayouts.sendBatchPayout({
      senderBatchId,
      items,
      emailSubject: "You have a payout from Boost Boss",
      emailMessage: "Your Boost Boss seller payout has been dispatched. Funds should arrive in your PayPal account shortly. Reply if anything looks off.",
    });
  } catch (e) {
    // PayPal call failed before any dispatch — mark all rows failed.
    await client
      .from("advertiser_payouts")
      .update({
        status:         "failed",
        failure_reason: e.message || String(e),
        failed_at:      new Date().toISOString(),
      })
      .in("id", (createdPayouts || []).map((p) => p.id));
    // Unlink the txs so they're picked up again next run
    await client
      .from("storefront_transactions")
      .update({ advertiser_payout_id: null })
      .in("id", (createdPayouts || []).flatMap((p) => p.transaction_ids || []));
    return res.status(502).json({
      error: "PayPal batch dispatch failed",
      detail: e.message,
      dispatched_count: 0,
    });
  }

  // 5. Success — update each row with PayPal ids + stamp dispatched_at,
  //    AND mark the txs as advertiser_settled_at = now (we trust the
  //    PayPal queue; webhook can reconcile completed/failed per-item later)
  const now = new Date().toISOString();
  const itemBySenderId = {};
  (batchResult.items || []).forEach((it) => { itemBySenderId[it.sender_item_id] = it; });

  const dispatched = [];
  for (const payout of createdPayouts || []) {
    const it = itemBySenderId[payout.id];
    const update = {
      status:         "dispatched",
      paypal_batch_id: batchResult.payout_batch_id,
      paypal_item_id:  it ? it.payout_item_id : null,
      dispatched_at:   now,
    };
    await client.from("advertiser_payouts").update(update).eq("id", payout.id);

    if (payout.transaction_ids && payout.transaction_ids.length) {
      await client
        .from("storefront_transactions")
        .update({ advertiser_settled_at: now })
        .in("id", payout.transaction_ids);
    }

    dispatched.push({
      payout_id:       payout.id,
      advertiser_id:   payout.advertiser_id,
      paypal_email:    payout.paypal_email,
      amount_usd:      Number(payout.amount),
      sales:           payout.transaction_ids.length,
      paypal_batch_id: batchResult.payout_batch_id,
      paypal_item_id:  it ? it.payout_item_id : null,
    });
  }

  return res.json({
    success:          true,
    mode:             batchResult.mode || "paypal",
    sender_batch_id:  senderBatchId,
    payout_batch_id:  batchResult.payout_batch_id,
    dispatched_count: dispatched.length,
    total_usd:        round2(dispatched.reduce((a, d) => a + d.amount_usd, 0)),
    dispatched,
  });
}

// ──────────────────────────────────────────────────────────────────────
// POST ?action=mark_completed / mark_failed
//   Body: { payout_id, failure_reason? }
//   Manual reconciliation until PayPal webhook integration ships.
// ──────────────────────────────────────────────────────────────────────
async function handleMark(req, res, newStatus) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });
  const body = req.body || {};
  const id = body.payout_id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ error: "payout_id required" });
  }

  const updates = { status: newStatus };
  if (newStatus === "completed") updates.completed_at = new Date().toISOString();
  if (newStatus === "failed") {
    updates.failed_at = new Date().toISOString();
    updates.failure_reason = (body.failure_reason || "Manually marked failed").toString().slice(0, 1000);
  }

  const { data: payout, error } = await client
    .from("advertiser_payouts")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!payout) return res.status(404).json({ error: "Payout not found" });

  // If failed: unlink the txs so they're eligible for the next run
  if (newStatus === "failed" && payout.transaction_ids && payout.transaction_ids.length) {
    await client
      .from("storefront_transactions")
      .update({ advertiser_payout_id: null, advertiser_settled_at: null })
      .in("id", payout.transaction_ids);
  }

  return res.json({ success: true, payout });
}

// ──────────────────────────────────────────────────────────────────────
//                              HANDLER
// ──────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Admin authentication required" });
  }

  const action = (req.query && req.query.action) || null;
  try {
    if (req.method === "GET" && action === "eligible_sellers") return await handleEligibleSellers(req, res);
    if (req.method === "POST" && action === "dispatch_batch")  return await handleDispatchBatch(req, res);
    if (req.method === "POST" && action === "mark_completed")  return await handleMark(req, res, "completed");
    if (req.method === "POST" && action === "mark_failed")     return await handleMark(req, res, "failed");
    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("[admin-seller-payouts] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
