/**
 * Boost Boss — mcp.js smoke test (demo-mode path).
 * Run: node api/mcp.test.js
 *
 * Exercises the Lumi SDK MCP Server: initialize, tools/list,
 * get_sponsored_content (Benna-scored auction), track_event,
 * rate limiting, and error handling.
 */

// Force demo mode
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const assert = require("assert");
const mcp = require("../api/mcp.js");

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
async function run(spec) { const { req, res } = mockReqRes(spec); await mcp(req, res); return res; }

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log("  \x1b[32mok\x1b[0m  " + name); passed++; }
  catch (e) { console.log("  \x1b[31mFAIL\x1b[0m  " + name + ": " + e.message); failed++; if (process.env.DEBUG) console.log(e.stack); }
}

(async () => {
  console.log("Lumi SDK MCP Server · demo-mode smoke test\n");

  // ── Meta ───────────────────────────────────────────────────────────
  await test("HAS_SUPABASE is false in demo mode", () =>
    assert.strictEqual(mcp.HAS_SUPABASE, false));

  await test("x-mcp-mode header set to 'demo'", async () => {
    mcp._reset();
    const r = await run({ method: "POST", body: { method: "initialize", id: 1 } });
    assert.strictEqual(r._headers["x-mcp-mode"], "demo");
  });

  await test("OPTIONS preflight returns 200", async () => {
    const r = await run({ method: "OPTIONS" });
    assert.strictEqual(r._status, 200);
  });

  await test("GET returns 405", async () => {
    const r = await run({ method: "GET" });
    assert.strictEqual(r._status, 405);
  });

  // ── initialize ─────────────────────────────────────────────────────
  await test("initialize returns protocol version and server info", async () => {
    const r = await run({ method: "POST", body: { method: "initialize", id: 1 } });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.jsonrpc, "2.0");
    assert.strictEqual(r._body.id, 1);
    assert.strictEqual(r._body.result.protocolVersion, "2024-11-05");
    assert.strictEqual(r._body.result.serverInfo.name, "boostboss-lumi-mcp");
  });

  // ── tools/list ─────────────────────────────────────────────────────
  await test("tools/list returns get_sponsored_content and track_event", async () => {
    const r = await run({ method: "POST", body: { method: "tools/list", id: 2 } });
    assert.strictEqual(r._status, 200);
    const tools = r._body.result.tools;
    assert.strictEqual(tools.length, 2);
    assert.strictEqual(tools[0].name, "get_sponsored_content");
    assert.strictEqual(tools[1].name, "track_event");
  });

  await test("get_sponsored_content schema has required context_summary", async () => {
    const r = await run({ method: "POST", body: { method: "tools/list", id: 3 } });
    const schema = r._body.result.tools[0].inputSchema;
    assert.deepStrictEqual(schema.required, ["context_summary"]);
  });

  // ── tools/call: get_sponsored_content ──────────────────────────────
  mcp._reset();
  await test("get_sponsored_content returns a sponsored ad from demo pool", async () => {
    const r = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 10,
        params: {
          name: "get_sponsored_content",
          arguments: {
            context_summary: "debugging a Python FastAPI error traceback",
            session_id: "test_session_001",
          },
        },
      },
    });
    assert.strictEqual(r._status, 200);
    assert.strictEqual(r._body.jsonrpc, "2.0");
    const content = JSON.parse(r._body.result.content[0].text);
    assert(content.sponsored, "should return a sponsored ad");
    assert(content.sponsored.campaign_id, "should have campaign_id");
    assert(content.sponsored.headline, "should have headline");
    assert(content.sponsored.tracking, "should have tracking URLs");
    assert(content.sponsored.tracking.impression, "should have impression URL");
  });

  await test("tracking URLs carry context_hash + skip/dismiss feedback", async () => {
    const r = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 11,
        params: {
          name: "get_sponsored_content",
          arguments: {
            context_summary: "comparing CRM tools for a small sales team",
            session_id: "test_session_ctx",
          },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    assert(content.sponsored, "should return a sponsored ad");
    const tr = content.sponsored.tracking;
    assert(tr.skip,    "tracking should include a skip URL");
    assert(tr.dismiss, "tracking should include a dismiss URL");
    assert(/[?&]ctx=ctx_/.test(tr.impression), "impression URL carries ctx=ctx_");
    assert(/[?&]ctx=ctx_/.test(tr.click),      "click URL carries ctx=ctx_");
  });

  await test("get_sponsored_content includes Benna attribution", async () => {
    mcp._reset();
    const r = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 11,
        params: {
          name: "get_sponsored_content",
          arguments: {
            context_summary: "reading documentation tutorial guide",
            session_id: "test_session_002",
          },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    assert(content.benna, "should include benna attribution");
    assert(content.benna.model_version, "should have model_version");
    assert(typeof content.benna.bid_usd === "number", "bid_usd should be number");
    assert(typeof content.benna.p_click === "number", "p_click should be number");
    assert(content.benna.signal_contributions, "should have signal_contributions");
  });

  await test("get_sponsored_content rate-limits same session", async () => {
    // First call already consumed test_session_003's allowance
    mcp._reset();
    // First call
    await run({
      method: "POST",
      body: {
        method: "tools/call", id: 20,
        params: {
          name: "get_sponsored_content",
          arguments: { context_summary: "test", session_id: "test_session_rl" },
        },
      },
    });
    // Second call immediately — should be rate limited
    const r = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 21,
        params: {
          name: "get_sponsored_content",
          arguments: { context_summary: "test again", session_id: "test_session_rl" },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    assert.strictEqual(content.sponsored, null);
    assert.strictEqual(content.reason, "rate_limited");
  });

  await test("get_sponsored_content with host and region signals", async () => {
    mcp._reset();
    const r = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 12,
        params: {
          name: "get_sponsored_content",
          arguments: {
            context_summary: "deploying Python app",
            session_id: "test_session_signals",
            host: "cursor.com",
            user_region: "US",
            session_len_min: 25,
          },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    assert(content.benna.context.host === "cursor.com");
    assert(content.benna.context.region === "us-west");
    assert(content.benna.context.session_len === 25);
  });

  await test("self-promote: publisher's own campaign wins when host matches cta_url domain", async () => {
    // Seed a campaign whose cta_url points at fissbot.chat. When the
    // publisher asks for an ad with host=fissbot.chat, self-promote mode
    // should make that campaign win the auction even if another campaign
    // has a higher Benna-scored bid.
    const campaigns = require("../api/campaigns.js");
    const fissbotCampaign = {
      id: "00000000-0000-0000-0000-000000000111",
      advertiser_id: "adv_fissbot_test",
      name: "Fissbot Self-Promote",
      status: "active", format: "native",
      headline: "Try Fissbot — your AI task agent",
      subtext: "Get tasks done with AI",
      cta_label: "Try Fissbot",
      cta_url: "https://fissbot.chat",
      adomain: ["fissbot.chat"],
      target_keywords: [], target_regions: ["global"], target_languages: ["en"],
      billing_model: "cpm", bid_amount: 0.5,  // deliberately low
      daily_budget: 100, total_budget: 1000,
      spent_today: 0, spent_total: 0,
    };
    campaigns._DEMO_CAMPAIGNS.set(fissbotCampaign.id, fissbotCampaign);
    mcp._reset();

    const r = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 13,
        params: {
          name: "get_sponsored_content",
          arguments: { host: "fissbot.chat", session_id: "test_selfpromote_1" },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    assert(content.sponsored, "should serve an ad");
    assert.strictEqual(content.sponsored.campaign_id, fissbotCampaign.id,
      "fissbot's own campaign should win on its own domain");
    assert.strictEqual(content.benna.self_promote, true,
      "benna metadata should flag self_promote=true");

    // Also matches via apex domain (www.fissbot.chat, fissbot.com both work)
    mcp._reset();
    const r2 = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 14,
        params: {
          name: "get_sponsored_content",
          arguments: { host: "www.fissbot.chat", session_id: "test_selfpromote_2" },
        },
      },
    });
    const content2 = JSON.parse(r2._body.result.content[0].text);
    assert.strictEqual(content2.sponsored.campaign_id, fissbotCampaign.id,
      "www-prefixed host should still self-promote");
  });

  await test("self-promote: host mismatch falls through to normal auction", async () => {
    mcp._reset();
    const r = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 15,
        params: {
          name: "get_sponsored_content",
          arguments: { host: "unrelated-publisher.com", session_id: "test_selfpromote_3" },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    assert(content.sponsored, "should still serve an ad");
    assert.notStrictEqual(content.sponsored.campaign_id, "00000000-0000-0000-0000-000000000111",
      "should NOT self-promote fissbot on an unrelated publisher");
    assert.strictEqual(content.benna.self_promote, false);
  });

  // ── tools/call: track_event ────────────────────────────────────────
  mcp._reset();
  await test("track_event records impression in demo store", async () => {
    const r = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 30,
        params: {
          name: "track_event",
          arguments: {
            event: "impression",
            campaign_id: "cam_cursor_001",
            session_id: "s_track_1",
          },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    assert.strictEqual(content.tracked, true);
    assert.strictEqual(mcp._DEMO_EVENTS.length, 1);
    assert.strictEqual(mcp._DEMO_EVENTS[0].event_type, "impression");
  });

  await test("track_event records click", async () => {
    const r = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 31,
        params: {
          name: "track_event",
          arguments: { event: "click", campaign_id: "cam_cursor_001" },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    assert.strictEqual(content.tracked, true);
    assert.strictEqual(mcp._DEMO_EVENTS.length, 2);
  });

  // ── Error handling ─────────────────────────────────────────────────
  await test("unknown tool returns error -32601", async () => {
    const r = await run({
      method: "POST",
      body: {
        method: "tools/call", id: 99,
        params: { name: "nonexistent_tool", arguments: {} },
      },
    });
    assert.strictEqual(r._status, 400);
    assert(r._body.error.message.includes("Unknown tool"));
  });

  await test("unknown MCP method returns 400", async () => {
    const r = await run({
      method: "POST",
      body: { method: "resources/list", id: 50 },
    });
    assert.strictEqual(r._status, 400);
  });

  // ── Reset ──────────────────────────────────────────────────────────
  await test("_reset clears events and session cache", () => {
    mcp._DEMO_EVENTS.push({ test: true });
    mcp._reset();
    assert.strictEqual(mcp._DEMO_EVENTS.length, 0);
  });

  // ── Phase E.5: per-door creative override read path ──────────────────
  // The auction read-path should prefer a door-specific row when the
  // request came in via that door, fall back to the 'default' row
  // otherwise, and fall back to legacy campaigns.* if no rows exist.
  await test("per-door creative override is applied when door matches", async () => {
    mcp._reset();
    const campaigns = require("../api/campaigns.js");
    // Pick a seeded campaign and attach a per-door override directly.
    const all = [...campaigns._DEMO_CAMPAIGNS.values()];
    const target = all.find((c) => c.status === "active");
    assert(target, "expected at least one active demo campaign");
    target._per_door_creatives = [
      { door: "default", headline: target.headline, subtext: target.subtext, media_url: target.media_url, poster_url: target.poster_url, cta_label: target.cta_label, cta_url: target.cta_url, source: "inherited" },
      { door: "js-snippet", headline: "JS-SNIPPET ONLY HEADLINE", subtext: target.subtext, media_url: target.media_url, poster_url: target.poster_url, cta_label: target.cta_label, cta_url: target.cta_url, source: "user-uploaded" },
    ];
    const r = await run({
      method: "POST",
      headers: { "x-lumi-source": "js-snippet" },
      body: {
        method: "tools/call", id: 200,
        params: {
          name: "get_sponsored_content",
          arguments: {
            context_summary: target.target_intent_tokens?.join(" ") || "deploy app",
            session_id: "test_e5_door_match",
            // force this campaign to win by restricting targeting
            host_app: target.target_host_apps?.[0],
          },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    if (content.sponsored && String(content.sponsored.campaign_id) === String(target.id)) {
      assert.strictEqual(content.sponsored.headline, "JS-SNIPPET ONLY HEADLINE",
        "js-snippet override should be applied");
    }
    // Cleanup so later tests aren't affected by mutated demo state.
    delete target._per_door_creatives;
  });

  await test("falls back to 'default' row when door has no specific override", async () => {
    mcp._reset();
    const campaigns = require("../api/campaigns.js");
    const all = [...campaigns._DEMO_CAMPAIGNS.values()];
    const target = all.find((c) => c.status === "active");
    target._per_door_creatives = [
      { door: "default", headline: "DEFAULT FALLBACK HEADLINE", subtext: "", media_url: target.media_url, poster_url: null, cta_label: target.cta_label, cta_url: target.cta_url, source: "inherited" },
      // no door-specific row for 'rest-api'
    ];
    const r = await run({
      method: "POST",
      headers: { "x-lumi-source": "rest-api" },
      body: {
        method: "tools/call", id: 201,
        params: {
          name: "get_sponsored_content",
          arguments: {
            context_summary: target.target_intent_tokens?.join(" ") || "deploy app",
            session_id: "test_e5_door_default",
            host_app: target.target_host_apps?.[0],
          },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    if (content.sponsored && String(content.sponsored.campaign_id) === String(target.id)) {
      assert.strictEqual(content.sponsored.headline, "DEFAULT FALLBACK HEADLINE",
        "default row should be used when no door-specific row exists");
    }
    delete target._per_door_creatives;
  });

  await test("falls back to legacy campaign fields when no creative rows exist", async () => {
    mcp._reset();
    const campaigns = require("../api/campaigns.js");
    const all = [...campaigns._DEMO_CAMPAIGNS.values()];
    const target = all.find((c) => c.status === "active");
    // Ensure no per-door rows are attached.
    delete target._per_door_creatives;
    const r = await run({
      method: "POST",
      headers: { "x-lumi-source": "mcp" },
      body: {
        method: "tools/call", id: 202,
        params: {
          name: "get_sponsored_content",
          arguments: {
            context_summary: target.target_intent_tokens?.join(" ") || "deploy app",
            session_id: "test_e5_door_legacy",
            host_app: target.target_host_apps?.[0],
          },
        },
      },
    });
    const content = JSON.parse(r._body.result.content[0].text);
    if (content.sponsored && String(content.sponsored.campaign_id) === String(target.id)) {
      // No override → headline matches the campaign's own headline.
      assert.strictEqual(content.sponsored.headline, target.headline,
        "should fall back to legacy campaign field");
    }
  });

  // ── Per-placement publisher control (db/20) ─────────────────────────
  await test("placementDisabled gate — exported helper", () => {
    assert.strictEqual(typeof mcp.placementDisabled, "function");
    // Disabled when the request's surface is in the publisher's off-set.
    assert.strictEqual(mcp.placementDisabled(["web-corner", "mcp-card"], "web-corner"), true);
    // Not disabled when the surface isn't listed.
    assert.strictEqual(mcp.placementDisabled(["web-corner"], "web-citation"), false);
    // Empty / missing off-set → never disabled (all placements on by default).
    assert.strictEqual(mcp.placementDisabled([], "web-corner"), false);
    assert.strictEqual(mcp.placementDisabled(null, "web-corner"), false);
    assert.strictEqual(mcp.placementDisabled(undefined, "web-corner"), false);
    // Missing surface → never disabled (legacy callers without a surface).
    assert.strictEqual(mcp.placementDisabled(["web-corner"], null), false);
    assert.strictEqual(mcp.placementDisabled(["web-corner"], undefined), false);
  });

  // ── Summary ────────────────────────────────────────────────────────
  console.log();
  if (failed) { console.log(`\x1b[31m${failed} failed\x1b[0m, ${passed} passed.`); process.exit(1); }
  else console.log(`\x1b[32m${passed} tests passed.\x1b[0m`);
})();
