# Phase H Panel 1 — Live Activity Console — Plan

**Status:** awaiting your review before any code is written.

This document surfaces the questions Panel 1 should answer, the metrics that answer them, the data sources, and the proposed layout. Once you sign off, I build it.

---

## The operator's hospital-monitor question

When you open the dashboard at 9am, you want to answer one question in under 10 seconds:

> **Is the machine healthy?**

Everything in Panel 1 is in service of that one question. If yes → you close the tab and go do other things. If no → the panel tells you exactly where to look next (which is where Panel 3, the per-auction inspector, takes over).

---

## Seven sub-questions Panel 1 must answer

Each sub-question maps to specific metrics shown on the panel:

### Q1: Is traffic flowing?

**Metrics:**
- Auctions in the last 5 minutes (count)
- Auctions in the last 60 minutes (count)
- Auctions in the last 24 hours (count)
- Trend arrow: is current 1h rate higher or lower than the 1h-trailing-24h average?

**Source:** `auction_logs.ts` filtered by time window.

### Q2: Is it being matched?

**Metrics:**
- Fill rate last 60 min: `count(outcome='won') / count(outcome != 'sandbox')`
- Fill rate last 24h: same
- Top reason for unfilled auctions (e.g. "no eligible campaigns", "floor_unmet", "blocklist_cat")

**Source:** `auction_logs.outcome` + `auction_logs.eligibility` JSON column.

### Q3: Where is it flowing FROM? (publishers)

**Metrics:**
- Active publisher count in last 60 min (distinct `developer_id` in events)
- Active publisher count in last 24h
- Top 5 publishers by impressions (last 24h) — `email`, impression count, earnings

**Source:** `events` joined with `developers`.

### Q4: Where is it flowing TO? (campaigns/advertisers)

**Metrics:**
- Active campaign count in last 60 min (distinct `campaign_id` in events with type=impression)
- Top 5 winning campaigns last 24h — name, advertiser email, impressions, spend

**Source:** `events` joined with `campaigns` and `advertisers`.

### Q5: What's the door mix?

**Metrics:**
- Auctions by `integration_method` last 24h: mcp / js-snippet / npm-sdk / rest-api breakdown
- Avg eCPM by surface: `cost * 1000 / impressions` per door
- Average win-price by surface

**Source:** `auction_logs.integration_method` + `events`.

### Q6: Is anything failing?

**Metrics:**
- Tier-1 failure count last 24h (`payouts.failure_tier=1`)
- Tier-2 failure count last 24h (`payouts.failure_tier=2`)
- Tier-3 alerts triggered (cron runs where >20% failed)
- `bbx:track:write_fail` count last 24h (from auction_logs orphans)
- Blocked publishers count

**Source:** `payouts` + `auction_logs` orphan detection (already in recon endpoint).

### Q7: Trend direction?

**Metrics:**
- Current 1h auctions vs. 24h average — % delta
- Current 1h fill rate vs. 24h average — % delta
- Current 1h paying events vs. 24h average — % delta

**Source:** derived from Q1, Q2, Q4 windows.

---

## Proposed layout

Single new admin tab: **📊 Live Activity** (or just "Live" — keystroke 7 in the sidebar shortcut).

