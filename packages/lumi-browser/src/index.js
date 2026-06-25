// @boostbossai/lumi-browser — Browser App door runtime SDK
//
// Thin proxy around the canonical Lumi browser snippet that lives at
// https://boostboss.ai/lumi.js. The script handles all 8 Browser App
// placements (corner, card, citation, chip, hero, loading, settings,
// interstitial) and renders brand-kit + voucher endcards pulled from
// the advertiser's global Creatives library — same renderer the JS
// snippet integration uses.
//
// This package exists for publishers using bundlers (Vite, Webpack,
// Next.js, etc.) who would rather `import` the SDK than paste a
// <script> tag. Both surfaces produce identical impressions and book
// to the same auction.
//
// USAGE
//
//   import { init, render, refresh, destroy, trackConversion } from '@boostbossai/lumi-browser';
//
//   // Boot once at startup (call as early as possible — auto-discovery
//   // of data-lumi-slot elements runs as soon as the script is parsed).
//   await init({ publisherId: 'pub_xxx' });
//
//   // Manual mount for slots created dynamically (e.g. React components
//   // that aren't in the DOM at boot time).
//   render(myDiv, { format: 'card', context: 'reading list' });
//
//   // Refresh all slots after navigation in a SPA.
//   refresh();
//
//   // Track a conversion from your own page (e.g. after a successful
//   // checkout). Mirrors the bbq.push('track', ...) snippet API.
//   trackConversion({ type: 'signup', value: 29.99, currency: 'USD' });
//
// The package re-exports every method that window.Lumi exposes when
// the snippet runs in <script> mode. See https://boostboss.ai/docs/web
// for the full reference.

const DEFAULT_API_BASE = 'https://boostboss.ai';

/** Cached promise resolving to window.Lumi. init() is idempotent — first
 *  call kicks off the script load, subsequent calls return the same promise. */
let _bootPromise = null;
let _bootedOptions = null;

/**
 * Boot the Lumi runtime. Loads boostboss.ai/lumi.js (or your custom
 * apiBase + /lumi.js) with the supplied config and resolves once the
 * snippet has finished initializing.
 *
 * @param {Object} options
 * @param {string} options.publisherId — your publisher ID (pub_xxx).
 * @param {string} [options.apiBase='https://boostboss.ai'] — override API base.
 * @param {boolean} [options.debug=false] — enable console logging.
 * @returns {Promise<Object>} — resolves to the window.Lumi global.
 */
export function init(options) {
  if (_bootPromise) return _bootPromise;
  if (!options || !options.publisherId) {
    return Promise.reject(new Error('lumi-browser: init() requires { publisherId }'));
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('lumi-browser: init() requires a browser environment'));
  }
  _bootedOptions = {
    publisherId: options.publisherId,
    apiBase:     options.apiBase || DEFAULT_API_BASE,
    debug:       !!options.debug,
  };
  _bootPromise = new Promise((resolve, reject) => {
    // If lumi.js is already on the page (e.g. publisher loaded both
    // the script tag AND the npm wrapper), reuse it instead of injecting
    // a duplicate. Idempotent on the script side too (window.Lumi.__loaded).
    if (window.Lumi && window.Lumi.__loaded) {
      resolve(window.Lumi);
      return;
    }
    const s = document.createElement('script');
    s.setAttribute('data-publisher-id', _bootedOptions.publisherId);
    s.setAttribute('data-api-base',     _bootedOptions.apiBase);
    if (_bootedOptions.debug) s.setAttribute('data-debug', 'true');
    s.src = _bootedOptions.apiBase + '/lumi.js';
    s.async = true;
    s.onload = () => {
      if (window.Lumi) resolve(window.Lumi);
      else reject(new Error('lumi-browser: lumi.js loaded but window.Lumi not set'));
    };
    s.onerror = () => reject(new Error('lumi-browser: failed to load ' + s.src));
    document.head.appendChild(s);
  });
  return _bootPromise;
}

/** Manually mount an ad in the given slot element. Returns a promise.
 *  Bypasses auto-discovery — useful for SPA components rendered after boot. */
export async function render(el, opts) {
  const lumi = await _require();
  return lumi.render(el, opts);
}

/** Re-fetch + re-render. Pass a CSS selector to scope to specific slots;
 *  no arg refreshes all. */
export async function refresh(selector) {
  const lumi = await _require();
  return lumi.refresh(selector);
}

/** Tear down all rendered ads and disconnect observers. */
export async function destroy() {
  const lumi = await _require();
  return lumi.destroy();
}

/** Fire a publisher-side conversion event (e.g. after checkout).
 *  Same shape as the bbq.push('track', ...) snippet API. */
export async function trackConversion(payload) {
  const lumi = await _require();
  return lumi.trackConversion(payload);
}

/** Latest error object, or null. */
export async function getLastError() {
  const lumi = await _require();
  return lumi.getLastError();
}

/** Toggle debug logging at runtime. */
export async function setDebug(on) {
  const lumi = await _require();
  return lumi.setDebug(on);
}

/** Subscribe to a Lumi event. Returns an unsubscribe function.
 *  Events: 'ready' | 'no_fill' | 'error' | 'impression' | 'click' | 'close'.
 *  Mirrors the window.addEventListener('lumi:<name>', ...) pattern but
 *  exposes it as a single ergonomic helper for npm consumers. */
export function on(eventName, handler) {
  if (typeof window === 'undefined') return () => {};
  const wrapper = (e) => handler(e && e.detail);
  window.addEventListener('lumi:' + eventName, wrapper);
  return () => window.removeEventListener('lumi:' + eventName, wrapper);
}

/** SDK semver. Matches the npm package version (NOT the lumi.js version,
 *  which is its own thing). */
export const version = '0.1.0';

// ── Internal ──────────────────────────────────────────────────────────────
async function _require() {
  if (!_bootPromise) {
    throw new Error('lumi-browser: call init({ publisherId }) before any other method');
  }
  return _bootPromise;
}
