/**
 * Public type definitions for @boostbossai/lumi-sdk.
 * Mirrors what /docs/npm-sdk documents.
 */

export interface LumiOptions {
  /** Public publisher ID (e.g. `pub_xxx`). Sandbox: `pub_test_*`. */
  publisherId: string;
  /** Override the Boost Boss API base. Used for sandbox / staging. */
  apiBase?: string;
  /** Log every fetch + render to console.error. Default: false. */
  debug?: boolean;
  /** Network timeout per ad request in ms. Default: 4000. */
  timeoutMs?: number;
}

/** The four placements the Extension door owns. */
export type PlacementFormat = "corner" | "newtab" | "citation" | "toolrec";

export interface RenderOptions {
  /** Placement type. Determines visual treatment + render target.
   *  Legacy names (banner/sidebar/inline/interstitial) still resolve at runtime. */
  format?: PlacementFormat;
  /** Free-form intent string used for contextual matching. */
  context?: string;
  /** Stable per-session identifier for frequency capping. */
  sessionId?: string;
  /** ISO language code. Default inferred from navigator.language. */
  userLanguage?: string;
  /** ISO region (US/EU/APAC). Default inferred server-side. */
  userRegion?: string;
  /** Host application identifier (e.g. "browser_extension", "electron"). */
  hostApp?: string;
  /** UI surface (e.g. "sidepanel", "content_script", "popup"). */
  surface?: string;
}

/** Server-side tracking beacon URLs. Each carries the auction's context
 *  fingerprint (ctx=), so every event is joined to the request context. */
export interface AdTracking {
  impression: string | null;
  click:      string | null;
  close:      string | null;
  dismiss:    string | null;
}

/** Optional brand-kit fields sourced from the advertiser's global Creatives
 *  library (server-side `creative_assets` row). Lets the SDK paint a
 *  "Sponsored by [brand]" line with a logo and brand color tint without
 *  requiring per-campaign uploads. Every field is optional — when the
 *  advertiser hasn't filled their library, this is null and the SDK falls
 *  back to disclosure-label-only mode. Added in SDK 0.5.0 / backend
 *  Creatives library landing 2026-06-25. */
export interface BrandKit {
  /** Brand display name, e.g. "Stripe Atlas". */
  name:       string | null;
  /** Public URL of the 1:1 square brand logo. */
  logoUrl:    string | null;
  /** Public URL of the 32×32 favicon (currently unused by the renderer
   *  but exposed for advanced custom integrations). */
  faviconUrl: string | null;
  /** Brand primary color as a 6-char hex (e.g. "#FF2D78"). The renderer
   *  applies it to the brand chip's tint. */
  color:      string | null;
  /** Verified domain shown under the brand name ("sponsored by yourdomain.com"). */
  domain:     string | null;
}

/** Optional voucher / promo endcard pulled from the global library.
 *  Renders as a small offer tile alongside the CTA on corner + newtab
 *  formats. Null when the advertiser hasn't set one. */
export interface Voucher {
  /** Customer-facing promo line, e.g. "Get $10 off your first order". */
  valueText:      string | null;
  /** Optional code to display alongside the offer, e.g. "BBSAVE10". */
  code:           string | null;
  /** Where a click on the voucher leads — falls back to ctaUrl when null. */
  redemptionUrl:  string | null;
}

export interface AdPayload {
  adId:            string;
  auctionId:       string | null;
  type:            string;
  headline:        string;
  body:            string;
  mediaUrl:        string | null;
  ctaLabel:        string;
  ctaUrl:          string;
  /** @deprecated use `tracking.impression` — kept for backward compatibility. */
  impressionUrl:   string | null;
  tracking:        AdTracking;
  disclosureLabel: string;
  isSandbox:       boolean;
  /** Brand kit from the advertiser's global Creatives library. Null when
   *  the advertiser hasn't filled their library yet. @since 0.5.0 */
  brandKit:        BrandKit | null;
  /** Voucher / promo endcard from the global library. Null when not set. @since 0.5.0 */
  voucher:         Voucher | null;
}

export type LumiEventName = "impression" | "click" | "close" | "no_fill" | "error" | "ready";

export interface LumiImpressionEvent {
  adId:       string;
  auctionId:  string | null;
  format:     string;
  slot?:      Element | null;
  sandbox:    boolean;
}
export interface LumiClickEvent {
  adId:      string;
  auctionId: string | null;
  slot?:     Element | null;
}
export interface LumiCloseEvent {
  adId:      string;
  auctionId: string | null;
}
export interface LumiNoFillEvent {
  context: string;
  reason?: string | null;
}
export interface LumiErrorEvent {
  code:    string;
  message: string;
  detail?: unknown;
}
export interface LumiReadyEvent {
  version: string;
  sessionId: string;
}

export type LumiEventPayload<E extends LumiEventName> =
  E extends "impression" ? LumiImpressionEvent :
  E extends "click"      ? LumiClickEvent :
  E extends "close"      ? LumiCloseEvent :
  E extends "no_fill"    ? LumiNoFillEvent :
  E extends "error"      ? LumiErrorEvent :
  E extends "ready"      ? LumiReadyEvent :
  never;

export type LumiHandler<E extends LumiEventName> = (event: LumiEventPayload<E>) => void;
