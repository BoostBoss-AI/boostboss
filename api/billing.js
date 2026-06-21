/**
 * Boost Boss — Billing API
 *
 * Two execution modes mirror the auth + ledger pattern:
 *   • PRODUCTION — live Stripe (when STRIPE_SECRET_KEY is set)
 *   • DEMO       — in-process accounts/transfers/invoices, perfect for
 *                  preview deploys, the public exchange page, and the
 *                  test suite. No external calls, deterministic responses.
 *
 * Endpoints
 *   POST /api/billing?action=create_checkout    advertiser deposits funds
 *   POST /api/billing?action=create_connect     publisher onboards Connect
 *   POST /api/billing?action=invoice            generate an invoice from the
 *                                                ledger for an advertiser
 *                                                (sum of won_price_cpm / 1000
 *                                                over the period)
 *   POST /api/billing?action=payout             trigger Connect transfers to
 *                                                publishers based on impression
 *                                                revenue from the ledger
 *   POST /api/billing?action=webhook            Stripe webhook handler
 *                                                (signature-verified)
 *   GET  /api/billing?action=balance&id=...     advertiser balance
 *   GET  /api/billing?action=history&id=...     advertiser tx history
 *   GET  /api/billing?action=earnings&key=...   developer earnings
 *
 * Money model (updated 2026-06-04)
 *   • RTB exchange fee:    6.5% (configurable via BBX_RTB_FEE)      — demand-side, charged to advertiser
 *   • Network take:       23.5% (configurable via BBX_NETWORK_TAKE) — Boost Boss platform margin
 *   • Combined fees:        30% (BBX_RTB_FEE + BBX_NETWORK_TAKE)
 *   • Publisher share:      70% (1 - BBX_RTB_FEE - BBX_NETWORK_TAKE)
 *   • Legacy BBX_TAKE_RATE  — if set, overrides the sum of the two new vars (back-compat)
 *   • Min payout threshold: $100 (configurable via BBX_MIN_PAYOUT)
 *   • Currency:             USD only for v1
 */

const ledger = require("./_lib/ledger.js");
// Phase E Day 2/3 — atomic balance helpers shared with api/track.js.
const publisherBalance = require("./_lib/publisher_balance.js");
// Phase 2 — PayPal pay-in rail (additive; demo-mode safe when env unset).
const paypal = require("./_lib/payin/paypal.js");

const HAS_STRIPE   = !!process.env.STRIPE_SECRET_KEY;
const HAS_PAYPAL   = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
const HAS_SUPABASE = !!(
  process.env.SUPABASE_URL &&
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
);

// Which pay-in provider the advertiser dashboard should default to.
// "auto" picks PayPal if configured, else Stripe, else demo.
const PAYIN_PROVIDER_ENV = (process.env.PAYIN_PROVIDER || "auto").toLowerCase();
function resolvedPayinProvider() {
  if (PAYIN_PROVIDER_ENV === "paypal") return HAS_PAYPAL ? "paypal" : "demo";
  if (PAYIN_PROVIDER_ENV === "stripe") return HAS_STRIPE ? "stripe" : "demo";
  // auto
  if (HAS_PAYPAL) return "paypal";
  if (HAS_STRIPE) return "stripe";
  return "demo";
}

// Revenue model split (Phase F, 2026-06-04). Each fee is kept as a separate
// env var so they can be tuned independently AND attributed correctly in
// accounting (RTB is invoiced to the advertiser as a demand-side fee; the
// network take is platform margin). Legacy BBX_TAKE_RATE still wins if set,
// for back-compat with anything still pointing at the old single-knob name.
const RTB_FEE           = Number(process.env.BBX_RTB_FEE)      || 0.065;
const NETWORK_TAKE      = Number(process.env.BBX_NETWORK_TAKE) || 0.235;
const TAKE_RATE         = Number(process.env.BBX_TAKE_RATE)
                          || +(RTB_FEE + NETWORK_TAKE).toFixed(6); // 0.30 default
const MIN_PAYOUT_USD     = Number(process.env.BBX_MIN_PAYOUT) || 100.0;
const PUBLIC_BASE_URL    = process.env.BOOSTBOSS_BASE_URL     || "https://boostboss.ai";
const STRIPE_WEBHOOK_KEY = process.env.STRIPE_WEBHOOK_SECRET   || null;

// ── Startup safety: warn loudly if production infra is partially configured ──
if (HAS_SUPABASE && !HAS_STRIPE) {
  console.error("⚠️  [Billing] CRITICAL: Supabase is configured but STRIPE_SECRET_KEY is missing. Billing will run in DEMO mode — real deposits will NOT be processed. Set STRIPE_SECRET_KEY to enable production billing.");
}
if (HAS_STRIPE && !STRIPE_WEBHOOK_KEY) {
  console.error("⚠️  [Billing] WARNING: Stripe is configured but STRIPE_WEBHOOK_SECRET is missing. Webhooks will be rejected in production. Deposits may not credit advertiser balances.");
}
if (HAS_STRIPE && !HAS_SUPABASE) {
  console.error("⚠️  [Billing] WARNING: Stripe is configured but Supabase is missing. Payments will process but balances cannot be persisted.");
}

// ── lazy loaders so demo mode has zero deps ────────────────────────────
let _stripe = null;
function stripe() {
  if (_stripe) return _stripe;
  if (!HAS_STRIPE) return null;
  try { _stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); }
  catch (_) { console.warn("[Billing] stripe SDK not installed — falling back to demo mode"); }
  return _stripe;
}

let _supabase = null;
function supa() {
  if (_supabase) return _supabase;
  if (!HAS_SUPABASE) return null;
  try {
    const { createClient } = require("@supabase/supabase-js");
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    return _supabase;
  } catch (_) { return null; }
}

// Anon-keyed client used only for validating user-supplied JWTs via
// supabase.auth.getUser(token). The service-role client above can't be
// used for this because it bypasses RLS and would happily return the
// service-role identity for any input.
let _supabaseAnon = null;
function supaAnon() {
  if (_supabaseAnon) return _supabaseAnon;
  if (!process.env.SUPABASE_URL) return null;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
  if (!anonKey) return null;
  try {
    const { createClient } = require("@supabase/supabase-js");
    _supabaseAnon = createClient(process.env.SUPABASE_URL, anonKey, {
      auth: { persistSession: false },
    });
    return _supabaseAnon;
  } catch (_) { return null; }
}

// Extract the authenticated user from the Authorization: Bearer <jwt>
// header. Returns the Supabase user object, or null if the header is
// missing / malformed / expired. Used by tenant-scoped routes that
// previously trusted `?id=` from the query string — see task #152.
async function getAuthUser(req) {
  const token = (req.headers && req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = supaAnon();
  if (!anon) return null;
  try {
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (_) { return null; }
}

// ── In-process demo accounts (reset on cold start) ─────────────────────
const DEMO = {
  advertisers: new Map(), // id → { id, email, balance, company_name }
  developers:  new Map(), // id → { id, email, total_earnings, app_name, stripe_account_id }
  invoices:    new Map(), // id → invoice record
  payouts:     new Map(), // id → payout record
  events:      [],        // append-only event log (mirrors webhook events)
  processedWebhookIds: new Set(), // idempotency guard for webhook events
};

function ensureDemoAdvertiser(id, extras = {}) {
  let a = DEMO.advertisers.get(id);
  if (!a) {
    a = { id, email: extras.email || `${id}@example.com`,
          balance: extras.balance != null ? extras.balance : 5000,
          company_name: extras.company_name || "Demo Co.",
          created_at: new Date().toISOString() };
    DEMO.advertisers.set(id, a);
  }
  return a;
}
function ensureDemoDeveloper(id, extras = {}) {
  let d = DEMO.developers.get(id);
  if (!d) {
    d = { id, email: extras.email || `${id}@example.com`,
          total_earnings: extras.total_earnings || 0,
          app_name: extras.app_name || "Demo App",
          stripe_account_id: extras.stripe_account_id || null,
          created_at: new Date().toISOString() };
    DEMO.developers.set(id, d);
  }
  return d;
}

// ────────────────────────────────────────────────────────────────────────
//                                HANDLER
// ────────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Restrict CORS in production to BoostBoss origins only; allow * in demo for local dev
  const allowedOrigins = HAS_STRIPE
    ? ["https://boostboss.ai", "https://www.boostboss.ai", PUBLIC_BASE_URL]
    : ["*"];
  const origin = req.headers && req.headers.origin;
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else {
    res.setHeader("Access-Control-Allow-Origin", PUBLIC_BASE_URL);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Stripe-Signature, PayPal-Transmission-Id, PayPal-Transmission-Time, PayPal-Transmission-Sig, PayPal-Cert-Url, PayPal-Auth-Algo");
  res.setHeader("x-billing-mode", HAS_STRIPE ? "stripe" : "demo");
  res.setHeader("x-payin-provider", resolvedPayinProvider());
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = (req.query && req.query.action) || (req.body && req.body.action);

  try {
    switch (action) {
      case "balance":         return await handleBalance(req, res);
      case "earnings":        return await handleEarnings(req, res);
      case "create_checkout": return await handleCreateCheckout(req, res);
      case "create_connect":  return await handleCreateConnect(req, res);
      // Phase E Day 1 — onboarding refresh + payout status read.
      // refresh_connect mints a NEW Account Link every call; do not cache.
      case "refresh_connect": return await handleRefreshConnect(req, res);
      case "payout_status":   return await handlePayoutStatus(req, res);
      // Phase E Day 3 — autonomous weekly payouts.
      // run_payout_cron is hit by Vercel cron Friday 12:00 UTC.
      // run_payout_retry_sweep is hit Saturday 12:00 UTC.
      // Both require Authorization: Bearer ${CRON_SECRET} (Vercel sends
      // automatically when cron triggers; operators can call manually too).
      case "run_payout_cron":         return await handleRunPayoutCron(req, res);
      case "run_payout_retry_sweep":  return await handleRunPayoutRetrySweep(req, res);
      // Phase E Day 4 — operator admin payouts surface. All admin
      // actions auth via Authorization: Bearer ${ADMIN_TOKEN} (separate
      // from CRON_SECRET so a leaked cron token can't drive admin ops).
      case "admin_payouts_list":      return await handleAdminPayoutsList(req, res);
      case "admin_force_retry":       return await handleAdminForceRetry(req, res);
      case "admin_unblock_publisher": return await handleAdminUnblockPublisher(req, res);
      case "admin_blocked_publishers":return await handleAdminBlockedPublishers(req, res);
      // Phase E Day 5 — E2E inventory diagnostic. Returns the count and
      // most-recent timestamp at every checkpoint of the autonomous loop.
      case "e2e_inventory":           return await handleE2EInventory(req, res);
      // Phase E Day 6 — pull a developer's Stripe account state directly
      // from Stripe and sync our flags. Used when account.updated webhook
      // doesn't propagate (Day 5 scenario).
      case "admin_sync_stripe_account": return await handleAdminSyncStripeAccount(req, res);
      // Phase F — per-door integration verification. Returns whether each
      // of the four doors (mcp, js-snippet, npm-sdk, rest-api) has fired
      // any event for this publisher in the last 24h. Powers the
      // onboarding wizard's live "Verify" check.
      case "integration_verify":      return await handleIntegrationVerify(req, res);
      case "invoice":         return await handleInvoice(req, res);
      case "payout":          return await handlePayout(req, res);
      case "history":         return await handleHistory(req, res);
      case "webhook":         return await handleWebhook(req, res);
      // ── Phase 2 — PayPal pay-in rail ───────────────────────────────
      // Frontends should switch to these once PAYIN_PROVIDER=paypal.
      // create_paypal_order returns an approval_url the dashboard
      // sends the advertiser to; capture_paypal_order is called from
      // the return URL with the order id PayPal echoes back.
      case "create_paypal_order":   return await handleCreatePaypalOrder(req, res);
      case "capture_paypal_order":  return await handleCapturePaypalOrder(req, res);
      case "paypal_order_status":   return await handlePaypalOrderStatus(req, res);
      case "paypal_refund":         return await handlePaypalRefund(req, res);
      case "paypal_webhook":        return await handlePaypalWebhook(req, res);
      case "payin_provider":        return res.json({ provider: resolvedPayinProvider(), has_stripe: HAS_STRIPE, has_paypal: HAS_PAYPAL });
      default:                return res.status(400).json({ error: "Unknown action" });
    }
  } catch (err) {
    console.error("[Billing Error]", err);
    return res.status(500).json({ error: err.message });
  }
};

// ── balance ────────────────────────────────────────────────────────────
//
// Task #152 hardening: previously trusted ?id= from the query string. Any
// signed-in user could read any other tenant's balance. Now requires a
// valid Bearer JWT and ignores any caller-supplied id — the authenticated
// user's id IS the advertiser scope. Demo-mode fallback (no Supabase)
// still uses the query id because demo data is throwaway by definition.
async function handleBalance(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const sb = supa();
  if (sb) {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const { data, error } = await sb.from("advertisers")
      .select("balance, company_name").eq("id", user.id).single();
    if (error) return res.status(404).json({ error: "Advertiser not found" });
    return res.json({ balance: Number(data.balance), company_name: data.company_name });
  }

  // Demo mode — no Supabase configured. Keep the old query-id behavior
  // so the in-process demo state still works for preview deploys.
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing advertiser id" });
  const a = ensureDemoAdvertiser(id);
  return res.json({ balance: a.balance, company_name: a.company_name });
}

// ── history ───────────────────────────────────────────────────────────
//
// Task #152 hardening: same model as handleBalance — JWT-derived
// advertiser id in production, fall back to query id only when no
// Supabase is configured (demo mode).
async function handleHistory(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const sb = supa();
  let id;
  if (sb) {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    id = user.id;
    // Attempt to read from a transactions table if it exists
    try {
      const { data, error } = await sb.from("transactions")
        .select("*").eq("advertiser_id", id).order("created_at", { ascending: false }).limit(50);
      if (!error && data) return res.json({ transactions: data });
    } catch (_) { /* table may not exist — fall through to demo */ }
  } else {
    id = req.query && req.query.id;
    if (!id) return res.status(400).json({ error: "Missing advertiser id" });
  }

  // Demo mode — build real history from ledger + track events + demo deposits
  const a = ensureDemoAdvertiser(id);
  const now = Date.now();
  const transactions = [];

  // Pull real spend from track events
  try {
    const trackEvents = require("./track.js")._DEMO_EVENTS || [];
    for (const ev of trackEvents) {
      if (ev.cost > 0) {
        // Match events to this advertiser's campaigns
        let camps;
        try { camps = require("./campaigns.js")._DEMO_CAMPAIGNS || new Map(); } catch (_) { camps = new Map(); }
        const camp = typeof camps.get === "function" ? camps.get(ev.campaign_id) : null;
        if (camp && camp.advertiser_id === id) {
          transactions.push({
            date: ev.created_at, description: `Ad spend: ${camp.name || ev.campaign_id}`,
            type: "spend", amount: -ev.cost, status: "settled",
          });
        }
      }
    }
  } catch (_) {}

  // Add seeded history if no real events exist
  if (transactions.length === 0) {
    transactions.push(
      { date: new Date(now - 86400000).toISOString(), description: "Campaign spend", type: "spend", amount: -42.18, status: "settled" },
      { date: new Date(now - 86400000 * 2).toISOString(), description: "Campaign spend", type: "spend", amount: -28.50, status: "settled" },
    );
  }

  // Always show a recent deposit
  transactions.push({
    date: new Date(now - 86400000 * 3).toISOString(), description: "Deposit via Stripe",
    type: "deposit", amount: 500.00, status: "completed",
  });

  // Sort descending and add running balance
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  let bal = a.balance;
  for (const tx of transactions) {
    tx.balance = +bal.toFixed(2);
    bal -= tx.amount; // reverse the transaction to compute prior balance
  }

  return res.json({ transactions });
}

// ── earnings ───────────────────────────────────────────────────────────
async function handleEarnings(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: "Missing developer api key" });

  const sb = supa();
  if (sb) {
    const { data: dev } = await sb.from("developers")
      .select("id, total_earnings, app_name, revenue_share_pct")
      .eq("api_key", key).single();
    if (!dev) return res.status(404).json({ error: "Developer not found" });
    const { data: pending } = await sb.from("events")
      .select("developer_payout").eq("developer_id", dev.id).gt("developer_payout", 0);
    const pendingTotal = (pending || []).reduce((s, e) => { const v = parseFloat(e.developer_payout || 0); return s + (Number.isFinite(v) ? v : 0); }, 0);
    return res.json({
      app_name: dev.app_name, total_earnings: dev.total_earnings,
      pending_payout: pendingTotal.toFixed(2),
      revenue_share_pct: dev.revenue_share_pct,
      payout_threshold: MIN_PAYOUT_USD, next_payout_date: nextPayoutDate(),
    });
  }
  // Demo path: derive earnings from ledger + track events so numbers are real
  const dev = ensureDemoDeveloper(key, { app_name: "My AI App" });
  // Sum developer_payout from in-memory track events
  let pendingPayout = 0;
  try {
    const trackEvents = require("./track.js")._DEMO_EVENTS || [];
    for (const ev of trackEvents) {
      if (ev.developer_id === key && ev.developer_payout > 0) {
        pendingPayout += ev.developer_payout;
      }
    }
  } catch (_) {}
  // Also check ledger wins attributed to this developer
  try {
    const dump = ledger._dump();
    for (const bid of dump.bids) {
      if (bid.status === "won" && bid.developer_id === key) {
        pendingPayout += (Number(bid.won_price_cpm) || 0) / 1000 * (1 - TAKE_RATE);
      }
    }
  } catch (_) {}
  const totalEarnings = dev.total_earnings + pendingPayout;
  return res.json({
    app_name: dev.app_name, total_earnings: totalEarnings.toFixed(2),
    pending_payout: pendingPayout.toFixed(2), revenue_share_pct: (1 - TAKE_RATE) * 100,
    payout_threshold: MIN_PAYOUT_USD, next_payout_date: nextPayoutDate(),
  });
}

