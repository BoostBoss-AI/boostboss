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

export interface Ad {
  ad_id: string;
  headline?: string;
  body?: string;
  cta?: string;
  image_url?: string;
  click_url?: string;
  impression_token?: string;
  brand?: string;
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
