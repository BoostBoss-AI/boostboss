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

export { SponsoredCitation } from './components/SponsoredCitation';
export type { SponsoredCitationProps } from './components/SponsoredCitation';

export { SuggestedChip } from './components/SuggestedChip';
export type { SuggestedChipProps } from './components/SuggestedChip';

export { InlineSponsoredCard } from './components/InlineSponsoredCard';
export type { InlineSponsoredCardProps } from './components/InlineSponsoredCard';

export { LoadingStateAd } from './components/LoadingStateAd';
export type { LoadingStateAdProps } from './components/LoadingStateAd';

export { PreRollVideo } from './components/PreRollVideo';
export type { PreRollVideoProps } from './components/PreRollVideo';

export { SplashSponsor } from './components/SplashSponsor';
export type { SplashSponsorProps } from './components/SplashSponsor';

export { PLACEMENTS } from './types';
export type { Ad, PlacementKey, LumiContextValue } from './types';

export { fetchAd, fireImpression, SDK_VERSION } from './api';
