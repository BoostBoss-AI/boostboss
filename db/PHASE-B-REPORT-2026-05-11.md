# Phase B — Conversion Beacon Completeness — Report

Date: 2026-05-11
Status: ✅ Shipped (pending deploy + DB migration).
Tests: 189 passing (was 183, +6 for conversion firing).

## What landed

### 1. Standardized conversion API across all 4 doors

| Door | API surface | File | Notes |
|------|-------------|------|-------|
| 1 — MCP server-side | `lumi.trackConversion(ad, { type, value?, currency?, externalId? })` | `sdk/lumi-mcp/src/index.ts` | New method on `LumiMCP`; fires through MCP `track_event` JSON-RPC |
| 1 — MCP JSON-RPC | `tools/call track_event { event: "conversion", ... }` | `api/mcp.js` | Added `"conversion"` to event enum + plumbed conversion_type/value/currency/external_id args |
| 2 — JS Snippet | `window.Lumi.trackConversion({ type, value?, slot?, externalId? })` | `public/lumi.js` | New; auto-resolves adId/auctionId from most recent slot |
| 3 — NPM SDK | `lumi.trackConversion({ type, value?, slot?, externalId? })` | `sdk/lumi-sdk/src/lumi.ts` | New method on Lumi class; same auto-resolution |
| 4 — REST API | `POST /api/track { event: "conversion", ... }` | `api/track.js` | Already worked; now documented |
| Adv-side pixel | `bbq.push(['track', conversionType, props])` | `public/pixel.js` | Already worked; unchanged |

Wire shape is consistent across all 4 doors: `{ type, value, currency, externalId, auctionId?, campaignId }`. value is USD dollars; backend converts to cents for storage.

### 2. Events pipeline

`api/track.js` already handled `event=conversion` — but two gaps were closed:

- **integration_method inheritance**: when a conversion event arrives, we look up the originating auction's impression and inherit its `integration_method` (and `is_sandbox` flag). Before this fix, conversions fired from advertiser-side pixel.js would always have `integration_method=null`, breaking per-door slice queries.
- **CPA billing path**: when `billing_model='cpa'` AND the conversion_type matches `campaigns.conversion_event_types[]`, we charge `bid_amount` per conversion and increment campaign spend. Auto-pause on budget exhaustion works identically to CPM/CPC.

### 3. Advertiser-side configuration

- Added `cpa` to `campaigns.billing_model` CHECK constraint (migration 11).
- Added `campaigns.conversion_event_types text[]` column (migration 11).
- Advertiser dashboard: added "CPA" radio option + "Conversion event types" CSV input. Auto-shows when CPA billing OR target_cpa/target_roas/max_conversions optimization selected. CSV-serialized to array on submit, restored on edit.

### 4. Docs

Added Conversion tracking sections to:
- `public/docs-mcp.html` — `lumi.trackConversion(ad, conversion)` reference
- `public/docs-js-snippet.html` — `Lumi.trackConversion()` reference + advertiser-side pixel.js callout
- `public/docs-npm-sdk.html` — `lumi.trackConversion()` reference
- `public/docs-rest-api.html` — POST /api/track conversion shape + curl example

`public/docs-api-reference.html` already had the canonical conversion beacon spec.

### 5. Recon endpoint extension

`/api/stats?type=recon` now also returns:

```json
{
  "production": {
    "auction_wins": N, "impressions": N,
    "clicks": N, "conversions": N,        // NEW
    "ratio": <imp/wins>,
    "cvr":   <conv/clicks>,                // NEW
    "alert": <bool>
  },
  "sandbox": { ...same shape... }
}
```

Click and conversion counts are now diagnostic alongside the existing impression-vs-wins ratio. CVR is published but doesn't trigger alerts (most sessions won't have conversions yet — alerting would be noisy until volume builds).

### 6. Tests

Added 6 conversion-firing tests to `tests/track.test.js`:
- conversion event accepted with all required fields
- conversion_type/value_cents/external_id populated correctly
- value_micros input converts to value_cents
- non-conversion events leave conversion fields null
- integration_method inheritance via X-Lumi-Source header
- conversion via GET pixel beacon returns image

