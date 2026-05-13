# Phase E.5 — AI Creative Studio — Design Doc

**Status:** awaiting your review before any code lands.

This document settles every decision before implementation. Estimated 5-7 days build once you sign off. Modeled on the Phase E design doc that worked well.

---

## The product vision

When an advertiser creates a campaign in the dashboard today, they fill 8+ form fields manually (headline, subtext, image URL, CTA label, CTA URL, targeting, billing model, budgets). The result is a single creative that renders identically across all 4 doors.

Phase E.5 changes that flow to:

1. Advertiser pastes their product URL
2. System auto-extracts product info (title, description, OG image)
3. AI generates door-tuned copy (different headline for MCP's tool-response surface vs Discord's embed surface)
4. AI generates per-door image variants in the correct aspect ratios (square / wide / sidebar / etc.)
5. Advertiser previews how the ad looks in all 4 doors side-by-side
6. Advertiser can override any door's creative (upload their own image, edit copy)
7. Submit creates the campaign with stored per-door variants

The result: **time-to-first-campaign drops from ~15 minutes of manual creative work to ~2 minutes of paste-and-tweak.**

That matters because:
- Higher campaign-creation conversion rate from advertiser signup → launched campaign
- Better-looking creatives per door (each rendered at native aspect ratio)
- Advertiser doesn't need a designer or agency to produce 4 versions

---

## Decision 1: AI provider choice

Three AI capabilities needed: text generation, image understanding, image generation. Best provider for each:

| Capability | Provider | Model | Cost per call |
|---|---|---|---|
| **Text generation (copy)** | Anthropic | `claude-haiku-4-5-20251001` | ~$0.001 |
| **Image understanding (analyze uploaded image)** | Anthropic | `claude-sonnet-4-6` | ~$0.003 |
| **Image generation** | OpenAI | `dall-e-3` | $0.040–$0.120 per image |

**Reasoning:**

- **Anthropic for text/vision:** you already have the API key in scope. Claude Haiku 4.5 is fast (<2s) and cheap. Same SDK call pattern for both.
- **OpenAI for image gen:** Anthropic doesn't offer image generation. OpenAI's DALL-E 3 is the industry standard at predictable cost. Alternative: Replicate for Stable Diffusion (~$0.005/image but variable quality). Going with DALL-E 3 for predictability.

**Video generation: NOT in scope.** Sora/Pika/Runway are gated, expensive, and not core to ad demos. If a campaign's format is `video`, advertiser must provide their own video URL. We'll auto-derive a poster_url from the first frame using ffmpeg-in-browser OR fall back to a static poster.

**New env var needed:** `OPENAI_API_KEY`. If not set, image generation is disabled and the dashboard shows "Add OPENAI_API_KEY to enable image generation" — the rest of the flow still works (URL autofill + AI copy + manual image upload).

## Decision 2: Per-door creative storage

Today `campaigns` table has one set of fields. Phase E.5 adds a per-door variant store.

### New table: `campaign_creatives` (migration 14)

```sql
CREATE TABLE campaign_creatives (
  id            uuid PRIMARY KEY,
  campaign_id   uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  door          text CHECK (door IN ('mcp', 'js-snippet', 'npm-sdk', 'rest-api', 'default')),
  headline      text,
  subtext       text,
  media_url     text,
  poster_url    text,
  cta_label     text,
  cta_url       text,
  source        text CHECK (source IN ('ai-generated', 'user-uploaded', 'inherited')),
  generation_metadata jsonb,  -- model used, prompt, generated_at, cost_usd
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  UNIQUE (campaign_id, door)
);
```

The `'default'` door row holds the base creative; specific doors only have rows when explicitly overridden.

**Read pattern in auction path:**
```js
// pseudo-code in api/mcp.js eligibility/scoring
const creative = await fetchDoorCreative(campaign_id, integration_method);
// returns the door-specific row OR the 'default' row if no override exists
```

This keeps the auction hot path simple (one extra query per winning campaign — cacheable). Falls back gracefully: if a campaign has zero `campaign_creatives` rows (e.g. legacy campaigns from before Phase E.5), the existing `campaigns.headline`/`media_url`/etc. fields are used.