// ── advertiser deposit (Stripe Checkout) ───────────────────────────────
async function handleCreateCheckout(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { advertiser_id, amount, email } = req.body || {};
  if (!advertiser_id || !amount) return res.status(400).json({ error: "Missing advertiser_id or amount" });
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 10) return res.status(400).json({ error: "Minimum deposit is $10" });
  if (parsedAmount > 100000) return res.status(400).json({ error: "Maximum single deposit is $100,000" });

  const s = stripe();
  if (!s) {
    // Demo mode — credit the balance immediately so the dashboard reflects the deposit
    const a = ensureDemoAdvertiser(advertiser_id, { email });
    a.balance += Number(amount);
    return res.json({
      mode: "demo", checkout_url: null,
      message: "Demo mode — balance credited locally; no real charge.",
      balance: a.balance, deposited: Number(amount),
    });
  }

  const session = await s.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: "Boost Boss Ad Credits",
          description: `$${amount} deposit to your Boost Boss ad account`,
        },
        unit_amount: Math.round(Number(amount) * 100),
      },
      quantity: 1,
    }],
    mode: "payment",
    success_url: `${PUBLIC_BASE_URL}/advertiser?deposit=success&amount=${amount}`,
    cancel_url:  `${PUBLIC_BASE_URL}/advertiser?deposit=cancelled`,
    customer_email: email,
    metadata: { advertiser_id, amount: String(amount) },
  });
  return res.json({ mode: "stripe", checkout_url: session.url, session_id: session.id });
}

// ────────────────────────────────────────────────────────────────────
// ── Phase 2 — PayPal pay-in ─────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────
//
// Three-step flow that mirrors the Stripe Checkout pattern but routes
// money through PayPal instead:
//
//   1. create_paypal_order  → backend creates a PayPal order, returns
//                              the approval URL. Frontend redirects.
//   2. (user approves on PayPal)
//   3. capture_paypal_order → return URL hits this with the order id,
//                              backend captures the funds and credits
//                              the advertiser balance.
//
// paypal_webhook acts as the durable confirmation channel for
// asynchronous capture/refund events so an interrupted return-URL
// hop never leaves money in an unaccounted state.

const PAYPAL_MIN_DEPOSIT_USD = 10;
const PAYPAL_MAX_DEPOSIT_USD = 100000;

async function handleCreatePaypalOrder(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { advertiser_id, amount, email } = req.body || {};
  if (!advertiser_id || amount == null) {
    return res.status(400).json({ error: "Missing advertiser_id or amount" });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < PAYPAL_MIN_DEPOSIT_USD) {
    return res.status(400).json({ error: `Minimum deposit is $${PAYPAL_MIN_DEPOSIT_USD}` });
  }
  if (parsedAmount > PAYPAL_MAX_DEPOSIT_USD) {
    return res.status(400).json({ error: `Maximum single deposit is $${PAYPAL_MAX_DEPOSIT_USD}` });
  }

  // Always ensure the demo advertiser record exists so the capture step
  // can find it even when running against the in-memory ledger.
  if (!HAS_SUPABASE) ensureDemoAdvertiser(advertiser_id, { email });

  let order;
  try {
    order = await paypal.createOrder({
      advertiserId: advertiser_id,
      amountUsd:    parsedAmount,
      email,
      returnUrl:    `${PUBLIC_BASE_URL}/advertiser?deposit=paypal_return&advertiser_id=${encodeURIComponent(advertiser_id)}&amount=${parsedAmount}`,
      cancelUrl:    `${PUBLIC_BASE_URL}/advertiser?deposit=cancelled`,
      // PayPal-Request-Id idempotency: tie to advertiser + amount + minute
      // so a double-click within the same minute returns the same order.
      requestId:    `bb_payin_${advertiser_id}_${Math.round(parsedAmount * 100)}_${Math.floor(Date.now() / 60000)}`,
    });
  } catch (err) {
    console.error("[Billing] paypal createOrder failed:", err.message, err.detail || "");
    return res.status(502).json({ error: "paypal_create_failed", detail: err.message });
  }

  // Stamp a pending transaction so we can correlate the capture later.
  const sb = supa();
  if (sb && order.mode === "paypal") {
    try {
      await sb.from("transactions").insert({
        advertiser_id, type: "deposit",
        amount: parsedAmount,
        description: "PayPal deposit (pending capture)",
        paypal_order_id: order.order_id,
        provider:        "paypal",
        status:          "pending",
      });
    } catch (_) { /* transactions table may lack new columns yet — surface in webhook */ }
  }

  return res.json({
    mode:         order.mode,
    provider:     "paypal",
    order_id:     order.order_id,
    approval_url: order.approval_url,
    amount:       parsedAmount,
  });
}

async function handleCapturePaypalOrder(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const orderId =
    (req.body && req.body.order_id) ||
    (req.query && req.query.order_id) ||
    (req.query && req.query.token); // PayPal sends `token=<orderId>` on return
  if (!orderId) return res.status(400).json({ error: "Missing order_id" });
  const expectedAdvertiserId = (req.body && req.body.advertiser_id) || (req.query && req.query.advertiser_id) || null;
  const expectedAmount       = Number((req.body && req.body.amount) || (req.query && req.query.amount) || 0) || undefined;

  let capture;
  try {
    capture = await paypal.captureOrder(orderId, {
      expectedAmountUsd: expectedAmount,
      requestId:         `bb_capture_${orderId}`,
    });
  } catch (err) {
    console.error("[Billing] paypal captureOrder failed:", err.message, err.detail || "");
    return res.status(502).json({ error: "paypal_capture_failed", detail: err.message });
  }

  // PayPal sometimes returns 200 with status=COMPLETED but no capture id
  // when the order has already been captured (e.g. webhook beat us). In
  // that case it's safe to no-op: the webhook handler will / has done
  // the bookkeeping.
  if (capture.status !== "COMPLETED") {
    return res.status(200).json({
      mode:        capture.mode,
      order_id:    capture.order_id,
      status:      capture.status,
      credited:    false,
      message:     "Order not in COMPLETED state; webhook will reconcile.",
    });
  }

  // Resolve which advertiser to credit. The order's custom_id is the
  // authoritative source (we set it at createOrder time). Fall back to
  // the body for demo mode where the PayPal response is synthetic.
  const customId = ((capture.raw && capture.raw.purchase_units) || []).map((pu) => pu.custom_id).find(Boolean);
  const advertiserId = customId || expectedAdvertiserId;
  if (!advertiserId) {
    console.error("[Billing] paypal capture missing custom_id and no advertiser_id provided");
    return res.status(400).json({ error: "cannot_resolve_advertiser" });
  }
  const amountUsd = capture.amount_usd || expectedAmount || 0;

  // Webhook-authoritative bookkeeping (Task #147, fixed 2026-06-18).
  //
  // We deliberately do NOT credit the advertiser balance here in
  // production. PayPal's PAYMENT.CAPTURE.COMPLETED webhook is the single
  // source of truth: durable (PayPal retries on delivery failure),
  // idempotent (event.id de-dup at line 2400-2407), and matches how the
  // Stripe path works. The return-URL hop you're handling here is
  // fragile (browser refresh, network blip, tab close); duplicating the
  // credit logic between this path and the webhook caused a double-credit
  // bug where every advertiser deposit was credited twice.
  //
  // Demo mode (in-memory ledger, no Supabase) still credits here so the
  // local development flow stays usable without webhook delivery.
  let credited = false;
  if (!HAS_SUPABASE) {
    credited = await creditAdvertiserForPayinEvent({
      provider:           "paypal",
      advertiserId,
      amountUsd,
      externalEventId:    capture.capture_id || capture.order_id,
      paypalOrderId:      capture.order_id,
      paypalCaptureId:    capture.capture_id,
      payerEmail:         capture.payer_email,
      description:        "PayPal deposit",
    });
  }

  return res.json({
    mode:        capture.mode,
    order_id:    capture.order_id,
    capture_id:  capture.capture_id,
    status:      capture.status,
    amount_usd:  amountUsd,
    advertiser_id: advertiserId,
    credited,
    // In production (HAS_SUPABASE), credited=false means "PayPal captured
    // the funds, webhook is about to credit the balance." The frontend
    // should briefly poll /api/billing?action=balance after a successful
    // capture; the webhook normally lands within 1-2s.
    webhook_authoritative: HAS_SUPABASE,
  });
}

async function handlePaypalOrderStatus(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const orderId = req.query && req.query.order_id;
  if (!orderId) return res.status(400).json({ error: "Missing order_id" });
  try {
    const order = await paypal.getOrder(orderId);
    return res.json(order);
  } catch (err) {
    return res.status(502).json({ error: "paypal_status_failed", detail: err.message });
  }
}

