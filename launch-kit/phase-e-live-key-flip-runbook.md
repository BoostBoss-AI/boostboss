# Phase E — Live-Key Flip Runbook

**Status:** ready to execute. Read top-to-bottom before starting; the sequence matters.

This document covers the switch from Stripe sandbox (test mode) to live mode. After this runbook executes successfully, real money moves through the system. Until then, the sandbox loop proven in Days 1–6 is what's running.

**Total estimated time:** 60–90 minutes including verification. Don't squeeze it — most failure modes are recoverable, but only if you can detect them before customer transactions land.

---

## When to run this

Execute Day 7 ONLY when ALL of these are true:

- [ ] Phase E Days 1–6 are fully shipped and the sandbox autonomous cron has succeeded end-to-end (proven 2026-05-11)
- [ ] You have at least one live Boost Boss publisher who's agreed to be the first payout recipient (test transactions go to them)
- [ ] You have a real card and bank account ready for the "1 cent test" (the only money that moves in this runbook)
- [ ] You have at least 30 minutes of uninterrupted focus
- [ ] You're NOT planning to do outreach in the next 24 hours after the flip (need a settling window to catch issues before real customers hit the system)

If any of these are false, defer Day 7 until they're true.

---

## Phase 0 — Pre-flight checklist

Verify each item, paste me the results, then proceed.

### 0.1 — Sandbox loop confirmed working

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://boostboss.ai/api/billing?action=e2e_inventory" | jq '.payouts, .platform_currency'
```

`payouts.paid >= 1` confirms the sandbox loop has closed at least once.

### 0.2 — Migrations are clean

Run `db/check.sql` in Supabase SQL Editor. Expected: 15 rows, all `applied`.

### 0.3 — All Vercel env vars present

```bash
vercel env ls | grep -E "STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|CRON_SECRET|ADMIN_TOKEN|SUPABASE_"
```

All five should show "Production" environment. We'll be ROTATING three of them (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and confirming CRON_SECRET works at scale). ADMIN_TOKEN and SUPABASE_* stay the same.

### 0.4 — Vercel crons are scheduled

Open https://vercel.com/andydasouth-6210s-projects/boostboss/settings/cron-jobs

Confirm both:
- `/api/billing?action=run_payout_cron` — 0 12 * * 5
- `/api/billing?action=run_payout_retry_sweep` — 0 12 * * 6

### 0.5 — Code state

```bash
cd ~/boostboss
git log --oneline -5
git status
```

Last commit should be Phase E Day 6. Working tree should be clean.

### 0.6 — Production deploy is current

```bash
curl -sS "https://boostboss.ai/api/benna?op=engine-status" | jq .model_version
# Expected: "benna-rc5-2026.05.11"
```

If the model version is older, run `vercel --prod --yes --force` to bring it current before continuing.

---

## Phase 1 — Stripe live mode setup

Stripe sandbox and Stripe live mode are completely separate accounts. None of the test-mode setup carries over.

### 1.1 — Switch the Stripe dashboard to live mode

Open https://dashboard.stripe.com (no `/test/` in URL). If the top banner shows "Sandbox" or "Test mode", click the toggle in the top-right and switch to live mode.

**Important:** all URLs below are LIVE mode URLs. Verify by checking for the absence of "test" / "sandbox" in the URL or banner.

### 1.2 — Verify the live Stripe account is activated

Open https://dashboard.stripe.com/account/details

Your live account needs:
- [ ] Verified business identity (your real legal name + tax info)
- [ ] Verified bank account (so payouts to YOU can land)
- [ ] Verified email address
- [ ] At least one payment method enabled (Card payments turned on)

If any of these are not yet set up, complete them now. Stripe doesn't let you fire live charges until activation is complete.

### 1.3 — Activate Connect on the LIVE account

Open https://dashboard.stripe.com/connect/overview (NOT /test/connect)

If you see a "Get started" or "Activate" prompt, click it. Same flow as the sandbox activation in Day 5 Step 2:

- Platform name: `Boost Boss`
- Platform website: `https://boostboss.ai`
- Payout recipients: Individuals (publishers)
- Account types: **Express** (required)
- Industry: Advertising / Marketplace

Submit. Live Connect activation takes seconds.

### 1.4 — Generate the live secret key

Open https://dashboard.stripe.com/apikeys (NOT /test/apikeys)

Standard keys section. Click "Reveal" on Secret key — should start with `sk_live_*` (not `sk_test_*`). Copy the full string.

