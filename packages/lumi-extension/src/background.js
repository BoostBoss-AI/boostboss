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
  getSessionId,
  getActiveTabUrl,
} from './shared.js';

const PUB_KEY = 'lumi_publisher_id';
const HANDSHAKE_DONE_KEY = 'lumi_handshake_done';
const HANDSHAKE_URL = `${API_ORIGIN}/api/lumi-handshake`;

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
  try {
    const got = await chrome.storage.local.get(HANDSHAKE_DONE_KEY);
    if (got && got[HANDSHAKE_DONE_KEY]) return;
  } catch (_e) {
    // ignore — best-effort
  }

  const sessionId = await getSessionId();
  const payload = {
    publisher_id: publisherId,
    session_id: sessionId,
    sdk: 'lumi-extension',
    sdk_version: '0.1.0',
    surface: 'browser-extension-app',
    user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
  };

  try {
    await fetch(HANDSHAKE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    try {
      await chrome.storage.local.set({ [HANDSHAKE_DONE_KEY]: true });
    } catch (_e) {}
  } catch (_e) {
    // ignore
  }
}

// Re-export for renderers that import from the package root.
export { fetchAd, fireImpression, getSessionId };
export default LumiBackground;
