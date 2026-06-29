# Boost Boss — AI Team (Operations Layer)

This directory is the **operating system for the all-AI company**. It is separate from the
product code (`/api`, `/sdk`, `/packages`): the product is what customers use; this is the
standing team that runs and grows the company.

One human (Chairman) + a standing team of AI agents. The Chairman touches the work twice a
day — the **morning brief** and the **approval gate** — and everything else runs on its own.

---

## The spine (what's in this folder)

```
ai-team/
├── README.md            ← you are here
├── memory/
│   ├── company.md       ← mission, north star, current state (the company brain)
│   └── schema.sql       ← shared-memory tables (run in Supabase SQL Editor)
├── agents/
│   ├── ceo.md           ← the orchestrator persona + dispatch doctrine
│   ├── hermes.md        ← the secretary persona + brief format
│   └── _roster.md       ← all 19 seats: role, tools, activation trigger
├── standup/
│   └── daily-standup.md ← the first standing order (compiles the morning brief)
└── GATES.md             ← what runs free vs what waits for your approval
```

## How it runs (the model)

- **You talk to Hermes.** Plain language. Hermes structures your intent and hands tasks to the CEO.
- **The CEO dispatches** to whichever agents are needed. You never command individual agents.
- **Reversible work runs free.** Research, drafts, analysis, optimization, replying to inbound.
- **Irreversible work waits.** Sends, spend, deploys land in `action_queue` for your tap. See `GATES.md`.
- **Everything writes to shared memory.** That single per-prospect record is what makes "one Benna,
  many hands" real — see `memory/schema.sql`.

## Three ways work gets commanded

1. **Standing orders** — recurring missions that run without asking (the daily standup, Reach roams).
2. **Direct orders** — you state an outcome ("get me 20 publishers this month"); the CEO routes it.
3. **Event reflexes** — the world fires the right agent (new signup → Onboarding; DM → Reach).

---

## Current status

- **Phase: SPINE (built here, not yet deployed).** Validate in Cowork, then deploy to the iMac for 24h.
- Day 1 of operations: 2026-06-29. Product live; ad network + affiliate working; bank wired to PayPal.
- Live focus: Engineering · Benna · Supply prep. Other seats are **armed but idle** (see `_roster.md`).

## Deploy to the iMac (when validated) — checklist

1. Clone the boostboss repo onto the iMac; keep it always-on (disable sleep).
2. Install the agent runtime (Claude Agent SDK / Claude Code) + repo deps.
3. Run `memory/schema.sql` in the Supabase SQL Editor (adds the shared-memory tables).
4. Register a Slack workspace; create `#brief`, `#approvals`, `#feed`. Add the bot token to env.
5. Wire the daily standup (`standup/daily-standup.md`) as a cron standing order.
6. Start with the spine agents (Hermes + CEO), confirm a morning brief lands in Slack, then arm the rest.

> Note: this Cowork session is the **workshop** (design + deep work). The iMac is the **body** where
> the standing team lives 24h. Slack is the **command radio** between you and the team.
