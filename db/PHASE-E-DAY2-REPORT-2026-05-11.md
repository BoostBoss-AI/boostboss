# Phase E — Day 2 Report

Date: 2026-05-11
Status: ✅ Shipped locally (pending migration 13 in Supabase + push).
Tests: **221 passing** (was 216; +5 Day 2 accrual/clawback tests).

## What landed

Day 2 closes the data-collection → spendable-balance loop. Every paid impression / click / video_complete / conversion now atomically increments `publisher_balance` (with pending-clawback satisfaction first). Without this, the Friday cron in Day 3 would have nothing to pay out.

### Migration 13 (`db/13_publisher_balance_accrual.sql`)

Three atomic PostgreSQL functions:

| RPC | Purpose |
|---|---|
| `bbx_credit_publisher_balance(developer_id, amount)` | Atomic increment of `balance` + `lifetime_earned`. Single-statement INSERT…ON CONFLICT pattern. Returns new balance. |
| `bbx_decrement_publisher_balance(developer_id, amount)` | Atomic balance decrement (used by clawback path). Floors at 0. Returns amount actually deducted (so callers can record partial deductions). |
| `bbx_satisfy_pending_clawbacks(developer_id, amount)` | Walks pending clawbacks oldest-first. Each gets fully or partially satisfied by the incoming amount. Returns leftover for spendable balance. |

All three are `SECURITY DEFINER` so service-role and anon callers don't need per-column grants. Single-statement bodies use Postgres row locks for concurrent-write safety.

### New module — `api/_lib/publisher_balance.js`

Encapsulates accrual logic so `api/track.js`, the future Day 3 cron, and the operator admin all call the same code path. Two main exports:

