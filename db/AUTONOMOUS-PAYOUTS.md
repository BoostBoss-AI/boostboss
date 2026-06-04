# Autonomous payout architecture

Design doc for Boost Boss's publisher payout pipeline. **Not yet
implemented.** Captured here so when Stage 6 (live Stripe) fires the
design is settled, not invented under pressure.

Goal: zero-touch operations. Andy checks the dashboard once a week and
sees `47 publishers paid, $12,400 distributed` — that's the entire
manual surface area.

---

## 1. Connect onboarding

**Use Stripe Connect Express, not Standard.**

| | Express | Standard |
|---|---|---|
| Onboarding UX | Stripe-hosted, 3-5 min | Self-serve via stripe.com |
| Tax form collection | Built in (W-9 / W-8BEN) | Built in |
| Dashboard for publisher | Limited (we own it) | Full Stripe dashboard |
| Identity verification | Stripe handles | Stripe handles |
| Branding control | Yes (Connect logo + ours) | No |
| Fees | Same | Same |
| Marketplace use case | ✓ recommended | More for SaaS-add-Stripe |

Express is the right call: we want the publisher dashboard on
boostboss.ai to be the publisher's full surface. They shouldn't need to
log into Stripe to see balances or transaction history.

### Onboarding flow

1. Publisher signs up → `bb_pub_*` session created
2. They reach the dashboard with a "Connect payout account" CTA
3. Click → `POST /api/billing?action=create_connect` creates the Stripe
   Connect account + returns an `onboarding_url`
4. Browser redirects to the Stripe-hosted Express onboarding page
5. Publisher fills in identity + tax info (Stripe collects W-9/W-8BEN)
6. Stripe redirects back to `/publish/dashboard?connect=success`
7. Webhook event `account.updated` (`charges_enabled: true`,
   `payouts_enabled: true`, `details_submitted: true`) marks the
   publisher as payout-ready in our DB
8. Dashboard now shows "Payouts active — next payout YYYY-MM-DD"

### DB schema additions needed

```sql
-- developers table additions
ALTER TABLE public.developers ADD COLUMN IF NOT EXISTS
  stripe_account_id text,                    -- already exists
  stripe_onboarding_status text default 'not_started'
    CHECK (stripe_onboarding_status IN
      ('not_started','onboarding','restricted','active','rejected')),
  stripe_payouts_enabled boolean default false,
  stripe_charges_enabled boolean default false,
  tax_form_collected boolean default false,
  payout_failures_count int default 0,
  last_payout_at timestamptz,
  pending_balance numeric(12,2) default 0;
```

`pending_balance` is what we owe the publisher right now — incremented
on every won impression's developer_payout, decremented on successful
payout, decremented on refund.

---

## 2. Weekly payout cron

**Vercel cron → Supabase RPC → Stripe transfer batch.**

### Schedule

```json
// vercel.json
{
  "crons": [
    { "path": "/api/billing?action=run_weekly_payouts", "schedule": "0 14 * * 1" }
  ]
}
```

Mondays 14:00 UTC = 09:00 NYC = 14:00 London. Avoids weekend banking
holidays. Pulls from accumulated balance Sunday EOD.

### `/api/billing?action=run_weekly_payouts` flow

```
1. Auth check: only allow when called from Vercel cron
   (X-Vercel-Cron header) OR from admin with bb_admin_token

2. Idempotency: SELECT FROM payout_runs WHERE
   week_of = date_trunc('week', now())::date.
   If row exists with status=completed → return 200 with cached result.
   Otherwise INSERT row with status=running.

3. Call SQL RPC bbx_collect_pending_payouts() which:
   - SELECTs all developers WHERE
       stripe_account_id IS NOT NULL
       AND stripe_payouts_enabled = true
       AND pending_balance >= min_payout_threshold (default $100)
   - Returns rows: { developer_id, stripe_account_id, amount }

4. For each row, call stripe.transfers.create({
       amount: row.amount * 100,    // cents
       currency: "usd",
       destination: row.stripe_account_id,
       transfer_group: "payout_run_" + week_of,
       metadata: { developer_id, week_of }
   })
   with idempotency_key = "payout_" + developer_id + "_" + week_of.

5. On success → call bbx_record_payout_success(developer_id, transfer_id, amount)
   which atomically:
   - INSERTs row into payouts table
   - DECREMENTs developer.pending_balance by amount
   - SETs developer.last_payout_at = now()
   - RESETs developer.payout_failures_count = 0

6. On failure → bbx_record_payout_failure(developer_id, error_code, error_message)
   - INSERT into payout_failures table for visibility
   - INCREMENT developer.payout_failures_count
   - Notify publisher via email if count >= 3 OR error is unrecoverable
   - Do NOT decrement pending_balance — they still owed

7. Update payout_runs row: status=completed, total_paid, total_failed.
```

### Why SQL-side aggregation

Doing the "who's owed what" calculation in a single RPC means:
- Atomic snapshot of balances (no race with simultaneous impressions)
- One DB round-trip instead of N
- Easy to rerun for a specific week if cron fails

### Idempotency

Stripe's `idempotency_key` parameter (set per-transfer) ensures that if
we accidentally rerun the cron, no double payouts. The key includes
`week_of` so each week's run is independent.

The `payout_runs` table check on top adds a second layer: even if we
hit Stripe with the same idempotency key, we don't waste API calls.

---

## 3. Failed payout handling

Three failure modes, three behaviors:

### a) Recoverable (retry next week)

