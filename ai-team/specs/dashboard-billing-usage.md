# Spec — Dashboard: Billing & Usage (Peter)

A clean settings panel modeled on the Claude / iCloud settings pattern. Owner: Engineering (Peter).
Deploy gated. Reference mockup was produced in-session (dual-sided account view).

## Principle
Clear, native, transparent. Money earned + spent, ad-credit usage, and ad-distribution ratio — all
legible at a glance. Credits feel AI-native, but real dollars and per-outcome numbers are always visible
(the transparency moat).

## Role-aware
One layout; hide whichever half doesn't apply.
- **Publisher-only:** earnings, impressions-served usage, category ratio, payout activity.
- **Advertiser-only:** ad credits, credits-used usage, category-reached ratio, spend activity.
- **Dual-sided:** show both (StudyX-style) — earnings *and* ad credits side by side.

## Modules (top to bottom)
1. **Account header** — avatar + name + "Dual-sided account" + role pills (Publisher / Advertiser).
2. **Balance cards (2-up):**
   - *Earnings available* — $ figure, next payout date, all-time earned. (publisher)
   - *Ad credits* — credit count + "≈ $X" + auto-reload toggle. (advertiser)
3. **Usage this cycle (progress bars, with reset timers — Claude-style):**
   - Impressions served · your inventory (e.g. 312K / 500K · resets in N days).
   - Ad credits used · your campaigns (% · resets Sun).
4. **Where your ads play · by category** — a single horizontal ratio bar + legend (Coding / Study /
   Creative / Productivity / Other, each with %). The "distribution data with categories ratio".
5. **Recent activity** — invoice-style rows: date · type (earned / top-up / payout) · amount · status.
6. **Footer** — "Every impression is itemized · open a receipt" (links to the per-impression receipt).

## Data sources
- Earnings / payouts: Finance (Mike) — cleared revenue × 70%, payout cycle, balance.
- Credits / spend: the credit ledger (extends promote-loop ad-credit).
- Impressions / category ratio: track + auction logs (Benna), grouped by category.
- All numbers transparent to dollars + per-outcome (CPM/CPC/CPA).

## Build notes
- Reuse the existing dashboard chrome; **audit top-level callsites before touching `developer.html`**
  (blank-page history — grep top-level uses before deleting any `const X = getElementById(...)`).
- New hash-route needs the 3-edit rule: JS VALID_ROUTES + HTML section + dashboard-shell.css allowlist.
- Light/dark both. Sentence case. No ratio on public pages — this is the logged-in account view (fine).
- Deploy gated → Andy pushes.
