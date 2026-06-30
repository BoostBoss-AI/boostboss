# Spec — Cold-Start Build Roadmap

Turns `cold-start.md` into a phased engineering plan. Every deploy is gated (Andy pushes). Build in
order — each phase is shippable on its own. Owners: Engineering (Peter), Finance (Mike), Benna.

## Phase 1 — Calibration foundation (Peter + Benna)
The minimum to make matched-calibration real.
- Add publisher `status`: `calibrating` → `live`, with an `impressions_calibrated` counter and a
  configurable **graduation threshold** (impressions, not DAU).
- Add advertiser/campaign `status`: `calibrating` (free) → `paid`.
- **Two-pool routing** in the serve/auction path: free (calibrating) campaigns may only fill
  *calibrating* publisher inventory; paid campaigns only fill *graduated* publishers. Never cross.
- Benna: a basic fraud/validity check during calibration before graduation.
- Verify: no payout is ever computed for a calibrating publisher; tests cover the routing matrix.

## Phase 2 — Credits model (Peter + Mike)
- Extend the existing ad-credit / promote-loop into a first-class **credit ledger** (balance, top-up,
  spend, auto-reload).
- **Free starter credits** granted on advertiser signup (funds the calibration period).
- Keep transparent accounting: every credit maps to real CPM/CPC/CPA + dollar value (never hide ROI).
- Mike: confirm the solvency invariant holds (credits spent ≤ cleared funds; payouts only from cleared).

## Phase 3 — Billing & usage dashboard (Peter)
- Build per `specs/dashboard-billing-usage.md` — role-aware (publisher / advertiser / dual-sided).
- Earnings + ad-credits cards, usage bars (impressions served, credits used), category-ratio bar,
  activity list, per-impression receipt link.
- Careful `developer.html` callsite audit; hash-route 3-edit rule; light/dark.

## Phase 4 — Advertiser calibration / Benna warm-up (Benna)
- A "learning period" where Benna optimizes against early impressions before charging; surface the
  calibration state + "free while we learn" in the campaign UI.
- Graduate the campaign to paid once Benna has enough signal.

## Sequencing note
Phases 1–2 unblock the cold-start engine (calibration + credits). Phase 3 makes it legible to users.
Phase 4 is the optimization polish. Don't gate launch on Phase 4.

## Activation
Build is **armed but not urgent** until the beachhead has real publisher candidates entering onboarding.
Trigger Phase 1 when the first study-cluster publishers are ready to install.
