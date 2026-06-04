# Phase E — Day 5 — End-to-End Runbook (Stripe Test Mode)

Date: 2026-05-11
Status: live runbook — execute step-by-step, mark each ✓ when verified.

This document walks the entire autonomous loop in **Stripe test mode**.
No real money moves. The goal: prove the same code paths used in
production work end-to-end before flipping to live keys (Day 7).

---

## Pre-flight checklist

Run through these before starting Step 1.

- [ ] `STRIPE_SECRET_KEY` on Vercel is `sk_test_*` (verified Day 5 start).
- [ ] `STRIPE_WEBHOOK_SECRET` on Vercel matches the test-mode webhook endpoint at https://dashboard.stripe.com/test/webhooks (NOT live mode).
- [ ] Stripe Connect is enabled in test mode at https://dashboard.stripe.com/test/connect/accounts/overview with Express accounts permitted.
- [ ] `CRON_SECRET` and `ADMIN_TOKEN` are both set on Vercel.
- [ ] All migrations 00-13 are applied — verify with the `db/check.sql` query (should show 15 rows, all "applied").
- [ ] Latest code is deployed (no uncommitted Phase E changes).

Two diagnostic commands you'll re-use throughout:

```bash
# Pull production env vars into your shell:
cd ~/boostboss
vercel env pull .env.production.local --environment production
export ADMIN_TOKEN=$(grep '^ADMIN_TOKEN=' .env.production.local | cut -d'=' -f2 | tr -d '"')
export CRON_SECRET=$(grep '^CRON_SECRET=' .env.production.local | cut -d'=' -f2 | tr -d '"')

# E2E inventory snapshot (use after each step to see what landed):
inventory() {
  curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
    "https://boostboss.ai/api/billing?action=e2e_inventory" | jq .
}
```

After Day 5 is done, `rm .env.production.local` to clean up.

---

## Step 1 — Sign up a test advertiser

**Goal:** verify the advertiser onboarding flow works.

1. Open a fresh incognito window → https://boostboss.ai/ads/signup
2. Sign up with a fresh email (use `+e2e@yourdomain.com` if you want easy filtering: `andy+e2e1@yourdomain.com`)
3. Complete the signup form. Should land in the advertiser dashboard at https://boostboss.ai/advertiser

**Verify:**

```bash
inventory | jq .advertisers
```

Expected: `{ "count": <previous + 1>, "latest_signup_at": "<just now>" }`

- [ ] Test advertiser exists.

---

## Step 2 — Deposit $50 via Stripe test card

**Goal:** verify the Stripe Checkout deposit flow + webhook credits the advertiser balance.

1. In the advertiser dashboard, click "Add funds" or whatever your deposit CTA is.
2. Choose $50 (or any amount ≥ $25 so it satisfies the minimum payout threshold once attribution flows through).
3. Stripe Checkout opens. Use the test card:
   - **Number:** `4242 4242 4242 4242`
   - **Expiry:** any future date (e.g. `12/30`)
   - **CVC:** any 3 digits (e.g. `123`)
   - **ZIP:** any 5 digits (e.g. `42424`)
4. Complete the checkout. You'll redirect back to the advertiser dashboard with a success indicator.

**Verify:**

```bash
inventory | jq .advertiser_deposits
```

Expected: `{ "count": <previous + 1>, "total_usd": <prev + 50>, "latest_at": "<just now>" }`

If the deposit count didn't increment, the Stripe webhook isn't reaching production. Check:
- Stripe dashboard → Developers → Webhooks → your test endpoint → "Send test webhook" with `checkout.session.completed`
- Vercel function logs for `bbx:billing:webhook` lines

- [ ] Advertiser balance shows ~$50.
- [ ] `transactions` table has a row for the deposit.

---

## Step 3 — Create + launch a campaign

**Goal:** verify the campaign creation flow + auto-approval.

1. In the advertiser dashboard, click "Create campaign".
2. Fill the form with anything plausible:
   - **Name:** "E2E Test — Deploy NextJS"
   - **Headline:** "Ship your Next.js app in seconds"
   - **Subtext:** "Vercel-style deploys for any framework"
   - **CTA:** "Try free"
   - **CTA URL:** any HTTPS URL (e.g. `https://boostboss.ai`)
   - **Format:** banner
   - **Targeting intents:** `deploy_nextjs`, `deploy`, `nextjs`, `framework`
   - **Billing:** CPM, $5
   - **Daily budget:** $25
   - **Total budget:** $50
