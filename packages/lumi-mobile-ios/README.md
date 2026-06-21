# BoostBossLumi (iOS native)

**Lumi for Mobile App** — Boost Boss's native iOS ad SDK. Swift / Obj-C,
distributed via CocoaPods and Swift Package Manager.

> **Most publishers install this through the CLI, not by hand:**
>
> ```bash
> npx @boostbossai/install-mobile pub_xxx
> ```
>
> The CLI auto-detects your project type (Xcode workspace, Gradle, or
> React Native) and wires the right SDK. Keep reading if you want to
> install manually.

## Status — scaffolded, not yet implemented

This package directory exists so the install path is clear and the
publish-time location is reserved. The actual Swift implementation is on
a separate sprint. Manifest files, public API surface, and integration
spec are in place. `LumiSDK.configure(publisherId:)` currently does
nothing — see `Sources/BoostBossLumi/LumiSDK.swift` for what each method
needs to do.

## Install (when implemented)

### CocoaPods

```ruby
# Podfile
pod 'BoostBossLumi', '~> 0.1.0'
```

```bash
pod install
```

### Swift Package Manager

In Xcode → File → Add Packages, paste:

```
https://github.com/BoostBoss-AI/boostboss
```

Select the `BoostBossLumi` target.

## Wire-up (when implemented)

In `AppDelegate.swift`:

```swift
import BoostBossLumi

func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions
        launchOptions: [UIApplication.LaunchOptionsKey: Any]?
) -> Bool {
    LumiSDK.configure(publisherId: "pub_a8x2k9f9")
    return true
}
```

Per [Publisher Agreement §4.1](https://boostboss.ai/publisher-agreement#section-4),
`configure(publisherId:)` is sufficient consent to auto-mount every Mobile
App placement (BottomBanner, SplashSponsor, etc.). Suppress individual
placements with `LumiSDK.shared.suppress(.splashSponsor)`.

## SKAdNetwork

Apple requires every ad network to register a SKAdNetwork ID. Once Boost
Boss is registered, publishers add the network ID to their `Info.plist`:

```xml
<key>SKAdNetworkItems</key>
<array>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>BB_PLACEHOLDER.skadnetwork</string>
  </dict>
</array>
```

The install CLI auto-patches `Info.plist` with the right ID. After
registration, publishers run `npx @boostbossai/install-mobile --update`
to pull the latest SKAdNetwork ID list.

## Attribution flow

1. User taps an ad delivered via the Boost Boss exchange.
2. Apple device records the click against Boost Boss's SKAdNetwork ID.
3. User installs the advertiser's app from the App Store.
4. Apple's device fires an install postback to Boost Boss's configured
   postback URL (`https://boostboss.ai/api/skadnetwork-postback`).
5. The advertiser's app calls
   `SKAdNetwork.updatePostbackConversionValue(_:)` to encode
   post-install signals (signup, purchase, etc.) into the postback's
   conversion value (0–63).
6. Boost Boss reconciles the postback with the original click and
   credits the publisher's CPI campaign.

For ID-less attribution (when the user denies ATT), the SDK does NOT
fingerprint. Boost Boss instead uses contextual matching (IP class,
time, device model — non-PII signals) similar to AppLovin's AXON.

## Compatibility

- iOS 14.0+ (matches SKAdNetwork v1 availability)
- Swift 5.5+ / Obj-C
- Architectures: arm64 (devices), arm64 + x86_64 (simulator)

## License

MIT
