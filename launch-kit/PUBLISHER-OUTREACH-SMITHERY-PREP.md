# Publisher Outreach — Smithery + Glama Prep Kit

**Status:** Ready-to-execute. Sits in standby until **Catalyst #1 fires** (first real advertiser deposit on boostboss.ai). Do not start outreach before that.

**Purpose:** Pre-built outreach list of the 50–70 highest-signal MCP server publishers, with qualification metadata and message templates, so the first publisher cohort can be contacted within hours of activation rather than starting from a blank page.

**Author context:** Boost Boss is in standby (see `intent_accuracy_moat`, `publisher_outreach_playbook`, `standby_catalysts` memories). This doc operationalizes the GTM blueprint already saved in memory.

---

## Why Smithery + Glama specifically

Of the seven publisher-discovery sources mapped during planning (TAAFT, Futurepedia, Product Hunt, Show HN, Lovable/v0/Bolt galleries, Chrome Web Store, bot directories, MCP registries), the MCP registries — **smithery.ai** and **glama.ai** — are the highest signal-to-noise pool for first outreach because every listed entry:

- Is **server-controlled by the developer** by definition (passes the `surface_not_device` rule — they host the MCP server themselves)
- Is **Tier 2 by definition** (passes the `two_tier_publisher_framework` filter — MCP servers are AI-native, expose direct intent signal)
- Maps cleanly to **Door 1 (MCP)** (passes the `one_door_is_enough` rule — no door confusion)
- Was built in 2025–2026, so the builder is **actively shipping** and reachable

That's ~800 globally-known Door-1-ready publishers behind two URLs. Nowhere else in the ecosystem has this density.

---

## Activation gate — DO NOT execute before this

This prep kit becomes live work only when ALL of these are true:

