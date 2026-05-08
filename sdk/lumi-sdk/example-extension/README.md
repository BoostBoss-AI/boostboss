# Lumi SDK · Door 3 validation extension

Throwaway Chrome extension demonstrating `@boostbossai/lumi-sdk` rendering
inside an MV3 side panel. **Internal validation only — do not publish.**

## What it does

- Loads as an unpacked Chrome extension (Manifest v3)
- Click the toolbar icon → opens a side panel mocking an "Article AI ·
  Summarizer" UI
- Mounts Lumi into `#ad-slot` with `format: "sidebar"`, sandbox publisher
  ID `pub_test_demo`
- Surfaces every Lumi event (`ready`, `impression`, `click`, `no_fill`,
  `error`) in an in-panel devlog at the bottom of the side panel

## How to load it

1. Open Chrome → `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this directory: `sdk/lumi-sdk/example-extension/`
5. The extension appears in the toolbar — click its icon
6. Side panel opens on the right

## What to verify

- [ ] Side panel renders without console errors (open DevTools → side
      panel via F12 in the panel itself)
- [ ] `init` and `ready` events appear in the devlog within ~500ms
- [ ] A sandbox sponsored card renders inside `#ad-slot`, replacing the
      "Loading sponsored content…" placeholder
- [ ] `impression` event fires once the card mounts
- [ ] Clicking the CTA opens the link AND fires a `click` event in the
      devlog
- [ ] Network tab shows `POST https://boostboss.ai/api/mcp` (the bid
      request) and `GET https://boostboss.ai/api/track?...` beacons

## Architecture notes

- `manifest.json` — MV3, declares `sidePanel` permission, `host_permissions`
  for `boostboss.ai`, and a CSP that allows `connect-src` to the API
- `background.js` — service worker stub that maps the action click to
  opening the side panel
- `sidepanel.html` — the panel UI, references `sidepanel.js` as a module
- `sidepanel.js` — imports `Lumi` from the vendored SDK, creates an
  instance, subscribes to events, calls `render()`
- `vendor/lumi-sdk.js` + `vendor/chunk-KZTJVESC.js` — the npm package's
  built ES module output, copied directly into the extension so no
  bundler is needed for this throwaway

## Cleanup

After validation: delete this directory or remove from
`chrome://extensions`. None of these files ship to npm; they're under
`sdk/lumi-sdk/example-extension/` for reference only.
