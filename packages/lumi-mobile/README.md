# @boostbossai/lumi-mobile

**Lumi for Mobile App** runtime SDK — Boost Boss's ad placements for React
Native (Expo + bare).

> Most publishers install this through the CLI rather than by hand:
>
> ```bash
> npx @boostbossai/install-mobile pub_xxx
> ```
>
> Keep reading if you want to wire it manually.

## Install

```bash
npm install @boostbossai/lumi-mobile
# Expo iOS: prebuild then run normally.
# Bare RN iOS: cd ios && pod install
```

Peer deps: `react >=18`, `react-native >=0.74`.

## Manual wire-up

```tsx
import { LumiProvider } from '@boostbossai/lumi-mobile';

export default function App() {
  return (
    <LumiProvider publisherId="pub_a8x2k9f9">
      {/* your app */}
    </LumiProvider>
  );
}
```

That's it. `<BottomBanner />` auto-mounts at the screen bottom and starts
fetching ads on first render. Pass `disableBottomBanner` if you want fully
manual placement control.

## Opt-in placements

```tsx
import {
  RewardedVideo,
  InlineNativeBanner,
  FullScreenInterstitial,
} from '@boostbossai/lumi-mobile';

// Rewarded — call onReward to grant credits/lives/etc.
<RewardedVideo
  buttonLabel="Watch ad for 10 credits"
  onReward={() => giveUserCredits(10)}
/>

// Inline — drop into a feed.
<InlineNativeBanner />

// Full-screen — show on level-end, etc.
<FullScreenInterstitial
  visible={showInterstitial}
  onClose={() => setShowInterstitial(false)}
/>
```

## Placements & RPM

| Placement                | RPM         |
| ------------------------ | ----------- |
| Sponsored citation       | ~$4.50      |
| Suggested chip           | ~$4.50      |
| Inline sponsored card    | ~$6.50      |
| Loading-state ad         | ~$7.00      |
| Pre-roll video           | ~$11.00     |
| Rewarded video           | **~$35.00** |
| Bottom banner            | ~$6.50      |
| Inline native banner     | ~$7.50      |
| Full-screen interstitial | ~$18.00     |
| Splash sponsor           | ~$15.00     |

## v0 caveats

- Session UUID uses `Math.random()`. Upgrade to `expo-crypto` (Expo) or
  `react-native-get-random-values` (bare) when stricter uniqueness matters.
- Native video player is stubbed — `<RewardedVideo>` opens click_url in the
  device browser and treats the click-through as the reward signal.
- TSX ships as-is; your bundler (Metro / Babel) handles transpilation.

## License

MIT
