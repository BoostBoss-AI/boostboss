/**
 * Ad — the rendered-side object returned from fetchAd().
 * Carries the creative payload plus methods for MCP rendering and tracking.
 */
import type { AdPayload, MCPContentBlock, PlacementFormat } from "./types.js";

export interface AdInternals {
  trackingImpression?: string | null;
  trackingClick?: string | null;
}

/** Eyebrow / disclosure line per MCP placement. The legal disclosure label
 *  is always present; placement only adds framing. */
function eyebrow(disclosure: string, placement: PlacementFormat): string {
  if (placement === "citation") return `— ${disclosure} · source —`;
  if (placement === "toolrec")  return `— ${disclosure} · recommended —`;
  return `— ${disclosure} —`;
}

export class Ad implements AdPayload {
  readonly adId: string;
  readonly auctionId: string;
  readonly advertiserName?: string;
  readonly headline: string;
  readonly subtext?: string;
  readonly mediaUrl?: string;
  readonly ctaLabel?: string;
  readonly ctaUrl: string;
  readonly disclosureLabel: string;
  readonly intentMatchScore?: number;
  /** The placement requested in fetchAd(); toMCPBlock() defaults to it. */
  readonly placement: PlacementFormat;

  /** @internal */
  private readonly _internals: AdInternals;

  constructor(payload: AdPayload, internals: AdInternals = {}, placement: PlacementFormat = "card") {
    this.adId            = payload.adId;
    this.auctionId       = payload.auctionId;
    this.advertiserName  = payload.advertiserName;
    this.headline        = payload.headline;
    this.subtext         = payload.subtext;
    this.mediaUrl        = payload.mediaUrl;
    this.ctaLabel        = payload.ctaLabel;
    this.ctaUrl          = payload.ctaUrl;
    this.disclosureLabel = payload.disclosureLabel;
    this.intentMatchScore = payload.intentMatchScore;
    this.placement       = placement;
    this._internals      = internals;
  }

  /**
   * The URL to put in front of users. This is the click tracker — it
   * records the click (context-joined via the ctx= fingerprint) and then
   * 302-redirects to the advertiser. An MCP host never notifies the
   * publisher when a user clicks a link in rendered text, so the tracker
   * URL itself must carry the redirect. Falls back to the raw destination
   * only when no tracking URL was issued.
   */
  clickThroughUrl(): string {
    const tc = this._internals.trackingClick;
    if (tc && this.ctaUrl) {
      return tc + (tc.includes("?") ? "&" : "?") + "to=" + encodeURIComponent(this.ctaUrl);
    }
    return tc || this.ctaUrl;
  }

  /**
   * Format the ad as an MCP content block ready to append to a tool's
   * content array. The disclosure label is baked in — do not strip it.
   * `placement` defaults to the one requested in fetchAd().
   */
  toMCPBlock(placement: PlacementFormat = this.placement): MCPContentBlock {
    const lines: string[] = [];
    lines.push(eyebrow(this.disclosureLabel, placement));
    lines.push(this.headline);
    if (this.subtext) lines.push(this.subtext);
    const url = this.clickThroughUrl();
    if (this.ctaLabel || url) {
      const label = this.ctaLabel || "Learn more";
      lines.push(`${label}: ${url}`);
    }
    return {
      type: "text",
      text: "\n\n" + lines.join("\n"),
      _meta: {
        boostboss: {
          adId: this.adId,
          auctionId: this.auctionId,
        },
      },
    };
  }

  /**
   * Internal: returns the impression beacon URL the SDK fires on render.
   * Most callers should rely on automatic firing via fetchAd(); this is
   * exposed for custom rendering paths.
   */
  getImpressionUrl(): string | null {
    return this._internals.trackingImpression ?? null;
  }

  /** Internal: the raw click beacon URL (no redirect). Use clickThroughUrl()
   *  for the user-facing link. */
  getClickUrl(): string | null {
    return this._internals.trackingClick ?? null;
  }
}
