# BBX — Scale Ceiling Analysis

**Date:** 2026-05-11
**Purpose:** honest assessment of where the current Vercel + Supabase + Stripe stack stops working as traffic grows. Operator reference for "when do I need to migrate what?" Not a doomsday forecast — concrete thresholds with concrete actions.

---

## TL;DR thresholds

| You're at... | Stack handles it? | First thing to do |
|---|---|---|
| 0–10k impressions/day | ✅ Comfortably | Nothing. Run the autonomous loop. |
| 10k–50k impressions/day | ✅ Still fine | Watch Supabase dashboard. Vercel function logs. Phase H Panel 1 starts paying off. |
| 50k–100k impressions/day | ⚠️ Watch closely | Upgrade Supabase to Pro ($25/mo). Verify auction p95 latency stays < 500ms. |
| 100k–250k impressions/day | ⚠️ Stack cracks at edges | Move payout cron off Vercel (Render worker). Add Supabase connection pooling. |
| 250k–1M impressions/day | ❌ Vercel-only stack breaks | Worker service mandatory. Postgres read replicas or external cache for auction hot-path reads. |
| 1M+ impressions/day | ❌ Hot path itself needs redesign | Migrate auction-serving to a dedicated edge worker (Cloudflare Workers, Fly.io). Vercel stays for marketing pages + dashboards. |

You're aiming for "hundreds of thousands per day" — say ~200k. That puts you in the **100k-250k band**: stack still works but two specific things need attention (cron migration + Supabase tier). Neither is a launch blocker; both are pre-emptive preparation.

---

## The hot path: per-auction database load

Every successful auction (`/api/mcp` → `tools/call → get_sponsored_content`) does roughly **5 DB operations**:

1. **Read** `placements` (`api/mcp.js:355`) — slot config, floor, freq cap
2. **RPC** `bbx_freq_cap_count` (`api/mcp.js:369`) — if a freq cap exists
3. **Read** `campaigns WHERE status='active'` (`api/mcp.js:389`) — candidate pool
4. **Read** `developers` (`api/mcp.js:411`) — publisher metadata
5. **Write** `auction_logs` (`api/_lib/auction_log.js:124`) — audit trail row

When the publisher's SDK fires the impression beacon afterward via `/api/track`, that's another **3 DB ops**:

6. **Read** `campaigns` (for cost computation) — `api/track.js:174`
7. **Update** `campaigns` (atomic spent_today/spent_total) — `api/track.js:332`
8. **Insert** `events` — `api/track.js:341`

Plus the Phase E Day 2 accrual: one more **RPC** call to `bbx_credit_publisher_balance` (which internally does an INSERT…ON CONFLICT, so 1 logical op).

**Total per served impression: ~9 DB operations.**

### What that means at scale

| Impressions/day | DB ops/day | Avg ops/sec | Peak ops/sec (5× of avg) |
|---|---|---|---|
| 10k | 90k | 1 | 5 |
| 100k | 900k | 10 | 50 |
| 200k | 1.8M | 21 | 105 |
| 500k | 4.5M | 52 | 260 |
| 1M | 9M | 104 | 520 |

Supabase plans handle:
- **Free:** ~60 concurrent connections, ~200 ops/sec sustained. Breaks at ~10k impressions/day peak.
- **Pro ($25/mo):** ~200 connections, ~600 ops/sec sustained. Comfortable through ~50k impressions/day.
- **Team ($599/mo):** ~400 connections, dedicated CPU. Comfortable through ~500k impressions/day.
- **Enterprise:** scales further.

**Your current tier:** check `vercel env ls` → `SUPABASE_URL` — the project is likely on Pro since you've been using Stripe + real workflows. Confirm in Supabase dashboard → Project Settings → Billing.

**Recommendation for 200k target:** Pro is borderline. At 105 peak ops/sec you're at ~17% of Pro's sustained capacity, but bursts during high-traffic moments could spike. **Either:**
- Stay on Pro and monitor — Supabase will warn before you hit limits
- Pre-emptively jump to Team — buys you 5× headroom and dedicated CPU (no noisy-neighbor risk)

---

## Vercel function timeouts

Vercel serverless function execution time limits:

