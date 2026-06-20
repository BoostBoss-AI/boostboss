# @boostbossai/install-extension

One-command installer for **Lumi for Browser Extension App** — Boost Boss's ad
SDK for Chrome Manifest V3 extensions.

```bash
cd /path/to/your/chrome-extension
npx @boostbossai/install-extension pub_a8x2k9f9
```

## What it does

1. Verifies you're in a Chrome MV3 extension directory (`manifest.json` with
   `"manifest_version": 3`).
2. `npm install`s the runtime SDK [`@boostbossai/lumi-extension`](../lumi-extension).
3. Patches `manifest.json`:
   - adds `"storage"` to `permissions`
   - adds `"https://boostboss.ai/*"` to `host_permissions`
4. Patches your service worker (if `background.service_worker` is set) to call
   `LumiBackground.init({ publisherId })`.
5. Patches your popup, side panel, and new-tab HTML files (if declared) to
   load the matching runtime renderer.
6. Records every patch to `.lumi-install-log` so uninstall is symmetric.
7. Prints a banner with the 8 placements enabled and your dashboard link.

## Uninstall

```bash
npx @boostbossai/install-extension --uninstall
```

Reverses every patch in `.lumi-install-log` and `npm uninstall`s the runtime
package.

## Scope (v0)

- **Chrome MV3 only.** Firefox/Safari extension manifests differ; we'll add
  them once Chrome flow is proven.
- Manifest V2 is explicitly rejected with a migration link.
- Re-running install is idempotent — existing patches are detected and skipped.
- Zero dependencies. Node 18+.

## Placements auto-enabled

| Placement              | RPM        |
| ---------------------- | ---------- |
| Sponsored citation     | ~$4.50     |
| Suggested chip         | ~$4.50     |
| Inline sponsored card  | ~$6.50     |
| Loading-state ad       | ~$7.00     |
| Popup card             | ~$7.50     |
| Side panel slot        | ~$8.00     |
| New-tab takeover       | ~$16.00    |
| Install onboarding     | ~$9.00     |

## License

MIT
