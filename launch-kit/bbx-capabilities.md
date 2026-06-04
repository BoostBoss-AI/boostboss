# BBX — Capabilities Reference

**Date:** 2026-05-11
**Purpose:** canonical answer to "what does BBX actually do today?" Operator reference, not marketing. Every claim below is paired with the file + line where the implementation lives, so future-you can verify before you cite anything in a sales call.

Last code audit: 2026-05-11, after Phase G ship. 253 tests passing.

---

## At a glance

BBX is an MCP-native, OpenRTB-2.6-compatible ad exchange with:

- 4 publisher integration "doors" (MCP / JS Snippet / NPM SDK / REST API)
- First-price auction with Benna ranking (heuristic + closed-loop CTR modifier)
- Per-auction audit trail covering eligibility → scoring → outcome → events → payout
- Autonomous weekly Stripe Connect payouts to publishers (Friday primary + Saturday retry)
- Operator console: campaign review, payouts dashboard, integration verification
- Recon endpoint surfacing silent-failure drift

The full chain — "advertiser deposits money → publisher serves ad → publisher gets paid" — runs unattended. Stage 1 proved it end-to-end in Stripe sandbox.

---

## 1. Inbound ad requests

Where the publisher's traffic enters BBX.

### 1.1 MCP endpoint (door 1, 2, 3 — server-side AI tools)

- **Route:** `POST /api/mcp` — JSON-RPC 2.0
- **Tool:** `tools/call → get_sponsored_content`
- **File:** `api/mcp.js`
- **Caller:** publisher's MCP server using `@boostbossai/lumi-mcp` (door 1) OR `@boostbossai/lumi-sdk` (door 3) OR direct script-tag (door 2)
- Returns a single sponsored block or `{sponsored: null, reason: ...}`.
- Auth: publisher API key in `developer_api_key` arg (also accepts `pub_*` IDs).
- Sandbox path: if credential is `pub_test_*` or `sk_test_*`, short-circuits to a fixed-rotation creative pool. See `api/_lib/sandbox.js`.

### 1.2 OpenRTB 2.6 endpoint (door 4 — REST / external DSP bidding)

- **Route:** `POST /api/rtb`
- **File:** `api/rtb.js` (710 lines)
- **Spec:** IAB OpenRTB 2.6 (Nov 2023)
- **Validation:** `imp[].id`, `imp[].native|banner|video`, full request envelope (`api/rtb.js:118`)
- **Auth:** DSP seat API key via `seats` module (`api/_lib/seats.js`)
- **Response:** `seatbid` envelope with `bid.nurl` win-notice URLs that fire `/api/rtb?op=win`
- **Status:** wired and tested, but no real external DSP is integrated yet. The endpoint is production-ready; the demand isn't there yet.

### 1.3 Per-auction rate limit

- **File:** `api/mcp.js:61`
- One auction per (publisher × session) every 3 minutes (`RATE_LIMIT_MS`). Prevents the same SDK from firing rapid-fire requests.
- Outcome: `outcome='rate_limited'` row written to `auction_logs`.

---

## 2. Eligibility filtering

For each request, the candidate pool is narrowed through a sequence of filters. Per-stage counts captured into `auction_logs.eligibility` so every drop is debuggable.

| Stage | What it does | File |
|---|---|---|
| `after_eligible` | Status=active, region match, language match, budget remaining | `api/mcp.js:484` + `api/mcp.js:137` budget check |
| `after_format_toggle` | Publisher's `format_*` flags allow this creative type | `api/mcp.js:485` |
| `after_placement_format` | Placement's format gate (banner/video/native) | `api/mcp.js:490` |
| `after_blocklist_cat` | Publisher's IAB category blocklist | `api/mcp.js:491` |
| `after_blocklist_adv` | Publisher's advertiser-domain blocklist | `api/mcp.js:492` |
| `after_door` | Campaign's `target_integration_methods` allowlist | `api/mcp.js:503` (Phase B migration 09) |
| `after_mcp` | MCP-native targeting: intent_tokens, active_tools, host_app, surface | `api/mcp.js:508` + `api/_lib/mcp_targeting.js` |
| `after_floor` | Effective CPM ≥ placement's `floor_cpm` (self-promote bypasses) | `api/mcp.js:567` |

