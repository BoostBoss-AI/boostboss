# Discovery Run — Supply Acquisition (Lumi SDK)

Run by: Benna · Supply · Acquisition · **gated (nothing sent)**. Date: 2026-06-30 (run #2).
Method: Benna-Reach ICP — AI-product devs across web / desktop / extension / MCP who control their
server and likely lack ad monetization. Sources this pass: MCP creative-server ecosystem (the
9,400-server "yellow pages"), GitHub trending AI repos, Product Hunt AI launches.
De-dup: avoided all 5 day-1 prospects (Higgsfield, Mina, ElevenCreative/Flows, Arcana, Dune Keypad).

## ★ What changed since day 1
- **The homework/study-AI cluster is the cleanest ICP match found so far.** Large free consumer
  usage, explicit user intent (a typed homework question = perfect intent signal for our moat),
  web-app surface the dev controls, and most monetize the free tier weakly or not at all. New
  primary vein alongside creative-MCP.
- **Creative-MCP servers (OpenArt, Pixa, VEED, Pictory) are great ad *surfaces* but mostly already
  monetize** (credit subscriptions). Lower pain → lower priority than unmonetized consumer apps.
- Tool note: the in-product MCP-registry *connector* search indexes installable connectors, not the
  public 9,400-server registry — discovery runs via web search/fetch against the public registry,
  Product Hunt, and GitHub. Logged so future runs don't re-try the wrong tool.

## Qualified candidates (hypotheses — pipeline verifies traffic / monetization / contact)
| Candidate | Surface · Door | Tier | Fit | Monetization hypothesis |
|---|---|---|---|---|
| **StudyX** (studyx.ai) | web app · AI-apps | 2 | HIGH | 16M+ students, no-signup free homework answers; the question *is* the intent → intent-matched ads beside step-by-step solutions. Free tier largely unmonetized inventory. |
| **Studyable** (studyable.app) | web app · AI-apps | 1–2 | HIGH | "#1 free AI study app"; free homework help + flashcards. Indie, free-first, clear unmonetized surface. |
| **StudyMonkey** (studymonkey.ai) | web app · AI-apps | 2 | MED-HIGH | 24/7 free homework help, all subjects/levels. Consumer free tier; answer surface = ad slot. |
| **QwenPaw** (GitHub, agentscope-ai) | web/desktop · AI-apps/desktop | 2 | MED-HIGH | Open-source personal assistant, self-host/cloud, controls server, **no billing built** — textbook "built it, makes no money" ICP. Chat response surface. |
| **Tutor AI** (tutorai.me) | web app · AI-apps | 2 | MED | Personal AI tutor; learning-intent surface. Verify traffic + whether premium already covers it. |
| **OpenArt** (openart.ai) + MCP | web app + MCP | 2 | MED | Strong output surface (image/video beside results) but freemium credits already monetize → weaker pain. Free-tier users = the addressable inventory. |
| **Open WebUI** (GitHub) | self-hosted web · AI-apps | 2 | MED | ChatGPT-style self-hosted chat; deployer controls server, unmonetized. Caveat: many independent deployments, not one dev → ad-render path needs a maintainer-side opt-in slot. |
| **Pixa / Pixelcut** (pixa) + MCP | web app + MCP | 2 | MED | Image+video suite, free tier; output surface good. Already monetizes → lower pain, higher polish. |
| **ImgMCP** (pulsemcp listing) | MCP server (image) | 2 | MED | Image-gen MCP; output = natural ad surface. Verify it's a standalone product w/ end users vs a thin wrapper. |
| **OpenArt MCP standalone** | MCP server | 2 | LOW-MED | Same parent as OpenArt; counted once — listed for the MCP-door angle. |

Work order: **StudyX → Studyable → QwenPaw** first (highest fit × clearest unmonetized pain),
then the creative surfaces.

## Filtered OUT (qualification working)
- **VEED MCP**, **Pictory MCP** — B2B/marketing video, already monetized; no consumer free surface.
- **Oceans of AI** — Android-native aggregator app, already ad-supported, and it's a *directory* of
  tools, not an AI response surface. Mobile-native = out of lane (AppLovin/Unity fight).
- **Dify**, **Chatwoot** — agent-building / customer-support *infra*. B2B, no consumer ad surface.
- **nanobot** — lightweight agent *framework*; dev/infra leaning, no first-party consumer surface.
- **OpenClaw** — runs entirely on the user's own devices; no central server the dev controls to
  render ads (and it's the harness category itself). Architecturally excluded by the server-control
  filter.

## Drafted outreach — TOP 3 (GATED · awaiting Andy's ✅ · nothing sent)
From-name for all: **"The Boost Boss Team, Boost Boss" — fictional human persona, AI-assisted (disclosed)**.
Revenue split deliberately *not* quoted (says "majority of revenue") — blocked until Andy confirms 70/30 vs 85/15.

**→ StudyX**
> Subject: turn StudyX's free answers into revenue — no billing to build
> Hi — StudyX helps millions of students for free, but those sessions don't earn anything unless you
> build billing and paywalls. Boost Boss monetizes them with ads in about 10 minutes via one SDK
> install — and they're matched by *intent* (the actual question the student typed), not cookies, so
> they're relevant and pay a premium. You keep the majority of the revenue and build no billing infra.
> Worth a 10-minute look at how it'd sit beside your solutions?
> — The Boost Boss Team, Boost Boss (note: I'm an AI assistant on the Boost Boss team)

**→ Studyable**
> Subject: monetize Studyable's free tier without a paywall
> Hi — you built a free study app students actually use, but free usage costs you and earns nothing.
> Boost Boss adds intent-matched ads inside the experience — one SDK, ~10 minutes, no billing to build,
> no cookies. You keep the majority of the revenue and your free tier stays free. Open to seeing how
> it'd look on Studyable?
> — The Boost Boss Team, Boost Boss (AI assistant on the team)

**→ QwenPaw**
> Subject: a revenue path for QwenPaw that isn't a subscription
> Hi — QwenPaw is the kind of AI assistant people genuinely run, but open-source usage rarely pays for
> itself. Boost Boss lets you monetize the assistant's responses with intent-matched ads — one SDK,
> ~10 minutes, no billing or payment infra to build, and you keep the majority of the revenue. Since
> you control the server, it drops straight into your response surface. Worth a quick look?
> — The Boost Boss Team, Boost Boss (AI assistant on the team)

## Gate queue (→ #approvals)
- [ ] **3 outreach emails** drafted (StudyX, Studyable, QwenPaw) — awaiting approval before any send. Agent: Supply·Acquisition.
- [ ] **Confirm publisher revenue split** (70/30 vs 85/15) — blocks quoting a figure in any send.
- [ ] **Confirm/keep from-name "The Boost Boss Team"** (fictional, AI-disclosed) before first send.
- Reminder: cold sends stay gated until the sending domain is warmed.

## Standup — 2026-06-30
1. **Run:** discovered ~12 fresh candidates (0 overlap w/ day-1) → qualified 10 → 5 filtered out → drafted 3 outreach (gated). New finding: study/homework AI apps are the cleanest ICP match (huge free usage + explicit intent + unmonetized).
2. **Needs you:** (a) confirm revenue split so drafts can quote it; (b) confirm from-name "The Boost Boss Team"; (c) approve/edit the 3 drafts in #approvals.
3. **Approvals:** 3 drafts + 2 confirmations waiting.
4. **Watch:** nothing sent (gate held, correct). Warm the sending domain before any volume. Creative-MCP servers mostly already monetize — deprioritized vs unmonetized consumer apps.
5. **Today's focus:** confirm split + from-name, approve the 3 drafts, and bless "study-AI + creative-MCP" as the two primary veins for the next pass.

## ⚠️ Delivery note (Slack post failed — environment, not a gate)
The two Slack incoming-webhook POSTs could not be sent this run: the Cowork sandbox has
allowlisted egress only (pypi.org reachable, but `hooks.slack.com` / `slack.com` return connection
refused — curl rc=56 / HTTP 000). The webhook URLs are valid and were not exposed. The standup
brief and the #approvals gate-queue lines are captured above and are ready to post from a host with
Slack egress (the iMac harness) or by manual paste. No gate was bypassed.
