# Company Brain — Boost Boss

> The single source of truth every agent reads on wake. Keep it short and current.

## Mission
Become the **largest ad network in the AI-product industry** by owning the supply side nobody
else has built: delivering ads *inside AI tool responses*.

## North star
Help our customers win. Every surface, agent, and dollar exists to make advertisers convert and
publishers earn. When they win, we win (we only earn when we deliver — take rates, not rent).

## The moat (do not drift from this)
- **AI-native supply.** Amazon/Google built MCP servers for the *demand* side (managing campaigns
  via AI). Nobody built the *supply* side (serving ads inside AI tool responses). That's our lane.
- **Intent, not cookies.** "Other ad networks see cookies; Boost Boss sees intent." Justifies premium CPMs.
- Stay out of mobile-native SDKs (that's AppLovin/Unity's fight). Stay AI-native.

## Pillars
- **SuperBoost** — direct advertisers (Pilot model: upload product + creatives + objective + budget;
  Benna allocates across all placements).
- **BBX** — programmatic exchange.
- **Lumi SDK** — publisher monetization across four doors (MCP, AI apps, bots, extensions).
- **Benna AI** — the optimization engine *and* the customer-journey spine.

## Money model (verified)
- Take = **BBX/RTB fee 6.5% (fixed)** + **Benna optimization 15–23.5% (variable; standard 23.5%)**.
  Standard total take 30% → **publisher keeps ~70%** (best case ~78.5% when the Benna fee is 15%).
  The payout engine already implements this (6.5% RTB + 23.5% network). The dashboard's flat "85%" is a bug to fix.
- **Policy: NEVER show the split / revenue-share ratio on any public or marketing page — it lives ONLY in the signed Terms/contract.** Marketing may frame the *advertiser* side as "fees as low as 15%."
- Affiliate commission = 30% **of the affiliate pool** the seller sets (not of the sale); affiliate gets 70%.
- Merchant of Record; PayPal handles pay-in and payout (single-provider rule for the TW entity).
- Payouts: biweekly Friday batches, Tuesday cutoff, $1 min. 2FA gates cashout.

## Timing thesis (why now)
The AI-application boom is AppLovin's mobile-games moment. New AI apps are just starting to emerge.
Be the network already there when supply explodes. **Supply-first:** without publishers we can't
persuade advertisers to spend, so we build supply Day 1 — advertiser spend (most of our revenue)
follows the inventory. The cold-start phase won't last long.

## Targets
- **Year-1:** 50,000 publisher products live as ad surfaces (devs across web / desktop / extension /
  mobile who can't or won't build billing). See `playbooks/benna-reach.md`.
- **Immediate beachhead:** first 20 publishers.

## Current state (update this line as it changes)
- **Day 1 of operations: 2026-06-29.** Product live. Ad network + affiliate working. Bank wired to PayPal.
- Live focus: Engineering · Benna · Supply prep (Benna-Reach playbook loaded). Demand/Finance/Trust/
  Growth seats armed, activate on signal.
- Resources in place: admin panel governs what needs human approval; per-function emails provisioned.
- ⚠️ Open: confirm publisher revenue split (70/30 vs 85/15 conflict in records) before any outreach quotes it.

## Cold-start model (agreed — see specs/cold-start.md)
- **Beachhead:** study/homework AI cluster first; win one dense niche before breadth.
- Publishers earn from **ad spend (~70%), not affiliate**. Both sides start in a **calibration period**.
- **Matched calibration + two pools** (free advertisers → calibrating publishers; paid → graduated) = zero subsidy.
- Dual-sided audience **self-liquidates** a dense niche; small seed budget only as backstop.
- **Pricing: credits** (token-style top-up) with transparent CPM/CPC/CPA + dollar accounting; free starter credits for advertisers.
- **Cadence:** supply daily within beachhead; demand weekly into real inventory (~3–5 publishers : 1 advertiser).
- Billing/usage dashboard spec: `specs/dashboard-billing-usage.md`.

## Operating gates (hard rules)
- No autonomous money movement, deploys, or cold sends — those wait in `action_queue` for the Chairman.
- Outbound to strangers is **gated** until the sending domain is warmed and proven. Honor opt-out.
- Never impersonate a real named person. Personas (e.g. "Sandy") are fictional and disclosed where required.
