# Phase E.5 — Per-Door Creative Authoring — Closing Report

**Date:** 2026-05-13
**Scope:** Option B (no AI; URL autofill + 4-door CSS preview + per-door copy override)
**Status:** Built, tested, ready to deploy.

---

## What this phase did

Took the create-campaign experience from one rectangle into four. An advertiser now:

1. **Pastes their landing-page URL → autofill** of headline, subtext, image, CTA URL, advertiser domain, and campaign name. No AI — we read OpenGraph + `<meta>` + `<title>` server-side and hand the page's own self-description back to the form.
2. **Sees the same creative rendered in all four doors** at the door-native aspect ratio (MCP 1:1, JS Snippet 16:9, NPM SDK 9:16 mobile-tall, REST API 1:1). Pure CSS `object-fit: cover` does the crop — no image processing, no extra storage, no cost per render.
3. **Edits copy per door** when one door reads differently. An "Edit" button toggles an inline override panel; an "Edited" / "Default" badge on each card surfaces drift at a glance. Empty fields inherit from campaign-level copy.

The auction read path resolves the right creative for each impression: door-specific row when present, falling back to the campaign's `default` row, falling back finally to the legacy `campaigns.*` columns. Existing campaigns keep working unchanged.

---

## Files changed

**New**
- `db/14_per_door_creatives.sql` — `campaign_creatives` table + index + updated_at trigger + RLS + backfill of `default` rows for existing campaigns.

**Modified**
- `api/campaigns.js`
  - New action `fetch_url_preview` (POST) — server-side fetch with SSRF defenses (HTTPS-only, public-DNS-only, 8 KB read cap, 5 s timeout, max 3 redirects); regex-parses og: + name=description + `<title>`.
  - New helpers `normalisePerDoorCreatives` + `upsertCampaignCreatives` — convert advertiser-supplied per-door overrides into rows; always emit a `default` row, only emit door-specific rows when at least one field genuinely differs.
  - `handleCreate` + `handleUpdate` now persist creative rows alongside the campaign.
  - Test exports: `_normalisePerDoorCreatives`, `_handleFetchUrlPreview`.
- `api/mcp.js`
  - New `resolveCampaignCreative(campaign_id, door)` with 60-second in-process cache. Returns the door-specific row if present, else `default`, else `null`.
  - Auction handler now overrides `w.headline / subtext / media_url / poster_url / cta_label / cta_url` from the resolved creative before constructing the JSON-RPC response.
- `public/advertiser.html`
  - URL autofill input + button + status line at top of create-campaign form.
  - Live preview block replaced by a 4-card grid; per-door override panels.
  - New CSS for `.door-card`, `.door-media.aspect-{1x1,16x9,9x16}`, `.door-override`, `.url-autofill`.
  - `handleCreateCampaign` now ships `per_door_creatives` in the request body.
- `tests/campaigns.test.js` — 15 new tests (45 → 60).
- `tests/mcp.test.js` — 3 new tests (18 → 21).

---

## Why this design, not the AI one

Original Phase E.5 spec was a Claude/DALL-E creative studio. Andy collapsed the scope after observing the four doors are different *aspect ratios over the same source image* — the advertiser provides the picture and the description once, and we re-crop and re-position. That's a layout problem, not an inference problem.

Trade-offs we accepted:
- **No image-cropping intelligence.** A 16:9 banner cropped from a 1:1 source can crop a logo in half. The advertiser can paste a different image URL into the per-door override panel if that happens. Acceptable because (a) most landing-page og:image assets are designed wide already, and (b) the cost of being wrong is "ad looks worse on one door", not "ad serves wrong creative".
- **No AI copy variants.** If the advertiser wants door-specific copy they hand-write it. Cheaper to add AI later than to remove it after launch.
- **No image generation.** Same reasoning. The supply side (publishers) doesn't care whether the image was AI-generated or photo-shot.