- [ ] At least one real advertiser deposit has cleared via Stripe/PayPal on boostboss.ai (Catalyst #1 from `standby_catalysts.md`)
- [ ] Advertiser-side dashboard shows real (non-demo) budget available to spend
- [ ] BBX exchange is configured to route Door 1 traffic to that budget
- [ ] At least one test MCP install has rendered a real ad in a real MCP client end-to-end (smoke test, can be done with Fissbot or a self-built MCP)

If any of the above is false, the right move is to wait, not to send emails. Sending publishers to "we have no advertisers yet" kills the relationship.

---

## Step 1 — Pull the candidate list

### Sources

| Source | URL | Expected entries | Notes |
|---|---|---|---|
| Smithery | https://smithery.ai | ~800 total, target top 50 by install count | Primary pool |
| Glama | https://glama.ai/mcp/servers | ~500 total, target top 20 by activity | Secondary pool, partial Smithery overlap |
| Anthropic MCP showcase | https://modelcontextprotocol.io/examples | ~30 curated | High-credibility names only |
| GitHub `topic:mcp-server` | https://github.com/topics/mcp-server | ~varies | Long tail, less qualified |

### Extraction approach

Two options depending on engineering appetite:

**Option A — Manual (1–2 hours, recommended for first 50):**
Browse Smithery top installs page in browser. For each top entry, click through and capture into a spreadsheet:
- Server name
- Smithery URL
- GitHub URL (always linked from listing)
- Install/usage count
- Category tags
- Builder name (from GitHub README or profile)
- Builder Twitter / email (check GitHub profile + README contacts)
- Last commit date (signals "is this maintained?")

For top 20 Glama entries, repeat. Dedupe against Smithery list by GitHub URL.

**Option B — Scripted (1 day if scaling beyond 50):**
Write a Python crawler against the Smithery directory + GitHub API. Output CSV. Defer this until manual reach exhausts and a 200+ list is needed.

### Output

Single spreadsheet `launch-kit/outreach-batch-1.csv` (do NOT commit to git — add to .gitignore) with columns:

```
name, smithery_url, github_url, install_count, category, builder_name, builder_handle, builder_email, last_commit, tier, door, qualification_notes, status, sent_date, reply_date, outcome
```

Pre-fill: `tier=2`, `door=1` for all rows (true by definition for MCP).

---

## Step 2 — Qualify & sort

Drop or deprioritize rows where:

- **No findable contact** (no Twitter, no email, no LinkedIn) → defer; revisit after first 50
- **No commit in last 90 days** → likely abandoned, deprioritize
- **Same builder appears 3+ times** (multi-MCP author) → consolidate to one contact, mention multi-server fit in outreach
- **Corporate-looking MCP** (Microsoft, Anthropic-official, GitHub-official) → defer; these need partnership outreach not founder outreach
- **MCP with zero installs** → defer; no audience to monetize yet

Sort remaining by `install_count DESC`. Top 50 = Batch 1. Next 50 = Batch 2 (held for follow-up after Batch 1 reply patterns emerge).

---

## Step 3 — Outreach message template

The template draws on three memory anchors: `intent_accuracy_moat` (the differentiator), `two_tier_publisher_framework` (the premium positioning for AI-native publishers), and `one_door_is_enough` (Door 1 single fit, no door-choice confusion).

### Cold email — Tier 2 / Door 1 / MCP

Subject lines to A/B test (rotate across batch):
- `Monetizing {SERVER_NAME} — 60-sec read`
- `Premium CPMs for MCP servers — Boost Boss`
- `Your MCP users tell you exactly what they want. Want to monetize that signal?`

Body:

```
Hi {BUILDER_FIRST_NAME},

I'm Andy, founder of Boost Boss — an AI-native ad network built specifically for MCP servers and AI surfaces. I saw {SERVER_NAME} on Smithery and wanted to reach out.

Quick context on why we built this:

Other ad networks see cookies. Boost Boss sees intent. When a user calls a tool on {SERVER_NAME}, they're telling their AI exactly what they want — book a hotel, fix a bug, find a flight. We surface relevant ads against that declared intent rather than cookie-based guesses.

For MCP servers like yours, that translates to:

  - 2–4x higher CPMs than AdSense (because we sell real intent, not demographics)
  - 85/15 revenue split (you keep 85%)
  - One npm install, zero config — Lumi MCP SDK auto-detects the tool call context
  - Biweekly payouts, $1 minimum

We're onboarding the first cohort of MCP publishers now. If {SERVER_NAME} would be a fit, the integration is ~20 minutes and I can walk you through it on a call this week.

Live docs: https://boostboss.ai/publish/mcp
Reply with "interested" if you want a demo, or "later" if I should follow up in a month.

Andy Dasouth
founder, Boost Boss · boostboss.ai
```

### Twitter DM variant (when no email available)

```
Hey {HANDLE} — saw {SERVER_NAME} on Smithery. We're running Boost Boss, an ad network built specifically for MCP servers that reads intent from tool calls. 2-4x AdSense CPMs, 85/15 split. Worth a 60-sec look? boostboss.ai/publish/mcp
```

### Personalization rule

Spend 30 seconds per email on a personalized opening line. Concrete examples:
- If they have a recent GitHub release: "Saw v0.4 dropped last week — congrats on shipping inline retries."
- If their MCP is in a specific category (browsing, code, finance): "MCP servers in {category} are exactly where intent-based monetization lands best — users in {category} tools have strong purchase intent for {category-adjacent vertical}."
- If they tweet about MCP infra: "Been following your threads on MCP discovery — the directory problem is real."

No personalization = template feel = lower reply rate. Budget 4 hours to send 50.

---

## Step 4 — Send cadence + tracking

- **Pace:** 10–15 emails/day, Mon-Thu mornings (Pacific time). Skip Fri-Sun.
- **Channel:** Email if available, Twitter DM as fallback, LinkedIn InMail as last resort
- **Tracking:** Update `status` column in CSV — `queued | sent | replied-yes | replied-no | replied-later | bounced | no-reply-30d`
- **Follow-ups:** Single follow-up at day 7 to no-replies. After that, drop to `no-reply-30d` and move on.

### Reply handling SLA

- `replied-yes` → respond within 4 hours. Schedule onboarding call within 48 hours.
- `replied-later` → set calendar reminder for date specified, then re-engage
- `replied-no` → respond once with "thanks, would love feedback on why" (silent half the time, useful insight half the time)

---

## Step 5 — Success criteria

Batch 1 (50 sends) success = ANY of:
- ≥ 3 publishers fully integrated and serving ads through Door 1
- ≥ 8 publishers in active conversation (replied yes, demo scheduled)
- ≥ 15 reply rate (yes + no + later — engagement signal even if not converting)

If Batch 1 hits success: launch Batch 2 (next 50) within 1 week.
If Batch 1 misses on all three counts: STOP and run a reply-analysis pass. The pitch, the channel, or the cohort is wrong — figure out which before burning the next 50.

---

## Step 6 — What to feed back into the memory system after Batch 1

Update these memories with what was learned:

- `publisher_outreach_playbook` — append "Smithery Batch 1 results" section with reply rate, conversion rate, top objections heard
- `intent_accuracy_moat` — if the moat positioning landed (publishers quoted it back) → confirm. If publishers asked "what do you mean by intent?" → soften with more concrete examples in v2 template
- `two_tier_publisher_framework` — confirm or revise the 2-4x CPM claim based on what advertisers actually pay against Door 1 traffic
- `one_door_is_enough` — confirm publishers were happy with single-door pitch, OR note if they asked about multi-door (signal that the "one door is enough" doctrine needs revisiting)
- Create new `feedback_outreach_lessons.md` with surprising findings

---

## Quick-start checklist for a future Claude picking this up

1. Confirm Catalyst #1 has fired (check Stripe/PayPal dashboard for real deposit)
2. Read this doc end-to-end
3. Read memories: `intent_accuracy_moat`, `two_tier_publisher_framework`, `one_door_is_enough`, `surface_not_device`, `publisher_outreach_playbook`
4. Open Smithery + Glama in browser, manually populate top 50 + top 20 into `outreach-batch-1.csv` (Option A from Step 1)
5. Qualify per Step 2
6. Draft 5 fully-personalized emails using the Step 3 template, share with Andy for review
7. Once Andy approves the first 5, send those 5 from his Gmail (or whichever sending account he authorizes)
8. Continue at 10–15/day pace, tracking in CSV
9. Run weekly retro and feed results into memory updates per Step 6

---

**Last updated:** 2026-06-10
**Owner:** Andy Dasouth
**Related memory anchors:** `[[publisher_outreach_playbook]]` `[[intent_accuracy_moat]]` `[[two_tier_publisher_framework]]` `[[one_door_is_enough]]` `[[surface_not_device]]` `[[standby_catalysts]]`
