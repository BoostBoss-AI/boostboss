# Phase G — Screenshot Capture Specification

**Status:** Capture-ready. The HTML is pre-wired with graceful fallback — drop screenshots into `~/boostboss/public/assets/publish/` and they appear automatically.

## How the wiring works

Every product mockup on the four `/publish/*` pages now has this structure:

```html
<div class="hero-mockup-wrap">
  <img class="hero-mockup-real" src="/assets/publish/{filename}.png"
       onload="this.parentElement.classList.add('has-real-img')"
       onerror="this.remove()">
  <svg ...>  <!-- original SVG mockup -->
</div>
```

CSS rule: if the img loads successfully, `.has-real-img` class is added to the wrapper, hiding the SVG and showing the img. If the img 404s, the onerror handler removes the img element and the SVG continues to render.

**Net effect:** drop a real screenshot into `~/boostboss/public/assets/publish/` with the right filename, the page picks it up on next visit. No code changes, no deploy required IF the asset folder is included in the deploy. (And it is — Vercel serves anything under `public/` automatically.)

If you only have 2 of the 8 screenshots ready, that's fine. The 2 with real screenshots will show photos; the other 6 keep the SVG mockups. No mixed-state UI weirdness.

---

## What to capture

Eight screenshots total — 2 per door (one "hero/animation" stage shot, one "product shot" focus shot). All saved as PNG into `~/boostboss/public/assets/publish/`.

### Door 1 — MCP

#### `mcp-hero.png`

**Where it appears:** `/publish/mcp` → "See it appear" section (animated stage at the top).
**Surface to capture:** Claude Desktop (or Cursor / Cline) showing a complete conversation where the user asks a question, the assistant calls a tool, the tool result renders, AND a "— Sponsored —" block appears beneath.
**Recommended dimensions:** 1520×880 (matches the SVG's 760×440 viewBox at 2x retina). Crop tight to the chat area; minimal Mac chrome.
**Show:** user prompt at top, assistant's tool call indicator, tool result block, sponsored block below.

#### `mcp-product.png`

**Where it appears:** `/publish/mcp` → integration snippet section (static product shot below the code).
**Surface:** Same flow as `mcp-hero.png` but a CLEAN screenshot of Claude Desktop's UI without animation framing — show the sponsored block in its natural position within a tool response.
**Recommended dimensions:** 1440×880 (matches SVG's 720×440 viewBox at 2x).

### Door 2 — Bots

#### `bots-hero.png`

**Where it appears:** `/publish/bots` → "See it appear" section.
**Surface:** A Telegram chat with your test bot. Show: user message, bot's reply, then the sponsored card directly beneath. Use a real phone screenshot OR a desktop Telegram screenshot framed in a phone bezel mockup.
**Recommended dimensions:** 1520×880, or use Telegram's typical phone aspect ratio (~9:16) and let the page CSS handle scaling.
**You already have this from Day 4 / Telegram validation.** Find the screenshot of your test bot serving the [Sandbox] Stripe Atlas ad. Crop to show the user query → bot reply → sponsored card sequence.

#### `bots-product.png`

**Where it appears:** `/publish/bots` → static product shot.
**Surface:** Same Telegram sequence, OR a side-by-side composite showing the same sponsored card rendered on Discord, Slack, AND Telegram. The SVG mockup shows three platforms; matching that compositionally would be ideal.
**Recommended dimensions:** 1440×880.

### Door 3 — AI Apps

#### `ai-apps-hero.png`

**Where it appears:** `/publish/ai-apps` → "See it appear" section.
**Surface:** An AI-app builder UI (Lovable, Bolt, v0, Cursor's AI panel, Claude Desktop in agentic mode, etc.) with a sponsored card rendered inline in the conversation/output area.
**You already have this from Day 5.** The screenshot showing "Test AI Chat" with the sidebar layout serving a [Sandbox] Stripe Atlas card — use that. Crop to the chat area.
**Recommended dimensions:** 1520×880.

#### `ai-apps-product.png`

**Where it appears:** `/publish/ai-apps` → static product shot.
**Surface:** Clean version of the same AI-app surface, focus on the sponsored card itself.
**Recommended dimensions:** 1440×880.

### Door 4 — Extensions

#### `extensions-hero.png`

**Where it appears:** `/publish/extensions` → "See it appear" section.
**Surface:** Chrome side panel (Manifest v3 sidePanel API) showing your extension's UI with a sponsored block at the bottom. Could be a docs reader extension, a translation extension, a notes extension — anything that uses the side panel.
**You partially have this from Day 5.** The Article AI Summarizer screenshot (Door 3 validation) with the pin/close X looked like a side panel — that could work.
**Recommended dimensions:** Phone-portrait ratio works (the side panel is narrow); ~600×800 or larger.

#### `extensions-product.png`

**Where it appears:** `/publish/extensions` → static product shot.
**Surface:** Same Chrome side panel, cleaner crop on the sponsored block itself.
**Recommended dimensions:** 1440×880 (or match the SVG mockup's 720×440 viewBox).

---

## Quick-capture procedure

For each screenshot:

1. **Set up the surface.** Use your test publisher account (`pub_test_demo` or your real test publisher) so the rendered ad is a sandbox creative — no real advertiser data leaks.
2. **Capture with macOS Cmd+Shift+4.** Drag to select the area; Spacebar to switch to window-mode if you want a window's shadow included.
3. **Save with the exact filename listed above.** PNG format.
4. **Move into `~/boostboss/public/assets/publish/`.**
5. **Verify locally** by visiting `https://boostboss.ai/publish/{door}` after deploy — the new screenshot should replace the SVG.

---

## Recommended capture order

Start with the ones you already have material for:

1. **`bots-hero.png`** — find your Day 4 Telegram bot screenshot
2. **`ai-apps-hero.png`** — find your Day 5 Test AI Chat screenshot
3. **`extensions-hero.png`** — find your Day 5 Article AI side panel screenshot
4. **`mcp-hero.png`** — capture fresh (Claude Desktop + your test MCP server with Lumi installed)

Then the four `*-product.png` companions can be cropped tighter versions of the hero shots, OR fresh captures with different framing.

---

## Deploy

Once the screenshots are saved into `~/boostboss/public/assets/publish/`:

```bash
cd ~/boostboss
git add public/assets/publish/*.png
git commit -m "Phase G: real screenshots for /publish/* pages"
git push origin main
vercel --prod --yes
```

After deploy, refresh `/publish/mcp` (or any of the four pages). The SVG mockups should be replaced by your photos. If a particular screenshot doesn't render but you expect it to, check:

- Filename exactly matches what's in the HTML (`mcp-hero.png` not `mcp_hero.png` or `mcp-hero.PNG`)
- File is under `public/assets/publish/` (Vercel serves it at `/assets/publish/<filename>`)
- File is committed AND deployed (check the URL directly: `https://boostboss.ai/assets/publish/mcp-hero.png`)

---

## Sign-off

When all 8 screenshots are live and rendering on the pages, Stage 1 outreach is unlocked.

The marketing site visually communicates exactly what publishers will get when they integrate. No more "trust the SVG mockup" — every door shows the real product in its native environment.

This is the LAST thing between you and Stage 1 outreach.