The result is roughly **$0 marginal cost per campaign** vs. the AI plan's ~$0.18 per campaign for Haiku + DALL-E. At any plausible advertiser volume the savings dwarf the development time we saved by not building the AI layer.

---

## Migration 14 — what to run

Paste `db/14_per_door_creatives.sql` into Supabase SQL Editor. Idempotent — safe to re-run. Creates the table, indexes, trigger, RLS policies, and backfills `default` rows for every existing campaign so the new auction read path has something to find on day one.

**Verification queries** (in the SQL file footer):
```sql
select count(*) from public.campaign_creatives where door = 'default';
-- expect ≥ count of active/in_review campaigns

select * from public.campaign_creatives
 where campaign_id = (select id from public.campaigns limit 1)
   and door in ('mcp','default')
 order by (door = 'mcp') desc
 limit 1;
```

---

## Tests

- `tests/campaigns.test.js` — **60 passing** (+15)
  - `fetch_url_preview` — missing url, non-HTTPS, malformed, SSRF loopback, SSRF RFC1918, og: parse, title-tag fallback, relative og:image resolution, upstream HTTP error.
  - `normalisePerDoorCreatives` — always-default row, empty overrides skipped, real overrides persisted, identical-to-default overrides ignored, full create flow round-trip.
- `tests/mcp.test.js` — **21 passing** (+3)
  - Door-specific override applied when the X-Lumi-Source header matches.
  - Falls back to `default` row when no door-specific override exists.
  - Falls back to legacy `campaigns.*` fields when no creative rows exist at all.

**Full suite — 270 tests passing:**
auth 20 · benna 15 · billing 74 · campaigns 60 · mcp 21 · rtb 33 · sandbox 14 · track 33.

---

## Deploy steps

1. `git add -A && git commit -m "Phase E.5: per-door creative authoring (URL autofill + 4-door preview + overrides)" && git push origin main`
2. Wait for Vercel to deploy and report "Ready".
3. Paste `db/14_per_door_creatives.sql` into Supabase SQL Editor.
4. Verify with the queries in the migration file footer.
5. Smoke-test on production:
   - Open `/advertiser`, log in, click "+ New Campaign".
   - Paste a real landing-page URL (e.g. `https://stripe.com/atlas`), click Fetch — expect autofill within 1-2 seconds.
   - Confirm the 4-door grid renders with the og:image cropped to each aspect.
   - Click Edit on the MCP card, type a different headline, watch the "Default → Edited" badge flip.
   - Submit. Reload the page. The new campaign should appear in the list.

---

## What this unblocks

- **Advertiser conversion.** First-time advertisers were dropping out at the create-campaign form because they had to type six fields blind. URL autofill cuts that to one click.
- **Door coverage.** Today, the same headline runs on all four doors. With per-door overrides, an advertiser whose landing page has an unwieldy `<title>` can shorten it just for the MCP card without affecting the JS snippet banner.
- **Future analytics.** Per-door variant tracking falls out for free — the `campaign_creatives` rows give us a join key for "which copy won on which door". Not yet wired into Benna; can be added later without another migration.

---

## Open follow-ups (not blocking deploy)

- **Door-specific image upload.** Right now per-door override accepts a media URL field but not a re-upload. If we get advertiser feedback that this matters we add file upload to the override panel.
- **Per-door A/B variants.** The existing variant system runs at the campaign level. Stacking it with per-door overrides creates a 2D matrix (door × variant) we deferred.
- **Aspect-ratio mismatch warning.** If the og:image is portrait and the advertiser leaves it for the 16:9 door, the crop hides the bottom half. A simple `<img>`-onload size check could warn here.

---

Next: Phase H Panel 1 design is still awaiting your sign-off in `launch-kit/phase-h-panel-1-live-activity-plan.md` — three Q's at the bottom (health thresholds, sandbox toggle, sidebar entry). Reply "ship Panel 1" + your answers to start that build.