Drop counts surfaced in `auction_logs.eligibility.drop_reasons`. When a publisher emails "my fill is low," this is where the answer is.

**Frequency capping** is per `(placement, anonymous_id, day)` via `bbx_freq_cap_count` RPC on hit. Cap value: `placements.freq_cap_per_user_per_day`. Hit → `outcome='rate_limited' no_fill_reason='frequency_capped'`.

---

## 3. Bid scoring (Benna)

For each candidate that survives eligibility, Benna produces a `p_click`, `p_convert`, signal contributions, and an effective CPM. Two scoring paths:

### 3.1 `scoreBid()` — heuristic signal model

- **File:** `api/benna.js:scoreBid`
- **Weights:** intent 0.35, tool 0.25, host 0.18, surface 0.12, keyword 0.10
- **Output:** `p_click` (mapped to [0.01, 0.12]), `p_convert` (≈ p_click × 0.25), `bid_usd`, signal contributions array
- **Closed-loop modifier** (Phase C): warm campaigns (≥100 imps in 7d, see `api/_lib/campaign_history.js`) get `p_click` multiplied by `clamp(observed_ctr / 0.02, 0.5, 2.0)`. Surfaced in result as `learning: { phase, modifier, ctr_7d, ... }`.

### 3.2 `scorePrice()` — protocol §9 CPM model

- **File:** `api/benna.js:scorePrice`
- **Formula:** `price_cpm = bid_amount × baseline_ctr × geo_mult × format_mult × intent_match × safety_mult`
- **Geo multipliers:** US 1.0, GB 0.9, JP 0.85, IN 0.20 etc. (`api/benna.js:GEO_MULTIPLIERS`)
- **Format multipliers:** tool_response 1.4, chat 1.0, sidebar 0.65, banner 0.80 (surface × format matrix)
- **Intent match:** cosine similarity over Voyage embeddings when available; Jaccard fallback. Clipped to [0.2, 1.5].
- **Safety:** `safetyMultiplier()` returns 0 (excludes) if campaign's `iab_cat` or `adomain` is in placement's blocklist, else 1.
- **Closed-loop modifier:** warm campaigns substitute `placement.baseline_ctr × clamp(ctr/0.02, 0.5, 2.0)` so high-CTR campaigns win more inventory.

### 3.3 Model version

`benna-rc5-2026.05.11` (bumped during Phase C). Pinned in `api/benna.js:MODEL_VERSION`. Returned on every score call so downstream consumers can detect upgrades.

---

## 4. Auction selection

- **Type:** first-price. Highest `effective_price_cpm` wins. Pays its own bid.
- **File:** `api/mcp.js:571`
- **Self-promote bypass:** publisher's own house ads (when `campaign.cta_url`'s domain matches the request's `host`) win before the rest, regardless of price. House ads bypass the placement floor.
- **Tie-break:** `Array.sort` is stable in V8, so older-created campaign wins on a CPM tie. Not deliberately specified; works for the volume we're at.

**No second-price auction.** Industry standard is second-price (winner pays second-highest + $0.01). Adding it is a one-day patch when demand warrants; not currently needed for direct + house ad volume.

---

## 5. Audit trail per auction

Every auction writes one row to `auction_logs` (Phase A — `db/08_auction_logs.sql`). Schema:

