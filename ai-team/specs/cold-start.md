# Spec — Cold-Start & Onboarding Model

The predicament is only at the start. This is how Boost Boss lights a two-sided market without
burning money — and the onboarding/pricing rules that fall out of it.

## The problem
Two-sided chicken-egg: publishers need ad spend to earn; advertisers need inventory to reach. Neither
side is valuable without the other on day one.

## Correction (load-bearing)
Publishers earn a share of **ad spend** (~70%), **not** affiliate commissions. Affiliate is a separate
role (share-link drivers earn the pool). So there is **no free "affiliate fill"** for publishers —
publisher earnings require real ad spend or a BB subsidy. Don't design around affiliate paying publishers.

## The unlock: matched calibration windows + two pools (zero subsidy)
Both sides start in a **calibration period**:
- **Publisher calibration:** install → serve ads to prove real traffic. Gate on an **impression
  threshold** (not DAU — stay inclusive of small/new AI apps). Doubles as a fraud/validity check and
  builds real reach data. Not yet monetized.
- **Advertiser calibration:** ads run **free** while Benna learns/optimizes (honest: the learning phase
  is noisy, so charging for it would be unfair). Funded by **free starter credits**.
- **Match them:** a free-calibration advertiser's ads run on **calibrating** publishers' inventory →
  no money owed in either direction → **zero BB subsidy.** Both warm up together, generating real data,
  until both graduate.

**Two pools — never crossed (the rule that makes it airtight):**
- Free (calibration) advertisers → **calibrating publishers only**.
- Paid (graduated) advertisers → **graduated publishers only**.
- Guarantees BB never owes a payout it didn't collect.

## Residual gap + backstop
The one case alignment does NOT solve: a publisher who **graduates before paid demand exists**. Backstops,
in order of preference: (1) set the publisher threshold high enough that paid demand has arrived by
graduation; (2) **dual-sided cross-spend** — a dense niche of apps that both advertise and publish pay
each other's inventory (self-liquidating); (3) a small **bounded** BB seed budget as last resort only.

## Beachhead: win one dense niche before breadth
Don't be "the ad network for all AI" on day one — you'll be sparse everywhere. Pick ONE tight vertical
where both sides overlap and ads are relevant.
- **First beachhead: study/homework AI cluster** (StudyX, Studyable, StudyMonkey) — huge free usage,
  explicit intent, and a natural advertiser pool (edtech, courses, student tools).
- Density = liquidity even at small scale. Then expand to adjacent niches (coding-assistant, creative-gen).

## Dual-sided audience = the cheapest possible ignition
The same AI products are both potential **publishers** (monetize their users) and **advertisers** (buy
more users). Cross-sell within the niche; their mutual spend self-liquidates the market. One prospect,
two offers — tag which side(s) fit.

## Pricing: credits (token-style) + transparent accounting
- **Credits as the payment/UX layer** — AI-native, frictionless top-up like API tokens. Extends the
  existing ad-credit / promote-loop, so it's barely a build.
- **Transparent per-outcome underneath** — every credit maps to real CPM/CPC/CPA and dollar value in the
  dashboard. Credits-on-top-of-transparency keeps the moat; pure token abstraction would hide ROI.
- **Free starter credits** are the advertiser on-ramp during calibration.

## Onboarding flows
- **Publisher:** install (~10 min) → calibration (prove traffic, fraud check, build reach data) →
  graduate at the impression threshold → monetize.
- **Advertiser:** sign up → free starter credits → calibration (Benna learns, ads free, fill calibrating
  inventory) → convert to paid credits.

## Cadence
- **Supply first + faster** (constrained moat; seeded via calibration). Daily auto-run within the beachhead.
- **Demand second + targeted** (only into niches with real inventory, so reach is always true).
  Weekly / on-demand, ramping with inventory. Early ratio ~3–5 publishers per advertiser.

## Referrals
Referral = **accelerator** (refer to graduate faster / earn a bonus), **never a prerequisite** to
monetize. Don't add friction to the supply side you're recruiting.
