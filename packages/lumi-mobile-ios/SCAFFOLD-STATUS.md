# BoostBossLumi (iOS) — Scaffold Status

Package directory exists; Swift implementation does not. Below is the
build order when a real iOS engineering sprint kicks off.

## What's here

- `BoostBossLumi.podspec` — CocoaPods spec ready for `pod trunk push`
- `Package.swift` — Swift Package Manager manifest
- `Sources/BoostBossLumi/LumiSDK.swift` — public surface stub
- `README.md` — install + integration story for publishers
- `LICENSE` — MIT

## What's not here yet

- Real implementation of `LumiSDK.configure()` —
  handshake, SKAdNetwork registration, ATT prompt, auto-mount
- `BottomBanner` UIView subclass
- `SplashSponsor` UIWindow overlay
- `Interstitial` view controller
- `RewardedVideo` AVPlayer integration
- `Sources/BoostBossLumi/Networking.swift` — `URLSession`-based
  client for `/api/lumi-fetch` + `/api/track`
- `Sources/BoostBossLumi/SKAdNetworkBridge.swift` —
  `SKAdNetwork.registerAppForAdNetworkAttribution()` +
  conversion-value updates
- `Tests/BoostBossLumiTests/` — XCTest suite

## Build order when engineering starts

1. **Networking client** — `URLSession`-backed POST to
   `/api/lumi-fetch` and `/api/track`. Mirror the door key
   `"ios-native"`. Returns an `Ad` struct mapping the JSON.
2. **Handshake on configure** — fire impression to `/api/track`
   with `placement_id="lumi_handshake"`, `integration_method="ios-native"`,
   so the publisher's Mobile App verify badge flips.
3. **BottomBanner UIView** — auto-mounted in `keyWindow`,
   pinned to safe-area bottom, dismissable. Fetch from
   `/api/lumi-fetch` with placement `"bottom_banner"`.
4. **SplashSponsor overlay** — present once per cold launch
   (module-level `static var` flag like the RN provider). Full-screen
   Modal with pink-band background.
5. **Interstitial + Rewarded** — view controllers presented modally.
   Rewarded requires AVPlayer + a 5-second skip gate.
6. **SKAdNetwork registration** — call
   `SKAdNetwork.registerAppForAdNetworkAttribution()` on iOS 14.0+
   inside `configure()`. Wire conversion-value updates for downstream
   signups/purchases.
7. **ATT prompt** — only if `NSUserTrackingUsageDescription` is set.
   Optional — if not set, BB falls back to contextual matching.
8. **Tests** — XCTest on a real iPhone simulator, snapshot tests for
   each placement.

## Estimated build effort

3–4 weeks of focused iOS engineering, including SKAdNetwork
registration paperwork with Apple (~1 week wall time) and one round
of TestFlight smoke testing with a friendly publisher.

## When to start

Catalyst-driven: build when CPI campaigns start landing on the
Mobile App door and the impression-only path no longer captures
the revenue advertisers expect to pay. Until then, the RN wrapper
is fine and the scaffold serves as the public commitment.
