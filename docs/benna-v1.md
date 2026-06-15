# Benna v1 — Semantic Intent Scoring

**Status:** Architecture shipped; production activation pending env + cache priming + cron verification.
**Owner:** Boost Boss core team.
**Last updated:** 2026-06-15.

> **Reality check.** Earlier internal docs framed semantic scoring as aspirational ("Benna v1 needs to ship"). That framing is stale. The cosine-similarity path is wired end to end in `api/mcp.js`, `api/rtb.js`, and `api/benna.js`. What remains is configuration — environment variables, a cron run, and a verification pass — not implementation.

---

## 1. What v1 is, in one paragraph

Every ad request carries `intent_tokens` (an array of short strings describing what the user is doing). Every campaign carries `target_intent_tokens` (an array of strings describing what the campaign wants to match). v1 replaces the v0 Jaccard set-overlap with a cosine similarity between two pre-computed embedding vectors: one for the request (looked up at bid time from a per-token cache), one for the campaign (pre-computed at create/edit time). When either side has no embedding the path falls back to the v0 Jaccard so the system never breaks. The embedding model is Voyage AI's `voyage-3-lite` (512 dims), Anthropic's recommended provider.

## 2. What's already shipped

### Database (`db/04_bbx_mcp_extensions.sql`, `db/07_embedding_cache.sql`, `db/08_voyage_embeddings.sql`)

- `pgvector` extension enabled.
- `campaigns.intent_embedding vector(512)` — nullable; populated by `_embedPromote()` from the campaigns cron.
- `intent_embedding_cache` table — `(token text primary key, embedding vector(512), embedded_at timestamptz)`. The hot-path cache.
- `intent_embedding_misses` queue + `bbx_log_embedding_misses(p_tokens text[])` RPC — fire-and-forget logging when a bid-path lookup can't find a token in the cache.
- ivfflat ANN index on `campaigns.intent_embedding` (created conditionally once at least one row is non-null).
- GIN indexes on `target_intent_tokens`, `target_active_tools`, `target_host_apps`, `target_surfaces`.

### Server-side helpers (`api/_lib/embeddings.js`)

- `embedText(string)` — synchronous Voyage call with deterministic-hash LRU cache (5,000 entry cap). Used only by the offline cron, never by the bid path.
- `embedTokens(array)` — normalises + sorts + joins, then `embedText`. Cache key is order-independent.
- `lookupCachedEmbedding(tokens)` — **the hot-path function the bid loop calls**. Single `select token, embedding from intent_embedding_cache where token = ANY(...)`. Averages the returned vectors. Logs misses async to the queue. Sub-5ms in our local timing. Returns `null` if zero hits, so the caller falls back cleanly.
- `averageVectors([v1, v2, ...])` — mean-pool the per-token vectors into a single context vector.
- `isAvailable()` — true when `VOYAGE_API_KEY` is set. Every helper resolves to `null` when the key is missing, so a key-less environment serves ads via the Jaccard fallback without crashing.

### Bid path (`api/mcp.js`, `api/rtb.js`)

```js
// api/mcp.js:548
const requestEmbedding = await lookupCachedEmbedding([
  ...(args.intent_tokens || []),
  ...(args.active_tools  || []),
]);

// api/mcp.js:660-667 (per-candidate)
const priced = benna.scorePrice({
  intent_tokens:              args.intent_tokens || [],
  request_intent_embedding:   requestEmbedding,    // hot-path cosine input
  // ...
  campaign: {
    target_intent_tokens: c.target_intent_tokens || [],
    intent_embedding:     c.intent_embedding || null,  // pre-computed cosine input
    // ...
  },
});
```

### Scoring (`api/benna.js`)

- `cosineSimilarity(a, b)` — standard cosine, no normalisation cache. Used only when both vectors are present.
- `intentMatchScore({ tokens, campaignTokens, requestEmbedding, campaignEmbedding })`:
  - When both embeddings present → cosine, clipped to `[0.2, 1.5]` per protocol §9.
  - Otherwise → Jaccard, same clipping range.
  - **Same return-range whether cosine or Jaccard fires.** This is what makes the upgrade transparent to the auction.
- `scorePrice()` consumes both vectors via `opts.requestEmbedding` and `opts.campaignEmbedding` (`api/benna.js:482-483`).

### Campaign-side pre-compute (`api/campaigns.js:1054-1163`)

- `_voyageBatchEmbed(tokens)` — POSTs to `https://api.voyageai.com/v1/embeddings` with `model: "voyage-3-lite"` and an `input[]` of token strings. Returns `number[][]` aligned with the input.
- `_embedPromote(supabaseClient, slice, vecs)` — UPSERTs into `intent_embedding_cache` AND updates each campaign whose tokens cover this slice. Idempotent.
- Called from the campaigns cron job (`/api/campaigns?action=embed_drain`, scheduled daily at 01:30 UTC per `vercel.json`).

### Telemetry (`api/_lib/auction_log.js:143`)

