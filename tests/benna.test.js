/**
 * Boost Boss — Benna closed-loop tests (Phase C, 2026-05-11).
 *
 * Verifies that observed CTR/CVR from the events table actually feeds back
 * into Benna's bid score, with the learning-phase guard and clamps applied.
 *
 * Run: node tests/benna.test.js
 */

// Force demo mode so campaign_history doesn't try to reach Supabase.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const assert = require("assert");
const benna  = require("../api/benna.js");
const history = require("../api/_lib/campaign_history.js");

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log("  \x1b[32mok\x1b[0m  " + name); passed++; }
  catch (e) { console.log("  \x1b[31mFAIL\x1b[0m  " + name + ": " + e.message); failed++;
    if (process.env.DEBUG) console.log(e.stack); }
}

const baseCtx = { intent_tokens: ["debug_py"], host_app: "claude_desktop" };
const baseCmp = {
  target_cpa: 5,
  target_intent_tokens: ["debug_py"],
  target_host_apps: ["claude_desktop"],
};

(async () => {
  console.log("Benna · closed-loop scoring (Phase C)\n");

  // ── scoreBid: cold path unchanged ───────────────────────────────────
  await test("scoreBid with history=null leaves learning=null (back-compat)", () => {
    const r = benna.scoreBid(baseCtx, baseCmp);
    assert.strictEqual(r.learning, null);
    assert(r.p_click > 0, "p_click should still be positive");
  });

  await test("scoreBid (no history arg) signal_contributions has no learning row", () => {
    const r = benna.scoreBid(baseCtx, baseCmp);
    const hasLearning = r.signal_contributions.some((c) =>
      c.signal.includes("learning_phase") || c.signal.includes("observed_ctr"));
    assert(!hasLearning, "cold scoreBid should not emit a learning contribution");
  });

  // ── scoreBid: learning phase (cold campaign) ────────────────────────
  await test("scoreBid with cold history → modifier 1.0, label 'learning_phase'", () => {
    const r = benna.scoreBid(baseCtx, baseCmp, {
      impressions: 12, clicks: 0, conversions: 0,
      ctr: 0, cvr: null, isWarm: false,
    });
    assert.strictEqual(r.learning.phase, "learning");
    assert.strictEqual(r.learning.modifier, 1.0);
    const learningRow = r.signal_contributions.find((c) => c.signal.startsWith("learning_phase"));
    assert(learningRow, "learning contribution row missing");
    assert.strictEqual(learningRow.lift, 0, "learning phase should contribute 0 lift");
  });

  // ── scoreBid: warm with above-baseline CTR → boost ──────────────────
  await test("scoreBid with 4% CTR warm campaign → modifier 2.0 (ceil)", () => {
    const r = benna.scoreBid(baseCtx, baseCmp, {
      impressions: 200, clicks: 8, conversions: 1,
      ctr: 0.04, cvr: 0.125, isWarm: true,
    });
    assert.strictEqual(r.learning.phase, "warm");
    assert.strictEqual(r.learning.modifier, 2.0);
    const observedRow = r.signal_contributions.find((c) => c.signal.startsWith("observed_ctr"));
    assert(observedRow, "observed_ctr contribution row missing");
    assert(observedRow.lift > 0, "above-baseline CTR should produce positive lift");
  });

  await test("scoreBid p_click capped at 12% (P_CLICK_CEIL) even when warm", () => {
    const r = benna.scoreBid(baseCtx, baseCmp, {
      impressions: 1000, clicks: 1000, conversions: 100,
      ctr: 1.0, cvr: 0.1, isWarm: true,
    });
    assert(r.p_click <= 0.12, "p_click should never exceed 0.12, got " + r.p_click);
  });

  // ── scoreBid: warm with below-baseline CTR → penalty ────────────────
  await test("scoreBid with 0.5% CTR warm campaign → modifier 0.5 (floor)", () => {
    const r = benna.scoreBid(baseCtx, baseCmp, {
      impressions: 300, clicks: 1, conversions: 0,
      ctr: 0.005, cvr: 0, isWarm: true,
    });
    assert.strictEqual(r.learning.phase, "warm");
    assert.strictEqual(r.learning.modifier, 0.5);
    const observedRow = r.signal_contributions.find((c) => c.signal.startsWith("observed_ctr"));
    assert(observedRow.lift < 0, "below-baseline CTR should produce negative lift");
  });

  await test("scoreBid clamps observed CTR scale to [0.5, 2.0]", () => {
    // CTR way below floor: 0.001 / 0.02 = 0.05 → should clamp to 0.5
    const low = benna.scoreBid(baseCtx, baseCmp, {
      impressions: 500, clicks: 0, conversions: 0,
      ctr: 0.001, cvr: 0, isWarm: true,
    });
    assert.strictEqual(low.learning.modifier, 0.5);
    // CTR way above ceil: 0.5 / 0.02 = 25 → should clamp to 2.0
    const high = benna.scoreBid(baseCtx, baseCmp, {
      impressions: 500, clicks: 250, conversions: 50,
      ctr: 0.5, cvr: 0.2, isWarm: true,
    });
    assert.strictEqual(high.learning.modifier, 2.0);
  });

  // ── scorePrice: same closed-loop behavior on the CPM side ──────────
  const pricePlacement = { surface: "tool_response", format: "native", baseline_ctr: 1.0, floor_cpm: 0 };
  const priceCampaign  = {
    bid_amount: 10, format: "native",
    target_intent_tokens: ["debug_py"],
    iab_cat: [], adomain: [],
  };

  await test("scorePrice without history → baseline_source=placement_default", () => {
    const r = benna.scorePrice({
      placement: pricePlacement,
      context: { intent_tokens: ["debug_py"], country: "US" },
      campaign: priceCampaign,
    });
    assert.strictEqual(r.factors.baseline_source, "placement_default");
    assert.strictEqual(r.factors.learning, null);
  });

  await test("scorePrice with warm 4% CTR shifts baseline_ctr 2× higher", () => {
    const cold = benna.scorePrice({
      placement: pricePlacement,
      context: { intent_tokens: ["debug_py"], country: "US" },
      campaign: priceCampaign,
    });
    const warm = benna.scorePrice({
      placement: pricePlacement,
      context: { intent_tokens: ["debug_py"], country: "US" },
      campaign: priceCampaign,
      history: { impressions: 300, clicks: 12, conversions: 2,
                 ctr: 0.04, cvr: 0.167, isWarm: true },
    });
    assert.strictEqual(warm.factors.baseline_source, "observed_ctr_7d");
    assert(warm.factors.baseline_ctr > cold.factors.baseline_ctr,
      `warm baseline_ctr (${warm.factors.baseline_ctr}) should be > cold (${cold.factors.baseline_ctr})`);
    assert(warm.price_cpm > cold.price_cpm,
      `warm price_cpm (${warm.price_cpm}) should be > cold (${cold.price_cpm})`);
  });

  await test("scorePrice with cold-start history keeps placement_default baseline", () => {
    const r = benna.scorePrice({
      placement: pricePlacement,
      context: { intent_tokens: ["debug_py"], country: "US" },
      campaign: priceCampaign,
      history: { impressions: 5, clicks: 0, conversions: 0,
                 ctr: 0, cvr: null, isWarm: false },
    });
    assert.strictEqual(r.factors.baseline_source, "placement_default");
    assert.strictEqual(r.factors.learning.phase, "learning");
    assert.strictEqual(r.factors.learning.impressions_7d, 5);
  });

  // ── campaign_history: cache + demo mode + batch correctness ─────────
  await test("getCampaignHistoryBatch with sb=null returns cold entries for all ids", async () => {
    history._resetCache();
    const map = await history.getCampaignHistoryBatch(null, ["cam_a", "cam_b", "cam_c"]);
    assert.strictEqual(map.size, 3);
    for (const [id, h] of map) {
      assert.strictEqual(h.isWarm, false, id + " should be cold");
      assert.strictEqual(h.impressions, 0, id + " should have 0 impressions");
    }
  });

  await test("getCampaignHistoryBatch empty input returns empty map", async () => {
    history._resetCache();
    const map = await history.getCampaignHistoryBatch(null, []);
    assert.strictEqual(map.size, 0);
  });

  await test("getCampaignHistoryBatch caches results across calls", async () => {
    history._resetCache();
    const a = await history.getCampaignHistoryBatch(null, ["cam_z"]);
    const fetchedAt1 = a.get("cam_z").fetchedAt;
    // Second call within TTL should return the cached entry (same fetchedAt)
    const b = await history.getCampaignHistoryBatch(null, ["cam_z"]);
    assert.strictEqual(b.get("cam_z").fetchedAt, fetchedAt1, "second call should hit cache");
  });

  await test("MIN_WARM_IMPRESSIONS exported and is positive", () => {
    assert(history.MIN_WARM_IMPRESSIONS > 0);
    assert(typeof history.MIN_WARM_IMPRESSIONS === "number");
  });

  // ── Model version bump check ───────────────────────────────────────
  await test("model_version reflects Phase C release", () => {
    assert(benna.MODEL_VERSION.startsWith("benna-rc5"),
      "Expected benna-rc5 model version, got " + benna.MODEL_VERSION);
  });

  // ── Cosine intent scoring (Benna v1 — semantic embedding path) ─────
  // Before this test existed, a regression in intentMatchScore() or
  // cosineSimilarity() could ship to prod undetected — the v0 Jaccard
  // tests don't exercise the embedding code path at all. Toy 4-dim
  // vectors are fine for the math; production uses voyage-3-lite at
  // 512 dims but the scoring logic is dimensionality-agnostic.

  await test("_cosineSimilarity returns 1.0 for identical vectors", () => {
    const v = [1, 0, 0, 0];
    assert.strictEqual(benna._cosineSimilarity(v, v), 1);
  });

  await test("_cosineSimilarity returns 0 for orthogonal vectors", () => {
    assert.strictEqual(benna._cosineSimilarity([1, 0, 0, 0], [0, 1, 0, 0]), 0);
  });

  // Regression test for the 2026-06-15 production bug — pgvector returns
  // vector columns as JSON-encoded strings via PostgREST, not as arrays.
  // The cache lookup parsed them but campaign.intent_embedding bypassed
  // that path, so cosineSimilarity received a string and returned null,
  // silently dropping every auction into the Jaccard fallback.
  await test("_cosineSimilarity handles pgvector string format on either side", () => {
    const arr = [1, 0, 0, 0];
    const str = "[1, 0, 0, 0]";
    assert.strictEqual(benna._cosineSimilarity(arr, str), 1, "arr × pgvector-string");
    assert.strictEqual(benna._cosineSimilarity(str, arr), 1, "pgvector-string × arr");
    assert.strictEqual(benna._cosineSimilarity(str, str), 1, "pgvector-string × pgvector-string");
    // Malformed string falls back to null (Jaccard takes over) rather
    // than throwing — protocol guarantees graceful degradation.
    assert.strictEqual(benna._cosineSimilarity(arr, "not-json-{]"), null);
  });

  await test("_intentMatchScore: cosine fires when campaign embedding is pgvector string", () => {
    const score = benna._intentMatchScore(["x"], ["x"], {
      requestEmbedding:  [1, 0, 0, 0],
      campaignEmbedding: "[1, 0, 0, 0]",   // ← simulates raw Supabase return
    });
    // Identical vectors → cosine 1 → score 1.5 (ceiling)
    assert.strictEqual(score, 1.5,
      "campaign embedding as pgvector string MUST trigger cosine, not Jaccard fallback");
  });

  await test("_intentMatchScore: identical embeddings → ceiling 1.5", () => {
    const score = benna._intentMatchScore(["x"], ["x"], {
      requestEmbedding:  [1, 0, 0, 0],
      campaignEmbedding: [1, 0, 0, 0],
    });
    assert.strictEqual(score, 1.5);
  });

  await test("_intentMatchScore: orthogonal embeddings → floor 0.4", () => {
    const score = benna._intentMatchScore(["x"], ["y"], {
      requestEmbedding:  [1, 0, 0, 0],
      campaignEmbedding: [0, 1, 0, 0],
    });
    assert.strictEqual(score, 0.4);
  });

  await test("_intentMatchScore: one-side null embedding → Jaccard fallback", () => {
    // Both token arrays match → Jaccard = 1.0 → score 0.4 + 1.4 = 1.5
    const score = benna._intentMatchScore(["debug"], ["debug"], {
      requestEmbedding:  [1, 0, 0, 0],
      campaignEmbedding: null,
    });
    assert.strictEqual(score, 1.5);
  });

  // The load-bearing assertion: at identical bids, the campaign whose
  // intent_embedding is closer to the request's embedding wins the
  // price comparison. If this assertion ever flips, the cosine path
  // is broken and Benna has silently degraded to a bid-only auction —
  // which is exactly the scenario the 2026-06-15 audit flagged.
  await test("scorePrice: high-cosine campaign outprices low-cosine at equal bid", () => {
    const placement = { surface: "chat", format: "native", floor_cpm: 0 };
    const ctx       = { intent_tokens: ["billing"], country: "US" };
    const reqVec    = [1, 0, 0, 0];

    // Two campaigns with identical everything EXCEPT embedding similarity.
    const highMatch = benna.scorePrice({
      placement,
      context: ctx,
      campaign: {
        bid_amount: 5,
        format: "native",
        target_intent_tokens: ["billing"],
        intent_embedding: [1, 0, 0, 0],   // cosine 1.0 → intent score 1.5
      },
      request_intent_embedding: reqVec,
    });

    const lowMatch = benna.scorePrice({
      placement,
      context: ctx,
      campaign: {
        bid_amount: 5,
        format: "native",
        target_intent_tokens: ["billing"],
        intent_embedding: [0, 1, 0, 0],   // cosine 0.0 → intent score 0.4
      },
      request_intent_embedding: reqVec,
    });

    assert.strictEqual(highMatch.factors.intent_match_score, 1.5);
    assert.strictEqual(lowMatch.factors.intent_match_score, 0.4);

    // The intent gap should propagate through to price_cpm at identical bids
    assert(highMatch.price_cpm > lowMatch.price_cpm,
      `high-cosine price_cpm (${highMatch.price_cpm}) should exceed ` +
      `low-cosine price_cpm (${lowMatch.price_cpm}) at equal bid`);

    // Ratio sanity — intent factor alone is 1.5 / 0.4 = 3.75x, and
    // every other factor in scorePrice is identical between the two
    // calls, so the price ratio should sit right around 3.75x.
    const ratio = highMatch.price_cpm / lowMatch.price_cpm;
    assert(ratio > 3.5 && ratio < 4.0,
      `expected intent multiplier ratio ~3.75, got ${ratio.toFixed(3)}`);
  });

  await test("scorePrice: missing request_intent_embedding falls back gracefully", () => {
    const r = benna.scorePrice({
      placement: { surface: "chat", format: "native", floor_cpm: 0 },
      context: { intent_tokens: ["billing"], country: "US" },
      campaign: {
        bid_amount: 5,
        format: "native",
        target_intent_tokens: ["billing"],
        intent_embedding: [1, 0, 0, 0],   // present, but request side missing
      },
      // request_intent_embedding intentionally omitted
    });
    // Should fall through to Jaccard (both arrays = ["billing"]) → 1.5
    assert.strictEqual(r.factors.intent_match_score, 1.5);
  });

  // ── Summary ────────────────────────────────────────────────────────
  console.log();
  if (failed) { console.log(`\x1b[31m${failed} failed\x1b[0m, ${passed} passed.`); process.exit(1); }
  else console.log(`\x1b[32m${passed} tests passed.\x1b[0m`);
})();
