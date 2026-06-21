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

## Placements (8/8 live)

| Placement     | Module                       | Surface                          | Mount pattern                   |
| ------------- | ---------------------------- | -------------------------------- | ------------------------------- |
| `popup`       | `src/popup.js`               | popup.html                       | Auto-mount on DOMContentLoaded  |
| `sidepanel`   | `src/sidepanel.js`           | sidepanel.html                   | Auto-mount on DOMContentLoaded  |
| `newtab`      | `src/newtab.js`              | newtab.html                      | Auto-mount on DOMContentLoaded  |
| `card`        | `src/card.js`                | popup or sidepanel               | `LumiCard.mount({ container })` |
| `citation`    | `src/citation.js`            | popup or sidepanel (under reply) | `LumiCitation.mount({ container })` |
| `chip`        | `src/chip.js`                | popup or sidepanel (suggest row) | `LumiChip.mount({ container })` |
| `loading`     | `src/loading.js`             | popup or sidepanel (busy state)  | `LumiLoading.observe({ container })` |
| `onboarding`  | `src/onboarding.js`          | popup post-install               | `LumiOnboarding.mount({ container })` |

5 new placements added in v0.1: `card`, `citation`, `chip`, `loading`, `onboarding`.

### Loading-state detection

`LumiLoading.observe()` watches the passed container for:

- `[aria-busy="true"]`
- elements matching `.spinner` or `.loading`
- elements with `[data-lumi-slot="loading"]` — explicit publisher opt-in

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