**Verify** in a terminal (don't paste the key into chat):

```bash
LIVE_KEY='<paste sk_live_* here, between single quotes>'
echo "Length: ${#LIVE_KEY}"  # expected 107
curl -sS -u "$LIVE_KEY:" https://api.stripe.com/v1/balance | jq .
```

Expected: `"livemode": true` AND `available: [...]` with your real currency (probably USD if your live account is US-based, possibly SGD if Singapore). If `livemode: false`, you copied a test key by mistake — go back and reveal the live key.

**Note the currency.** The autonomous cron auto-detects (Bug 1 fix from Day 6), so any currency works — but you should know whether your platform is USD, SGD, EUR, etc. so the publisher dashboard and reporting can be interpreted correctly.

### 1.5 — Create the live webhook endpoint

Open https://dashboard.stripe.com/webhooks (NOT /test/webhooks)

Click **"Add endpoint"**:

- Endpoint URL: `https://boostboss.ai/api/stripe-webhook`
- Description: `Boost Boss production webhook`
- Events to send (click "Select events" and add ALL of these):
  - `checkout.session.completed`
  - `charge.refunded`
  - `charge.failed`
  - `account.updated`
  - `account.application.deauthorized`
  - `payout.failed`

Save. Then click into the new endpoint, find the **"Signing secret"** section, click **"Reveal"**, and copy the `whsec_*` value.

---

## Phase 2 — Vercel env var rotation

This is the moment of switch. Do these THREE rotations in immediate sequence, then `vercel --prod --yes --force`.

**Critical:** between the env var changes and the `--force` deploy, the live function code is still running with the old (sandbox) keys. Until the deploy completes, Stripe Checkout will use sandbox keys. Don't accept customer traffic during this window.

### 2.1 — Rotate STRIPE_SECRET_KEY

```bash
cd ~/boostboss

# LIVE_KEY shell variable from Phase 1.4 (verified to work + livemode: true)
vercel env rm STRIPE_SECRET_KEY production --yes
printf "%s" "$LIVE_KEY" | vercel env add STRIPE_SECRET_KEY production
# Answer YES to "Mark as sensitive?"
```

### 2.2 — Rotate STRIPE_WEBHOOK_SECRET

```bash
# WEBHOOK_SECRET from Phase 1.5
WEBHOOK_SECRET='<paste whsec_* from Stripe webhook signing secret>'
echo "Length: ${#WEBHOOK_SECRET}"  # expected 38+ characters, starts with whsec_

vercel env rm STRIPE_WEBHOOK_SECRET production --yes
printf "%s" "$WEBHOOK_SECRET" | vercel env add STRIPE_WEBHOOK_SECRET production
# Answer YES to "Mark as sensitive?"
```

### 2.3 — Confirm CRON_SECRET and ADMIN_TOKEN are unchanged

These don't need rotation since they're internal-only. Just sanity check:

```bash
vercel env ls | grep -E "CRON_SECRET|ADMIN_TOKEN"
# Both should still show "Production"
```

### 2.4 — Force redeploy

```bash
vercel --prod --yes --force
```

Wait for the deploy to flip to Ready (~30–60 seconds, longer because `--force` rebuilds from scratch).

### 2.5 — Verify the deploy picked up the new keys

```bash
# Pull production env (the sensitive flag will hide values, but presence is checkable)
rm -f .env.production.local
vercel env pull .env.production.local --environment production
grep -E "^STRIPE_SECRET_KEY|^STRIPE_WEBHOOK_SECRET" .env.production.local
# Both lines should be present (values hidden because sensitive)

# Verify the function is using the live key by checking platform currency:
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://boostboss.ai/api/billing?action=e2e_inventory" | jq .mode
# Should still return "stripe" (means Stripe SDK initialized — good)
```

Then a deeper check — fire an empty payout cron to see what platform_currency it picks up:

```bash
curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://boostboss.ai/api/billing?action=run_payout_cron" | jq '.platform_currency, .mode, .publishers_attempted'
```

Expected:
- `platform_currency`: your LIVE account's currency (USD or whatever it is — NOT sgd from the sandbox)
- `mode`: "stripe"
- `publishers_attempted`: 0 (because no publishers are payouts_enabled in live mode yet — all our existing publishers' stripe_account_id values are sandbox accounts that don't exist in live mode)

If `platform_currency` shows the live currency → the new key reached the runtime correctly. ✅

---

## Phase 3 — The "1 cent test"

Before any real customer touches the system, prove the entire loop with the smallest possible real transaction.

**Setup:** you'll be both the test advertiser and the test publisher. Use a real card for the deposit (any card you control), and your real bank account for the payout destination.

### 3.1 — Create a live advertiser account (you)

Open https://boostboss.ai/ads/signup in a fresh incognito window. Sign up with your real email + a real password.

### 3.2 — Deposit $1 (one dollar)

In the advertiser dashboard:

- Click "Add Funds"
- Enter `1` as the custom amount (one dollar — keep this small)
- Click "Deposit via Stripe"
- Stripe Checkout opens with **live mode** (no test card numbers — use a real card)
- Submit. **A real $1 charge happens on your real card.** This is intentional and recoverable; you'll refund yourself at the end of Phase 3.

After payment success, verify:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://boostboss.ai/api/billing?action=e2e_inventory" | jq '.advertiser_deposits'
```

Expected: `total_usd: 1, count: 1+` AND `latest_at: <just now>`.

If count didn't increment → the webhook didn't fire. Check Stripe live mode webhook → recent deliveries → look for failures. Most likely cause: STRIPE_WEBHOOK_SECRET mismatch.

### 3.3 — Create a live publisher account (you)

Open https://boostboss.ai/publish/signup in a different incognito window. Sign up with a different real email (use `+pub1` alias if same Gmail).

### 3.4 — Complete Stripe Connect Express onboarding in live mode

In the publisher dashboard, click "Connect Stripe". Stripe opens **live** Express onboarding — NOT sandbox. Forms required:

- Your real legal name + date of birth
- Your real SSN / tax ID (Stripe requires this for live accounts)
- Your real address
- Your real bank account (routing + account number)
- Industry: Advertising

Submit. Stripe live verification typically completes in seconds for individuals; up to days for businesses requiring document review.

**Wait** for Stripe to flip the account to `payouts_enabled: true`. If you set up the webhook correctly in Phase 1.5, our backend gets notified via `account.updated` and flips the flag automatically. Check:

```bash
curl -sS "https://boostboss.ai/api/billing?action=payout_status&developer_id=<your_publisher_developer_id>" | jq '.payouts_enabled, .stripe_account_id'
```

Expected: `payouts_enabled: true`. If still `false` after 5 minutes, manually sync:

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"developer_id":"<UUID>"}' \
  "https://boostboss.ai/api/billing?action=admin_sync_stripe_account" | jq .
```

### 3.5 — Seed $1 publisher balance for the cron test

```sql
INSERT INTO public.publisher_balance (developer_id, balance, lifetime_earned, updated_at)
VALUES ('<your_publisher_developer_id>', 1.00, 1.00, now())
ON CONFLICT (developer_id) DO UPDATE
  SET balance = 1.00, lifetime_earned = 1.00, updated_at = now();
```

**Important:** we're testing $1, not $25 ($25 is the Decision 3 threshold). Temporarily edit `MIN_PAYOUT_USD_E` in `api/billing.js` from `25` to `0.01` for this test, deploy, run the cron, then restore. OR run a manual transfer directly via Stripe API:

Actually — easiest path is the second option:

```bash
# Fire a real transfer for $0.50 directly (split the $1 deposit so there's float for fees)
LIVE_KEY='<your sk_live_* key from earlier>'
curl -sS -u "$LIVE_KEY:" https://api.stripe.com/v1/transfers \
  -d "amount=50" \
  -d "currency=usd" \
  -d "destination=<your_publisher_stripe_account_id>" \
  -d "metadata[note]=live_key_flip_1cent_test" | jq .
```

Expected: `"livemode": true`, `tr_*` ID returned.

### 3.6 — Verify the transfer landed in the publisher's Stripe account

1. Open https://dashboard.stripe.com/connect/transfers (live mode)
2. The transfer from Phase 3.5 should appear at the top
3. Status should be "Paid"
4. The destination Stripe Connect account's balance should show $0.50

### 3.7 — Wait 1–3 business days for ACH

Stripe Connect transfers to a connected account become "available" instantly inside Stripe, but ACH payout to the publisher's actual bank account takes 1–3 business days. Don't proceed to Phase 4 until you've confirmed the $0.50 lands in the real bank account.

### 3.8 — Refund the $1 advertiser deposit

In your Stripe live dashboard → Payments → find your $1 charge → click Refund.

Net cost of the test: $0.50 paid out, $0.50 refunded to you, $0.50 retained by the publisher (yourself), $0.50 lost to Stripe's processing fee (~2.9% + $0.30 on the $1 charge, ~$0.33).

Total real money cost of this test: **approximately $0.33 in Stripe fees.** Well worth it.

---

## Phase 4 — Production readiness verification

Before opening to real customers, validate the full system is healthy.

### 4.1 — Recon endpoint clean

```bash
curl -sS "https://boostboss.ai/api/stats?type=recon" | jq .
```

Look for:
- `production.alert: false`
- `sandbox.alert: false` (or N/A if no sandbox data)
- `publisher_balance_health.drifted: 0`
- `payout_cron_health.failed_tier1_count: 0`
- `payout_cron_health.failed_tier2_count: 0`
- `payout_cron_health.blocked_publishers_count: 0`

If anything non-zero appears, investigate before opening to customers.

### 4.2 — Admin payouts dashboard clean

Open https://boostboss.ai/admin → 💸 Payouts panel.

Verify:
- Pending count: 0
- Failed counts: 0
- Blocked publishers: 0 (or only known-test rows you can clean up)

### 4.3 — Cron is scheduled correctly for live mode

```bash
vercel env ls | grep CRON_SECRET
```

If CRON_SECRET is still set from sandbox testing, leave it — same secret works for live.

Verify the cron entries are still in `vercel.json`. The Friday + Saturday entries don't need any modification for live mode.

### 4.4 — Live key alarms (optional but recommended)

In your Stripe live dashboard → Developers → Webhooks → click your endpoint → "Email alerts": enable email notification on webhook delivery failures. This is your canary for if production webhooks ever start failing.

---

## Phase 5 — Open to first customer

You're now live. Whenever you start outreach (Stage 1 outreach is unlocked):

1. **Monitor the recon endpoint** at least once daily for the first 2 weeks. `curl -sS "https://boostboss.ai/api/stats?type=recon" | jq .`
2. **Stripe live dashboard** — watch the "Recent transactions" panel for unexpected refunds, disputes, or failed payouts.
3. **First Friday cron execution** — if real publishers have qualified for payouts by then, watch the cron run carefully. Vercel cron logs are at https://vercel.com/andydasouth-6210s-projects/boostboss/logs.
4. **Alerting** — for the first month, set yourself a daily reminder to check the dashboard. After that, recurring drift detection should make it unnecessary.

---

## Rollback procedure

If anything goes wrong in Phases 2–5, restore sandbox keys immediately:

```bash
cd ~/boostboss

# You'll need the sandbox sk_test_* + whsec_test_* values from Stripe sandbox dashboard
SANDBOX_KEY='<sk_test_... from https://dashboard.stripe.com/test/apikeys>'
SANDBOX_WHSEC='<whsec_test_... from https://dashboard.stripe.com/test/webhooks>'

vercel env rm STRIPE_SECRET_KEY production --yes
printf "%s" "$SANDBOX_KEY" | vercel env add STRIPE_SECRET_KEY production

vercel env rm STRIPE_WEBHOOK_SECRET production --yes
printf "%s" "$SANDBOX_WHSEC" | vercel env add STRIPE_WEBHOOK_SECRET production

vercel --prod --yes --force
```

Wait ~60 seconds. Sandbox mode restored. No real money flows; investigate the issue offline.

Any real charges that occurred BEFORE rollback need to be refunded manually in the Stripe live dashboard.

---

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `livemode: false` in curl balance check | You're still hitting test key | Re-rotate STRIPE_SECRET_KEY with the live value |
| Webhook deliveries failing with 4xx | STRIPE_WEBHOOK_SECRET mismatch | Re-copy the signing secret from Stripe live webhook and re-set on Vercel |
| `account.updated` not flipping `payouts_enabled` | Webhook not subscribed to that event | Add `account.updated` to the event list in Stripe webhook config |
| Cron runs with `mode: demo` | STRIPE_SECRET_KEY didn't reach runtime | Run `vercel --prod --yes --force` once more |
| First customer sees "Deposit failed: An error occurred with our connection to Stripe" | Newline in env var or sandbox key still in place | Rotate STRIPE_SECRET_KEY with `printf "%s"` not `echo` |
| Customer's Connect onboarding asks for sandbox data | They're on a sandbox-mode account link | Mint a fresh Account Link via `refresh_connect` — should now be live |

---

## What gets deferred

Day 7 closes out Phase E's core. Items intentionally NOT covered, for later:

1. **Multi-currency support.** Decision 4 said USD only. If you ever support EUR / GBP / etc. advertisers, you'll need currency conversion at the cron layer.
2. **Reserve / holdback.** Decision 7 said no reserve at launch. Add when chargeback rate exceeds 1%.
3. **Tax form automation beyond Stripe defaults.** Decision 5 delegated to Stripe Express. Stripe generates 1099-Ks for US publishers earning >$600/year. No additional work needed unless you start operating in regions Stripe Express doesn't cover.
4. **Live key rotation cadence.** Best practice is to rotate `sk_live_*` every 90 days. Set yourself a calendar reminder. Same rotation procedure as the test mode rotation we practiced.
5. **Payout retry beyond 3 attempts.** Decision 6 caps at 3 retries. If you hit this in practice, the operator dashboard already surfaces the failure — manually escalate.

---

## Sign-off

After Phase 5 completes and you've watched the first 48 hours without alarms, mark Day 7 complete.

Phase E is done.

The autonomous payout pipeline runs every Friday at 12:00 UTC without intervention. Real money moves from advertisers through the platform to publishers. Tier-1/2/3 failure handling is wired. Operator dashboard provides observability. Webhooks keep the ledger synced with Stripe's reality.

This was the financial spine of Stage 1.
