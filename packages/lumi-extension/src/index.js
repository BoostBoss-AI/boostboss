// @boostbossai/lumi-extension — package root re-exports.
//
// Central entry point so publishers can `import { LumiCard } from
// '@boostbossai/lumi-extension'` instead of digging into subpaths.

export { LumiBackground, default as LumiBackgroundDefault } from './background.js';
export { LumiCitation } from './citation.js';
export { LumiChip } from './chip.js';
export { LumiCard } from './card.js';
export { LumiLoading } from './loading.js';
export { LumiOnboarding } from './onboarding.js';
export { startAutoMount, stopAutoMount } from './auto-mount.js';

// popup/sidepanel/newtab are side-effecting module entry points (they
// auto-render on DOMContentLoaded). Re-exporting them here also runs the
// side effect, which is undesirable in a generic import. Publishers wire
// these via the dist/ paths in their popup/sidepanel/newtab HTML. We
// expose namespace objects below so library consumers can still reference
// them by name for tooling/discovery, without triggering side effects.

export const LumiPopup = { dist: '@boostbossai/lumi-extension/popup' };
export const LumiSidepanel = { dist: '@boostbossai/lumi-extension/sidepanel' };
export const LumiNewtab = { dist: '@boostbossai/lumi-extension/newtab' };

export {
  PLACEMENTS,
  DOOR,
  SDK_VERSION,
  fetchAd,
  fireImpression,
  observeImpression,
  openClick,
  getSessionId,
  getActiveTabUrl,
  summarizeContext,
} from './shared.js';
