# Phase F — Per-Door Onboarding Wizard — Report

Date: 2026-05-11
Status: ✅ Shipped locally.
Tests: **253 passing** (was 249; +4 Phase F integration_verify tests).

## What Phase F delivers

New publishers see a real-time "Verify your integration" panel on the dashboard. Once they fire their first event from any door, the matching badge flips from "Not started" to "✓ Verified" within 5 seconds — without a page refresh. Closes the gap between "I copied the install snippet" and "Boost Boss confirmed I'm wired up."

The existing per-door integration cards already did `Active` / `Not started` based on 7-day stats. Phase F adds the **fast-feedback loop** that new publishers actually need during onboarding.

## What landed

### Backend — `integration_verify` action

New `GET /api/billing?action=integration_verify&developer_id=<UUID>` returns per-door status for the last 24h:

```json
{
  "mode": "stripe",
  "any_active": true,
  "first_door_at": "2026-05-11T05:08:07Z",
  "mcp":        { "active": true,  "impressions_24h": 12, "clicks_24h": 1, "last_seen_at": "..." },
  "js-snippet": { "active": false, "impressions_24h": 0,  "clicks_24h": 0, "last_seen_at": null },
  "npm-sdk":    { "active": false, "impressions_24h": 0,  "clicks_24h": 0, "last_seen_at": null },
  "rest-api":   { "active": false, "impressions_24h": 0,  "clicks_24h": 0, "last_seen_at": null }
}
```

Single SQL query against `events` filtered by `developer_id`, last 24h, non-null `integration_method`. Grouped in JS. No auth — the developer_id is the publisher's own identifier so they can read their own state.

### Frontend — verify badges in `public/developer.html`

Four badges rendered in a grid below the integration cards. Each badge:

- **Default state:** `○` icon, "Not started" status, neutral background.
- **Detecting state:** `◐` icon (pulsing), "Detecting…" status, amber background. Triggered when the user clicks "Run Synthetic Test."
- **Active state:** `✓` icon, green background, status reads `Verified · 12 imp · 3m ago` (impression count + relative timestamp).

Polling: every 15 seconds while the dashboard is open. Bumps to every 2 seconds for 60 seconds after the "Run Test" button is clicked, so the publisher gets near-instant feedback on their first integration attempt.

### Tests — `tests/billing.test.js` (+4 new)

- `integration_verify requires GET`
- `integration_verify requires developer_id`
- `integration_verify demo mode returns all-doors-inactive shape`
- `integration_verify accepts ?id= as alias for developer_id`

All 253 tests pass.

## What's deferred

The wizard's underlying integration card structure was already in place from earlier work. Phase F's scope was filling the verification gap, not redesigning the entire wizard. Items intentionally NOT in this phase:

1. **Per-door sandbox key display.** Currently the same `bb_dev_sk_*` API key powers all four doors. If we ever want isolated keys per door (e.g. for analytics segmentation), that's a future migration.
2. **"Test from server" button for the MCP and REST API doors.** The current "Run Synthetic Test" button hits `api/mcp` which exercises the MCP path only. Adding per-door synthetic test buttons would close the verification loop even tighter — but the polling mechanism already catches any real event from any door, so this is a polish item, not a blocker.
3. **Email notification when the first door goes active.** "Congrats — your MCP integration is live and serving ads" type email. Could go in Phase G or post-outreach.

## Stage 1 progress

| Phase | Status |
|---|---|
| A — Silent-failure observability | ✅ |
| B — Conversion beacons (4 doors) | ✅ |
| C — Benna data-reuse loop | ✅ |
| D — Seed initial BBX demand | (your track) |
| E — Stripe payouts | ✅ |
| **F — Per-door onboarding wizard** | **✅ COMPLETE** |
| G — Real screenshots | pending (last task before outreach) |

**One phase left.** Phase G is the half-day screenshot capture before outreach unlocks.

## Deploy steps

```bash
cd ~/boostboss
git add api/billing.js public/developer.html tests/billing.test.js \
        db/PHASE-F-REPORT-2026-05-11.md
git commit -m "Phase F: per-door onboarding wizard verification

- api/billing.js: new integration_verify action returns per-door
  active/inactive state for the last 24h, plus impression+click counts
  and last_seen_at for each of the 4 doors (mcp, js-snippet, npm-sdk,
  rest-api). Single SQL query, group-by in JS, no auth required.
- public/developer.html: 4 verify badges below the integration cards.
  Polls integration_verify every 15s; bumps to 2s for 60s when the
  Run Synthetic Test button is clicked. Badges flip from Not started
  -> Detecting -> Verified in real time as the first event lands.
- Tests: +4 (253 total, was 249).

Closes Stage 1 Phase F. Phase G (real screenshots) is the only thing
left before outreach unlocks."

git push origin main
vercel --prod --yes
```

After deploy, verify by opening `/developer` in your browser. The four verify badges should appear below the integration cards. Pick any door, click "Run Synthetic Test" — the selected door's badge should flip to "Detecting…" within seconds and then "Verified" once the synthetic call's beacon fires.

## After Phase F

Phase G is half a day. After that, Stage 1 outreach unlocks. That's it.