```
auction_id              text PRIMARY KEY
ts                      timestamptz default now()
surface                 'mcp' | 'rtb'
publisher_id            uuid
publisher_domain        text
integration_method      'mcp' | 'js-snippet' | 'npm-sdk' | 'rest-api'
is_sandbox              boolean
request                 jsonb  — host, host_app, intent_tokens, country, etc.
eligibility             jsonb  — pool_size + per-stage counts + drop_reasons
candidates              jsonb  — top-N scored with signal contributions
winner_campaign_id      text
winning_price_cpm       numeric(12,4)
outcome                 'won' | 'no_match' | 'below_floor' | 'rate_limited' | 'sandbox' | 'error'
no_fill_reason          text
latency_ms              numeric(8,2)
```

Indices on `ts`, `publisher_id`, `outcome`, `integration_method`, `winner_campaign_id` — every operator question is one query.

**Retention:** 30 days via `bbx_prune_auction_logs()` (callable from pg_cron). Schedule manually until pg_cron is enabled.

**Answers these operator questions:**
- "Who won this specific ad slot?" → `winner_campaign_id`
- "What format/door/surface?" → `integration_method` + `request.surface` + `request.format_preference`
- "Why did this campaign win?" → `candidates[]` with Benna signal contributions
- "Why didn't my campaign serve?" → `eligibility.drop_reasons`
- "How much revenue this hour?" → `SUM(winning_price_cpm * impressions / 1000)`

UI to query this: not built yet. That's Phase H Panel 3 (per-auction inspector).

---

## 6. Beacons & event ledger

When a winning ad renders, the publisher's SDK fires beacons. Each one writes to `events`.

### 6.1 Impression beacon

- **Route:** `GET /api/track?event=impression&...` (pixel) or `POST /api/track` (SDK)
- **File:** `api/track.js`
- **Idempotency:** `(auction_id, event_type)` unique partial index. Retries safe.
- **Sandbox flag:** propagated from request OR inherited from auction (Phase B).
- **integration_method:** stamped from `X-Lumi-Source` header.

### 6.2 Click beacon

- Same path; `event=click`. Click URL embeds the bbx_auc + bbx_cmp params so the conversion pixel attributes correctly.

### 6.3 Conversion beacon

Phase B added all 4 doors:

- **MCP:** `lumi.trackConversion(ad, conversion)` on `@boostbossai/lumi-mcp` (`sdk/lumi-mcp/src/index.ts`)
- **JS Snippet:** `window.Lumi.trackConversion({type, value, slot?})` (`public/lumi.js`)
- **NPM SDK:** `lumi.trackConversion({type, value, slot?})` (`sdk/lumi-sdk/src/lumi.ts`)
- **REST API:** `POST /api/track` with `event=conversion` (documented at `/docs/rest-api`)
- **Advertiser-side:** `public/pixel.js` snippet on the conversion page — auto-attributes via `bbx_auc` URL param.

### 6.4 Revenue attribution

When impression/click/conversion fires with a billable amount:

- `events.cost` = computed from `campaigns.billing_model` (cpm/cpc/cpv/cpa) × `bid_amount`
- `events.developer_payout` = `cost × (1 − BBX_RTB_FEE − BBX_NETWORK_TAKE)` (default `cost × 0.70`)
- `campaigns.spent_today` and `spent_total` are atomically incremented (`api/track.js:330`)
- Auto-pause if `spent_today >= daily_budget OR spent_total >= total_budget`
- `publisher_balance.balance` is credited via `bbx_credit_publisher_balance` RPC (Phase E Day 2, with fallback path Day 6)

Sandbox events skip all monetary paths — `cost=0`, no balance credit.

### 6.5 Pending-clawback satisfaction

Phase E Day 2 (`api/_lib/publisher_balance.js`): when an advertiser refund webhook fires, it inserts `payout_clawbacks` rows. Future paying events for that publisher consume the clawback before crediting spendable balance.

---

## 7. Autonomous payouts

Friday 12:00 UTC primary + Saturday 12:00 UTC retry sweep. Configured in `vercel.json` crons.

