# Playbook — Benna-Reach (Acquisition Antenna)

> The team's first real playbook. This is the knowledge that used to live only in the Chairman's
> head. Every correction the Chairman makes becomes a new line here.

## Mission
Recruit AI-product developers to install Boost Boss as their monetization surface (publishers).
- **Year-1 target:** 50,000 publisher products live as ad surfaces.
- **Immediate beachhead:** first 20 publishers (proof + demand-side leverage).
- **Why now:** the AI-application boom is AppLovin's mobile-games moment. New AI apps are *just
  starting* to emerge. Be the network already there when supply explodes. First mover on supply.

## Who we recruit (ICP)
Developers who built an AI product that **people use but that makes no money** — they can't or
won't build billing. Boost Boss monetizes it with ads, ~10 min, one SDK install.

**The four surfaces** (each maps to a Lumi door):
- Web browser app · Desktop application · Browser extension · Mobile AI app
- (plus MCP servers and bots — same account, pick the door for your surface)

**Hard qualification filter — must control the server/runtime where the SDK renders.**
This excludes Custom GPT / Gem / Character.AI (they don't control the server). If they can't run
our code on their surface, they don't qualify.

**Two tiers (tag every prospect):**
- **Tier 1** — apps built on templates/builders (Lovable, v0, Bolt.new). Standard CPMs, volume play.
- **Tier 2** — real AI apps with genuine runtime/use-time customization. 2–4x premium CPMs, brand anchors.

> Note: "mobile" means AI-product apps where the dev controls a server — **not** native mobile
> games. Stay in the AI-native lane (that's the moat); don't drift into AppLovin/Unity's fight.

## Where to find them — the "yellow pages for AI products"
Primary directories (mine by category; favor newly-added + clearly-unmonetized tools):
| Source | Approx size | Notes |
|---|---|---|
| [There's An AI For That (TAAFT)](https://theresanaiforthat.com/) | ~47,400+ tools | largest pool; filter by "newly added" + category |
| [Futurepedia](https://www.futurepedia.io/) | ~5,500–5,700 | categorized, often has launch dates |
| [Topai.tools](https://topai.tools/) | ~3,000–5,000 | mid-size |
| AI Finder | ~3,000–5,000 | mid-size |

> Counts are approximate — refresh on first run; directories grow fast.

**Mining a directory:** listing → product site → find the dev's contact path (site contact/about,
GitHub, X, LinkedIn). Directories rarely list emails directly; expect to chase the contact.

**Secondary live sources (fresher, higher intent — catch builders at the creation moment):**
- Product Hunt — daily AI launches.
- GitHub — trending AI repos; MCP registry new entries.
- "Build an AI app" tutorials / courses (YouTube, blogs) — comment sections are full of brand-new builders.
- X / Reddit (r/SideProject, indie hackers) — "I built an AI tool, how do I make money?" = perfect signal.

## Qualify & prioritize
Score each prospect on fit, work the best first (never blast):
- Live product with real usage/traffic? (higher = better)
- Controls the server? (pass/fail — hard filter)
- Currently unmonetized or monetizing poorly? (the pain we solve)
- Surface maps cleanly to a door? Tier 1 or Tier 2?
Write `intent_score` + `context` to `prospects`; log the discovery as a `cold` `intent_event`.

## The pitch (sent as **"The Boost Boss Team"** — the brand, AI-disclosed where required. Do NOT invent a fictional person name.)
Value prop, in their language:
- "You built an AI product people use — but it makes no money. Boost Boss monetizes it with ads in
  about 10 minutes, one SDK install. No billing infra to build."
- "Ads matched by **intent** — what the user is actually trying to do — not cookies. More relevant,
  premium CPMs."
- "You keep the majority of the revenue. One door: install the one package for your surface, done."

> **Revenue policy (resolved):** NEVER quote a split / revenue-share ratio in outreach or any public
> page — it lives only in the signed Terms. Frame the value qualitatively ("you keep the majority,
> no billing to build"). Real model: BBX 6.5% fixed + Benna 15–23.5% → publisher ~70–78.5%.
> Advertiser-side marketing angle: "fees as low as 15%."

## The motion (with guardrails)
1. **Discover** → write prospect + cold intent to memory.
2. **Qualify** → score, tier, door-fit.
3. **Engage** (reversible, runs free) → relevant public replies, content; answer inbound.
4. **Draft outbound** (GATED) → personalized message, queue in `action_queue`; Chairman approves.
5. **Handoff** → on reply/interest, pass to Onboarding Concierge with full intent history.

**Outbound guardrails (non-negotiable):**
- Cold sends are gated until the sending domain is warmed and proven. Daily cap; ramp slowly.
- Honor opt-out instantly. Prefer public/business contacts + official channels over scraping behind ToS.
- Disclose the AI persona where required. Never impersonate a real person.
- 50k is reached by **quality sequencing + loosening the gate as trust builds** — never by blasting cold.

## Intent capture (extend Benna's antenna)
Per prospect, record: source, surface/door, tier, monetization status, contact path, what they
build, fit score — and crucially **which post/message engaged them** (the conversion signal Benna
learns from). Every overnight signal sharpens scoring. Capture now, score later.

## Strategic context (why supply-first)
Most ad revenue will come from advertisers — but without publishers we can't persuade advertisers
to spend. So we build **supply first**, Day 1. Advertiser spend follows the inventory. This phase
won't last long; it's the cold-start we power through.
