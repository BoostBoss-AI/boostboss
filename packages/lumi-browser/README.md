# @boostbossai/lumi-browser

Browser App door runtime for the [Boost Boss](https://boostboss.ai) ad network.

This package is for publishers using bundlers (Vite, Webpack, Next.js, etc.) who would rather `import` the Lumi runtime than paste a `<script>` tag. Same renderer, same auction backend, same 8 placements as the JS snippet integration — just consumed as an npm module.

## Install

```bash
npm install @boostbossai/lumi-browser
```

## Quick start

```js
import { init, render } from '@boostbossai/lumi-browser';

// Boot once at app startup.
await init({ publisherId: 'pub_xxxxxxxxxxxx' });

// Auto-discovery picks up any element with data-lumi-slot.
// For dynamically-rendered slots (React, Vue, Svelte), call render():
const slot = document.querySelector('#my-ad-slot');
render(slot, { format: 'card', context: 'reading list' });
```

## React example

```jsx
import { useEffect, useRef } from 'react';
import { init, render, destroy } from '@boostbossai/lumi-browser';

export function SponsoredCard({ context }) {
  const slotRef = useRef(null);

  useEffect(() => {
    init({ publisherId: process.env.NEXT_PUBLIC_BB_PUBLISHER_ID });
  }, []);

  useEffect(() => {
    if (!slotRef.current) return;
    render(slotRef.current, { format: 'card', context });
    return () => destroy();
  }, [context]);

  return <div ref={slotRef} />;
}
```

## Conversion tracking

Same shape as the `bbq.push('track', ...)` JS-snippet API:

```js
import { trackConversion } from '@boostbossai/lumi-browser';

await trackConversion({
  type: 'signup',
  value: 29.99,
  currency: 'USD',
});
```

## Events

```js
import { on } from '@boostbossai/lumi-browser';

const unsubscribe = on('impression', (detail) => {
  console.log('impression fired', detail);
});

// Later:
unsubscribe();
```

Available events: `ready` · `no_fill` · `error` · `impression` · `click` · `close`.

## Placements

The Browser App door covers 8 placements:

| Format | Where it renders |
|---|---|
| `corner` | Sticky floating unit, bottom-right |
| `card` | Inline sponsored card with optional image |
| `citation` | Compact sponsored source inline in answers |
| `chip` | Suggested-action pill |
| `hero` | Empty-state hero (full-width) |
| `loading` | Loading-state ad shown while AI generates |
| `settings` | Settings / preferences page slot |
| `interstitial` | Page interstitial |

When the advertiser has filled their Creatives library, every placement automatically renders the brand kit (logo + "Sponsored by ...") and any voucher endcard.

## How it works

`init()` dynamically loads `https://boostboss.ai/lumi.js` with your config. The script handles auction requests, frequency capping, intersection-observer impression tracking, and DOM rendering. Updates to the renderer auto-propagate — no need to bump this package every time the script changes.

If you'd rather host the script yourself, set `apiBase` to your own origin in `init()`.

## Alternatives by door

| Door | Package |
|---|---|
| Browser App | `@boostbossai/lumi-browser` (this) |
| Browser Extension | `@boostbossai/lumi-extension` |
| Computer App | `@boostbossai/install-desktop` (installer; reuses lumi-extension runtime) |
| Mobile App | `@boostbossai/lumi-mobile` |

## Docs

- [Web SDK reference](https://boostboss.ai/docs/web)
- [Creatives library](https://boostboss.ai/docs/creatives)
- [Publisher dashboard](https://boostboss.ai/publish)

Apache 2.0 © Boost Boss
