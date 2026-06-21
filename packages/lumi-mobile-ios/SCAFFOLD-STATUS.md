# BoostBossLumi (iOS) — v0.1 Status

v0.1.0-alpha shipped 2026-06-21. Real Swift implementation, not stubs.

## What works in v0.1

- `LumiSDK.configure(publisherId:)` fires the handshake → publisher's
  Mobile App verify badge flips from "Not started" to "Connected"
- BottomBanner auto-mounts in the key window's bottom safe area on
  first launch (UIKit, supports both UIScene and legacy AppDelegate
  apps)
- SplashSponsor shows full-screen once per cold launch (module-level
  flag prevents re-show within a launch)
- Impression beacons fire to the URL returned with each ad payload
- Tap on banner / CTA / splash → opens click URL via `UIApplication.open`
- `LumiSDK.shared.suppress(.bottomBanner)` etc. to suppress individual
  placements per Publisher Agreement §4.1

## What v0.1 does NOT cover

- **SKAdNetwork** — Boost Boss isn't yet registered with Apple, so no
  install attribution. Impression CPM still works, but CPI campaigns
  need this. Apple registration takes ~1 week wall time once submitted.
- **AppTrackingTransparency (ATT) prompt** — not displayed; we use
  contextual matching only (no IDFA) for now
- **Rewarded video** — separate placement, ~1 week of work to add
  AVPlayer + skip gate
- **Interstitial / Pre-roll video** — same story
- **Inline placements** (citation, chip, card, loading-state) — need
  publisher-side container API; defer to RN wrapper for now

## Compatibility

- iOS 14.0+ (matches SKAdNetwork v1 availability)
- Swift 5.5+ / Obj-C
- arm64 (device), arm64 + x86_64 (simulator)

## Known v0.1 limitations + planned fixes

- BottomBanner uses fixed 64×64 image dimensions — should scale to
  intrinsic content size in v0.2
- No retry on network failure — single attempt then quiet failure
- No request batching when SDK initializes before window is ready
- No localization support (CTA labels are English-only fallback)

## Install paths

v0.1 ships via git source (no CocoaPods Trunk / SPM registry needed):

```ruby
# Podfile
pod 'BoostBossLumi', :git => 'https://github.com/BoostBoss-AI/boostboss', :branch => 'main'
```

Or Swift Package Manager:

```
Xcode → File → Add Packages → https://github.com/BoostBoss-AI/boostboss
```

Both source paths point at `packages/lumi-mobile-ios/`. CocoaPods Trunk
publication and SPM registry submission come once v1.0 is stable.

## v0.2 roadmap

1. SKAdNetwork registration + integration
2. ATT prompt (publisher-opt-in)
3. Rewarded video (AVPlayer + skip gate)
4. Image scaling fixes
5. Retry + backoff on network failure
