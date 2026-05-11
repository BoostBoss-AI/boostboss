# Phase E — Day 1 Report

Date: 2026-05-11
Status: ✅ Shipped locally (pending migration 12 in Supabase + push).
Tests: **216 passing** (was 204; +12 Phase E onboarding/state-machine tests).

## What landed

### Schema — migration 12 (`db/12_stripe_connect_payouts.sql`)

- `developers.payouts_enabled` (bool, default false)
- `developers.payout_blocked` (bool, default false)
- `developers.payout_blocked_reason` (text)
- `developers.payout_blocked_at` (timestamptz)
- `developers.instant_payouts_enabled` (bool, default false)
- `developers.stripe_requirements_due` (text[])
- New table `publisher_balance` (per-publisher balance + lifetime totals)
- New table `payouts` (one row per Stripe Connect transfer attempt)
- New table `payout_clawbacks` (refund-driven balance reclaims, per Decision 7)
- Bootstrapping insert for `publisher_balance` covers every existing developer
- Records itself in `bbx_schema_migrations`

### Backend — `api/billing.js` extensions

New `case` branches in the action router:

- `refresh_connect` — POST, mints a fresh Stripe Account Link for re-onboarding. Per HARD-3: never stored, always per-click backend round-trip.
- `payout_status` — GET, returns `{ stripe_account_id, payouts_enabled, payout_blocked, payout_blocked_reason, instant_payouts_enabled, balance, lifetime_earned, lifetime_paid, next_payout_eta }`. Single read for the entire dashboard Earnings section.

Webhook handler expanded:

- `account.updated` — full Tier-2 state machine. Reads `requirements.currently_due`, `payouts_enabled`, `capabilities.instant_payouts` and writes the right combination of flags to `developers`. Captures the full requirements list for dashboard rendering.
- `account.application.deauthorized` — wipes `stripe_account_id`, marks `payout_blocked = true` with reason `stripe_account_deauthorized`. Prevents transfer attempts to disconnected accounts.
- `payout.failed` — Tier-2 mark: blocks the developer, sets failure reason from Stripe, updates the corresponding `payouts` row to `status='failed'` with `failure_tier=2`.
- `charge.refunded` — extended with publisher clawback path via new `fireRefundClawbacks()` helper. Pro-rates the refund across publishers attributed to the refunded charge's campaigns, deducts from balance if possible, logs to `payout_clawbacks` as `applied` or `pending` per Decision 7.

### Publisher dashboard — `public/developer.html`

- New `payoutStatusBanner` element above the existing payout buttons
- Renders four distinct action states from `payout_status`:
  - **Not connected** → blue prompt to set up Stripe (Connect Stripe button)
  - **Onboarding incomplete** → amber "Finish Setup" with Resolve button
  - **Action required** (Tier-2 blocked) → amber with specific Stripe-provided reason + Resolve button
  - **Enabled** → banner hidden, button relabeled "Manage Stripe"
- Resolve button calls `refresh_connect` (HARD-3 compliant — no stored URLs)
- Threshold display updated from $100 to $25 (matches Decision 3)
- Next-payout label shows the next Friday at 12:00 UTC when eligible; specific friendly strings ("Set up Stripe", "Below $25 threshold", "Action Required") otherwise

### Tests — `tests/billing.test.js` (12 new)

- `create_connect returns demo onboarding stub`
- `refresh_connect rejects unknown developer` (demo path returns nil URL)
- `refresh_connect rejects missing developer_id` (400)
- `refresh_connect only accepts POST` (405 on GET)
- `payout_status returns shape for new developer in demo mode`
- `payout_status rejects missing developer_id` (400)
- `payout_status only accepts GET` (405 on POST)
- `account.updated with payouts_enabled=true clears block flags`
- `account.updated with requirements.currently_due sets blocked`
- `account.updated capabilities.instant_payouts='active' flips opt-in flag`
- `webhook handles event without developer_id metadata silently`
- `_fireRefundClawbacks export exists and tolerates null sb`

## Day 2 plan (preview, not yet started)

- Wire per-event balance accrual into `api/track.js` (Decision 9 V1)
- `publisher_balance` increment on every `developer_payout > 0` event
- Clawback satisfaction: when a publisher with `pending` clawbacks earns, debit the clawback first before accruing to spendable balance
- Tests for the accrual + clawback satisfaction path
- Begin Day 3: the weekly payout cron (Friday primary + Saturday retry sweep per HARD-2)

## Deploy steps for Day 1

### Step 1 — apply migration 12 in Supabase SQL Editor

Paste the entire content of `db/12_stripe_connect_payouts.sql` and run. Then run `db/check.sql` and confirm migration 12 shows applied with today's date.

### Step 2 — commit and push

```bash
cd ~/boostboss
git add api/billing.js \
        public/developer.html \
        tests/billing.test.js \
        db/12_stripe_connect_payouts.sql \
        db/check.sql \
        db/PHASE-E-DAY1-REPORT-2026-05-11.md \
        launch-kit/phase-e-payouts-design.md
git commit -m "Phase E Day 1: Stripe Connect onboarding + state machine + clawback skeleton

Schema (migration 12):
- developers: payouts_enabled, payout_blocked + reason/at, instant_payouts_enabled,
  stripe_requirements_due
- New tables: publisher_balance, payouts, payout_clawbacks

Backend (api/billing.js):
- refresh_connect action: HARD-3 compliant per-click Account Link minting
- payout_status action: single-call dashboard read
- Webhook: full account.updated state machine, account.application.deauthorized,
  payout.failed Tier-2 marking, charge.refunded publisher clawback fan-out

Dashboard (public/developer.html):
- Action-state banner (setup_required / pending / blocked / enabled)
- Threshold display $100 → $25 (matches Decision 3)
- Resolve button → refresh_connect → fresh Stripe Account Link

Tests: 12 new (216 total passing, was 204).

Design doc edits applied first: clawback policy, instant-payout fee split,
Friday+Saturday retry crons, per-click refresh URL.

Next: Day 2 wires per-event accrual into api/track.js."

git push origin main
vercel --prod --yes   # webhook still flaky per task #63 — CLI bypass
```

### Step 3 — verify live

After Vercel deploy is Ready:

- `https://boostboss.ai/api/billing?action=payout_status&developer_id=<a real publisher id>` — should return the new shape with `payouts_enabled`, `payout_blocked`, etc.
- Open `/developer` in browser, sign in, scroll to Earnings — banner should render appropriate to your Stripe Connect state.
- `https://boostboss.ai/api/stats?type=recon` — still works (no regression to Phase A/B).

Send me the `payout_status` JSON for any developer and Day 1 locks.

## Open Day 1 items

None. Day 1 scope is complete. Day 2 starts when you give the word.

## Day 1 → Stage 1 progress

| Phase | Status |
|---|---|
| A — Silent-failure observability | ✅ |
| B — Conversion beacons (4 doors) | ✅ |
| C — Benna data-reuse loop | ✅ |
| D — Seed initial BBX demand | (your track) |
| **E — Stripe payouts** | **🟡 Day 1 / 7 shipped** |
| F — Per-door onboarding wizard | pending |
| G — Real screenshots | last task before outreach |

Phase E plan: 7 days total. Day 1 = onboarding + state machine + clawback skeleton (done). Day 2 = balance accrual into track.js. Day 3 = payout cron. Day 4 = admin observability + payout-recon endpoint. Day 5 = end-to-end test in Stripe test mode. Day 6-7 = polish + runbook for live-key flip.