- `request.intent_tokens` (truncated to 16 tokens, 40 chars each) — persisted per auction.
- `request.context_summary` — persisted, truncated.
- This is what we'd fine-tune a custom embedding model on later if Voyage stops being good enough.

## 3. What's NOT yet shipped (the activation checklist)

### 3.1 Environment configuration

- [ ] `VOYAGE_API_KEY` set in Vercel production environment.
- [ ] `VOYAGE_API_KEY` set in Vercel preview environment (so PR previews use the cosine path).
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is set (the embeddings helper reads from this).
- [ ] Sign up for a Voyage AI account if not already — `voyage-3-lite` is on the pay-per-token tier; budgeted at < $0.30/day at 200k impressions (see §5).

### 3.2 Cache priming

The hot-path cache is empty by default. Priming options, in increasing order of confidence:

- [ ] **Cold start (lazy).** Do nothing; the first bid that requests an uncached token logs the miss to the queue, and the next cron drain embeds it. Net effect: the first 24 hours after launch run mostly on the Jaccard fallback while the cache fills. Acceptable for an internal-validation launch but not for a publisher-facing one.
- [ ] **Seed file (warm start).** `db/seed-embedding-tokens.json` exists with a curated seed set. Run a one-off SQL or a `node` script that pushes each seed token through `embedText()` and inserts into `intent_embedding_cache`. Recommended for the Fissbot integration launch.
- [ ] **Top-N drain (warm start, data-driven).** Query the last 7 days of `auction_logs.request.intent_tokens`, take the top 500 distinct tokens by frequency, run them through `_voyageBatchEmbed` in batches of 100, insert into the cache. Best option once production traffic exists.

### 3.3 Campaign-side pre-compute

The campaigns cron (`/api/campaigns?action=embed_drain`) runs daily at 01:30 UTC. Until it has run at least once with a real `VOYAGE_API_KEY`:

- [ ] `campaigns.intent_embedding` is `NULL` for every row.
- [ ] Every auction falls back to Jaccard for the cosine path.
- [ ] The ANN index `campaigns_intent_embedding_idx` is NOT created (the migration creates it conditionally once at least one row is non-null).

Verification: after the first cron run with a valid key, `select count(*) from campaigns where intent_embedding is not null` should be `> 0`, and `\di` should list `campaigns_intent_embedding_idx`.

### 3.4 Cron schedule sanity

- [ ] `vercel.json` already lists `/api/campaigns?action=embed_drain` at `"30 1 * * *"` (daily, post-aggregate). Verify it's not silently disabled in production.
- [ ] Add `/api/embed-cron` (or wire embedding-cache drain into the same campaigns cron) to drain `intent_embedding_misses`. Currently the miss queue accumulates but only drains during campaign embedding — fine if `target_intent_tokens` overlap heavily with request tokens, suboptimal otherwise. **Decision point §6.1.**

## 4. Verification — proving cosine is live in production

Run these against production after activation:

```sql
-- 1) Cache populated
select count(*) as primed_tokens,
       max(embedded_at) as last_embed
from intent_embedding_cache;

-- 2) Campaigns populated
select count(*) as embedded_campaigns,
       count(*) filter (where intent_embedding is null) as still_jaccard_only
from campaigns
where status = 'active';

-- 3) ANN index present
select indexname from pg_indexes
where tablename = 'campaigns' and indexname = 'campaigns_intent_embedding_idx';

-- 4) Recent auctions show cosine signal
select request->>'intent_tokens' as req_tokens,
       jsonb_array_length(scored_candidates) as cand_count,
       (scored_candidates->0->>'intent_match_score')::float as winner_intent_score
from auction_logs
where ts > now() - interval '1 hour'
order by ts desc
limit 20;
```

