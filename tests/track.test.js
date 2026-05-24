/**
 * Boost Boss — track.js smoke test (demo-mode path).
 * Run: node api/track.test.js
 *
 * Exercises event tracking: impression/click/close/skip/video_complete,
 * pixel beacon (GET), JSON response (POST), cost computation, and validation.
 */

// Force demo mode
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const assert = require("assert");
const track = require("../api/track.js");

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
async function run(spec) { const { req, res } = mockReqRes(spec); await track(req, res); return res; }

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log("  \x1b[32mok\x1b[0m  " + name); passed++; }
  catch (e) { console.log("  \x1b[31mFAIL\x1b[0m  " + name + ": " + e.message); failed++; if (process.env.DEBUG) console.log(e.stack); }
}

(async () => {
  console.log("Event Tracking · demo-mode smoke test\n");

  // ── Meta ───────────────────────────────────────────────────────────
  await test("HAS_SUPABASE is false in demo mode", () =>
    assert.strictEqual(track.HAS_SUPABASE, false));

  await test("x-track-mode header set to 'demo'", async () => {
    track._reset();
    const r = await run({
      method: "POST",
      body: { event: "impression", campaign_id: "cam_test" },
    });
    assert.strictEqual(r._headers["x-track-mode"], "demo");
  });

  await test("OPTIONS preflight returns 200", async () => {
    const r = await run({ method: "OPTIONS" });
    assert.strictEqual(r._status, 200);
  });

  // ── POST tracking ──────────────────────────────────────────────────
  track._reset();
  await test("POST impression records event", async () => {
    const r = await run({
      method: "POST",
      body: { event: "impression", campaign_id: "cam_001", session_id: "s_1" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.tracked, true);
    assert.strictEqual(r._body.event, "impression");
    assert.strictEqual(r._body.campaign_id, "cam_001");
  });

  await test("POST click records event", async () => {
    const r = await run({
      method: "POST",
      body: { event: "click", campaign_id: "cam_001" },
    });
    assert.strictEqual(r._body.tracked, true);
    assert.strictEqual(r._body.event, "click");
  });

  await test("POST video_complete records event", async () => {
    const r = await run({
      method: "POST",
      body: { event: "video_complete", campaign_id: "cam_001" },
    });
    assert.strictEqual(r._body.tracked, true);
  });

  await test("POST close records event", async () => {
    const r = await run({
      method: "POST",
      body: { event: "close", campaign_id: "cam_001" },
    });
    assert.strictEqual(r._body.tracked, true);
  });

  await test("POST skip records event", async () => {
    const r = await run({
      method: "POST",
      body: { event: "skip", campaign_id: "cam_001" },
    });
    assert.strictEqual(r._body.tracked, true);
  });

  await test("demo events store has 5 events after all POSTs", () => {
    assert.strictEqual(track._DEMO_EVENTS.length, 5);
  });

  await test("each demo event has required fields", () => {
    for (const e of track._DEMO_EVENTS) {
      assert(e.event_type, "missing event_type");
      assert(e.campaign_id, "missing campaign_id");
      assert(e.created_at, "missing created_at");
    }
  });

  // ── GET pixel beacon ───────────────────────────────────────────────
  track._reset();
  await test("GET returns 1x1 pixel GIF for impression", async () => {
    const r = await run({
      method: "GET",
      query: { event: "impression", campaign_id: "cam_001", session: "s_1" },
    });
    assert.strictEqual(r._headers["content-type"], "image/gif");
    assert.strictEqual(r._headers["cache-control"], "no-store");
    assert(Buffer.isBuffer(r._body), "should return a Buffer");
    assert(r._body.length > 0, "GIF should not be empty");
  });

  await test("GET also stores event in demo store", () => {
    assert.strictEqual(track._DEMO_EVENTS.length, 1);
    assert.strictEqual(track._DEMO_EVENTS[0].event_type, "impression");
  });

  // ── Validation ─────────────────────────────────────────────────────
  await test("rejects missing event", async () => {
    const r = await run({
      method: "POST",
      body: { campaign_id: "cam_001" },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("Missing"));
  });

  await test("rejects missing campaign_id", async () => {
    const r = await run({
      method: "POST",
      body: { event: "impression" },
    });
    assert.strictEqual(r._status, 400);
  });

  await test("rejects invalid event type", async () => {
    const r = await run({
      method: "POST",
      body: { event: "purchase", campaign_id: "cam_001" },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("Invalid event"));
  });

  // ── Reset ──────────────────────────────────────────────────────────
  await test("_reset clears demo events", () => {
    track._reset();
    assert.strictEqual(track._DEMO_EVENTS.length, 0);
  });

  // ── Mode header on GET ─────────────────────────────────────────────
  await test("mode field is 'demo' in POST response", async () => {
    const r = await run({
      method: "POST",
      body: { event: "impression", campaign_id: "cam_x" },
    });
    assert.strictEqual(r._body.mode, "demo");
  });

  // ── Phase B: Conversion firing ─────────────────────────────────────
  // Conversions skip the campaign-existence check so tests can fire
  // them against arbitrary campaign_ids without seeding _DEMO_CAMPAIGNS.
  track._reset();
  await test("conversion event accepted with all required fields", async () => {
    const r = await run({
      method: "POST",
      body: {
        event:           "conversion",
        campaign_id:     "cam_conv_1",
        auction_id:      "auc_conv_1",
        conversion_type: "signup",
        value:           29.99,
        currency:        "USD",
        external_id:     "order_123",
      },
    });
    assert.strictEqual(r._status, 200, "should accept conversion");
    assert.strictEqual(r._body.tracked, true);
    assert.strictEqual(r._body.event, "conversion");
  });

  await test("conversion event populates conversion_type/value_cents/external_id", async () => {
    track._reset();
    await run({
      method: "POST",
      body: {
        event: "conversion", campaign_id: "cam_conv_2",
        conversion_type: "purchase", value: 49.5, external_id: "ord_42",
      },
    });
    const ev = track._DEMO_EVENTS[track._DEMO_EVENTS.length - 1];
    assert.strictEqual(ev.event_type, "conversion");
    assert.strictEqual(ev.conversion_type, "purchase");
    assert.strictEqual(ev.value_cents, 4950, "USD 49.5 → 4950 cents");
    assert.strictEqual(ev.external_id, "ord_42");
    assert.strictEqual(ev.currency, "USD");
  });

  await test("conversion accepts value via value_micros", async () => {
    track._reset();
    await run({
      method: "POST",
      body: {
        event: "conversion", campaign_id: "cam_conv_3",
        conversion_type: "lead",
        value_micros: 100000, // 100000 micros = $10
      },
    });
    const ev = track._DEMO_EVENTS[track._DEMO_EVENTS.length - 1];
    assert.strictEqual(ev.value_cents, 1000, "100000 micros = 1000 cents");
  });

  await test("conversion fields null when event != conversion", async () => {
    track._reset();
    await run({
      method: "POST",
      body: { event: "impression", campaign_id: "cam_conv_4",
              conversion_type: "signup", value: 9.99 },
    });
    const ev = track._DEMO_EVENTS[track._DEMO_EVENTS.length - 1];
    assert.strictEqual(ev.conversion_type, null);
    assert.strictEqual(ev.value_cents, null);
  });

  await test("conversion is recorded with X-Lumi-Source integration_method", async () => {
    track._reset();
    await run({
      method: "POST",
      body: { event: "conversion", campaign_id: "cam_conv_5",
              conversion_type: "signup" },
      headers: { "x-lumi-source": "npm-sdk" },
    });
    const ev = track._DEMO_EVENTS[track._DEMO_EVENTS.length - 1];
    assert.strictEqual(ev.integration_method, "npm-sdk");
  });

  await test("conversion via GET pixel beacon returns image", async () => {
    track._reset();
    const r = await run({
      method: "GET",
      query: {
        event: "conversion", campaign_id: "cam_conv_6",
        conversion_type: "signup", value: "5.00",
      },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._headers["content-type"], "image/gif");
  });

  // ── Phase E Day 2: per-event balance accrual ───────────────────────
  // These tests exercise the full accrual path including clawback
  // satisfaction. They run against the demo-mode in-memory store so
  // they're hermetic — no Supabase required.
  const publisherBalance = require("../api/_lib/publisher_balance.js");

  await test("paid impression credits publisher balance in demo mode", async () => {
    track._reset();
    // Seed a campaign so cost computation fires
    const camps = require("../api/campaigns.js")._DEMO_CAMPAIGNS;
    camps.set("cam_accrual_1", {
      id: "cam_accrual_1", status: "active", billing_model: "cpm",
      bid_amount: 10, daily_budget: 1000, total_budget: 10000,
      spent_today: 0, spent_total: 0,
    });

    const r = await run({
      method: "POST",
      body: {
        event: "impression", campaign_id: "cam_accrual_1",
        developer_id: "dev_accrual_1",
      },
    });
    assert.strictEqual(r._status, 200);

    const bal = publisherBalance._getDemoBalance("dev_accrual_1");
    // CPM=$10, impression cost = $10/1000 = $0.01, publisher share 85%
    // = $0.0085
    assert(bal.balance > 0, "balance should be > 0 after paid impression");
    assert(bal.lifetime_earned > 0, "lifetime_earned should track balance");
    assert.strictEqual(bal.balance, bal.lifetime_earned,
      "balance and lifetime_earned should match before any payouts");
  });

  await test("sandbox event does not accrue to publisher balance", async () => {
    track._reset();
    const camps = require("../api/campaigns.js")._DEMO_CAMPAIGNS;
    camps.set("cam_sbx", {
      id: "cam_sbx", status: "active", billing_model: "cpm",
      bid_amount: 10, daily_budget: 1000, total_budget: 10000,
      spent_today: 0, spent_total: 0,
    });
    // is_sandbox=true via the bbx_sandbox flag
    await run({
      method: "POST",
      body: {
        event: "impression", campaign_id: "cam_sbx",
        developer_id: "dev_sbx", bbx_sandbox: 1,
      },
    });
    const bal = publisherBalance._getDemoBalance("dev_sbx");
    assert.strictEqual(bal.balance, 0, "sandbox should not accrue");
    assert.strictEqual(bal.lifetime_earned, 0);
  });

  await test("pending clawback is satisfied by new earnings before balance accrues", async () => {
    track._reset();
    const camps = require("../api/campaigns.js")._DEMO_CAMPAIGNS;
    // CPC campaign so a single click earns enough to test
    camps.set("cam_cb", {
      id: "cam_cb", status: "active", billing_model: "cpc",
      bid_amount: 5, daily_budget: 1000, total_budget: 10000,
      spent_today: 0, spent_total: 0,
    });
    // Seed a $1 pending clawback for this developer
    publisherBalance._addDemoClawback("dev_cb", 1.00);

    // First click — earns $5 × 0.85 = $4.25. $1 satisfies clawback,
    // $3.25 lands in balance.
    await run({
      method: "POST",
      body: { event: "click", campaign_id: "cam_cb", developer_id: "dev_cb" },
    });
    const bal = publisherBalance._getDemoBalance("dev_cb");
    assert(bal.balance > 0, "balance should accrue what's left after clawback");
    assert(bal.balance < 4.25, "balance should be reduced by the clawback");
    const claws = publisherBalance._getDemoClawbacks("dev_cb");
    assert.strictEqual(claws[0].status, "applied",
      "clawback should be marked applied after being fully consumed");
    assert.strictEqual(claws[0].remaining_usd, 0);
  });

  await test("clawback larger than earning leaves balance at 0 and clawback partial", async () => {
    track._reset();
    const camps = require("../api/campaigns.js")._DEMO_CAMPAIGNS;
    camps.set("cam_big_cb", {
      id: "cam_big_cb", status: "active", billing_model: "cpc",
      bid_amount: 5, daily_budget: 1000, total_budget: 10000,
      spent_today: 0, spent_total: 0,
    });
    // $100 clawback — bigger than a single click's earnings
    publisherBalance._addDemoClawback("dev_big_cb", 100.00);
    await run({
      method: "POST",
      body: { event: "click", campaign_id: "cam_big_cb", developer_id: "dev_big_cb" },
    });
    const bal = publisherBalance._getDemoBalance("dev_big_cb");
    assert.strictEqual(bal.balance, 0,
      "balance should stay 0 while clawback is unsatisfied");
    const claws = publisherBalance._getDemoClawbacks("dev_big_cb");
    assert.strictEqual(claws[0].status, "pending",
      "clawback should stay pending until fully satisfied");
    assert(claws[0].remaining_usd < 100,
      "clawback remaining should drop by the earning amount");
    assert(claws[0].remaining_usd > 95,
      "clawback remaining should be ≈ $95.75 after $4.25 satisfies");
  });

  await test("non-paying event (no developer_payout) does not call credit", async () => {
    track._reset();
    // No campaign seeded; cost = 0; developer_payout = 0; credit skipped.
    const r = await run({
      method: "POST",
      body: { event: "close", campaign_id: "cam_nopay", developer_id: "dev_nopay" },
    });
    assert.strictEqual(r._status, 200);
    const bal = publisherBalance._getDemoBalance("dev_nopay");
    assert.strictEqual(bal.balance, 0);
    assert.strictEqual(bal.lifetime_earned, 0);
  });

  // ── Rate Limiting ───────────────────────────────────────────────────
  track._reset(); // also clears rateLimitMap
  await test("rate limiter allows up to RATE_LIMIT_MAX requests per IP", async () => {
    const max = track._RATE_LIMIT_MAX;
    assert(max > 0, "RATE_LIMIT_MAX should be positive");
    // Simulate max requests from the same IP
    for (let i = 0; i < max; i++) {
      const r = await run({
        method: "POST",
        body: { event: "impression", campaign_id: "cam_rl" },
        headers: { "x-forwarded-for": "10.0.0.99" },
      });
      assert.strictEqual(r._status, 200, `request ${i + 1} should succeed (got ${r._status})`);
    }
  });

  await test("rate limiter returns 429 after exceeding RATE_LIMIT_MAX", async () => {
    // The previous test already sent RATE_LIMIT_MAX requests from 10.0.0.99
    const r = await run({
      method: "POST",
      body: { event: "impression", campaign_id: "cam_rl" },
      headers: { "x-forwarded-for": "10.0.0.99" },
    });
    assert.strictEqual(r._status, 429);
    assert(r._body.error.includes("Rate limit"));
  });

  await test("rate limiter tracks IPs independently", async () => {
    // Different IP should still be allowed
    const r = await run({
      method: "POST",
      body: { event: "impression", campaign_id: "cam_rl" },
      headers: { "x-forwarded-for": "10.0.0.100" },
    });
    assert.strictEqual(r._status, 200);
  });

  await test("rate limiter resets after window expires", async () => {
    // Manually reset the entry for 10.0.0.99 to simulate window expiry
    const entry = track._rateLimitMap.get("10.0.0.99");
    assert(entry, "should have an entry for 10.0.0.99");
    entry.start = Date.now() - 61000; // push it 61s into the past
    const r = await run({
      method: "POST",
      body: { event: "impression", campaign_id: "cam_rl" },
      headers: { "x-forwarded-for": "10.0.0.99" },
    });
    assert.strictEqual(r._status, 200, "should allow after window reset");
  });

  await test("_reset clears rateLimitMap", () => {
    track._reset();
    assert.strictEqual(track._rateLimitMap.size, 0);
  });

  // ── Click redirect (Bot door) ──────────────────────────────────────
  await test("GET click with ?to= redirects 302 to the destination", async () => {
    track._reset();
    const r = await run({
      method: "GET",
      query: { event: "click", campaign_id: "cam_redir", to: "https://acme.example/landing?x=1" },
    });
    assert.strictEqual(r._status, 302, "should 302");
    assert.strictEqual(r._headers["location"], "https://acme.example/landing?x=1");
  });

  await test("GET click without ?to= still returns the 1x1 pixel", async () => {
    track._reset();
    const r = await run({
      method: "GET",
      query: { event: "click", campaign_id: "cam_pixel" },
    });
    assert.strictEqual(r._headers["content-type"], "image/gif");
    assert.notStrictEqual(r._status, 302);
  });

  await test("GET click rejects a non-http(s) ?to= (no open-redirect XSS)", async () => {
    track._reset();
    const r = await run({
      method: "GET",
      query: { event: "click", campaign_id: "cam_evil", to: "javascript:alert(1)" },
    });
    assert.notStrictEqual(r._status, 302, "must not redirect to a javascript: URL");
    assert.strictEqual(r._headers["content-type"], "image/gif", "falls back to the pixel");
  });

  await test("GET impression with ?to= also honours the redirect", async () => {
    track._reset();
    const r = await run({
      method: "GET",
      query: { event: "impression", campaign_id: "cam_imp_redir", to: "https://acme.example/x" },
    });
    assert.strictEqual(r._status, 302);
    assert.strictEqual(r._headers["location"], "https://acme.example/x");
  });

  // ── Summary ────────────────────────────────────────────────────────
  console.log();
  if (failed) { console.log(`\x1b[31m${failed} failed\x1b[0m, ${passed} passed.`); process.exit(1); }
  else console.log(`\x1b[32m${passed} tests passed.\x1b[0m`);
})();