async function handlePaypalRefund(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  // Admin-only refund — same Authorization pattern the admin payouts
  // routes use. ADMIN_TOKEN is separate from CRON_SECRET so a leaked
  // cron token can't trigger refunds.
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken) {
    const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (!auth || auth !== `Bearer ${adminToken}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }
  const { capture_id, amount, note } = req.body || {};
  if (!capture_id) return res.status(400).json({ error: "Missing capture_id" });

  try {
    const refund = await paypal.refundCapture(capture_id, {
      amountUsd: amount == null ? undefined : Number(amount),
      note,
      requestId: `bb_refund_${capture_id}_${Math.floor(Date.now() / 60000)}`,
    });
    // We deliberately do NOT debit the advertiser balance here; the
    // PAYMENT.CAPTURE.REFUNDED webhook is the authoritative debit
    // signal (matches how Stripe refunds are handled).
    return res.json(refund);
  } catch (err) {
    return res.status(502).json({ error: "paypal_refund_failed", detail: err.message });
  }
}

// ── Shared advertiser credit path (provider-agnostic) ─────────────────
// Both the Stripe checkout webhook and the PayPal capture flow funnel
// here so the bookkeeping is identical no matter which rail brought the
// money in. Returns true if the balance was actually credited (vs. a
// duplicate that was deduped).
async function creditAdvertiserForPayinEvent({
  provider, advertiserId, amountUsd,
  externalEventId, paypalOrderId, paypalCaptureId,
  payerEmail, description,
}) {
  if (!advertiserId || !Number.isFinite(Number(amountUsd)) || Number(amountUsd) <= 0) return false;
  const amount = Number(amountUsd);

  const sb = supa();
  if (sb) {
    // Idempotency: look for an existing transaction with the same
    // external event id (capture_id for PayPal, session.id for Stripe)
    // before crediting.
    if (externalEventId) {
      try {
        const { data: existing } = await sb.from("transactions")
          .select("id, status")
          .or(`paypal_capture_id.eq.${externalEventId},stripe_session_id.eq.${externalEventId}`)
          .limit(1);
        if (existing && existing.length > 0 && existing[0].status === "completed") {
          return false;
        }
      } catch (_) { /* transactions schema may not have these columns yet */ }
    }

    // Atomic balance increment via the shared RPC, with fallback for
    // older deploys that don't have it.
    const { error: rpcErr } = await sb.rpc("bbx_credit_advertiser_balance", {
      p_advertiser_id: advertiserId,
      p_amount_usd:    amount,
    });
    if (rpcErr && rpcErr.message && rpcErr.message.includes("does not exist")) {
      try {
        const { data: adv } = await sb.from("advertisers").select("balance").eq("id", advertiserId).single();
        if (adv) {
          await sb.from("advertisers")
            .update({ balance: (parseFloat(adv.balance) || 0) + amount })
            .eq("id", advertiserId);
        }
      } catch (e) {
        console.error("[Billing] advertiser balance fallback failed:", e.message);
      }
    } else if (rpcErr) {
      console.error("[Billing] advertiser RPC credit failed:", rpcErr.message);
    }

    try {
      const row = {
        advertiser_id: advertiserId,
        type:          "deposit",
        amount,
        description:   description || `${provider} deposit`,
        provider,
        status:        "completed",
      };
      if (paypalOrderId)   row.paypal_order_id   = paypalOrderId;
      if (paypalCaptureId) row.paypal_capture_id = paypalCaptureId;
      if (payerEmail)      row.payer_email       = payerEmail;

      // Try to update the pending row that createPaypalOrder stamped at
      // order-create time. The pending row has paypal_order_id set but
      // paypal_capture_id=NULL — so an onConflict upsert on
      // paypal_capture_id never matches it, which would leave an orphan
      // "pending" row behind and (combined with the pre-fix capture-
      // handler credit) cause the original double-credit bug.
      let updated = false;
      if (paypalOrderId) {
        try {
          const { data: updatedRows } = await sb.from("transactions")
            .update({
              status:            "completed",
              description:       row.description,
              paypal_capture_id: paypalCaptureId || null,
              ...(payerEmail ? { payer_email: payerEmail } : {}),
            })
            .eq("paypal_order_id", paypalOrderId)
            .eq("status",          "pending")
            .select("id");
          updated = !!(updatedRows && updatedRows.length > 0);
        } catch (_) { /* column may not exist on older schemas */ }
      }

      if (!updated) {
        // No pending row to update (e.g. webhook arrived before the
        // pending stamp landed, or the row was stamped without
        // paypal_order_id). Fall back to upsert.
        await sb.from("transactions").upsert(row, { onConflict: "paypal_capture_id" });
      }
    } catch (_) { /* if schema lacks columns the row is best-effort */ }

    // Phase 4: send the branded "Deposit successful" email. Best-effort,
    // fire-and-forget — never block crediting on email. Failures are logged
    // by the emails module but don't propagate. We fetch the post-credit
    // balance + advertiser email here so the email shows the user what
    // their new spendable amount is.
    try {
      const { data: adv } = await sb.from("advertisers")
        .select("email, balance, company_name")
        .eq("id", advertiserId)
        .maybeSingle();
      if (adv && adv.email) {
        const { sendDepositSuccess } = require("./_lib/emails/send");
        // Don't await — we want the HTTP response to return immediately
        // and the email to send in the background.
        sendDepositSuccess({
          to:              adv.email,
          amountUsd:       amount,
          balanceAfterUsd: Number(adv.balance) || amount,
          companyName:     adv.company_name || null,
        }).catch((e) => console.error("[Billing] sendDepositSuccess threw:", e.message));
      }
    } catch (e) {
      console.warn("[Billing] could not send deposit-success email:", e.message);
    }

    return true;
  }

  // Demo mode: idempotency via the same processed-webhook set the
  // Stripe path uses, so retries don't double-credit.
  if (externalEventId && DEMO.processedWebhookIds.has(`payin:${externalEventId}`)) {
    return false;
  }
  if (externalEventId) DEMO.processedWebhookIds.add(`payin:${externalEventId}`);
  const a = ensureDemoAdvertiser(advertiserId, { email: payerEmail });
  a.balance = (Number(a.balance) || 0) + amount;
  DEMO.events.push({ at: new Date().toISOString(), type: `${provider}.deposit.captured`, advertiser_id: advertiserId, amount });
  return true;
}

// ── publisher Stripe Connect onboarding ────────────────────────────────
async function handleCreateConnect(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { developer_id, email } = req.body || {};
  if (!developer_id) return res.status(400).json({ error: "Missing developer_id" });

  const s = stripe();
  if (!s) {
    const d = ensureDemoDeveloper(developer_id, { email });
    d.stripe_account_id = "acct_demo_" + developer_id.slice(-6);
    return res.json({
      mode: "demo", onboarding_url: null,
      message: "Demo mode — no real Stripe account created.",
      stripe_account_id: d.stripe_account_id,
    });
  }

  const account = await s.accounts.create({
    type: "express", email,
    capabilities: { transfers: { requested: true } },
    metadata: { developer_id },
  });
  const link = await s.accountLinks.create({
    account: account.id,
    refresh_url: `${PUBLIC_BASE_URL}/developer?stripe=refresh`,
    return_url:  `${PUBLIC_BASE_URL}/developer?stripe=connected`,
    type: "account_onboarding",
  });
  // Persist the account id
  const sb = supa();
  if (sb) await sb.from("developers").update({ stripe_account_id: account.id }).eq("id", developer_id);
  return res.json({ mode: "stripe", onboarding_url: link.url, stripe_account_id: account.id });
}

// ── Phase E Day 1 — refresh Stripe Connect onboarding link ─────────────
// Per HARD-3 in the design doc: Stripe Account Links expire after ~5 min
// and are single-use. The dashboard's "Action Required" banner must call
// THIS endpoint on every click — never store the URL.
async function handleRefreshConnect(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { developer_id } = req.body || {};
  if (!developer_id) return res.status(400).json({ error: "Missing developer_id" });

  const s = stripe();
  if (!s) {
    return res.json({
      mode: "demo", onboarding_url: null,
      message: "Demo mode — no Stripe account to refresh.",
    });
  }

  // Look up the publisher's stripe_account_id. If they don't have one yet,
  // the caller should hit create_connect first — refresh is for re-onboarding
  // existing accounts that hit a requirements wall.
  const sb = supa();
  let stripeAccountId = null;
  if (sb) {
    const { data: dev } = await sb.from("developers")
      .select("stripe_account_id").eq("id", developer_id).single();
    stripeAccountId = dev && dev.stripe_account_id;
  } else {
    const d = DEMO.developers.get(developer_id);
    stripeAccountId = d && d.stripe_account_id;
  }
  if (!stripeAccountId) {
    return res.status(404).json({
      error: "No Stripe Connect account on file. Call create_connect first.",
    });
  }

  const link = await s.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${PUBLIC_BASE_URL}/developer?stripe=refresh`,
    return_url:  `${PUBLIC_BASE_URL}/developer?stripe=connected`,
    type: "account_onboarding",
  });
  return res.json({
    mode: "stripe", onboarding_url: link.url,
    stripe_account_id: stripeAccountId,
  });
}