- **Hobby:** 10 seconds (default), max 60s with explicit config
- **Pro:** 60 seconds (default), max 300s with `maxDuration` export

### Hot path (auction serving)

Per-auction code path runs in **20-150ms** typical, peak ~500ms with cold-start. **No timeout risk.** Even at 5x traffic spikes, single-function latency stays well below any plan's limit.

### Cron jobs — this is where it gets interesting

| Cron | Today's runtime estimate | At 100 publishers | At 1,000 publishers |
|---|---|---|---|
| `/api/stats?type=aggregate` (daily ETL) | < 5s | 10-30s | 60-180s ⚠️ |
| `/api/stats?type=recon` (daily) | < 3s | 5-15s | 30-60s |
| `/api/billing?action=run_payout_cron` (Friday) | < 5s | **60-180s ⚠️** | **300-900s ❌** |
| `/api/billing?action=run_payout_retry_sweep` (Saturday) | < 2s | 5-20s | 30-120s |

Why payout_cron blows up fast: each eligible publisher requires **1-2 sequential Stripe API calls** (transfer + balance debit). At 100 eligible publishers, that's 100-200 sequential calls × ~1s each = 100-200s. Vercel Pro's 60s default times out at maybe 50 publishers; with `maxDuration: 300` config, Pro handles ~250 publishers; beyond that, **the function cannot complete in time.**

### Mitigations within Vercel

1. **Bump `maxDuration` to 300s** — one line at the top of `api/billing.js`:
   ```js
   module.exports.config = { maxDuration: 300 };
   ```
   This buys you headroom through ~250 simultaneous payouts on Pro. **Do this before your first 50 publishers.**

2. **Parallel Stripe API calls** — currently the cron processes publishers in a `for...of` loop, sequentially. Switching to `Promise.all` with batched parallelism (e.g. 10 at a time) cuts runtime ~10x. Trade-off: error handling gets more complex. Doable but worth the engineering.

3. **Batch / paginate across cron invocations** — Friday cron writes a "payout queue" of pending transfers, Saturday + repeated triggers drain it. More cron entries, more complexity, but unblocks any scale.

### Mitigations beyond Vercel (when you outgrow)

When the cron hits the ceiling even with all three mitigations:

- **Render Background Worker** — long-running Node process, no serverless timeouts. ~$7/mo.
- **Railway / Fly.io machines** — same idea, slightly different pricing.
- **Supabase Edge Functions** — Deno runtime, can run longer cron jobs (50s soft limit, but multiple chained invocations).
- **Inngest / Trigger.dev** — managed job runners with built-in retry/observability, ~$20/mo at small scale.

**Recommendation:** when you're approaching 100 simultaneous payouts (so probably your 50th-80th publisher), wire `api/billing.js`'s cron actions to a **Render Background Worker** that polls Supabase for pending payouts every minute. Vercel cron becomes a simple kick-off; the Worker does the actual transfers. 2-3 days of engineering when needed; not now.

---

## Connection pooling

Supabase's hosted Postgres limits connections per plan. Vercel serverless functions don't share connection pools across invocations — each cold function instance opens a new connection.

At 50 ops/sec across multiple Vercel function instances, connection churn becomes the bottleneck before raw query throughput does.

**Today:** the Supabase JS client uses HTTP/1.1 pooling internally. Works fine through ~50k impressions/day.

**At 100k+ impressions/day:** enable Supabase's **PgBouncer** transaction-mode pooler:
- Free at any tier — just change the connection string in `SUPABASE_URL` from `db.your-ref.supabase.co:5432` to `db.your-ref.supabase.co:6543`
- Compatible with Supabase JS client
- Multiplexes Vercel's many short-lived connections onto a stable backend pool

**Action:** when you hit ~50k impressions/day sustained, switch connection strings.

---

## Hot-path read caching

The `campaigns WHERE status='active'` query at `api/mcp.js:389` reads the full active-campaign pool on **every auction**. At 200k impressions/day with say 50 active campaigns, that's 200k × 50 rows = 10M rows-read/day just for eligibility.

This is the single biggest query-load item.

### Mitigations

1. **In-process cache** with TTL — keep the campaign list in memory for 60 seconds. Each Vercel function instance refreshes independently. Trade-off: a campaign paused at 12:00:00 might still serve until 12:01:00. Acceptable; that's already true of any cache-coherent system.

