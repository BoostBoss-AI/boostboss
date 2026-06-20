# @boostbossai/install-mobile

One-command installer for **Lumi for Mobile App** — Boost Boss's ad SDK for
React Native (Expo + bare).

```bash
cd /path/to/your/react-native-app
npx @boostbossai/install-mobile pub_a8x2k9f9
```

## What it does

1. Detects whether your project is **Expo** or **bare React Native** by
   reading `./package.json`.
2. `npm install`s the runtime SDK [`@boostbossai/lumi-mobile`](../lumi-mobile).
3. **Expo only:** registers `@boostbossai/lumi-mobile` as an Expo plugin in
   `app.json` (or drops a TODO comment in `app.config.js` / `app.config.ts`).
4. Wraps your root component's return JSX with
   `<LumiProvider publisherId="..."> ... </LumiProvider>`.
   - Looks for `App.tsx`, `App.jsx`, `App.js`, `src/App.{tsx,jsx,js}`, and
     Expo Router's `app/_layout.tsx`.
   - Adds the matching import line at the top of the file.
5. **Bare React Native on macOS only:** runs `cd ios && pod install`. On
   Windows/Linux it prints a reminder to run that on a Mac.
6. Records every patch to `.lumi-install-log` so uninstall is symmetric.
7. Prints a banner listing the 10 mobile placements enabled and your
   dashboard link.

## Uninstall

```bash
npx @boostbossai/install-mobile --uninstall
```

Reverses every patch in `.lumi-install-log` and `npm uninstall`s the
runtime package.

## Scope (v0)

- **React Native only.** Native-iOS Swift and native-Android Kotlin SDKs
  will ship as separate packages.
- Re-running install is idempotent — existing `<LumiProvider` marker = skip.
- Zero dependencies. Node 18+.

## Placements auto-enabled

| Placement              | RPM        |
| ---------------------- | ---------- |
| Sponsored citation     | ~$4.50     |
| Suggested chip         | ~$4.50     |
| Inline sponsored card  | ~$6.50     |
| Loading-state ad       | ~$7.00     |
| Pre-roll video         | ~$11.00    |
| Rewarded video         | ~$35.00    |
| Bottom banner          | ~$6.50     |
| Inline native banner   | ~$7.50     |
| Full-screen interstitial | ~$18.00  |
| Splash sponsor         | ~$15.00    |

## License

MIT
