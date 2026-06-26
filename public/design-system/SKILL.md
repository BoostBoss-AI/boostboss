---
name: boostboss-design
description: Use this skill to generate well-branded interfaces and assets for Boost Boss — the ad network built for AI surfaces — for production code or throwaway prototypes/mocks. Contains the brand's design guidelines, colors, type, fonts, the rocket logo, reusable UI components (Button, Badge, Card, Navbar, Footer), and full marketing-surface UI kits (homepage, /publish).
user-invocable: true
---

# Boost Boss Design System

Read `readme.md` first — it is the full design guide: company/product context, content & voice rules, visual foundations (color, type, motion, cards, backgrounds), iconography, and a manifest of every file here.

## What's in this skill
- `styles.css` — the single global stylesheet to link. It `@import`s all design tokens (colors, typography, spacing, motion, fonts). Everything is exposed as CSS custom properties (`--bb-pink`, `--font-display`, `--grad-aurora`, `--mesh-dark`, …).
- `tokens/` — the token sources, one file per concern.
- `assets/rocket-logo.svg` — the brand rocket mark (also the favicon).
- `components/` — React primitives (`Button`, `Badge`, `Card`, `Navbar`, `Footer`, `RocketMark`, `LumiMark`). Each has a `.d.ts` (props) and `.prompt.md` (usage). In a compiled design-system context they're reachable on `window.BoostBossDesignSystem_*`; for plain prototypes, copy the `.jsx` source and import React.
- `ui_kits/marketing/` — high-fidelity, animation-driven recreations of the marketing surfaces (`Homepage.html`, `Homepage Hero.html`, `Publish Landing.html`). Great starting points to copy from.
- `guidelines/` — foundation specimen cards (color/type/spacing/brand).

## How to use it
- **Visual artifacts** (slides, mocks, throwaway prototypes): copy the assets you need (the rocket SVG, token CSS) into your output folder and build static HTML that links `styles.css`. Lift patterns from the `ui_kits/` files — they encode the brand's hero, card, nav, footer, and motion language.
- **Production code**: read `readme.md` and the token files to become an expert in the brand, then reference the same CSS custom properties and component contracts.

## Brand in one breath
Hot pink `#FF2D78` + electric cyan `#00FFE0` + yellow spark `#FFE600` on ink `#0F0F1A` / cream `#FAFAF7`. Space Grotesk display, Inter body, JetBrains Mono code. Direct, technical, anti-vanity-metrics voice. The moat: *"Other ad networks see cookies. Boost Boss sees intent."* Motion-forward — aurora meshes, particle networks, parallax, scroll reveals — but always with a visible resting state (gate entrances behind page-visibility; never leave content stuck invisible).

If invoked with no other guidance, ask what the user wants to build or design, ask a few sharp questions, then act as an expert Boost Boss designer who outputs HTML artifacts **or** production code depending on the need.