3. Click Launch. The first campaign per advertiser auto-approves; status flips to `active`.

**Verify:**

```bash
inventory | jq .campaigns_active
```

Expected: `{ "count": <previous + 1>, "latest_launched_at": "<just now>" }`

- [ ] Campaign shows `status='active'` in the dashboard.

---

## Step 4 — Sign up a test publisher

**Goal:** verify the publisher onboarding flow works.

1. Open a different incognito window → https://boostboss.ai/publish/signup
2. Sign up with a fresh email (e.g. `andy+e2epub@yourdomain.com`)
3. Land in the publisher dashboard at https://boostboss.ai/developer.

**Verify:**

```bash
inventory | jq .developers
```

Expected: `{ "count": <previous + 1>, "with_stripe_account": 0, "payouts_enabled": 0 }`

- [ ] Test publisher exists, no Stripe yet.

---

## Step 5 — Complete Stripe Connect Express onboarding (test mode)

**Goal:** verify the Express onboarding flow + webhook flips `payouts_enabled=true`.

1. In the publisher dashboard, click "Connect Stripe" (or whatever the CTA reads).
2. Stripe-hosted Express onboarding opens. **You're in test mode**, so use:
   - **Country:** any
   - **Email:** the publisher's email
   - **Business type:** individual
   - **Bank account:** Stripe provides a test routing+account combo. Use:
     - Routing: `110000000`
     - Account: `000123456789`
   - **DOB / SSN / address:** fake but plausible (Stripe accepts any test values; never validates against real records)
3. Complete the flow. You'll redirect back to `/developer?stripe=connected`.

**Verify** (might take 5-10 seconds for webhook):

```bash
inventory | jq .developers
```

Expected: `{ "count": ..., "with_stripe_account": 1+, "payouts_enabled": 1+ }`

Also check the publisher's payout status:

```bash
# Get the test publisher's developer_id from the dashboard URL or:
psql "$SUPABASE_URL" -c "SELECT id, email FROM developers ORDER BY created_at DESC LIMIT 1;"

curl -sS "https://boostboss.ai/api/billing?action=payout_status&developer_id=<UUID>" | jq .
```

Expected: `payouts_enabled: true`, `payout_blocked: false`, `next_payout_eta: "threshold_pending"` (because balance is still $0).

- [ ] `payouts_enabled` flipped to true.
- [ ] Banner on publisher dashboard now reads "Manage Stripe" (no action required).

---

## Step 6 — Mount Lumi on a publisher surface and serve an ad

**Goal:** verify the ad serving path + impression beacon + balance accrual.

The fastest sandbox surface to use: open https://boostboss.ai/test/lumi-snippet-test in a third browser window. That page has Lumi already mounted with a test publisher_id.

If you want to use your TEST publisher's actual id (so the impression accrues to them, not the demo seed publisher), you need to override the `data-publisher-id` script tag:

1. Open `https://boostboss.ai/test/lumi-snippet-test` in DevTools.
2. In the console, before refresh, paste:
```js
const s = document.querySelector('script[data-publisher-id]');
s.setAttribute('data-publisher-id', '<YOUR_TEST_PUB_UUID>');
location.reload();
```
3. Or simpler: just use the `pub_test_demo` already wired and accept that this impression accrues to the seed publisher (not your fresh test publisher).

For Day 5 simplicity, **use the seed test publisher** — it's pre-set up and we're proving the loop end-to-end, not the new-publisher attribution path.

When the page loads, Lumi auto-discovers the slot and fetches an ad. Within 1-2 seconds, an ad renders.

**Verify:**

```bash
inventory | jq '.auctions_24h, .impressions_24h'
```

Expected: both `production` counts incremented by 1+.

```bash
inventory | jq .paying_events_1h
```

Expected: `{ "count": 1+, "total_publisher_payout_usd": 0.00X }` — depends on the served creative's bid amount × 0.85.

If `paying_events_1h.count` is still 0 — the impression may have come back as a sandbox creative (the test publisher uses sandbox by default). To force a production auction, the publisher needs a non-test publisher_id and you need a paying production campaign — your Step 3 campaign should be a candidate.

- [ ] At least one impression beacon fired.
- [ ] At least one paying event recorded.

---

## Step 7 — Verify balance accrual

