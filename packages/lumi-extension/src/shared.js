// @boostbossai/lumi-extension — shared runtime helpers
//
// Used by background.js, popup.js, sidepanel.js, and newtab.js. Zero deps,
// vanilla browser-extension JS. ES module.

export const API_ORIGIN = 'https://boostboss.ai';
export const LUMI_FETCH_URL = `${API_ORIGIN}/api/lumi-fetch`;
export const LUMI_IMPRESSION_URL = `${API_ORIGIN}/api/lumi-impression`;

export const PLACEMENTS = {
  POPUP: 'popup-card',
  SIDEPANEL: 'sidepanel-slot',
  NEWTAB: 'newtab-takeover',
};

const SESSION_KEY = 'lumi_session_id';

/**
 * Return a stable session UUID for this extension install. Uses
 * chrome.storage.session — survives across surfaces within a browser session
 * but resets when the browser restarts, which is what we want for session-scoped
 * frequency capping.
 *
 * Falls back to a per-call random if chrome.storage is unavailable (e.g.
 * tests or non-extension contexts).
 */
export async function getSessionId() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.session) {
    return randomUuid();
  }
  try {
    const got = await chrome.storage.session.get(SESSION_KEY);
    if (got && got[SESSION_KEY]) return got[SESSION_KEY];
    const id = randomUuid();
    await chrome.storage.session.set({ [SESSION_KEY]: id });
    return id;
  } catch (_e) {
    return randomUuid();
  }
}

/**
 * Read the active tab's URL (if available). Used as the "context" signal so
 * BB scoring can match intent against what the user is currently browsing.
 */
export async function getActiveTabUrl() {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
    return null;
  }
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs && tabs[0];
    return tab && tab.url ? tab.url : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Fetch a single ad placement from the BB ad server.
 *
 * @param {object} opts
 * @param {string} opts.publisherId
 * @param {string} opts.placement   — e.g. PLACEMENTS.POPUP
 * @param {string} [opts.contextUrl]
 * @param {string} [opts.sessionId]
 * @returns {Promise<object|null>}  — ad payload, or null on miss/error
 */
export async function fetchAd({ publisherId, placement, contextUrl, sessionId }) {
  const body = {
    publisher_id: publisherId,
    placement,
    surface: 'browser-extension-app',
    context: contextUrl ? { url: contextUrl } : null,
    session_id: sessionId,
    sdk: 'lumi-extension',
    sdk_version: '0.1.0',
  };

  try {
    const res = await fetch(LUMI_FETCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.ad) return null;
    return data.ad;
  } catch (_e) {
    return null;
  }
}

/**
 * Fire an impression beacon. Best-effort; failures are silent.
 */
export function fireImpression(ad, { sessionId } = {}) {
  if (!ad || !ad.impression_token) return;
  const body = {
    impression_token: ad.impression_token,
    session_id: sessionId || null,
    ts: Date.now(),
  };
  try {
    // Prefer keepalive so the beacon survives renderer teardown (popup close).
    fetch(LUMI_IMPRESSION_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch (_e) {
    // ignore
  }
}

/**
 * Attach an IntersectionObserver to fire `fireImpression` on first visibility.
 * Falls back to immediate fire if IO isn't available.
 */
export function observeImpression(el, ad, { sessionId } = {}) {
  if (!el) return;
  if (typeof IntersectionObserver === 'undefined') {
    fireImpression(ad, { sessionId });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && e.intersectionRatio >= 0.5) {
        fireImpression(ad, { sessionId });
        io.disconnect();
        break;
      }
    }
  }, { threshold: 0.5 });
  io.observe(el);
}

/**
 * Open the ad's click URL in a new tab. Uses chrome.tabs.create when
 * available so we don't disrupt the user's current navigation.
 */
export function openClick(ad) {
  if (!ad || !ad.click_url) return;
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    try {
      chrome.tabs.create({ url: ad.click_url });
      return;
    } catch (_e) {
      // fall through
    }
  }
  try {
    window.open(ad.click_url, '_blank', 'noopener,noreferrer');
  } catch (_e) {
    // ignore
  }
}

function randomUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback.
  const hex = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return (
    hex.slice(0, 8) + '-' +
    hex.slice(8, 12) + '-' +
    '4' + hex.slice(13, 16) + '-' +
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20) + '-' +
    hex.slice(20, 32)
  );
}