2. **Selective fields** — currently `SELECT *`. Reduce to only the fields the eligibility filter needs (~10 fields instead of ~40). Cuts query cost ~70%.

3. **Indexed eligibility column** — add a computed `is_eligible_now` boolean updated by Supabase trigger when budget hits exhaustion. Hot-path query becomes `WHERE is_eligible_now = true`. Most ad networks do this.

**Recommendation:** when you hit 25k impressions/day, do (1) and (2) — both are half-day patches. Defer (3) until you have 1000+ campaigns.

---

## Stripe rate limits

Stripe's documented production limits:
- **Read endpoints:** 100 req/sec
- **Write endpoints:** 100 req/sec
- **Transfers (Connect):** explicitly capped at 100 transfers/sec

At Friday's cron firing 100 simultaneous payouts: well within limits. At 1000 simultaneous payouts: 10s minimum just to clear Stripe's rate limit, even with perfect parallelism.

**Mitigation when needed:** Stripe supports retry-after backoff. Phase E's cron already classifies rate-limit errors as Tier-1 (retry). At very high scale you'd want explicit token-bucket pacing in the cron. Not urgent until 500+ simultaneous payouts.

---

## Webhook delivery at scale

Stripe sends one webhook per event. At 200k impressions/day with say 5% conversion rate, that's:
- ~10k advertiser-side `checkout.session.completed` events/day (advertiser deposits — high spike volume on first sign-ups, low steady state)
- ~10k `charge.refunded` events/day (very rare; mostly zero)
- ~50 `account.updated` events/day from connected accounts (per-publisher onboarding state changes)
- ~50 `payout.failed` events/day worst case (probably zero in practice)

Total Stripe webhook volume: ~20k/day peak. Vercel handles webhook endpoints at this rate trivially.

**The real risk:** if our webhook handler ever throws or 5xx's, Stripe retries with exponential backoff. If a bug causes 100% failure, you can be drowning in retried webhooks within hours. Phase E Day 6 added structured logging to `account.updated`; do the same to `charge.refunded` and `checkout.session.completed` if you ever debug a webhook flood.

---

## Vercel cron quirks to watch

Already documented in saved memory + project_instructions:

- **Hobby plan: 2 crons max, daily-or-rarer.** You're on Pro (per `package.json` deploy commands and the 5 currently-configured crons). Pro supports up to 40 crons on a project.
- **Crons execute within a 1-hour flex window** of their schedule. The Friday `0 12 * * 5` could actually run any time from 12:00–13:00 UTC. Plan around this — don't make payouts critical-second-aligned.
- **Cron auth via `Authorization: Bearer ${CRON_SECRET}`** is automatic in production. CRON_SECRET env var is required for the handler to accept the cron's request.

---

## Specific advice for "I'm aiming for 200k impressions/day"

Honest read: **you're 4-6 weeks of organic publisher growth away from hitting these thresholds in a meaningful way.** First 20 publishers from outreach probably bring 5-15k impressions/day combined. You don't need to do anything from this analysis before outreach starts.

**Pre-emptive items to add to the engineering backlog:**

1. **Before launch** — add `module.exports.config = { maxDuration: 300 }` to `api/billing.js`. One-liner, prevents the payout cron from timing out at 50+ publishers.

2. **At ~25k impressions/day** — implement the 60s campaign-pool cache + selective field select on the auction hot path. Half-day.

3. **At ~50k impressions/day** — switch to PgBouncer connection string (3-minute config change in Vercel env vars + redeploy). Verify p95 auction latency stays < 500ms.

4. **At ~75-100 simultaneous Friday payouts** — split the cron into Vercel-trigger + Render Background Worker doing the actual Stripe API calls. 2-3 days of engineering.

5. **At ~1000 active campaigns** — add `campaigns.is_eligible_now` column maintained by a Supabase trigger. Move eligibility check from JS to indexed SQL. 1 day.

6. **Never (until volume forces it)** — DSP integration, fraud detection, ML training. Each one is a separate phase with its own design doc.

---

## The architecture diagram for "post-Vercel-only" stage