**Goal:** confirm the publisher's balance went up by their share of the impression cost.

```bash
inventory | jq .publisher_balances
```

Expected: `{ "with_positive_balance": 1+, "total_owed_to_publishers_usd": 0.00X }`

For the specific test publisher:

```bash
curl -sS "https://boostboss.ai/api/billing?action=payout_status&developer_id=<UUID>" | jq .
```

Expected: `balance > 0`, `lifetime_earned == balance` (no payouts yet).

If balance is still 0 but `paying_events_1h.count > 0`, the credit RPC isn't firing. Check Vercel logs for `bbx:track:credit_fail` or `bbx:balance:*` lines.

- [ ] Publisher balance reflects the paid impression's 70% share (after the 30% combined exchange fee + network take).

---

## Step 8 — Force the Friday cron to fire NOW (manual trigger)

**Goal:** verify the cron picks up the eligible publisher AND fires a real Stripe Connect transfer (in test mode).

The cron normally runs at Friday 12:00 UTC, but we can fire it manually:

```bash
curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://boostboss.ai/api/billing?action=run_payout_cron" | jq .
```

Expected (depends on whether the publisher's balance is ≥ $25):

If balance < $25 (most likely on a single test impression):
```json
{ "publishers_attempted": 0, "skipped": 1, "succeeded": 0, ... }
```

In that case, you need to seed more impressions. Two options:
- **Loop the test page reload 25-50 times** (tedious but works)
- **Manually credit the publisher_balance via the SQL editor** (quick but bypasses the accrual path):
  ```sql
  UPDATE public.publisher_balance
     SET balance = 30, lifetime_earned = 30, updated_at = now()
   WHERE developer_id = '<your_test_pub_UUID>';
  ```

Then re-fire the cron:

```bash
curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://boostboss.ai/api/billing?action=run_payout_cron" | jq .
```

Expected:
```json
{
  "publishers_attempted": 1,
  "succeeded": 1,
  "tier1_failed": 0,
  "tier2_failed": 0,
  "total_usd": 30,
  "mode": "stripe"
}
```

- [ ] Cron summary shows `succeeded: 1+`, `total_usd > 0`.

---

## Step 9 — Verify the test transfer landed in Stripe

**Goal:** confirm the cron's `stripe.transfers.create()` call actually happened in Stripe test mode.

1. Open https://dashboard.stripe.com/test/connect/transfers
2. You should see a fresh transfer at the top, dated within the last minute.
3. Click into it. Verify:
   - Destination: the test publisher's connected account (acct_1...)
   - Amount: matches the cron's `total_usd`
   - Status: succeeded (test transfers complete instantly in Stripe sandbox)
4. The connected account's test-mode balance should show the transferred amount.

- [ ] Transfer visible in Stripe dashboard test mode.
- [ ] Destination matches the test publisher's stripe_account_id.

```bash
inventory | jq .payouts
```

Expected: `{ "paid": 1+, "total_paid_usd": 30.00, "last_paid_at": "<just now>" }`

- [ ] `payouts` table now has the corresponding row at `status='paid'`.

---

## Step 10 — Verify post-payout state

**Goal:** confirm balance was decremented and lifetime_paid was incremented.

```bash
curl -sS "https://boostboss.ai/api/billing?action=payout_status&developer_id=<UUID>" | jq .
```

Expected:
- `balance: 0` (just paid out)
- `lifetime_earned: 30` (unchanged)
- `lifetime_paid: 30` (matches what we transferred)
- `next_payout_eta`: either Friday timestamp (if balance accumulates again) or "threshold_pending" (if not)

```bash
inventory | jq .
```

Look at: `publisher_balances.with_positive_balance` should DECREASE by 1 after the payout.

- [ ] Balance debited.
- [ ] `lifetime_paid` incremented.
- [ ] Publisher dashboard "Earnings" section reflects the paid amount.

---

## Step 11 — Test Tier-2 failure handling

**Goal:** verify a Stripe-rejected transfer marks the publisher blocked + records Tier-2.

We can simulate a Tier-2 failure by manually deauthorizing the test publisher's Connect account, then trying to pay again:

1. Go to https://dashboard.stripe.com/test/connect/accounts → find the test publisher's account → "Reject" or "Disable account."
2. Manually credit the test publisher's balance again:
   ```sql
   UPDATE public.publisher_balance
      SET balance = 30, updated_at = now()
    WHERE developer_id = '<your_test_pub_UUID>';
   ```
3. Fire the cron:
   ```bash
   curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
     "https://boostboss.ai/api/billing?action=run_payout_cron" | jq .
   ```

Expected:
```json
{ "publishers_attempted": 1, "tier2_failed": 1, ..., "failures": [{ ..., "tier": 2, ... }] }
```

```bash
curl -sS "https://boostboss.ai/api/billing?action=payout_status&developer_id=<UUID>" | jq .
```

Expected: `payout_blocked: true`, `payout_blocked_reason: "stripe_transfer_rejected: ..."`

In the publisher dashboard, you should see the amber "Action Required" banner with a "Reconnect Stripe" button.

- [ ] Tier-2 failure correctly marks publisher blocked.
- [ ] Banner appears in publisher dashboard.
- [ ] Subsequent cron runs skip this publisher until unblocked.

---

## Step 12 — Test the operator unblock flow

**Goal:** verify the admin unblock action restores the publisher to eligible.

1. Open https://boostboss.ai/admin → 💸 Payouts panel.
2. Blocked publishers table should show the test publisher.
3. Click "Unblock". Enter operator reason like "test mode — re-enabling for E2E".
4. Verify the publisher returns to the dashboard with no banner.

Or via API:

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"developer_id":"<UUID>", "reason":"E2E test"}' \
  "https://boostboss.ai/api/billing?action=admin_unblock_publisher" | jq .
