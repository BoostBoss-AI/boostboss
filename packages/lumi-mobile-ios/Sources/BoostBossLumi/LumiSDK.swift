//
//  LumiSDK.swift
//  BoostBossLumi
//
//  Public surface for the iOS native SDK. STUB — see SCAFFOLD-STATUS.md for
//  what each method needs to do when implemented.
//
//  Wire contract (mirror of /api/lumi-fetch + /api/track on the server):
//    POST https://boostboss.ai/api/lumi-fetch
//      { publisher_id, door="ios-native", context, placement,
//        session_id, page_url=nil }
//      → { ad: { ad_id, headline, body, image_url, cta_label,
//                click_url, impression_url, ... } }
//
//    POST https://boostboss.ai/api/track
//      { event="impression", developer_id, integration_method="ios-native",
//        surface="mobile", placement_id, session_id, context: { sdk_version,
//        handshake: true } }
//

import Foundation
import UIKit

/// Public entry point. A publisher's AppDelegate calls
/// `LumiSDK.configure(publisherId:)` once on launch.
public final class LumiSDK {
    public static let shared = LumiSDK()

    /// Internal version sent in handshake.
    public static let sdkVersion = "0.1.0-alpha.1"

    /// Door key matching api/lumi-fetch.js allowlist.
    public static let door = "ios-native"

    private var publisherId: String?
    private var sessionId: String = UUID().uuidString
    private init() {}

    /// Configure the SDK on app launch. Idempotent — safe to call multiple
    /// times; subsequent calls reset the publisher binding.
    ///
    /// Per Publisher Agreement §4.1 this is sufficient consent to auto-mount
    /// every Mobile App placement. Publishers suppress specific placements
    /// via `LumiSDK.shared.suppress(.splashSponsor)` etc.
    public static func configure(publisherId: String) {
        shared.publisherId = publisherId
        // TODO: fireHandshake() — POST /api/track with integration_method
        //       "ios-native" so the publisher's Mobile App verify badge
        //       flips to Connected.
        // TODO: registerSKAdNetwork() — call SKAdNetwork.registerAppForAdNetworkAttribution()
        //       on iOS 14.0+, then SKAdNetwork.updatePostbackConversionValue(_:)
        //       on iOS 15.4+ as conversion events fire.
        // TODO: requestATT() — if NSUserTrackingUsageDescription is set,
        //       prompt for ATT consent on first launch.
        // TODO: mountBottomBanner() — find keyWindow, attach an auto-mounted
        //       BottomBanner UIView pinned to the safe-area bottom.
        // TODO: mountSplashSponsor() — present once per cold launch via
        //       a UIWindow overlay (modal-style), respect a once-per-launch
        //       flag at class-level.
    }

    /// Suppress a specific placement. Mirrors `data-lumi-disable` on web.
    public enum Placement: String {
        case bottomBanner = "bottom-banner"
        case splashSponsor = "splash-sponsor"
        case interstitial = "interstitial"
        case rewardedVideo = "rewarded-video"
        case preRollVideo = "pre-roll-video"
        case inlineNativeBanner = "inline-native-banner"
        case sponsoredCitation = "sponsored-citation"
        case suggestedChip = "suggested-chip"
        case loadingStateAd = "loading-state-ad"
        case inlineSponsoredCard = "inline-sponsored-card"
    }

    /// Suppress a placement. Reduces impression volume and earnings.
    public func suppress(_ placement: Placement) {
        // TODO: maintain a Set<Placement> of suppressed entries, consulted
        //       inside each auto-mount path before rendering.
    }
}
