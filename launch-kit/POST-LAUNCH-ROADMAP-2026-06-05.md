# Post-Launch Roadmap — Things Explicitly NOT in v1

**Drafted:** 2026-06-05, the night before resuming the analytics + Payoneer build
**Purpose:** Reminder of what got deferred. Do not re-litigate during launch crunch — just confirm trigger conditions when each comes due.

---

## Why this list exists

During the launch push we made a bunch of "later, not now" decisions. Without writing them down, they evaporate, and we end up either:
- Forgetting them entirely and shipping a worse product than we already designed in our heads, OR
- Re-debating them every two weeks at the cost of momentum

Each item below has a **trigger condition** that tells us when it stops being "later" and becomes "now."

---

## Category 1 — Payment infrastructure

### 1.1 PayPal Vault / Reference Transactions
**What:** Meta-style "save card once, auto-top-up when balance drops." Eliminates manual deposit friction for active advertisers.
**Why deferred:** PayPal Reference Transactions requires formal merchant approval — 60+ days of clean processing history before they'll even consider the application. New ad-network accounts in this category often get denied on first try.
**Trigger:** 60 days post-launch with clean processing history AND ≥1 advertiser explicitly asking for auto-top-up.
**Estimated effort:** 1-2 weeks engineering + 2-4 weeks PayPal review.

### 1.2 PayPal Alternative Payment Methods (APMs)
**What:** Enable Pay Later (US/UK/EU/AU), Venmo (US), iDEAL (NL), Bancontact (BE), BLIK (PL), Trustly (Nordics), Mercado Pago (LATAM), and other regional methods that PayPal already supports.
**Why deferred:** Requires PayPal Business Settings configuration which can only be done AFTER PayPal Live is configured. Not blocked by code — just a settings tab.
**Trigger:** Day 1 of PayPal Live (right after KYB clears + E.SUN linked).
**Estimated effort:** 30 minutes in PayPal Business Manager. Zero code.

### 1.3 PayPal Smart Payment Buttons SDK
**What:** Replace current server-side redirect with `paypal.Buttons()` JS SDK. Renders PayPal/Card/Pay Later/Venmo as separate buttons on the dashboard before redirect.
**Why deferred:** Current redirect flow is functional. Smart Buttons gives ~15-30% conversion lift but isn't blocking launch. Also: Smart Buttons is the natural foundation for Vault, so doing them together later is more efficient.
**Trigger:** Either (a) bundled with Vault work in Phase 6, or (b) if conversion data from the redirect flow shows leakage worth fixing earlier.
**Estimated effort:** 3 days.

### 1.4 Billing@ monthly statement automation
**What:** Outbound automated emails to publishers (here's your payout statement) and advertisers (here's your spend statement) on the 1st of each month.
**Why deferred:** Andy is starting with manual biweekly Payoneer mass payouts. Statement email is a polish layer.
**Trigger:** When monthly volume makes manual statement compilation a pain.
**Estimated effort:** 2 days (HTML email templates + SES/Resend integration + cron).

### 1.5 Stripe re-activation as backup pay-in rail
**What:** Stripe code is still wired in (env-gated). If PayPal has an outage or account suspension, we can flip `PAYIN_PROVIDER=stripe` and route through Stripe.
**Why deferred:** Andy explicitly chose PayPal as primary. Stripe stays dormant.
**Trigger:** PayPal account freeze incident OR Andy changes his mind on the primary rail.
**Estimated effort:** Already done. Just flip env var.

---

## Category 2 — Product differentiators

### 2.1 Advertiser-side MCP server (`@boostbossai/superboost-mcp`)
**What:** MCP server letting advertisers manage Boost Boss campaigns from Claude/Cursor/any MCP-capable client via natural-language tool calls. Mirrors Amazon Ads MCP + Google Ads MCP but for Boost Boss.
**Why deferred:** API surface needs to stabilize first. Publishing an MCP tool that breaks every two weeks because we changed the campaign schema is worse than not having it.
**Trigger:** ~3 months post-launch, after API churn settles.
**Estimated effort:** 2-3 days.
**Strategic note:** This is the SECOND half of Boost Boss's MCP positioning. Supply-side MCP (publishers serving ads via Lumi SDK) is already done — that's the moat. Adding demand-side MCP completes the "AI-native ad network" narrative literally.

