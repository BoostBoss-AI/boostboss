# Publisher Discovery Channels — Where to Find Each Pool

Reference guide for the four publisher pools Boost Boss serves, where
their builders congregate, and how to reach them. Use as the outreach
playbook once Catalyst #1 (first paid advertiser) fires — see
`publisher_outreach_playbook` memory for why the timing matters.

---

## Quick reference

| Pool | Pitch line | Population (rough) | Contact difficulty | Avg traffic/builder | Priority |
|---|---|---|---|---|---|
| **1. MCP server devs** | *"Monetize per tool call via our MCP integration."* | ~5–10k devs | Easy (GitHub-native) | Low–Medium | **#2** |
| **2. AI app builders** | *"Drop our JS SDK in your app — works with any LLM backend."* | 50k+ products | Medium (founder Twitter / email) | Medium–High | **#1** |
| **3. Discord bot devs** | *"Add our REST call to your bot — works regardless of which AI you use."* | ~10–20k active devs | Easy (top.gg lists everyone) | Very High (some bots = 1M+ servers) | **#3** |
| **4. Custom GPT authors** | *"Add our Action URL — works inside the OpenAI ecosystem."* | 100k+ GPTs | Hard (OpenAI hides authors) | Medium | **#4** |

Priority is ranked on a combined "ease × revenue potential" view — see
sequencing notes at the bottom.

---

## Pool 1 — MCP server devs

**Who they are.** Developers building MCP servers that wrap a tool, API,
or data source so AI agents (Claude, Cursor, Cline) can call them.
Mostly side-project and open-source culture right now.

### Catalogs / registries (full list verified mid-2026)

Pool size is much bigger than initially estimated — ~20k+ unique MCP
servers across the major catalogs (Glama + MCP.so de-duped). Pool 1
alone is more than enough to source 20+ publishers.

**Tier 1 — biggest volume, start here**
- **Glama** (glama.ai/mcp) — **21,000+ servers**. Biggest by volume.
  Daily updates, visual previews. Best for maximum coverage.
- **MCP.so** — **19,000+ servers**. Community-led. Strong in Asia /
  Mandarin — Fissbot edge applies here.
- **PulseMCP** (pulsemcp.com) — **11,840+ servers**. Hand-reviewed
  daily. Best quality filter. Also a news source — pitch editorial.
- **Smithery** (smithery.ai) — **7,000+ servers**. App-store UI with
  install metrics. **Highest-ROI for prospecting** because rankings
  expose install counts. Scrape top 50–100 first.
- **MCP.Directory** (mcp.directory) — **3,000+ servers + agent
  skills**. One-click install for Cursor, VS Code, Claude Desktop.

**Tier 2 — niche / official**
- **Official MCP Registry** (registry.modelcontextprotocol.io) — the
  canonical Anthropic-maintained source, launched preview Sept 2025.
  Submit Boost Boss here for credibility.
- **MCP Market** (mcpmarket.com) — cross-platform client + catalog.
- **Claude Marketplaces** (claudemarketplaces.com/mcp) — Claude
  Code-specific. Important if you want Claude Code-user publishers.
- **API Tracker** (apitracker.io/mcp-servers) — smaller, more curated.
- **FastMCP.me** — app store for MCP servers.
- **OpenTools** — public registry of AI tools + MCP servers.
- **Dexter MCP** — comprehensive directory.
- **Awesome MCP Servers** (GitHub) — curated community awesome-list.

**Meta-index**
- **Automation Switch MCP index** — aggregates 18+ directories into
  one page. Monitor whole ecosystem from here.

### Community channels
- Anthropic Discord — there are `#mcp` channels with active builders
- GitHub topic `modelcontextprotocol`, `mcp-server`, search for
  `@modelcontextprotocol/sdk` users
- X / Twitter — follow @ModelContextProto and people quoting it
- Hacker News — search "Show HN MCP server"

### High-signal targets
The top 50 servers on Smithery by install count + the top 50 on Glama
by usage. ~75 unique after de-duping. Almost all have public GitHub
profiles with reachable emails.