// ── Phase E Day 1 — read publisher payout status ───────────────────────
// Surfaces the state the dashboard needs to render the Earnings section:
// connected/blocked flags, current balance, requirements_due, next payout
// hint. One query, one round-trip.
async function handlePayoutStatus(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const sb = supa();
  if (!sb) {
    // Demo mode — no Supabase configured. Keep the old query-id behavior
    // so the in-process demo state still works for preview deploys.
    const developerId = req.query && (req.query.developer_id || req.query.id);
    if (!developerId) return res.status(400).json({ error: "Missing developer_id" });
    const d = DEMO.developers.get(developerId) || ensureDemoDeveloper(developerId);
    return res.json({
      mode: "demo",
      developer_id: developerId,
      stripe_account_id: d.stripe_account_id || null,
      payouts_enabled: !!d.stripe_account_id,
      payout_blocked: false,
      payout_blocked_reason: null,
      instant_payouts_enabled: false,
      stripe_requirements_due: [],
      balance: 0,
      lifetime_earned: d.total_earnings || 0,
      lifetime_paid: 0,
      next_payout_eta: null,
    });
  }

  // Task #152 hardening: previously trusted ?developer_id= from the query
  // string. Any signed-in user could read any other publisher's balance
  // and payout state. Now requires a valid Bearer JWT and ignores any
  // caller-supplied id — the authenticated user's id IS the developer
  // scope.
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const developerId = user.id;

  const { data: dev } = await sb.from("developers")
    .select("id, stripe_account_id, payouts_enabled, payout_blocked, payout_blocked_reason, payout_blocked_at, instant_payouts_enabled, stripe_requirements_due")
    .eq("id", developerId).single();
  if (!dev) return res.status(404).json({ error: "Publisher not found" });

  // publisher_balance may not exist for legacy rows that predate migration 12.
  // Don't 500; just return zeros and let the dashboard message accordingly.
  // Column is developer_id per migration 12 (matches existing schema convention).
  let bal = { balance: 0, lifetime_earned: 0, lifetime_paid: 0 };
  try {
    const { data: b } = await sb.from("publisher_balance")
      .select("balance, lifetime_earned, lifetime_paid")
      .eq("developer_id", developerId).maybeSingle();
    if (b) bal = b;
  } catch (_) {}

  // Next payout hint: Friday-at-12-UTC if eligible, else "when balance reaches $25"
  // (Decision 2 + Decision 3 of the design doc). If blocked, override with that.
  let nextPayoutEta = null;
  if (dev.payout_blocked) {
    nextPayoutEta = "blocked";
  } else if (!dev.payouts_enabled || !dev.stripe_account_id) {
    nextPayoutEta = "setup_required";
  } else if ((parseFloat(bal.balance) || 0) < 25) {
    nextPayoutEta = "threshold_pending";
  } else {
    // Find the next Friday 12:00 UTC
    const now = new Date();
    const nextFriday = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0,
    ));
    const dow = nextFriday.getUTCDay();
    const days = (5 - dow + 7) % 7 || 7;
    nextFriday.setUTCDate(nextFriday.getUTCDate() + days);
    nextPayoutEta = nextFriday.toISOString();
  }

  return res.json({
    mode: "stripe",
    developer_id: developerId,
    stripe_account_id: dev.stripe_account_id,
    payouts_enabled: !!dev.payouts_enabled,
    payout_blocked: !!dev.payout_blocked,
    payout_blocked_reason: dev.payout_blocked_reason,
    payout_blocked_at: dev.payout_blocked_at,
    instant_payouts_enabled: !!dev.instant_payouts_enabled,
    stripe_requirements_due: dev.stripe_requirements_due || [],
    balance: parseFloat(bal.balance) || 0,
    lifetime_earned: parseFloat(bal.lifetime_earned) || 0,
    lifetime_paid: parseFloat(bal.lifetime_paid) || 0,
    next_payout_eta: nextPayoutEta,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Phase E Day 3 — autonomous weekly payout cron.
//
// Friday 12:00 UTC primary: handleRunPayoutCron
//   Queries every developer where:
//     payouts_enabled = true
//     payout_blocked  = false
//     stripe_account_id IS NOT NULL
//     publisher_balance.balance >= MIN_PAYOUT_USD ($25 per Decision 3)
//   For each, fires stripe.transfers.create() to their Connect account.
//   - On success: debit balance via bbx_decrement_publisher_balance,
//     mark payouts row status='paid'
//   - On Tier-1 (network / timeout / transient): leave payouts row at
//     'pending' for Saturday sweep
//   - On Tier-2 (Stripe rejected — bank closed, account suspended):
//     set developers.payout_blocked=true with reason; payouts row
//     status='failed' failure_tier=2
//
// Saturday 12:00 UTC retry sweep: handleRunPayoutRetrySweep
//   Re-attempts any payouts row where status='pending' AND
//   failure_tier IS NULL AND retry_count < 3 from the last 7 days.
//
// Auth: both require Authorization: Bearer ${CRON_SECRET} when in
// Supabase mode. Vercel cron sends this header automatically; operators
// can call manually with the env value. Demo mode skips auth so
// hermetic tests can exercise the full state machine.
// ═══════════════════════════════════════════════════════════════════════

const MIN_PAYOUT_USD_E   = 25;   // Decision 3
const PAYOUT_FEE_FLAT    = 0.25;
const PAYOUT_FEE_RATE    = 0.0025;
const INSTANT_FEE_FLAT   = 0.50;
const INSTANT_FEE_RATE   = 0.015;
const MAX_RETRIES        = 3;
const TIER3_FAILURE_PCT  = 0.20; // >20% failures in a run → operator alert

function isCronAuthorized(req) {
  // Demo mode skips auth so tests can exercise the cron path.
  if (!HAS_SUPABASE) return true;
  const expected = process.env.CRON_SECRET || "";
  if (!expected) {
    // No secret configured — refuse rather than silently allow.
    return false;
  }
  const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  return auth === `Bearer ${expected}`;
}

function computePayoutFee(balance, method) {
  // Standard ACH: BB absorbs. Instant: publisher pays (deducted before transfer).
  if (method === "instant") {
    return +(INSTANT_FEE_FLAT + balance * INSTANT_FEE_RATE).toFixed(4);
  }
  return 0;
}

// Phase E Day 6 — detect the platform's available-balance currency so
// stripe.transfers.create() doesn't reject with "insufficient available
// funds" on non-USD platform accounts.
//
// Decision 4 of the design doc says "USD only at launch" — but that's a
// requirement on the platform Stripe account itself (i.e. set the
// platform region to US during onboarding), NOT a hardcode in our code.
// Hardcoding made the Day 5 sandbox (which happened to be SGD-based)
// fail every transfer. Reading the platform's currency at runtime keeps
// us correct across any platform region.
//
// Cached for 5 min — platform currency changes essentially never.
let _platformCurrencyCache = { value: null, fetchedAt: 0 };
async function getPlatformCurrency(s, fallback = "usd") {
  if (!s) return fallback;
  const now = Date.now();
  if (_platformCurrencyCache.value && (now - _platformCurrencyCache.fetchedAt) < 5 * 60 * 1000) {
    return _platformCurrencyCache.value;
  }
  try {
    const bal = await s.balance.retrieve();
    const cur = (bal.available && bal.available[0] && bal.available[0].currency) ||
                (bal.pending && bal.pending[0] && bal.pending[0].currency) ||
                fallback;
    _platformCurrencyCache = { value: cur, fetchedAt: now };
    return cur;
  } catch (e) {
    console.error("bbx:platform_currency:retrieve_fail",
      JSON.stringify({ message: e && e.message }));
    return fallback;
  }
}
// Exported for tests.
module.exports._getPlatformCurrency = getPlatformCurrency;
module.exports._resetPlatformCurrencyCache = function () {
  _platformCurrencyCache = { value: null, fetchedAt: 0 };
};

async function handleRunPayoutCron(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!isCronAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const sb = supa();
  const s  = stripe();
  const runId  = "cron_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const tStart = Date.now();
  const summary = {
    run_id: runId,
    started_at: new Date().toISOString(),
    publishers_attempted: 0,
    succeeded:    0,
    tier1_failed: 0,
    tier2_failed: 0,
    skipped:      0,
    total_usd:    0,
    failures:     [],
  };

  // ── Demo path ──────────────────────────────────────────────────────
  // Walks the in-memory developer + balance maps, simulates a successful
  // transfer for any eligible publisher. Exercises the full state
  // transition (decrement balance, mark payouts row paid).
  if (!sb || !s) {
    for (const [devId, d] of DEMO.developers) {
      if (d.payout_blocked || !d.payouts_enabled || !d.stripe_account_id) {
        summary.skipped++;
        continue;
      }
      const bal = publisherBalance._getDemoBalance(devId);
      if (!bal || bal.balance < MIN_PAYOUT_USD_E) { summary.skipped++; continue; }
      summary.publishers_attempted++;
      const method = d.instant_payouts_enabled ? "instant" : "standard";
      const fee    = computePayoutFee(bal.balance, method);
      const amount = +(bal.balance - fee).toFixed(2);
      const deducted = await publisherBalance.debitPublisherBalance(null, devId, bal.balance);
      // Record the simulated payout row in DEMO.payouts
      DEMO.payouts.set(runId + "_" + devId, {
        id: runId + "_" + devId, developer_id: devId,
        amount: amount, fee_usd: fee, method,
        status: "paid", stripe_transfer_id: "tr_demo_" + Math.random().toString(36).slice(2, 10),
        created_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      });
      summary.succeeded++;
      summary.total_usd += deducted;
    }
    summary.completed_at = new Date().toISOString();
    summary.duration_ms  = Date.now() - tStart;
    summary.mode = "demo";
    console.log("bbx:payout_cron:ok", JSON.stringify(summary));
    return res.json(summary);
  }

  // ── Supabase path ──────────────────────────────────────────────────
  // Eligible publishers: developers join publisher_balance, filtered.
  // Two queries because supabase-js doesn't expose SQL joins cleanly.
  let devs = [];
  try {
    const { data, error } = await sb.from("developers")
      .select("id, email, stripe_account_id, payouts_enabled, payout_blocked, instant_payouts_enabled")
      .eq("payouts_enabled", true)
      .eq("payout_blocked",  false)
      .not("stripe_account_id", "is", null);
    if (error) throw error;
    devs = data || [];
  } catch (e) {
    console.error("bbx:payout_cron:devs_query_fail", JSON.stringify({ message: e && e.message }));
    return res.status(500).json({ error: "developers query failed", message: e && e.message });
  }

  // Pull every balance row for these developers in one query.
  const devIds = devs.map((d) => d.id);
  if (devIds.length === 0) {
    summary.completed_at = new Date().toISOString();
    summary.duration_ms  = Date.now() - tStart;
    summary.mode = "stripe";
    console.log("bbx:payout_cron:no_eligible", JSON.stringify(summary));
    return res.json(summary);
  }
  let balances = [];
  try {
    const { data } = await sb.from("publisher_balance")
      .select("developer_id, balance")
      .in("developer_id", devIds)
      .gte("balance", MIN_PAYOUT_USD_E);
    balances = data || [];
  } catch (e) {
    console.error("bbx:payout_cron:balance_query_fail", JSON.stringify({ message: e && e.message }));
    return res.status(500).json({ error: "balance query failed", message: e && e.message });
  }
  const balByDev = new Map(balances.map((b) => [b.developer_id, parseFloat(b.balance) || 0]));

  // Detect the platform's currency once per cron run. See getPlatformCurrency()
  // above for why we don't hardcode "usd". Even on a USD platform this is
  // a single cached call, so the overhead is one Stripe API hit per week.
  const platformCurrency = await getPlatformCurrency(s);
  summary.platform_currency = platformCurrency;

  // Loop and fire transfers.
  for (const dev of devs) {
    const balance = balByDev.get(dev.id);
    if (!balance || balance < MIN_PAYOUT_USD_E) { summary.skipped++; continue; }
    summary.publishers_attempted++;

    const method   = dev.instant_payouts_enabled ? "instant" : "standard";
    const fee      = computePayoutFee(balance, method);
    const transferAmount = +(balance - fee).toFixed(2);
    const amountCents    = Math.round(transferAmount * 100);

    // Insert payouts row at status='pending' BEFORE firing the transfer
    // so we have an audit row even if the Stripe call hangs / crashes.
    let payoutRowId = null;
    try {
      const { data: inserted } = await sb.from("payouts").insert({
        developer_id: dev.id,
        amount:       transferAmount,
        fee_usd:      fee,
        status:       "pending",
        method,
        retry_count:  0,
        period_start: new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10),
        period_end:   new Date().toISOString().slice(0, 10),
        created_at:   new Date().toISOString(),
      }).select("id").single();
      payoutRowId = inserted && inserted.id;
    } catch (e) {
      console.error("bbx:payout_cron:row_insert_fail",
        JSON.stringify({ developer_id: dev.id, message: e && e.message }));
      // Skip this publisher — we couldn't record the attempt safely.
      continue;
    }

    // Fire the transfer.
    let transferId = null;
    let stripeErr  = null;
    try {
      const tr = await s.transfers.create({
        amount: amountCents,
        currency: platformCurrency,        // Day 6 fix: dynamic, not hardcoded "usd"
        destination: dev.stripe_account_id,
        metadata: {
          developer_id: dev.id,
          run_id:       runId,
          method,
        },
      });
      transferId = tr.id;
    } catch (e) {
      stripeErr = e;
    }

    if (transferId) {
      // ── Success path: debit balance, mark paid ──
      const deducted = await publisherBalance.debitPublisherBalance(sb, dev.id, balance);
      try {
        await sb.from("payouts").update({
          status: "paid",
          stripe_transfer_id: transferId,
          completed_at: new Date().toISOString(),
        }).eq("id", payoutRowId);
      } catch (_) { /* non-fatal — transfer already happened */ }
      summary.succeeded++;
      summary.total_usd += deducted;
      console.log("bbx:payout_cron:transfer_ok", JSON.stringify({
        developer_id: dev.id, transfer_id: transferId,
        amount: transferAmount, method, run_id: runId,
      }));
      continue;
    }

    // ── Failure: classify Tier-1 vs Tier-2 ──
    const errMsg  = (stripeErr && stripeErr.message) || "unknown_error";
    const errType = stripeErr && stripeErr.type;
    const errCode = stripeErr && stripeErr.code;
    // Tier-2 (publisher-action-required): Stripe-rejected reasons.
    // The full list grows over time; we cast a wide net for safety.
    const tier2Reasons = [
      "account_invalid", "balance_insufficient", "bank_account_unverified",
      "destination_account_disabled", "insufficient_capabilities_for_transfer",
      "invalid_request_error",
    ];
    const isTier2 = (errType === "StripeInvalidRequestError") ||
                    (errCode && tier2Reasons.includes(errCode));

    if (isTier2) {
      // Mark publisher blocked; the dashboard will surface the resolve flow.
      try {
        await sb.from("developers").update({
          payout_blocked: true,
          payout_blocked_reason: "stripe_transfer_rejected: " + (errCode || errType || errMsg).toString().slice(0, 200),
          payout_blocked_at: new Date().toISOString(),
        }).eq("id", dev.id);
        await sb.from("payouts").update({
          status: "failed", failure_tier: 2,
          failure_reason: errMsg.slice(0, 500),
          completed_at: new Date().toISOString(),
        }).eq("id", payoutRowId);
      } catch (_) { /* non-fatal */ }
      summary.tier2_failed++;
      summary.failures.push({ developer_id: dev.id, tier: 2, error: errMsg });
    } else {
      // Tier-1: leave row at pending, increment retry_count, Saturday will retry.
      try {
        await sb.from("payouts").update({
          retry_count:    1,
          failure_reason: errMsg.slice(0, 500),
        }).eq("id", payoutRowId);
      } catch (_) {}
      summary.tier1_failed++;
      summary.failures.push({ developer_id: dev.id, tier: 1, error: errMsg });
    }
  }

  // ── Tier-3 check: >20% failed in this run → operator alert ──
  if (summary.publishers_attempted > 0) {
    const failPct = (summary.tier1_failed + summary.tier2_failed) / summary.publishers_attempted;
    if (failPct > TIER3_FAILURE_PCT) {
      console.error("bbx:payout_cron:tier3_alert", JSON.stringify({
        tag: "payout_cron.tier3", run_id: runId,
        publishers_attempted: summary.publishers_attempted,
        failure_pct: +(failPct * 100).toFixed(1),
        summary,
      }));
      summary.tier3_alert = true;
    }
  }

  summary.completed_at = new Date().toISOString();
  summary.duration_ms  = Date.now() - tStart;
  summary.mode = "stripe";
  console.log("bbx:payout_cron:done", JSON.stringify(summary));
  return res.json(summary);
}

// ── Saturday retry sweep ─────────────────────────────────────────────
// Re-attempts payouts rows where status='pending' AND failure_tier IS NULL
// AND retry_count < MAX_RETRIES from the last 7 days. Same Tier-1/Tier-2
// classification as the primary cron. Caps retry_count at MAX_RETRIES; on
// the third consecutive failure, marks the row as failed Tier-1 and alerts.
async function handleRunPayoutRetrySweep(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!isCronAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const sb = supa();
  const s  = stripe();
  const runId  = "retry_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const summary = {
    run_id: runId,
    started_at: new Date().toISOString(),
    retried:    0,
    succeeded:  0,
    still_pending: 0,
    final_failed: 0,
    tier2_failed: 0,
  };

  // Demo mode: nothing pending to retry (cron records 'paid' immediately).
  if (!sb || !s) {
    summary.mode = "demo";
    summary.completed_at = new Date().toISOString();
    return res.json(summary);
  }

  const sinceIso = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  let pending = [];
  try {
    const { data } = await sb.from("payouts")
      .select("id, developer_id, amount, fee_usd, method, retry_count, created_at")
      .eq("status", "pending")
      .is("failure_tier", null)
      .lt("retry_count", MAX_RETRIES)
      .gte("created_at", sinceIso);
    pending = data || [];
  } catch (e) {
    console.error("bbx:payout_retry:query_fail", JSON.stringify({ message: e && e.message }));
    return res.status(500).json({ error: "pending query failed", message: e && e.message });
  }

  for (const p of pending) {
    summary.retried++;
    // Re-look-up the publisher's stripe_account_id (it could have changed
    // since the failed primary run).
    const { data: dev } = await sb.from("developers")
      .select("stripe_account_id, payout_blocked")
      .eq("id", p.developer_id).single();
    if (!dev || dev.payout_blocked || !dev.stripe_account_id) {
      // Publisher got blocked between Friday and Saturday — leave the row
      // pending so it sticks out in the operator dashboard.
      summary.still_pending++;
      continue;
    }

    const amountCents = Math.round(parseFloat(p.amount) * 100);
    // Day 6 fix: currency from platform balance, not hardcoded.
    const platformCurrencyR = await getPlatformCurrency(s);
    let transferId = null;
    let stripeErr  = null;
    try {
      const tr = await s.transfers.create({
        amount: amountCents, currency: platformCurrencyR,
        destination: dev.stripe_account_id,
        metadata: { developer_id: p.developer_id, retry_of: p.id, run_id: runId },
      });
      transferId = tr.id;
    } catch (e) { stripeErr = e; }

    if (transferId) {
      // The original primary run never debited balance; do it now.
      const deducted = await publisherBalance.debitPublisherBalance(
        sb, p.developer_id, parseFloat(p.amount),
      );
      try {
        await sb.from("payouts").update({
          status: "paid",
          stripe_transfer_id: transferId,
          completed_at: new Date().toISOString(),
        }).eq("id", p.id);
      } catch (_) {}
      summary.succeeded++;
      continue;
    }

    // Failure on retry — classify and update retry_count.
    const errMsg  = (stripeErr && stripeErr.message) || "unknown_error";
    const errType = stripeErr && stripeErr.type;
    const errCode = stripeErr && stripeErr.code;
    const tier2Reasons = [
      "account_invalid", "balance_insufficient", "bank_account_unverified",
      "destination_account_disabled", "insufficient_capabilities_for_transfer",
      "invalid_request_error",
    ];
    const isTier2 = (errType === "StripeInvalidRequestError") ||
                    (errCode && tier2Reasons.includes(errCode));

    const newRetryCount = (parseInt(p.retry_count, 10) || 0) + 1;
    if (isTier2) {
      try {
        await sb.from("developers").update({
          payout_blocked: true,
          payout_blocked_reason: "stripe_transfer_rejected: " + (errCode || errType || errMsg).toString().slice(0, 200),
          payout_blocked_at: new Date().toISOString(),
        }).eq("id", p.developer_id);
        await sb.from("payouts").update({
          status: "failed", failure_tier: 2,
          failure_reason: errMsg.slice(0, 500),
          retry_count: newRetryCount,
          completed_at: new Date().toISOString(),
        }).eq("id", p.id);
      } catch (_) {}
      summary.tier2_failed++;
    } else if (newRetryCount >= MAX_RETRIES) {
      // Tier-1 exhausted — mark failed and alert.
      try {
        await sb.from("payouts").update({
          status: "failed", failure_tier: 1,
          failure_reason: errMsg.slice(0, 500),
          retry_count: newRetryCount,
          completed_at: new Date().toISOString(),
        }).eq("id", p.id);
      } catch (_) {}
      summary.final_failed++;
      console.error("bbx:payout_retry:tier1_exhausted", JSON.stringify({
        developer_id: p.developer_id, payout_id: p.id, retries: newRetryCount,
      }));
    } else {
      // Still retryable — bump retry_count, leave pending.
      try {
        await sb.from("payouts").update({
          retry_count: newRetryCount,
          failure_reason: errMsg.slice(0, 500),
        }).eq("id", p.id);
      } catch (_) {}
      summary.still_pending++;
    }
  }

  summary.mode = "stripe";
  summary.completed_at = new Date().toISOString();
  console.log("bbx:payout_retry:done", JSON.stringify(summary));
  return res.json(summary);
}

// ═══════════════════════════════════════════════════════════════════════
// Phase E Day 4 — operator admin endpoints.
//
// All four actions below require Authorization: Bearer ${ADMIN_TOKEN}
// (separate from CRON_SECRET — operator key shouldn't be the same as
// what cron uses). Demo mode skips auth so unit tests can exercise the
// state machine without an env var.
// ═══════════════════════════════════════════════════════════════════════

function isAdminAuthorized(req) {
  if (!HAS_SUPABASE) return true;
  // Accept either env name so the admin console only needs one secret
  // configured (ADMIN_TOKEN and BBX_ADMIN_KEY are treated as equivalent
  // across api/stats, api/billing and api/campaigns).
  const keys = [process.env.ADMIN_TOKEN, process.env.BBX_ADMIN_KEY].filter(Boolean);
  if (keys.length === 0) return false;
  const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  return keys.some((k) => auth === `Bearer ${k}`);
}

// GET /api/billing?action=admin_payouts_list&status=...&limit=...
//
// Returns most-recent N payout rows, optionally filtered by status.
// Joins developer email/stripe_account_id for the operator to scan
// without round-tripping. Capped at 100 rows.
async function handleAdminPayoutsList(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const status = req.query && req.query.status;          // pending|paid|failed|held
  const limit  = Math.min(100, parseInt((req.query && req.query.limit) || "50", 10) || 50);

  const sb = supa();
  if (!sb) {
    // Demo mode: read from in-memory DEMO.payouts
    const rows = Array.from(DEMO.payouts.values())
      .filter((p) => !status || p.status === status)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
    return res.json({ mode: "demo", count: rows.length, payouts: rows });
  }

  let q = sb.from("payouts")
    .select("id, developer_id, amount, fee_usd, method, status, failure_tier, failure_reason, retry_count, stripe_transfer_id, period_start, period_end, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);

  let payouts = [];
  try {
    const { data, error } = await q;
    if (error) throw error;
    payouts = data || [];
  } catch (e) {
    console.error("bbx:admin_payouts:query_fail", JSON.stringify({ message: e && e.message }));
    return res.status(500).json({ error: "query failed", message: e && e.message });
  }

  // Enrich with developer email + stripe_account_id in a single follow-up query.
  if (payouts.length > 0) {
    const devIds = [...new Set(payouts.map((p) => p.developer_id))];
    try {
      const { data: devs } = await sb.from("developers")
        .select("id, email, stripe_account_id")
        .in("id", devIds);
      const byId = new Map((devs || []).map((d) => [d.id, d]));
      for (const p of payouts) {
        const d = byId.get(p.developer_id);
        if (d) {
          p.developer_email = d.email;
          p.developer_stripe_account_id = d.stripe_account_id;
        }
      }
    } catch (_) { /* enrichment is nice-to-have */ }
  }

  return res.json({ mode: "stripe", count: payouts.length, payouts });
}

// POST /api/billing?action=admin_force_retry  body: { payout_id }
//
// Manually retries a single failed/pending payout. Resets retry_count
// to 0 (so the Saturday sweep treats it fresh) and sets status='pending'.
// The next Saturday cron — or a manual run_payout_retry_sweep call —
// will pick it up.
async function handleAdminForceRetry(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const { payout_id } = req.body || {};
  if (!payout_id) return res.status(400).json({ error: "Missing payout_id" });

  const sb = supa();
  if (!sb) {
    const row = DEMO.payouts.get(payout_id);
    if (!row) return res.status(404).json({ error: "payout not found" });
    row.status = "pending";
    row.retry_count = 0;
    row.failure_tier = null;
    return res.json({ mode: "demo", payout_id, reset: true });
  }

  try {
    const { data, error } = await sb.from("payouts").update({
      status: "pending",
      retry_count: 0,
      failure_tier: null,
      failure_reason: null,
      completed_at: null,
    }).eq("id", payout_id).select("id, developer_id, status").single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "payout not found" });
    console.log("bbx:admin:force_retry", JSON.stringify({
      payout_id, developer_id: data.developer_id,
    }));
    return res.json({ mode: "stripe", payout_id, reset: true, developer_id: data.developer_id });
  } catch (e) {
    return res.status(500).json({ error: "update failed", message: e && e.message });
  }
}

