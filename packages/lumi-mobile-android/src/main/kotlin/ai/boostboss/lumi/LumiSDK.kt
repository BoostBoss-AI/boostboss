/*
 * LumiSDK.kt
 * Lumi for Mobile App — native Android SDK.
 *
 * Public surface. STUB — see SCAFFOLD-STATUS.md for what each method
 * needs to do when implemented.
 *
 * Wire contract (mirror of /api/lumi-fetch + /api/track on the server):
 *   POST https://boostboss.ai/api/lumi-fetch
 *     { publisher_id, door="android-native", context, placement,
 *       session_id, page_url=null }
 *     → { ad: { ad_id, headline, body, image_url, cta_label,
 *               click_url, impression_url, ... } }
 *
 *   POST https://boostboss.ai/api/track
 *     { event="impression", developer_id, integration_method="android-native",
 *       surface="mobile", placement_id, session_id, context: { sdk_version,
 *       handshake: true } }
 */

package ai.boostboss.lumi

import android.app.Application
import android.content.Context
import java.util.UUID

/**
 * Public entry point for the Lumi Android SDK.
 *
 * A publisher's [Application.onCreate] calls
 * `LumiSDK.configure(context, publisherId)` once on launch.
 */
object LumiSDK {

    /** Internal version sent in handshake. */
    const val SDK_VERSION = "0.1.0-alpha.1"

    /** Door key matching api/lumi-fetch.js allowlist. */
    const val DOOR = "android-native"

    private var publisherId: String? = null
    private val sessionId: String = UUID.randomUUID().toString()
    private val suppressedPlacements = mutableSetOf<Placement>()

    /**
     * Configure the SDK on app launch. Idempotent — safe to call multiple
     * times; subsequent calls reset the publisher binding.
     *
     * Per Publisher Agreement §4.1 this is sufficient consent to auto-mount
     * every Mobile App placement (BottomBanner, SplashSponsor, etc.).
     * Publishers suppress specific placements via
     * `LumiSDK.suppress(Placement.SPLASH_SPONSOR)`.
     */
    @JvmStatic
    fun configure(context: Context, publisherId: String) {
        this.publisherId = publisherId
        // TODO: fireHandshake(context) — POST /api/track with
        //       integration_method "android-native" so the publisher's
        //       Mobile App verify badge flips to Connected.
        // TODO: registerInstallReferrer(context) —
        //       InstallReferrerClient.newBuilder(context).build()
        //       and pull the referrer URL on first launch only.
        // TODO: mountBottomBanner(activity) — register an
        //       Application.ActivityLifecycleCallbacks listener; on
        //       onActivityResumed, attach a BottomBanner view to the
        //       activity's decor view, pinned bottom + safe-area aware.
        // TODO: mountSplashSponsor(activity) — present once per cold
        //       launch via a transparent DialogFragment / overlay
        //       window, respecting a module-level seenSplashThisLaunch
        //       flag.
    }

    /** Suppress a specific placement. Reduces impression volume and earnings. */
    @JvmStatic
    fun suppress(placement: Placement) {
        suppressedPlacements.add(placement)
    }

    /** Mirrors `data-lumi-disable` on web. */
    enum class Placement(val key: String) {
        BOTTOM_BANNER("bottom-banner"),
        SPLASH_SPONSOR("splash-sponsor"),
        INTERSTITIAL("interstitial"),
        REWARDED_VIDEO("rewarded-video"),
        PRE_ROLL_VIDEO("pre-roll-video"),
        INLINE_NATIVE_BANNER("inline-native-banner"),
        SPONSORED_CITATION("sponsored-citation"),
        SUGGESTED_CHIP("suggested-chip"),
        LOADING_STATE_AD("loading-state-ad"),
        INLINE_SPONSORED_CARD("inline-sponsored-card");
    }
}