All 189 tests pass.

## Per-door verdict

| Door | Pre-Phase-B | Post-Phase-B |
|------|-------------|--------------|
| 1 — MCP | ❌ track_event schema excluded conversion; SDK had no trackConversion | ✅ Both fixed |
| 2 — JS Snippet | ❌ window.Lumi had no trackConversion (advertiser-side pixel.js existed) | ✅ Added |
| 3 — NPM SDK | ❌ Lumi class had no trackConversion | ✅ Added |
| 4 — REST API | ✅ POST /api/track event=conversion already worked | ✅ Now documented |

## What's still open

- **Migration 11 not applied to prod yet** — needs to be run via Supabase SQL Editor before CPA billing actually works.
- **CPA in Benna scoring**: Benna optimization already considers `target_cpa` for bid pacing but doesn't yet read `conversion_event_types` to filter which conversions count for that optimization. Not a Phase B blocker — Benna is still a deterministic stub, real learning is gated on volume per project_instructions.
- **Live validation through each door**: can't fire test conversions through real publishers until Phase E (Stripe live keys) lets us complete the financial loop. The shape is unit-tested; full E2E lives in Phase E's validation pass.

## Deploy steps (in order)

1. **Apply migration 11 in Supabase SQL Editor**: paste `db/11_conversion_config.sql`, run. Then run `db/check.sql` to confirm all 13 migrations show "applied".
2. **Commit + push** the Phase B code (see end of file for exact block).
3. **Wait for Vercel deploy** to flip from Building → Ready with Current.
4. **Smoke check** the live endpoint:
   ```
   curl -sS "https://boostboss.ai/api/stats?type=recon" | jq
   ```
   Confirm new fields `clicks`, `conversions`, `cvr` appear in both `production` and `sandbox` blocks.
5. **Smoke check** the docs render: open `https://boostboss.ai/docs-mcp#trackConversion` and verify the section appears.

## Deploy commands

```bash
cd ~/boostboss
git add api/track.js api/stats.js api/mcp.js api/campaigns.js \
        sdk/lumi-sdk/src/lumi.ts sdk/lumi-mcp/src/index.ts \
        public/lumi.js public/advertiser.html \
        public/docs-mcp.html public/docs-js-snippet.html \
        public/docs-npm-sdk.html public/docs-rest-api.html \
        tests/track.test.js \
        db/11_conversion_config.sql \
        db/PHASE-B-AUDIT-2026-05-11.md \
        db/PHASE-B-REPORT-2026-05-11.md
git commit -m "Phase B: conversion beacon completeness across all 4 doors

- MCP: added 'conversion' to track_event enum + conversion_type/value
  args; LumiMCP.trackConversion(ad, conversion) on the SDK
- JS Snippet: window.Lumi.trackConversion({ type, value, slot? })
- NPM SDK: lumi.trackConversion({ type, value, slot? }) on Lumi class
- REST API: documented POST /api/track event=conversion (already worked)
- track.js: inherit integration_method + is_sandbox from originating
  auction when firing conversion. Closes the per-door slice gap.
- track.js: CPA billing path — charge bid_amount when conversion_type
  matches campaigns.conversion_event_types[] allowlist
- campaigns.js + advertiser.html: CPA radio + conversion event types CSV
- stats.js (recon): now returns clicks, conversions, cvr alongside ratio
- db/11_conversion_config.sql: adds 'cpa' to billing_model CHECK +
  campaigns.conversion_event_types text[]
- Docs: Conversion tracking section on all 4 door docs pages
- Tests: 6 new conversion-firing tests (189 total passing, was 183)"

git push origin main
```

After push, manually verify Vercel auto-deploys. If the webhook is broken again (it's been flaky — task #63), fall back to:
```bash
vercel --prod
```

Don't move to Phase E until: migration 11 applied + Vercel deploy Ready + recon endpoint shows new fields.
