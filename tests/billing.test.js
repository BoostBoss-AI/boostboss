/**
 * Boost Boss — billing.js smoke test (demo-mode path).
 * Run: node api/billing.test.js
 *
 * Stripe path requires live keys — covered separately in CI with
 * STRIPE_SECRET_KEY set against test-mode keys. This file exercises every
 * code path that runs without external dependencies, which is what
 * preview deploys + investor demos hit.
 */

// Force demo mode: no Stripe, no Supabase
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const assert = require("assert");
const billing = require("../api/billing.js");
const ledger  = require("../api/_lib/ledger.js");

function mockReqRes({ method = "POST", body = null, query = {}, headers = {} } = {}) {
  const res = {
    _status: 200, _headers: {}, _body: null,
    setHeader(k, v) { this._headers[k.toLowerCase()] = v; },
    status(n) { this._status = n; return this; },
    json(o) { this._body = o; this._headers["content-type"] = "application/json"; return this; },
    send(d) { this._body = d; return this; },
    end() { return this; },
  };
  return { req: { method, body, query, headers }, res };
}
async function run(spec) { const { req, res } = mockReqRes(spec); await billing(req, res); return res; }

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log("  \x1b[32mok\x1b[0m  " + name); passed++; }
  catch (e) { console.log("  \x1b[31mFAIL\x1b[0m  " + name + ": " + e.message); failed++; if (process.env.DEBUG) console.log(e.stack); }
}