- **File:** `api/billing.js → handleRunPayoutCron / handleRunPayoutRetrySweep`
- **Auth:** `Authorization: Bearer ${CRON_SECRET}` (sent automatically by Vercel cron when the env var is set)
- **Eligibility query:** developers WHERE `payouts_enabled=true AND payout_blocked=false AND stripe_account_id IS NOT NULL` JOIN `publisher_balance` WHERE `balance >= $25` (Decision 3)
- **Transfer:** `stripe.transfers.create({ amount, currency: platformCurrency, destination, metadata })`. Platform currency auto-detected from `stripe.balance.retrieve()` per Day 6 fix (no longer hardcoded to USD).
- **Success path:** debit balance via `bbx_decrement_publisher_balance`, increment `lifetime_paid`, write `payouts` row at `status='paid'` with `stripe_transfer_id`.

### 7.1 Failure handling (3-tier per Decision 6)

| Tier | What | Action |
|---|---|---|
| Tier 1 | Network / Stripe timeout / transient | `payouts` row stays `pending`, Saturday cron retries. Max 3 retries before marking `failed`. |
| Tier 2 | Stripe rejection (account_invalid, destination_account_disabled, etc.) | Mark publisher `payout_blocked=true` with reason. Dashboard surfaces "Action Required" banner with `refresh_connect` button. |
| Tier 3 | >20% of attempts in a run failed | Log `bbx:payout_cron:tier3_alert`. Operator gets notified; cron continues so as not to mass-block. |

### 7.2 Fees (Decision 8)

- Standard ACH: BB absorbs `$0.25 + 0.25%` per transfer.
- Instant Payouts (publisher opt-in): publisher pays `1.5% + $0.50`, deducted from balance before transfer.

### 7.3 Refund clawback (Decision 7)

When `charge.refunded` webhook fires:
- `api/billing.js → fireRefundClawbacks` looks up every campaign-attributed event for the refunded charge
- Pro-rates the refund across publishers by their share of total spend
- Tries to deduct from balance first; if insufficient, writes `status='pending'` clawback row that future earnings satisfy.

---

## 8. Operator console (admin dashboard)

Route: `/admin`. Six panels:

| Panel | What | Built in |
|---|---|---|
| Overview | Stats summary | pre-Phase A |
| Review Queue | Approve / reject campaigns awaiting review | pre-Phase A |
| All Campaigns | List every campaign with status filter | pre-Phase A |
| DSP Seats | External DSP onboarding for `/api/rtb` | pre-Phase A |
| Users | Read-only count of advertisers + publishers | pre-Phase A |
| **💸 Payouts** | Phase E Day 4: cron health, blocked publishers, recent payouts, manual retry/unblock, manual cron trigger | Phase E |

Auth: each admin action validates `Authorization: Bearer ${ADMIN_TOKEN}` (Phase E Day 4).

**Not yet built (Phase H):**
- Live activity panel (auctions/min, fill rate, top winners, by-door breakdown)
- Per-auction inspector (paste auction_id, see full story)
- Money flow extension (deposits + revenue + BB share alongside payouts)
- Anomaly detection panel

---

## 9. Recon / observability

- **Endpoint:** `GET /api/stats?type=recon`
- **File:** `api/stats.js`
- **Auth:** none (public — operational metric)
- **Phase A:** auction-wins vs. impressions ratio for prod + sandbox. Orphan-wins detection (wins with no matching impression beacon).
- **Phase B:** clicks and conversions counts + CVR per environment.
- **Phase E Day 2:** `publisher_balance_health` — flags drift between balance and `lifetime_earned − lifetime_paid − pending_clawback` > 1% AND > $0.50.
- **Phase E Day 4:** `payout_cron_health` — last-run summary, pending/Tier-1/Tier-2/blocked counts, eligible-for-next-run count.

