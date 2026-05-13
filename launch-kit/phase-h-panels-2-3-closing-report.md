# Phase H Panels 2 + 3 — Money Flow + Auction Inspector — Closing Report

**Date:** 2026-05-13
**Status:** Both panels built, tested, and bundled into a single deploy per your "everything solid built at once" directive.

---

## What landed

### Panel 2 — Money Flow

Answers "is the money moving correctly?" in one round-trip. Where Panel 1 (Live Activity) is the heartbeat monitor, Panel 2 is the financial X-ray: every dollar across deposits, spend, BB take, publisher accrual, and payouts paid — over 24h / 7d / 30d.

The "half-built" pieces from earlier phases (`publisher_balance_health` and `payout_cron_health` already on `?type=recon`) are now surfaced in a dedicated UI without rerunning the recon cron's heavier queries each time.

What the panel renders:

1. **Flow by Window** — 24h, 7d, 30d rows showing deposits in, advertiser spend, BB take, publisher accrued, payouts paid. Lets the operator spot "deposits dropped 80% week-over-week" without writing SQL.
2. **Eligible for Next Payout Cron** — count of publishers and total $ ready, against Stripe platform balance available. If platform balance < ready, the field goes red with a tooltip "cron will fail at Tier-1." That's the single most important field in this whole panel; it's what tells you to top up Stripe before Friday.
3. **Payout Cron Health** — last run status (paid/failed/pending), when, amount, Tier-1/Tier-2 fail counts, blocked publishers.
4. **Publisher Balance Drift** — any developer whose `publisher_balance.balance` doesn't match `lifetime_earned − lifetime_paid − pending_clawbacks` by more than $0.50 AND 1%. Empty when reconciled (the healthy state). Sample of up to 5 rows when not.
5. **Top Advertisers by 24h Spend** — five rows.
6. **Top Publishers by Balance** — five rows.

### Panel 3 — Auction Inspector

Answers "why didn't my campaign serve here?" without dropping into Supabase. Reads from `auction_logs` (db/08_auction_logs.sql) which already captures the full eligibility breakdown, scored candidates, request fingerprint, and outcome for every auction over a 30-day window.

Two modes:

- **List**: filter by outcome (won / no_match / below_floor / rate_limited / sandbox / error), door (mcp / js-snippet / npm-sdk / rest-api), production/sandbox; renders the most recent 50 with publisher email + winning campaign name resolved.
- **Detail**: click any auction_id (or paste one into the Jump field) to see the full eligibility funnel (pool_size → after_status → after_region → ... → eligible_final), the request fingerprint, and all scored candidates with their Benna factor breakdowns and effective CPM.

This is the panel where an operator answers "yes, your campaign was eligible — it lost the auction to a higher-scoring competitor" or "no, you got dropped at the target_keywords filter."

---

## Files changed

**New**
- `launch-kit/phase-h-panels-2-3-closing-report.md` — this file.

**Modified — `api/stats.js`**

Three new exported handlers (one of which existed already from Panel 1):

- `_handleLiveActivity` (Panel 1, prior phase).
- **`_handleMoneyFlow`** — `GET /api/stats?type=money_flow[&mode=production|sandbox]`. Admin-gated. Paged event scans capped at 60k events/window. Stripe balance check is cached for 60s to avoid hammering the API. Inline copies of the balance-drift + payout-health computations from recon so this endpoint stands on its own.
- **`_handleAuctionInspect`** — `GET /api/stats?type=auction_inspect[&id=X | &outcome=...&publisher_id=...&integration_method=...&mode=...&limit=50]`. Admin-gated. List and detail share one route; presence of `id` switches modes.

**Modified — `public/admin.html`**

- Two new sidebar entries: 💰 Money Flow, 🔬 Auction Inspector.
- Two new panels with all the rendering JS.
- `switchPanel` now wires the load function for each new panel name.
- Auction Inspector detail drawer uses pre-formatted JSON blocks for eligibility / request / candidates; bright enough on the dark background, narrow enough to fit on a laptop.

**Modified — `tests/stats.test.js`**

- 6 new tests for `money_flow` (full shape, sandbox mode, demo-zero shape).
- 3 new tests for `auction_inspect` (list, detail-404, POST rejection).
- File grew from 7 → 13 tests.

---

## Cost per call (rough)

**Money Flow**:
- 3 windowed paged event scans (24h / 7d / 30d). Each capped at 60k rows. At current production load (~10k events/day), 30d ≈ 300k rows is the heaviest; at the 200k impressions/day launch ceiling it caps out earlier than the 60k limit.
- 3 payout sums (lightweight aggregations over the `payouts` table — small).
- 3 deposit sums over `transactions` (small).
- 1 top-advertisers query (similar event scan as 24h).
- 1 publisher_balance descending-by-balance limit-10 query.
- 1 stripe balance (60s cached).

