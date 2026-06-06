# V1 Build Sprint — Scope locked 2026-06-05 night

**Sprint kicks off:** 2026-06-06 morning
**External clock:**
- Payoneer verification: 2 business days (Mon-Tue Jun 8-9)
- E.SUN bank account: ~1 week (~Jun 12)
- PayPal KYB: indeterminate

**Build sequence designed around external clocks** — by the time externals clear, the code is sandbox-validated and ready to flip on.

---

## What's in v1 (locked)

### Backend / Data Layer

1. **Transaction infrastructure**
   - DB migration: `payout_batches` + `payout_batch_items` tables
   - DB migration: `transactions` table support for `provider='internal'` (publisher→advertiser internal transfers)
   - DB migration: `advertisers.signup_source` + `advertisers.linked_publisher_id` columns
   - Indexes for time-bucketed aggregation queries (impressions, costs, payouts by hour/day/week/month/quarter)

2. **Payoneer Mass Payouts API integration**
   - `api/_lib/payout/payoneer.js` — OAuth + Submit Payouts + Status + Validate
   - Demo-mode discipline (mirror of `paypal.js` pattern)
   - Env-gated: `PAYONEER_CLIENT_ID` + `PAYONEER_CLIENT_SECRET` + `PAYONEER_PROGRAM_ID`
   - No automation — admin-triggered batch generation + submission only

3. **Backend aggregation endpoints**
   - `api/billing.js?action=admin_money_summary&bucket=hour|day|week|month|quarter`
   - `api/billing.js?action=admin_advertiser_detail&id=...`
   - `api/billing.js?action=admin_publisher_detail&id=...`
   - `api/billing.js?action=admin_search&q=...` (search by email/id across both)
   - All queries must JOIN through `linked_publisher_id` so cross-pollination data is available from day 1

4. **Internal transfer endpoint**
   - `api/billing.js?action=transfer_publisher_to_advertiser` — atomic balance debit (publisher) + credit (advertiser) + transactions row with `provider='internal'`
   - Bookkeeping integrity: both events recorded as separate journal entries even though no real money moves (Taiwan corporate tax requirement)

5. **Self-buying prevention rule**
   - Auction filter: `WHERE campaign.advertiser_id NOT IN (SELECT advertiser_id FROM advertisers WHERE linked_publisher_id = $current_publisher_id)`
   - Applied at bid eligibility stage so publishers' own campaigns never win their own placements

### Admin Surface (`/admin`)

6. **Money tracking section** (new)
   - Time bucket toggle: hour / day / week / month / quarter
   - Search box: advertiser or publisher (email/id)
   - Per-publisher view: withdrawable balance, pending payout, lifetime earned, internal transfers to own advertiser account
   - Per-advertiser view: deposited (PayPal), received internally (from linked publisher), spent, current balance
   - Platform aggregates: total deposits, total internal transfers, total ad spend, BB take realized (30%)
   - Drill-down: click row → transaction history

7. **Payout batch UI** (new)
   - "Generate Batch" button → builds reviewable batch from publishers with withdrawable balance ≥ $100
   - Per-row edit (exclude, adjust amount)
   - Show net withdrawable (publisher balance minus amounts internally transferred to their advertiser account during the period)
   - "Submit to Payoneer" → triggers Mass Payouts API
   - Batch history + status (pending / submitted / completed / failed)
   - Manual retry for failed line items

### Advertiser Dashboard (`/ads/dashboard`)

8. **#/usage — NEW route, deep analytics** (the "transparent detail analytics" positioning piece)
   - Per-impression event timeline (timestamp, publisher, door, creative variant, won bid, context, Benna score, fired beacons)
   - Per-creative breakdown (CTR, CPA, CPC, time-of-day heatmap per variant)
   - Per-placement-door performance (MCP / JS / NPM / Bot)
   - Per-publisher performance (which publishers' inventory converts best for advertiser's campaigns)
   - Real "cost per actual result" — not blended estimate
   - Auction inspect (where ethically permissible)
   - Time-bucket toggles (hour/day/week/month)
   - CSV/JSON export from every view
   - "Why this ad?" Benna reasoning surfaced
   - **Must handle `linked_publisher_id` correctly** — when a publisher-advertiser views their own analytics, system shouldn't double-count or expose other advertisers' data

9. **#/billing — add Invoice section**
   - Existing deposit + payment method sections stay
   - Add: list of past invoices (date, amount, provider — PayPal/internal, downloadable PDF)
   - Each invoice shows: gross deposit + RTB exchange fee + processing fee = total charged
   - Internal-transfer-funded "deposits" get a distinct invoice type ("Funded from publisher earnings") — same accounting integrity, different label for clarity

### Publisher Dashboard (`/publish/dashboard`)

10. **#/payouts — add Withdrawal History section**
    - Existing balance + next-payout-date stays
    - Add: table of past payouts received (date, amount, Payoneer txn ID, status)
    - Lifetime earned cumulative number at top
    - Show net (lifetime earned minus amounts internally transferred to own advertiser account)

