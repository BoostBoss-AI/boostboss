# Boost Boss Design System

Exported from Claude Design 2026-06-26.

## What's in this folder

```
design-system/
├── styles.css                  ← single entry point; @imports all tokens
├── tokens/
│   ├── fonts.css               ← Google Fonts @import (Space Grotesk + Inter + JetBrains Mono)
│   ├── colors.css              ← 51 color tokens (brand, ink, surfaces, semantic, gradients)
│   ├── typography.css          ← 30 type tokens (families, weights, fluid sizes, tracking)
│   ├── spacing.css             ← 42 spacing tokens (4px scale, radii, shadows, glows, z-index)
│   └── motion.css              ← 19 motion tokens (easings, durations, glass + mesh recipes)
├── components/
│   ├── core/
│   │   ├── Badge.{jsx,d.ts,prompt.md}
│   │   ├── Button.{jsx,d.ts,prompt.md}
│   │   ├── Card.{jsx,d.ts,prompt.md}
│   │   └── core.card.html          ← preview card
│   └── navigation/
│       ├── Navbar.{jsx,d.ts,prompt.md}     ← also exports RocketMark + LumiMark
│       ├── Footer.{jsx,d.ts,prompt.md}
│       └── navigation.card.html    ← preview card
├── guidelines/
│   ├── brand-gradients.html        ← signature brand + pink-CTA + aurora gradients
│   ├── brand-logo.html             ← rocket mark on light/dark
│   ├── colors-brand.html           ← hot pink + ramp
│   ├── colors-accents.html         ← cyan + yellow
│   ├── colors-dark.html            ← dark surface ramp
│   ├── colors-ink.html             ← text + ink ramp
│   └── colors-status.html          ← success/warn/danger
├── assets/
│   └── rocket-logo.svg             ← brand mark + favicon source
├── HANDOFF.md                  ← Claude Design's developer handoff doc
├── SKILL.md                    ← Agent-Skill metadata (front matter)
├── _ds_bundle.js               ← compiled component bundle (window.BoostBossDesignSystem_*)
├── _ds_manifest.json           ← full component + token registry (machine-readable)
└── _adherence.oxlintrc.json    ← lint rules enforcing the design system
```

## Brand in one breath

> Hot pink `#FF2D78` + electric cyan `#00FFE0` + yellow spark `#FFE600` on ink `#0F0F1A` / cream `#FAFAF7`. Space Grotesk display, Inter body, JetBrains Mono code. Direct, technical, anti-vanity-metrics voice. The moat: *"Other ad networks see cookies. Boost Boss sees intent."*

## Scope (from HANDOFF.md)

This system covers the **marketing surfaces** ONLY:

- `/` Homepage (animation-driven)
- `/publish` Publisher landing
- `/publish/{computer,browser,browser-extension,mobile}` four surface pages
- `/ads` Advertiser landing (SuperBoost)
- `/about`, `/pricing`, `/trust`, `/exchange`, `/demo`
- Four auth surfaces (`/ads/signin`, `/ads/signup`, `/publish/signin`, `/publish/signup`)

**Explicitly excluded:** the product dashboards (`/ads/dashboard` = `public/advertiser.html`, `/publish/dashboard` = `public/developer.html`) and their stylesheet `public/dashboard-shell.css`. Those remain wired production code and are not part of this design system.

## What's MISSING from this export

This Claude Design export is the **foundation** (tokens + components + guidelines) but does NOT include the actual 13 marketing-surface HTML prototypes that HANDOFF.md and `_ds_manifest.json` reference. The manifest lists them under `cards[].path` with names like `ui_kits/marketing/Homepage.html`, `ui_kits/marketing/Publish Landing.html`, etc. — those files were not in the zip.

To get the prototypes, two paths:
1. Re-export from Claude Design with the marketing surfaces included.
2. Iterate inside Claude Design one surface at a time, then port each section to the live `public/*.html` files via Cowork.

## How to use

### In any HTML file
```html
<link rel="stylesheet" href="/design-system/styles.css">
```
Every `--bb-*` and `--font-*` CSS custom property becomes available. Examples:
```css
.cta {
  background: var(--bb-pink);
  color: #fff;
  border-radius: var(--r-md);
  box-shadow: var(--glow-pink);
  font-family: var(--font-display);
  transition: transform var(--dur-fast) var(--ease-snappy);
}
.cta:hover { transform: var(--hover-lift); }
```

### In React (if/when we add React)
```jsx
import { Button, Badge, Card, Navbar, Footer, RocketMark } from '/design-system/components/...'
```
Components are inline-styled but read all values from the CSS custom properties above, so a single import of `styles.css` powers both.

### As a design reference
Open any `guidelines/*.html` in a browser to see the color/type/logo specimens rendered.