### Why they convert
The integration matches exactly what they're already doing
(tool-call-shaped response). Lowest implementation friction.

### Why volume is limited
Pool is small and most MCP servers are early-stage. Expect ~$50–500 /
month per integrated server in early months.

---

## Pool 2 — AI app builders (any LLM backend)

**Who they are.** Builders shipping AI-powered apps — chatbots,
co-pilots, AI search, AI writing, AI coding tools. They use OpenAI,
Anthropic, Gemini, or self-hosted models. They have actual users.
**This is your largest revenue pool.**

### Catalogs / registries
- **Product Hunt** — filter to AI category, sort by month. Top monthly
  AI launches over last 6 months = ~500 prospects with real traffic.
- **Hacker News** — search "Show HN AI", "Show HN GPT", "Show HN LLM".
  Anything with >100 upvotes is worth a contact attempt.
- **There's An AI For That** (theresanaiforthat.com) — 30k+ tools
  catalog, searchable by category and popularity.
- **Futurepedia** — one of the higher-traffic AI directories. Good
  source for "actively-marketed" products vs. abandoned launches.
- **FutureTools.io** — curated AI tool directory, smaller but higher
  quality.
- **Indie Hackers Products** — searchable, filter to AI, ranked by
  revenue. Doubles as both a catalog AND a community channel.
- **TopAI.tools** / **FutureAI** / **AI Tools Directory** — additional
  catalogs, mostly overlap with the above.
- **Vercel templates gallery** — AI starter templates have public
  fork/usage stats.
- **X (Twitter) saved search** — searches like `"shipped AI app"`,
  `"launched AI"`, `"my AI tool"` surface founders publicly asking for
  users. High intent signal — they're actively trying to grow and will
  hear a monetization pitch.

### Community channels
- **Indie Hackers** — AI category, active makers community
- **LangChain Discord** — builders using LangChain (huge population)
- **LlamaIndex Discord** — RAG-focused builders
- **r/ChatGPTCoding**, **r/LocalLLaMA**, **r/MachineLearning**
- **Vercel Discord** — Next.js + AI builder community
- **Cloudflare Workers AI** community
- **Replicate**, **Together**, **Anyscale** user forums

### High-signal targets
Product Hunt monthly top-10 AI launches × last 6 months = 60 prospects
with proven traction. Hacker News Show-HN with 200+ upvotes from the
last year. Most have founder Twitter accounts; cold-DM works.

### Why they convert
JS SDK is the lowest-friction integration of all four pools — drop a
script tag, get sponsored content. Works with any backend they're
already using.

### Where they hide
Smaller indie builders are best reached via Twitter and Indie Hackers
DMs, not email. Founder emails are often hard to find for early-stage
products.

---

## Pool 3 — Discord bot devs

**Who they are.** People running Discord bots, many of which now have
AI features (chat, image gen, character roleplay). Traffic per bot can
be enormous — top bots are in 1M+ servers each.

### Catalogs / registries
- **top.gg** — THE big one. Public bot listings with **server count**,
  **vote count**, descriptions, and always a support server invite.
  Sort by "Highest voted" or filter "Trending". Top 100 bots reach
  millions of users daily.
- **discordbotlist.com** — secondary catalog, some unique bots
- **discord.bots.gg** — older catalog, smaller
- **BotGhost** — no-code bot builder; users there are builders without
  dev backgrounds (lower technical fit for Boost Boss integration)

### Community channels
- **top.gg's own Discord** — bot devs hang out there for visibility tips
- **r/discord_bots** — active subreddit for bot makers
- **r/discordapp** — broader Discord community, includes bot builders
- **Discord Developers** community server (discord.gg/discord-developers)

### High-signal targets
top.gg's "Highest voted" with 100k+ server count = ~150 bots, each
reaching millions of users. Every listing has a support server invite
where the dev is reachable directly.