- `account_closed` (publisher closed bank account)
- `insufficient_funds` (in our platform balance — shouldn't happen, but)
- Network / Stripe transient errors

**Action**: log to `payout_failures`, increment `payout_failures_count`,
balance stays in `pending_balance`. Cron retries automatically next
Monday.

### b) Unrecoverable for that publisher (need their action)

- `account_invalid` (Stripe deactivated their account)
- `payouts_not_allowed` (they need to complete onboarding)
- `requirements_past_due` (Stripe is asking for additional verification)

**Action**: log to `payout_failures`, set
`developer.stripe_payouts_enabled = false`, send email:

```
Subject: Action needed: payout couldn't be sent

Your Boost Boss publisher payout for the week of {week_of} couldn't
be sent because: {human_readable_reason}.

Resolve it here: {stripe_dashboard_url for their account}
After you fix it, we'll retry on the next weekly run automatically.

Current balance: ${pending_balance}
```

The dashboard at `/publish/dashboard` shows a banner with the same info
and a "Resolve in Stripe" button.

### c) Account-level catastrophic (account_rejected)

- Publisher account terminated by Stripe (fraud / KYC failure)

**Action**: set `stripe_onboarding_status = 'rejected'`,
`stripe_payouts_enabled = false`, send a different email referring
the publisher to support, escalate to Andy via admin notification.
Pending balance is held until manual review.

### Email plumbing

Use Resend or Postmark — pick whichever you already have credentials
for. Single transactional sender for `payouts@boostboss.ai`. Templates
stored in `db/email_templates` table or hardcoded for v0.

---

## 4. Publisher-facing observability

The dashboard at `/publish/dashboard` already has a Lumi SDK
integrations panel and a 4-card stats row. Add a "Payouts" card that
shows:

```
NEXT PAYOUT
$847.52
Mondays · weekly
[ Pending: $94.21 ] (when below threshold)
```

Plus a separate "Payout history" section (similar to advertiser's
Billing History) showing the last 10 payout rows from the `payouts`
table with status pills (paid / pending / failed).

When a payout fails non-trivially, surface it as a top-of-dashboard
banner: "⚠️ Payout couldn't be sent — resolve in Stripe →"

---

## 5. Tax forms

Stripe Express collects W-9 (US) and W-8BEN (non-US) automatically
during onboarding. We don't store tax IDs ourselves — they live in
Stripe.

End-of-year 1099 generation: Stripe Connect handles 1099-K filing for
US publishers automatically when they cross IRS thresholds ($600 in
2024; subject to change). Non-US publishers get their own country's
equivalent forms or none, depending on jurisdiction.

The only manual step: at year-end, export `payouts` table CSV for our
own records and reconcile against Stripe's reports.

---

## 6. What gets logged

Every payout-relevant event hits `auction_logs` (already built) AND a
new `payout_events` table:

```sql
CREATE TABLE public.payout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid REFERENCES developers(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'connect_started', 'connect_completed', 'payout_attempted',
    'payout_succeeded', 'payout_failed', 'balance_credited',
    'requirements_updated', 'account_rejected'
  )),
  amount numeric(12,2),
  stripe_object_id text,
  stripe_event_id text UNIQUE,
  metadata jsonb,
  ts timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payout_events_developer ON payout_events(developer_id, ts DESC);
CREATE INDEX idx_payout_events_type ON payout_events(event_type, ts DESC);
```

This gives Andy one query to answer "what happened with publisher X
this month" without joining across multiple tables. The `stripe_event_id`
unique constraint also gives webhook idempotency for free.

---

## 7. Migration plan (when we flip to live)

1. Run `db/10_payout_schema.sql` (the schema additions above) in Supabase
2. Set Stripe live keys in Vercel env: `STRIPE_SECRET_KEY=sk_live_...`,
   `STRIPE_WEBHOOK_SECRET=whsec_...`
3. Configure live webhook endpoint at
   `https://boostboss.ai/api/stripe-webhook` for events:
   `account.updated`, `account.application.deauthorized`,
   `transfer.failed`, `transfer.paid`, `payout.failed`, `payout.paid`
4. Existing publishers (none yet at this writing) re-trigger onboarding
   via dashboard banner
5. First Monday after launch → cron fires → first weekly payout run.
   Andy reviews the result manually for the first 3-4 weeks before
   trusting the cron unattended.
6. After 4 weeks of clean runs → autonomous. Andy checks dashboard
   weekly, intervenes only on failure banners.

---

## 8. What we are NOT building

- Custom payout UI for publishers (Stripe Express dashboard suffices)
- Per-currency support beyond USD (v1 is USD only)
- Multi-recipient splits (one developer = one Stripe account)
- Real-time payouts (weekly is the cadence; daily/instant is YAGNI)
- Manual payout overrides (everything goes through the cron — admin
  override is a single SQL update if ever needed, not a UI feature)

---

## 9. Open decisions for when we build

- **Min payout threshold**: $100 default. Survey publishers — some prefer
  $50, some prefer $250 to reduce noise. Make it configurable per
  publisher in v1.1, single value in v1.0.
- **Take-rate accounting**: 30% combined (BBX_RTB_FEE 6.5% +
  BBX_NETWORK_TAKE 23.5% env vars; legacy BBX_TAKE_RATE still honoured
  if explicitly set). Audit: every event row's `developer_payout` =
  `cost * (1 - 0.30)`. Wired in `track.js` and `billing.js`.
- **Refund / clawback flow**: if an advertiser disputes a charge after
  we've already paid the publisher, do we claw back from the next
  payout cycle, or absorb the loss? Default v0: absorb (publisher
  contract says final). Revisit after first chargeback.