### Backward compatibility

- Existing campaigns continue to work — their creative comes from `campaigns.headline` etc.
- New campaigns created via Phase E.5 write to both `campaigns.headline` (default) AND `campaign_creatives` rows per door.
- The auction path checks `campaign_creatives` first, falls back to `campaigns.*` columns.

## Decision 3: AI generation cost model

Per campaign:
- 1 Claude Haiku call for product analysis from URL: $0.001
- 4 Claude Haiku calls for door-specific copy (one per door): $0.004
- 4 DALL-E 3 calls for door-specific images (one per door): $0.16-0.48
- **Total per campaign: ~$0.17-0.49**

At 100 campaigns/day during outreach phase: ~$17-49/day, or ~$500-1500/month. Acceptable; if it grows, add credit-limit gates on the action (e.g. max 4 generations per advertiser per day).

**Cost limits in code:**
- Max 1 generation request per campaign per 60 seconds (rate-limit)
- Max 20 generations per advertiser per day (`advertisers.ai_generations_today`, reset daily by existing cron)
- If `OPENAI_API_KEY` env var not set, skip image generation entirely (still offer Claude copy + manual upload)

## Decision 4: UX flow

The advertiser dashboard's create-campaign modal gets restructured into three phases:

### Phase A — Source (top of modal)

```
┌─────────────────────────────────────────────┐
│ Where's your product?                       │
│                                             │
│ 🔗 [https://yourproduct.com______________]  │
│    [✨ Generate ad from URL  →]             │
│                                             │
│ ── or ──                                    │
│                                             │
│ Manually enter creative details below       │
└─────────────────────────────────────────────┘
```

Clicking "Generate ad from URL" fires:
1. Backend fetches URL, parses og: tags + page text
2. Sends content to Claude Haiku → returns `{ headline_general, description, suggested_cta_label }`
3. If `OPENAI_API_KEY` set: queues 4 image gen jobs in parallel for 4 door aspect ratios
4. UI shows skeleton/loading state per door card during gen (~10s for images)
5. Once done, populates form + per-door previews

### Phase B — Per-door preview grid (middle of modal)

```
┌───────────┬───────────┬───────────┬───────────┐
│   MCP     │ JS Snippet│  NPM SDK  │ REST API  │
│  ┌─────┐  │ ┌───────┐ │ ┌───────┐ │ ┌───────┐ │
│  │ img │  │ │  img  │ │ │ side  │ │ │  bot  │ │
│  └─────┘  │ └───────┘ │ │ panel │ │ │ embed │ │
│  headline │ headline  │ └───────┘ │ └───────┘ │
│  subtext  │ subtext   │  ...      │  ...      │
│  CTA →    │  CTA →    │  CTA →    │  CTA →    │
│           │           │           │           │
│ [Edit]    │ [Edit]    │ [Edit]    │ [Edit]    │
└───────────┴───────────┴───────────┴───────────┘
```

Each card shows a live render of how the creative will look on that door. Clicking `[Edit]` opens an inline editor for THAT door's variant (headline / subtext / image upload). Edits override the AI-generated version for that door only.

### Phase C — Targeting + budget (bottom of modal — unchanged from today)

The existing form for intent tokens, billing model, budgets, etc. Stays as-is.

### Form submit

On Launch:
1. Insert `campaigns` row with default creative (door='default')
2. Insert 1 `campaign_creatives` row per door (`default`, `mcp`, `js-snippet`, `npm-sdk`, `rest-api`)
3. If any door was edited by advertiser, that row has `source='user-uploaded'`; otherwise `source='ai-generated'`
4. Standard auto-approval logic per existing campaigns.js

## Decision 5: New API actions

### `POST /api/campaigns?action=fetch_url_preview`

```json
Request: { "url": "https://yourproduct.com" }
Response: {
  "title": "...",          // from <title> or og:title
  "description": "...",    // from og:description or first paragraph
  "image_url": "...",      // from og:image
  "cta_url": "...",        // the URL itself (used as click destination)
  "favicon": "...",
  "raw_text_excerpt": "..."  // first ~500 chars of page body, for AI copy generation
}
```

No AI yet. Just server-side fetch + cheerio/regex parsing of og: tags.

