# @boostbossai/lumi-sdk

Programmatic ad rendering for environments where a `<script>` tag isn't an option — browser extensions (Manifest v3), Electron / Tauri renderers, React, and Vue.

[Full docs → boostboss.ai/docs/npm-sdk](https://boostboss.ai/docs/npm-sdk)

## Install

```bash
npm install @boostbossai/lumi-sdk
```

## Usage — vanilla

```ts
import { Lumi } from "@boostbossai/lumi-sdk";

const lumi = new Lumi({ publisherId: "pub_xxx" });

await lumi.render("#ad-slot", {
  format:  "sidebar",
  context: "user is reading docs",
});

lumi.on("impression", (e) => console.log("ad shown", e.adId));
lumi.on("error",      (e) => console.warn("ad error", e.code));
```

## Usage — server-side (Node / serverless / SSR) <sub>v1.1.0+</sub>

Need to fetch an ad on the server and hand it to a custom renderer (your own React card, a templated HTML email, an MCP tool that prefers raw payloads)? `Lumi` exposes a DOM-free fetch path:

```ts
// inside a Next.js route handler, Express endpoint, etc.
import { Lumi } from "@boostbossai/lumi-sdk";

const lumi = new Lumi({ publisherId: process.env.BB_PUBLISHER_ID! });

const ad = await lumi.fetchAd({
  context: userPrompt.slice(0, 300),
  format:  "inline",
});

// `ad` is an AdPayload (or null on no-fill).
// Fire the impression beacon when the ad is actually displayed:
if (ad) {
  // either client-side: `new Image().src = ad.impressionUrl`
  // or call lumi.trackImpression(ad) on whichever side does the display
}

return Response.json({ ad });
```

- `fetchAd()` never throws — failures resolve to `null` and emit `error` / `no_fill` events.
- `fetchAd()` does **not** auto-fire impressions (the consumer renders, then fires).
- `trackImpression(ad)` fires the beacon and emits `impression` for listeners — call it when the ad is displayed.

## Usage — React

```tsx
import { LumiProvider, LumiSlot } from "@boostbossai/lumi-sdk/react";

function App() {
  return (
    <LumiProvider publisherId="pub_xxx">
      <main>
        {/* your AI app UI */}
        <aside>
          <LumiSlot format="sidebar" context="user is reading docs" />
        </aside>
      </main>
    </LumiProvider>
  );
}
```

## Usage — Vue 3

```vue
<script setup lang="ts">
import { LumiSlot, provideLumi } from "@boostbossai/lumi-sdk/vue";
provideLumi({ publisherId: "pub_xxx" });
</script>
<template>
  <LumiSlot format="sidebar" context="user is reading docs" />
</template>
```

## Browser-extension (Manifest v3) notes

- Zero `eval`, zero `new Function`, zero remote code execution. Passes Chrome Web Store / Edge Add-ons / Firefox Add-ons review.
- Use in **content scripts** and **sidepanels** (anywhere `document` exists). Service workers don't have a DOM, so don't `new Lumi()` there — call from your content script instead.
- Allow Boost Boss in your extension's CSP:
  ```json
  "content_security_policy": {
    "extension_pages": "script-src 'self'; connect-src 'self' https://boostboss.ai"
  }
  ```

## API

### `new Lumi(options)`
| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `publisherId` | string | — | Required. `pub_xxx` (or `pub_test_*` for sandbox). |
| `apiBase`     | string | `"https://boostboss.ai"` | Override for staging / self-hosted. |
| `debug`       | boolean | `false` | Logs every render to `console.error`. |
| `timeoutMs`   | number  | `4000` | Network timeout per ad request. |

### Methods
| Method | Returns | Notes |
| --- | --- | --- |
| `lumi.render(target, opts)` | `Promise<AdPayload \| null>` | `target` is a CSS selector or HTMLElement. Never throws. |
| `lumi.fetchAd(opts)` <sub>1.1.0+</sub> | `Promise<AdPayload \| null>` | Fetch only — no DOM required, no impression auto-fire. For server/SSR. |
| `lumi.trackImpression(ad)` <sub>1.1.0+</sub> | `Promise<void>` | Fire impression beacon for an ad fetched via `fetchAd`. Call at display time. |
| `lumi.refresh(target?)` | `Promise<void>` | Re-fetch + re-render. Pass a target to refresh just one slot; omit to refresh all. |
| `lumi.destroy()` | void | Tear down all rendered ads + remove injected styles. |
| `lumi.on(event, handler)` | void | Events: `impression`, `click`, `close`, `no_fill`, `error`, `ready`. |
| `lumi.off(event, handler)` | void | Unsubscribe a previously-registered handler. |

### Theming
Set CSS variables on `:root` (or any ancestor of the slot). Lumi reads them at render time.
```css
:root {
  --lumi-primary: #FF2D78;
  --lumi-text:    #0F0F1A;
  --lumi-muted:   #6B7280;
  --lumi-bg:      #FFFFFF;
  --lumi-border:  #E5E7EB;
  --lumi-radius:  12px;
  --lumi-font:    "Inter", sans-serif;
}
```

## Sandbox

Use `publisherId: "pub_test_demo"` in development — sandbox returns a fixed creative from a small rotation pool. No signup, no real demand-side calls, no cost / payout. Great for verifying end-to-end before going live.

## License

Apache-2.0 © Boost Boss