```
┌─────────────────────────────────────────────────────────────────┐
│ Live Activity                                    Refreshing 30s │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ ┌─ Health ──────────┐ ┌─ Volume ──────────┐ ┌─ Money ──────────┐│
│ │ ● Healthy         │ │ Auctions 1h: 423  │ │ Spend 24h: $32   ││
│ │ Fill rate: 87%    │ │ Auctions 24h: 9.8K│ │ BB 30%: $9.61    ││
│ │ Errors: 0 T2/T3   │ │ ↑ +12% vs avg     │ │ Pub accrued: $27 ││
│ └───────────────────┘ └───────────────────┘ └──────────────────┘│
│                                                                 │
│ ┌─ Top publishers (24h) ──────────┐ ┌─ Top campaigns (24h) ────┐│
│ │ email           imps    earn   │ │ campaign     advertiser  ││
│ │ andy+pub1@..   2,184    $1.84  │ │ Stripe Atlas Stripe Inc  ││
│ │ andy+pub2@..     891    $0.76  │ │ Vercel Deploy Vercel Inc ││
│ │ ...              ...    ...    │ │ ...                      ││
│ └─────────────────────────────────┘ └──────────────────────────┘│
│                                                                 │
│ ┌─ By door (24h) ──────────────────────────────────────────────┐│
│ │ Surface    Auctions  Imps    Avg eCPM   Fill rate            ││
│ │ MCP        5,841     5,201   $4.20      89%                  ││
│ │ JS Snippet 2,103     1,847   $3.10      88%                  ││
│ │ NPM SDK    1,432       890   $2.40      62%                  ││
│ │ REST API     412       388   $3.80      94%                  ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─ Recent alerts ──────────────────────────────────────────────┐│
│ │ (empty — system healthy)                                     ││
│ │   ... OR ...                                                 ││
│ │ 14:23  Tier-2 payout failed: pub_acct_xxx — account_disabled ││
│ │ 13:55  Fill rate dropped to 62% on NPM SDK door              ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Card details

**Card "Health"** — single glance status:
- Green dot + "Healthy" if: fill rate > 60% AND zero Tier-2/3 failures last 24h AND zero blocked publishers
- Amber dot + "Watch" if: fill rate 30-60% OR 1+ blocked publishers OR 1+ Tier-2 failures
- Red dot + "Action required" if: fill rate < 30% OR Tier-3 alert triggered OR 5+ blocked publishers
- Three sub-metrics: fill rate, Tier-2/3 count, blocked count

**Card "Volume"** — is traffic flowing?
- Auctions last 1h (big number)
- Auctions last 24h (smaller)
- Trend vs. 24h average (arrow + %)

**Card "Money"** — is money moving?
- Advertiser spend last 24h
- BB's 30% share (6.5% RTB fee + 23.5% network take)
- Publisher balance accrued (today's deltas, not lifetime)

**Top publishers table (24h)** — who's sending traffic?
- 5 rows max
- Click row → goes to that publisher's payout_status detail

**Top campaigns table (24h)** — what's winning?
- 5 rows max
- Click row → goes to campaign detail in `/admin/campaigns`

**By-door breakdown** — where's the supply mix?
- 4 rows (mcp, js-snippet, npm-sdk, rest-api)
- Auctions, impressions, avg eCPM, fill rate per door
- Highlights which door is over/under-performing

**Recent alerts** — anomalies to investigate
- Last 5-10 alert events
- Each one is clickable → takes you to Panel 3 (auction inspector) or to admin Payouts panel as relevant
- Empty when healthy

### Auto-refresh

- 30-second auto-refresh on a setInterval
- Refresh button visible top-right (for impatience)
- Spinner on each card while refreshing (subtle)
- Pause refresh when tab is not visible (saves database calls)

---

## Data source plan

One new endpoint: `GET /api/stats?type=live_activity` (auth: `ADMIN_TOKEN`).

Returns the full synthesized view in one round-trip. Backend does the joins; frontend just renders. Targeting ~150ms response time.

```json
{
  "generated_at": "2026-05-11T08:00:00Z",
  "health": {
    "status": "healthy",  // healthy | watch | action_required
    "fill_rate_24h": 0.87,
    "tier2_24h": 0,
    "tier3_alerts_24h": 0,
    "blocked_publishers": 0
  },
  "volume": {
    "auctions_5m": 35,
    "auctions_1h": 423,
    "auctions_24h": 9821,
    "trend_pct": 12.4
  },
  "money": {
    "advertiser_spend_24h": 32.18,
    "bb_revenue_24h": 4.83,
    "publisher_accrued_24h": 27.35
  },
  "top_publishers": [
    { "developer_id": "...", "email": "...", "impressions_24h": 2184, "earnings_24h": 1.84 }
  ],
  "top_campaigns": [
    { "campaign_id": "...", "name": "...", "advertiser_email": "...", "impressions_24h": 1820, "spend_24h": 12.40 }
  ],
  "by_door": [
    { "door": "mcp",        "auctions_24h": 5841, "impressions_24h": 5201, "avg_ecpm": 4.20, "fill_rate": 0.89 },
    { "door": "js-snippet", ... },
    { "door": "npm-sdk",    ... },
    { "door": "rest-api",   ... }
  ],
  "recent_alerts": [
    { "ts": "...", "tag": "payout.tier2", "message": "...", "link": "/admin?panel=payouts" }
  ]
}
```

All queries time-windowed; expected query cost is manageable even at 200k impressions/day (we already have indexes on `auction_logs.ts` and `events.created_at` from earlier phases).

---

## What I'm NOT building in Panel 1

Deferred so Panel 1 stays focused on "is the machine healthy?":

- **Charts/graphs** — Panel 1 is the glance view. Charts go in a future "Analytics" sub-page if you want historical trends.
- **Drilldown navigation** — clicks on rows link to existing panels (Payouts, Campaigns) rather than rendering inline drilldowns. Inline drilldowns belong in Panel 3 (per-auction inspector).
- **Customizable refresh interval** — fixed at 30s. If you want faster, click the refresh button.
- **Multiple time windows side-by-side** — Panel 1 shows 1h + 24h. If you want 7d / 30d comparisons, that's the Analytics page.
- **Real-time websockets** — 30s polling is fine for an operator console. Real-time matters for trading floors; not for ad ops.

---

## Open design questions for you

Three small things I want your call on before I write code:

**Q1: Health status thresholds — are these reasonable?**

- Green: fill rate ≥ 60%, 0 Tier-2/3 failures, 0 blocked publishers
- Amber: fill rate 30-60% OR 1-2 Tier-2 OR 1-4 blocked
- Red: fill rate < 30% OR Tier-3 alert OR 5+ blocked

Adjust any of these to your taste. The "fill rate ≥ 60%" green threshold is the most subjective — for a brand-new ad network with sparse demand, 30% might be the realistic green. For a mature network, 80% might be the floor.

**Q2: Sandbox traffic — include or exclude?**

The metrics above all filter `is_sandbox = false`. But during your validation work, sandbox traffic is the only traffic. Three options:

- A) Always exclude sandbox (matches production reality, but shows mostly zeros until real traffic flows)
- B) Always include sandbox (you see meaningful numbers immediately, but production metrics get noised by your own testing)
- C) Toggle in the UI (switch between "Production" and "Sandbox" views)

I'd default to **(C) with a toggle** — production view by default, sandbox visible when you flip the switch. That mirrors how the Stripe dashboard handles test/live mode.

**Q3: Where in admin should this panel live?**

Options:
- Add to existing sidebar as new "📊 Live" entry between Overview and Review Queue
- Make it the new Overview/landing page when admin logs in (replacing current Overview)
- Standalone route `/admin/live` separate from sidebar

I'd default to **#1 — new sidebar entry next to Overview**. Doesn't disrupt anything existing, easy to find, keyboard shortcut 7.

---

## Sign-off

If you're good with:
- The 7 sub-questions and metrics
- The proposed layout
- The card hierarchy (Health/Volume/Money on top, tables below)
- Your answers to the 3 open questions (Q1 thresholds, Q2 sandbox toggle, Q3 sidebar entry)

→ reply with "ship Panel 1" + your answers on Q1/Q2/Q3 and I start building. Backend → UI → tests → deploy. Estimated half-day if I stay focused.

If anything doesn't look right, push back and I revise the plan before writing code.

After Panel 1 ships, Panel 3 (per-auction inspector) is next. Panel 2 (money flow) is half-built already and just needs extension. Panel 4 (anomaly detection) waits for real traffic baseline per your direction.