### `POST /api/campaigns?action=ai_generate_copy`

```json
Request: {
  "url": "https://...",
  "raw_text": "...",       // optional, from fetch_url_preview
  "target_door": "mcp" | "js-snippet" | "npm-sdk" | "rest-api"
}
Response: {
  "headline": "Ship NextJS in seconds — Vercel deploys",
  "subtext": "Free tier · GitHub auto-deploy · global edge",
  "cta_label": "Try Free",
  "model_version": "claude-haiku-4-5-20251001",
  "cost_usd": 0.0012,
  "generated_at": "2026-05-11T..."
}
```

Door-specific because:
- **MCP** has limited rendering space (terse, "— Sponsored —" prefix)
- **JS Snippet** banners are wide, can have longer subtext
- **NPM SDK** sidebar is narrow, needs very short text
- **REST API** for Discord/Telegram needs platform-native phrasing

The prompt to Claude Haiku includes door-specific length constraints + format guidelines.

### `POST /api/campaigns?action=ai_generate_image`

```json
Request: {
  "prompt": "...",         // generated from product info
  "door": "mcp" | "js-snippet" | "npm-sdk" | "rest-api"
}
Response: {
  "image_url": "https://...",   // hosted Supabase Storage URL
  "aspect_ratio": "1:1" | "16:9" | "9:16",
  "size": "1024x1024" | "1792x1024" | "1024x1792",
  "model_version": "dall-e-3",
  "cost_usd": 0.04,
  "generated_at": "2026-05-11T..."
}
```

Per-door aspect ratios:
- `mcp`: 1024×1024 (square, fits in tool-response block)
- `js-snippet`: 1792×1024 (wide banner)
- `npm-sdk`: 1024×1792 (tall sidebar)
- `rest-api`: 1024×1024 (square, works on Discord/Slack/Telegram)

DALL-E 3 returns a URL; we download it server-side and upload to Supabase Storage (`campaign-creatives` bucket, public-read). This avoids OpenAI's URL expiration.

### `POST /api/campaigns?action=upload_creative`

```json
Request: { multipart form with image, target_door }
Response: { image_url, size }
```

For when the advertiser uploads their own image to override AI. Stored in Supabase Storage same bucket.

## Decision 6: Auction-path read

Currently `api/mcp.js` returns creative fields from `campaigns` table directly. After Phase E.5:

```js
// pseudo-code
const creative = await sb.from("campaign_creatives")
  .select("headline, subtext, media_url, poster_url, cta_label, cta_url")
  .eq("campaign_id", winner.id)
  .in("door", [integration_method, "default"])
  .order("door", { ascending: false })   // prefer door-specific over default
  .limit(1)
  .single();

if (!creative) {
  // legacy campaign, fall back to campaigns.* columns
  creative = winner;  // already has headline/subtext/etc. from earlier query
}
```

