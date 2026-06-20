// @boostbossai/lumi-mobile — entry
//
// Public surface for the runtime SDK. Publishers typically only need:
//
//   import { LumiProvider } from '@boostbossai/lumi-mobile';
//   ...
//   <LumiProvider publisherId="pub_xxx">{children}</LumiProvider>
//
// Optional opt-in placements:
//
//   import {
//     RewardedVideo,
//     InlineNativeBanner,
//     FullScreenInterstitial,
//   } from '@boostbossai/lumi-mobile';

export { LumiProvider, useLumi } from './LumiProvider';
export type { LumiProviderProps } from './LumiProvider';

export { BottomBanner } from './components/BottomBanner';
export type { BottomBannerProps } from './components/BottomBanner';

export { RewardedVideo } from './components/RewardedVideo';
export type { RewardedVideoProps } from './components/RewardedVideo';

export { InlineNativeBanner } from './components/InlineNativeBanner';
export type { InlineNativeBannerProps } from './components/InlineNativeBanner';

export { FullScreenInterstitial } from './components/FullScreenInterstitial';
export type { FullScreenInterstitialProps } from './components/FullScreenInterstitial';

export { PLACEMENTS } from './types';
export type { Ad, PlacementKey, LumiContextValue } from './types';

export { fetchAd, fireImpression, SDK_VERSION } from './api';