### 2.2 Brand Deals product
**What:** Fixed-CPM direct deals (advertiser pays X for guaranteed Y impressions on specific publisher). Different from BBX auction-based exchange. Confirmed missing from SuperBoost per project context.
**Why deferred:** Useful but doesn't unblock launch. Better to build when first advertiser actually requests a direct deal rather than speculatively.
**Trigger:** First advertiser asking "can I do a fixed deal with publisher X?"
**Estimated effort:** 2-3 days product, plus admin UI for deal management.

### 2.3 Real Benna AI ML scoring
**What:** Replace current deterministic Benna stub with actual ML model. Per project context: "Currently a deterministic stub — needs real ML scoring for production."
**Why deferred:** Heuristics work fine at <1k impressions/day. ML only beats heuristics when there's enough data to train and an opportunity cost to bad ranking.
**Trigger:** Any single publisher consistently serves >1000 impressions/day, OR repeated explicit complaint from an advertiser about ranking quality.
**Estimated effort:** Significant — at least 1-2 weeks engineering + model training + A/B validation.

### 2.4 Context-as-primary + plug-and-play parity (4-piece bundle)
**What:** Per `context_as_primary_plug_and_play` memory:
1. Context as primary param (currently auxiliary)
2. Plug-and-play parity across 4 doors + bot wrappers
3. Door-selection UX wizard
4. Publisher Theme & Preview surface (AdSense Ad Units analog — closes the "how do my ads look?" gap)
**Why deferred:** Internal Fissbot publisher first. External publishers need this polish layer before going live.
**Trigger:** Before opening self-serve publisher signup to non-personally-onboarded developers.
**Estimated effort:** 1-2 weeks across the 4 pieces.

### 2.5 Publisher-as-Advertiser via dedicated "Promote" sidebar item
**What:** Let publishers become advertisers without leaving their publisher dashboard. New top-level sidebar item ("Promote") that opens a simplified ad-creation flow optimized for "promote your own product." Same underlying `advertisers` + `campaigns` tables as the standalone advertiser dashboard — Promote is just a streamlined view, not a separate account type.

**Why it's a strategic move, not just a feature:**
- "Earn-to-spend" closed loop saves ~7% on every loop (no PayPal currency conversion when publisher earnings fund their own ads). Internal transfer, money never leaves Boost Boss.
- Lower friction than separate AdSense+GoogleAds-style accounts. Most AdSense publishers never become Google Ads advertisers because the friction is real.
- Marketing differentiator: "The only ad network where you can earn AND spend in one account."
- Natural extension of the existing Fissbot self-operator path (Fissbot will be both publisher AND advertiser from day 1 via affiliate revenue → BBX campaigns).

**Design — confirmed 2026-06-05 evening:**
- **Sidebar item: "Promote"** — top-level, not nested under another section
- **5-screen simplified flow:**
  1. Header: balance + "Create campaign" CTA
  2. Active campaigns list (mini cards: name, spend, impressions, clicks)
  3. Create campaign (6-8 fields: destination URL, creative, targeting dropdown, daily budget, funding source)
  4. Per-campaign drill-down (summary analytics)
  5. Graduation link at bottom: "Want full advertiser features? Open advertiser dashboard →" → routes to `/ads/dashboard`
- **Funding source dropdown:** defaults to "Use earnings ($X available)" if balance ≥ campaign budget, fallback to PayPal deposit option
- **No functional difference from standalone advertiser account** — same DB row, same campaigns, same billing. Just a different (simpler) UI view. Same advertiser can use both surfaces interchangeably.
- **Schema additions to design NOW in v1, ship LATER post-launch:**
  ```sql
  ALTER TABLE advertisers ADD COLUMN signup_source text;
  -- values: 'direct_signup', 'publisher_linked' — purely for analytics
  ALTER TABLE advertisers ADD COLUMN linked_publisher_id text;
  -- nullable; only set when auto-provisioned from publisher dashboard
  ```