- `creditPublisherBalance(sb, developerId, amount)` — handles clawback satisfaction + balance credit in one call. Returns `{ applied_to_clawbacks_usd, added_to_balance_usd, new_balance, mode }`. Three modes: `supabase-rpc` (happy path), `supabase-fallback` (read-modify-write when migration 13 hasn't been applied yet), `demo` (in-memory).
- `debitPublisherBalance(sb, developerId, amount)` — for the Day 3 cron. Atomic balance decrement + `lifetime_paid` increment.

Demo path maintains a parallel in-memory `Map` (`DEMO_BALANCES`, `DEMO_CLAWBACKS`) so the full clawback-satisfaction flow is testable without a database.

### `api/track.js` integration

After a successful `events` insert (Supabase path) AND after `DEMO_EVENTS.push` (demo path), the handler now calls `creditPublisherBalance` IF the row had `developer_payout > 0 AND is_sandbox = false`. Failures log under `bbx:track:credit_fail` but never bubble up — the events table is the source of truth, balance is recoverable.

Two new response headers surfaced for SDK debug observability:

- `x-publisher-credit-mode: supabase-rpc | supabase-fallback | demo | fail | noop`
- `x-publisher-clawback-applied: <usd>` (only set when > 0)

### Recon extension — `/api/stats?type=recon`

New top-level field: `publisher_balance_health`. Each invocation:

1. Pulls every `publisher_balance` row with `lifetime_earned > 0` (cap 500).
2. Computes `expected_balance = lifetime_earned − lifetime_paid − pending_clawback_remaining`.
3. Flags drift where `abs(balance − expected_balance) > $0.50 AND drift_pct > 1%`.
4. Returns `{ checked, drifted, drift_sample[5] }`.

Cents-level rounding drift is ignored; only operationally-meaningful drift triggers the alert. The drift sample includes the developer_id, all balance fields, and the computed drift so an operator can immediately see what's wrong. Critical alert logged under `bbx:recon:balance_drift`.

### Tests — `tests/track.test.js` (+5 new)

| Test | What it proves |
|---|---|
| `paid impression credits publisher balance in demo mode` | The accrual call fires after a paid event |
| `sandbox event does not accrue to publisher balance` | Sandbox events are gated correctly (regression guard) |
| `pending clawback is satisfied by new earnings before balance accrues` | Earnings settle clawback debt first (Decision 7) |
| `clawback larger than earning leaves balance at 0 and clawback partial` | Partial satisfaction tracked correctly across multiple events |
| `non-paying event (no developer_payout) does not call credit` | Free events (close, skip) don't accidentally trigger accrual |

Total suite: **221 tests passing.**

## What's still open

**Day 3 next:** the weekly payout cron itself. Reads `publisher_balance` for every eligible developer (`payouts_enabled=true`, `payout_blocked=false`, `balance >= $25`), fires Stripe Connect transfers, debits balance via `debitPublisherBalance` on success.

**Operator admin payouts surface (Day 4):** still pending. Today, operators have observability via the recon endpoint but no UI to inspect individual payout attempts, force-retry, etc.

**Live verification:** as written, the credit path uses an in-process fallback when migration 13's RPCs aren't deployed. Production will start using the fallback the moment Day 2 code lands; it'll switch to atomic RPCs the moment migration 13 is applied. Both paths produce the same balance state at low concurrency.

## Deploy steps

**Step 1 — apply migration 13 in Supabase SQL Editor.** Paste the full content of `db/13_publisher_balance_accrual.sql`, run. Expected output: "Success. No rows returned." Then verify:

```sql
SELECT proname FROM pg_proc WHERE proname IN (
  'bbx_credit_publisher_balance',
  'bbx_decrement_publisher_balance',
  'bbx_satisfy_pending_clawbacks'
);
-- expect 3 rows
```

Also re-run `db/check.sql` — should show 15 rows now, all `applied`.

**Step 2 — push + deploy:**

```bash
cd ~/boostboss
git add api/track.js api/stats.js api/_lib/publisher_balance.js \
        tests/track.test.js \
        db/13_publisher_balance_accrual.sql \
        db/check.sql \
        db/PHASE-E-DAY2-REPORT-2026-05-11.md
git commit -m "Phase E Day 2: per-event accrual + clawback satisfaction

- NEW api/_lib/publisher_balance.js: creditPublisherBalance and
  debitPublisherBalance helpers. Supabase RPC path with read-modify-write
  fallback for transitional period. Demo path maintains parallel
  in-memory store for hermetic tests.
- api/track.js: after every paid event insert (developer_payout > 0,
  is_sandbox = false), credit the publisher's balance with pending-
  clawback satisfaction first. Surfaces x-publisher-credit-mode and
  x-publisher-clawback-applied response headers.
- api/stats.js (recon): new publisher_balance_health top-level field
  flagging drift between balance and (lifetime_earned - lifetime_paid -
  pending_clawback). Threshold: >1% AND >\$0.50.
- Migration 13: bbx_credit_publisher_balance,
  bbx_decrement_publisher_balance, bbx_satisfy_pending_clawbacks RPCs.
- Tests: +5 in track.test.js (33 track / 221 total).

Closes the data-collection -> spendable-balance loop. Day 3 (the
Friday payout cron) is unblocked."

git push origin main
vercel --prod --yes
```

**Step 3 — verify live:**

After Vercel deploy goes Ready:

```
curl "https://boostboss.ai/api/stats?type=recon" | jq .publisher_balance_health
```

Expected initially: `{ "checked": 0, "drifted": 0, "drift_sample": [] }` (no developers have earnings yet — paying impressions just started flowing today).

After at least one paid impression fires in production:

```
curl "https://boostboss.ai/api/billing?action=payout_status&developer_id=<yours>" | jq .
```

`balance` and `lifetime_earned` should both be non-zero, equal to each other, with `next_payout_eta` showing one of: `setup_required` (no Stripe yet), `threshold_pending` (< $25), or an ISO timestamp (Friday 12:00 UTC).

## Stage 1 progress

| Phase | Status |
|---|---|
| A — Silent-failure observability | ✅ |
| B — Conversion beacons (4 doors) | ✅ |
| C — Benna data-reuse loop | ✅ |
| D — Seed initial BBX demand | (your track) |
| **E — Stripe payouts** | **🟡 Day 2 / 7 shipped** |
| F — Per-door onboarding wizard | pending |
| G — Real screenshots | last task before outreach |

Day 3 (payout cron) standby until you give the word.