The fourth query is the key telemetry: `intent_match_score` should show a distribution wider than Jaccard's `[0.4, 1.5]` once cosine is live. With Jaccard fallback dominating, you'll see clustering around 1.0 (neutral, when tokens don't overlap) and 1.5 (clip ceiling when they do). With cosine active, you'll see a smoother distribution between `[0.2, 1.5]` because semantic similarity is continuous, not set-overlap-discrete.

## 5. Cost math

Voyage `voyage-3-lite` pricing (2026-06-15): roughly $0.02 per 1M input tokens, no output. Embedding-only model.

Per-impression cost on the hot path: **zero**. The hot path hits `intent_embedding_cache` only. No external API call during auctions.

Per-impression cost on the cron drain: amortised across all impressions that share a token. Worked example for the volumes the memory cites:

- 200k impressions/day × ~6 intent tokens per request average = 1.2M token-lookups/day.
- Of those, after cache is warm, say 5% miss → 60k token-embeds/day → ~60k × ~5 chars × ~1.5 tokens/word = ~450k Voyage tokens.
- 450k × $0.02 / 1M = **$0.009/day**. Effectively zero.

Scale to 30M impressions/day with the same hit rate: ~135k Voyage tokens (note: same 5% miss rate means actual API calls grow sub-linearly because the working-set of tokens saturates). Still under $0.10/day.

Campaign-side cost: linear in `count(distinct target_intent_tokens)` × `count(campaigns)`. For 1,000 active campaigns × ~10 tokens each, that's 10k Voyage tokens once, then ~100/day for new campaigns. Negligible.

**Voyage budget alert threshold: $5/day.** If it ever crosses that, something's misbehaving (cache invalidation bug, cron embedding the same tokens repeatedly, etc.) — investigate before optimising.

## 6. Open decision points

### 6.1 Embedding-miss drain cadence

**Current:** misses accumulate in `intent_embedding_misses`; the campaigns cron processes them once a day at 01:30 UTC. New tokens take up to 24h to enter the cache.

**Decision:** is 24h acceptable?

- For Fissbot-only validation: yes, vocabulary will saturate within the first few days.
- For 20-publisher launch: probably not — new publishers introduce new tokens daily. Recommend adding `/api/embed-cron` as a separate hourly cron, but Hobby plan cron limits us to daily-or-rarer (see [[reference_vercel_hobby_limits]]). Pro plan or a different scheduler needed.
- Workaround if staying on Hobby: have `/api/mcp` opportunistically embed-and-cache the request's own tokens on cache miss, with a tight timeout (~50ms). This makes the bid path slower for novel tokens but eliminates the 24h gap.

### 6.2 ANN index recall vs. exact scan

**Current:** `ivfflat` with `vector_cosine_ops`, no `lists` parameter tuned. At low row counts (< 10k campaigns) ivfflat can underperform a sequential scan.

**Decision:** at what campaign count do we tune `lists` and switch to `hnsw` if performance matters?

- Below 1,000 active campaigns: ignore, sequential scan is faster.
- 1,000–10,000: tune `lists = sqrt(rows)` per pgvector docs.
- Above 10,000: migrate to `hnsw` index (Postgres 16 + pgvector 0.7+ required).

This is a future-me problem. Document the threshold; revisit when campaign count crosses 1,000.

### 6.3 Multi-language tokens

**Current:** tokens are lowercased English in the v0 → v1 migration assumption. Real publisher tokens in production will include CJK, Vietnamese, etc.

**Decision:** does `voyage-3-lite` handle multi-language tokens well enough?

Voyage's docs claim multi-lingual support. Validate this with an internal test: embed a handful of CJK + Vietnamese intent tokens, manually inspect cosine similarity against semantically-related English tokens. If cross-language similarity is weak, the architecturally correct fix is per-language embedding caches (`intent_embedding_cache_zh`, `intent_embedding_cache_ja`) keyed off the request's `user_language`.

For launch: defer this until a multi-language publisher actually integrates.

### 6.4 Campaign re-embed on token edit

**Current:** when an advertiser edits `target_intent_tokens` in the campaigns dashboard, `intent_embedding` is **not** automatically re-computed until the next nightly cron run.

**Decision:** is this acceptable?

- It means a campaign edited at 14:00 UTC runs on stale embeddings until 01:30 UTC the next day.
- Workaround: on `PATCH /api/campaigns/:id`, if `target_intent_tokens` changed, set `intent_embedding = NULL` and let the next bid path fall back to Jaccard for that campaign until the cron re-embeds. Safer than leaving the stale embedding in place.
- Stronger fix: trigger an immediate `_voyageBatchEmbed` for the changed campaign in the PATCH handler (with timeout fallback to NULL). Adds ~150ms to the edit-save round trip but campaigns are correct within seconds.

Recommend the stronger fix. ~30 lines of code in `api/campaigns.js`.

## 7. Rollout sequence

1. **Set `VOYAGE_API_KEY` in Vercel preview.** Push a small smoke commit. Verify the cosine path lights up in a preview deployment using §4 queries.
2. **Seed the cache** with the curated `seed-embedding-tokens.json` set via a one-off `node` script run against staging.
3. **Set `VOYAGE_API_KEY` in Vercel production.** No code deploy needed — the helper auto-detects on next request.
4. **Trigger the campaigns cron manually** via the Vercel dashboard so we don't wait until 01:30 UTC. Verify `campaigns.intent_embedding` populates and the ANN index gets created.
5. **Run §4 verification queries** against production. Confirm cosine signal in `auction_logs`.
6. **Update [[intent_capture_reality]] memory** to reflect that cosine is live, not aspirational.
7. **Update marketing copy.** "Benna AI scores ads on intent" is now defensible at the cosine level, not just the protocol level. The only honest qualifier remaining is that the JS Snippet door still feeds Benna with page-chrome-derived context until publishers set `data-lumi-context` explicitly — that's a publisher-discipline gap, not a Benna gap.

## 8. What this changes about the moat narrative

Pre-v1: "we have slots cookie networks can't fill" (protocol moat only).

Post-v1: "we have slots AND we score them semantically." Both halves are now defensible.

The remaining honest qualifier — the JS Snippet door — is independent of Benna. It's about what publishers feed *into* Benna, not what Benna does with what it's fed. Fixing that is the [[context_as_primary_plug_and_play]] workstream, not this one.
