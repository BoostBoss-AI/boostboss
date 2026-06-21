# ai.boostboss:lumi (Android) — Scaffold Status

Package directory exists; Kotlin implementation does not. Below is the
build order when a real Android engineering sprint kicks off.

## What's here

- `build.gradle.kts` — Gradle library module + Maven publish config
- `src/main/AndroidManifest.xml` — INTERNET + network-state perms
- `src/main/kotlin/ai/boostboss/lumi/LumiSDK.kt` — public surface stub
- `README.md` — install + integration story for publishers
- `LICENSE` — MIT

## What's not here yet

- Real implementation of `LumiSDK.configure()` —
  handshake, install-referrer pull, auto-mount
- `BottomBanner` custom View
- `SplashSponsor` DialogFragment / overlay window
- `InterstitialActivity`
- `RewardedActivity` with ExoPlayer integration
- `Networking.kt` — `HttpUrlConnection` or OkHttp client for
  `/api/lumi-fetch` + `/api/track`
- `InstallReferrerBridge.kt` —
  `InstallReferrerClient.newBuilder(context).build()` +
  one-shot postback
- `src/test/` and `src/androidTest/` test suites
- `consumer-rules.pro` + `proguard-rules.pro` keep rules

## Build order when engineering starts

1. **Networking client** — OkHttp-backed POST to `/api/lumi-fetch`
   and `/api/track`. Mirror the door key `"android-native"`. Returns
   a sealed-class `Ad` data type mapping the JSON.
2. **Handshake on configure** — fire impression to `/api/track`
   with `placement_id="lumi_handshake"`,
   `integration_method="android-native"`, so the publisher's
   Mobile App verify badge flips.
3. **BottomBanner View** — auto-mounted via
   `Application.ActivityLifecycleCallbacks.onActivityResumed`. Attach
   to the activity's decor view, pinned to bottom with safe-area
   insets honored. Dismissable.
4. **SplashSponsor overlay** — present once per cold launch
   (module-level `static var` flag). Transparent `DialogFragment`
   or `WindowManager` overlay with pink-band background.
5. **Interstitial + Rewarded Activities** — separate activities
   launched via `Intent`. Rewarded uses ExoPlayer + 5-second skip
   gate.
6. **Install Referrer** — call
   `InstallReferrerClient.newBuilder(context).build()` once on first
   launch (gated by SharedPreferences flag). Read the referrer URL,
   POST to `/api/install-referrer-postback`.
7. **Tests** — JUnit + Espresso, snapshot tests for each placement.

## Estimated build effort

3–4 weeks of focused Android engineering, including one round of
internal testing on real Pixel + Samsung devices and one Play Store
internal-track upload to confirm install referrer pipeline.

## Why Android first

Android has the easier on-ramp: no SKAdNetwork registration
paperwork with Apple (1 week wall time saved), Play Install Referrer
is a single Google API call (vs. SKAdNetwork's conversion-value
encoding), and Play Store internal-track testing turns around in
hours instead of TestFlight's day-plus review cycle. Build Android
first, ship to a friendly publisher, then port to iOS.

## When to start

Catalyst-driven: build when CPI campaigns start landing on the
Mobile App door and the impression-only path no longer captures the
revenue advertisers expect to pay. Until then, the RN wrapper is
fine and the scaffold serves as the public commitment.
