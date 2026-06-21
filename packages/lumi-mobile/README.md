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
fetching ads on first render. `<SplashSponsor />` auto-mounts on cold
start (once per app launch, module-level flag prevents re-show across
re-mounts). Both follow the [Publisher Agreement §4.1](https://boostboss.ai/publisher-agreement#section-4)
auto-placement default; opt out with `disableBottomBanner` /
`disableSplashSponsor` props on `<LumiProvider>`.

## Opt-in placements

The placements below render only when you mount them — they need a
publisher trigger point (a screen, a button tap, a level-end). Auto-mount
doesn't apply because there's no reliable global signal for "now is the
moment to show a rewarded video."

```tsx
import {
  RewardedVideo,
  InlineNativeBanner,
  FullScreenInterstitial,
} from '@boostbossai/lumi-mobile';

// Rewarded — real full-screen video player. Install expo-av for native
// playback; without it, falls back to a sponsored card + wall-clock timer.
<RewardedVideo
  rewardAmount={10}
  rewardUnit="credits"
  onReward={({ amount, unit }) => giveUserCredits(amount)}
  onSkip={() => {/* user dismissed early — no reward */}}
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
- `<RewardedVideo>` and `<PreRollVideo>` use `expo-av` for real native
  video playback when installed (`expo install expo-av`). It is an
  optional peer dep — without it, both placements render a sponsored-card
  fallback. The fallback still fires impressions and resolves
  `onReward` / `onComplete`, just without a real video frame.
- TSX ships as-is; your bundler (Metro / Babel) handles transpilation.

## License

MIT
