# Phase G — Screenshot Capture Script

A step-by-step you can follow when you have ~30 minutes to capture. Each session covers one door and yields 2 screenshots (hero + product). Total: 4 sessions × 2 screenshots = 8 files.

**Save location:** `~/boostboss/public/assets/publish/`
**Format:** PNG
**Filename pattern:** `{door}-hero.png` and `{door}-product.png`

After saving any file, refresh `https://boostboss.ai/publish/{door}` — your screenshot replaces the SVG automatically. No code changes, no deploy needed if the file is in the `public/` folder before next deploy.

---

## Session 1 — MCP door (15 min)

**Goal:** show Claude Desktop / Cursor / Cline rendering a sponsored block inside a real tool response.

**Setup options (pick the easiest):**

### Path A — Cursor with your test MCP server

If you already have a Lumi-MCP integration running in a test MCP server:

1. Open Cursor
2. Start a fresh chat session
3. Send a prompt that triggers your MCP tool (e.g. "Help me deploy my FastAPI app" if your test server has a `deploy_helper` tool)
4. Watch the tool fire → your normal tool result renders → the `— Sponsored —` block appears below
5. **Cmd+Shift+4** → drag across the chat area. Include user prompt + assistant response + tool result + sponsored block. Crop out Cursor's sidebar if it's distracting.
6. Save as `~/boostboss/public/assets/publish/mcp-hero.png`

### Path B — Claude Desktop with `@boostbossai/lumi-mcp` test config

If you have Claude Desktop set up with a local MCP server using Lumi:

1. Open Claude Desktop
2. Same flow as above — trigger a tool that uses Lumi
3. Capture the full conversation
4. Save as `mcp-hero.png`

### Path C — Synthesized (Stripe-doc style)

If you don't have a working live MCP integration handy and don't want to set one up just for screenshots:

1. Open `https://boostboss.ai/test/lumi-snippet-test` in browser to copy the visual style of the sponsored block
2. Mock up the conversation in any chat-style UI you have (or just use the screenshot of Cursor with a test MCP from the project's `examples/` folder)
3. Save as `mcp-hero.png`

**For the product shot (`mcp-product.png`):** take a tighter crop of the same screenshot — focus on just the sponsored block in its tool-response context. Save as `~/boostboss/public/assets/publish/mcp-product.png`.

---

## Session 2 — Bots door (5 min — you have this already)

**Goal:** Telegram bot conversation with sponsored card.

**Path A — Your existing Day 4 validation screenshot**

1. Find the Telegram screenshot from Door 4 validation (sandbox Stripe Atlas ad served by your test bot)
2. Crop to show: user message at top → bot's normal reply → sponsored card below
3. Save as `~/boostboss/public/assets/publish/bots-hero.png`

**Path B — Capture fresh**

1. Open Telegram on your phone (or desktop Telegram for cleaner UI)
2. Open the chat with your sandbox test bot
3. Send a query: e.g. "what's the best way to deploy a Next.js app?"
4. Wait for bot's reply + sponsored card
5. Screenshot phone with screen recording OR Cmd+Shift+4 on desktop Telegram
6. Save as `bots-hero.png`

**For the product shot (`bots-product.png`):** Either:
- Same image cropped tighter on the sponsored card itself, OR
- A composite showing the same sponsored card on Discord + Telegram + Slack side by side (matches the existing SVG mockup's layout)

Save as `~/boostboss/public/assets/publish/bots-product.png`.

---

## Session 3 — AI Apps door (5 min — you have this already)

**Goal:** an AI app builder UI with a sponsored card inline.

**Path A — Your existing Day 5 Test AI Chat screenshot**

1. Find the Day 5 screenshot of the "Test AI Chat" publisher page showing the sidebar layout + inline Stripe Atlas sandbox card
2. Crop to show the chat area + sponsored card in its inline position
3. Save as `~/boostboss/public/assets/publish/ai-apps-hero.png`

**Path B — Fresh capture using the smoke test page**

1. Open `https://boostboss.ai/test/lumi-snippet-test` in browser
2. Page mounts Lumi automatically; ad renders within 1-2 seconds
3. Cmd+Shift+4, capture the chat area + sponsored block + dashboard chrome
4. Save as `ai-apps-hero.png`

**For the product shot:** tighter crop on just the inline sponsored card. Save as `ai-apps-product.png`.

---

## Session 4 — Extensions door (10 min)

**Goal:** Chrome side panel extension with sponsored block at bottom.

**Path A — Your existing Day 5 Article AI screenshot**

1. Find the Day 5 Article AI Summarizer screenshot with the pin icon (looked like Chrome side panel)
2. If it includes the sponsored card at the bottom, perfect
3. Save as `~/boostboss/public/assets/publish/extensions-hero.png`

**Path B — Use the project's example extension**

1. Open Chrome → `chrome://extensions/`
2. Toggle Developer Mode on (top right)
3. Click "Load unpacked" → select `~/boostboss/sdk/lumi-sdk/example-extension/`
4. Extension loads. Click its icon in the toolbar → opens side panel
5. Side panel shows your test content + a sponsored block at the bottom
6. Cmd+Shift+4, capture the full side panel
7. Save as `extensions-hero.png`

**Path C — Mock-up**

1. Take a screenshot of any Chrome side panel extension you actually use (e.g., a notes extension, dictionary, etc.)
2. Combine with the sponsored card image you captured in Session 3 to mock up "extension with sponsored card"
3. Save as `extensions-hero.png`

**For the product shot:** tighter crop on the sponsored block portion of the side panel. Save as `extensions-product.png`.

---

## After capturing — verification

After saving each file:

```bash
# Verify the file is there:
ls -la ~/boostboss/public/assets/publish/

# Should list all your captured PNGs
```

After all 8 (or however many you have), deploy:

```bash
cd ~/boostboss
git add public/assets/publish/*.png
git commit -m "Phase G: real screenshots for /publish/* hero + product slots"
git push origin main
vercel --prod --yes
```

Then visit each page:
- https://boostboss.ai/publish/mcp
- https://boostboss.ai/publish/ai-apps
- https://boostboss.ai/publish/bots
- https://boostboss.ai/publish/extensions

Each page should now show your screenshots where the SVG mockups used to be. Pages with missing screenshots gracefully fall back to the SVG.

---

## Tips

- **Use 2x retina (Cmd+Shift+4 default on Mac is already retina).** Screenshots scale down better than they scale up.
- **No personal data in shots.** No real email addresses, real names, real card numbers. Use the sandbox / test fixtures.
- **Crop tight.** Don't include your Mac menu bar, dock, or browser bookmark bar unless they add context.
- **Light vs dark mode.** Pick one and stick with it. The site UI is light, so light-mode screenshots blend better.
- **You can iterate.** Replace any screenshot any time by overwriting the file + redeploying. No code changes ever needed.

---

## When you're done

When all 8 PNGs are deployed and rendering, ping me with "screenshots live" and I'll mark Phase G fully complete in the task tracker. Then live-key flip + outreach are the only items left in your queue.
