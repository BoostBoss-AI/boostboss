# Gate Policy — what runs free vs what waits for you

The rule: **reversible runs, irreversible waits.** Anything an agent can undo cheaply, it just
does. Anything that spends money, sends to a stranger, or changes production goes to the
`action_queue` and waits for the Chairman's tap in Slack `#approvals`.

## 🟢 Runs free (no approval)
- Research, discovery, listening, intent capture.
- Drafting, personalizing, scheduling (not sending).
- Internal analysis, scoring, allocation modeling.
- Replying to **inbound** DMs/questions within platform rules.
- Onboarding a **self-serve** signup (they came to us).
- Writing to shared memory; compiling reports.

## 🔴 Waits for approval (writes to `action_queue`)
| Action | Why gated |
|---|---|
| **Cold email / first-touch DM** to strangers | deliverability + legal (CAN-SPAM/GDPR); protect the domain |
| **Money out** — payouts, refunds, any spend | irreversible; never autonomous |
| **Production deploy** (`git push` / Vercel) | can break the live product |
| **Pricing / take-rate changes** | revenue-affecting |
| **Anything customer-facing in your name** at scale | brand risk |

## 💰 Money-safety invariants (hard — machine-enforced, on top of the human gate)
Money flows both ways: pay-in from advertisers, payout to publishers. To guarantee we never pay
out more than we took in:

1. **Payout basis = cleared, collected advertiser revenue × publisher share. Never accrued/promised.**
   Each publisher earns a *fraction* of the revenue their inventory generated, so we structurally
   cannot owe more than we collected. BB's take (e.g. 30%) is the margin, realized only after clearing.
2. **Clear-before-pay.** Only count advertiser payments that have settled AND passed the
   refund/chargeback window. Never pay on pending/uncleared funds.
3. **Solvency batch guard.** Before any payout release: `Σ(batch) ≤ available_cleared_balance − reserve`.
   A batch that fails is **blocked** — not even presented for approval.
4. **Reserve buffer.** Hold a % (accountant-set) against chargebacks/disputes/fraud clawbacks
   (cf. the 30-day affiliate clawback). No earnings accrue on invalid/fraud traffic.

> Status: this policy is documented; the **enforcement is a product build task for the Finance
> pillar** (cleared-revenue accounting + the solvency check). Until built, ALL payouts are
> manually gated — Chairman verifies balance covers the batch before approving.

## How a gate works
1. Agent prepares the action fully (e.g., 30 personalized emails) and writes one row to
   `action_queue` with a human-readable `summary` and the full `detail` payload.
2. It appears in the morning brief and in `#approvals` as a tap-to-approve item.
3. Chairman approves → the proposing agent executes the stored payload. Rejects → it's dropped.
4. Nothing in this list ever executes without that decision.

## Loosening over time
The cold-outbound gate is the one meant to relax. Once the sending domain is warmed and
Benna-Reach has a proven, low-complaint track record, raise the auto-send threshold (e.g.,
auto-send to high-fit prospects below a daily cap; keep edge cases gated). Money and deploys
stay gated permanently.