```

Expected: `{ "unblocked": true, "developer_id": "...", "email": "..." }`

- [ ] Publisher unblocked, banner cleared.
- [ ] Admin audit log shows the unblock event.

---

## Final inventory snapshot

```bash
inventory
```

This is the "post-Day 5" state. Capture it; if anything regresses later you have a baseline.

---

## What this proves

When all 12 steps are checked off:

- ✅ Advertiser onboarding + Stripe Checkout deposit + webhook credits balance
- ✅ Campaign creation + auto-approval
- ✅ Publisher onboarding + Stripe Express Connect + `payouts_enabled` flips on
- ✅ Ad serving + impression beacon + per-event balance accrual
- ✅ Friday cron picks up eligible publisher + fires real Stripe transfer
- ✅ Transfer lands in publisher's Stripe Connect account (test mode)
- ✅ Balance debited, `lifetime_paid` updated, payouts row at `status='paid'`
- ✅ Tier-2 failure marks publisher blocked
- ✅ Operator unblock restores publisher

That IS the full Stage 1 demo. The only difference between this and live operation: `sk_test_*` → `sk_live_*` + a real bank account on the publisher's Connect setup. **Day 7's job is to plan that flip safely.**

---

## Common failure modes and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Step 2 deposit count doesn't increment | Webhook secret mismatch or webhook not configured | Stripe dashboard → Webhooks (test mode) → confirm endpoint is `https://boostboss.ai/api/stripe-webhook` and signing secret matches `STRIPE_WEBHOOK_SECRET` env var |
| Step 5 `payouts_enabled` doesn't flip after onboarding | Webhook event `account.updated` not arriving | Same — check webhook endpoint is subscribed to `account.updated` event |
| Step 6 ad serves but no `paying_events_1h` increment | Sandbox creative path (no cost computation) | Switch to a real publisher_id with `pub_*` prefix; ensure your Step 3 campaign is matching the request's intent tokens |
| Step 8 cron returns `mode: demo` | Stripe SDK not initialized in production | `STRIPE_SECRET_KEY` env var not set or invalid; check `vercel env ls` |
| Step 9 transfer not visible in Stripe dashboard | Looking at live mode; toggle to **Test mode** in dashboard top-right |
| Tier-2 test (Step 11) doesn't mark blocked | Stripe error code not in our recognized list | Check Vercel logs for the exact `errType`/`errCode`; add to `tier2Reasons` array in `handleRunPayoutCron` if needed |

---

## After Day 5 completes

- Optional cleanup: delete the test advertiser + publisher rows so they don't pollute production analytics.
  ```sql
  DELETE FROM developers WHERE email LIKE '%+e2e%';
  DELETE FROM advertisers WHERE email LIKE '%+e2e%';
  ```
- Standby for Day 6 (runbook polish + cleanup) and Day 7 (live-key flip checklist + go-live procedure).

Stage 1 is functionally complete the moment all 12 steps land green.