// POST /api/billing?action=admin_unblock_publisher  body: { developer_id }
//
// Manually clears payout_blocked + reason on a developer. Use after the
// publisher has resolved their Stripe issue out-of-band (or an operator
// is overriding a Tier-2 mark they consider resolved).
async function handleAdminUnblockPublisher(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const { developer_id, reason } = req.body || {};
  if (!developer_id) return res.status(400).json({ error: "Missing developer_id" });

  const sb = supa();
  if (!sb) {
    const d = DEMO.developers.get(developer_id);
    if (!d) return res.status(404).json({ error: "developer not found" });
    d.payout_blocked = false;
    d.payout_blocked_reason = null;
    return res.json({ mode: "demo", developer_id, unblocked: true });
  }

  try {
    const { data, error } = await sb.from("developers").update({
      payout_blocked: false,
      payout_blocked_reason: null,
      payout_blocked_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", developer_id).select("id, email").single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "developer not found" });
    console.log("bbx:admin:unblock", JSON.stringify({
      developer_id, email: data.email, operator_reason: reason || "(no reason supplied)",
    }));
    return res.json({ mode: "stripe", developer_id, unblocked: true, email: data.email });
  } catch (e) {
    return res.status(500).json({ error: "update failed", message: e && e.message });
  }
}

// GET /api/billing?action=admin_blocked_publishers
//
// Quick list of every publisher currently blocked, with the Stripe
// reason and when it happened. Drives the Day 4 dashboard's "Action
// required" panel.
async function handleAdminBlockedPublishers(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const sb = supa();
  if (!sb) {
    const rows = Array.from(DEMO.developers.values())
      .filter((d) => d.payout_blocked)
      .map((d) => ({
        developer_id: d.id, email: d.email,
        payout_blocked_reason: d.payout_blocked_reason,
        payout_blocked_at: d.payout_blocked_at,
        stripe_account_id: d.stripe_account_id,
      }));
    return res.json({ mode: "demo", count: rows.length, blocked: rows });
  }

  try {
    const { data, error } = await sb.from("developers")
      .select("id, email, stripe_account_id, payout_blocked_reason, payout_blocked_at")
      .eq("payout_blocked", true)
      .order("payout_blocked_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows = (data || []).map((d) => ({
      developer_id: d.id, email: d.email,
      stripe_account_id: d.stripe_account_id,
      payout_blocked_reason: d.payout_blocked_reason,
      payout_blocked_at: d.payout_blocked_at,
    }));
    return res.json({ mode: "stripe", count: rows.length, blocked: rows });
  } catch (e) {
    return res.status(500).json({ error: "query failed", message: e && e.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase E Day 5 — E2E inventory diagnostic.
//
// Returns the count and most-recent timestamp at every checkpoint of the
// autonomous payout loop. Used by the Day 5 runbook to quickly verify
// each stage of the demo flow worked. One round-trip per call; no Stripe
// API hits.
//
// Auth: Authorization: Bearer ${ADMIN_TOKEN}
// ═══════════════════════════════════════════════════════════════════════
async function handleE2EInventory(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const sb = supa();
  if (!sb) {
    return res.json({
      mode: "demo",
      message: "E2E inventory only meaningful in Supabase production mode.",
    });
  }

  const out = {
    mode: "stripe",
    generated_at: new Date().toISOString(),
    advertisers:           { count: 0, latest_signup_at: null },
    advertiser_deposits:   { total_usd: 0, count: 0, latest_at: null },
    campaigns_active:      { count: 0, latest_launched_at: null },
    auctions_24h:          { total: 0, sandbox: 0, production: 0 },
    impressions_24h:       { production: 0, sandbox: 0 },
    paying_events_1h:      { count: 0, total_publisher_payout_usd: 0 },
    developers:            { count: 0, with_stripe_account: 0, payouts_enabled: 0 },
    publisher_balances:    { with_positive_balance: 0, total_owed_to_publishers_usd: 0 },
    payouts:               { paid: 0, pending: 0, failed: 0, total_paid_usd: 0, last_paid_at: null },
    clawbacks:             { applied: 0, pending: 0, total_pending_usd: 0 },
  };

  try {
    // Advertisers
    const { count: advCount } = await sb.from("advertisers")
      .select("*", { count: "exact", head: true });
    out.advertisers.count = advCount || 0;
    const { data: lastAdv } = await sb.from("advertisers")
      .select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (lastAdv) out.advertisers.latest_signup_at = lastAdv.created_at;

    // Advertiser deposits (transactions of type='deposit', completed)
    try {
      const { data: deposits } = await sb.from("transactions")
        .select("amount, created_at").eq("type", "deposit").eq("status", "completed");
      if (Array.isArray(deposits)) {
        out.advertiser_deposits.count = deposits.length;
        out.advertiser_deposits.total_usd = +deposits.reduce(
          (s, d) => s + (parseFloat(d.amount) || 0), 0,
        ).toFixed(2);
        const latest = deposits.reduce((a, b) =>
          new Date(b.created_at) > new Date(a.created_at) ? b : a, deposits[0]);
        if (latest) out.advertiser_deposits.latest_at = latest.created_at;
      }
    } catch (_) { /* transactions table may not exist; skip */ }

    // Active campaigns
    const { count: campCount } = await sb.from("campaigns")
      .select("*", { count: "exact", head: true }).eq("status", "active");
    out.campaigns_active.count = campCount || 0;
    const { data: lastCamp } = await sb.from("campaigns")
      .select("created_at").eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (lastCamp) out.campaigns_active.latest_launched_at = lastCamp.created_at;

    // 24h auctions
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: prodAucs } = await sb.from("auction_logs")
      .select("*", { count: "exact", head: true })
      .eq("is_sandbox", false).eq("outcome", "won").gte("ts", since24h);
    const { count: sbxAucs } = await sb.from("auction_logs")
      .select("*", { count: "exact", head: true })
      .eq("is_sandbox", true).eq("outcome", "sandbox").gte("ts", since24h);
    out.auctions_24h.production = prodAucs || 0;
    out.auctions_24h.sandbox = sbxAucs || 0;
    out.auctions_24h.total = out.auctions_24h.production + out.auctions_24h.sandbox;

    // 24h impressions
    const { count: prodImps } = await sb.from("events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "impression").eq("is_sandbox", false).gte("created_at", since24h);
    const { count: sbxImps } = await sb.from("events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "impression").eq("is_sandbox", true).gte("created_at", since24h);
    out.impressions_24h.production = prodImps || 0;
    out.impressions_24h.sandbox = sbxImps || 0;

    // 1h paying events (developer_payout > 0)
    const since1h = new Date(Date.now() - 3600 * 1000).toISOString();
    const { data: payingEvts } = await sb.from("events")
      .select("developer_payout")
      .gt("developer_payout", 0).eq("is_sandbox", false).gte("created_at", since1h);
    if (Array.isArray(payingEvts)) {
      out.paying_events_1h.count = payingEvts.length;
      out.paying_events_1h.total_publisher_payout_usd = +payingEvts.reduce(
        (s, e) => s + (parseFloat(e.developer_payout) || 0), 0,
      ).toFixed(4);
    }

    // Developers
    const { count: devCount } = await sb.from("developers")
      .select("*", { count: "exact", head: true });
    out.developers.count = devCount || 0;
    const { count: devWithStripe } = await sb.from("developers")
      .select("*", { count: "exact", head: true }).not("stripe_account_id", "is", null);
    out.developers.with_stripe_account = devWithStripe || 0;
    const { count: devEnabled } = await sb.from("developers")
      .select("*", { count: "exact", head: true }).eq("payouts_enabled", true);
    out.developers.payouts_enabled = devEnabled || 0;

    // Publisher balances
    const { data: bals } = await sb.from("publisher_balance")
      .select("balance").gt("balance", 0);
    if (Array.isArray(bals)) {
      out.publisher_balances.with_positive_balance = bals.length;
      out.publisher_balances.total_owed_to_publishers_usd = +bals.reduce(
        (s, b) => s + (parseFloat(b.balance) || 0), 0,
      ).toFixed(2);
    }

    // Payouts
    const { count: paidC } = await sb.from("payouts")
      .select("*", { count: "exact", head: true }).eq("status", "paid");
    out.payouts.paid = paidC || 0;
    const { count: pendC } = await sb.from("payouts")
      .select("*", { count: "exact", head: true }).eq("status", "pending");
    out.payouts.pending = pendC || 0;
    const { count: failC } = await sb.from("payouts")
      .select("*", { count: "exact", head: true }).eq("status", "failed");
    out.payouts.failed = failC || 0;
    try {
      const { data: paidRows } = await sb.from("payouts")
        .select("amount, completed_at").eq("status", "paid");
      if (Array.isArray(paidRows)) {
        out.payouts.total_paid_usd = +paidRows.reduce(
          (s, p) => s + (parseFloat(p.amount) || 0), 0,
        ).toFixed(2);
        const latest = paidRows.reduce((a, b) =>
          new Date(b.completed_at || 0) > new Date(a.completed_at || 0) ? b : a, paidRows[0]);
        if (latest) out.payouts.last_paid_at = latest.completed_at;
      }
    } catch (_) {}

    // Clawbacks
    const { count: appCB } = await sb.from("payout_clawbacks")
      .select("*", { count: "exact", head: true }).eq("status", "applied");
    out.clawbacks.applied = appCB || 0;
    const { data: pendCB } = await sb.from("payout_clawbacks")
      .select("remaining_usd").eq("status", "pending");
    if (Array.isArray(pendCB)) {
      out.clawbacks.pending = pendCB.length;
      out.clawbacks.total_pending_usd = +pendCB.reduce(
        (s, c) => s + (parseFloat(c.remaining_usd) || 0), 0,
      ).toFixed(2);
    }
  } catch (e) {
    console.error("bbx:e2e_inventory:fail", JSON.stringify({ message: e && e.message }));
    out.error = e && e.message;
  }

  return res.json(out);
}

// POST /api/billing?action=admin_sync_stripe_account  body: { developer_id }
//
// Phase E Day 6 — manually fetch a developer's Stripe Connect account from
// Stripe and sync our developers.payouts_enabled / payout_blocked flags.
// Use when the account.updated webhook didn't propagate.
//
// Idempotent: re-runnable.
async function handleAdminSyncStripeAccount(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const { developer_id } = req.body || {};
  if (!developer_id) return res.status(400).json({ error: "Missing developer_id" });

  const sb = supa();
  const s  = stripe();
  if (!sb || !s) {
    return res.status(500).json({ error: "Production Supabase + Stripe required" });
  }

  // Look up the developer's stripe_account_id
  const { data: dev, error: devErr } = await sb.from("developers")
    .select("id, email, stripe_account_id")
    .eq("id", developer_id).single();
  if (devErr || !dev) return res.status(404).json({ error: "developer not found" });
  if (!dev.stripe_account_id) return res.status(400).json({ error: "no stripe_account_id on developer" });

  // Fetch the connected account from Stripe
  let account;
  try {
    account = await s.accounts.retrieve(dev.stripe_account_id);
  } catch (e) {
    return res.status(500).json({ error: "Stripe retrieve failed", message: e && e.message });
  }

  const reqs       = (account.requirements && account.requirements.currently_due) || [];
  const payoutsOk  = !!account.payouts_enabled && reqs.length === 0;
  const blocked    = !payoutsOk && (reqs.length > 0 || account.payouts_enabled === false);
  const blockedReason = blocked
    ? (reqs.length > 0 ? "requirements_due: " + reqs.slice(0, 5).join(", ") : "payouts_disabled_by_stripe")
    : null;
  const caps       = (account.capabilities || {});
  const instantOn  = caps.instant_payouts === "active";

  await sb.from("developers").update({
    payouts_enabled:         payoutsOk,
    payout_blocked:          blocked,
    payout_blocked_reason:   blockedReason,
    payout_blocked_at:       blocked ? new Date().toISOString() : null,
    instant_payouts_enabled: instantOn,
    stripe_requirements_due: reqs,
    updated_at:              new Date().toISOString(),
  }).eq("id", developer_id);

  console.log("bbx:admin:sync_stripe_account", JSON.stringify({
    developer_id, email: dev.email, account_id: dev.stripe_account_id,
    payouts_enabled: payoutsOk, blocked, reqs: reqs.length,
  }));

  return res.json({
    developer_id,
    stripe_account_id: dev.stripe_account_id,
    payouts_enabled:   payoutsOk,
    payout_blocked:    blocked,
    payout_blocked_reason: blockedReason,
    instant_payouts_enabled: instantOn,
    requirements_due:  reqs,
  });
}

// GET /api/billing?action=integration_verify&developer_id=<UUID>
//
// Phase F — onboarding wizard verification. Returns per-door integration
// state for a given publisher:
//
//   {
//     mcp:        { active, impressions_24h, clicks_24h, last_seen_at },
//     js-snippet: { ... },
//     npm-sdk:    { ... },
//     rest-api:   { ... },
//     any_active: boolean,
//     first_door_at: ISO timestamp or null  (first time any door went active)
//   }
//
// Used by the dashboard's per-door wizard to render real-time "✓ Verified"
// checkmarks. Public — no auth — because the data is per-publisher and
// the developer_id is the identifier the publisher already knows about
// themselves.
async function handleIntegrationVerify(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const developerId = req.query && (req.query.developer_id || req.query.id);
  if (!developerId) return res.status(400).json({ error: "Missing developer_id" });

  const DOORS = ["mcp", "js-snippet", "npm-sdk", "rest-api"];

  // Demo mode
  const sb = supa();
  if (!sb) {
    const out = { mode: "demo", any_active: false, first_door_at: null };
    for (const d of DOORS) {
      out[d] = { active: false, impressions_24h: 0, clicks_24h: 0, last_seen_at: null };
    }
    return res.json(out);
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // One query, group in JS — Supabase JS client doesn't expose GROUP BY
  // cleanly without raw SQL.
  // 2026-05-20 — also select session_id so we can distinguish synthetic
  // dashboard tests (session_id starts with "test_") from real production
  // traffic. Live impressions are the meaningful signal that the
  // publisher's code is actually serving ads in their app.
  let rows = [];
  try {
    const { data, error } = await sb.from("events")
      .select("event_type, integration_method, created_at, session_id")
      .eq("developer_id", developerId)
      .gte("created_at", since)
      .not("integration_method", "is", null);
    if (error) throw error;
    rows = data || [];
  } catch (e) {
    console.error("bbx:integration_verify:fail",
      JSON.stringify({ developer_id: developerId, message: e && e.message }));
    return res.status(500).json({ error: "query failed", message: e && e.message });
  }

  // Helper — synthetic events come from the publisher dashboard's Run Test
  // button, which sets session_id="test_<timestamp>". Real production
  // events from installed SDKs use UUID-shaped or random session ids.
  function isSyntheticSession(sid) {
    return typeof sid === "string" && sid.startsWith("test_");
  }

  const byDoor = {};
  for (const d of DOORS) byDoor[d] = {
    impressions_24h: 0, clicks_24h: 0, last_seen_at: null,
    // 2026-05-20 — distinguish synthetic test events from real ones so the
    // badge can show "Verified (test only)" vs "Live · production".
    live_impressions_24h: 0, live_clicks_24h: 0, last_live_at: null,
    synthetic_impressions_24h: 0, synthetic_clicks_24h: 0, last_synthetic_at: null,
  };
  for (const r of rows) {
    const door = r.integration_method;
    if (!byDoor[door]) continue;
    const synthetic = isSyntheticSession(r.session_id);
    if (r.event_type === "impression") {
      byDoor[door].impressions_24h++;
      if (synthetic) byDoor[door].synthetic_impressions_24h++;
      else           byDoor[door].live_impressions_24h++;
    }
    if (r.event_type === "click") {
      byDoor[door].clicks_24h++;
      if (synthetic) byDoor[door].synthetic_clicks_24h++;
      else           byDoor[door].live_clicks_24h++;
    }
    if (!byDoor[door].last_seen_at || new Date(r.created_at) > new Date(byDoor[door].last_seen_at)) {
      byDoor[door].last_seen_at = r.created_at;
    }
    if (synthetic) {
      if (!byDoor[door].last_synthetic_at || new Date(r.created_at) > new Date(byDoor[door].last_synthetic_at)) {
        byDoor[door].last_synthetic_at = r.created_at;
      }
    } else {
      if (!byDoor[door].last_live_at || new Date(r.created_at) > new Date(byDoor[door].last_live_at)) {
        byDoor[door].last_live_at = r.created_at;
      }
    }
  }

  const out = { mode: "stripe", any_active: false, any_live: false, first_door_at: null };
  for (const d of DOORS) {
    const v = byDoor[d];
    const active = (v.impressions_24h + v.clicks_24h) > 0;
    // "Live" status = any non-synthetic event seen. This is the bit that
    // tells the publisher their actual installed code is firing — not
    // just dashboard test clicks. The UI uses this to differentiate
    // "Verified (test only)" from "Live".
    const live = (v.live_impressions_24h + v.live_clicks_24h) > 0;
    out[d] = { active, live, ...v };
    if (active) out.any_active = true;
    if (live)   out.any_live   = true;
    if (active && v.last_seen_at) {
      if (!out.first_door_at || new Date(v.last_seen_at) < new Date(out.first_door_at)) {
        out.first_door_at = v.last_seen_at;
      }
    }
  }
  return res.json(out);
}

// ── invoice generation (advertiser) ────────────────────────────────────
// Reads the auction ledger for all wins on this advertiser's campaigns
// in the period and sums them. Optionally creates a Stripe invoice.
async function handleInvoice(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { advertiser_id, since, until, campaign_ids, finalize = false } = req.body || {};
  if (!advertiser_id) return res.status(400).json({ error: "Missing advertiser_id" });

  // Pull win amounts from the ledger
  const dump = ledger._dump();
  const cidSet = Array.isArray(campaign_ids) ? new Set(campaign_ids) : null;
  const sinceTs = since ? new Date(since).getTime() : Date.now() - 30 * 86400 * 1000;
  const untilTs = until ? new Date(until).getTime() : Date.now();

  // In-memory ledger keys campaigns by campaign_id; if Supabase, query directly
  let wins = [];
  const sb = supa();
  if (sb) {
    let q = sb.from("rtb_bids")
      .select("id, campaign_id, won_price_cpm, won_at")
      .eq("status", "won")
      .gte("won_at", new Date(sinceTs).toISOString())
      .lte("won_at", new Date(untilTs).toISOString());
    if (cidSet) q = q.in("campaign_id", [...cidSet]);
    const { data } = await q;
    wins = data || [];
  } else {
    wins = dump.bids.filter((b) => b.status === "won"
      && (!cidSet || cidSet.has(b.campaign_id))
      && new Date(b.won_at).getTime() >= sinceTs
      && new Date(b.won_at).getTime() <= untilTs);
  }

  const grossUsd = wins.reduce((sum, b) => sum + (Number(b.won_price_cpm) || 0) / 1000, 0);
  const lineItems = aggregateByCampaign(wins);

  const invoice = {
    id: "inv_" + Math.random().toString(36).slice(2, 12),
    advertiser_id,
    period: { since: new Date(sinceTs).toISOString(), until: new Date(untilTs).toISOString() },
    impressions: wins.length,
    line_items: lineItems,
    subtotal_usd: +grossUsd.toFixed(4),
    // Fee disclosure for the advertiser invoice. The 6.5% RTB exchange fee
    // is a demand-side fee that shows up here; the 23.5% network take is
    // deducted from publisher share, not from the advertiser, so it does
    // not appear on the advertiser-facing invoice.
    rtb_fee_rate: RTB_FEE,
    rtb_fee_usd:  +(grossUsd * RTB_FEE).toFixed(4),
    take_rate:    TAKE_RATE, // combined fees (legacy field, kept for back-compat)
    total_usd:    +grossUsd.toFixed(4), // advertiser pays gross; take is deducted from publisher share
    currency: "USD",
    status: "draft",
    created_at: new Date().toISOString(),
  };

  // Optionally finalize via Stripe
  const s = stripe();
  if (finalize && s) {
    const cents = Math.round(invoice.total_usd * 100);
    if (cents > 0) {
      // For Stripe Invoicing we'd need a Customer; for v1 use a one-shot PaymentIntent
      const pi = await s.paymentIntents.create({
        amount: cents, currency: "usd",
        description: `BBX usage ${invoice.period.since.slice(0,10)} – ${invoice.period.until.slice(0,10)}`,
        metadata: { invoice_id: invoice.id, advertiser_id },
      });
      invoice.stripe_payment_intent = pi.id;
      invoice.client_secret         = pi.client_secret;
      invoice.status                = "finalized";
    }
  } else if (finalize) {
    // Demo: mark as finalized, deduct from in-memory balance
    const a = ensureDemoAdvertiser(advertiser_id);
    a.balance = Math.max(0, a.balance - invoice.total_usd);
    invoice.status = "finalized_demo";
  }

  DEMO.invoices.set(invoice.id, invoice);
  return res.json({ mode: HAS_STRIPE ? "stripe" : "demo", invoice });
}

function aggregateByCampaign(wins) {
  const m = new Map();
  for (const w of wins) {
    const cur = m.get(w.campaign_id) || { campaign_id: w.campaign_id, impressions: 0, gross_usd: 0 };
    cur.impressions += 1;
    cur.gross_usd   += (Number(w.won_price_cpm) || 0) / 1000;
    m.set(w.campaign_id, cur);
  }
  return [...m.values()].map((r) => ({
    campaign_id: r.campaign_id,
    impressions: r.impressions,
    gross_usd:   +r.gross_usd.toFixed(4),
    avg_cpm:     +(r.impressions ? (r.gross_usd / r.impressions) * 1000 : 0).toFixed(4),
  }));
}

// ── publisher payout (Connect transfer) ────────────────────────────────
// Reads ledger wins keyed by site_domain / app_bundle, computes publisher
// share (1 - take_rate), and emits Stripe transfers (or simulates them in demo).
async function handlePayout(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { since, until, dry_run = true } = req.body || {};

  const sinceTs = since ? new Date(since).getTime() : Date.now() - 30 * 86400 * 1000;
  const untilTs = until ? new Date(until).getTime() : Date.now();
  const dump = ledger._dump();

  // Build {publisher_key → totals}. Publisher key = auction.site_domain || auction.app_bundle
  const aucById = new Map(dump.auctions.map((a) => [a.id, a]));
  const totals = new Map();
  for (const b of dump.bids) {
    if (b.status !== "won") continue;
    const wonAt = new Date(b.won_at).getTime();
    if (wonAt < sinceTs || wonAt > untilTs) continue;
    const auc = aucById.get(b.auction_id);
    const pub = (auc && (auc.site_domain || auc.app_bundle)) || "unknown_publisher";
    const cur = totals.get(pub) || { publisher: pub, impressions: 0, gross_usd: 0 };
    cur.impressions += 1;
    cur.gross_usd   += (Number(b.won_price_cpm) || 0) / 1000;
    totals.set(pub, cur);
  }

  const transfers = [];
  for (const t of totals.values()) {
    const pubShareUsd = +(t.gross_usd * (1 - TAKE_RATE)).toFixed(4);
    const eligible    = pubShareUsd >= MIN_PAYOUT_USD;
    transfers.push({
      publisher: t.publisher,
      impressions: t.impressions,
      gross_usd:        +t.gross_usd.toFixed(4),
      // Attribute the take to the two fee categories for accounting.
      // The RTB fee is conceptually invoiced to the advertiser as a
      // demand-side fee; the network take is the platform margin. Both
      // come out of the same gross before publisher share is paid.
      rtb_fee_usd:      +(t.gross_usd * RTB_FEE).toFixed(4),
      network_take_usd: +(t.gross_usd * NETWORK_TAKE).toFixed(4),
      take_usd:         +(t.gross_usd * TAKE_RATE).toFixed(4), // legacy aggregate
      payout_usd:       pubShareUsd,
      eligible,
      reason:           eligible ? null : `below $${MIN_PAYOUT_USD} threshold`,
    });
  }

  // Execute transfers via Stripe Connect (only when not a dry run AND Stripe is live)
  const s = stripe();
  if (!dry_run && s) {
    const sb = supa();
    for (const t of transfers) {
      if (!t.eligible) continue;
      // Map publisher → stripe_account_id via publisher_domain in the developers table
      let acct = null;
      if (sb) {
        // publisher_domain matches site.domain from auction records (e.g. "cursor.com")
        const { data } = await sb.from("developers")
          .select("stripe_account_id").eq("publisher_domain", t.publisher).single();
        acct = data && data.stripe_account_id;
      }
      if (!acct) { t.transfer_skipped = "no Stripe Connect account on file"; continue; }
      const tr = await s.transfers.create({
        amount: Math.round(t.payout_usd * 100), currency: "usd",
        destination: acct,
        description: `BBX impression revenue ${new Date(sinceTs).toISOString().slice(0,10)} – ${new Date(untilTs).toISOString().slice(0,10)}`,
        metadata: { publisher: t.publisher, impressions: String(t.impressions) },
      });
      t.stripe_transfer_id = tr.id;
    }
  }

  const summary = {
    period: { since: new Date(sinceTs).toISOString(), until: new Date(untilTs).toISOString() },
    rtb_fee_rate:        RTB_FEE,
    network_take_rate:   NETWORK_TAKE,
    take_rate:           TAKE_RATE,             // legacy aggregate (= rtb_fee_rate + network_take_rate)
    publisher_share_pct: +((1 - TAKE_RATE) * 100).toFixed(2),
    min_payout_usd: MIN_PAYOUT_USD,
    publishers: transfers.length,
    eligible:   transfers.filter((t) => t.eligible).length,
    total_payout_usd: +transfers.filter((t) => t.eligible).reduce((s, t) => s + t.payout_usd, 0).toFixed(4),
    dry_run, mode: HAS_STRIPE ? "stripe" : "demo",
    transfers,
  };
  DEMO.payouts.set("payout_" + Date.now().toString(36), summary);
  return res.json(summary);
}

// ── Stripe webhook (signature-verified) ────────────────────────────────
async function handleWebhook(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const s = stripe();
  let event;
  if (s && STRIPE_WEBHOOK_KEY) {
    // Stripe sends the raw body; Vercel provides it via req.rawBody when configured.
    const sig = req.headers["stripe-signature"];
    const raw = req.rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    try {
      event = s.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_KEY);
    } catch (err) {
      console.error("[Billing] webhook signature verification failed:", err.message);
      return res.status(400).json({ error: "Invalid signature" });
    }
  } else if (HAS_SUPABASE) {
    // Production mode but webhook secret is missing — reject to prevent unsigned events
    console.error("[Billing] STRIPE_WEBHOOK_SECRET is not set but Supabase is configured. Rejecting unsigned webhook.");
    return res.status(500).json({ error: "Webhook secret not configured — cannot verify Stripe signature in production" });
  } else {
    // Demo mode — accept the event without verification but tag it as untrusted
    event = req.body;
    if (!event || !event.type) return res.status(400).json({ error: "Missing event payload" });
    event.untrusted = true;
  }

  // Idempotency: skip already-processed events (Stripe may retry)
  const eventId = event.id || `demo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  if (DEMO.processedWebhookIds.has(eventId)) {
    return res.json({ received: true, event_type: event.type, duplicate: true });
  }
  // In production, check the DB for duplicate event IDs
  const sb = supa();
  if (sb && event.id) {
    try {
      const { data: existing } = await sb.from("transactions")
        .select("id").eq("stripe_session_id", event.id).limit(1);
      if (existing && existing.length > 0) {
        return res.json({ received: true, event_type: event.type, duplicate: true });
      }
    } catch (_) { /* transactions table may not exist yet — continue */ }
  }
  DEMO.processedWebhookIds.add(eventId);

  DEMO.events.push({ at: new Date().toISOString(), type: event.type, event_id: eventId, untrusted: !!event.untrusted });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const advertiserId = session.metadata && session.metadata.advertiser_id;
    const amount       = parseFloat((session.metadata && session.metadata.amount) || 0);
    if (advertiserId && Number.isFinite(amount) && amount > 0) {
      const sb = supa();
      if (sb) {
        // Atomic increment using RPC to avoid read-then-write race
        const { error: rpcErr } = await sb.rpc("bbx_credit_advertiser_balance", {
          p_advertiser_id: advertiserId,
          p_amount_usd: amount,
        });
        // Fallback: if the RPC doesn't exist, do read-then-write
        if (rpcErr && rpcErr.message && rpcErr.message.includes("does not exist")) {
          try {
            const { data: adv, error: advErr } = await sb.from("advertisers").select("balance").eq("id", advertiserId).single();
            if (advErr) {
              console.error("[Billing] webhook balance fallback lookup failed:", advErr.message);
            } else if (adv) {
              await sb.from("advertisers")
                .update({ balance: (parseFloat(adv.balance) || 0) + amount })
                .eq("id", advertiserId);
            }
          } catch (fallbackErr) {
            console.error("[Billing] webhook balance fallback error:", fallbackErr.message);
          }
        } else if (rpcErr) {
          console.error("[Billing] webhook RPC credit failed:", rpcErr.message);
        }
        // Also record the transaction for history
        try {
          await sb.from("transactions").insert({
            advertiser_id: advertiserId, type: "deposit",
            amount, description: "Stripe deposit",
            stripe_session_id: session.id,
            status: "completed",
          });
        } catch (_) { /* transactions table may not exist yet */ }
      } else {
        const a = ensureDemoAdvertiser(advertiserId);
        a.balance += amount;
      }
    }
  }

  // Handle Stripe Connect account updates — Phase E Day 1.
  //
  // State machine (per Decision 6 Tier-2):
  //   payouts_enabled=true  AND requirements.currently_due=[]  → mark
  //     payouts_enabled, clear payout_blocked
  //   requirements.currently_due is non-empty (eventually-due / past-due) →
  //     set payout_blocked + reason. Banner click regenerates an Account
  //     Link (handleRefreshConnect).
  //   capabilities.transfers='active' → ready to receive standard payouts
  //   payouts.schedule.interval='manual' (or instant) signals publisher
  //     opted into Instant Payouts via Stripe Express dashboard.
  if (event.type === "account.updated") {
    const account = event.data.object;
    const developerId = account.metadata && account.metadata.developer_id;
    // Phase E Day 6 — structured logging so future ops can see every
    // account.updated event we receive and what we did with it. Without
    // this, the Day 5 issue (webhook never flipped payouts_enabled) was
    // invisible from logs.
    console.log("bbx:webhook:account_updated", JSON.stringify({
      tag: "webhook.account_updated",
      account_id: account.id,
      developer_id: developerId || null,
      payouts_enabled: !!account.payouts_enabled,
      charges_enabled: !!account.charges_enabled,
      currently_due: ((account.requirements && account.requirements.currently_due) || []).length,
      has_metadata: !!(account.metadata && Object.keys(account.metadata).length),
      capabilities: account.capabilities ? Object.keys(account.capabilities) : [],
    }));
    if (developerId) {
      const reqs       = (account.requirements && account.requirements.currently_due) || [];
      const payoutsOk  = !!account.payouts_enabled && reqs.length === 0;
      const blocked    = !payoutsOk && (reqs.length > 0 || account.payouts_enabled === false);
      const blockedReason = blocked
        ? (reqs.length > 0 ? "requirements_due: " + reqs.slice(0, 5).join(", ") : "payouts_disabled_by_stripe")
        : null;
      // Detect Instant Payouts opt-in (Decision 8). Stripe sets
      // capabilities.instant_payouts='active' on accounts that have opted in.
      const caps       = (account.capabilities || {});
      const instantOn  = caps.instant_payouts === "active";

      if (sb) {
        await sb.from("developers").update({
          stripe_account_id:       account.id,
          payouts_enabled:         payoutsOk,
          payout_blocked:          blocked,
          payout_blocked_reason:   blockedReason,
          payout_blocked_at:       blocked ? new Date().toISOString() : null,
          instant_payouts_enabled: instantOn,
          stripe_requirements_due: reqs,
          updated_at:              new Date().toISOString(),
        }).eq("id", developerId);
      } else {
        const d = ensureDemoDeveloper(developerId);
        d.stripe_account_id        = account.id;
        d.payouts_enabled          = payoutsOk;
        d.payout_blocked           = blocked;
        d.payout_blocked_reason    = blockedReason;
        d.instant_payouts_enabled  = instantOn;
        d.stripe_requirements_due  = reqs;
      }
    }
  }

  // account.application.deauthorized — publisher disconnected our Connect app.
  // Wipe stripe_account_id and mark blocked so the dashboard prompts re-setup
  // and we never attempt a transfer to a disconnected account.
  if (event.type === "account.application.deauthorized") {
    const account = event.data.object;
    if (sb) {
      await sb.from("developers").update({
        stripe_account_id:       null,
        payouts_enabled:         false,
        payout_blocked:          true,
        payout_blocked_reason:   "stripe_account_deauthorized",
        payout_blocked_at:       new Date().toISOString(),
      }).eq("stripe_account_id", account.id);
    }
  }

  // payout.failed — Stripe couldn't push to the publisher's bank.
  // Tier-2: mark the publisher blocked; their dashboard will surface the
  // failure reason and the Resolve button (handleRefreshConnect).
  if (event.type === "payout.failed") {
    const payout = event.data.object;
    // Stripe sends this on the connected account; account is the recipient.
    const acct = event.account; // the connected account id
    if (sb && acct) {
      await sb.from("developers").update({
        payout_blocked:        true,
        payout_blocked_reason: "stripe_payout_failed: " + (payout.failure_message || payout.failure_code || "unknown"),
        payout_blocked_at:     new Date().toISOString(),
      }).eq("stripe_account_id", acct);

      // Mark the corresponding payouts row failed if we can identify it.
      try {
        await sb.from("payouts").update({
          status:         "failed",
          failure_reason: payout.failure_message || payout.failure_code || "stripe_payout_failed",
          failure_tier:   2,
          completed_at:   new Date().toISOString(),
        }).eq("stripe_transfer_id", payout.id);
      } catch (_) { /* payouts table may not exist pre-migration */ }
    }
  }

  // Handle failed charges — flag the transaction so payout doesn't fire on reversed deposits
  if (event.type === "charge.failed") {
    const charge = event.data.object;
    console.warn("[Billing] charge.failed:", charge.id, charge.failure_message);
    if (sb && charge.metadata && charge.metadata.advertiser_id) {
      try {
        await sb.from("transactions").insert({
          advertiser_id: charge.metadata.advertiser_id, type: "deposit",
          amount: (charge.amount || 0) / 100, description: `Failed charge: ${charge.failure_message || "unknown"}`,
          stripe_session_id: charge.id, status: "failed",
        });
      } catch (_) {}
    }
  }

  // Handle refunds — deduct from advertiser balance AND fire publisher clawback (Phase E HARD-1).
  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const refundAmount = (charge.amount_refunded || 0) / 100;
    const advertiserId = charge.metadata && charge.metadata.advertiser_id;
    if (advertiserId && refundAmount > 0) {
      if (sb) {
        const { error: rpcErr } = await sb.rpc("bbx_credit_advertiser_balance", {
          p_advertiser_id: advertiserId, p_amount_usd: -refundAmount,
        });
        if (rpcErr) {
          try {
            const { data: adv } = await sb.from("advertisers").select("balance").eq("id", advertiserId).single();
            if (adv) {
              await sb.from("advertisers")
                .update({ balance: Math.max(0, (parseFloat(adv.balance) || 0) - refundAmount) })
                .eq("id", advertiserId);
            }
          } catch (_) {}
        }
        try {
          await sb.from("transactions").insert({
            advertiser_id: advertiserId, type: "refund",
            amount: -refundAmount, description: "Stripe refund",
            stripe_session_id: charge.id, status: "completed",
          });
        } catch (_) {}

        // ── Publisher clawback (Phase E HARD-1) ──
        // Find every campaign that was funded by this refunded charge, sum
        // each publisher's attributed share (85% of attributed spend), and
        // try to deduct from balance. Insufficient balance → row stays
        // pending and future earnings satisfy it first. Per Decision 7.
        try {
          await fireRefundClawbacks(sb, advertiserId, refundAmount, charge.id);
        } catch (e) {
          console.error("bbx:clawback:fail", JSON.stringify({
            tag: "clawback.fail", advertiser_id: advertiserId,
            refund_amount: refundAmount, charge_id: charge.id,
            message: e && e.message,
          }));
        }
      } else {
        const a = ensureDemoAdvertiser(advertiserId);
        a.balance = Math.max(0, a.balance - refundAmount);
      }
    }
  }

  return res.json({ received: true, event_type: event.type, mode: HAS_STRIPE ? "stripe" : "demo" });
}

// ════════════════════════════════════════════════════════════════════
// ── Phase 2 — PayPal webhook (signature-verified via PayPal API) ─────
// ════════════════════════════════════════════════════════════════════
//
// Unlike Stripe, PayPal doesn't sign with an HMAC we can verify
// locally. Instead we POST the headers + event back to PayPal's
// verify-webhook-signature endpoint and trust their reply.
//
// Events we care about:
//   PAYMENT.CAPTURE.COMPLETED — advertiser deposit landed
//   PAYMENT.CAPTURE.REFUNDED  — advertiser refund issued
//   PAYMENT.CAPTURE.DENIED    — capture rejected (rare; logs only)
//   PAYMENT.CAPTURE.PENDING   — review hold (logs only)
//
// The shim that delivers the raw body to this handler lives in
// api/paypal-webhook.js (mirrors how api/stripe-webhook.js wraps
// handleWebhook).
async function handlePaypalWebhook(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const raw = req.rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));

  let verification;
  try {
    verification = await paypal.verifyWebhook({
      headers:   req.headers || {},
      rawBody:   raw,
      webhookId: process.env.PAYPAL_WEBHOOK_ID,
    });
  } catch (err) {
    console.error("[Billing] paypal verifyWebhook failed:", err.message);
    return res.status(502).json({ error: "paypal_verify_failed", detail: err.message });
  }

  if (!verification.verified && HAS_PAYPAL) {
    console.error("[Billing] paypal webhook verification did not succeed:", verification.status);
    return res.status(400).json({ error: "invalid_signature", status: verification.status });
  }

  let event;
  try { event = JSON.parse(raw); }
  catch (_) { return res.status(400).json({ error: "Invalid JSON body" }); }
  if (!event || !event.event_type) return res.status(400).json({ error: "Missing event payload" });

  // Idempotency: PayPal includes a stable `id` on every event.
  const eventId = event.id || `paypal_demo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  if (DEMO.processedWebhookIds.has(eventId)) {
    return res.json({ received: true, event_type: event.event_type, duplicate: true });
  }
  const sb = supa();
  if (sb && event.id) {
    try {
      const { data: existing } = await sb.from("transactions")
        .select("id").eq("paypal_event_id", event.id).limit(1);
      if (existing && existing.length > 0) {
        return res.json({ received: true, event_type: event.event_type, duplicate: true });
      }
    } catch (_) { /* paypal_event_id column may not exist yet */ }
  }
  DEMO.processedWebhookIds.add(eventId);
  DEMO.events.push({
    at: new Date().toISOString(),
    type: event.event_type,
    event_id: eventId,
    untrusted: verification.mode === "demo",
  });

  const resource = (event.resource || {});

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    // Resolve advertiser id from custom_id (we stamped this at order create time)
    const advertiserId = resource.custom_id || (resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.advertiser_id);
    const amount       = Number((resource.amount && resource.amount.value) || 0);
    const captureId    = resource.id;
    const orderId      = (resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.order_id) || null;
    const payerEmail   = (resource.payer && resource.payer.email_address) || null;
    if (advertiserId && amount > 0) {
      await creditAdvertiserForPayinEvent({
        provider:        "paypal",
        advertiserId,
        amountUsd:       amount,
        externalEventId: captureId || eventId,
        paypalOrderId:   orderId,
        paypalCaptureId: captureId,
        payerEmail,
        description:     "PayPal deposit (webhook)",
      });
    } else {
      console.warn("[Billing] paypal capture.completed missing advertiser/amount", { advertiserId, amount, captureId });
    }
  }

  if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
    // Refunds: debit the advertiser balance and fire any publisher
    // clawbacks tied to that advertiser's campaigns (same call the
    // Stripe refund path uses).
    const refundedCaptureId = resource.id;  // resource is the refund itself
    const linkedCaptureId   = ((resource.links || []).find((l) => l.rel === "up") || {}).href || null;
    const refundAmount      = Number((resource.amount && resource.amount.value) || 0);
    const advertiserId      = resource.custom_id || null;

    if (sb && refundAmount > 0) {
      // Try to look the original capture up by its id to find the advertiser
      let resolvedAdvertiserId = advertiserId;
      try {
        if (!resolvedAdvertiserId && linkedCaptureId) {
          const m = linkedCaptureId.match(/captures\/([^/]+)/);
          const sourceCapture = m && m[1];
          if (sourceCapture) {
            const { data } = await sb.from("transactions")
              .select("advertiser_id").eq("paypal_capture_id", sourceCapture).limit(1);
            resolvedAdvertiserId = data && data[0] && data[0].advertiser_id;
          }
        }
        if (resolvedAdvertiserId) {
          // Debit balance — best effort. fireRefundClawbacks runs after.
          try {
            await sb.rpc("bbx_credit_advertiser_balance", {
              p_advertiser_id: resolvedAdvertiserId,
              p_amount_usd:    -refundAmount,
            });
          } catch (e) { console.error("[Billing] paypal refund balance debit failed:", e.message); }
          try { await fireRefundClawbacks(sb, resolvedAdvertiserId, refundAmount, refundedCaptureId); }
          catch (e) { console.error("[Billing] paypal refund clawbacks failed:", e.message); }

          try {
            await sb.from("transactions").insert({
              advertiser_id: resolvedAdvertiserId,
              type:          "refund",
              amount:        -refundAmount,
              description:   "PayPal refund",
              provider:      "paypal",
              status:        "completed",
              paypal_event_id:   eventId,
              paypal_capture_id: refundedCaptureId,
            });
          } catch (_) { /* schema gap is non-fatal */ }
        }
      } catch (e) {
        console.error("[Billing] paypal refund handling error:", e.message);
      }
    } else if (!sb) {
      // Demo mode — just decrement the in-memory advertiser balance
      if (advertiserId) {
        const a = DEMO.advertisers.get(advertiserId);
        if (a) a.balance = Math.max(0, (Number(a.balance) || 0) - refundAmount);
      }
    }
  }

  if (event.event_type === "PAYMENT.CAPTURE.DENIED" || event.event_type === "PAYMENT.CAPTURE.PENDING") {
    // Surfaceable for ops but no balance change. Mark transactions row.
    if (sb && resource.id) {
      try {
        await sb.from("transactions")
          .update({ status: event.event_type === "PAYMENT.CAPTURE.DENIED" ? "denied" : "pending_review" })
          .eq("paypal_capture_id", resource.id);
      } catch (_) { /* best effort */ }
    }
  }

  // ── PayPal Payouts (publisher cash-out side) ─────────────────────────
  // Twin of the pay-in events above. We get item-level webhooks from
  // PayPal whenever a payout we dispatched changes state. Each event's
  // resource carries:
  //   resource.payout_item_id           — PayPal's id for this item
  //   resource.payout_batch_id          — PayPal's id for the batch
  //   resource.transaction_id           — PayPal txn id once money moves
  //   resource.transaction_status       — SUCCESS / DENIED / FAILED / RETURNED / etc
  //   resource.payout_item.sender_item_id   — our payout_requests.id (KEY)
  //   resource.payout_item.amount.value     — USD amount
  //   resource.errors                   — array of PayPal error details on failure
  //
  // We look rows up by sender_item_id (our PK), which is always present
  // in the event payload. PayPal's own ids (payout_item_id, payout_batch_id)
  // get stored on the row for future polling / reconciliation.
  //
  // Idempotency notes:
  //   - DEMO.processedWebhookIds.has(eventId) above already dedupes
  //     identical event deliveries.
  //   - Status updates are conditioned on the current status so a stale
  //     event arriving after a manual admin_mark_failed can't flip an
  //     already-paid row back to a different state.
  //   - Balance refund on failure is conditioned on the row not having
  //     been refunded already (refunded_at IS NULL on update path).
  if (event.event_type && event.event_type.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    const senderItemId = (resource.payout_item && resource.payout_item.sender_item_id) || null;
    const payoutItemId = resource.payout_item_id || null;
    const payoutBatchId = resource.payout_batch_id || null;
    const txnStatus = String(resource.transaction_status || "").toUpperCase();
    const itemAmount = Number((resource.payout_item && resource.payout_item.amount && resource.payout_item.amount.value) || 0);

    if (!senderItemId) {
      console.warn("[Billing] PayPal Payouts item event missing sender_item_id — can't reconcile:", event.event_type, event.id);
    } else if (sb) {
      // Pull the row first so we know publisher_id (for balance refund + email)
      // and current status (for idempotency).
      let row = null;
      try {
        const { data } = await sb.from("payout_requests")
          .select("id, publisher_id, amount_usd, status, paypal_item_id, paypal_batch_id, bank_snapshot")
          .eq("id", senderItemId).maybeSingle();
        row = data || null;
      } catch (e) {
        console.error("[Billing] PayPal Payouts row lookup failed:", e.message);
      }

      if (!row) {
        console.warn("[Billing] PayPal Payouts event references unknown sender_item_id:", senderItemId, event.event_type);
      } else {
        // Best-effort store PayPal's ids on the row (idempotent — same id
        // on retry is a no-op).
        try {
          const updates = {};
          if (payoutItemId  && !row.paypal_item_id)  updates.paypal_item_id  = payoutItemId;
          if (payoutBatchId && !row.paypal_batch_id) updates.paypal_batch_id = payoutBatchId;
          if (Object.keys(updates).length > 0) {
            await sb.from("payout_requests").update(updates).eq("id", row.id);
          }
        } catch (_) { /* column may not yet exist */ }

        // ── Success path ──
        if (event.event_type === "PAYMENT.PAYOUTS-ITEM.SUCCEEDED" || txnStatus === "SUCCESS") {
          // Flip batched → paid. Conditioned on status='batched' so a
          // re-delivery after admin_mark_failed can't flip the row back.
          const { data: updated } = await sb.from("payout_requests")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("status", "batched")
            .select("id, publisher_id, amount_usd, bank_snapshot");

          if (updated && updated.length > 0) {
            // Send the branded "Payout sent" email — same call-site as
            // admin_mark_paid. Look up the publisher's email from developers.
            try {
              const r = updated[0];
              const { data: pub } = await sb.from("developers")
                .select("email").eq("id", r.publisher_id).maybeSingle();
              const email = pub && pub.email;
              if (email) {
                const { sendPayoutSent } = require("./_lib/emails/send");
                const method = (r.bank_snapshot && r.bank_snapshot.method)
                  ? String(r.bank_snapshot.method) : "PayPal";
                const paypalRecipient = (r.bank_snapshot && r.bank_snapshot.paypal_email) || null;
                sendPayoutSent({
                  to:                   email,
                  amountUsd:            Number(r.amount_usd) || 0,
                  payoutMethod:         method === "paypal" ? "PayPal" : method,
                  payoutId:             r.id,
                  paypalEmail:          paypalRecipient,
                  // expectedDeliveryDays omitted — template defaults to
                  // "within 30 minutes" for PayPal-method rows.
                }).catch((e) => console.error("[Billing] sendPayoutSent threw:", e.message));
              }
            } catch (e) {
              console.warn("[Billing] payout-sent email skipped:", e.message);
            }
          }
        }

        // ── Failure paths ──
        // DENIED         = PayPal couldn't process (e.g. recipient blocked)
        // FAILED         = network/system failure during payout
        // RETURNED       = money came back (recipient closed PayPal acct,
        //                  email unreachable for 30 days)
        // REFUNDED       = sender-initiated reversal (admin clawback)
        // BLOCKED / HELD = manual review (we log + leave row in batched)
        const isFailure = (
          event.event_type === "PAYMENT.PAYOUTS-ITEM.DENIED"   ||
          event.event_type === "PAYMENT.PAYOUTS-ITEM.FAILED"   ||
          event.event_type === "PAYMENT.PAYOUTS-ITEM.RETURNED" ||
          event.event_type === "PAYMENT.PAYOUTS-ITEM.REFUNDED" ||
          (txnStatus && ["DENIED", "FAILED", "RETURNED", "REFUNDED"].includes(txnStatus))
        );
        if (isFailure) {
          // Build a human-readable reason string from PayPal's `errors`
          // array. Capped at 500 chars to fit the failure_reason column.
          let reason = `PayPal ${event.event_type.split(".").pop()}`;
          try {
            if (Array.isArray(resource.errors) && resource.errors[0]) {
              const e0 = resource.errors[0];
              const name = e0.name || e0.error_code || "";
              const msg = e0.message || e0.description || "";
              reason = `${reason}${name ? ` (${name})` : ""}${msg ? `: ${msg}` : ""}`.slice(0, 500);
            }
          } catch (_) { /* best effort */ }

          // Flip batched → failed, conditioned on status='batched' so
          // we don't double-flip. The condition is also our refund gate:
          // if .length > 0 we know this is the FIRST failure event for
          // this row, so safe to refund the balance.
          const { data: failedRows } = await sb.from("payout_requests")
            .update({
              status:         "failed",
              failed_at:      new Date().toISOString(),
              failure_reason: reason,
            })
            .eq("id", row.id)
            .eq("status", "batched")
            .select("id, publisher_id, amount_usd");

          if (failedRows && failedRows.length > 0) {
            const refundAmount = Number(failedRows[0].amount_usd) || itemAmount;
            if (refundAmount > 0) {
              try {
                await sb.rpc("bbx_credit_publisher_balance", {
                  p_developer_id: failedRows[0].publisher_id,
                  p_amount_usd:   refundAmount,
                });
              } catch (e) {
                console.error("[Billing] PayPal Payouts failure refund failed:", e.message);
              }
            }
            console.log(`[Billing] PayPal Payouts ${event.event_type} → refunded $${refundAmount} to ${failedRows[0].publisher_id} (request ${row.id}): ${reason}`);
          }
        }

        // ── Informational / no-op paths ──
        // UNCLAIMED = recipient hasn't claimed yet (30-day window). Leave
        //             row in batched. PayPal will fire SUCCEEDED or RETURNED
        //             eventually.
        // BLOCKED   = PayPal compliance/risk hold. Leave row in batched and
        //             surface to admin via Vercel logs.
        // HELD      = funds held pending review. Leave row in batched.
        if (["PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
             "PAYMENT.PAYOUTS-ITEM.BLOCKED",
             "PAYMENT.PAYOUTS-ITEM.HELD"].includes(event.event_type)) {
          console.log(`[Billing] PayPal Payouts ${event.event_type} for request ${row.id} — left in batched, awaiting next event`);
        }
      }
    }
  }

  // ── PayPal Payouts batch-level events ────────────────────────────────
  // Batch-level events are mostly informational — item-level events above
  // do the actual reconciliation. We log them and use BATCH.DENIED as a
  // safety net to fail any items in the batch that didn't get individual
  // failure events (defensive — PayPal docs say item events always fire,
  // but better to have the catch-all).
  if (event.event_type === "PAYMENT.PAYOUTSBATCH.SUCCESS") {
    const batchId = resource.batch_header && resource.batch_header.payout_batch_id;
    console.log(`[Billing] PayPal Payouts batch ${batchId} succeeded (informational — item events handle row updates)`);
  }
  if (event.event_type === "PAYMENT.PAYOUTSBATCH.DENIED") {
    const batchId = resource.batch_header && resource.batch_header.payout_batch_id;
    const senderBatchId = resource.batch_header
      && resource.batch_header.sender_batch_header
      && resource.batch_header.sender_batch_header.sender_batch_id;
    console.error(`[Billing] PayPal Payouts BATCH DENIED — paypal_batch_id=${batchId} sender_batch_id=${senderBatchId}`);

    // Safety net: refund anything still in batched for this batch. Normally
    // item-level DENIED events handle this per-row, but the docs leave the
    // batch-level case ambiguous when the entire batch is rejected up front
    // (e.g. invalid API call). Iterate by sender_batch_id since that's our
    // batch_id column on the row.
    if (sb && senderBatchId) {
      try {
        const { data: stranded } = await sb.from("payout_requests")
          .update({
            status:         "failed",
            failed_at:      new Date().toISOString(),
            failure_reason: "PayPal batch denied",
          })
          .eq("batch_id", senderBatchId)
          .eq("status", "batched")
          .select("id, publisher_id, amount_usd");
        for (const r of stranded || []) {
          try {
            await sb.rpc("bbx_credit_publisher_balance", {
              p_developer_id: r.publisher_id,
              p_amount_usd:   Number(r.amount_usd) || 0,
            });
          } catch (e) {
            console.error("[Billing] PayPal Payouts batch-denied refund failed for", r.id, e.message);
          }
        }
        console.log(`[Billing] PayPal Payouts BATCH DENIED — refunded ${(stranded || []).length} stranded item(s)`);
      } catch (e) {
        console.error("[Billing] PayPal Payouts batch-denied fallback failed:", e.message);
      }
    }
  }
  if (event.event_type === "PAYMENT.PAYOUTSBATCH.PROCESSING") {
    // Just logging — no row update needed.
    const batchId = resource.batch_header && resource.batch_header.payout_batch_id;
    console.log(`[Billing] PayPal Payouts batch ${batchId} processing`);
  }

  return res.json({
    received:    true,
    event_type:  event.event_type,
    verified:    verification.verified,
    mode:        verification.mode,
  });
}

// ── helpers ────────────────────────────────────────────────────────────
function nextPayoutDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0];
}

/**
 * Phase E HARD-1 — fire publisher clawbacks when an advertiser charge is
 * refunded. Per Decision 7 of the design doc:
 *
 *   1. Find every (publisher, attributed_share) pair from events tied to
 *      this advertiser's campaigns.
 *   2. Pro-rate the refund across publishers in the same ratio.
 *   3. For each publisher: try to deduct from balance first; if balance
 *      insufficient, log a 'pending' clawback that future earnings satisfy.
 *
 * Day 1 implementation is intentionally conservative — it logs the
 * clawback intent to payout_clawbacks and (when balance is sufficient)
 * decrements the balance. The full "future earnings satisfy pending
 * clawback first" reconciliation lives in api/track.js (Day 2/3 wiring
 * once per-event accrual ships). Either way, no operator action required.
 */
async function fireRefundClawbacks(sb, advertiserId, refundAmount, sourceStripeId) {
  if (!sb || !advertiserId || refundAmount <= 0) return;

  // Step 1: sum publisher_payout per publisher for events on this
  // advertiser's campaigns. Cap the lookback at 90 days to bound the
  // query — refunds beyond that are exceedingly rare and unrecoverable
  // anyway (Decision 7's 90-day operator escalation).
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const { data: camps, error: campErr } = await sb.from("campaigns")
    .select("id").eq("advertiser_id", advertiserId);
  if (campErr || !Array.isArray(camps) || camps.length === 0) {
    console.warn("bbx:clawback:no_campaigns",
      JSON.stringify({ advertiser_id: advertiserId, refund: refundAmount }));
    return;
  }
  const campaignIds = camps.map((c) => c.id);
  const { data: evts, error: evtErr } = await sb.from("events")
    .select("developer_id, developer_payout, cost, campaign_id")
    .in("campaign_id", campaignIds)
    .eq("is_sandbox", false)
    .gte("created_at", since)
    .gt("developer_payout", 0);
  if (evtErr) {
    console.error("bbx:clawback:events_query_fail", evtErr.message);
    return;
  }
  if (!Array.isArray(evts) || evts.length === 0) return;

  // Aggregate attributed earnings per publisher + total spend on these
  // campaigns. Pro-rate refund by each publisher's share of total spend.
  const totalSpend = evts.reduce((s, e) => s + (parseFloat(e.cost) || 0), 0);
  if (totalSpend <= 0) return;
  const perPub = new Map();
  for (const e of evts) {
    if (!e.developer_id) continue;
    const cur = perPub.get(e.developer_id) || { earned: 0, spend: 0, campaign_id: e.campaign_id };
    cur.earned += parseFloat(e.developer_payout) || 0;
    cur.spend  += parseFloat(e.cost) || 0;
    perPub.set(e.developer_id, cur);
  }

  // Iterate by developer_id (the project's existing FK convention for
  // publishers — see api/_lib/campaign_history.js, supabase-schema.sql).
  for (const [developerId, stats] of perPub) {
    const share = (stats.spend / totalSpend) * refundAmount;     // refund pro-rated by spend
    const clawAmount = Math.min(stats.earned, share * 0.85);     // clawback bounded by what they actually earned
    if (clawAmount <= 0) continue;

    // Read current balance to decide applied-vs-pending.
    let currentBalance = 0;
    try {
      const { data: bal } = await sb.from("publisher_balance")
        .select("balance").eq("developer_id", developerId).maybeSingle();
      currentBalance = parseFloat(bal && bal.balance) || 0;
    } catch (_) {}

    const canCover = currentBalance >= clawAmount;
    const status   = canCover ? "applied" : "pending";

    try {
      await sb.from("payout_clawbacks").insert({
        developer_id:       developerId,
        amount_usd:         clawAmount,
        remaining_usd:      canCover ? 0 : clawAmount,
        source_event_type:  "refund",
        source_stripe_id:   sourceStripeId,
        source_campaign_id: stats.campaign_id,
        status,
        applied_at:         canCover ? new Date().toISOString() : null,
        notes:              "auto-clawback from charge.refunded webhook",
      });

      if (canCover) {
        // Atomic decrement attempt; fall back to read-modify-write.
        try {
          await sb.rpc("bbx_decrement_publisher_balance", {
            p_developer_id: developerId,
            p_amount_usd:   clawAmount,
          });
        } catch (_) {
          const newBalance = Math.max(0, currentBalance - clawAmount);
          await sb.from("publisher_balance").update({
            balance:    newBalance,
            updated_at: new Date().toISOString(),
          }).eq("developer_id", developerId);
        }
      }
    } catch (e) {
      // Table may not exist pre-migration 12 — log but don't bubble up.
      console.error("bbx:clawback:insert_fail",
        JSON.stringify({ developer_id: developerId, amount: clawAmount, message: e && e.message }));
    }
  }
}
module.exports._fireRefundClawbacks = fireRefundClawbacks;

// ── exports for testing ────────────────────────────────────────────────
module.exports.HAS_STRIPE    = HAS_STRIPE;
module.exports.HAS_SUPABASE  = HAS_SUPABASE;
module.exports.RTB_FEE       = RTB_FEE;
module.exports.NETWORK_TAKE  = NETWORK_TAKE;
module.exports.TAKE_RATE     = TAKE_RATE; // legacy aggregate, kept for back-compat
module.exports._DEMO         = DEMO;
module.exports._reset = function () {
  DEMO.advertisers.clear();
  DEMO.developers.clear();
  DEMO.invoices.clear();
  DEMO.payouts.clear();
  DEMO.events.length = 0;
  DEMO.processedWebhookIds.clear();
};