Daily cron at 02:00 UTC. Outputs to Vercel logs as `bbx:recon:ok` (clean) or `bbx:recon:alert` (issues).

---

## 10. What BBX does NOT do today

Being explicit about scope decisions and known gaps:

| Capability | Why it's missing | When to add |
|---|---|---|
| Second-price auction | Wasn't needed for direct + house demand | When external DSP bidding goes live |
| Bid pacing | Volume too low to need it | First time a campaign blows its daily budget in 2 hours |
| Click-fraud detection (IP repetition, bot-pattern matching) | No fraud signal at low volume | Within 90 days of first 10k impressions/day sustained |
| External DSP demand | OpenRTB endpoint exists; no seats integrated | Phase 2 of the build plan (post-outreach) |
| ML-based ranking | Benna is heuristic + closed-loop heuristic; learned model gated on volume | At ~100k impressions/day cumulative (per project_instructions) |
| A/B testing infrastructure | Speculative; build when you have a hypothesis to test | When you need to compare a Benna variant against current |
| Reserve / holdback on payouts | Decision 7 — no reserve at launch | When chargeback rate exceeds 1% |
| Multi-currency settlement | Decision 4 — USD only at launch | When a non-USD advertiser shows up |
| Real-time campaign management API (mutations) | Read-only public API only | Phase 2 (advertiser MCP server) |
| Bulk publisher import / partner onboarding | One-publisher-at-a-time onboarding | Phase 2 when you have 100+ pending |
| TAG-ID / DUNS / sellers.json real entries | Placeholder values in current `ads.txt` / `sellers.json` | Pre-real-DSP-integration |
| Anomaly alerting (email/Slack on Tier-3, fill-rate cliffs) | Recon endpoint detects; no notification wiring | Phase H Panel 4 — needs traffic baseline |
| Webhook fan-out to publishers (conversion postbacks) | Conversions write to `events`; no outbound webhook | When a publisher asks for it |

---

## 11. Per-question quick reference

When the operator needs to answer a specific question, here's the file or table to look at.

| Operator question | Where to look | API / SQL |
|---|---|---|
| "Is the network healthy right now?" | `/api/stats?type=recon` | curl, check `production.alert`, `payout_cron_health` |
| "Why didn't my campaign serve?" | `auction_logs.eligibility.drop_reasons` | `SELECT eligibility FROM auction_logs WHERE auction_id = ...` |
| "Who won this slot?" | `auction_logs.winner_campaign_id` | same query |
| "Why did this campaign win?" | `auction_logs.candidates[]` JSON | same query |
| "What's a publisher's balance?" | `publisher_balance` table | `SELECT * FROM publisher_balance WHERE developer_id = ...` OR `GET /api/billing?action=payout_status&developer_id=...` |
| "When does this publisher get paid?" | `payout_status` endpoint | same — returns `next_payout_eta` |
| "Did this advertiser deposit?" | `transactions` table | `SELECT * FROM transactions WHERE advertiser_id = ... AND type = 'deposit'` |
| "Did Friday's cron run successfully?" | Vercel logs | grep `bbx:payout_cron:ok` or `bbx:payout_cron:tier3_alert` |
| "What's my MRR?" | aggregate `events.cost` by month, multiply by `BBX_RTB_FEE + BBX_NETWORK_TAKE` (default 0.30) | SQL query |
| "Are any beacons being dropped silently?" | Vercel logs | grep `bbx:track:write_fail` |

---

## 12. The single-line summary

BBX today is a working ad exchange running on Vercel + Supabase + Stripe. Real-money flow proved end-to-end in sandbox. Per-auction audit trail is complete. Autonomous payouts run unattended. Operator console covers about 30% of what's needed at hundreds-of-thousands-of-impressions/day scale — the remaining 70% is Phase H work, queued.

Strategically: nobody else has built the supply side of MCP advertising. BBX has. That's the moat. Capabilities listed above are what you have to defend it with.