11. **NEW sidebar item: "Promote"** (Publisher-as-Advertiser flow)
    - Top-level sidebar item — not nested under anything
    - 5-screen simplified flow:
      1. Header strip: available balance + "Create campaign" CTA
      2. Active campaigns list (mini cards: name, spend, impressions, click count, basic status)
      3. Create campaign form (~6-8 fields):
         - Destination URL (their product)
         - Creative (image + headline + 1-line body)
         - Targeting dropdown (AI tools / Coding / Productivity / Research / etc. — match existing publisher categories)
         - Daily budget
         - Funding source dropdown: "Use earnings ($X available)" (default if balance sufficient) OR "Add funds via PayPal"
      4. Per-campaign drill-down (summary analytics card → link to full /usage view)
      5. Graduation link: "Want full advertiser features? Open advertiser dashboard →" routes to `/ads/dashboard`
    - First time a publisher clicks "Promote":
      - Backend auto-provisions a linked advertiser row (`signup_source='publisher_linked'`, `linked_publisher_id=<publisher_id>`)
      - Copies email + company name from publisher profile
      - No separate signup form
    - Same advertiser_id used everywhere (full /ads/dashboard is just the alternate view of the same account)

### Tests

12. **`tests/billing-payoneer.test.js`** — Payoneer wrapper, batch generation, submission flow, demo mode
13. **`tests/billing-internal-transfer.test.js`** — publisher→advertiser transfer atomicity, accounting journal integrity, self-buying prevention
14. **`tests/usage-analytics.test.js`** — per-impression timeline correctness, linked_publisher_id join correctness, CSV export shape
15. **Existing tests must still pass** — billing, billing-paypal, campaigns, track, etc.

---

## Build sequence — designed around the external clocks

| Day (est.) | Scope | External dependency at end of day |
|---|---|---|
| Day 1 (Sat Jun 6) | DB migrations (payout_batches, transactions provider='internal', advertisers schema additions, indexes) + backend aggregation endpoints + internal transfer endpoint | none |
| Day 2 (Sun Jun 7) | `/admin` money tracking section (time buckets, search, drill-down) | none |
| Day 3 (Mon Jun 8) | `/admin` payout batch UI (generate + review + submit) + Payoneer client wrapper (`api/_lib/payout/payoneer.js`) | **Payoneer verification expected to clear** |
| Day 4 (Tue Jun 9) | `/ads/dashboard#/usage` deep analytics surface (the positioning differentiator — extra effort here) | |
| Day 5 (Wed Jun 10) | `/publish/dashboard#/payouts` withdrawal history + `/ads/dashboard#/billing` invoice section + self-buying prevention rule | |
| Day 6 (Thu Jun 11) | "Promote" sidebar item — UI + auto-provisioning + simplified create flow | |
| Day 7 (Fri Jun 12) | Tests + integration validation + admin observability for cross-account campaigns | **E.SUN bank account expected ready** |

Sandbox-validated end-to-end by end of Day 7. Whenever PayPal KYB clears, flip env vars → Live, do first real deposit, validate full loop.

---

## Open decisions to confirm before Day 1

1. **Payout threshold** — keep `$100` (current `BBX_MIN_PAYOUT`) or change?
2. **Invoice format** — PDF download (needs PDF library) or HTML invoice that prints cleanly?
3. **"Promote" sidebar label** — current lean is "Promote." Alternatives: "Advertise" / "Grow" / "Get Users". Confirm.
4. **Targeting categories** for the Promote dropdown — should they match the existing publisher categories, or a simpler subset?
5. **Funding source default behavior** — auto-default to "Use earnings" if balance ≥ campaign budget, OR always make the publisher pick?

Andy to answer these on Saturday morning before code begins.

---

## NOT in v1 (still deferred per POST-LAUNCH-ROADMAP-2026-06-05.md)

- PayPal Vault / Reference Transactions (Day 60+)
- PayPal Smart Buttons SDK (bundled with Vault)
- PayPal APMs (Day 1 of Live, just settings)
- Real Benna AI ML (>1k impressions/publisher/day trigger)
- Brand Deals product (first brand asks)
- Advertiser-side MCP server (~3 months post-launch)
- TOTP 2FA (Catalyst #1 trigger)
- IAB TAG-ID / DUNS (housekeeping in parallel — DUNS application starts now)
- Trademark filings (after availability check)
- Phase H Panels 1/2/4 (repeated workflow signal trigger)
- Scale prep (50k/day sustained trigger)

---

## Housekeeping in parallel (no code, < 2 hrs total)

- [ ] Trademark availability check (USPTO TESS + EUIPO + JPO + WIPO)
- [ ] DUNS application at dnb.com
- [ ] Rotate exposed PayPal Live secret
- [ ] Create info@/support@/billing@ in Google Workspace
- [ ] Reserve PyPI namespace + Chrome Web Store dev account

---

**End of v1 sprint scope. Tomorrow we build.**
