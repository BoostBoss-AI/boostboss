/**
 * Boost Boss — context fingerprinting test (Phase 0, capture now / score later).
 * Run: node tests/context.test.js
 *
 * Covers api/_lib/context.js (hash determinism, normalisation, demo-mode
 * fingerprint upsert) and the api/track.js integration that stamps
 * context_hash onto every event row.
 */

// Force demo mode — no Supabase.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const assert  = require("assert");
const context = require("../api/_lib/context.js");
const track   = require("../api/track.js");

const { deriveContextHash, normalizeContext, touchContextFingerprint } = context;

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
async function runTrack(spec) { const { req, res } = mockReqRes(spec); await track(req, res); return res; }

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log("  \x1b[32mok\x1b[0m  " + name); passed++; }
  catch (e) { console.log("  \x1b[31mFAIL\x1b[0m  " + name + ": " + e.message); failed++; if (process.env.DEBUG) console.log(e.stack); }
}

(async () => {
  console.log("Context fingerprinting · demo-mode test\n");

  // ── deriveContextHash ──────────────────────────────────────────────
  await test("same text yields the same hash", () => {
    assert.strictEqual(
      deriveContextHash("help me find a CRM"),
      deriveContextHash("help me find a CRM"));
  });

  await test("hash is prefixed ctx_", () => {
    assert.ok(/^ctx_[a-z0-9]+$/.test(deriveContextHash("buy running shoes")));
  });

  await test("normalisation collapses whitespace + case", () => {
    assert.strictEqual(
      deriveContextHash("Find  A   CRM"),
      deriveContextHash("  find a crm  "));
  });

  await test("different text yields different hash", () => {
    assert.notStrictEqual(
      deriveContextHash("find a CRM"),
      deriveContextHash("find a flight to Tokyo"));
  });

  await test("empty / null context yields null", () => {
    assert.strictEqual(deriveContextHash(""), null);
    assert.strictEqual(deriveContextHash(null), null);
    assert.strictEqual(deriveContextHash("   "), null);
    assert.strictEqual(deriveContextHash(undefined), null);
  });

  await test("normalizeContext caps length at 2000 chars", () => {
    assert.strictEqual(normalizeContext("x".repeat(5000)).length, 2000);
  });

  await test("hash is stable for a long context regardless of length cap", () => {
    const long = "context ".repeat(400); // > 2000 chars
    assert.strictEqual(deriveContextHash(long), deriveContextHash(long));
  });

  // ── touchContextFingerprint (demo path) ────────────────────────────
  await test("demo upsert inserts a row with seen_count 1", async () => {
    context._reset();
    const h = deriveContextHash("compare project management tools");
    const r = await touchContextFingerprint(null, {
      contextHash: h, contextText: "compare project management tools", surface: "web",
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.mode, "demo");
    const row = context._DEMO_FINGERPRINTS.get(h);
    assert.strictEqual(row.seen_count, 1);
    assert.strictEqual(row.surface, "web");
    assert.ok(row.context_text.includes("project management"));
  });

  await test("demo upsert bumps seen_count on repeat", async () => {
    context._reset();
    const h = deriveContextHash("book a hotel in Lisbon");
    await touchContextFingerprint(null, { contextHash: h, contextText: "book a hotel in Lisbon" });
    await touchContextFingerprint(null, { contextHash: h, contextText: "book a hotel in Lisbon" });
    await touchContextFingerprint(null, { contextHash: h, contextText: "book a hotel in Lisbon" });
    assert.strictEqual(context._DEMO_FINGERPRINTS.get(h).seen_count, 3);
  });

  await test("upsert with no hash is a no-op", async () => {
    context._reset();
    const r = await touchContextFingerprint(null, { contextHash: null, contextText: "x" });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(context._DEMO_FINGERPRINTS.size, 0);
  });

  await test("embedding is left null by the upsert (filled offline)", async () => {
    context._reset();
    const h = deriveContextHash("find a dentist near me");
    await touchContextFingerprint(null, { contextHash: h, contextText: "find a dentist near me" });
    assert.strictEqual(context._DEMO_FINGERPRINTS.get(h).embedding, null);
  });

  // ── track.js integration — context_hash stamped on the event ───────
  await test("track stamps context_hash from the ctx param", async () => {
    track._reset();
    const h = "ctx_testhash01";
    await runTrack({ method: "POST", body: {
      event: "impression", campaign_id: "cam_ctx", ctx: h,
    }});
    const ev = track._DEMO_EVENTS.find((e) => e.campaign_id === "cam_ctx");
    assert.ok(ev, "event recorded");
    assert.strictEqual(ev.context_hash, h);
  });

  await test("track accepts context_hash as a body alias", async () => {
    track._reset();
    await runTrack({ method: "POST", body: {
      event: "click", campaign_id: "cam_ctx2", context_hash: "ctx_alias02",
    }});
    const ev = track._DEMO_EVENTS.find((e) => e.campaign_id === "cam_ctx2");
    assert.strictEqual(ev.context_hash, "ctx_alias02");
  });

  await test("context_hash is null when no ctx param is sent", async () => {
    track._reset();
    await runTrack({ method: "POST", body: { event: "impression", campaign_id: "cam_noctx" } });
    const ev = track._DEMO_EVENTS.find((e) => e.campaign_id === "cam_noctx");
    assert.strictEqual(ev.context_hash, null);
  });

  await test("skip and dismiss remain valid feedback events", async () => {
    track._reset();
    for (const event of ["skip", "dismiss", "close"]) {
      const r = await runTrack({ method: "POST", body: {
        event, campaign_id: "cam_fb", ctx: "ctx_fb",
      }});
      assert.strictEqual(r._status, 200, event + " accepted");
    }
    const stamped = track._DEMO_EVENTS.filter((e) => e.context_hash === "ctx_fb");
    assert.strictEqual(stamped.length, 3, "all 3 feedback events carry context_hash");
  });

  console.log("\n" + (failed === 0
    ? "\x1b[32mAll " + passed + " context tests passed.\x1b[0m"
    : "\x1b[31m" + failed + " failed, " + passed + " passed.\x1b[0m"));
  process.exit(failed === 0 ? 0 : 1);
})();
