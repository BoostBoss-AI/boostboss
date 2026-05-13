# Phase H Panel 1 — Live Activity — Closing Report

**Date:** 2026-05-13
**Status:** Built, tested, ready to deploy. Two more panels (3 + 2) still to come.

---

## What this phase did

Built the operator's "hospital monitor" — a single admin tab that answers "is the machine healthy?" in under ten seconds. Plan doc was [`phase-h-panel-1-live-activity-plan.md`](phase-h-panel-1-live-activity-plan.md); defaults for the three open questions:

- **Q1 thresholds**: Green ≥60% fill / 0 Tier-2-3 / 0 blocked · Amber 30-60% or 1-2 T2 or 1-4 blocked · Red <30% or T3 or 5+ blocked.
- **Q2 sandbox**: production/sandbox toggle in the UI; production is the default.
- **Q3 location**: new sidebar entry directly under Overview (keyboard shortcut `2`).

Adjust any of those by editing the thresholds in `api/stats.js` `handleLiveActivity` (search for `status = "action_required"`).

---

## Files changed

**New**
- `tests/stats.test.js` — 7 tests covering the live_activity contract.
- `launch-kit/phase-h-panel-1-closing-report.md` — this file.

**Modified**
- `api/stats.js`
  - New `type=live_activity` action (GET, admin-token-gated).
  - Single round-trip endpoint returning `health`, `volume`, `money`, `top_publishers`, `top_campaigns`, `by_door`, `recent_alerts`.
  - Demo-mode safety net: returns a zeroed-but-well-shaped payload so UI development doesn't require Supabase to be live.
  - Production path uses `HEAD` counts where possible to keep DB cost flat; paged reads only for money/by-door sums.
- `public/admin.html`
  - New sidebar entry: 🟢 Live Activity (slot 2).
  - New panel with 3 status cards (Health / Volume / Money), 2 side-by-side tables (Top Publishers / Top Campaigns), by-door breakdown, recent alerts feed.
  - 30-second auto-refresh; pauses when the tab isn't visible; manual Refresh button.
  - Production/Sandbox dropdown wired to `mode` query param.
  - `switchPanel` now starts/stops the live timer on enter/leave to avoid background polling.

---

## What the endpoint costs per call

- 4 `count: "exact", head: true` queries on `auction_logs` (windowed): ~5-20 ms each.
- 1 `count` on `payouts` for Tier-2 + a small `select` for recent Tier-3 + 1 `count` on `developers` for blocked.
- Paged sum of `events.cost` + `developer_payout` (24h window). Hard cap at 50k rows per call; PgBouncer will smooth concurrent admin tabs.
- Top-publishers + top-campaigns: one events read + one developers/campaigns join. Capped at 5 rows out.
- by-door: two paged reads (auction_logs + events) over the 24h window.
- Alerts: small recent-N reads.

At 9.8k auctions/24h (current production load), one full call is well under 200 ms. At 200k impressions/day (the launch ceiling we modeled in `scale-ceiling-analysis.md`), the paged loops finish in 1-2 s — still fine for a 30 s refresh interval, and the in-tab visibility check means we never poll when the operator isn't watching.

If this becomes a bottleneck post-launch, the cheapest swap is to materialise a `bbx_live_activity_summary` view + refresh it every 30 s via pg_cron — endpoint just reads one row. Not building that now; one fewer moving piece on day one.

---

## Tests

`tests/stats.test.js` — 7 passing:
- HAS_SUPABASE check, OPTIONS preflight.
- live_activity returns the full shape (health / volume / money / 3 lists / by_door with all 4 doors).
- mode=sandbox respected.
- Unknown mode defaults to production.
- Demo-mode counters are zeroed and status is one of the known enum values.
- Non-GET methods fall through to the catch-all 400 (i.e. don't accidentally hit the live_activity handler).

**Full suite — 277 passing:**
auth 20 · benna 15 · billing 74 · campaigns 60 · mcp 21 · rtb 33 · sandbox 14 · stats 7 · track 33.

---

## What's not in Panel 1 (deferred per design doc)

- Charts/graphs — Panel 1 stays the glance view; historical trends go in a later Analytics page.
- Inline drilldowns — alert rows link to existing panels (Payouts, Campaigns); per-auction inspection is **Phase H Panel 3**.
- Real-time websockets — 30s polling is fine for ad ops.
- Customisable refresh interval — hard-coded 30s. Click Refresh if you're impatient.

---

## Deploy steps

```bash
cd ~/boostboss
git add -A
git commit -m "Phase H Panel 1: Live Activity console (operator hospital monitor)

Backend:
- api/stats.js: new type=live_activity action (admin-gated GET)
- Returns one-shot view of health / volume / money / top publishers /
  top campaigns / by-door breakdown / recent alerts
- Demo-mode safety net for offline UI development
- Production/sandbox toggle via ?mode= query param

Frontend (public/admin.html):
- New sidebar entry (Live Activity, slot 2) between Overview and Review
- 3 status cards: Health (green/amber/red), Volume, Money
- 2 side-by-side tables: Top Publishers, Top Campaigns (24h)
- By-door breakdown table
- Recent alerts feed, clickable to deep-link into related panels
- 30s auto-refresh, paused when tab is hidden, manual Refresh button

Tests:
- tests/stats.test.js: 7 new tests covering the contract
- Full suite: 277 passing (was 270)
"
git push origin main
```

Then wait for Vercel to flip green before clicking around the panel — the 30 s poll on cold deploy can otherwise hit the stale build for the first minute and look broken.

No DB migration this phase. The endpoint reads existing tables (`auction_logs`, `events`, `payouts`, `developers`, `campaigns`, `advertisers`).

---

## What's next in Phase H

- **Panel 3 — per-auction inspector** (already approved in spirit). Picks up where Panel 1 leaves off: when the alerts feed says "fill rate dropped to 62% on NPM SDK door", Panel 3 is where you go to see *which auctions specifically* are failing and why. Backend = `type=auction_inspect&id=X`; UI = a search box + a detail view with the full auction log, eligibility breakdown, and predicted-CTR/CPM trace.
- **Panel 2 — money flow extension** (half built already, needs surfacing on this same page or a sibling tab).
- **Panel 4 — anomaly detection** (waits for baseline traffic — was your call).

Reply with what you want to tackle next, or "ship Panel 3" if you trust me to take the same default approach.
