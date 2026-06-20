// @boostbossai/lumi-extension — background.js (service worker)
//
// ES-module service-worker entry. Exposes LumiBackground.init({ publisherId }).
//
// Responsibilities:
//   - Persist publisherId in chrome.storage.local so renderers can read it.
//   - Fire a one-time handshake ping so BB can mark the install as live.
//   - Listen for runtime messages from popup/sidepanel/newtab and proxy
//     fetchAd calls (renderers could call directly, but routing through the
//     worker keeps a single source of truth for session_id).
//
// Manifest V3: no remote code, no eval, no inline scripts. Just fetch + chrome.*.

import {
  API_ORIGIN,
  fetchAd,
  fireImpression,
  fireHandshake,
  getSessionId,
  getActiveTabUrl,
} from './shared.js';

const PUB_KEY = 'lumi_publisher_id';
const HANDSHAKE_DONE_KEY = 'lumi_handshake_done';

export const LumiBackground = {
  /**
   * Wire up the background runtime. Call once at the top of the service
   * worker — install CLI prepends this for the publisher.
   */
  init({ publisherId }) {
    if (!publisherId) {
      console.warn('[lumi] init called without publisherId — ads disabled.');
      return;
    }

    // Persist for renderers (popup/sidepanel/newtab).
    try {
      chrome.storage.local.set({ [PUB_KEY]: publisherId });
    } catch (_e) {
      // chrome.storage may not exist outside extension context — non-fatal.
    }

    sendHandshake(publisherId).catch(() => {});

    // Renderer → background message router.
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (!msg || msg.type !== 'lumi/fetch-ad') return false;
        handleFetchAdMessage(publisherId, msg)
          .then((ad) => sendResponse({ ok: true, ad }))
          .catch((err) =>
            sendResponse({ ok: false, error: err && err.message })
          );
        return true; // async
      });
    }
  },
};

async function handleFetchAdMessage(publisherId, msg) {
  const sessionId = await getSessionId();
  const contextUrl = msg.contextUrl || (await getActiveTabUrl());
  const ad = await fetchAd({
    publisherId,
    placement: msg.placement,
    contextUrl,
    sessionId,
  });
  return ad;
}

async function sendHandshake(publisherId) {
  // Idempotent — only fire once per install. Verify badge flips on the
  // first impression event recorded for this developer_id with
  // integration_method=npm-sdk; subsequent fires would just spam analytics.
  try {
    const got = await chrome.storage.local.get(HANDSHAKE_DONE_KEY);
    if (got && got[HANDSHAKE_DONE_KEY]) return;
  } catch (_e) { /* ignore — best-effort */ }

  // Delegate to the shared helper which uses /api/track with the proper
  // integration_method=npm-sdk so the Browser Extension verify badge in
  // the dashboard flips from "Not started" to "Connected".
  await fireHandshake(publisherId);

  try {
    await chrome.storage.local.set({ [HANDSHAKE_DONE_KEY]: true });
  } catch (_e) { /* ignore */ }
}

// Re-export for renderers that import from the package root.
export { fetchAd, fireImpression, getSessionId };
export default LumiBackground;
