//
//  Models.swift
//  BoostBossLumi
//
//  Wire types mirroring /api/lumi-fetch response shape. Public Codable so
//  callers can inspect ad fields if they want to render their own UI on
//  top of the SDK. Decoding is permissive — unknown fields are ignored,
//  missing optional fields fall through to nil.
//

import Foundation

/// Single ad payload returned by /api/lumi-fetch.
public struct Ad: Codable, Equatable {
    public let adId: String?
    public let headline: String?
    public let body: String?
    public let imageUrl: String?
    public let ctaLabel: String?
    public let clickUrl: String?
    public let impressionUrl: String?
    public let brand: String?

    enum CodingKeys: String, CodingKey {
        case adId          = "ad_id"
        case headline
        case body
        case imageUrl      = "image_url"
        case ctaLabel      = "cta_label"
        case clickUrl      = "click_url"
        case impressionUrl = "impression_url"
        case brand
    }
}

/// Top-level /api/lumi-fetch response.
struct LumiFetchResponse: Codable {
    let ad: Ad?
}
