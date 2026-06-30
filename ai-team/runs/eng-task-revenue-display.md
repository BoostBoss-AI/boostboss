# Engineering Task (Peter) — align revenue-share display & default

Priority: medium · Owner: Engineering (Peter) · Deploy gated (Andy pushes).

## Problem
The payout engine pays publishers ~70% (TAKE_RATE = 6.5% RTB + 23.5% network) — correct. But the
developer dashboard + DB default advertise **85%**, which is wrong and (per policy) must never be public.

## Changes
1. **Remove the revenue-share / split ratio from all public + marketing pages.** e.g. `public/developer.html`
   uses `revenue_share_pct || 85` in several spots and a hardcoded `0.70` RPM estimate (~line 5203).
   The ratio belongs ONLY in the signed Terms/contract. **Careful callsite audit first** —
   developer.html has a blank-page history; grep top-level (not function-body) uses before deleting any
   `const X = document.getElementById(...)`.
2. **Fix the misleading default:** `db/deploy.sql` and `supabase-schema.sql` set `revenue_share_pct
   DEFAULT 85` (legacy 65 also present). Set it to match the engine (70) or stop surfacing it — do not leave 85.
3. **Keep the engine as-is:** 6.5% RTB + 23.5% network (standard). Benna optimization fee is variable
   15–23.5%; if variable pricing is implemented later, the take floor is 6.5% + 15% = 21.5%.
4. **Mike (Finance):** confirm the solvency invariant holds across the 21.5–30% take range.

## Verify
- No revenue-share % appears anywhere outside the Terms.
- `tests/billing.test.js` still passes (70/30 default).
- Deploy gated → Andy runs `git push origin main`.
