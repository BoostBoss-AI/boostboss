/**
 * Boost Boss — PayPal Payouts client wrapper
 *
 * The SUPPLY side of the money pipeline — pays publishers via the PayPal
 * Payouts API (`POST /v1/payments/payouts`). Twin to `api/_lib/payin/paypal.js`
 * which handles the demand side (advertiser deposits).
 *
 * Why a separate module instead of bolting onto payin/paypal.js:
 *   • Clean separation between in-flow (Orders v2) and out-flow (Payouts v1)
 *     APIs — they use different endpoints, different webhook event types,
 *     different idempotency semantics.
 *   • The pay-in module is live, tested, and feeding production deposits.
 *     Touching it carries risk we don't need to take. This module owns its
 *     OAuth cache (PayPal allows multiple parallel client_credentials tokens
 *     without quota impact).
 *   • If/when we refactor, the shared concerns (OAuth + REST wrapper)
 *     can extract into `api/_lib/payment/paypal_core.js` without changing
 *     either caller's surface.
 *
 * Why PayPal Payouts at all (not Payoneer):
 *   • As a Taiwan business entity, Boost Boss must pay out from the same
 *     provider that takes deposits (Taiwan law forbids cross-provider
 *     top-up to settle obligations).
 *   • PayPal is already integrated for pay-in. Single-provider rule forces
 *     PayPal for pay-out as well. See the `taiwan_entity_single_provider`
 *     memory for the full constraint.
 *
 * Phase 3 scope (PayPal Payouts v1 API):
 *   • OAuth client-credentials token (own cache)
 *   • sendBatchPayout    — dispatches one batch of N payouts, returns
 *                          PayPal batch id + per-item ids for reconciliation
 *   • getBatch           — fetch batch status (for admin polling)
 *   • getItem            — fetch single item status (for one-off refresh)
 *
 * Demo mode (no PAYPAL_CLIENT_ID/SECRET): returns deterministic fake
 * batch + item ids so tests and DEMO mode never need real credentials.
 *
 * Environment variables read:
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV ("sandbox"|"live")
 *
 * Webhooks consumed (handled in api/billing.js handlePaypalWebhook):
 *   PAYMENT.PAYOUTSBATCH.PROCESSING / SUCCESS / DENIED
 *   PAYMENT.PAYOUTS-ITEM.SUCCEEDED / DENIED / FAILED / RETURNED /
 *   REFUNDED / UNCLAIMED / BLOCKED / HELD
 */

"use strict";

const HOSTS = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live:    "https://api-m.paypal.com",
};

// Hard cap per PayPal docs: 15,000 items per batch, $5M per batch, $20k per
// item. We enforce a tighter conservative limit so a runaway batch can't
// trigger a 400. Adjust if real volume warrants.
const MAX_ITEMS_PER_BATCH      = 500;
const MAX_AMOUNT_PER_ITEM_USD  = 10_000;
const MAX_BATCH_TOTAL_USD      = 250_000;

function getEnv() {
  const env = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();
  return env === "live" ? "live" : "sandbox";
}

function getBaseUrl() {
  return HOSTS[getEnv()];
}

function hasCreds() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

// ── Own OAuth token cache (separate from payin/paypal.js) ──────────────
let _tokenCache = { token: null, expiresAt: 0, env: null };

async function getAccessToken() {
  if (!hasCreds()) return null;
  const now = Date.now();
  if (_tokenCache.token && _tokenCache.expiresAt > now + 60_000 && _tokenCache.env === getEnv()) {
    return _tokenCache.token;
  }
  const basic = Buffer
    .from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`)
    .toString("base64");
  const res = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type":  "application/x-www-form-urlencoded",
      "Accept":        "application/json",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`paypal_payouts_oauth_failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  _tokenCache = {
    token:     data.access_token,
    expiresAt: now + ((Number(data.expires_in) || 0) * 1000),
    env:       getEnv(),
  };
  return _tokenCache.token;
}

function _resetTokenCache() {
  _tokenCache = { token: null, expiresAt: 0, env: null };
}

async function _paypalFetch(path, { method = "GET", body = null, requestId = null } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("paypal_not_configured");
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type":  "application/json",
    "Accept":        "application/json",
  };
  if (requestId) headers["PayPal-Request-Id"] = requestId;
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return { ok: true, _status: 204 };
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { _raw: text }; }
  if (!res.ok) {
    const err = new Error(`paypal_http_${res.status}`);
    err.status = res.status;
    err.detail = json;
    throw err;
  }
  return json;
}

