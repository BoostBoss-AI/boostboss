/**
 * Boost Boss — stats.js smoke test (demo-mode path).
 * Run: node tests/stats.test.js
 *
 * Focused on the Phase H Panel 1 endpoint (type=live_activity). The
 * Supabase-backed code paths in stats.js are exercised by the recon
 * suite + the validation runbook; this file's purpose is to lock in
 * the live_activity contract that the admin UI depends on.
 */

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const assert = require("assert");
const stats = require("../api/stats.js");

function mockReqRes({ method = "GET", body = null, query = {}, headers = {} } = {}) {
  const res = {
    _status: 200, _headers: {}, _body: null,
    setHeader(k, v) { this._headers[k.toLowerCase()] = v; },
    status(n) { this._status = n; return this; },
    json(o) { this._body = o; this._headers["content-type"] = "application/json"; return this; },
    end() { return this; },
  };
  return { req: { method, body, query, headers }, res };
}
async function run(spec) { const { req, res } = mockReqRes(spec); await stats(req, res); return res; }

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log("  \x1b[32mok\x1b[0m  " + name); passed++; }
  catch (e) { console.log("  \x1b[31mFAIL\x1b[0m  " + name + ": " + e.message); failed++; }
}

(async () => {
  console.log("Boost Boss · stats.js · demo-mode smoke test\n");

  await test("HAS_SUPABASE is false in demo mode", () => {
    assert.strictEqual(stats.HAS_SUPABASE, false);
  });

  await test("OPTIONS preflight returns 200", async () => {
    const r = await run({ method: "OPTIONS" });
    assert.strictEqual(r._status, 200);
  });

  // ── live_activity ───────────────────────────────────────────────────
  await test("live_activity returns 200 with full shape in demo mode", async () => {
    const r = await run({ method: "GET", query: { type: "live_activity" } });
    assert.strictEqual(r._status, 200);
    const b = r._body;
    assert.strictEqual(b.mode, "production");
    assert(b.generated_at, "should include generated_at");
    assert(b.health, "should include health card");
    assert.strictEqual(typeof b.health.status, "string");
    assert(b.volume, "should include volume card");
    assert(b.money,  "should include money card");
    assert(Array.isArray(b.top_publishers), "top_publishers should be an array");
    assert(Array.isArray(b.top_campaigns),  "top_campaigns should be an array");
    assert(Array.isArray(b.by_door),        "by_door should be an array");
    assert.strictEqual(b.by_door.length, 4, "should have 4 doors");
    const doorIds = b.by_door.map((d) => d.door).sort();
    assert.deepStrictEqual(doorIds, ["js-snippet", "mcp", "npm-sdk", "rest-api"]);
    assert(Array.isArray(b.recent_alerts), "recent_alerts should be an array");
  });

  await test("live_activity respects mode=sandbox query param", async () => {
    const r = await run({ method: "GET", query: { type: "live_activity", mode: "sandbox" } });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "sandbox");
  });

  await test("live_activity defaults to production for unknown mode", async () => {
    const r = await run({ method: "GET", query: { type: "live_activity", mode: "bogus" } });
    assert.strictEqual(r._body.mode, "production");
  });

  await test("live_activity demo response has zeroed counters and known status enum", async () => {
    const r = await run({ method: "GET", query: { type: "live_activity" } });
    const b = r._body;
    assert(["healthy", "watch", "action_required"].includes(b.health.status));
    assert.strictEqual(b.volume.auctions_5m, 0);
    assert.strictEqual(b.volume.auctions_1h, 0);
    assert.strictEqual(b.volume.auctions_24h, 0);
    assert.strictEqual(b.money.advertiser_spend_24h, 0);
    assert.strictEqual(b.money.bb_revenue_24h, 0);
  });

  await test("live_activity rejects non-GET methods (would be 405-ish — currently falls through)", async () => {
    // POST falls through to the 400-default branch; we just want to lock
    // that it doesn't trigger handleLiveActivity.
    const r = await run({ method: "POST", query: { type: "live_activity" } });
    assert.strictEqual(r._status, 400);
  });

  // ── money_flow (Phase H Panel 2) ────────────────────────────────────
  await test("money_flow returns 200 with full shape in demo mode", async () => {
    const r = await run({ method: "GET", query: { type: "money_flow" } });
    assert.strictEqual(r._status, 200);
    const b = r._body;
    assert.strictEqual(b.mode, "production");
    assert(b.windows, "should include windows");
    assert(b.windows["24h"], "should include 24h window");
    assert(b.windows["7d"],  "should include 7d window");
    assert(b.windows["30d"], "should include 30d window");
    assert.strictEqual(typeof b.windows["24h"].advertiser_spend, "number");
    assert.strictEqual(typeof b.windows["24h"].bb_revenue, "number");
    assert.strictEqual(typeof b.windows["24h"].publisher_accrued, "number");
    assert.strictEqual(typeof b.windows["24h"].payouts_paid, "number");
    assert(Array.isArray(b.top_advertisers_by_spend_24h));
    assert(Array.isArray(b.top_publishers_by_balance));
    assert(b.eligible_for_next_payout, "should include eligible_for_next_payout");
  });

  await test("money_flow respects mode=sandbox", async () => {
    const r = await run({ method: "GET", query: { type: "money_flow", mode: "sandbox" } });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.mode, "sandbox");
  });

  await test("money_flow demo returns zeroed but well-shaped windows", async () => {
    const r = await run({ method: "GET", query: { type: "money_flow" } });
    const b = r._body;
    assert.strictEqual(b.windows["24h"].advertiser_spend, 0);
    assert.strictEqual(b.windows["7d"].advertiser_spend,  0);
    assert.strictEqual(b.windows["30d"].advertiser_spend, 0);
    assert.strictEqual(b.advertiser_deposits_24h, 0);
    assert.strictEqual(b.pending_clawbacks_total, 0);
    assert.strictEqual(b.eligible_for_next_payout.count, 0);
  });

  // ── auction_inspect (Phase H Panel 3) ───────────────────────────────
  await test("auction_inspect list returns 200 with empty list in demo mode", async () => {
    const r = await run({ method: "GET", query: { type: "auction_inspect" } });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.count, 0);
    assert(Array.isArray(r._body.logs));
  });

  await test("auction_inspect detail returns 404 for unknown id in demo mode", async () => {
    const r = await run({ method: "GET", query: { type: "auction_inspect", id: "no-such-id" } });
    assert.strictEqual(r._status, 404);
  });

  await test("auction_inspect rejects non-GET", async () => {
    const r = await run({ method: "POST", query: { type: "auction_inspect" } });
    assert.strictEqual(r._status, 400);
  });

  // ── Summary ─────────────────────────────────────────────────────────
  console.log();
  if (failed) { console.log(`\x1b[31m${failed} failed\x1b[0m, ${passed} passed.`); process.exit(1); }
  else console.log(`\x1b[32m${passed} tests passed.\x1b[0m`);
})();
