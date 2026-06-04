# Phase E — Stripe Connect Autonomous Payouts Design

> **2026-06-04 update — Revenue model:** the split was 85/15 when this
> doc was written. It is now 70/30 (publisher receives 70%; Boost Boss
> retains 30%, composed of a 6.5% demand-side RTB exchange fee and a
> 23.5% network take). All math below should be re-read with that
> updated split; the architectural decisions still hold. See
> `api/billing.js` (env vars `BBX_RTB_FEE`, `BBX_NETWORK_TAKE`) for the
> source of truth.

## Goal

Autonomous weekly payouts to publishers via Stripe Connect, with minimal
human intervention. Advertisers pay Boost Boss, money is held in BB's
Stripe account, publisher balances accrue automatically based on
impressions/clicks/conversions attributed to them, and a weekly cron
transfers earned funds to publishers' bank accounts via Stripe Connect.

This is the financial spine of the autonomous-company vision. Design
discipline matters more here than anywhere else in the roadmap.

---

## Decision 1: Stripe Connect Account Type → Express

**Choice: Stripe Connect Express accounts.**

Reasons:
- Stripe handles all KYC/AML, identity verification, bank account
  validation, and dispute infrastructure
- Stripe-hosted onboarding works cross-platform with no UI to maintain
- We control payout timing (weekly cron) without giving publishers
  direct Stripe dashboard access
- Lightest operational burden, scales to thousands of publishers
- Free per-account (Standard charges per active connected account)

Why not Standard: Gives publishers a full Stripe dashboard but removes
our control over payout cadence. Creates support burden when publishers
ask Stripe questions we can't answer.

Why not Custom: Overkill. We'd build UI for KYC, identity verification,
tax forms — all of which Stripe Express handles for free.

## Decision 2: Payout Schedule → Hybrid Weekly + Threshold

**Choice: Scheduled weekly payouts every Friday at 12:00 UTC,
threshold-gated by minimum balance.**

Reasons:
- Predictable cadence (industry standard: AdSense, Substack, Patreon)
- Friday/UTC works globally — publishers see "paid this week" before
  weekend
- Scheduled cron is easy to monitor, easy to alert on failure
- Threshold prevents Stripe fees from eating tiny payouts

Why not pure threshold-based: Creates unpredictable payout timing,
spammable if a publisher hovers near threshold, harder to communicate.

Why not pure scheduled (no threshold): Stripe charges per Connect
transfer; paying out $0.47 to one publisher costs more in fees than
the payout itself.

## Decision 3: Minimum Payout Threshold → $25

**Choice: $25 USD minimum.**

Reasons:
- Low enough that small publishers see money within weeks of integrating
- High enough that Stripe Connect transfer fees (~$0.25 + 0.25%) don't
  dominate the payout
- Industry standard range ($25-$100); $25 is publisher-favorable
  positioning that fits our 85/15 split brand

Sub-decision: If a publisher's balance is below $25 at payout time,
roll their balance to next week. No action required from them. Their
dashboard shows "Next payout when balance reaches $25 — current $X.XX."

## Decision 4: Currency Handling → USD Only at Launch

**Choice: USD only for Phase E. Multi-currency deferred to Phase 2+.**

Reasons:
- Simplifies accounting, tax forms, Stripe Connect setup
- Target advertiser market (dev-tooling companies) bills in USD
- Multi-currency adds FX volatility and reconciliation complexity
- International publishers can still receive USD via Stripe Connect —
  they handle FX on their end

Document this on advertiser and publisher signup flows as a current
limitation, not a permanent one.

## Decision 5: Tax Form Collection → Delegated to Stripe Express

**Choice: Delegate W-9, W-8BEN, and 1099-K generation entirely to
Stripe Express.**

Reasons:
- Stripe Express collects W-9 (US) or W-8BEN (non-US) automatically
  during onboarding
- Stripe stores forms with proper retention
- Stripe generates 1099-Ks for US publishers earning >$600/year
- Stripe handles compliance edge cases (state-level reporting, etc.)
- We don't build a tax form module. Period.

