//
//  Networking.swift
//  BoostBossLumi
//
//  URLSession-based client for /api/lumi-fetch + /api/track. Zero external
//  dependencies — pure Foundation. All calls run off the main thread.
//

import Foundation
import UIKit

internal struct Networking {

    static let apiOrigin = "https://boostboss.ai"

    static var session: URLSession {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 8
        config.timeoutIntervalForResource = 15
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }

    // MARK: - Handshake

    /// Fire a handshake impression to /api/track. Idempotent at the
    /// server level — the dashboard's verify badge flips from
    /// "Not started" to "Connected" on the first call.
    static func fireHandshake(publisherId: String, sessionId: String) {
        guard let url = URL(string: "\(apiOrigin)/api/track") else { return }
        let body: [String: Any] = [
            "event":               "impression",
            "campaign_id":         "lumi_ios_native_handshake",
            "session_id":          sessionId,
            "developer_id":        publisherId,
            "integration_method":  LumiSDK.door,
            "surface":             "mobile",
            "placement_id":        "lumi_handshake",
            "context": [
                "sdk_version": LumiSDK.sdkVersion,
                "handshake":   true,
            ],
        ]
        post(url: url, body: body) { _, _ in /* fire-and-forget */ }
    }

    // MARK: - Ad fetch

    /// Fetch a single ad for a placement. Calls the completion on the
    /// main thread so the caller can update UI directly.
    static func fetchAd(
        publisherId: String,
        placement: String,
        contextHint: String?,
        sessionId: String,
        completion: @escaping (Ad?) -> Void
    ) {
        guard let url = URL(string: "\(apiOrigin)/api/lumi-fetch") else {
            DispatchQueue.main.async { completion(nil) }
            return
        }
        let body: [String: Any] = [
            "publisher_id": publisherId,
            "door":         LumiSDK.door,
            "context":      contextHint ?? "ios native",
            "placement":    placement,
            "format":       "native",
            "session_id":   sessionId,
            "page_url":     NSNull(),
        ]
        post(url: url, body: body) { data, response in
            guard
                let data = data,
                let http = response as? HTTPURLResponse,
                (200..<300).contains(http.statusCode)
            else {
                DispatchQueue.main.async { completion(nil) }
                return
            }
            let decoded = try? JSONDecoder().decode(LumiFetchResponse.self, from: data)
            DispatchQueue.main.async { completion(decoded?.ad) }
        }
    }

    // MARK: - Impression beacon

    /// Fire the impression URL returned with the ad payload. Best-effort.
    static func fireImpression(_ ad: Ad) {
        guard let raw = ad.impressionUrl, let url = URL(string: raw) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        session.dataTask(with: req).resume()
    }

    // MARK: - Image download

    /// Download an image and call the completion on the main thread.
    static func fetchImage(urlString: String, completion: @escaping (UIImage?) -> Void) {
        guard let url = URL(string: urlString) else {
            DispatchQueue.main.async { completion(nil) }
            return
        }
        session.dataTask(with: url) { data, _, _ in
            let image = data.flatMap { UIImage(data: $0) }
            DispatchQueue.main.async { completion(image) }
        }.resume()
    }

    // MARK: - Internal

    private static func post(
        url: URL,
        body: [String: Any],
        completion: @escaping (Data?, URLResponse?) -> Void
    ) {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {
            req.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        } catch {
            completion(nil, nil)
            return
        }
        session.dataTask(with: req) { data, response, _ in
            completion(data, response)
        }.resume()
    }
}
