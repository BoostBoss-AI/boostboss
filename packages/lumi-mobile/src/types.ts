// @boostbossai/lumi-mobile — shared types

export type Surface = 'mobile-app';

export const PLACEMENTS = {
  BOTTOM_BANNER: 'bottom-banner',
  REWARDED_VIDEO: 'rewarded-video',
  INLINE_NATIVE_BANNER: 'inline-native-banner',
  FULL_SCREEN_INTERSTITIAL: 'full-screen-interstitial',
  PRE_ROLL: 'pre-roll-video',
  SPLASH: 'splash-sponsor',
  INLINE_SPONSORED_CARD: 'inline-sponsored-card',
  LOADING_STATE: 'loading-state-ad',
  SPONSORED_CITATION: 'sponsored-citation',
  SUGGESTED_CHIP: 'suggested-chip',
} as const;

export type PlacementKey = (typeof PLACEMENTS)[keyof typeof PLACEMENTS];

/** Brand kit pulled from the advertiser's global Creatives library
 *  (server-side creative_assets row). Null when the advertiser hasn't
 *  filled their library yet. @since 0.3.0 */
export interface BrandKit {
  name?:        string | null;
  logo_url?:    string | null;
  favicon_url?: string | null;
  color?:       string | null;
  domain?:      string | null;
}

/** Voucher / promo endcard from the global library. Null when not set. */
export interface Voucher {
  value_text?:     string | null;
  code?:           string | null;
  redemption_url?: string | null;
}

export interface Ad {
  ad_id: string;
  headline?: string;
  body?: string;
  cta?: string;
  image_url?: string;
  click_url?: string;
  impression_token?: string;
  brand?: string;
  /** @since 0.3.0 — Creatives library brand kit, null when library empty. */
  brand_kit?: BrandKit | null;
  /** @since 0.3.0 — voucher / promo endcard from the library. */
  voucher?: Voucher | null;
  // Free-form payload — placements may extract additional fields.
  [key: string]: unknown;
}

export interface FetchAdOpts {
  publisherId: string;
  placement: PlacementKey | string;
  sessionId: string;
  contextHint?: string | null;
}

export interface LumiContextValue {
  publisherId: string;
  sessionId: string;
  /** Surface identifier — always 'mobile-app' for this SDK. */
  surface: Surface;
}
