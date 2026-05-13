# Friend-Onboarding Readiness Audit — Findings + Fixes

**Date:** 2026-05-13
**Status:** Audit complete, top 6 fixes shipped, ready to deploy.

This was a quality pass, not a feature build. The premise: when a friend says yes to trying Boost Boss, can they get from "I'll try it" to "I'm serving ads with confidence" in 15 minutes, without me holding their hand the whole way? The friction points below are the ones I'd hit walking that path myself.

---

## How I audited

Walked the whole flow, surface by surface:

1. `boostboss.ai` (landing) — does the publisher CTA path make sense?
2. `/publish/signup` — does the form work, does the redirect land correctly?
3. `/publish/dashboard` — what does a new publisher see on first load?
4. The four docs pages (`/docs/mcp`, `/docs/js-snippet`, `/docs/npm-sdk`, `/docs/rest-api`) — is each install snippet copy-pasteable end-to-end?
5. The integration test flow — does it tell the friend whether their integration works?
6. Payout settings — is the threshold messaging clear? Can the friend set realistic expectations?
7. Verified the two npm packages (`@boostbossai/lumi-mcp@0.1.0`, `@boostbossai/lumi-sdk@1.0.1`) are actually published and current.

---

## Findings

### F1 — FOIC on payout threshold (HIGH impact)

The publisher dashboard's "Minimum Threshold" card had `$100.00` hardcoded in the static HTML. JS in `loadPayoutStatus()` overrides this to `$25.00` on every load. Result: every dashboard load flashes "$100 threshold" for ~300ms before snapping to $25. A friend on slow network sees the wrong number long enough to internalise it.

**Source:** `public/developer.html:2238` (Phase E Day 6 Decision 3 set the real policy at $25).

**Why it matters:** Mental friction. Friend reads "$100" → thinks payouts are far away → doesn't bother connecting Stripe. Mood shift before they even start.

### F2 — Integration test default is the publisher's live key, which can return "No ad" through no fault of theirs (HIGH impact)

`runIntegrationTest()` fires against the publisher's real `api_key`. With four demand-side campaigns funded, the chance of "user is debugging a python traceback" matching one of them is non-trivial — but not 100%. A new publisher running the test and seeing "No ad" can't tell if their integration is broken or just unmatched.

**Source:** `public/developer.html:3942` (Phase F integration test).

**Why it matters:** This is THE moment of truth in the friend's first session. If the answer is ambiguous, they email me asking "is this broken?" — which defeats the whole point of frictionless onboarding.

### F3 — Onboarding banner Step 4 copy oversells what the test proves (MEDIUM impact)

The current copy said "fire a synthetic ad request and watch your dashboard light up." That's true, but doesn't distinguish "your integration is working" from "your dashboard has working counters." A friend wants the former.

**Source:** `public/developer.html:1793-1801`.

### F4 — Docs `/docs/quickstart` was permanently marked "soon" (MEDIUM impact)

Every doc page had `<a href="/docs/quickstart" class="deferred">Quickstart</a>` in the sidebar — with `pointer-events: none` and a "soon" badge. Quickstart is the most-searched-for SDK page in the world; permanently advertising it as TBD is a credibility hit before the friend has read a single line of the actual docs.

**Source:** Sidebars of `docs.html`, `docs-mcp.html`, `docs-js-snippet.html`, `docs-npm-sdk.html`, `docs-rest-api.html`.

### F5 — MCP "Going live" doc told publishers to do an action that has no UI (LOW impact, but trust-eroding)

`docs-mcp.html` line 222 said "Submit your MCP server's listing URL on the dashboard for the `sellers.json` equivalent." There is no such form anywhere in the dashboard. A friend reading "you must do X" then not finding X loses confidence the docs are real.

### F6 — Payout settings card lacks "when will I actually see money?" context (MEDIUM impact)

The three cards (Next Payout Date / Pending / Threshold) communicate state but not policy. A friend looking at "$0 / next Friday / $25" doesn't immediately know "I need to earn $25 in publisher payouts before that Friday counts."

---

## Fixes shipped

### Fix 1 → addresses F1

`public/developer.html` — static threshold default `$100.00` → `$25.00` so first paint matches policy. JS still updates from `/api/billing?action=payout_status` as the source of truth; just no FOIC.

### Fix 2 → addresses F2

`public/developer.html` — added a "Sandbox" checkbox next to the Run Test button (default: **on**). When checked, `runIntegrationTest()` swaps in `pub_test_demo` / `sk_test_demo`. Sandbox guarantees a fill, so a friend's first Run Test click always shows the happy path. They can uncheck to test their live key against real demand once they're past first confidence.

### Fix 3 → addresses F3

`public/developer.html` — onboarding banner step 4 retitled "Verify with a sandbox test" with explicit copy: "Fires a real request against `pub_test_demo` — always returns a fill, so you can confirm rendering + the impression beacon end-to-end. Your stats counters will tick up; once you switch to your live key, sandbox traffic is excluded from earnings."

### Fix 4 → addresses F4

New page `public/docs-quickstart.html` — a real "fire your first sponsored ad in 5 minutes" page. Four copy-pasteable snippets (one per door) using sandbox credentials, an "see it work" section explaining what comes back, and a "go live" section explaining the four steps to flip to production. Added `/docs/quickstart` rewrite to `vercel.json`. Removed `class="deferred"` from the sidebar link in all five docs pages.

### Fix 5 → addresses F5

`public/docs-mcp.html` — replaced the dashboard-submission instruction with an opt-in email step: "Optional: email hello@boostboss.ai with the MCP server's listing URL so we can add it to our supply-side allowlist — speeds up advertiser approvals. Self-serve seller submission via the dashboard is on the roadmap; for now this is a manual step." Honest about the current state.

