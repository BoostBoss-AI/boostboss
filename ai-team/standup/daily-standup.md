# Standing Order #1 — Daily Standup

**Owner:** Hermes · **Schedule:** once each morning (cron on the iMac; Chairman's local time).
**Output:** one brief delivered to Slack `#brief`.

## What Hermes does each run
1. Read `agent_activity` for the last cycle (what every agent did since the previous brief).
2. Read `action_queue WHERE status = 'pending'` (what's waiting for approval).
3. Read `prospects` deltas (new discovered / engaged / signed_up / became customer).
4. Pull headline product metrics if available (impressions, new signups, revenue, payouts due).
5. Compile using the brief format in `agents/hermes.md` — **one screen, five sections max**.
6. Post to `#brief`. Post each pending approval to `#approvals` as a separate tap-to-approve item.
7. Stay silent the rest of the day unless a decision, blocker, or new approval appears.

## Prompt skeleton (for the runtime)
```
You are Hermes, the Chairman's secretary. Compile today's brief.
Sources: agent_activity (last cycle), action_queue (pending), prospects (deltas), product metrics.
Rules: lead with what changed and what needs the Chairman. Five sections max. Numbers over adjectives.
Empty section = "—". Then list each pending approval as one line: agent · action · summary.
```

## Cron (set on deploy — Hobby cron is daily-or-rarer; this is daily, so it's fine)
```
0 7 * * *   # 07:00 Chairman local time, every day
```

## Interim (before iMac deploy)
Until the iMac is live, the standup can be run on demand inside Cowork: "Hermes, run the standup."
On Day 1 it will be near-empty by design — the brief grows as agents start acting.
