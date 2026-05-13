# Phase C — Benna Data-Reuse Loop — Report

Date: 2026-05-11
Status: ✅ Shipped (no DB migration required).
Tests: 204 passing (was 189; +15 closed-loop Benna tests).

## The gap before Phase C

Benna's scoring functions (`scoreBid`, `scorePrice`) used fixed per-signal weights and a static `placement.baseline_ctr`. They never read the events table. Phase A and B made sure events flowed end-to-end correctly — but until this phase, that data was a dead end.

Comment at `api/benna.js:19` made the gap explicit:
> "Once we have outcome data, swap the per-signal weights for a learned table."

That's now wired.

## What changed

### New module — `api/_lib/campaign_history.js`

- `getCampaignHistoryBatch(sb, campaignIds)` → `Map<campaign_id, History>` covering every input id.
- Batched: one SQL query per auction, regardless of candidate count.
- In-process cache, TTL 5 min, so repeat bids on a hot campaign don't roundtrip.
- 7-day window. Sandbox events excluded (sandbox CTR shouldn't move production bids).
- Cold-start fallback when `sb=null` (demo/test mode) or when no events exist.
- Tunables exported: `MIN_WARM_IMPRESSIONS=100`, `TTL_MS=300000`, `WINDOW_MS=7d`.

History shape:
```
{ impressions, clicks, conversions, ctr, cvr, isWarm, fetchedAt }
```

### `api/benna.js` — closed-loop scoring

**Model version bumped: `benna-rc4-2026.05.01` → `benna-rc5-2026.05.11`.**

`scoreBid(context, campaign, history?)` — third arg added (optional, default `null`).

- `history=null` → identical behavior to rc4 (back-compat).
- Cold campaign (`isWarm=false`) → modifier 1.0, `learning_phase` row in `signal_contributions` with the impression count.
- Warm campaign → modifier = `clamp(observed_ctr / 0.02, 0.5, 2.0)`. `p_click_raw` multiplied by modifier; capped at `P_CLICK_CEIL=0.12`.
- Result includes a new `learning: { phase, modifier, impressions_7d, ctr_7d, cvr_7d }` block so auction logs can replay how the bid was computed.

`scorePrice(req)` — `req.history` field added (optional).

- Without history → `factors.baseline_source = "placement_default"` (unchanged).
- Warm history → `baseline_ctr` becomes `placement.baseline_ctr × clamp(ctr/0.02, 0.5, 2.0)`, `factors.baseline_source = "observed_ctr_7d"`.
- Cold history → keeps placement default but `factors.learning` shows the cold state for debugging.

### `api/mcp.js` — hot-path wiring

Before scoring loop:
```js
const historyMap = await getCampaignHistoryBatch(sb, afterMcp.map(c => c.id));
```

Each candidate's history is passed to both `scoreBid` and `scorePrice`. The fetch is batched and cached, so even with N candidates per auction the impact is O(1) DB calls in steady state.

### Tests — `tests/benna.test.js` (new)

15 new tests covering:

- Back-compat: `scoreBid` without history works identically.
- Cold history (insufficient imps): modifier 1.0, learning row at 0 lift.
- Warm with above-baseline CTR (4%): modifier clamps to 2.0, positive lift.
- Warm with below-baseline CTR (0.5%): modifier clamps to 0.5, negative lift.
- `p_click` cap at 0.12 even when modifier is at 2.0 ceiling.
- `scorePrice` baseline shifts up when warm + high CTR; price_cpm rises.
- `getCampaignHistoryBatch`: demo-mode cold entries, empty-input handling, cache hits.
- Model version bump verification.

## How the loop actually closes (the demo flow)

1. Campaign launches, picks up traffic via auctions. `scoreBid` returns `learning.phase="learning"` for the first few impressions — bid driven by deterministic targeting overlap only.
2. Once impressions ≥ 100 in a 7-day window, the campaign goes warm. `learning.phase` flips to `"warm"`.
3. If CTR > 2% (baseline), Benna boosts the campaign's p_click on subsequent auctions, raising its bid up to 2× higher than the cold-state bid. If CTR < 2%, the bid is suppressed down to 0.5× — the campaign now has to compete on price.
4. Every auction stamps the learning state into `auction_logs.candidates[*].prediction.learning`, so an operator can inspect any auction and see exactly why each bid landed where it did.
5. As `events` accumulates more rows, the 5-min cache refreshes, and the bid responds within 5 minutes of new outcome data landing.

## What's still open

- **Real ML training** — the modifier is `min(2, max(0.5, observed_ctr / 0.02))`. That's a linear scale, not a learned function. The instrumentation is in place (`learning.modifier` on every score result, stamped into `auction_logs`) so a future trained ranker can swap in by replacing the `learningModifier()` body. Gated on real volume per the project plan.
- **Per-context history** — today the modifier is per-campaign (one CTR for the whole campaign). The richer signal would be per-(campaign, host_app, surface, intent_token) — but that needs more volume before slicing pays off. Add when traffic supports it.
- **CVR weight** — currently only CTR feeds the modifier. CVR is collected and surfaced in `learning.cvr_7d` but doesn't yet bias the score. Trivial to add once we have any conversion data in production; the modifier formula just becomes `f(ctr, cvr)` instead of `f(ctr)`.
- **Cache invalidation** — TTL is 5 min. For a campaign that just changed targeting, the old CTR is briefly stale. Not a correctness issue (the bid just lags the change by < 5 min). Worth revisiting if it matters.

## How to verify in production

After deploy, run a real auction (or wait for one) and inspect the auction log:

```sql
select auction_id, ts, candidates
from auction_logs
where ts >= now() - interval '1 hour'
  and is_sandbox = false
order by ts desc
limit 1;
```

`candidates[*].prediction.learning` should show the phase + modifier for each campaign. `candidates[*].priced.factors.baseline_source` should be `"placement_default"` for cold campaigns and `"observed_ctr_7d"` for warm ones.

Cold-start warning: until ≥ 100 impressions accumulate per campaign, every campaign will show `phase="learning"` and `modifier=1.0`. That's the correct behavior — Benna ships rc5 in the **learning state by default**, which means production bids are unchanged from rc4 until real outcome data lands.

## Files changed

```
api/benna.js                              # rc5 scoring with learning modifier
api/mcp.js                                # batch-fetch history before scoring loop
api/_lib/campaign_history.js              # NEW — 7-day CTR/CVR cache
tests/benna.test.js                       # NEW — 15 closed-loop tests
package.json                              # add benna.test.js to test script
db/PHASE-C-REPORT-2026-05-11.md           # this file
```

No DB migration required — `events` already has every column we need (`event_type`, `campaign_id`, `is_sandbox`, `created_at`).

## Deploy block

```bash
cd ~/boostboss
git add api/benna.js api/mcp.js api/_lib/campaign_history.js \
        tests/benna.test.js package.json \
        db/PHASE-C-REPORT-2026-05-11.md
git commit -m "Phase C: Benna data-reuse loop — observed CTR feeds back

- api/_lib/campaign_history.js: NEW batched 7-day CTR/CVR rollup with
  in-process 5-min cache. Sandbox events excluded. Returns cold entries
  in demo mode so unit tests + tests/benna.test.js stay hermetic.
- api/benna.js: scoreBid and scorePrice both accept optional history arg.
  Warm campaigns (≥100 imps) get observed-CTR modifier clamped to [0.5, 2.0].
  Cold campaigns get a learning_phase fallback that leaves the bid
  unchanged but surfaces the state in signal_contributions. Model
  version bumped to benna-rc5-2026.05.11.
- api/mcp.js: batch-fetches history for every auction candidate via a
  single SQL round-trip before the scoring loop.
- tests/benna.test.js: 15 new tests covering cold/warm paths, clamp
  bounds, scorePrice baseline shifts, and campaign_history cache hits.
- package.json: add benna.test.js to npm test script.

Closes Stage 1 item 3 (data collection drives optimization). Bids now
respond to observed performance within 5 minutes; previously Benna was
fully deterministic regardless of how many impressions accumulated."

git push origin main
vercel --prod --yes   # webhook is flaky; CLI bypass is the unblock
```

Phase C locks once `vercel --prod` finishes and you've run a real auction. Send me the `candidates[0].prediction.learning` block from a recent `auction_logs` row to confirm the closed-loop wiring is live.