(async () => {
  console.log("BBX Billing · demo-mode smoke test\n");

  await test("HAS_STRIPE is false in demo mode", () => assert.strictEqual(billing.HAS_STRIPE, false));
  await test("x-billing-mode header set to 'demo'", async () => {
    const r = await run({ method: "GET", query: { action: "balance", id: "adv_test" } });
    assert.strictEqual(r._headers["x-billing-mode"], "demo");
  });
  await test("rejects unknown action", async () => {
    const r = await run({ method: "POST", query: { action: "wat" } });
    assert.strictEqual(r._status, 400);
  });
  await test("OPTIONS preflight returns 200", async () => {
    const r = await run({ method: "OPTIONS" });
    assert.strictEqual(r._status, 200);
  });

  // ── balance ────────────────────────────────────────────────────────
  billing._reset();
  await test("balance auto-creates demo advertiser with $5000 starting balance", async () => {
    const r = await run({ method: "GET", query: { action: "balance", id: "adv_alice" } });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.balance, 5000);
    assert.ok(r._body.company_name);
  });
  await test("balance rejects missing id", async () => {
    const r = await run({ method: "GET", query: { action: "balance" } });
    assert.strictEqual(r._status, 400);
  });

  // ── earnings ──────────────────────────────────────────────────────
  await test("earnings returns publisher revenue share derived from take rate", async () => {
    const r = await run({ method: "GET", query: { action: "earnings", key: "dev_bob" } });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.revenue_share_pct, (1 - billing.TAKE_RATE) * 100);
    assert.strictEqual(r._body.payout_threshold, 100);
  });
  await test("earnings rejects missing key", async () => {
    const r = await run({ method: "GET", query: { action: "earnings" } });
    assert.strictEqual(r._status, 400);
  });

  // ── checkout ──────────────────────────────────────────────────────
  await test("create_checkout in demo mode credits balance immediately", async () => {
    billing._reset();
    const before = await run({ method: "GET", query: { action: "balance", id: "adv_charlie" } });
    const r = await run({
      method: "POST", query: { action: "create_checkout" },
      body: { advertiser_id: "adv_charlie", amount: 250, email: "c@x.com" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
    assert.strictEqual(r._body.deposited, 250);
    assert.strictEqual(r._body.balance, before._body.balance + 250);
  });
  await test("create_checkout rejects sub-$10 deposits", async () => {
    const r = await run({
      method: "POST", query: { action: "create_checkout" },
      body: { advertiser_id: "adv_x", amount: 5, email: "x@x.com" },
    });
    assert.strictEqual(r._status, 400);
  });
  await test("create_checkout rejects missing fields", async () => {
    const r = await run({
      method: "POST", query: { action: "create_checkout" },
      body: { advertiser_id: "adv_x" },
    });
    assert.strictEqual(r._status, 400);
  });

  // ── connect ───────────────────────────────────────────────────────
  await test("create_connect issues a deterministic demo Stripe account id", async () => {
    const r = await run({
      method: "POST", query: { action: "create_connect" },
      body: { developer_id: "dev_dana", email: "dana@x.com" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
    assert.ok(r._body.stripe_account_id.startsWith("acct_demo_"));
  });

  // ── invoice generation off the ledger ─────────────────────────────
  await test("invoice sums won_price_cpm/1000 from ledger for the period", async () => {
    ledger._reset();
    billing._reset();
    // Seed three winning bids for the advertiser
    await ledger.recordAuction({ id: "auc_a", imp: [{ id: "i1" }], site: { domain: "cursor.com" } }, "seat_demo");
    const b1 = await ledger.recordBid("auc_a", { id: "bid_1", impid: "i1", price: 12.5 }, "cam_acme_001", "seat_demo");
    const b2 = await ledger.recordBid("auc_a", { id: "bid_2", impid: "i1", price: 8.0  }, "cam_acme_001", "seat_demo");
    const b3 = await ledger.recordBid("auc_a", { id: "bid_3", impid: "i1", price: 20.0 }, "cam_other_002", "seat_demo");
    await ledger.recordWin(b1.id, 12.5);
    await ledger.recordWin(b2.id, 8.0);
    await ledger.recordWin(b3.id, 20.0);

    const r = await run({
      method: "POST", query: { action: "invoice" },
      body: { advertiser_id: "adv_acme", campaign_ids: ["cam_acme_001"] },
    });
    assert.strictEqual(r._status, 200);
    // 12.5/1000 + 8/1000 = 0.0205
    assert.ok(Math.abs(r._body.invoice.subtotal_usd - 0.0205) < 1e-6, `got ${r._body.invoice.subtotal_usd}`);
    assert.strictEqual(r._body.invoice.impressions, 2);
    assert.strictEqual(r._body.invoice.line_items.length, 1);
    assert.strictEqual(r._body.invoice.line_items[0].campaign_id, "cam_acme_001");
    assert.strictEqual(r._body.invoice.status, "draft");
  });

  await test("invoice with finalize=true marks it finalized and deducts demo balance", async () => {
    ledger._reset();
    billing._reset();
    await ledger.recordAuction({ id: "auc_f", imp: [{ id: "i1" }], site: { domain: "cursor.com" } }, "seat_demo");
    const b = await ledger.recordBid("auc_f", { id: "bid_f1", impid: "i1", price: 1000 }, "cam_acme_001", "seat_demo");
    await ledger.recordWin(b.id, 1000); // 1000 CPM = $1.00 per imp

    // Top up balance first so the deduction is visible
    await run({ method: "POST", query: { action: "create_checkout" }, body: { advertiser_id: "adv_acme", amount: 50, email: "x@x.com" } });
    const balBefore = (await run({ method: "GET", query: { action: "balance", id: "adv_acme" } }))._body.balance;

    const r = await run({
      method: "POST", query: { action: "invoice" },
      body: { advertiser_id: "adv_acme", campaign_ids: ["cam_acme_001"], finalize: true },
    });
    assert.strictEqual(r._body.invoice.status, "finalized_demo");
    const balAfter = (await run({ method: "GET", query: { action: "balance", id: "adv_acme" } }))._body.balance;
    assert.ok(Math.abs((balBefore - balAfter) - r._body.invoice.total_usd) < 1e-6,
      `expected balance to drop by ${r._body.invoice.total_usd}, dropped by ${balBefore - balAfter}`);
  });

  await test("invoice with no wins returns subtotal=0", async () => {
    ledger._reset();
    billing._reset();
    const r = await run({
      method: "POST", query: { action: "invoice" },
      body: { advertiser_id: "adv_zero" },
    });
    assert.strictEqual(r._body.invoice.subtotal_usd, 0);
    assert.strictEqual(r._body.invoice.impressions, 0);
  });

  // ── payout (publisher Connect transfer) ───────────────────────────
  await test("payout splits revenue 70/30 by default and lists per-publisher transfers", async () => {
    ledger._reset();
    billing._reset();
    // Two publishers, each with one winning bid
    await ledger.recordAuction({ id: "auc_p1", imp: [{id:"i1"}], site: { domain: "cursor.com" } }, "seat_demo");
    await ledger.recordAuction({ id: "auc_p2", imp: [{id:"i1"}], site: { domain: "perplexity.ai" } }, "seat_demo");
    const b1 = await ledger.recordBid("auc_p1", { id: "bp_1", impid: "i1", price: 200000 }, "c1", "seat_demo"); // $200 worth
    const b2 = await ledger.recordBid("auc_p2", { id: "bp_2", impid: "i1", price: 100000 }, "c2", "seat_demo"); // $100 worth
    await ledger.recordWin(b1.id, 200000);
    await ledger.recordWin(b2.id, 100000);

    const r = await run({ method: "POST", query: { action: "payout" }, body: { dry_run: true } });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.publishers, 2);
    assert.strictEqual(r._body.dry_run, true);
    // Cursor: $200 gross → $140 payout (eligible). Perplexity: $100 → $70 (below $100 threshold)
    const cursor = r._body.transfers.find((t) => t.publisher === "cursor.com");
    const ppx    = r._body.transfers.find((t) => t.publisher === "perplexity.ai");
    const expectedCursor = +(200 * (1 - billing.TAKE_RATE)).toFixed(4);
    const expectedPpx    = +(100 * (1 - billing.TAKE_RATE)).toFixed(4);
    assert.ok(Math.abs(cursor.payout_usd - expectedCursor) < 1e-6, `cursor payout: ${cursor.payout_usd} (expected ${expectedCursor})`);
    assert.strictEqual(cursor.eligible, true);
    assert.ok(Math.abs(ppx.payout_usd - expectedPpx) < 1e-6, `ppx payout: ${ppx.payout_usd} (expected ${expectedPpx})`);
    assert.strictEqual(ppx.eligible, false);
    assert.strictEqual(r._body.eligible, 1);
  });

  await test("payout returns 0 publishers when no wins in window", async () => {
    ledger._reset();
    const r = await run({ method: "POST", query: { action: "payout" }, body: { dry_run: true } });
    assert.strictEqual(r._body.publishers, 0);
    assert.strictEqual(r._body.total_payout_usd, 0);
  });

  // ── webhook ───────────────────────────────────────────────────────
  await test("webhook in demo mode accepts events but tags them untrusted", async () => {
    billing._reset();
    const r = await run({
      method: "POST", query: { action: "webhook" },
      body: { type: "checkout.session.completed", data: { object: { metadata: { advertiser_id: "adv_wh", amount: "100" } } } },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.received, true);
    // Balance should have been credited
    const bal = await run({ method: "GET", query: { action: "balance", id: "adv_wh" } });
    assert.strictEqual(bal._body.balance, 5100); // 5000 default + 100
  });

  await test("webhook rejects empty body", async () => {
    const r = await run({ method: "POST", query: { action: "webhook" }, body: null });
    assert.strictEqual(r._status, 400);
  });

  await test("webhook records event in audit log", async () => {
    billing._reset();
    await run({
      method: "POST", query: { action: "webhook" },
      body: { type: "payment_intent.succeeded", data: { object: {} } },
    });
    assert.strictEqual(billing._DEMO.events.length, 1);
    assert.strictEqual(billing._DEMO.events[0].type, "payment_intent.succeeded");
    assert.strictEqual(billing._DEMO.events[0].untrusted, true);
  });

  // ── deposit cap ────────────────────────────────────────────────────
  await test("create_checkout rejects deposits over $100,000", async () => {
    const r = await run({
      method: "POST", query: { action: "create_checkout" },
      body: { advertiser_id: "adv_rich", amount: 150000, email: "rich@x.com" },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("100,000"));
  });

  await test("create_checkout accepts exactly $100,000", async () => {
    billing._reset();
    const r = await run({
      method: "POST", query: { action: "create_checkout" },
      body: { advertiser_id: "adv_rich", amount: 100000, email: "rich@x.com" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.deposited, 100000);
  });

  await test("create_checkout rejects non-finite amount (NaN)", async () => {
    const r = await run({
      method: "POST", query: { action: "create_checkout" },
      body: { advertiser_id: "adv_x", amount: "notanumber", email: "x@x.com" },
    });
    assert.strictEqual(r._status, 400);
  });

  await test("create_checkout rejects Infinity", async () => {
    const r = await run({
      method: "POST", query: { action: "create_checkout" },
      body: { advertiser_id: "adv_x", amount: Infinity, email: "x@x.com" },
    });
    assert.strictEqual(r._status, 400);
  });

  // ── webhook idempotency ──────────────────────────────────────────
  billing._reset();
  await test("webhook deduplicates events by id", async () => {
    const event = {
      id: "evt_dedup_test_001",
      type: "checkout.session.completed",
      data: { object: { metadata: { advertiser_id: "adv_dedup", amount: "50" } } },
    };
    const r1 = await run({ method: "POST", query: { action: "webhook" }, body: event });
    assert.strictEqual(r1._status, 200);
    assert.strictEqual(r1._body.received, true);
    assert(!r1._body.duplicate, "first call should not be marked duplicate");

    // Send the exact same event again
    const r2 = await run({ method: "POST", query: { action: "webhook" }, body: event });
    assert.strictEqual(r2._status, 200);
    assert.strictEqual(r2._body.duplicate, true, "second call should be duplicate");
  });

  await test("duplicate webhook does not double-credit balance", async () => {
    // adv_dedup was credited $50 by first webhook, default balance is $5000
    const bal = await run({ method: "GET", query: { action: "balance", id: "adv_dedup" } });
    assert.strictEqual(bal._body.balance, 5050, `expected 5050, got ${bal._body.balance}`);
  });

  await test("_reset clears processedWebhookIds", () => {
    billing._reset();
    assert.strictEqual(billing._DEMO.processedWebhookIds.size, 0);
  });

  // ── charge.refunded ──────────────────────────────────────────────
  billing._reset();
  await test("charge.refunded deducts from advertiser balance in demo mode", async () => {
    // First, ensure the advertiser has some balance
    const balBefore = (await run({ method: "GET", query: { action: "balance", id: "adv_refund" } }))._body.balance;
    assert.strictEqual(balBefore, 5000); // default

    const r = await run({
      method: "POST", query: { action: "webhook" },
      body: {
        type: "charge.refunded",
        data: { object: { amount_refunded: 7500, metadata: { advertiser_id: "adv_refund" } } },
      },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.event_type, "charge.refunded");

    const balAfter = (await run({ method: "GET", query: { action: "balance", id: "adv_refund" } }))._body.balance;
    assert.strictEqual(balAfter, 4925, `expected 5000-75=4925, got ${balAfter}`); // 7500 cents = $75
  });

  await test("charge.refunded does not go below zero", async () => {
    billing._reset();
    // Set up advertiser with $5000 then refund $600000 ($6000 — more than balance)
    await run({ method: "GET", query: { action: "balance", id: "adv_broke" } }); // creates with $5000
    const r = await run({
      method: "POST", query: { action: "webhook" },
      body: {
        type: "charge.refunded",
        data: { object: { amount_refunded: 600000, metadata: { advertiser_id: "adv_broke" } } },
      },
    });
    assert.strictEqual(r._status, 200);
    const bal = (await run({ method: "GET", query: { action: "balance", id: "adv_broke" } }))._body.balance;
    assert.strictEqual(bal, 0, `expected floor of 0, got ${bal}`);
  });

  // ── charge.failed ────────────────────────────────────────────────
  await test("charge.failed records in audit log but does not change balance", async () => {
    billing._reset();
    await run({ method: "GET", query: { action: "balance", id: "adv_fail" } }); // creates $5000
    const r = await run({
      method: "POST", query: { action: "webhook" },
      body: {
        type: "charge.failed",
        data: { object: { id: "ch_failed_001", failure_message: "card_declined", amount: 10000, metadata: { advertiser_id: "adv_fail" } } },
      },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.event_type, "charge.failed");

    // Balance should remain unchanged (no credit for failed charges)
    const bal = (await run({ method: "GET", query: { action: "balance", id: "adv_fail" } }))._body.balance;
    assert.strictEqual(bal, 5000, `expected 5000 (unchanged), got ${bal}`);

    // Event should be in the audit log
    assert(billing._DEMO.events.some(e => e.type === "charge.failed"), "charge.failed should be in audit log");
  });

  // ── Phase E Day 1 — Stripe Connect onboarding + state machine ──────
  // These tests run in demo mode (no Stripe SDK). They cover the
  // request-routing and state-transition logic in billing.js.

  await test("create_connect returns demo onboarding stub", async () => {
    billing._reset();
    const r = await run({
      method: "POST", query: { action: "create_connect" },
      body: { developer_id: "dev_phaseE_1", email: "phaseE@example.com" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
    assert(r._body.stripe_account_id.startsWith("acct_demo_"));
  });

  await test("refresh_connect rejects unknown developer", async () => {
    billing._reset();
    const r = await run({
      method: "POST", query: { action: "refresh_connect" },
      body: { developer_id: "dev_no_stripe_yet" },
    });
    // In demo mode without prior create_connect, we hit the "demo" path
    // which returns 200 + null onboarding_url, NOT 404. That's correct:
    // demo mode never has a real Stripe account to refresh against.
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
    assert.strictEqual(r._body.onboarding_url, null);
  });

  await test("refresh_connect rejects missing developer_id", async () => {
    const r = await run({
      method: "POST", query: { action: "refresh_connect" },
      body: {},
    });
    assert.strictEqual(r._status, 400);
    assert(/Missing developer_id/.test(r._body.error));
  });

  await test("payout_status returns shape for new developer in demo mode", async () => {
    billing._reset();
    const r = await run({
      method: "GET",
      query: { action: "payout_status", developer_id: "dev_status_demo" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
    assert.strictEqual(r._body.payout_blocked, false);
    assert.strictEqual(r._body.balance, 0);
    assert.strictEqual(r._body.lifetime_paid, 0);
    // No stripe account yet → next_payout_eta is null (demo synth)
    assert.strictEqual(r._body.payouts_enabled, false);
  });

  await test("payout_status rejects missing developer_id", async () => {
    const r = await run({
      method: "GET", query: { action: "payout_status" },
    });
    assert.strictEqual(r._status, 400);
    assert(/Missing developer_id/.test(r._body.error));
  });

  await test("payout_status only accepts GET", async () => {
    const r = await run({
      method: "POST", query: { action: "payout_status" },
      body: { developer_id: "anything" },
    });
    assert.strictEqual(r._status, 405);
  });

  await test("refresh_connect only accepts POST", async () => {
    const r = await run({
      method: "GET", query: { action: "refresh_connect" },
    });
    assert.strictEqual(r._status, 405);
  });

  // ── account.updated state machine ──
  // In demo mode the webhook updates the in-memory developer record.
  // We exercise both "enabled" and "blocked" transitions.

  await test("account.updated with payouts_enabled=true clears block flags", async () => {
    billing._reset();
    const r = await run({
      method: "POST", query: { action: "webhook" },
      body: {
        type: "account.updated",
        data: { object: {
          id: "acct_phE_clean", payouts_enabled: true, charges_enabled: true,
          requirements: { currently_due: [] },
          capabilities: { transfers: "active" },
          metadata: { developer_id: "dev_phE_clean" },
        }},
      },
    });
    assert.strictEqual(r._status, 200);
    const d = billing._DEMO.developers.get("dev_phE_clean");
    assert(d, "developer should exist in demo store");
    assert.strictEqual(d.payouts_enabled, true);
    assert.strictEqual(d.payout_blocked, false);
    assert.strictEqual(d.stripe_account_id, "acct_phE_clean");
  });

  await test("account.updated with requirements.currently_due sets blocked", async () => {
    billing._reset();
    await run({
      method: "POST", query: { action: "webhook" },
      body: {
        type: "account.updated",
        data: { object: {
          id: "acct_phE_blocked", payouts_enabled: false, charges_enabled: false,
          requirements: { currently_due: ["individual.id_number", "tos_acceptance.date"] },
          capabilities: {},
          metadata: { developer_id: "dev_phE_blocked" },
        }},
      },
    });
    const d = billing._DEMO.developers.get("dev_phE_blocked");
    assert.strictEqual(d.payouts_enabled, false);
    assert.strictEqual(d.payout_blocked, true);
    assert(d.payout_blocked_reason.includes("requirements_due"));
    assert.strictEqual(d.stripe_requirements_due.length, 2);
  });

  await test("account.updated capabilities.instant_payouts='active' flips opt-in flag", async () => {
    billing._reset();
    await run({
      method: "POST", query: { action: "webhook" },
      body: {
        type: "account.updated",
        data: { object: {
          id: "acct_phE_instant", payouts_enabled: true, charges_enabled: true,
          requirements: { currently_due: [] },
          capabilities: { transfers: "active", instant_payouts: "active" },
          metadata: { developer_id: "dev_phE_instant" },
        }},
      },
    });
    const d = billing._DEMO.developers.get("dev_phE_instant");
    assert.strictEqual(d.instant_payouts_enabled, true);
  });

  await test("webhook handles event without developer_id metadata silently", async () => {
    billing._reset();
    const r = await run({
      method: "POST", query: { action: "webhook" },
      body: {
        type: "account.updated",
        data: { object: {
          id: "acct_no_meta", payouts_enabled: true, charges_enabled: true,
          requirements: { currently_due: [] },
          // no metadata at all
        }},
      },
    });
    assert.strictEqual(r._status, 200);
    // No developer record was created (we keyed off metadata.developer_id)
  });

  // Clawback helper is exported for testing; verify it gracefully no-ops
  // when there's no Supabase (demo mode can't simulate the full clawback
  // path, but we want the export wired so the Day 2/3 tests can exercise it).
  await test("_fireRefundClawbacks export exists and tolerates null sb", async () => {
    assert.strictEqual(typeof billing._fireRefundClawbacks, "function");
    // Should not throw with sb=null
    await billing._fireRefundClawbacks(null, "adv_x", 10, "ch_x");
  });

  // ── Phase E Day 3 — autonomous payout cron ─────────────────────────
  // Demo-mode runs walk in-memory DEMO maps; no Stripe, no Supabase, but
  // the full state-machine logic (eligibility, threshold, blocked-skip,
  // balance decrement, payout row insert) exercises end-to-end.
  const publisherBalance = require("../api/_lib/publisher_balance.js");

  await test("run_payout_cron requires POST", async () => {
    const r = await run({ method: "GET", query: { action: "run_payout_cron" } });
    assert.strictEqual(r._status, 405);
  });

  await test("run_payout_cron in demo mode returns summary with zero attempts", async () => {
    billing._reset();
    publisherBalance._reset();
    const r = await run({
      method: "POST", query: { action: "run_payout_cron" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
    assert.strictEqual(r._body.publishers_attempted, 0);
    assert.strictEqual(r._body.succeeded, 0);
  });

  await test("run_payout_cron skips developer with payouts_enabled=false", async () => {
    billing._reset();
    publisherBalance._reset();
    // Seed a developer with balance but payouts disabled
    const d = billing._DEMO.developers;
    d.set("dev_disabled", {
      id: "dev_disabled", payouts_enabled: false, payout_blocked: false,
      stripe_account_id: "acct_d", instant_payouts_enabled: false,
    });
    // Give them $100 balance
    publisherBalance._getDemoBalance("dev_disabled").balance = 100;
    publisherBalance._getDemoBalance("dev_disabled").lifetime_earned = 100;

    const r = await run({ method: "POST", query: { action: "run_payout_cron" } });
    assert.strictEqual(r._body.publishers_attempted, 0);
    assert.strictEqual(r._body.skipped, 1);
    // Balance unchanged
    assert.strictEqual(publisherBalance._getDemoBalance("dev_disabled").balance, 100);
  });

  await test("run_payout_cron skips blocked publisher", async () => {
    billing._reset();
    publisherBalance._reset();
    const d = billing._DEMO.developers;
    d.set("dev_blocked", {
      id: "dev_blocked", payouts_enabled: true, payout_blocked: true,
      stripe_account_id: "acct_b", instant_payouts_enabled: false,
    });
    publisherBalance._getDemoBalance("dev_blocked").balance = 100;
    const r = await run({ method: "POST", query: { action: "run_payout_cron" } });
    assert.strictEqual(r._body.publishers_attempted, 0);
    assert.strictEqual(r._body.skipped, 1);
  });

  await test("run_payout_cron skips publisher below $25 threshold", async () => {
    billing._reset();
    publisherBalance._reset();
    const d = billing._DEMO.developers;
    d.set("dev_below", {
      id: "dev_below", payouts_enabled: true, payout_blocked: false,
      stripe_account_id: "acct_x", instant_payouts_enabled: false,
    });
    publisherBalance._getDemoBalance("dev_below").balance = 24.99;
    const r = await run({ method: "POST", query: { action: "run_payout_cron" } });
    assert.strictEqual(r._body.publishers_attempted, 0);
    assert.strictEqual(r._body.skipped, 1);
  });

  await test("run_payout_cron pays eligible publisher and debits balance", async () => {
    billing._reset();
    publisherBalance._reset();
    const d = billing._DEMO.developers;
    d.set("dev_pay", {
      id: "dev_pay", payouts_enabled: true, payout_blocked: false,
      stripe_account_id: "acct_pay", instant_payouts_enabled: false,
    });
    publisherBalance._getDemoBalance("dev_pay").balance = 50;
    publisherBalance._getDemoBalance("dev_pay").lifetime_earned = 50;
    const r = await run({ method: "POST", query: { action: "run_payout_cron" } });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.publishers_attempted, 1);
    assert.strictEqual(r._body.succeeded, 1);
    assert.strictEqual(r._body.total_usd, 50);
    // Balance debited, lifetime_paid bumped
    const bal = publisherBalance._getDemoBalance("dev_pay");
    assert.strictEqual(bal.balance, 0);
    assert.strictEqual(bal.lifetime_paid, 50);
    // lifetime_earned unchanged (we didn't earn anything; we paid out)
    assert.strictEqual(bal.lifetime_earned, 50);
  });

  await test("run_payout_cron with instant_payouts_enabled deducts fee from amount", async () => {
    billing._reset();
    publisherBalance._reset();
    const d = billing._DEMO.developers;
    d.set("dev_instant", {
      id: "dev_instant", payouts_enabled: true, payout_blocked: false,
      stripe_account_id: "acct_i", instant_payouts_enabled: true,
    });
    publisherBalance._getDemoBalance("dev_instant").balance = 100;
    const r = await run({ method: "POST", query: { action: "run_payout_cron" } });
    assert.strictEqual(r._body.succeeded, 1);
    // Instant fee: $0.50 + 1.5% of $100 = $0.50 + $1.50 = $2.00.
    // Recorded payout amount = $100 - $2 = $98.
    const row = Array.from(billing._DEMO.payouts.values()).find(p => p.developer_id === "dev_instant");
    assert(row, "demo payout row should exist");
    assert.strictEqual(row.method, "instant");
    assert.strictEqual(row.fee_usd, 2);
    assert.strictEqual(row.amount, 98);
  });

  await test("run_payout_retry_sweep returns demo summary without retries", async () => {
    billing._reset();
    const r = await run({
      method: "POST", query: { action: "run_payout_retry_sweep" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
    assert.strictEqual(r._body.retried, 0);
  });

  await test("run_payout_retry_sweep requires POST", async () => {
    const r = await run({ method: "GET", query: { action: "run_payout_retry_sweep" } });
    assert.strictEqual(r._status, 405);
  });

  // ── Phase E Day 4 — admin endpoints ────────────────────────────────
  await test("admin_payouts_list returns demo summary with empty body", async () => {
    billing._reset();
    const r = await run({ method: "GET", query: { action: "admin_payouts_list" } });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
    assert.strictEqual(r._body.count, 0);
    assert(Array.isArray(r._body.payouts));
  });

  await test("admin_payouts_list filters by status", async () => {
    billing._reset();
    publisherBalance._reset();
    // Seed two demo payout rows with different statuses
    billing._DEMO.payouts.set("p1", {
      id: "p1", developer_id: "dev_x", status: "paid", amount: 50,
      created_at: new Date().toISOString(),
    });
    billing._DEMO.payouts.set("p2", {
      id: "p2", developer_id: "dev_x", status: "failed", amount: 30,
      created_at: new Date().toISOString(),
    });
    const r = await run({
      method: "GET",
      query: { action: "admin_payouts_list", status: "failed" },
    });
    assert.strictEqual(r._body.count, 1);
    assert.strictEqual(r._body.payouts[0].status, "failed");
  });

  await test("admin_payouts_list rejects POST", async () => {
    const r = await run({ method: "POST", query: { action: "admin_payouts_list" } });
    assert.strictEqual(r._status, 405);
  });

  await test("admin_force_retry resets demo payout to pending", async () => {
    billing._reset();
    billing._DEMO.payouts.set("p_force", {
      id: "p_force", developer_id: "dev_y", status: "failed",
      retry_count: 3, failure_tier: 1, amount: 25,
      created_at: new Date().toISOString(),
    });
    const r = await run({
      method: "POST", query: { action: "admin_force_retry" },
      body: { payout_id: "p_force" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.reset, true);
    const row = billing._DEMO.payouts.get("p_force");
    assert.strictEqual(row.status, "pending");
    assert.strictEqual(row.retry_count, 0);
    assert.strictEqual(row.failure_tier, null);
  });

  await test("admin_force_retry 404s for unknown payout_id", async () => {
    billing._reset();
    const r = await run({
      method: "POST", query: { action: "admin_force_retry" },
      body: { payout_id: "doesnotexist" },
    });
    assert.strictEqual(r._status, 404);
  });

  await test("admin_force_retry requires payout_id", async () => {
    const r = await run({
      method: "POST", query: { action: "admin_force_retry" }, body: {},
    });
    assert.strictEqual(r._status, 400);
  });

  await test("admin_unblock_publisher clears block flags", async () => {
    billing._reset();
    billing._DEMO.developers.set("dev_unblk", {
      id: "dev_unblk", email: "blk@x.test",
      payout_blocked: true, payout_blocked_reason: "stripe_payout_failed: card_declined",
    });
    const r = await run({
      method: "POST", query: { action: "admin_unblock_publisher" },
      body: { developer_id: "dev_unblk", reason: "resolved out of band" },
    });
    assert.strictEqual(r._status, 200);
    const d = billing._DEMO.developers.get("dev_unblk");
    assert.strictEqual(d.payout_blocked, false);
    assert.strictEqual(d.payout_blocked_reason, null);
  });

  await test("admin_unblock_publisher 404s for unknown developer", async () => {
    billing._reset();
    const r = await run({
      method: "POST", query: { action: "admin_unblock_publisher" },
      body: { developer_id: "ghost" },
    });
    assert.strictEqual(r._status, 404);
  });

  await test("admin_blocked_publishers lists only blocked developers", async () => {
    billing._reset();
    billing._DEMO.developers.set("dev_ok", {
      id: "dev_ok", email: "ok@x.test", payout_blocked: false,
    });
    billing._DEMO.developers.set("dev_b1", {
      id: "dev_b1", email: "blk1@x.test", payout_blocked: true,
      payout_blocked_reason: "requirements_due", payout_blocked_at: new Date().toISOString(),
    });
    billing._DEMO.developers.set("dev_b2", {
      id: "dev_b2", email: "blk2@x.test", payout_blocked: true,
      payout_blocked_reason: "stripe_payout_failed", payout_blocked_at: new Date().toISOString(),
    });
    const r = await run({
      method: "GET", query: { action: "admin_blocked_publishers" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.count, 2);
    const emails = r._body.blocked.map((p) => p.email).sort();
    assert.deepStrictEqual(emails, ["blk1@x.test", "blk2@x.test"]);
  });

  await test("admin_blocked_publishers rejects POST", async () => {
    const r = await run({
      method: "POST", query: { action: "admin_blocked_publishers" },
    });
    assert.strictEqual(r._status, 405);
  });

  // ── Phase E Day 5 — e2e_inventory diagnostic ───────────────────────
  await test("e2e_inventory returns demo-mode message", async () => {
    const r = await run({
      method: "GET", query: { action: "e2e_inventory" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
    assert(/only meaningful in Supabase/i.test(r._body.message));
  });

  await test("e2e_inventory rejects POST", async () => {
    const r = await run({
      method: "POST", query: { action: "e2e_inventory" },
    });
    assert.strictEqual(r._status, 405);
  });

  // ── Phase E Day 6 — currency detection + admin_sync_stripe_account ──
  await test("getPlatformCurrency falls back to usd with null Stripe client", async () => {
    billing._resetPlatformCurrencyCache();
    const cur = await billing._getPlatformCurrency(null);
    assert.strictEqual(cur, "usd");
  });

  await test("getPlatformCurrency uses available[0].currency from balance retrieve", async () => {
    billing._resetPlatformCurrencyCache();
    const fakeStripe = {
      balance: {
        retrieve: async () => ({
          available: [{ currency: "sgd", amount: 11900 }],
          pending: [{ currency: "sgd", amount: 5924 }],
        }),
      },
    };
    const cur = await billing._getPlatformCurrency(fakeStripe);
    assert.strictEqual(cur, "sgd");
  });

  await test("getPlatformCurrency caches result within TTL", async () => {
    billing._resetPlatformCurrencyCache();
    let callCount = 0;
    const fakeStripe = {
      balance: {
        retrieve: async () => {
          callCount++;
          return { available: [{ currency: "eur", amount: 0 }] };
        },
      },
    };
    await billing._getPlatformCurrency(fakeStripe);
    await billing._getPlatformCurrency(fakeStripe);
    await billing._getPlatformCurrency(fakeStripe);
    assert.strictEqual(callCount, 1, "second + third calls should hit cache");
  });

  await test("getPlatformCurrency falls back when retrieve throws", async () => {
    billing._resetPlatformCurrencyCache();
    const brokenStripe = {
      balance: {
        retrieve: async () => { throw new Error("nope"); },
      },
    };
    const cur = await billing._getPlatformCurrency(brokenStripe);
    assert.strictEqual(cur, "usd");
  });

  await test("admin_sync_stripe_account requires POST", async () => {
    const r = await run({ method: "GET", query: { action: "admin_sync_stripe_account" } });
    assert.strictEqual(r._status, 405);
  });

  await test("admin_sync_stripe_account requires developer_id", async () => {
    const r = await run({
      method: "POST", query: { action: "admin_sync_stripe_account" }, body: {},
    });
    assert.strictEqual(r._status, 400);
  });

  await test("admin_sync_stripe_account demo mode 500s (requires Stripe+Supabase)", async () => {
    const r = await run({
      method: "POST", query: { action: "admin_sync_stripe_account" },
      body: { developer_id: "anything" },
    });
    assert.strictEqual(r._status, 500);
    assert(/Stripe/.test(r._body.error));
  });

  // ── Phase F — integration_verify ────────────────────────────────────
  await test("integration_verify requires GET", async () => {
    const r = await run({
      method: "POST", query: { action: "integration_verify" },
      body: { developer_id: "x" },
    });
    assert.strictEqual(r._status, 405);
  });

  await test("integration_verify requires developer_id", async () => {
    const r = await run({
      method: "GET", query: { action: "integration_verify" },
    });
    assert.strictEqual(r._status, 400);
  });

  await test("integration_verify demo mode returns all-doors-inactive shape", async () => {
    const r = await run({
      method: "GET",
      query: { action: "integration_verify", developer_id: "dev_demo_e2e" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
    assert.strictEqual(r._body.any_active, false);
    assert.strictEqual(r._body.first_door_at, null);
    for (const door of ["mcp", "js-snippet", "npm-sdk", "rest-api"]) {
      assert(r._body[door], "should have row for door " + door);
      assert.strictEqual(r._body[door].active, false);
      assert.strictEqual(r._body[door].impressions_24h, 0);
      assert.strictEqual(r._body[door].clicks_24h, 0);
      assert.strictEqual(r._body[door].last_seen_at, null);
    }
  });

  await test("integration_verify accepts ?id= as alias for developer_id", async () => {
    const r = await run({
      method: "GET",
      query: { action: "integration_verify", id: "dev_alias_e2e" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "demo");
  });

  console.log();
  if (failed) { console.log(`\x1b[31m${failed} failed\x1b[0m, ${passed} passed.`); process.exit(1); }
  else console.log(`\x1b[32m${passed} checks passed.\x1b[0m`);
})();