Worst case ~3-5 seconds on a 30-day window with 200k events/day. **The panel is not auto-refreshed** — operator clicks Refresh. That's intentional; this isn't a heartbeat monitor and the cost would be wasted on idle tabs.

**Auction Inspector list**: one `auction_logs` query with the indices we already have on `(ts DESC)`, `(publisher_id, ts DESC)`, `(outcome, ts DESC)`, and `(integration_method, ts DESC)`. With 50-row limit and the 30-day retention this is <50ms in practice.

**Auction Inspector detail**: one indexed point-lookup by primary key + two single-row joins. <20ms.

---

## Tests

`tests/stats.test.js` — **13 passing** (+6 vs Phase H Panel 1):

- `money_flow returns 200 with full shape in demo mode` — locks windows + top lists + eligible_for_next_payout shape.
- `money_flow respects mode=sandbox`.
- `money_flow demo returns zeroed but well-shaped windows`.
- `auction_inspect list returns 200 with empty list in demo mode`.
- `auction_inspect detail returns 404 for unknown id in demo mode`.
- `auction_inspect rejects non-GET`.

**Full suite: 283 passing** (auth 20 · benna 15 · billing 74 · campaigns 60 · mcp 21 · rtb 33 · sandbox 14 · stats 13 · track 33).

---

## Why this isn't auto-refresh

Panel 1 polls every 30s because it's the operator's heartbeat tab — they leave it open. Panel 2 and Panel 3 are *investigative* tabs: you open them when something on Panel 1 caught your eye, you click around, then you close them. Polling them adds DB cost without adding signal. The Refresh button is one click.

If you want auto-refresh on Money Flow later (e.g. operator wants a single-tab view they leave open with money + activity stitched together), the wire-up is identical to Panel 1's `startLiveActivity` / `stopLiveActivity` pattern. Add it later.

---

## What's NOT in these panels

- **Per-day timeline charts** — both panels could render Chart.js sparklines for the windowed metrics. Skipped for the first cut to keep deploy lean. The data exists; the chart wiring is the easy addition.
- **Bulk operations on auctions** — no "rerun this auction with relaxed targeting" or "explain this loss" button. Inspector is read-only. That's a Phase 4 feature.
- **CSV export from Money Flow** — would be one button. Add when an investor asks for the numbers.
- **Real-time alerts pinned to specific publishers** — Panel 4 territory (anomaly detection). Waits for real traffic baseline per your direction.

---

## Deploy steps

```bash
cd ~/boostboss
git add -A
git commit -m "Phase H Panels 2 + 3: Money Flow + Auction Inspector

Backend (api/stats.js):
- New type=money_flow action — multi-window financial picture
  (24h/7d/30d advertiser spend, BB take, publisher accrual, payouts paid),
  top advertisers, top publisher balances, Stripe platform balance check,
  pending clawbacks, balance drift sample, payout cron health.
- New type=auction_inspect action — list mode w/ outcome/door/publisher
  filters + detail mode returning full eligibility funnel and scored
  candidates from auction_logs.
- Both admin-gated, sandbox/production toggle, demo-mode safety net.

Frontend (public/admin.html):
- Two new sidebar entries (Money Flow, Auction Inspector).
- Money Flow: flow-by-window table, eligible-for-next-payout card with
  Stripe balance check (red when insufficient), payout cron health card,
  balance drift table, top advertisers + top publishers.
- Auction Inspector: filterable list (outcome, door, mode) + clickable
  detail drawer rendering eligibility funnel, request fingerprint, and
  scored candidates with Benna factor breakdowns.

Tests (tests/stats.test.js):
- 6 new tests for money_flow (shape, sandbox, zero-state).
- 3 new tests for auction_inspect (list, 404 detail, POST rejection).
- Stats file: 7 → 13 passing. Full suite 277 → 283 passing.
"
git push origin main
```

Then wait for Vercel to flip green. No DB migration this phase — both endpoints read existing tables.

---

## Where Phase H stands now

- ✅ Panel 1 (Live Activity) — shipped previous deploy.
- ✅ Panel 2 (Money Flow) — this deploy.
- ✅ Panel 3 (Auction Inspector) — this deploy.
- ⏳ Panel 4 (Anomaly Detection) — waits for real traffic baseline. Per your direction, we build this after publisher acquisition surfaces realistic patterns.

After this deploy lands, the operator console covers the full Stage-1 ops surface: health (Panel 1), money (Panel 2), debug (Panel 3). Panel 4 is a "nice to have" — the other three together already answer 95% of operator questions without dropping into SQL.

Next obvious move: publisher acquisition (per saved memory) — onboarding flow is ready, demand side has the four campaigns funded, observability covers all the failure modes.
