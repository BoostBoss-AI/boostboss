# Handoff: Boost Boss Marketing & Brand System

> Developer handoff for the Boost Boss marketing-surface redesign + design system.
> **Scope of this handoff: everything EXCEPT the two product dashboards** (`/ads/dashboard`, `/publish/dashboard`), which remain your existing wired production code (`developer.html` / `advertiser.html` + `dashboard-shell.css`) and are intentionally not part of this package.

## Overview
A complete, animation-driven redesign of the Boost Boss marketing funnel plus the brand design system that powers it: tokens, reusable components, and 13 full HTML surfaces (marketing + auth), all in one dark, motion-forward language and wired into a browsable click-through.

## About the design files
The files in this project are **design references created in HTML** — high-fidelity prototypes that show the intended look, motion, and behavior. They are **not** meant to be shipped verbatim. The task is to **recreate these designs in your target environment** (React/Next, etc.) using your established patterns, then keep the shared CSS tokens as the source of truth for color/type/spacing/motion.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, motion, and copy. Recreate pixel-faithfully. All values are tokenized in `styles.css` → `tokens/*.css` — pull from those rather than hardcoding.

## Design tokens (source of truth)
Linked via the single entry point **`styles.css`** (a manifest of `@import`s). Full values in `tokens/`:
- **`tokens/colors.css`** — brand (`--bb-pink #FF2D78`, `--bb-pink-dark #E01E65`, electric `--bb-cyan #00FFE0`, legacy link `--bb-cyan-link #04BEFE`, `--bb-yellow #FFE600`), ink ramp (`--bb-ink #0F0F1A` → `--bb-ink-800 #1A1A2E`, `--bb-ink-soft`, `--bb-muted`), dark-surface ramp (`--bb-surface-0 #0B0B14` → `-3`), cream `--bb-bg-soft #FAFAF7`, semantic status, and gradients (`--grad-brand`, `--grad-pink`, `--grad-aurora`).
- **`tokens/typography.css`** — `--font-display` Space Grotesk, `--font-body` Inter, `--font-mono` JetBrains Mono; fluid scale (`--fs-display-xl` clamp(44px,6vw,84px) … `--fs-body 16px`), weights, tracking.
- **`tokens/spacing.css`** — 4px spacing scale, container (1200px), radii (`--r-sm 8` … `--r-2xl 24`, `--r-pill 100px`), shadows (soft `--shadow-md/lg/xl`, hard-offset `--shadow-pop`, colored `--glow-pink/cyan`), z-index.
- **`tokens/motion.css`** — easings (`--ease-out`, `--ease-spring`, `--ease-snappy`), durations, frosted-glass + mesh recipes (`--mesh-cream`, `--mesh-dark`), and the `[data-reveal]` scroll primitive.
- **`tokens/fonts.css`** — the three families via Google Fonts `@import` (no local binaries).

## Components (reusable primitives)
React + inline-style, styled via the CSS custom properties above. Each has a `.d.ts` (props) and `.prompt.md` (usage):
- `components/core/Button.jsx` — variants `primary | outline | ghost | ghostDark | white`; sizes `sm|md|lg`; renders `<a>` if `href`, else `<button>`; `iconLeft/iconRight`.
- `components/core/Badge.jsx` — `tone` (pink/cyan/yellow/success/warn/neutral), `variant` (soft/solid/outline), `uppercase` (eyebrow), `dot` (live pulse).
- `components/core/Card.jsx` — `variant` soft | pop (neo-brutalist hard-offset) | glass (dark) | flat; `hoverable`.
- `components/navigation/Navbar.jsx` — fixed marketing nav, `theme` dark|light, frosted-on-scroll, optional `lumiMark`; also exports `RocketMark`, `LumiMark`.
- `components/navigation/Footer.jsx` — multi-column footer, `theme` light|dark.

## Screens / Views
All under `ui_kits/marketing/`. Shared system: fixed frosted nav, dark aurora `page-fx` background + grain, animated gradient `divider`s, partner `marquee`, scroll `[data-reveal]` (with directional `left/right/scale` variants), `data-parallax` on visuals, count-up KPIs, pink CTA boxes, multi-column footer. **Cross-linked into one funnel.**