One extra query per winning campaign. Cacheable (5-minute TTL on winner's creative) so the hot path isn't materially affected.

## Decision 7: Auth + rate limits on AI actions

- All `ai_generate_*` actions require `Authorization: Bearer ${advertiser_session_token}`
- Per-advertiser daily limit: 20 generations (configurable)
- Per-IP per-minute rate limit: 5 calls
- Cost tracking: each generation increments `advertisers.ai_generations_today` and logs cost to a new `ai_generations` table for monthly billing reconciliation

## Decision 8: Test mode / dev fallback

If `OPENAI_API_KEY` is unset:
- `ai_generate_image` returns a stock placeholder image with the door's aspect ratio
- Dashboard shows banner: "AI image generation disabled — set OPENAI_API_KEY in Vercel env"
- Everything else continues to work

If `ANTHROPIC_API_KEY` is unset:
- `ai_generate_copy` returns a templated copy based on the URL's og: tags (no AI augmentation)
- Dashboard shows banner: "AI copy assist disabled — set ANTHROPIC_API_KEY in Vercel env"

Goal: feature degrades gracefully so deploys never hard-fail just because a key is missing.

---

## Day-by-day build plan

### Day 1 — URL ingestion + 4-door preview foundation (~4-6h)
- `POST /api/campaigns?action=fetch_url_preview` backend
- Advertiser dashboard: add URL input + autofill flow
- 4-door preview grid (CSS-only mockups, no AI yet)
- Tests for URL fetch (mock fetch + assert og: parsing)
- **Lands working incremental value:** advertisers can now autofill from URL

### Day 2 — AI copy generation (~4-6h)
- `POST /api/campaigns?action=ai_generate_copy` backend
- Claude Haiku integration via `@anthropic-ai/sdk` npm package
- Per-door prompts (length + tone constraints)
- Hook into dashboard "✨ Generate copy" button
- Tests for the action (mock Anthropic response)
- **Lands working:** AI-generated headlines per door

### Day 3 — AI image generation (~6-8h)
- `POST /api/campaigns?action=ai_generate_image` backend
- OpenAI DALL-E 3 integration
- Supabase Storage bucket setup (`campaign-creatives`, public-read)
- Download from OpenAI URL → upload to Supabase Storage
- Per-door aspect ratio handling
- Tests
- **Lands working:** AI-generated images per door

### Day 4 — Schema migration + per-door override storage (~4-6h)
- Migration 14: `campaign_creatives` table + indexes
- Migration 14: `ai_generations` audit log table
- Update `api/campaigns.js` create + update to write `campaign_creatives` rows
- Update `api/mcp.js` auction path to read door-specific creative
- Backward-compat tests (legacy campaigns still serve correctly)
- **Lands working:** per-door variants stored and served correctly

### Day 5 — Creative Studio UI: full integration (~6-8h)
- Restructure create-campaign modal into 3 phases (Source / Preview / Targeting)
- Wire AI generate buttons to the new actions
- Per-door card editor: inline edit + upload override
- Loading states + error handling
- **Lands working:** full advertiser flow end-to-end

### Day 6 — Polish + edge cases (~4-6h)
- Cost tracking + rate-limit enforcement
- Per-advertiser daily generation cap
- Error messages when keys aren't set
- Empty-state when URL fetch fails (paywall, redirect, etc.)
- Loading skeletons
- **Lands working:** polished, production-ready

### Day 7 — Tests + report + commit (~2-4h)
- Full test suite update (~10-15 new tests expected)
- Phase E.5 closing report
- Commit + deploy
- **Lands:** Phase E.5 complete

**Total estimate: 30-44 hours of focused work, ≈ 5-7 days.**

---

## What I need from you to start

Before Day 1 begins, I need:

1. **Confirm API keys** — do you have these on Vercel already?
   - `ANTHROPIC_API_KEY` — required for copy generation
   - `OPENAI_API_KEY` — required for image generation
   - If either is missing, the build still ships, just with that feature degraded.

2. **Supabase Storage bucket** — I'll create the `campaign-creatives` bucket via SQL in migration 14 BUT you may need to enable Storage in your Supabase project (Settings → Storage) if it isn't already.

3. **Sign off on the design** — anything in this doc that should change before code starts? Most likely candidates:
   - **Per-door aspect ratios** — are the 4 sizes I chose right? (Square / Wide / Tall / Square)
   - **Cost limits** — is $0.17-0.49 per generated campaign acceptable, or should I cap generation harder?
   - **Schema** — does `campaign_creatives` look right, or do you prefer JSONB columns on the existing `campaigns` table?
   - **Defer anything** — is video gen really out of scope, or should we try to wire in a basic poster-from-image step?

Reply with:
- API key status (have / don't have)
- Sign-off / changes on the design
- "ship Day 1" when ready

---

## What this doesn't do

Calling out scope boundaries:

- **No video generation.** If campaign format is `video`, advertiser uploads their own.
- **No multi-language copy generation.** Phase E.5 generates English only. International expansion is post-launch.
- **No A/B variant generation.** One generation = one creative per door. A/B testing comes later.
- **No persistent AI cost dashboard for advertisers.** They see "you've used X of 20 generations today" but don't see per-call costs.
- **No image editing.** Advertiser can override with upload but can't crop/filter/adjust generated images in-product.

These are all reasonable Phase 2 features. Phase E.5 ships the core feature: "paste URL → get a 4-door ad campaign in 2 minutes."