When you outgrow the all-Vercel stack (probably ~6-12 months after Stage 1 outreach starts, depending on growth velocity), the natural target architecture is:

```
┌────────────────────────────────────────────────────────────────┐
│  Vercel (Edge)                                                 │
│  ────────────────                                              │
│  - Marketing site (/publish, /docs, etc.)                      │
│  - Publisher + advertiser dashboards (/developer, /advertiser) │
│  - Admin console (/admin)                                      │
│  - Auction-serving API (/api/mcp, /api/rtb)                    │
│  - Beacon endpoints (/api/track)                               │
│  - Stripe webhook receiver (/api/stripe-webhook)               │
│  - Public-facing recon (/api/stats?type=recon)                 │
└──────────────┬─────────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────────┐
│  Supabase (Database + Auth)                                    │
│  ────────────────────────────                                  │
│  - Postgres (all tables)                                       │
│  - PgBouncer pooler                                            │
│  - Auth (publisher + advertiser sessions)                      │
│  - Storage (creative assets)                                   │
└──────────────┬─────────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────────┐
│  Worker Service (Render / Railway / Fly.io)                    │
│  ──────────────────────────────────────────                    │
│  - Friday + Saturday payout crons (Stripe transfers)           │
│  - Daily aggregation ETL (events → daily_stats)                │
│  - Stats / recon batch jobs (anomaly detection)                │
│  - Conversion attribution windows                              │
│  - ML training pipelines (when applicable)                     │
│  - Fraud detection scans                                       │
└──────────────┬─────────────────────────────────────────────────┘
               │ writes to / reads from
               ▼
        same Supabase DB
```

The migration sequence (when needed):

1. Stand up a Render Background Worker
2. Move `handleRunPayoutCron` body to the Worker, have it poll a `payout_jobs` table
3. Vercel cron becomes a tiny "enqueue Friday job" trigger
4. Repeat the pattern for aggregate + recon as they grow

This is a "Phase J" or post-launch infrastructure item. Not in scope for Stage 1.

---

## What to monitor

Set up these queries / dashboards before you have problems:

1. **Daily** — `/api/stats?type=recon` output (already auto-runs daily). Watch `production.ratio`, `payout_cron_health.failed_tier1_count`, `publisher_balance_health.drifted`.

2. **Weekly** — Supabase dashboard → Database → Query Performance. Look for slow queries > 100ms.

3. **Weekly** — Vercel dashboard → Project → Functions → invocations + duration histograms. Watch p95 latency on `/api/mcp` and `/api/track`.

4. **Per Friday** — Vercel logs for `bbx:payout_cron:done` and `bbx:payout_cron:tier3_alert`. If Tier-3 fires once, debug; if it fires consecutively, pause cron + investigate.

5. **Monthly** — Supabase dashboard → Storage + Database size. `auction_logs` retention is 30 days but uses jsonb-compressed storage; verify it's not ballooning.

---

## Bottom line

**Through your first 50 publishers (~5-25k impressions/day), the current stack works without modification.** Add the `maxDuration: 300` one-liner before outreach starts; everything else is optional.

**Through 100 publishers (~25-100k impressions/day), apply patches 1-3 above** (campaign cache, selective select, PgBouncer). Each is a half-day or less; together ~1.5 days of engineering.

**Beyond 100 publishers + 100k impressions/day, plan for the Render Worker migration.** 2-3 days of engineering when traffic forces it. Not before.

**You're not going to hit any of these limits during outreach.** Outreach starts at zero traffic. By the time you have measurable load, you'll have weeks of runway to act. This document is the playbook for that runway, written in advance so you're not improvising under pressure.

---

## Files referenced in this analysis

```
api/mcp.js                           — auction serving
api/track.js                         — beacon writes
api/billing.js                       — payout cron
api/stats.js                         — recon / aggregate
api/_lib/auction_log.js              — audit trail writes
api/_lib/publisher_balance.js        — balance accrual
api/_lib/campaign_history.js         — 7-day CTR rollup with 5-min cache
db/08_auction_logs.sql               — 30-day retention via bbx_prune_auction_logs()
db/13_publisher_balance_accrual.sql  — atomic credit/debit RPCs
vercel.json                          — cron schedule
```