1. **`Homepage.html`** — aurora hero (particle-network canvas, parallax two-sided marketplace stage, staggered mask-reveal headline) → partner marquee → publisher & advertiser feature rows (dark glass cards, gradient-glow borders) → **pinned/scroll-scrubbed Benna intent decoder** (chips light up as you scroll the sticky panel) → glowing stats band → pink CTA → footer.
2. **`Publish Landing.html`** — Mintegral-style publisher hero with a live-earnings panel, four-surface install router (door cards link to the surface pages), why grid, honest "not a fit" section, CTA.
3. **`Lumi - Computer App.html` / `Lumi - Browser App.html` / `Lumi - Browser Extension App.html` / `Lumi - Mobile App.html`** — the four publisher surface pages; each has its own accent (pink/cyan/yellow/magenta), a device/window or phone mockup with an in-context sponsored unit, placements grid, format spotlight, specs, CTA. Cross-nav between them; brand logo → publish landing.
4. **`Ads Landing.html`** — SuperBoost advertiser landing (cyan accent): "Spend on ~~cookies~~? Spend on intent." hero with a live campaign-console mockup, intent-targeting explainer, six-pillar Trust & Transparency grid, performance stats, CPM/CPC/CPA pricing, CTA.
5. **`About.html` / `Pricing.html` / `Trust.html` / `Exchange.html` / `Demo.html`** — company story + four pillars; itemized pricing "receipt" ($1 → 6.5% RTB fee → 23.5% take → 70% publisher) + models; trust pillars + IAB compliance; BBX OpenRTB 2.6 with a bid-request code block; Benna live-inspector demo.
6. **Auth** — `Ads Signin.html`, `Ads Signup.html`, `Publish Signin.html`, `Publish Signup.html`: AppLovin/Seedtag-style split-screen (branded aurora panel + form), OAuth (Google + SSO/SAML for ads, Google + GitHub for publish), dark focus-accented inputs, password show/hide. Every marketing CTA routes into the matching auth page.

## Interactions & behavior
- **Entrance/scroll animations are gated** so the visible resting state is the final state: hidden-initial styles live under `html.anim`, and a tiny inline script adds `.anim` only when `document.visibilityState === 'visible'` && motion is allowed; a `html:not(.anim) … { opacity:1 !important }` block forces visible everywhere else (print, export, paused tab). **Replicate this gating** so content never gets stuck invisible.
- Scroll reveals via `IntersectionObserver` toggling `.is-visible`; parallax + nav-frost + the pinned decoder scrub run off one passive `scroll` handler computing element-rect progress.
- Hover: lift `translateY(-2/-3px)` + intensified glow; press: `scale(0.97)`. `prefers-reduced-motion` collapses all motion.
- Particle network = `<canvas>` (proximity-linked dots in brand colors). Marquees are CSS keyframe loops (pause on hover).

## Assets
- `assets/rocket-logo.svg` — the rocket brand mark / favicon (also inlined in `Navbar.jsx` as `RocketMark`). The only bespoke illustration — reuse it, don't redraw.
- **Icons:** the codebase has no icon font; inline stroke SVGs are used ad hoc (~1.8px weight, rounded caps). Recommended CDN substitute for new work: **Lucide**.
- Fonts: Space Grotesk, Inter, JetBrains Mono (Google Fonts).

## Files
- `styles.css` (entry) + `tokens/*.css` — design tokens
- `components/core/*`, `components/navigation/*` — primitives (+ `.d.ts` / `.prompt.md`)
- `ui_kits/marketing/*.html` — the 13 surfaces above
- `guidelines/*.html` — foundation specimen cards (color/type/spacing/brand)
- `readme.md` — full brand/voice/visual guide; `SKILL.md` — Agent-Skill front matter
- **Excluded from this handoff:** the two product dashboards and `dashboard-shell.css` (your existing wired production code).

## Source references
Original product + copy: GitHub `BoostBoss-AI/boostboss` (`public/*.html`, `marketing/*.md`). Live: boostboss.ai.
