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
| `src/popup.js`                    | Popup card renderer                                          |
| `src/sidepanel.js`                | Side panel slot renderer                                     |
| `src/newtab.js`                   | New-tab takeover renderer                                    |
| `src/shared.js`                   | `fetchAd`, `fireImpression`, constants                       |
| `dist/background.classic.js`      | Non-module service worker build                              |

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