This is the single biggest argument for Express over Standard or Custom.

## Decision 6: Failure Handling → Three-Tier Model

**Choice: Tiered failure handling based on cause.**

### Tier 1 — Soft (retry-able):
Network errors, Stripe API timeouts, transient infrastructure failures.

Policy (refined 2026-05-11 per engineer review — original +5min/+30min
inline-retry plan doesn't fit Vercel serverless 60s timeout):

- **Friday primary cron** (12:00 UTC): one attempt per publisher.
  On Tier-1 failure, insert `payouts` row with `status='pending'` +
  `retry_count=1`. Move on. Balance not yet decremented.
- **Saturday retry sweep cron** (12:00 UTC): re-attempts every row
  where `status='pending' AND retry_count < 3 AND failure_tier=1`.
  On success → debit balance, mark `status='succeeded'`. On
  another transient failure → increment `retry_count`, leave
  pending for the following week's sweep.
- After 3 failed retries (covering ~3 weeks of transient failures)
  → mark `status='failed'`, `failure_tier=1`, alert operator. At
  that point it's no longer transient.

This costs 2 crons/week on Vercel Hobby (within the 2 daily-or-rarer
limit per the saved memory note about Hobby cron constraints). All
retries are individual short-running invocations — no single cron
exceeds the 60s serverless timeout.

### Tier 2 — Hard (publisher action required):
Bank account rejected, Stripe Connect account suspended, KYC failed,
identity verification incomplete.

Policy:
- Set `publishers.payout_blocked = true`
- Email publisher with Stripe-provided reason and resolution steps
- Show "Action Required" banner in publisher dashboard with a
  button that hits our backend, which calls
  `stripe.accountLinks.create({ type: 'account_onboarding', ... })`
  and redirects to the freshly-minted Stripe Express onboarding URL.
  **Do not store a static refresh URL** — Stripe Account Links
  expire after ~5 minutes and are single-use. Every banner click
  must regenerate.
- Balance keeps accruing but no further payouts attempted until resolved
- Once publisher resolves (Stripe webhook `account.updated` with
  `payouts_enabled=true` and `requirements.currently_due=[]`),
  auto-clear the flag and include in next cron

### Tier 3 — Critical (operator action required):
- Multiple consecutive failures across >20% of publishers in a single
  cron run (suggests Stripe outage or integration bug)
- Stripe account-level issue (BB's main Stripe account suspended)
- Webhook signature verification failures

Policy:
- Pause cron immediately
- Email/Slack alert to operator
- All payouts held until manually resumed
- Publisher dashboards show "Payouts temporarily paused" banner

## Decision 7: Reserve / Holdback → No Reserve, Automatic Clawback on Refund

**Choice: No reserve held. Pay out 100% of accrued publisher earnings
(85% of advertiser spend). Refunds and chargebacks trigger automatic
clawback from publisher balance, with deferred-recovery fallback.**

Reasons:
- Boost Boss's main Stripe account already holds advertiser deposits
  before any are paid out, providing natural buffer
- Advertisers pay upfront via deposit, not on credit — chargeback risk
  is on the advertiser side, not requiring publisher holdback
- Reserves create complexity (when does it release? How is it tracked?)
  not justified at our scale

### Clawback mechanism (added 2026-05-11 per engineer review)

When Stripe fires an advertiser refund/chargeback webhook:

1. Look up the campaign-attributed events that produced the refunded
   spend. Compute each affected publisher's share (`refund × 0.85`).
2. For each publisher, attempt to deduct the clawback amount from
   their `publisher_balance.balance`.
3. **If balance covers the clawback:** decrement balance, insert a
   row in `payout_clawbacks` with `status='applied'`. Publisher
   dashboard shows the deduction with the refund reason. Done.
4. **If balance is insufficient (publisher already paid out):**
   insert into `payout_clawbacks` with `status='pending'`. Future
   earnings accrue first to satisfy any pending clawbacks before
   adding to spendable balance. Publisher dashboard shows an "Owed
   from refund" banner with the amount.
5. **If clawback remains pending for >90 days OR publisher's lifetime
   earnings drop into negative territory:** flag for operator review.
   The 15% BB margin absorbs unrecoverable losses; we do not pursue
   publishers for negative balances.

This means BB's effective margin is `15% × (1 − refund_rate)`. At 1%
refund rate, effective margin ≈ 14.85%. At 5% refund rate, effective
margin ≈ 14.25%. Phase E ships with the alerting hooks in place so
we know immediately if refund rates threaten the model.

Revisit when:
- Chargebacks from advertisers exceed 1% of deposits → consider 5%
  rolling reserve on new publisher accounts (>$5k lifetime earned)
- We move to credit-based advertiser billing → reserve becomes
  mandatory
- We add CPA/CPI campaigns with longer attribution windows → may
  need attribution-window-aware holdback

Document the clawback policy publicly: "Earnings are payable
immediately. If an advertiser's payment is reversed (refund,
chargeback, etc.), the attributed share will be reclaimed from
your balance, or from future earnings if your balance is insufficient.
We will never pursue you for negative balances."

## Decision 8: Stripe Connect Pricing → Confirmed Free for Express

**Confirmation from Stripe pricing documentation:**
- Connect Express accounts: $0 setup, $0 monthly
- Per-payout charge: $0.25 + 0.25% (Standard ACH)
- Instant Payouts (optional, opt-in by publisher): 1.5% + $0.50

**Policy (refined 2026-05-11 per engineer review):**

| Payout type | Fee | Who pays |
|---|---|---|
| Standard ACH (default) | $0.25 + 0.25% | **Boost Boss absorbs** |
| Instant Payout (publisher opt-in) | 1.5% + $0.50 | **Publisher pays** (deducted from balance before transfer) |

Reasons for the split:

**Why BB absorbs standard ACH:**
- Cleaner publisher experience for the default path (advertised
  earnings = received earnings)
- Maintains 85/15 split as a clean public number
- Fees are predictable; model breakage threshold is clear (see
  Decision 7 clawback note for refund-rate math)

**Why publisher pays Instant Payout fees:**
- Instant Payouts are a publisher-elected convenience, not a default
- 1.5% + $0.50 on a $25 payout = $0.88 fee, ~3.5% of payout — would
  consume 23% of BB's gross margin on that transaction
- Pass-through is standard industry practice (Stripe Express, Wise,
  PayPal all do this for instant-transfer features)
- Dashboard shows the fee at opt-in time; publisher chooses whether
  the speed is worth it

Implementation: when a publisher opts into Instant Payouts via the
Stripe Express account dashboard, capture the webhook update, set
`publishers.instant_payouts_enabled = true`. Cron uses
`stripe.transfers.create({ method: 'instant', ... })` for those
publishers and deducts the Stripe-quoted fee from the balance
before the transfer. Standard publishers see no fee row.

If margins tighten:
- Option A: Raise minimum threshold from $25 → $50 to reduce per-payout
  cost ratio
- Option B: Pass standard ACH fees through transparently (less
  publisher-friendly; revisit at $100k MRR)

## Decision 9: Revenue Split Mechanics → 85/15 Documented

**Choice: 85% to publisher, 15% to Boost Boss, taken at attribution
time.**

Mechanics:
1. Advertiser pays $X to Boost Boss → held in BB's Stripe account
2. Impression/click/conversion attributed to publisher P, amount $Y
3. Publisher P's `publisher_balance.balance` accrues `$Y × 0.85`
4. The 15% remains in BB's account (not accrued anywhere on
   publisher's side)
5. Weekly cron sums `publisher_balance.balance` per publisher, deducts
   amounts > $25 threshold, fires Stripe Connect transfer
6. On successful transfer, publisher balance is debited by transfer amount
7. Audit trail in `payouts` table

This means BB's revenue is exactly: total advertiser spend × 15%,
minus any Stripe fees absorbed.

### Accrual mechanics: per-event vs daily rollup (decided 2026-05-11)

**Choice for V1: per-event accrual to `publisher_balance`.**

When an event row lands in `events` with `developer_payout > 0`,
the corresponding amount immediately adds to `publisher_balance.balance`
and `publisher_balance.lifetime_earned` via a database trigger or
inline write in `api/track.js`.

Why per-event:
- Mirrors the existing `events.developer_payout` pattern; no
  architectural change required
- Publisher dashboard balance is real-time (≤ a few seconds latency)
- Simpler reconciliation in V1 — every event row maps to a known
  balance delta
- Clawback (Decision 7) operates on the same row-level granularity

Known trade-off — refunds and deduplication require explicit reversal
logic instead of "just re-run the rollup". The clawback mechanism in
Decision 7 handles refunds. Deduplication is already handled at
write-time by `track.js` via the `(auction_id, event_type)` unique
index, so deduplicated impressions never accrue in the first place.

**V2 migration path (when reconciliation pain emerges):** convert
`publisher_balance.balance` to a derived value computed from
`events` via a periodic rollup job. The dashboard reads the rollup
table; live balance shows last-rollup-timestamp. Trigger this
migration if any of: (a) more than 2 manual reconciliations per
month, (b) clawback failure rate >1%, (c) we add credit-based
advertiser billing.

This decision is documented here so future contributors understand
why per-event was chosen knowingly, not by default.

## Decision 10: Live Key Rollout Sequence → Two-Step

**Step 1 (now, during Phase E build):**
- Build full system against Stripe test mode
- Test publisher creates Express account in test mode
- Test advertiser deposits via test card
- Verify cron fires, transfers complete in test mode
- Verify all three failure tiers handle correctly in test mode
- Publisher dashboard shows balance, payout history, status

**Step 2 (Stage 1 outreach, when first real advertiser deposits):**
- Flip Stripe keys from test to live
- 5-minute config change once everything else is verified
- First real payout fires on the next scheduled Friday

Discipline: Do not flip to live keys "just to test" before real
revenue is flowing. Live keys with no transactions add attack surface
without value.

---

## Database Schema Additions

### `payouts` table

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| publisher_id | uuid FK | |
| amount_usd | numeric(10,2) | The transfer amount |
| stripe_transfer_id | text | Stripe's identifier |
| status | enum | `pending`, `succeeded`, `failed`, `held` |
| failure_reason | text | Populated on failure (Tier 1/2/3) |
| failure_tier | int | 1, 2, or 3 |
| created_at | timestamptz | When cron initiated |
| completed_at | timestamptz | When Stripe confirmed |
| retry_count | int | For Tier 1 retries |

Indices:
- `(publisher_id, created_at DESC)` for publisher dashboard
- `(status, created_at)` for cron sweep
- `(failure_tier, created_at)` for alerting queries

### `publisher_balance` table (or column on `publishers`)

| Column | Type | Notes |
|---|---|---|
| publisher_id | uuid PK FK | |
| balance | numeric(10,2) | Current accrued, not yet paid |
| lifetime_earned | numeric(10,2) | Cumulative ever earned |
| lifetime_paid | numeric(10,2) | Cumulative ever paid out |
| updated_at | timestamptz | |

Decision: Separate table for cleaner audit, or column on `publishers`?
Recommend separate table — atomic updates simpler, audit trail cleaner.

### `publishers` additions

- `stripe_connect_account_id` text — populated post-onboarding
- `payout_blocked` boolean default false — Tier 2 flag
- `payout_blocked_reason` text — Stripe-provided reason
- `payout_blocked_at` timestamptz — when blocked

---

## Cron Job Specification

**Schedule:** Every Friday at 12:00 UTC (single execution per week).

**Process:**

1. Query all publishers where:
   - `payout_blocked = false`
   - `stripe_connect_account_id` is not null
   - `publisher_balance.balance >= 25.00`
2. For each, attempt Stripe Connect transfer of full balance amount
3. On success:
   - Decrement balance by transferred amount
   - Insert row in `payouts` with `status = succeeded`
   - Increment `lifetime_paid`
4. On Tier 1 failure (network, timeout):
   - Insert row in `payouts` with `status = pending`, increment `retry_count`
   - Schedule retry job for +5min, +30min
   - After 3 retries, mark `status = failed`, `failure_tier = 1`
5. On Tier 2 failure (Stripe-rejected reason):
   - Insert row with `status = failed`, `failure_tier = 2`
   - Set `publishers.payout_blocked = true` with reason
   - Email publisher with action steps
6. After completing all transfers, check Tier 3 conditions:
   - Did >20% of payouts fail in this run? → operator alert
   - Were there Stripe account-level errors? → operator alert + pause future runs

**Observability:**
- Every cron run logs to `events` with `event_type = 'payout_cron_completed'`
- Includes summary: `{ publishers_attempted, succeeded, tier1_failed, tier2_failed, total_usd }`
- Recon endpoint extension: `/api/stats?type=payout-recon` showing
  weekly summary

---

## Dashboard Surfaces

### Publisher dashboard — "Earnings" section
- Current balance: `$X.XX`
- Next payout: "Friday DD/MM" or "When balance reaches $25" or
  "Action Required: bank account issue"
- Payout history table: last 10 payouts with status, amount, date
- Lifetime earned / lifetime paid summary
- "Manage Stripe Connect" button (opens Stripe-hosted account dashboard)

### Operator admin — "Payouts" section
- Last cron run summary
- Tier 1/2/3 failure breakdown
- Manual override: pause cron, force retry single payout, mark
  publisher unblocked
- Stripe webhook health (last received, signature verification status)

---

## Open Questions / Implementation Decisions

These don't need to be settled in the design doc; surface them during
implementation if they arise:

1. **Refund handling:** If an advertiser disputes a charge and Stripe
   refunds them, does the corresponding publisher payout need to be
   clawed back? Initial answer: no, due to no-reserve policy. The 15%
   BB margin absorbs the loss. Document this in advertiser terms.

2. **Currency conversion display:** International publishers see USD
   amounts but their bank credits them in local currency at Stripe's
   FX rate. Should dashboard show estimated local-currency amount?
   Initial answer: no, keep it simple — USD only. Stripe shows local
   currency in their payout confirmation email.

3. **Year-end reporting:** Stripe generates 1099-Ks. Do publishers
   need any BB-side reporting beyond what Stripe provides? Initial
   answer: no, but provide a "Download annual statement" PDF in
   dashboard for convenience.

4. **Multi-currency deposit handling:** If a future advertiser
   deposits in non-USD, do we hold separate balances or auto-convert?
   Initial answer: USD-only at launch eliminates this. Revisit Phase 2.

---

## What This Design Enables

When Phase E is complete:

- ✅ Publisher can complete entire onboarding flow without operator help
- ✅ Advertiser deposits real money, sees real ad serving, real
  attribution
- ✅ Publisher sees real-time balance accrual
- ✅ Weekly cron pays out automatically with three-tier failure handling
- ✅ Tax forms collected and managed by Stripe — no BB-side compliance work
- ✅ Audit trail for every dollar in three places (`payouts`, `events`,
  Stripe Dashboard)
- ✅ Operator can monitor system health via admin dashboard and recon
  endpoint
- ✅ Operator intervention required only for Tier 3 events (system-wide
  issues), not individual publisher operations

This is the financial autonomy foundation. Phase F (per-door onboarding
wizard) optimizes the UX. Phase G (real screenshots) prepares for
outreach. After E, Stage 1 is functionally complete.

---

## Timeline Estimate

**Build:** 5-7 days focused work.

Breakdown:
- Day 1: Stripe Connect Express integration + onboarding flow
- Day 2: Publisher dashboard earnings section + Stripe Connect refresh
- Day 3: Payout cron + Tier 1/2/3 failure handling
- Day 4: Operator admin payouts surface + recon endpoint extension
- Day 5: End-to-end testing in Stripe test mode
- Day 6-7: Edge cases, polish, documentation, runbook for live-key flip

Do not parallelize this with other tracks. Phase E gets full focus
until shipped.