- **Internal transfer flow:** publisher_balance.balance -= $X; advertisers.balance += $X; transactions.insert({provider: 'internal', type: 'internal_transfer', ...}). Accounting integrity preserved: Hauler still records publisher earning + advertiser spend as separate journal events even though no real money moves.
- **Self-buying prevention:** auction filters `WHERE campaign.advertiser_id != placement.linked_publisher_id` (i.e. a publisher's own campaign can't win their own placement opportunity).

**Why deferred (not v1):**
- Needs Catalyst #1 (first real advertiser deposit) to validate the standalone advertiser flow works end-to-end before adding the alternative entry surface.
- Fissbot self-operator path serves as the manual validation case — Andy will link Fissbot's publisher + advertiser accounts by hand initially. Productize this only after manual version works.
- Tax/accounting setup for internal transfers needs careful design (Taiwan corporate tax treats publisher payable and advertiser revenue as distinct journal events even when no money moves).

**Trigger:** Phase 5 — after Catalyst #1 fires and Fissbot self-operator manual setup is validated.

**Estimated effort:** 3-4 days total
- Day 1: Schema + auto-provisioning logic
- Day 2: "Promote" sidebar item + simplified create flow UI
- Day 3: Internal transfer endpoint + balance display + graduation link
- Day 4: Tests + admin observability for cross-account campaigns

**Naming decisions to lock before build:**
- Sidebar label: **"Promote"** (current lean — clear, short, semantically distinct from "Inventory" and "Payouts")
- Targeting dropdown options: match existing publisher categories — AI tools / Coding / Productivity / Research / etc.
- Funding default: "Use earnings" if balance sufficient, fallback to PayPal deposit

