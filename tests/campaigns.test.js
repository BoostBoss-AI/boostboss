/**
 * Boost Boss — campaigns.js smoke test (demo-mode path).
 * Run: node api/campaigns.test.js
 *
 * Exercises every demo-mode code path: CRUD, creative review flow,
 * policy validation, review queue, and upload_creative validation.
 */

// Force demo mode
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const assert = require("assert");
const campaigns = require("../api/campaigns.js");
const { signJwt } = require("../api/auth.js");
const ADMIN_TOKEN = signJwt({ sub: "admin_test", role: "admin", email: "admin@test.com", exp: Math.floor(Date.now() / 1000) + 3600 });
const ADMIN_HEADERS = { authorization: `Bearer ${ADMIN_TOKEN}` };

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
async function run(spec) { const { req, res } = mockReqRes(spec); await campaigns(req, res); return res; }

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log("  \x1b[32mok\x1b[0m  " + name); passed++; }
  catch (e) { console.log("  \x1b[31mFAIL\x1b[0m  " + name + ": " + e.message); failed++; if (process.env.DEBUG) console.log(e.stack); }
}

(async () => {
  console.log("SuperBoost Campaigns · demo-mode smoke test\n");

  // ── Meta ───────────────────────────────────────────────────────────
  await test("HAS_SUPABASE is false in demo mode", () =>
    assert.strictEqual(campaigns.HAS_SUPABASE, false));

  await test("x-campaigns-mode header set to 'demo'", async () => {
    campaigns._reset(); campaigns._seed();
    const r = await run({ method: "GET", query: {} });
    assert.strictEqual(r._headers["x-campaigns-mode"], "demo");
  });

  await test("OPTIONS preflight returns 200", async () => {
    const r = await run({ method: "OPTIONS" });
    assert.strictEqual(r._status, 200);
  });

  // ── List ───────────────────────────────────────────────────────────
  campaigns._reset(); campaigns._seed();
  await test("GET returns seeded campaigns", async () => {
    const r = await run({ method: "GET", query: {} });
    assert.strictEqual(r._status, 200);
    assert(r._body.campaigns.length >= 4, "expected at least 4 seeded campaigns");
  });

  await test("GET filters by advertiser_id", async () => {
    const r = await run({ method: "GET", query: { advertiser_id: "adv_cursor" } });
    assert.strictEqual(r._status, 200);
    assert(r._body.campaigns.every(c => c.advertiser_id === "adv_cursor"));
    assert.strictEqual(r._body.campaigns.length, 2); // cam_cursor_001 + cam_pending_001
  });

  await test("GET filters by status", async () => {
    const r = await run({ method: "GET", query: { status: "active" } });
    assert.strictEqual(r._status, 200);
    assert(r._body.campaigns.every(c => c.status === "active"));
    assert.strictEqual(r._body.campaigns.length, 3);
  });

  // ── Get single ─────────────────────────────────────────────────────
  await test("GET action=get returns single campaign", async () => {
    const r = await run({ method: "GET", query: { action: "get", id: "cam_cursor_001" } });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.campaign.id, "cam_cursor_001");
  });

  await test("GET action=get returns 404 for unknown id", async () => {
    const r = await run({ method: "GET", query: { action: "get", id: "cam_nope" } });
    assert.strictEqual(r._status, 404);
  });

  await test("GET action=get returns 400 when id missing", async () => {
    const r = await run({ method: "GET", query: { action: "get" } });
    assert.strictEqual(r._status, 400);
  });

  // ── Create ─────────────────────────────────────────────────────────
  campaigns._reset(); campaigns._seed();
  await test("POST action=create auto-approves first campaign per advertiser", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: {
        advertiser_id: "adv_first_campaign",
        headline: "Test Campaign Headline",
        cta_url: "https://example.com/test",
        daily_budget: 100, total_budget: 5000,
      },
    });
    assert.strictEqual(r._status, 201);
    // Auto-approve-on-first unblocks self-serve: the first campaign goes
    // straight to active so the advertiser can see their ad serve without
    // waiting on manual review.
    assert.strictEqual(r._body.campaign.status, "active");
    assert.strictEqual(r._body.auto_approved, true);
    assert.strictEqual(r._body.campaign.advertiser_id, "adv_first_campaign");
    assert.match(r._body.campaign.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "campaign.id must be a valid UUID");
    assert(r._body.policy, "should include policy check result");
  });

  await test("POST action=create sends second campaign to in_review", async () => {
    // Second campaign from the same advertiser goes through normal review
    // so we retain abuse-prevention controls for established accounts.
    const r = await run({
      method: "POST", query: { action: "create" },
      body: {
        advertiser_id: "adv_first_campaign",
        headline: "Second Campaign Goes To Review",
        cta_url: "https://example.com/second",
        daily_budget: 200, total_budget: 10000,
      },
    });
    assert.strictEqual(r._status, 201);
    assert.strictEqual(r._body.campaign.status, "in_review");
    assert.strictEqual(r._body.auto_approved, false);
  });

  await test("create rejects missing required fields", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: { headline: "No advertiser" },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("Missing required"));
  });

  await test("create returns policy issues for blocked category", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: {
        advertiser_id: "adv_bad",
        headline: "Adult Content Ad",
        cta_url: "https://example.com/ad",
        iab_cat: ["IAB26-1"],
        daily_budget: 100, total_budget: 5000,
      },
    });
    assert.strictEqual(r._status, 201); // still created, just flagged
    assert.strictEqual(r._body.policy.ok, false);
    assert(r._body.policy.issues.some(i => i.includes("IAB26-1")));
  });

  // ── Update ─────────────────────────────────────────────────────────
  await test("PATCH action=update modifies campaign fields", async () => {
    const r = await run({
      method: "PATCH", query: { action: "update" },
      body: { id: "cam_cursor_001", headline: "Updated Headline" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.campaign.headline, "Updated Headline");
  });

  await test("update returns 400 when id missing", async () => {
    const r = await run({
      method: "PATCH", query: { action: "update" },
      body: { headline: "No ID" },
    });
    assert.strictEqual(r._status, 400);
  });

  await test("update returns 404 for unknown campaign", async () => {
    const r = await run({
      method: "PATCH", query: { action: "update" },
      body: { id: "cam_nonexistent", headline: "Nope" },
    });
    assert.strictEqual(r._status, 404);
  });

  // ── Review (approve / reject) ──────────────────────────────────────
  campaigns._reset(); campaigns._seed();
  await test("review approve transitions in_review → active", async () => {
    const r = await run({
      method: "POST", query: { action: "review" }, headers: ADMIN_HEADERS,
      body: { id: "cam_pending_001", decision: "approve", notes: "Looks good" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.campaign.status, "active");
    assert.strictEqual(r._body.decision, "approve");
    assert(r._body.campaign.reviewed_at);
  });

  campaigns._reset(); campaigns._seed();
  await test("review reject transitions in_review → rejected", async () => {
    const r = await run({
      method: "POST", query: { action: "review" }, headers: ADMIN_HEADERS,
      body: { id: "cam_pending_001", decision: "reject", notes: "Policy violation" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.campaign.status, "rejected");
    assert.strictEqual(r._body.campaign.review_notes, "Policy violation");
  });

  await test("review rejects already-active campaign", async () => {
    const r = await run({
      method: "POST", query: { action: "review" }, headers: ADMIN_HEADERS,
      body: { id: "cam_cursor_001", decision: "approve" },
    });
    assert.strictEqual(r._status, 400);
  });

  await test("review rejects invalid decision value", async () => {
    campaigns._reset(); campaigns._seed();
    const r = await run({
      method: "POST", query: { action: "review" }, headers: ADMIN_HEADERS,
      body: { id: "cam_pending_001", decision: "maybe" },
    });
    assert.strictEqual(r._status, 400);
  });

  await test("review rejects missing id", async () => {
    const r = await run({
      method: "POST", query: { action: "review" }, headers: ADMIN_HEADERS,
      body: { decision: "approve" },
    });
    assert.strictEqual(r._status, 400);
  });

  // ── Review queue ───────────────────────────────────────────────────
  campaigns._reset(); campaigns._seed();
  await test("review rejects unauthenticated request", async () => {
    const r = await run({
      method: "POST", query: { action: "review" },
      body: { id: "cam_pending_001", decision: "approve" },
    });
    assert.strictEqual(r._status, 401);
  });

  await test("review_queue returns only in_review campaigns with policy", async () => {
    const r = await run({ method: "GET", query: { action: "review_queue" }, headers: ADMIN_HEADERS });
    assert.strictEqual(r._status, 200);
    assert(r._body.queue.every(c => c.status === "in_review"));
    assert.strictEqual(r._body.count, 1); // cam_pending_001
    assert(r._body.queue[0].policy, "should include policy check");
  });

  await test("review_queue returns 0 after all approved", async () => {
    // Approve the pending one
    await run({
      method: "POST", query: { action: "review" }, headers: ADMIN_HEADERS,
      body: { id: "cam_pending_001", decision: "approve" },
    });
    const r = await run({ method: "GET", query: { action: "review_queue" }, headers: ADMIN_HEADERS });
    assert.strictEqual(r._body.count, 0);
  });

  // ── Upload creative ────────────────────────────────────────────────
  await test("upload_creative validates HTTPS image URL", async () => {
    const r = await run({
      method: "POST", query: { action: "upload_creative" },
      body: { media_url: "https://cdn.example.com/ad.png", format: "image" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.valid, true);
    assert.strictEqual(r._body.detected_type, "image");
  });

  await test("upload_creative rejects HTTP URL", async () => {
    const r = await run({
      method: "POST", query: { action: "upload_creative" },
      body: { media_url: "http://cdn.example.com/ad.png" },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("HTTPS"));
  });

  await test("upload_creative rejects invalid URL", async () => {
    const r = await run({
      method: "POST", query: { action: "upload_creative" },
      body: { media_url: "not-a-url" },
    });
    assert.strictEqual(r._status, 400);
  });

  await test("upload_creative rejects missing media_url", async () => {
    const r = await run({
      method: "POST", query: { action: "upload_creative" },
      body: {},
    });
    assert.strictEqual(r._status, 400);
  });

  await test("upload_creative rejects wrong format mismatch", async () => {
    const r = await run({
      method: "POST", query: { action: "upload_creative" },
      body: { media_url: "https://cdn.example.com/video.mp4", format: "image" },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("Expected image"));
  });

  await test("upload_creative validates video URL", async () => {
    const r = await run({
      method: "POST", query: { action: "upload_creative" },
      body: { media_url: "https://cdn.example.com/spot.mp4", format: "video" },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.detected_type, "video");
  });

  // ── Policy validation (unit) ───────────────────────────────────────
  await test("validateCreativePolicy passes clean campaign", () => {
    const p = campaigns.validateCreativePolicy({
      headline: "Good Ad",
      subtext: "Short description",
      cta_url: "https://example.com",
      iab_cat: ["IAB19-6"],
      adomain: ["example.com"],
      format: "native",
      daily_budget: 100, total_budget: 5000,
    });
    assert.strictEqual(p.ok, true);
    assert.strictEqual(p.issues.length, 0);
  });

  await test("validateCreativePolicy flags blocked IAB category", () => {
    const p = campaigns.validateCreativePolicy({
      headline: "Test", cta_url: "https://x.com",
      iab_cat: ["IAB7-39"],
      daily_budget: 100, total_budget: 5000,
    });
    assert.strictEqual(p.ok, false);
    assert(p.issues.some(i => i.includes("IAB7-39")));
  });

  await test("validateCreativePolicy flags long headline (>90)", () => {
    const p = campaigns.validateCreativePolicy({
      headline: "A".repeat(91),
      cta_url: "https://x.com",
      daily_budget: 100, total_budget: 5000,
    });
    assert.strictEqual(p.ok, false);
    assert(p.issues.some(i => i.includes("Headline")));
  });

  await test("validateCreativePolicy flags long subtext (>300)", () => {
    const p = campaigns.validateCreativePolicy({
      headline: "OK", subtext: "B".repeat(301),
      cta_url: "https://x.com",
      daily_budget: 100, total_budget: 5000,
    });
    assert.strictEqual(p.ok, false);
    assert(p.issues.some(i => i.includes("Subtext")));
  });

  await test("validateCreativePolicy flags HTTP CTA URL", () => {
    const p = campaigns.validateCreativePolicy({
      headline: "Test",
      cta_url: "http://insecure.com",
      daily_budget: 100, total_budget: 5000,
    });
    assert.strictEqual(p.ok, false);
    assert(p.issues.some(i => i.includes("HTTPS")));
  });

  await test("validateCreativePolicy flags zero daily_budget", () => {
    const p = campaigns.validateCreativePolicy({
      headline: "Test", cta_url: "https://x.com",
      daily_budget: 0, total_budget: 5000,
    });
    assert.strictEqual(p.ok, false);
    assert(p.issues.some(i => i.includes("daily_budget")));
  });

  await test("validateCreativePolicy flags daily > total", () => {
    const p = campaigns.validateCreativePolicy({
      headline: "Test", cta_url: "https://x.com",
      daily_budget: 10000, total_budget: 5000,
    });
    assert.strictEqual(p.ok, false);
    assert(p.issues.some(i => i.includes("cannot exceed")));
  });

  // ── Numeric bounds validation on create ─────────────────────────────
  campaigns._reset(); campaigns._seed();
  await test("create rejects bid_amount below $0.01", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: { advertiser_id: "adv_test", headline: "Low Bid", cta_url: "https://x.com", bid_amount: 0.001, daily_budget: 100, total_budget: 5000 },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("bid_amount"));
  });

  await test("create rejects bid_amount above $1,000", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: { advertiser_id: "adv_test", headline: "High Bid", cta_url: "https://x.com", bid_amount: 1001, daily_budget: 100, total_budget: 5000 },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("bid_amount"));
  });

  await test("create accepts bid_amount at boundary ($0.01)", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: { advertiser_id: "adv_test", headline: "Min Bid", cta_url: "https://x.com", bid_amount: 0.01, daily_budget: 100, total_budget: 5000 },
    });
    assert.strictEqual(r._status, 201);
  });

  await test("create accepts bid_amount at boundary ($1,000)", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: { advertiser_id: "adv_test", headline: "Max Bid", cta_url: "https://x.com", bid_amount: 1000, daily_budget: 100, total_budget: 5000 },
    });
    assert.strictEqual(r._status, 201);
  });

  await test("create rejects daily_budget below $1", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: { advertiser_id: "adv_test", headline: "Low Daily", cta_url: "https://x.com", daily_budget: 0.5, total_budget: 5000 },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("daily_budget"));
  });

  await test("create rejects daily_budget above $1,000,000", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: { advertiser_id: "adv_test", headline: "High Daily", cta_url: "https://x.com", daily_budget: 1000001, total_budget: 5000000 },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("daily_budget"));
  });

  await test("create rejects total_budget below $1", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: { advertiser_id: "adv_test", headline: "Low Total", cta_url: "https://x.com", daily_budget: 1, total_budget: 0.5 },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("total_budget"));
  });

  await test("create rejects total_budget above $10,000,000", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: { advertiser_id: "adv_test", headline: "High Total", cta_url: "https://x.com", daily_budget: 100, total_budget: 10000001 },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("total_budget"));
  });

  await test("create rejects NaN bid_amount", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: { advertiser_id: "adv_test", headline: "NaN Bid", cta_url: "https://x.com", bid_amount: "abc", daily_budget: 100, total_budget: 5000 },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("bid_amount"));
  });

  // ── Phase E.5: fetch_url_preview ───────────────────────────────────
  // We stub global.fetch so we can drive the parser deterministically
  // without hitting the network — and restore it afterwards.
  await test("fetch_url_preview rejects missing url", async () => {
    const r = await run({ method: "POST", query: { action: "fetch_url_preview" }, body: {} });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.toLowerCase().includes("missing url"));
  });

  await test("fetch_url_preview rejects non-HTTPS", async () => {
    const r = await run({ method: "POST", query: { action: "fetch_url_preview" }, body: { url: "http://insecure.com" } });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.includes("HTTPS"));
  });

  await test("fetch_url_preview rejects malformed URL", async () => {
    const r = await run({ method: "POST", query: { action: "fetch_url_preview" }, body: { url: "not-a-url" } });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.toLowerCase().includes("invalid"));
  });

  await test("fetch_url_preview blocks loopback host (SSRF)", async () => {
    const r = await run({ method: "POST", query: { action: "fetch_url_preview" }, body: { url: "https://127.0.0.1/x" } });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.toLowerCase().includes("publicly reachable"));
  });

  await test("fetch_url_preview blocks private RFC1918 host (SSRF)", async () => {
    const r = await run({ method: "POST", query: { action: "fetch_url_preview" }, body: { url: "https://10.0.0.5/x" } });
    assert.strictEqual(r._status, 400);
  });

  await test("fetch_url_preview parses og:title / og:description / og:image", async () => {
    const originalFetch = global.fetch;
    const html = `
      <html><head>
        <meta property="og:title" content="Stripe Atlas">
        <meta property="og:description" content="Start your global startup in minutes">
        <meta property="og:image" content="https://stripe.com/img/atlas-card.png">
        <meta property="og:site_name" content="Stripe">
        <title>Atlas — Stripe</title>
      </head><body></body></html>`;
    global.fetch = async () => ({
      ok: true, status: 200, url: "https://stripe.com/atlas",
      body: null, // exercise the .text() fallback branch
      text: async () => html,
    });
    try {
      const r = await run({ method: "POST", query: { action: "fetch_url_preview" }, body: { url: "https://stripe.com/atlas" } });
      assert.strictEqual(r._status, 200, "expected 200, got " + r._status);
      assert.strictEqual(r._body.ok, true);
      assert.strictEqual(r._body.headline, "Stripe Atlas");
      assert.strictEqual(r._body.subtext, "Start your global startup in minutes");
      assert.strictEqual(r._body.media_url, "https://stripe.com/img/atlas-card.png");
      assert.strictEqual(r._body.site_name, "Stripe");
      assert(r._body.found.og_title && r._body.found.og_image);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await test("fetch_url_preview falls back to <title> + meta description", async () => {
    const originalFetch = global.fetch;
    const html = `
      <html><head>
        <meta name="description" content="Plain old meta description.">
        <title>Plain Title</title>
      </head></html>`;
    global.fetch = async () => ({
      ok: true, status: 200, url: "https://example.com/x",
      body: null, text: async () => html,
    });
    try {
      const r = await run({ method: "POST", query: { action: "fetch_url_preview" }, body: { url: "https://example.com/x" } });
      assert.strictEqual(r._body.headline, "Plain Title");
      assert.strictEqual(r._body.subtext, "Plain old meta description.");
      assert.strictEqual(r._body.media_url, "");
      assert.strictEqual(r._body.found.og_title, false);
      assert.strictEqual(r._body.found.title_tag, true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await test("fetch_url_preview resolves relative og:image against final URL", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true, status: 200, url: "https://example.com/landing",
      body: null,
      text: async () => `<meta property="og:image" content="/img/hero.png"><title>X</title>`,
    });
    try {
      const r = await run({ method: "POST", query: { action: "fetch_url_preview" }, body: { url: "https://example.com/landing" } });
      assert.strictEqual(r._body.media_url, "https://example.com/img/hero.png");
    } finally {
      global.fetch = originalFetch;
    }
  });

  await test("fetch_url_preview returns 400 on upstream HTTP error", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false, status: 503, url: "https://example.com/down",
      body: null, text: async () => "",
    });
    try {
      const r = await run({ method: "POST", query: { action: "fetch_url_preview" }, body: { url: "https://example.com/down" } });
      assert.strictEqual(r._status, 400);
      assert.strictEqual(r._body.status, 503);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // ── Phase E.5: per-door creative normalisation ─────────────────────
  await test("normalisePerDoorCreatives always emits a 'default' row", () => {
    const rows = campaigns._normalisePerDoorCreatives({
      headline: "H", subtext: "S", media_url: "https://x/m.png",
      cta_label: "Go", cta_url: "https://x", poster_url: null,
    }, undefined);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].door, "default");
    assert.strictEqual(rows[0].source, "inherited");
    assert.strictEqual(rows[0].headline, "H");
  });

  await test("normalisePerDoorCreatives skips door rows with no real overrides", () => {
    const rows = campaigns._normalisePerDoorCreatives(
      { headline: "H", subtext: "S", media_url: "https://x/m.png", cta_label: "Go", cta_url: "https://x", poster_url: null },
      { mcp: {}, "js-snippet": { headline: "" } } // both effectively empty
    );
    // Only the default row should be present.
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].door, "default");
  });

  await test("normalisePerDoorCreatives emits a door row when at least one field differs", () => {
    const rows = campaigns._normalisePerDoorCreatives(
      { headline: "H", subtext: "S", media_url: "https://x/m.png", cta_label: "Go", cta_url: "https://x", poster_url: null },
      { mcp: { headline: "MCP-specific headline" } }
    );
    assert.strictEqual(rows.length, 2);
    const mcpRow = rows.find((r) => r.door === "mcp");
    assert(mcpRow);
    assert.strictEqual(mcpRow.source, "user-uploaded");
    assert.strictEqual(mcpRow.headline, "MCP-specific headline");
    // Non-overridden fields inherit from the campaign-level copy.
    assert.strictEqual(mcpRow.cta_url, "https://x");
  });

  await test("normalisePerDoorCreatives ignores override identical to default", () => {
    const rows = campaigns._normalisePerDoorCreatives(
      { headline: "Same", subtext: "S", media_url: "", cta_label: "Go", cta_url: "https://x", poster_url: null },
      { mcp: { headline: "Same" } } // same as default → not an override
    );
    // Should be only the default row, since nothing materially differs.
    assert.strictEqual(rows.length, 1);
  });

  await test("create persists per_door_creatives on the demo campaign object", async () => {
    const r = await run({
      method: "POST", query: { action: "create" },
      body: {
        advertiser_id: "adv_test_e5",
        name: "E5 demo", headline: "Hello", cta_url: "https://x.com",
        format: "native", daily_budget: 100, total_budget: 5000,
        per_door_creatives: { mcp: { headline: "MCP override" } },
      },
    });
    assert.strictEqual(r._status, 201, "expected 201, got " + r._status);
    const c = r._body.campaign;
    assert(Array.isArray(c._per_door_creatives), "_per_door_creatives should be an array");
    const doorIds = c._per_door_creatives.map((x) => x.door).sort();
    assert.deepStrictEqual(doorIds, ["default", "mcp"]);
    const mcp = c._per_door_creatives.find((x) => x.door === "mcp");
    assert.strictEqual(mcp.headline, "MCP override");
  });

  // ── Summary ────────────────────────────────────────────────────────
  console.log();
  if (failed) { console.log(`\x1b[31m${failed} failed\x1b[0m, ${passed} passed.`); process.exit(1); }
  else console.log(`\x1b[32m${passed} tests passed.\x1b[0m`);
})();
