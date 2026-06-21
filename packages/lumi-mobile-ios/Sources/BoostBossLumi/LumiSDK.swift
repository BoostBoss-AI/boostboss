//
//  LumiSDK.swift
//  BoostBossLumi
//
//  Public entry point for the Lumi for Mobile App native iOS SDK.
//
//  Publisher Agreement §4.1 — `configure(publisherId:)` is sufficient
//  consent to auto-mount every Mobile App placement. Publishers
//  suppress individual ones via `LumiSDK.shared.suppress(.splashSponsor)`.
//
//  Wire contract (mirror of /api/lumi-fetch + /api/track on the server):
//    POST https://boostboss.ai/api/lumi-fetch
//      { publisher_id, door="ios-native", context, placement,
//        session_id, page_url=nil }
//    POST https://boostboss.ai/api/track
//      { event="impression", developer_id, integration_method="ios-native",
//        surface="mobile", placement_id, session_id, context: {...} }
//

import Foundation
import UIKit

/// Public surface of the Boost Boss native iOS SDK.
public final class LumiSDK {

    // MARK: - Public constants

    /// Internal version sent in the handshake.
    public static let sdkVersion = "0.1.0-alpha.2"

    /// Door key matching api/lumi-fetch.js allowlist.
    public static let door = "ios-native"

    /// Singleton instance — `LumiSDK.shared`.
    public static let shared = LumiSDK()

    // MARK: - Public API

    /// One-line install for publishers. Call from
    /// `application(_:didFinishLaunchingWithOptions:)` in your AppDelegate.
    ///
    /// Per Publisher Agreement §4.1, this auto-mounts every Mobile App
    /// placement (BottomBanner, SplashSponsor). Suppress individual
    /// placements via `LumiSDK.shared.suppress(.splashSponsor)`.
    @discardableResult
    public static func configure(publisherId: String) -> Bool {
        guard !publisherId.isEmpty else {
            print("[BoostBossLumi] configure() called with empty publisherId — SDK inert.")
            return false
        }
        return shared.start(publisherId: publisherId)
    }

    /// Suppress a specific placement. Reduces impression volume and earnings.
    public func suppress(_ placement: Placement) {
        suppressedPlacements.insert(placement)
    }

    /// Placement identifiers.
    public enum Placement: String {
        case bottomBanner       = "bottom_banner"
        case splashSponsor      = "splash_sponsor"
        case interstitial       = "interstitial"
        case rewardedVideo      = "rewarded_video"
        case preRollVideo       = "pre_roll_video"
        case inlineNativeBanner = "inline_native_banner"
        case sponsoredCitation  = "sponsored_citation"
        case suggestedChip      = "suggested_chip"
        case loadingStateAd     = "loading_state_ad"
        case inlineSponsoredCard = "inline_sponsored_card"
    }

    // MARK: - Internals

    private(set) var publisherId: String?
    private(set) var sessionId:   String = UUID().uuidString
    private var suppressedPlacements: Set<Placement> = []
    private var bottomBanner: BottomBanner?
    private var splashSponsor: SplashSponsor?
    private var lifecycleToken: NSObjectProtocol?
    private var configured = false

    private init() {}

    private func start(publisherId: String) -> Bool {
        if configured && self.publisherId == publisherId {
            return true // idempotent
        }
        self.publisherId = publisherId
        self.configured = true

        // 1. Handshake — flips the publisher's Mobile App verify badge.
        Networking.fireHandshake(publisherId: publisherId, sessionId: sessionId)

        // 2. Hook the key window. If it exists already, mount now;
        //    otherwise wait for the first scene to come to the
        //    foreground and mount then.
        if let window = currentKeyWindow() {
            mount(in: window)
        } else {
            // UISceneSession-based apps may not have a window yet at
            // configure() time. Listen for the next foreground.
            lifecycleToken = NotificationCenter.default.addObserver(
                forName: UIScene.didActivateNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                guard let self = self, let window = self.currentKeyWindow() else { return }
                self.mount(in: window)
                if let token = self.lifecycleToken {
                    NotificationCenter.default.removeObserver(token)
                    self.lifecycleToken = nil
                }
            }
        }
        return true
    }

    private func mount(in window: UIWindow) {
        guard let publisherId = publisherId else { return }

        // BottomBanner — auto-mounted unless suppressed.
        if !suppressedPlacements.contains(.bottomBanner) && bottomBanner == nil {
            let banner = BottomBanner(publisherId: publisherId, sessionId: sessionId)
            banner.attach(to: window)
            self.bottomBanner = banner
        }

        // SplashSponsor — once per cold launch unless suppressed.
        if !suppressedPlacements.contains(.splashSponsor) && splashSponsor == nil {
            let splash = SplashSponsor(publisherId: publisherId, sessionId: sessionId)
            splash.showIfFirstLaunch()
            self.splashSponsor = splash
        }
    }

    /// Locates the key window in a way that's compatible with both UIScene-
    /// based apps (iOS 13+) and the legacy AppDelegate-only apps.
    private func currentKeyWindow() -> UIWindow? {
        // iOS 15+ — UIWindowScene.keyWindow
        if let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }) {
            if let key = scene.windows.first(where: { $0.isKeyWindow }) {
                return key
            }
            return scene.windows.first
        }
        // Legacy fallback — pre-iOS-13 apps.
        return UIApplication.shared.windows.first { $0.isKeyWindow }
            ?? UIApplication.shared.windows.first
    }
}
