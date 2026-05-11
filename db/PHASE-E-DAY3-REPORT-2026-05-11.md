# Phase E — Day 3 Report

Date: 2026-05-11
Status: ✅ Shipped locally (no migration this day; needs CRON_SECRET env var on Vercel).
Tests: **230 passing** (was 221; +9 Day 3 cron tests).

## What landed

Day 3 wires the autonomous weekly payout cron. With Stripe keys configured, the system now pays publishers without operator action every Friday at 12:00 UTC, with Saturday retry sweep for transient failures.

### `api/billing.js` — two new actions

| Action | Method | Cron schedule | Purpose |
|---|---|---|---|
| `run_payout_cron` | POST | Friday 12:00 UTC | Primary weekly payouts |
| `run_payout_retry_sweep` | POST | Saturday 12:00 UTC | Retries pending Tier-1 from previous Friday |

Both gate on `Authorization: Bearer ${CRON_SECRET}` when Supabase is configured (Vercel cron sends this header automatically). Demo mode skips auth so unit tests run hermetically.

### Friday cron flow (`handleRunPayoutCron`)

1. Auth check: `Authorization: Bearer ${CRON_SECRET}` (production) or open (demo).
2. Query eligible publishers: `developers.payouts_enabled=true AND payout_blocked=false AND stripe_account_id IS NOT NULL`.
3. Join with `publisher_balance.balance >= $25` (Decision 3).
4. For each eligible publisher:
   - Compute method (standard ACH absorbed by BB / instant payout fee deducted from publisher per Decision 8).
   - Insert `payouts` row at `status='pending'` BEFORE firing the transfer (audit trail survives a crashed Stripe call).
   - Call `stripe.transfers.create()` to the publisher's Connect account.
   - **Success path:** debit balance via `bbx_decrement_publisher_balance`, update `payouts` row to `status='paid'` with `stripe_transfer_id`, bump `lifetime_paid`.
   - **Tier-1 failure** (network/timeout/transient): row stays at `status='pending'`, `retry_count=1`, `failure_reason` populated. Saturday will retry.
   - **Tier-2 failure** (Stripe-rejected: account_invalid, destination_account_disabled, bank_account_unverified, etc.): mark publisher `payout_blocked=true` with reason; mark row `status='failed' failure_tier=2`.
5. **Tier-3 alert** if >20% of attempted publishers failed (Stripe outage / integration bug suspected). Logs under `bbx:payout_cron:tier3_alert`.
6. Return summary JSON: `{ run_id, publishers_attempted, succeeded, tier1_failed, tier2_failed, skipped, total_usd, failures[], duration_ms, mode }`.

### Saturday retry sweep (`handleRunPayoutRetrySweep`)

1. Query `payouts WHERE status='pending' AND failure_tier IS NULL AND retry_count < 3 AND created_at > now() - 7 days`.
2. For each: re-fetch publisher's `stripe_account_id` (could have changed since Friday). Skip if publisher is now blocked.
3. Re-attempt transfer.
4. **Success:** debit balance now (Friday left balance intact), mark `paid`.
5. **Tier-1 again:** bump `retry_count`. If at MAX_RETRIES (3), mark `status='failed' failure_tier=1` and alert.
6. **Tier-2:** same as Friday — block publisher, mark row failed Tier-2.

### `vercel.json` — two new cron entries

```json
{ "path": "/api/billing?action=run_payout_cron",          "schedule": "0 12 * * 5" },
{ "path": "/api/billing?action=run_payout_retry_sweep",   "schedule": "0 12 * * 6" }
```

Both daily-or-rarer (Hobby plan compatible per saved memory note about Vercel Hobby cron limits).

### Tests — `tests/billing.test.js` (+9 new)

- `run_payout_cron requires POST` (405 on GET)
- `run_payout_cron in demo mode returns summary with zero attempts`
- `run_payout_cron skips developer with payouts_enabled=false`
- `run_payout_cron skips blocked publisher`
- `run_payout_cron skips publisher below $25 threshold`
- `run_payout_cron pays eligible publisher and debits balance`
- `run_payout_cron with instant_payouts_enabled deducts fee from amount`
- `run_payout_retry_sweep returns demo summary without retries`
- `run_payout_retry_sweep requires POST`

Demo-mode tests exercise the full eligibility + state-machine logic with no Stripe / no Supabase, so they run hermetically in CI.

Full suite: **230 tests passing**.

## What's still open