**Pre-launch design work to do NOW (in v1 schema):**
- Add the two columns to `advertisers` table so we don't have to migrate later
- Make sure analytics queries (the `/usage` work we're starting this week) can handle `linked_publisher_id` joins so the cross-pollination data is available for marketing positioning ("X% of advertisers were publishers first") from day 1.

---

## Category 3 — Compliance & reputation

### 3.1 DUNS number
**What:** D&B identifier required for IAB TAG-ID, sellers.json verification, serious B2B compliance. Free.
**Why deferred:** Not strictly blocking launch. 30-day issuance window.
**Trigger:** Start the application NOW so it's ready when we want to apply for TAG-ID. Free + zero ongoing maintenance.
**Estimated effort:** 30 minutes to apply.

### 3.2 IAB TAG-ID
**What:** TAG (Trustworthy Accountability Group) ID issuance for ads.txt/sellers.json. Signals legitimacy to brand-safety-conscious advertisers.
**Why deferred:** Requires DUNS first. Costs money. Not blocking launch.
**Trigger:** After DUNS issued AND we're seriously pursuing brand advertisers (probably alongside Brand Deals product).
**Estimated effort:** Application takes 2-4 weeks. Fee varies.

### 3.3 Trademark filing for "Boost Boss" / "BoostBoss"
**What:** Defensive trademark in US (USPTO), EU (EUIPO), Japan (JPO), Taiwan (TIPO). Class 9 (software) + Class 35 (advertising).
**Why deferred:** Cheap defensive move but not urgent unless someone shows up squatting. Trademark *check* is task #8 — do that first to find out if BoostBoss is even available before spending money on filings.
**Trigger:** First sign of competitive name conflict OR when paid marketing spend starts (you don't want to invest in a brand someone else can claim).
**Estimated effort:** Trademark check ~30 minutes free; filings $250-1500 per jurisdiction.

### 3.4 Real Taiwan registered address in sellers.json / legal pages
**What:** Currently sellers.json says "Hauler Technologies Co., Ltd. (operating Boost Boss), Taiwan. Full registered address provided on request." Real registered address should be on file with PayPal/Payoneer/banks already.
**Why deferred:** Most ad-tech buyers won't look. PayPal/Payoneer have the real address in their KYB records.
**Trigger:** First brand-safety auditor or IAB review requests the full address publicly.
**Estimated effort:** 5 minutes to edit sellers.json.

---

## Category 4 — Security

### 4.1 TOTP 2FA for users
**What:** Time-based one-time password 2FA for advertiser + publisher dashboards.
**Why deferred:** Per memory (settings_rebuild_state): "TOTP 2FA deferred to Catalyst #1." Real money flows are the trigger.
**Trigger:** First real advertiser deposit (Catalyst #1).
**Estimated effort:** 2-3 days.

### 4.2 PayPal Live secret rotation (task #37)
**What:** The Live secret was briefly unmasked in a chat screenshot earlier this session.
**Why this is NOT actually deferred:** Should be done BEFORE first real deposit. It's housekeeping, not a roadmap item.
**Trigger:** Before flipping `PAYPAL_ENV=live`.
**Estimated effort:** 5 minutes.

---

## Category 5 — Distribution

### 5.1 NPM publish `@boostbossai/lumi-sdk`
**What:** Per project context: "@boostbossai/lumi-sdk package needs publishing to npm."
**Why deferred:** Manual onboarding via direct support is fine for first ~5-10 publishers. NPM publishing only matters for the self-serve cohort.
**Trigger:** Before opening self-serve publisher signup to non-personally-onboarded developers (bundle with Category 2.4).
**Estimated effort:** 1 hour (already coded, just needs `npm publish`).

### 5.2 Chrome Web Store + PyPI namespace reservation
**What:** Reserve `boostboss` / `@boostbossai` namespaces on Chrome Web Store ($5 one-time) and PyPI (free).
**Why deferred:** Defensive. Not blocking launch.
**Trigger:** Anytime. Quick win — 20 minutes total.
**Estimated effort:** 20 minutes.

---

## Category 6 — Admin observability

### 6.1 Phase H Panel 1 (live activity dashboard)
**What:** Real-time view of auctions/bids/serves across all publishers + campaigns.
**Why deferred:** Per `phase_h_status` memory — only unblocks on *repeated* (twice in distinct conversations) workflow signal that we need it.
**Trigger:** When ops scaling makes the current admin views insufficient for live debugging.
**Estimated effort:** 1 week.

### 6.2 Phase H Panel 2 (money flow dashboard)
**What:** Real-time view of advertiser deposits, publisher accruals, BB take. Distinct from the money tracking we're building this week (which is post-hoc analytics, not real-time).
**Why deferred:** Same as Panel 1 — speculative.
**Trigger:** Same as Panel 1 — repeated explicit workflow signal.

### 6.3 Phase H Panel 4
**What:** Whatever Panel 4 was — currently undefined.
**Why deferred:** Parked until ≥10k impressions sustained across multiple publishers per `phase_h_status` memory.
**Trigger:** ≥10k impressions/day across ≥2 publishers sustained for at least a week.

---

## Category 7 — Marketing & launch prep

### 7.1 Outbound publisher DM templates
**What:** 5-10 message templates for cold/warm outreach to MCP devs, Cursor extension authors, AI app founders.
**Why deferred:** No point messaging publishers until first advertiser is funded (Catalyst #1 gate per launch_sequence memory).
**Trigger:** Within 24 hours of Catalyst #1.

### 7.2 Wait-list capture form for advertisers
**What:** Simple landing page form to capture interest before payment goes live. Builds list to email when we open.
**Why deferred:** Not needed until we're actively driving traffic to boostboss.ai.
**Trigger:** When first paid traffic / outbound campaign starts.

### 7.3 Launch announcement content
**What:** Blog post + Twitter thread + HN/Reddit posts + LinkedIn announcement.
**Why deferred:** Premature if Catalyst #1 hasn't fired.
**Trigger:** Within 1 week after Catalyst #1.

---

## Category 8 — Strategic optionality

### 8.1 Crypto pay-in (USDC on Base via Coinbase Commerce)
**Status:** EXPLICITLY REJECTED by Andy 2026-06-05.
**Why noted anyway:** Documenting the decision so we don't re-propose it. Re-evaluate only if PayPal+Payoneer rails repeatedly fail.

### 8.2 ECPay / Line Pay for Taiwan-domestic advertisers
**What:** Taiwan-licensed payment processors. Would let Taiwan advertisers pay Boost Boss (which PayPal can't due to TW-to-TW restriction).
**Why deferred:** Boost Boss's target advertisers are mostly US/EU AI startups. Taiwan-domestic advertising is a stretch market, not core.
**Trigger:** First Taiwan-based advertiser explicitly asking + at least 3-5 more in the pipeline.
**Estimated effort:** ~1 week per provider.

---

## Category 9 — Scale preparation

### 9.1 200k → 30M impressions/day capacity
**What:** Per `scale_prep` memory — Andy targets 200k/day initial, 30M/day long-term.
**Sub-items:**
- Verify Benna capture pipeline before any volume run
- CDN edge optimization
- DB query optimization + pre-aggregation
- Vercel function cold-start hardening
**Why deferred:** v1 runs fine at current volume levels (single-digit thousands per day).
**Trigger:** Approaching 50k impressions/day sustained → start preparing for 200k.

---

## Quick-wins NOT actually deferred — do alongside launch

These keep getting bundled into "later" but they're 30-min jobs that should ride alongside the main launch push:

1. **Trademark availability check** (task #8) — 30 min
2. **DUNS application** — 30 min (free, 30-day clock)
3. **Rotate exposed PayPal Live secret** (task #37) — 5 min before going Live
4. **Create info@/support@/billing@ in Google Workspace** (task #6) — 30 min
5. **Reserve PyPI namespace** — 10 min
6. **Reserve Chrome Web Store dev account** — $5, 15 min

Total: ~2 hours across the whole list. Just rip through them while Payoneer + PayPal + bank are pending.

---

## What's actually NEXT (in scope for current sprint)

Not deferred:

1. ✅ PayPal pay-in (sandbox-validated, awaiting KYB)
2. ⏳ Payoneer Mass Payouts integration (this week's build)
3. ⏳ Admin money tracking dashboard (this week)
4. ⏳ `/ads/dashboard#/usage` deep analytics surface (this week — the "transparent detail analytics" positioning piece)
5. ⏳ `/publish/dashboard#/payouts` withdrawal history (this week)
6. ⏳ `/ads/dashboard#/billing` invoice section (this week)
7. ⏳ Fissbot Lumi SDK integration (next week — first publisher)

---

## Decision-by-decision changelog

| Date | Item | Decision | Source |
|---|---|---|---|
| 2026-06-04 | Skip Payoneer for now | Reversed 2026-06-05 — Andy registered Payoneer | this thread |
| 2026-06-04 | Stay on PayPal as primary pay-in | Confirmed | this thread |
| 2026-06-05 | No crypto pay-in | Confirmed (rejected) | this thread |
| 2026-06-05 | Build admin money tracking with hour/day/week/month/quarter buckets | Confirmed (specced) | this thread |
| 2026-06-05 | No auto money movement — admin clicks every payout | Confirmed | this thread |
| 2026-06-05 | "Transparent detail analytics" as core differentiator | Confirmed (saved to memory) | this thread |
| 2026-06-05 | Advertiser-side MCP server is roadmap, not v1 | Confirmed (task #43) | this thread |
| 2026-06-05 | Email surface consolidated to 5 public addresses | Confirmed (shipped) | this thread |
| 2026-06-05 | Publisher-as-Advertiser via dedicated "Promote" sidebar item | Confirmed (Phase 5) | this thread, section 2.5 |
| 2026-06-05 | "Promote" is simplified UX (not just a redirect to /ads/dashboard) | Confirmed | this thread |
| 2026-06-05 | Pre-bake schema (`signup_source`, `linked_publisher_id`) in v1 even though feature ships in Phase 5 | Confirmed | this thread |

---

**End of roadmap reminder.**

If you're reading this 3 months from now and something here is still parked, the right question is *"has the trigger condition fired yet?"* — not *"should we revisit the decision?"*. The decisions were right at the time; only the triggers change.
