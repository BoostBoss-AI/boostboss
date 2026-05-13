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

  // ── Summary ─────────────────────────────────────────────────────────
  console.log();
  if (failed) { console.log(`\x1b[31m${failed} failed\x1b[0m, ${passed} passed.`); process.exit(1); }
  else console.log(`\x1b[32m${passed} tests passed.\x1b[0m`);
})();