**Day 4 next:** operator admin payout dashboard. Today the only inspection point is the recon endpoint summary. Day 4 adds a UI to list individual payout attempts, drill into failure reasons, manually retry / cancel / mark resolved.

**Day 5:** end-to-end test in Stripe test mode. This is where we use the actual Stripe test environment to fire a real Express onboarding, real test deposit, real test transfer, real cron run — and watch the loop close.

**Day 6-7:** runbook + polish + live-key flip checklist.

**Production gates** that need attention BEFORE the cron starts firing:

1. **CRON_SECRET env var** must be set on Vercel for production crons to authorize. Without it, the cron will return 401. Generate one and add via `vercel env add CRON_SECRET production`, OR via Vercel dashboard → Settings → Environment Variables. A `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` value works.
2. **STRIPE_SECRET_KEY** must be set. Without it, the cron runs in demo mode and writes no real transfers (which is fine for now — the validation flow uses test keys anyway).
3. **No real publisher has `payouts_enabled=true` yet** (you confirmed this on the `payout_status` check — your developer record returned `payouts_enabled: false, next_payout_eta: setup_required`). So even with cron live, nothing pays out until at least one publisher completes Express onboarding. That's by design.

## Deploy steps

**Step 1 — generate and set CRON_SECRET on Vercel:**

```bash
# Generate a fresh secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the hex output, then add to Vercel:
vercel env add CRON_SECRET production
# Paste the value when prompted
```

Alternatively in the Vercel dashboard: Project → Settings → Environment Variables → Add → key `CRON_SECRET`, value `<the hex>`, environment `Production`. Save.

**Step 2 — commit and deploy:**

```bash
cd ~/boostboss
git add api/billing.js vercel.json tests/billing.test.js \
        db/PHASE-E-DAY3-REPORT-2026-05-11.md
git commit -m "Phase E Day 3: autonomous weekly payout cron

- api/billing.js: two new actions
  - run_payout_cron (Friday 12:00 UTC, primary)
  - run_payout_retry_sweep (Saturday 12:00 UTC, retries)
  Auth: Authorization: Bearer \${CRON_SECRET}
- Full state machine: eligibility -> Stripe transfer -> Tier-1/2/3
  classification on failure
- Decision 8 fees: standard ACH absorbed by BB, instant payouts
  deducted from publisher balance before transfer
- Vercel cron entries added (both daily-or-rarer for Hobby compatibility)
- Tests: +9 (51 billing / 230 total)

Production gates:
- CRON_SECRET env var must be set on Vercel
- STRIPE_SECRET_KEY must be set for real transfers (demo mode otherwise)
- No real publisher has payouts_enabled=true yet (by design)"

git push origin main
vercel --prod --yes
```

**Step 3 — verify the cron deploys.** After Vercel finishes, open Vercel dashboard → Project → Settings → Cron Jobs. Two new entries should appear:

- `/api/billing?action=run_payout_cron` — `0 12 * * 5` — Friday 12:00 UTC
- `/api/billing?action=run_payout_retry_sweep` — `0 12 * * 6` — Saturday 12:00 UTC

If they're missing, the deploy used a cached vercel.json. Force a clean redeploy: `vercel --prod --yes --force`.

**Step 4 — manual smoke test** (does not require waiting for Friday):

```bash
# Get your CRON_SECRET value from Vercel envs first.
curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://boostboss.ai/api/billing?action=run_payout_cron" | jq .
```

Expected response in current state (no publisher with payouts_enabled=true):

```json
{
  "run_id": "cron_...",
  "publishers_attempted": 0,
  "succeeded": 0,
  "tier1_failed": 0,
  "tier2_failed": 0,
  "skipped": 0,
  "total_usd": 0,
  "failures": [],
  "mode": "stripe"
}
```

If you get `{"error":"Unauthorized"}`, CRON_SECRET isn't set on Vercel yet. If you get a 200 with `mode: "stripe"`, the cron is wired correctly.

## Stage 1 progress

| Phase | Status |
|---|---|
| A — Silent-failure observability | ✅ |
| B — Conversion beacons (4 doors) | ✅ |
| C — Benna data-reuse loop | ✅ |
| D — Seed initial BBX demand | (your track) |
| **E — Stripe payouts** | **🟡 Day 3 / 7 shipped** |
| F — Per-door onboarding wizard | pending |
| G — Real screenshots | last task before outreach |

Day 4 (operator admin payouts surface + payout-recon endpoint extension) standby until you give the word.
