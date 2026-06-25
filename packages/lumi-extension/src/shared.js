// @boostbossai/lumi-extension — shared runtime helpers
//
// Used by background.js, popup.js, sidepanel.js, and newtab.js. Zero deps,
// vanilla browser-extension JS. ES module.
//
// Wire contract (must match api/lumi-fetch.js + api/track.js on the server):
//   POST /api/lumi-fetch   { publisher_id, door, context, placement, session_id, page_url }
//     → { ad: { ad_id, headline, body, image_url, cta_label, click_url, impression_url, ... } }
//   The impression_url returned in the ad payload is a server-built URL the
//   runtime hits to record an impression (GET pixel via sendBeacon).

export const API_ORIGIN = 'https://boostboss.ai';
export const LUMI_FETCH_URL = `${API_ORIGIN}/api/lumi-fetch`;
export const TRACK_URL = `${API_ORIGIN}/api/track`;
export const DOOR = 'npm-sdk';  // Internal door key for Lumi for Browser Extension App
export const SDK_VERSION = '0.1.0';

export const PLACEMENTS = {
  POPUP: 'popup',
  SIDEPANEL: 'sidepanel',
  NEWTAB: 'newtab',
  CARD: 'card',          // inline sponsored card (used in onboarding flow)
  CITATION: 'citation',  // sponsored citation line under an AI response
  CHIP: 'chip',          // tappable quick-reply pill
  LOADING: 'loading',    // loading-state ad shown while the extension processes
  ONBOARDING: 'onboarding', // one-time post-install hero card
};

const SESSION_KEY = 'lumi_session_id';

/**
 * Return a stable session UUID for this extension install. Uses
 * chrome.storage.session — survives across surfaces within a browser session,
 * resets on browser restart. Fallback to in-memory random for non-extension
 * contexts (tests).
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
 * Read the active tab URL — used as page_url for /api/lumi-fetch so the
 * auction can score intent against where the user is currently browsing.
 */
export async function getActiveTabUrl() {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return null;
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tabs && tabs[0] && tabs[0].url ? tabs[0].url : null;
  } catch (_e) { return null; }
}

/**
 * Build a short context summary for the active tab. Just the URL host +
 * path is fine for v0 — v1 will derive richer context from page metadata.
 */
export function summarizeContext(activeUrl) {
  if (!activeUrl) return 'browser extension';
  try {
    const u = new URL(activeUrl);
    return [u.hostname, u.pathname].filter(Boolean).join(' ').slice(0, 280) || 'browser extension';
  } catch (_e) {
    return 'browser extension';
  }
}

/**
 * Handshake — fires once per surface so the publisher's "Browser Extension"
 * verify badge in the dashboard flips from "Not started" to "Connected".
 * Mirrors the Browser App door's handshake to /api/track.
 */
export async function fireHandshake(publisherId) {
  if (!publisherId) return;
  const sessionId = await getSessionId();
  const body = {
    event: 'impression',
    campaign_id: 'lumi_extension_v0_handshake',
    session_id: sessionId,
    developer_id: publisherId,
    integration_method: DOOR,
    surface: 'extension',
    placement_id: 'lumi_handshake',
    context: {
      sdk_version: SDK_VERSION,
      handshake: true,
    },
  };
  try {
    await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch (_e) { /* silent */ }
}

/**
 * Fetch a single ad from /api/lumi-fetch.
 *
 * @param {object} opts
 * @param {string} opts.publisherId
 * @param {string} opts.placement   — e.g. PLACEMENTS.POPUP
 * @param {string} [opts.contextUrl] — active tab URL
 * @param {string} [opts.sessionId]
 * @returns {Promise<object|null>}  — ad object with impression_url + click_url
 */
export async function fetchAd({ publisherId, placement, contextUrl, sessionId }) {
  if (!publisherId) return null;
  const body = {
    publisher_id: publisherId,
    door: DOOR,
    context: summarizeContext(contextUrl),
    placement,
    format: 'native',
    session_id: sessionId || (await getSessionId()),
    page_url: contextUrl || null,
  };
  try {
    const res = await fetch(LUMI_FETCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data && data.ad) || null;
  } catch (_e) { return null; }
}

/**
 * Fire an impression beacon — uses the server-built impression_url returned
 * with the ad. Best-effort; failures silent.
 */
export function fireImpression(ad) {
  if (!ad || !ad.impression_url) return;
  try {
    // Prefer sendBeacon so the request survives popup teardown
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(ad.impression_url);
      return;
    }
    fetch(ad.impression_url, { method: 'GET', mode: 'no-cors', credentials: 'omit', keepalive: true }).catch(() => {});
  } catch (_e) { /* silent */ }
}

