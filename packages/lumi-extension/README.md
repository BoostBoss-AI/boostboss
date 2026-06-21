# @boostbossai/lumi-extension

Runtime SDK for **Lumi for Browser Extension App** — Boost Boss's ad
placements for Chrome Manifest V3 extensions.

You shouldn't install this directly. Use the installer:

```bash
cd /path/to/your/chrome-extension
npx @boostbossai/install-extension <publisherId>
```

The installer adds this package to your extension and wires up the four
runtime entry points (background, popup, sidepanel, newtab).

## Scope (v0)

- **Chrome MV3 only.** Firefox/Safari extension manifests differ; we'll add
  them once the Chrome flow is proven.
- Zero deps. Vanilla browser-extension JS.
- ES modules in `src/`. The `dist/` directory holds the files referenced by
  popup/sidepanel/newtab HTML — for v0 they re-export from `src/`. A real
  build step (esbuild/rollup) will replace these with bundled single-file
  outputs later.
- A classic (non-module) service-worker build lives at
  `dist/background.classic.js` for publishers whose manifest doesn't set
  `background.type === "module"`.

## Entry points

| File                              | Purpose                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `src/background.js`               | `LumiBackground.init({ publisherId })` — service worker init |
| `src/popup.js`                    | Popup card renderer (auto-mount on DOMContentLoaded)         |
| `src/sidepanel.js`                | Side panel slot renderer (auto-mount on DOMContentLoaded)    |
| `src/newtab.js`                   | New-tab takeover renderer (auto-mount on DOMContentLoaded)   |
| `src/citation.js`                 | `LumiCitation.mount(opts)` — single-line sponsored citation  |
| `src/chip.js`                     | `LumiChip.mount(opts)` — tappable quick-reply pill           |
| `src/card.js`                     | `LumiCard.mount(opts)` — inline sponsored card               |
| `src/loading.js`                  | `LumiLoading.observe(opts)` — loading-state ad               |
| `src/onboarding.js`               | `LumiOnboarding.mount(opts)` — one-time install hero card    |
| `src/shared.js`                   | `fetchAd`, `fireImpression`, constants                       |
| `src/index.js`                    | Package root re-exports                                      |
| `dist/background.classic.js`      | Non-module service worker build                              |

## Placements (8/8 auto-mounted in v0.2.0)

Every placement auto-mounts inside `popup.html`, `sidepanel.html`, and `newtab.html` — the install CLI wires the surface scripts and the runtime does the rest. Per [Publisher Agreement §4.1](https://boostboss.ai/publisher-agreement#section-4) auto-placement is the default. Publishers suppress individual placements with `<div data-lumi-disable="<placement>"></div>` or pin one to an exact spot with `<div data-lumi-slot="<placement>"></div>`.

| Placement     | Module                       | Surface                          | Auto-mount strategy              |
| ------------- | ---------------------------- | -------------------------------- | -------------------------------- |
| `popup`       | `src/popup.js`               | popup.html                       | Auto-mount on DOMContentLoaded   |
| `sidepanel`   | `src/sidepanel.js`           | sidepanel.html                   | Auto-mount on DOMContentLoaded   |
| `newtab`      | `src/newtab.js`              | newtab.html                      | Auto-mount on DOMContentLoaded   |
| `citation`    | `src/citation.js`            | under AI response                | Heuristic: detected AI container → safe-default fallback |
| `chip`        | `src/chip.js`                | suggested-action row             | Heuristic: detected suggestion container → safe-default |
| `card`        | `src/card.js`                | feed flow                        | Heuristic: detected feed container → safe-default |
| `loading`     | `src/loading.js`             | busy state                       | Heuristic: detected spinner/`aria-busy` → safe-default |
| `onboarding`  | `src/onboarding.js`          | popup post-install               | Fires once via `chrome.storage.local` seen flag |

The 5 secondary placements (`citation`, `chip`, `card`, `loading`, `onboarding`) are driven by `src/auto-mount.js`, which runs alongside the popup/sidepanel/newtab renderers, observes the DOM with `MutationObserver` for SPA-style late mounts, and refuses to inject into risky containers (code blocks, form inputs, system messages, navigation chrome).

### Loading-state detection

`LumiLoading.observe()` watches the passed container for:

- `[aria-busy="true"]`
- elements matching `.spinner` or `.loading`
- elements with `[data-lumi-slot="loading"]` — optional explicit pin

Spinner-like elements that stay visible for **>1.5s** are replaced with a
sponsored card. Explicit `data-lumi-slot="loading"` markers mount
immediately (no delay). One ad per `observe()` call — re-arm by calling
again.

## Network

All four renderers call `https://boostboss.ai/api/lumi-fetch` with:

```json
{
  "publisher_id": "...",
  "placement": "popup-card | sidepanel-slot | newtab-takeover | ...",
  "surface": "browser-extension-app",
  "context": { "url": "<active tab URL or null>" },
  "session_id": "<uuid>",
  "sdk": "lumi-extension",
  "sdk_version": "0.1.0"
}
```

Impressions are reported to `/api/lumi-impression` using the
`impression_token` returned with each ad.

## Manifest V3 compliance

- No remote code loading (`fetch` for JSON only, never script source).
- No `eval` or `new Function`.
- No inline scripts in popup/sidepanel/newtab HTML — the install CLI inserts
  `<script type="module" src="./node_modules/@boostbossai/lumi-extension/dist/<surface>.js">`.
- Session state lives in `chrome.storage.session` (service workers don't have
  `localStorage`).

## License

MIT