// ── DEMO-MODE deterministic responses ──────────────────────────────────
function _demoBatchId() {
  return "PAYOUT_BATCH_DEMO_" + Math.random().toString(36).slice(2, 10).toUpperCase();
}
function _demoItemId() {
  return "PAYOUT_ITEM_DEMO_" + Math.random().toString(36).slice(2, 12).toUpperCase();
}

// ────────────────────────────────────────────────────────────────────
//                          PUBLIC API
// ────────────────────────────────────────────────────────────────────

/**
 * Dispatch one batch of payouts to PayPal.
 *
 * @param {Object} opts
 * @param {string} opts.senderBatchId   Boost Boss batch id (BB-YYYYMMDD-XXXXXX).
 *                                       Used as PayPal's `sender_batch_id` —
 *                                       PayPal dedupes on this if you retry,
 *                                       so always reuse the same value when
 *                                       retrying the same logical batch.
 * @param {Array}  opts.items           Array of { senderItemId, receiverEmail,
 *                                       amountUsd, note?, recipientWallet? }
 *                                       — senderItemId is our payout_request.id
 *                                       so webhooks can reconcile by it.
 * @param {string} [opts.emailSubject]  Subject line on PayPal's auto-email to
 *                                       recipients ("You have a payout").
 * @param {string} [opts.emailMessage]  Body copy on PayPal's auto-email.
 *
 * @returns {Object} { mode, payout_batch_id, sender_batch_id, batch_status,
 *                     items: [{ sender_item_id, payout_item_id }], raw }
 */
async function sendBatchPayout(opts) {
  const {
    senderBatchId,
    items,
    emailSubject = "You have a payout from Boost Boss",
    emailMessage = "Thanks for monetizing with Boost Boss — your scheduled payout has been sent. The funds should arrive in your PayPal account momentarily.",
  } = opts || {};

  if (!senderBatchId || typeof senderBatchId !== "string") {
    throw new Error("sendBatchPayout: senderBatchId required");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("sendBatchPayout: items[] required");
  }
  if (items.length > MAX_ITEMS_PER_BATCH) {
    throw new Error(`sendBatchPayout: batch too large (${items.length} > ${MAX_ITEMS_PER_BATCH})`);
  }

  // Validate every item up front. Catching here gives a meaningful error
  // before PayPal returns a generic 400; also avoids partial-success state
  // where some items dispatched and others didn't.
  let total = 0;
  const normalized = items.map((it, i) => {
    if (!it || typeof it !== "object") {
      throw new Error(`sendBatchPayout: items[${i}] must be an object`);
    }
    const amt = Number(it.amountUsd);
    if (!(amt > 0) || amt > MAX_AMOUNT_PER_ITEM_USD) {
      throw new Error(`sendBatchPayout: items[${i}].amountUsd invalid (${it.amountUsd})`);
    }
    const receiver = String(it.receiverEmail || "").trim().toLowerCase();
    if (!receiver || !receiver.includes("@")) {
      throw new Error(`sendBatchPayout: items[${i}].receiverEmail invalid`);
    }
    const senderItemId = String(it.senderItemId || "").trim();
    if (!senderItemId) {
      throw new Error(`sendBatchPayout: items[${i}].senderItemId required (reconciliation key)`);
    }
    total += amt;
    return {
      recipient_type: "EMAIL",
      amount: {
        value:         amt.toFixed(2),
        currency:      "USD",
      },
      note:           it.note || `Boost Boss publisher payout · ${senderBatchId}`,
      sender_item_id: senderItemId,
      receiver,
    };
  });

  if (total > MAX_BATCH_TOTAL_USD) {
    throw new Error(`sendBatchPayout: batch total $${total.toFixed(2)} exceeds cap $${MAX_BATCH_TOTAL_USD}`);
  }

  // ── Demo mode short-circuit ──
  if (!hasCreds()) {
    const fakeBatchId = _demoBatchId();
    return {
      mode:            "demo",
      payout_batch_id: fakeBatchId,
      sender_batch_id: senderBatchId,
      batch_status:    "PENDING",
      items: normalized.map((it) => ({
        sender_item_id: it.sender_item_id,
        payout_item_id: _demoItemId(),
        status:         "UNCLAIMED",
        amount_usd:     Number(it.amount.value),
        receiver:       it.receiver,
      })),
      total_usd: total,
      raw:       { _demo: true },
    };
  }

  // ── Real dispatch ──
  // PayPal's batch endpoint accepts ?sync_mode=false (default) which queues
  // the batch and returns 201 immediately. We use async mode because batches
  // larger than ~50 items synchronously exceed our serverless timeout. Status
  // arrives via PAYMENT.PAYOUTSBATCH.SUCCESS and per-item PAYMENT.PAYOUTS-ITEM.*
  // webhooks — see api/billing.js handlePaypalWebhook for the reconcile path.
  const body = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject:   emailSubject,
      email_message:   emailMessage,
    },
    items: normalized,
  };

  const result = await _paypalFetch("/v1/payments/payouts", {
    method:    "POST",
    body,
    requestId: senderBatchId,  // PayPal idempotency key
  });

  const header = result.batch_header || {};
  // On async dispatch PayPal does NOT echo per-item payout_item_ids in the
  // 201 response — those come back later when batch processing completes.
  // We seed our return with sender_item_id only; the webhook reconciler
  // adds payout_item_id when PAYMENT.PAYOUTS-ITEM.SUCCEEDED fires.
  return {
    mode:            "live",
    payout_batch_id: header.payout_batch_id,
    sender_batch_id: (header.sender_batch_header && header.sender_batch_header.sender_batch_id) || senderBatchId,
    batch_status:    header.batch_status || "PENDING",
    items: normalized.map((it) => ({
      sender_item_id: it.sender_item_id,
      payout_item_id: null,        // filled in by webhook on item-level success
      status:         "UNCLAIMED",  // PayPal's pre-claim state
      amount_usd:     Number(it.amount.value),
      receiver:       it.receiver,
    })),
    total_usd: total,
    raw:       result,
  };
}

