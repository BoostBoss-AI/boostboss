// ============================================================================
// api/payouts.js — Publisher cashout flow + admin batch tooling.
//
// Publisher-facing actions:
//   preview            → compute the target_payout_date and arrival window
//                        for a given amount (no DB write)
//   request            → 2FA-verified cashout. Atomically decrements balance
//                        and inserts a payout_request row.
//   list               → publisher's own payout history (pending + completed)
//   cancel             → cancel a still-pending request; balance is refunded
//
// Admin-facing actions (requireAdmin):
//   admin_list_pending → all pending requests grouped by target_payout_date
//   admin_send_batch   → dispatches a batch via PayPal Payouts API. Preferred
//                        path post-2026-06-11. Marks rows batched, calls
//                        /v1/payments/payouts, stores PayPal batch + item ids.
//                        Status reconciles via PAYMENT.PAYOUTS-ITEM.* webhooks
//                        handled in api/billing.js.
//   admin_export       → LEGACY escape hatch — returns CSV ready for manual
//                        upload (Payoneer-era flow). Kept because the PayPal
//                        rail can hard-fail and Andy needs a manual ship lane.
//                        Marks rows batched; admin_mark_paid finishes them.
//   admin_mark_paid    → moves all rows in a batch from batched → paid
//                        (only needed for admin_export's manual path —
//                        admin_send_batch uses webhook reconciliation)
//   admin_mark_failed  → marks ONE request failed and refunds the balance
//                        via bbx_credit_publisher_balance
//
// Auth model is the same as elsewhere in the codebase:
//   - publisher endpoints: Bearer JWT from Supabase, resolved via getUser()
//   - admin endpoints:     BBX_ADMIN_KEY / ADMIN_TOKEN env (same pattern as
//                          api/campaigns.js requireAdmin)
//
// Step-up auth for cashout request reuses /api/_lib/totp.js against
// user_mfa.totp_secret. The cashout flow REQUIRES 2FA — there's no fallback,
// just like the bank-detail save endpoint.
// ============================================================================