### Why they convert
Massive traffic per bot. A single integrated bot can equal 100 MCP
servers' worth of impressions. AI-feature bots are easiest sell — they
already have "AI mode" their users are paying for, BB lets them
monetize the free tier.

### Caveats
Discord community has different monetization expectations — premium
tiers and Patreon, not ads. Pitch needs to land carefully: ads as a
free-tier monetization, not replacing premium. Integration is a REST
call (not an SDK), which is fine but means a slightly different
pitch.

---

## Pool 4 — Custom GPT authors

**Who they are.** People who built GPTs in OpenAI's GPT Store. ~100k+
GPTs exist; a much smaller subset have real usage.

### Catalogs / registries
- **OpenAI GPT Store** (in ChatGPT itself) — official, sortable by
  category and popularity, but no author contact info exposed
- **gptstore.ai** — third-party catalog with rankings + author handles
- **gptshunter.com** — third-party catalog with conversation counts
- **topgpts.ai** / **bestgpts.ai** — additional catalogs

### Community channels
- **r/GPT_store**, **r/ChatGPTPro** — builder discussion
- **Twitter / X** — search "I built a GPT", "my GPT", "ChatGPT custom"
- **OpenAI community forum** (community.openai.com) — official forum
  with custom-GPT subforums

### High-signal targets
gptstore.ai's top 200 by conversation count. Then cross-reference each
author's name against Twitter / LinkedIn to find a contact route.

### Why they convert
**No native monetization in OpenAI's GPT Store yet** for most authors
(revenue share is limited and gated). Boost Boss fills a real gap —
Action URL approach means the GPT can call out for sponsored content
mid-conversation.

### Why this pool is hardest
OpenAI deliberately hides author contact info. You'll spend more time
finding emails than sending them. Lower priority until the other three
pools have warmed.

---

## Sequencing — which pool to email first

**Revised after weighing operational cost of unconcentrated outreach:**
**Pool 1 first as a sprint, Pool 2 in parallel as an investment,**
then Pool 3 once Pool 1 produces a case study, then Pool 4 last.

Why this order:

1. **MCP server devs** — concentrated (Smithery + Glama rankings give
   you a ready-made top-50 list), GitHub-reachable, lowest setup cost
   to first outreach. You can have your first integrated MCP server
   in 2 weeks. Highest signal-fit per email — they get MCP, you're
   MCP-native. Produces the case study that makes Pool 2 outreach
   convert better.

2. **AI app builders** — biggest revenue pool but fragmented across
   8+ catalogs with no single ranking. Start prospect-list-building
   in parallel with Pool 1 outreach, so the list is ready when Pool
   1's case study lands. JS SDK is the easiest integration of all
   pools.

3. **Discord bot devs** — massive per-publisher traffic, but the
   monetization culture is different (premium/Patreon, not ads).
   Reach for this once Pool 1 or 2 has a case study showing real
   publisher revenue. Pitch becomes *"this AI app earned $1,200 last
   month, here's how that translates to your bot."*

4. **Custom GPT authors** — defer until you've shipped Action URL
   support and have a case study. Contact difficulty makes this the
   wrong pool to start with.

---

## Volume + targets to aim for

For your stated **first 20 publishers** goal:

- 10 from Pool 2 (AI app builders, broad outreach)
- 6 from Pool 1 (MCP server devs, top-50 list outreach)
- 3 from Pool 3 (Discord bots, hand-picked from top.gg)
- 1 from Pool 4 (custom GPT, opportunistic)

That's an asymmetric portfolio that hedges across integration types
and audience styles, while leaning into the pools with the best
ease-of-acquisition × revenue mix.

---

## A note on the messaging change

You correctly flagged that "use MCP to monetize your AI" is the wrong
universal message. Per-pool messaging is non-negotiable. Don't write a
single landing page that tries to address all four pools — that
landing page will speak to none of them. The `/publish` taxonomy you
already have (per `publisher_taxonomy` memory) — `/publish/{mcp,
ai-apps, bots, extensions}` — is the right structure. Each sub-page
should carry its own per-pool pitch from the chart above.
