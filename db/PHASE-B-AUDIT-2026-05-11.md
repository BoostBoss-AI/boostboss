# Phase B — Conversion Beacon Audit

Date: 2026-05-11
Scope: every door + advertiser-side config + recon endpoint + docs.

## Backend (api/track.js)

✅ Already accepts `event=conversion` (line 147). Whitelisted alongside impression/click/etc.
✅ Already populates `conversion_type`, `value_cents`, `external_id`, `currency` columns when event === "conversion" (lines 226–231).
✅ Migration 05 (db/05_bbx_conversions.sql) added these columns + relaxed the events.event_type CHECK to allow 'conversion'. Already applied (recorded in bbx_schema_migrations).
✅ Idempotency via (auction_id, event_type) unique partial index applies to conversions too — same path as impressions/clicks.
⚠️ Conversions skip the campaign_id existence check (line 165 only validates impression/click/video_complete). This is correct — conversions can land late, but it means we can't flag "conversion for a deleted campaign" today.
⚠️ Conversions never carry an `integration_method` tag in practice. The pixel doesn't set one. Conversions arrive from the advertiser's website, not the publisher's surface, so attributing them to a door is awkward — but we COULD inherit the integration_method from the original impression's auction_id.

## Door 1 — MCP (api/mcp.js + sdk/lumi-mcp)

**Server-side (api/mcp.js track_event tool):**
❌ The `track_event` JSON-RPC tool **explicitly excludes conversion**. Schema enum at line 233: `enum: ["impression", "click", "close", "video_complete", "skip"]`. No "conversion" in the list. Means MCP host operators cannot fire conversions through the official tool.
❌ Even if the schema allowed it, the tool would forward to api/track.js which currently rejects all events not from a real campaign for sandbox=false … wait, conversions skip that check. So actually the MCP track_event would work IF we added "conversion" to the enum.

**Client-side (sdk/lumi-mcp/src/index.ts):**
❌ No `trackConversion()` method. SDK has trackImpression() and trackClick() only.

**Gap:** Door 1 has zero conversion firing capability today.

## Door 2 — JS Snippet (public/lumi.js)

❌ `window.Lumi` exposes: refresh, destroy, render, getLastError, setDebug, _state, version. **No trackConversion.**

**However** — `public/pixel.js` IS the conversion-firing snippet for advertisers. It's a SEPARATE script (data-advertiser-id="adv_xxx") that the *advertiser* installs on their landing/thank-you page, not the *publisher*. It uses `bbq.push(['track', 'signup', { value, currency, external_id }])`. Reads `bbx_auc` + `bbx_cmp` from URL/sessionStorage and POSTs to /api/track.

So the architecture is:
- public/lumi.js → publisher's site → fires impression/click beacons
- public/pixel.js → advertiser's site → fires conversion beacons

This is correct for web. Conversions originate from where the user converts, which is the advertiser's site, not the publisher's site. ✅

**But** — for parity with the standardized API the user requested ("window.Lumi.trackConversion"), the publisher-side lumi.js SHOULD also expose a programmatic conversion API for cases where the conversion event happens inside the publisher's surface (e.g., a webapp where signup happens in the same page that hosted the ad). It would just call the same /api/track endpoint with event=conversion.

**Gap:** publisher-side `window.Lumi.trackConversion()` doesn't exist. Pixel.js path exists for the more common advertiser-side case.

## Door 3 — NPM SDK (sdk/lumi-sdk/src/lumi.ts)

❌ `Lumi` class has: render, refresh, destroy, on, off, getSessionId, primeStyles. **No trackConversion.**

Same reasoning as Door 2 — most conversions happen on the advertiser's side, not the publisher's. But for in-app surfaces (Electron, browser extension popup), the publisher-side conversion path is meaningful.

**Gap:** `lumi.trackConversion()` method doesn't exist.

## Door 4 — REST API (advertiser/integrator side)

**Documented** in public/docs-api-reference.html (line 1032: "Conversion beacon"). Spec says POST with auction_id + conversion_type + value + currency.

**Implementation:** Goes through the same /api/track endpoint via POST with `event: "conversion"`. ✅
But:
❌ The dedicated `/v1/beacon/conversion` route the user requested doesn't exist. Today everything goes through /api/track.

**Gap:** Path naming. Functionally REST API conversion firing works via /api/track.

## Advertiser-side conversion configuration

**Existing** (campaigns table):
✅ `billing_model` column exists with CHECK in ('cpm', 'cpc', 'cpv'). **CPA is NOT in the allowed list.**
✅ `target_cpa` column exists (numeric(8,2)) — used by Benna for optimization, not as a billing model.
✅ `optimization_goal` column exists (default 'target_cpa').
❌ No `conversion_event` config — campaigns can't say "what counts as a conversion for this campaign". The pixel takes a `conversionType` arg from the advertiser's code at fire time, but the campaign itself doesn't declare what types it cares about.
❌ No CPA billing — only CPM/CPC/CPV. Adding CPA means: when a conversion event lands, charge `bid_amount` instead of impression-based pricing.

**Gap:** Need (a) CPA in billing_model enum, (b) conversion_event_types column on campaigns (array of strings like ['signup', 'purchase']).

## Recon endpoint (api/stats.js)

✅ Phase A added type=recon comparing auction_wins to impressions.
❌ No conversion_ratio yet. Needs an impression-vs-conversion ratio (or a conversion-vs-click ratio — CVR is more standard).

**Gap:** Recon doesn't track conversion firing health.

## Docs

✅ public/docs-api-reference.html has a Conversion section.
❌ docs-mcp.html, docs-js-snippet.html, docs-npm-sdk.html have ZERO conversion content. Just impression/click stuff.
❌ docs-rest-api.html — let me check.

(Verified via grep: only docs-api-reference.html mentions "conversion".)

**Gap:** 4 of 5 doc pages need conversion sections.

## Tests

❌ Zero conversion test coverage in tests/track.test.js. 22 track tests, none for conversion event type.

**Gap:** Need tests that fire event=conversion through /api/track and confirm it lands with the right columns.

---

## Summary of work needed

| Item | Door | What | Effort |
|------|------|------|--------|
| 1 | Door 1 | Add 'conversion' to MCP track_event enum + forward conversion fields | XS |
| 2 | Door 1 | Add `trackConversion()` to lumi-mcp SDK | XS |
| 3 | Door 2 | Add `window.Lumi.trackConversion()` to public/lumi.js | S |
| 4 | Door 3 | Add `lumi.trackConversion()` to lumi-sdk Lumi class | S |
| 5 | Door 4 | Document conversion via /api/track in docs-rest-api.html (already works) | XS |
| 6 | Backend | Inherit integration_method from auction_id when conversion fires | S |
| 7 | Adv-side | Add CPA to billing_model enum, add conversion_event_types column, surface in advertiser dashboard campaign creation | M |
| 8 | Recon | Extend /api/stats?type=recon with click→conversion ratio (CVR) | S |
| 9 | Docs | Add Conversion tracking section to docs-mcp / docs-js-snippet / docs-npm-sdk / docs-rest-api | M |
| 10 | Tests | Add conversion firing tests to tests/track.test.js | S |
| 11 | Validation | E2E: fire conversion through each door, verify dashboard reflects | S |

Total: ~2 days of focused work.