const { createClient } = require("@supabase/supabase-js");
const totp = require("./_lib/totp.js");
const paypalPayouts = require("./_lib/payout/paypal.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// First scheduled payout Friday. From this anchor we walk forward by 14 days
// to find each subsequent payout date. Pick a Friday — keep this aligned with
// the wording in /docs/payouts. Cutoff for each Friday is the preceding
// Tuesday 23:59:59 UTC (3 days before).
const PAYOUT_ANCHOR_FRIDAY_ISO = "2026-06-19";
const MS_PER_DAY = 86_400_000;
const FORTNIGHT_MS = 14 * MS_PER_DAY;
// Docs promise: cutoff is "Tuesday 23:59 UTC". That means anything <=
// Tuesday 23:59:59 makes it into this Friday's batch; once it ticks past
// to Wednesday 00:00:00 UTC we bump to the next Friday. Friday 00:00 UTC
// minus 2 days = Wed 00:00 UTC — that's the boundary. (3 days would have
// put the boundary at Tue 00:00 UTC, cutting all of Tuesday out.)
const CUTOFF_OFFSET_MS = 2 * MS_PER_DAY;

/**
 * Returns the next payout-Friday for which the publisher can still queue a
 * cashout (i.e. the Tuesday cutoff hasn't passed yet). Always returns a
 * Date pinned to 00:00 UTC of that Friday.
 */
function computeTargetPayoutDate(nowMs = Date.now()) {
  // Anchor is a Friday at 00:00 UTC.
  const anchor = Date.parse(PAYOUT_ANCHOR_FRIDAY_ISO + "T00:00:00Z");
  // Walk forward from the anchor in 14-day steps until we find the first
  // Friday whose Tuesday cutoff hasn't passed.
  let friday = anchor;
  // If the anchor itself is already in the past (cutoff missed), bump
  // until we find a Friday where cutoff is in the future.
  while (friday - CUTOFF_OFFSET_MS <= nowMs) {
    friday += FORTNIGHT_MS;
  }
  return new Date(friday);
}

/**
 * Estimated arrival window for a given payout Friday: +2 to +5 business
 * days. Skips weekend days. Returns ISO date strings.
 */
function estimateArrivalWindow(payoutFridayDate) {
  function addBusinessDays(d, n) {
    const r = new Date(d.getTime());
    let added = 0;
    while (added < n) {
      r.setUTCDate(r.getUTCDate() + 1);
      const dow = r.getUTCDay(); // 0=Sun, 6=Sat
      if (dow !== 0 && dow !== 6) added++;
    }
    return r;
  }
  const start = addBusinessDays(payoutFridayDate, 2);
  const end = addBusinessDays(payoutFridayDate, 5);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function isoDate(d) { return d.toISOString().slice(0, 10); }

// ── Admin auth helper — mirrors api/campaigns.js requireAdmin ──────────────
function requireAdmin(req) {
  const authHeader = req.headers && req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const staticKeys = [process.env.BBX_ADMIN_KEY, process.env.ADMIN_TOKEN].filter(Boolean);
  if (token && staticKeys.includes(token)) {
    return { role: "admin", source: "static_key" };
  }
  return null;
}

module.exports = async function handler(req, res) {
  const action = (req.query && req.query.action) || (req.body && req.body.action) || "";
  const body = req.body || {};

  if (!HAS_SUPABASE) {
    return res.status(503).json({ error: "Payouts require a configured Supabase backend." });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Publisher-facing actions ──────────────────────────────────────────────
  if (action === "preview" || action === "request" || action === "list" || action === "cancel") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "No token" });
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

    // ── preview: compute target date + arrival window for the cashout modal ──
    if (action === "preview") {
      const amount = Number(body.amount_usd);
      if (!Number.isFinite(amount) || amount < 1) {
        return res.status(400).json({ error: "Minimum cashout is $1.00 USD." });
      }
      const friday = computeTargetPayoutDate();
      const arr = estimateArrivalWindow(friday);
      return res.json({
        amount_usd: Math.round(amount * 100) / 100,
        target_payout_date: isoDate(friday),
        arrival_window: arr,
      });
    }

    // ── request: 2FA-gated cashout. Deducts balance, freezes bank info. ──
    if (action === "request") {
      const amount = Number(body.amount_usd);
      const totpCode = String(body.totp_code || "").replace(/\s+/g, "");
      if (!Number.isFinite(amount) || amount < 1) {
        return res.status(400).json({ error: "Minimum cashout is $1.00 USD." });
      }
      if (!/^\d{6}$/.test(totpCode)) {
        return res.status(400).json({ error: "Enter the 6-digit code from your authenticator app." });
      }

      // 1. Verify 2FA via user_mfa.
      const { data: mfaRow, error: mfaErr } = await supabaseAdmin
        .from("user_mfa")
        .select("totp_secret, failed_attempts")
        .eq("user_id", user.id)
        .maybeSingle();
      if (mfaErr) return res.status(500).json({ error: mfaErr.message });
      if (!mfaRow) {
        return res.status(412).json({
          error: "Enable two-factor authentication first (Settings → Security).",
          code: "mfa_required",
        });
      }
      if ((mfaRow.failed_attempts || 0) >= 10) {
        return res.status(429).json({ error: "Too many failed attempts. Email support@boostboss.ai to recover access." });
      }
      if (!totp.verifyCode(mfaRow.totp_secret, totpCode, 1)) {
        await supabaseAdmin
          .from("user_mfa")
          .update({ failed_attempts: (mfaRow.failed_attempts || 0) + 1 })
          .eq("user_id", user.id);
        return res.status(401).json({ error: "That authenticator code doesn't match. Use the latest one." });
      }

      // 2. Verify bank details on file. Without them we have nothing to wire.
      const { data: bank, error: bankErr } = await supabaseAdmin
        .from("publisher_payout_methods")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (bankErr) return res.status(500).json({ error: bankErr.message });
      if (!bank) {
        return res.status(412).json({
          error: "Add your bank details first (Settings → Payouts).",
          code: "bank_required",
        });
      }

      // 3. Atomically decrement publisher_balance. Returns the amount
      //    actually deducted — if the publisher's balance is less than
      //    requested, we honor the lower number rather than failing.
      const { data: deducted, error: decErr } = await supabaseAdmin.rpc(
        "bbx_decrement_publisher_balance",
        { p_developer_id: user.id, p_amount_usd: amount }
      );
      if (decErr) return res.status(500).json({ error: decErr.message });
      const finalAmount = Number(deducted || 0);
      if (finalAmount < 1) {
        return res.status(400).json({ error: "Insufficient balance (minimum $1.00 USD)." });
      }

      const friday = computeTargetPayoutDate();
      const targetDate = isoDate(friday);
      const arrival = estimateArrivalWindow(friday);

      const bankSnapshot = {
        account_holder_name: bank.account_holder_name,
        account_holder_country: bank.account_holder_country,
        account_holder_address: bank.account_holder_address,
        bank_name: bank.bank_name,
        bank_country: bank.bank_country,
        swift_bic: bank.swift_bic,
        iban_or_account: bank.iban_or_account,
        routing_or_branch: bank.routing_or_branch,
        currency: bank.currency || "USD",
        captured_at: new Date().toISOString(),
      };

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("payout_requests")
        .insert({
          publisher_id: user.id,
          amount_usd: finalAmount,
          status: "pending",
          target_payout_date: targetDate,
          bank_snapshot: bankSnapshot,
        })
        .select("id, created_at")
        .single();

      if (insErr) {
        // Refund the deduction so the publisher isn't stuck.
        await supabaseAdmin.rpc("bbx_credit_publisher_balance", {
          p_developer_id: user.id,
          p_amount_usd: finalAmount,
        });
        return res.status(500).json({ error: insErr.message });
      }

      // Reset MFA failure counter + record step-up.
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from("user_mfa")
        .update({ last_used_at: nowIso, last_step_up_at: nowIso, failed_attempts: 0 })
        .eq("user_id", user.id);

      return res.json({
        success: true,
        id: inserted.id,
        amount_usd: finalAmount,
        target_payout_date: targetDate,
        arrival_window: arrival,
      });
    }

    // ── list: the publisher's own payout history ──
    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("payout_requests")
        .select("id, amount_usd, status, target_payout_date, batch_id, created_at, batched_at, paid_at, failure_reason")
        .eq("publisher_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ requests: data || [] });
    }

    // ── cancel: still-pending requests only. Refunds balance. ──
    if (action === "cancel") {
      const id = String(body.id || "");
      const totpCode = String(body.totp_code || "").replace(/\s+/g, "");
      if (!id) return res.status(400).json({ error: "id is required" });
      if (!/^\d{6}$/.test(totpCode)) {
        return res.status(400).json({ error: "Enter the 6-digit code from your authenticator app." });
      }

      // Verify TOTP (same pattern as request).
      const { data: mfaRow, error: mfaErr } = await supabaseAdmin
        .from("user_mfa")
        .select("totp_secret, failed_attempts")
        .eq("user_id", user.id)
        .maybeSingle();
      if (mfaErr) return res.status(500).json({ error: mfaErr.message });
      if (!mfaRow) return res.status(412).json({ error: "Two-factor not enabled.", code: "mfa_required" });
      if (!totp.verifyCode(mfaRow.totp_secret, totpCode, 1)) {
        await supabaseAdmin
          .from("user_mfa")
          .update({ failed_attempts: (mfaRow.failed_attempts || 0) + 1 })
          .eq("user_id", user.id);
        return res.status(401).json({ error: "That authenticator code doesn't match." });
      }

      // Lock + read the row. Only cancel if still pending AND owned by user.
      const { data: row, error: readErr } = await supabaseAdmin
        .from("payout_requests")
        .select("id, amount_usd, status, publisher_id")
        .eq("id", id)
        .eq("publisher_id", user.id)
        .maybeSingle();
      if (readErr) return res.status(500).json({ error: readErr.message });
      if (!row) return res.status(404).json({ error: "Request not found." });
      if (row.status !== "pending") {
        return res.status(409).json({ error: "Only pending requests can be cancelled. This one is already " + row.status + "." });
      }

      const { error: updErr } = await supabaseAdmin
        .from("payout_requests")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("status", "pending"); // belt-and-braces re-check
      if (updErr) return res.status(500).json({ error: updErr.message });

      // Refund.
      await supabaseAdmin.rpc("bbx_credit_publisher_balance", {
        p_developer_id: user.id,
        p_amount_usd: Number(row.amount_usd),
      });

      return res.json({ success: true });
    }
  }

  // ── Admin batch actions ──────────────────────────────────────────────────
  if (action === "admin_list_pending" || action === "admin_export"
      || action === "admin_send_batch"
      || action === "admin_mark_paid" || action === "admin_mark_failed") {
    if (!requireAdmin(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }

    // ── list pending grouped by target_payout_date ──
    if (action === "admin_list_pending") {
      const { data, error } = await supabaseAdmin
        .from("payout_requests")
        .select("id, publisher_id, amount_usd, status, target_payout_date, batch_id, bank_snapshot, created_at, batched_at, paid_at, failure_reason")
        .in("status", ["pending", "batched"])
        .order("target_payout_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });

      // Group by target_payout_date for the admin table.
      const byDate = {};
      for (const r of (data || [])) {
        const k = r.target_payout_date;
        if (!byDate[k]) byDate[k] = { target_payout_date: k, count: 0, total_usd: 0, requests: [] };
        byDate[k].count += 1;
        byDate[k].total_usd = Math.round((byDate[k].total_usd + Number(r.amount_usd)) * 100) / 100;
        byDate[k].requests.push(r);
      }
      return res.json({ batches: Object.values(byDate) });
    }

    // ── export a single date's pending rows to Payoneer-ready CSV ──
    // Marks the rows batched + assigns a batch_id so they don't get
    // re-exported. Returns both the CSV text and the batch_id.
    if (action === "admin_export") {
      const targetDate = String(body.target_payout_date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        return res.status(400).json({ error: "target_payout_date must be ISO YYYY-MM-DD" });
      }
      const batchId = "BB-" + targetDate.replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();

      // Read all pending rows for this date.
      const { data: rows, error: readErr } = await supabaseAdmin
        .from("payout_requests")
        .select("id, publisher_id, amount_usd, bank_snapshot")
        .eq("status", "pending")
        .eq("target_payout_date", targetDate);
      if (readErr) return res.status(500).json({ error: readErr.message });
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: "No pending requests for that date." });
      }

      // Mark them batched.
      const ids = rows.map(r => r.id);
      const { error: updErr } = await supabaseAdmin
        .from("payout_requests")
        .update({ status: "batched", batched_at: new Date().toISOString(), batch_id: batchId })
        .in("id", ids)
        .eq("status", "pending");
      if (updErr) return res.status(500).json({ error: updErr.message });

      // Build a Payoneer-ish CSV. Adjust columns to Andy's actual Payoneer
      // template — this is a sensible default that covers the universal
      // international-wire fields. The "PayeeRef" is our payout_request.id
      // so reconciliation later is unambiguous.
      const header = [
        "PayeeRef", "AmountUSD",
        "BeneficiaryName", "BeneficiaryAddress", "BeneficiaryCountry",
        "BankName", "BankCountry", "SwiftBIC", "IbanOrAccount", "RoutingOrBranch",
      ];
      const csvLines = [header.join(",")];
      for (const r of rows) {
        const s = r.bank_snapshot || {};
        const cells = [
          r.id,
          Number(r.amount_usd).toFixed(2),
          s.account_holder_name || "",
          s.account_holder_address || "",
          s.account_holder_country || "",
          s.bank_name || "",
          s.bank_country || "",
          s.swift_bic || "",
          s.iban_or_account || "",
          s.routing_or_branch || "",
        ].map(csvEscape);
        csvLines.push(cells.join(","));
      }
      return res.json({
        batch_id: batchId,
        target_payout_date: targetDate,
        row_count: rows.length,
        total_usd: rows.reduce((acc, r) => acc + Number(r.amount_usd), 0),
        csv: csvLines.join("\n"),
      });
    }

    // ── dispatch a batch via the PayPal Payouts API ──
    // The intended successor to admin_export. Same selection logic (all
    // pending rows for one target_payout_date), but instead of generating a
    // CSV for manual upload, it calls PayPal Payouts /v1/payments/payouts
    // directly. PayPal queues the batch and starts moving money; status
    // arrives via PAYMENT.PAYOUTSBATCH.* and PAYMENT.PAYOUTS-ITEM.*
    // webhooks (handler lives in api/billing.js handlePaypalWebhook).
    //
    // Why the legacy admin_export stays in the file: it's a manual escape
    // hatch for cases where the PayPal API is down or returns an
    // unrecoverable error and Andy needs to ship a batch the old way
    // (export CSV → upload elsewhere → confirm manually with admin_mark_paid).
    //
    // Schema notes — payout_requests columns used:
    //   bank_snapshot jsonb — post-pivot contains { paypal_email: "..." }
    //     instead of the old { account_holder_name, swift_bic, ... }. The
    //     column NAME stays "bank_snapshot" to avoid a migration; only the
    //     contents change.
    //   batch_id text — formatted BB-YYYYMMDD-XXXXXX, becomes PayPal's
    //     sender_batch_id (PayPal idempotency key for retries).
    //   paypal_batch_id text — PayPal's payout_batch_id (NEW column, may
    //     not yet exist in db/24 — write is best-effort with try/catch).
    if (action === "admin_send_batch") {
      const targetDate = String(body.target_payout_date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        return res.status(400).json({ error: "target_payout_date must be ISO YYYY-MM-DD" });
      }
      const batchId = "BB-" + targetDate.replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();

      // Read all pending rows for this date.
      const { data: rows, error: readErr } = await supabaseAdmin
        .from("payout_requests")
        .select("id, publisher_id, amount_usd, bank_snapshot")
        .eq("status", "pending")
        .eq("target_payout_date", targetDate);
      if (readErr) return res.status(500).json({ error: readErr.message });
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: "No pending requests for that date." });
      }

      // Map our rows → PayPal Payouts items. Reject up-front if any row
      // is missing a paypal_email — saves us from a partial-dispatch state
      // where some items got accepted by PayPal and others got 400'd.
      const items = [];
      const missingEmail = [];
      for (const r of rows) {
        const snap = r.bank_snapshot || {};
        const email = String(snap.paypal_email || "").trim();
        if (!email) { missingEmail.push(r.id); continue; }
        items.push({
          senderItemId:  r.id,
          receiverEmail: email,
          amountUsd:     Number(r.amount_usd),
          note:          `Boost Boss publisher payout · ${batchId}`,
        });
      }
      if (missingEmail.length > 0) {
        return res.status(400).json({
          error: "missing_paypal_email",
          detail: "Some payout_requests rows have no paypal_email in bank_snapshot. Ask the affected publishers to set their payout method before dispatching.",
          missing_request_ids: missingEmail,
        });
      }

      // Optimistically mark rows batched BEFORE the PayPal call. If the
      // dispatch fails, we roll back in the catch block. Doing it in this
      // order means a successful dispatch can never end up with rows still
      // marked pending (which would let a publisher cancel a request that's
      // already moving money on PayPal's side).
      const ids = rows.map((r) => r.id);
      const batchedAt = new Date().toISOString();
      const { error: updErr } = await supabaseAdmin
        .from("payout_requests")
        .update({ status: "batched", batched_at: batchedAt, batch_id: batchId })
        .in("id", ids)
        .eq("status", "pending");
      if (updErr) return res.status(500).json({ error: updErr.message });

      let dispatched;
      try {
        dispatched = await paypalPayouts.sendBatchPayout({
          senderBatchId: batchId,
          items,
        });
      } catch (err) {
        // Roll back the batched marking so the admin can retry. Don't refund
        // publisher balances yet — they're still going to be paid, just not
        // in this batch.
        console.error("[Payouts] PayPal dispatch failed, rolling back batch:", err.message, err.detail || "");
        await supabaseAdmin
          .from("payout_requests")
          .update({ status: "pending", batched_at: null, batch_id: null })
          .in("id", ids)
          .eq("batch_id", batchId);
        return res.status(502).json({
          error:  "paypal_dispatch_failed",
          detail: err.message,
          paypal_error: err.detail || null,
        });
      }

      // Store PayPal's payout_batch_id on each row for later reconciliation
      // from PAYMENT.PAYOUTS-ITEM.* webhooks. Best-effort: if the column
      // doesn't exist yet (db migration not run), don't fail the dispatch —
      // we still have batch_id + sender_item_id for reconciliation.
      if (dispatched.payout_batch_id) {
        try {
          await supabaseAdmin
            .from("payout_requests")
            .update({ paypal_batch_id: dispatched.payout_batch_id })
            .in("id", ids);
        } catch (_) { /* column may not exist yet — skip */ }
      }

      return res.json({
        batch_id:        batchId,
        paypal_batch_id: dispatched.payout_batch_id,
        target_payout_date: targetDate,
        row_count:       rows.length,
        total_usd:       dispatched.total_usd,
        batch_status:    dispatched.batch_status,
        mode:            dispatched.mode,
      });
    }

    // ── mark every row in a batch as paid ──
    if (action === "admin_mark_paid") {
      const batchId = String(body.batch_id || "");
      if (!batchId) return res.status(400).json({ error: "batch_id is required" });
      const { data, error } = await supabaseAdmin
        .from("payout_requests")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("batch_id", batchId)
        .eq("status", "batched")
        .select("id, publisher_id, amount_usd, bank_snapshot");
      if (error) return res.status(500).json({ error: error.message });

      // Phase 4: fire the branded "Payout sent" email to each publisher
      // in the batch. Fire-and-forget — admin batch processing shouldn't
      // wait on email delivery. Failures are logged by the emails module.
      // We look up each publisher's email from the developers table; the
      // bank_snapshot column on payout_requests is the routing info, NOT
      // necessarily the contact email.
      try {
        const { sendPayoutSent } = require("./_lib/emails/send");
        const rows = data || [];
        if (rows.length > 0) {
          const ids = Array.from(new Set(rows.map((r) => r.publisher_id).filter(Boolean)));
          const { data: pubs } = await supabaseAdmin
            .from("developers")
            .select("id, email")
            .in("id", ids);
          const emailByPubId = new Map((pubs || []).map((p) => [p.id, p.email]));
          for (const row of rows) {
            const email = emailByPubId.get(row.publisher_id);
            if (!email) continue;
            const method = row.bank_snapshot && row.bank_snapshot.method
              ? String(row.bank_snapshot.method)
              : "Bank transfer";
            sendPayoutSent({
              to:                   email,
              amountUsd:            Number(row.amount_usd) || 0,
              payoutMethod:        method,
              payoutId:            row.id,
              expectedDeliveryDays: "1-3 business days",
            }).catch((e) => console.error("[Payouts] sendPayoutSent threw:", e.message));
          }
        }
      } catch (e) {
        console.warn("[Payouts] payout-sent emails skipped:", e.message);
      }

      return res.json({ success: true, updated: (data || []).length });
    }

    // ── mark ONE request as failed and refund the publisher's balance ──
    if (action === "admin_mark_failed") {
      const id = String(body.id || "");
      const reason = String(body.reason || "").slice(0, 500);
      if (!id) return res.status(400).json({ error: "id is required" });

      const { data: row, error: readErr } = await supabaseAdmin
        .from("payout_requests")
        .select("id, publisher_id, amount_usd, status")
        .eq("id", id)
        .maybeSingle();
      if (readErr) return res.status(500).json({ error: readErr.message });
      if (!row) return res.status(404).json({ error: "Request not found." });
      if (row.status === "paid" || row.status === "cancelled") {
        return res.status(409).json({ error: "Cannot mark " + row.status + " request as failed." });
      }

      const { error: updErr } = await supabaseAdmin
        .from("payout_requests")
        .update({ status: "failed", failure_reason: reason || "Unspecified" })
        .eq("id", id);
      if (updErr) return res.status(500).json({ error: updErr.message });

      // Refund.
      await supabaseAdmin.rpc("bbx_credit_publisher_balance", {
        p_developer_id: row.publisher_id,
        p_amount_usd: Number(row.amount_usd),
      });

      return res.json({ success: true });
    }
  }

  return res.status(400).json({ error: "Unknown action. Use: preview, request, list, cancel, admin_list_pending, admin_send_batch, admin_export, admin_mark_paid, admin_mark_failed" });
};

function csvEscape(v) {
  const s = String(v == null ? "" : v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