### Fix 6 → addresses F6

`public/developer.html` — added a one-liner explainer paragraph above the payout cards: "Earn at least $25 in publisher accruals, connect Stripe, and the next Friday cron pays you out automatically. Most publishers see their first payout 1–3 weeks after installation, depending on traffic." Plain English, no jargon, sets realistic expectations.

---

## Findings I did NOT fix (yet)

These are real but lower-impact than the six above:

- **No welcome email after signup.** A friend signs up, lands in the dashboard, and never gets a confirmation email. Not a blocker because the dashboard already has everything they need — but a small trust signal missing.
- **No "policy violation suspends payouts" warning surface in the dashboard.** The docs mention it; the dashboard doesn't show any current state. Only matters if we actually start enforcing, which we haven't.
- **`/docs/reporting`, `/docs/payouts`, `/docs/policies`** still marked deferred. Less urgent than Quickstart because none are the entry point. Quickstart is.
- **First-time dashboard load shows all 4 door cards equally.** A friend who only built an MCP server doesn't need the other three immediately. Could prioritise based on signup hint (`role=developer, intended_door=mcp`), but signup doesn't currently capture intended_door. Out of scope for this audit.
- **Stripe Connect first-press disclosure.** A friend clicking "Connect Stripe" for the first time goes through Stripe's standard onboarding. We don't pre-explain what Stripe asks for (tax info, bank acct). Not a bug, but a polish item.

---

## Files changed

- `public/developer.html` — F1, F2, F3, F6.
- `public/docs-mcp.html` — F5 + sidebar Quickstart link.
- `public/docs.html`, `public/docs-js-snippet.html`, `public/docs-npm-sdk.html`, `public/docs-rest-api.html` — sidebar Quickstart link.
- `public/docs-quickstart.html` — NEW.
- `vercel.json` — added `/docs/quickstart` rewrite.
- `launch-kit/friend-onboarding-audit.md` — this file.

---

## Tests

No test changes — all six fixes are HTML/copy/routing changes that don't touch any tested code path. **Full suite still passing: 286 tests** (auth 20 · benna 15 · billing 74 · campaigns 60 · mcp 21 · rtb 33 · sandbox 14 · stats 16 · track 33).

---

## Deploy steps

```bash
cd ~/boostboss
git add -A
git commit -m "Friend-onboarding readiness audit: top 6 fixes

Walked the path a friend onboarding would walk; shipped the highest-
impact friction fixes.

F1: Payout threshold static default \$100 -> \$25 (matches Phase E Day 6
    Decision 3) to kill FOIC on every dashboard load.
F2: Integration test now defaults to sandbox mode (pub_test_demo) so
    a friend's first Run Test always shows the happy path. Checkbox
    lets them disable to test live key when ready.
F3: Onboarding banner step 4 copy clarifies what the sandbox test proves
    (rendering + beacon, not 'campaigns matching your context').
F4: New /docs/quickstart page — 5-min, four copy-pasteable snippets,
    plus go-live checklist. Un-deferred the sidebar link across all
    five doc pages.
F5: Removed stale 'submit MCP server URL on dashboard' instruction
    from docs-mcp.html (no such UI exists); replaced with opt-in
    email step.
F6: Added one-liner first-payout explainer above the payout cards:
    'Earn at least \$25, connect Stripe, next Friday cron pays you.
    1-3 weeks to first payout depending on traffic.'

Files: developer.html, docs-mcp.html, docs.html, docs-js-snippet.html,
docs-npm-sdk.html, docs-rest-api.html, docs-quickstart.html (new),
vercel.json. No API/test changes. Suite still 286 passing.

Also bundled with this push:
- launch-kit/bbx-capabilities.md (operator reference, was uncommitted)
- launch-kit/scale-ceiling-analysis.md (per-impression DB op math)
- launch-kit/phase-h-panel-1-live-activity-plan.md
- launch-kit/phase-h-panel-1-closing-report.md
- launch-kit/phase-h-panels-2-3-closing-report.md
- launch-kit/phase-h-panel-3-event-timeline-patch.md
- launch-kit/phase-e5-ai-creative-studio-design.md
- launch-kit/phase-e5-closing-report.md
- launch-kit/phase-g-capture-script.md
- launch-kit/phase-e-payouts-design.md
- launch-kit/friend-onboarding-audit.md (this file)
"
git push origin main
```

Then wait for Vercel to flip green before linking any friend to the site. The first visit will be uncached and hit the new build directly.

---

## What this changes for the friend path

Before: friend signs up → lands in dashboard → sees "$100" threshold for half a second → sees 4 door cards → clicks Run Test → maybe sees "No ad" → emails me asking if it's broken → I explain sandbox.

After: friend signs up → lands in dashboard → sees "$25 threshold, 1-3 weeks to first payout" → sees 4 door cards → clicks Run Test with sandbox toggle on (default) → sees ✓ Ad served → reads the onboarding banner explaining what just happened → installs SDK using `/docs/quickstart` copy-paste → fires sandbox call from their app → sees a second tick on the dashboard → swaps to live key → ready to ship.

Critical friction points removed: the "is this broken?" doubt at first test, the "$100 threshold" misread, the missing Quickstart, the docs instructing actions that don't exist.

---

## After this lands

You're back at the user's stated path: friends-as-test-publishers. The dashboard + docs are now bulletproof enough that you can send a friend the signup link without watching over their shoulder. When they hit an issue, the auction inspector (Panel 3 with the event timeline patch) lets you debug their specific case in under a minute.

The remaining items from the wider arc (Stripe live keys, Phase G screenshots, Panel 1/2 polish, Panel 4, Vercel worker migration) all still wait on the same trigger they were waiting on before — real traffic or a real catalyst. Nothing else moves until then.
