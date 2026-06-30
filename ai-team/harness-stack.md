# Harness Stack — Slack command board, Chairman + AI team

Your chosen path: a harness on the iMac, Slack as the two-way command board, you the only human.

## Hermes Agent vs OpenClaw — pick **Hermes Agent**
They're genuinely different:
- **Hermes Agent (Nous, MIT)** — self-hosted daemon, persistent memory, cron, sub-agents, 16+ messaging
  platforms incl. Slack, works with Anthropic models, **writes its own reusable skills**, and ships a
  context-file scanning layer (some built-in prompt-injection defense). **Better security posture.**
- **OpenClaw (TypeScript, ex-clawdbot)** — more messaging platforms + mobile companion apps, but carries
  the documented 2026 CVEs (RCE, ~40k exposed instances, supply-chain). Heavier security baggage.

For a security-conscious solo Chairman, **Hermes Agent wins** — MIT, Anthropic-native, stronger injection
defense, self-improving skills. OpenClaw's mobile apps aren't worth its extra exposure. (Both are young —
harden either per `SECURITY.md`.)

## The stack
1. **Runtime:** Hermes Agent, installed on the **iMac** (24/7 awake, plugged in, online, behind home NAT).
2. **Brains:** **Anthropic API key** (pay-per-token — you can't use Max). Haiku for routine, Sonnet/Opus
   for hard reasoning; prompt caching on; **hard spend cap** set.
3. **Command board:** **Slack** — upgrade your bot from webhook-only to a full read/write app
   (bot token + `channels:history`, `app_mentions:read`, `chat:write` + Socket Mode/Events). **One bot,
   channel-routed** — don't run 19 separate bot apps. You post in a channel → the harness invokes that
   department's agent → the bot replies as that role.
4. **Memory/state:** **Supabase** (scoped, read-mostly key) + Hermes' local memory. Load the `ai-team/`
   spine (personas, playbooks, gates, specs) as the agents' instructions/skills.
5. **Tools per agent:** web search/browse (discovery), email send (**gated**), Boost Boss product APIs
   (scoped). Slack read/write.
6. **The gate (non-negotiable):** **never** give the harness PayPal/Stripe live / Vercel deploy / Supabase
   service-role keys. Irreversible actions → posted to `#approvals` → you tap ✅ → the harness executes.

## How Slack becomes a real command board (vs today)
Unlike the free webhook setup, the harness on the iMac has real Slack **read** + **egress**, so it:
- **Posts to channels itself** (standups, updates) — no curl by you.
- **Reads your messages and replies** in-channel — you actually talk to the team.
- **Sends** approved outreach + handles events — because it can reach the outside world.

## Your daily job (Chairman)
- **Morning:** open Slack. Overnight the iMac ran discovery roams + handled events; the **standup is
  already posted** to `#standup`. Read it (~10 min).
- **Command:** type in `#command` ("find 20 study publishers", "Mike, prep Friday's payouts") → routed to
  the right agent → it works → posts back. Direct any department in its channel.
- **Approve:** `#approvals` lists gated items (sends, payouts, deploys). Tap ✅ → the harness executes the
  approved ones. Nothing irreversible fires without you.
- **Through the day:** agents fire on events (signup → onboarding posts in `#supply`) + schedules; you get
  Slack pings; you respond/redirect as needed.
- **Touch points:** the brief + approvals + a few commands. ~30–60 min of decisions; the rest runs on the iMac.

## Your responsibilities on this path (the honest cost)
- Keep the **iMac awake + online 24/7**; restart the harness if it/the Mac reboots.
- Watch the **API spend** (cap it; Haiku + caching).
- Own **security**: run it private (no exposed ports), patch Hermes, vet any skills/plugins, keep money +
  deploy keys out of its reach. See `SECURITY.md`.
