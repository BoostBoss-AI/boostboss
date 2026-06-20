# @boostbossai/install-desktop

One-command installer for **Lumi for Computer App** — Boost Boss's monetization SDK for Electron (and soon Tauri) desktop apps.

```bash
npx @boostbossai/install-desktop pub_a8x2k9f9
```

That's it. Restart your app.

## What it does

1. Detects your project (Electron via `package.json`; Tauri via `@tauri-apps/cli` or `src-tauri/`).
2. Finds your renderer HTML (`public/index.html`, `src/index.html`, `src/renderer/index.html`, `app/index.html`, or `index.html`).
3. Adds one `<script>` tag inside `<head>`:
   ```html
   <script async src="https://boostboss.ai/lumi/v1.js#pub_a8x2k9f9" data-lumi-install="desktop"></script>
   ```
4. Writes a `.lumi-install-log` recording exactly what changed.
5. Prints a banner showing the 10 placements now live in your app.

## Uninstall

```bash
npx @boostbossai/install-desktop --uninstall
```

Reverses every patch listed in `.lumi-install-log` and deletes the log. Byte-for-byte symmetric with install.

## What gets enabled

Ten placement types auto-enable on install. Boost Boss's intent layer chooses which ones fire based on each user session. Sample RPMs:

| Placement              | Typical RPM |
| ---------------------- | ----------- |
| Sponsored citation     | ~$4.50      |
| Suggested chip         | ~$4.50      |
| Inline sponsored card  | ~$6.50      |
| Loading-state ad       | ~$7.00      |
| Pre-roll video         | ~$10.00     |
| Window banner          | ~$7.50      |
| Sidebar slot           | ~$7.00      |
| Modal interstitial     | ~$18.00     |
| Empty-state hero       | ~$8.50      |
| System notification    | ~$5.00      |

You keep **70%** of every dollar. Track live earnings at [boostboss.ai/publish/dashboard](https://boostboss.ai/publish/dashboard).

## Tauri

Tauri integration ships in **v1.3**. Until then the CLI detects Tauri projects and prints manual instructions — paste the script tag into your renderer HTML and allow `boostboss.ai` in your CSP.

## Requirements

- Node 18+
- An Electron project with a renderer HTML file
- A publisher ID from [boostboss.ai/publish/dashboard](https://boostboss.ai/publish/dashboard)

## Zero dependencies

This package depends on nothing. It uses only Node built-ins (`fs`, `path`, `readline`). `npx` won't spend ten seconds downloading a tree of transitive packages before your install runs.

## Docs

- Computer App door: https://boostboss.ai/docs/computer
- Publisher dashboard: https://boostboss.ai/publish/dashboard
- All four doors: https://boostboss.ai/publish

## License

MIT