/**
 * Fetch the current state of a payout batch by PayPal's `payout_batch_id`.
 * Used by admin polling and by reconciler retries when a webhook is missed.
 *
 * @param {string} payoutBatchId   PayPal's id (NOT our sender_batch_id)
 * @returns {Object} batch detail with items[]
 */
async function getBatch(payoutBatchId) {
  if (!payoutBatchId) throw new Error("getBatch: payoutBatchId required");
  if (!hasCreds()) {
    return {
      mode:            "demo",
      payout_batch_id: payoutBatchId,
      batch_status:    "SUCCESS",
      items: [],
      raw:   { _demo: true },
    };
  }
  // PayPal paginates large batches with `page` + `page_size` query params.
  // Default page_size = 1000 which covers our MAX_ITEMS_PER_BATCH cap, so
  // a single call is enough until we lift the cap.
  const result = await _paypalFetch(`/v1/payments/payouts/${encodeURIComponent(payoutBatchId)}?page_size=1000`);
  return {
    mode:            "live",
    payout_batch_id: payoutBatchId,
    batch_status:    (result.batch_header && result.batch_header.batch_status) || "UNKNOWN",
    items:           result.items || [],
    raw:             result,
  };
}

/**
 * Fetch single payout item — used by admin "refresh status" affordance
 * when a webhook may have been missed.
 */
async function getItem(payoutItemId) {
  if (!payoutItemId) throw new Error("getItem: payoutItemId required");
  if (!hasCreds()) {
    return {
      mode:           "demo",
      payout_item_id: payoutItemId,
      transaction_status: "SUCCESS",
      raw:            { _demo: true },
    };
  }
  const result = await _paypalFetch(`/v1/payments/payouts-item/${encodeURIComponent(payoutItemId)}`);
  return {
    mode:           "live",
    payout_item_id: payoutItemId,
    transaction_status: result.transaction_status,
    raw:            result,
  };
}

module.exports = {
  // public API
  sendBatchPayout,
  getBatch,
  getItem,
  // helpers (mostly for tests / introspection)
  hasCreds,
  getEnv,
  getBaseUrl,
  _resetTokenCache,
  // constants surfaced so admin UI can show limits
  MAX_ITEMS_PER_BATCH,
  MAX_AMOUNT_PER_ITEM_USD,
  MAX_BATCH_TOTAL_USD,
};