/**
 * Watch an element via IntersectionObserver; fire impression once when ≥50%
 * of it enters the viewport. Fall back to immediate fire if IO unavailable.
 */
export function observeImpression(el, ad) {
  if (!el || !ad) return;
  if (typeof IntersectionObserver === 'undefined') {
    fireImpression(ad);
    return;
  }
  let fired = false;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && e.intersectionRatio >= 0.5 && !fired) {
        fired = true;
        fireImpression(ad);
        io.disconnect();
        break;
      }
    }
  }, { threshold: 0.5 });
  io.observe(el);
}

/**
 * Open the ad click URL in a new tab. Uses chrome.tabs.create when
 * available so the current page state isn't disrupted.
 */
export function openClick(ad) {
  if (!ad || !ad.click_url) return;
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    try { chrome.tabs.create({ url: ad.click_url }); return; }
    catch (_e) { /* fall through */ }
  }
  try { window.open(ad.click_url, '_blank', 'noopener,noreferrer'); }
  catch (_e) { /* silent */ }
}

/**
 * Build a brand line — small "Sponsored by [brand] · [domain]" row with logo,
 * pulled from the advertiser's global Creatives library (ad.brand_kit). Returns
 * null when the library is empty. Inline styles since the extension renders
 * cross-origin in the popup/sidepanel — no shared stylesheet.
 */
export function makeBrandLine(ad) {
  const bk = ad && ad.brand_kit;
  if (!bk || (!bk.name && !bk.logo_url && !bk.domain)) return null;
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'display: flex',
    'align-items: center',
    'gap: 6px',
    'font-size: 11px',
    'color: #6b7280',
    'line-height: 1.2',
    'margin-bottom: 6px',
  ].join(';');
  if (bk.logo_url) {
    const img = document.createElement('img');
    img.src = bk.logo_url;
    img.alt = '';
    img.style.cssText = 'width:16px;height:16px;border-radius:3px;object-fit:contain;background:#fff;flex-shrink:0';
    img.onerror = function () { img.remove(); };
    wrap.appendChild(img);
  }
  if (bk.name) {
    wrap.appendChild(document.createTextNode('Sponsored by '));
    const n = document.createElement('span');
    n.textContent = bk.name;
    n.style.cssText = 'font-weight:700;color:#111';
    wrap.appendChild(n);
  }
  if (bk.domain) {
    const sep = document.createElement('span');
    sep.textContent = bk.name ? ' · ' : '';
    wrap.appendChild(sep);
    const d = document.createElement('span');
    d.textContent = bk.domain;
    wrap.appendChild(d);
  }
  return wrap;
}

/**
 * Build a voucher endcard — amber pill with offer value + optional code.
 * Pulled from ad.voucher. Returns null when not set.
 */
export function makeVoucher(ad) {
  const v = ad && ad.voucher;
  if (!v || !v.value_text) return null;
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'display: flex',
    'align-items: flex-start',
    'gap: 7px',
    'padding: 7px 10px',
    'background: #fff7ed',
    'border: 1px solid rgba(252,211,77,0.55)',
    'border-radius: 7px',
    'margin: 6px 0',
  ].join(';');
  const icon = document.createElement('span');
  icon.textContent = '🎟';
  icon.style.cssText = 'font-size:14px;line-height:1;flex-shrink:0';
  wrap.appendChild(icon);
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:1px;min-width:0';
  const value = document.createElement('span');
  value.textContent = v.value_text;
  value.style.cssText = 'font-size:11.5px;font-weight:700;color:#92400e;line-height:1.3';
  body.appendChild(value);
  if (v.code) {
    const code = document.createElement('span');
    code.textContent = 'Code: ' + v.code;
    code.style.cssText = 'font-size:10px;color:#9a3412;font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.04em';
    body.appendChild(code);
  }
  wrap.appendChild(body);
  return wrap;
}

function randomUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback
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
