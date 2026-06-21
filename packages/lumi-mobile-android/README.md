# ai.boostboss:lumi (Android native)

**Lumi for Mobile App** — Boost Boss's native Android ad SDK. Kotlin-first,
Java-compatible. Distributed via Maven Central and JitPack.

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
Maven coordinates are reserved. The actual Kotlin implementation is on
a separate sprint. Gradle manifest, public API surface, and integration
spec are in place. `LumiSDK.configure(context, publisherId)` currently
does nothing — see `src/main/kotlin/ai/boostboss/lumi/LumiSDK.kt` for
what each method needs to do.

## Install (when implemented)

```kotlin
// build.gradle.kts (app module)
dependencies {
    implementation("ai.boostboss:lumi:0.1.0")
}
```

Or Groovy:

```groovy
// build.gradle (app module)
dependencies {
    implementation 'ai.boostboss:lumi:0.1.0'
}
```

## Wire-up (when implemented)

In `Application.kt`:

```kotlin
import ai.boostboss.lumi.LumiSDK

class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        LumiSDK.configure(this, "pub_a8x2k9f9")
    }
}
```

And declare your Application class in `AndroidManifest.xml`:

```xml
<application
    android:name=".MyApp"
    ... >
</application>
```

Per [Publisher Agreement §4.1](https://boostboss.ai/publisher-agreement#section-4),
`configure(context, publisherId)` is sufficient consent to auto-mount
every Mobile App placement. Suppress individual placements with
`LumiSDK.suppress(Placement.SPLASH_SPONSOR)`.

## Play Install Referrer

Google's Install Referrer API is the Android equivalent of SKAdNetwork.
When a user taps a Boost Boss ad on Play Store and installs the
advertiser's app, Google appends a referrer URL to the install. On the
advertiser app's first launch, the SDK reads this URL via
[InstallReferrerClient](https://developer.android.com/google/play/installreferrer/library)
and reports it back to Boost Boss for attribution.

The SDK uses `com.android.installreferrer:installreferrer:2.2` —
already declared in `build.gradle.kts`. No publisher action required;
the install CLI doesn't need to patch anything beyond adding the SDK
dependency.

## Attribution flow

1. User taps an ad delivered via the Boost Boss exchange.
2. Boost Boss sends the user to Play Store with a referrer URL
   tagged with the click ID.
3. User installs the advertiser's app.
4. Google attaches the referrer URL to the install.
5. The advertiser's app first launch — the Lumi SDK calls
   `InstallReferrerClient.getInstallReferrer()`, reads the click ID
   from the URL, and POSTs it to
   `https://boostboss.ai/api/install-referrer-postback`.
6. Boost Boss reconciles the postback with the original click and
   credits the publisher's CPI campaign.

The SDK does NOT read AD_ID (Google Advertising ID) by default — that
requires the `com.google.android.gms.permission.AD_ID` permission and
declaring purpose to Play Store. Boost Boss uses contextual matching
instead (IP class, device model, locale — non-PII signals) like
AppLovin's AXON.

## Compatibility

- Android 6.0 (API 23) and above — matches Play Install Referrer
  availability floor
- Kotlin 1.9+ / Java 17 source compatibility
- Architectures: arm64-v8a, armeabi-v7a, x86_64

## License

MIT
