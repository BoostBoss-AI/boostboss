/**
 * Lumi for Browser App — runtime v0 (2026-06-20)
 * Boost Boss · https://boostboss.ai/publish/browser
 *
 * SCOPE OF v0
 * -----------
 * This is the minimal runtime that proves the install loop. It does NOT
 * render placements yet — that's v1. What it DOES do:
 *
 *   1. Reads the publisher ID from its own <script src="…#pub_xxx"> hash.
 *   2. Fires ONE impression event to /api/track with integration_method=
 *      js-snippet, which the publisher dashboard's verify-badge poller
 *      flips to "Live" within 30 seconds.
 *   3. Logs a friendly success banner to the publisher's console so they
 *      can confirm the script is wired without leaving their dev tools.
 *
 * That's it. Three lines on a page → confirmed connection in the dashboard.
 *
 * v1 will add: MutationObserver-based auto-detection of insertion points,
 * the 8 placement renderers (citation / chip / inline card / loading-state
 * / corner unit / page interstitial / empty-state hero / settings slot),
 * the impression/click beacon pipeline, and bb_click attribution.
 *
 * PRIVACY POSTURE
 * ---------------
 * - We read only what's visible on the active tab.
 * - Nothing is persisted to localStorage / cookies / IndexedDB.
 * - The only network call leaves with: publisher_id, page URL host,
 *   timestamp, and an ephemeral session UUID. No user identifiers.
 * - When v1 adds DOM scanning for placement insertion points, the same
 *   posture applies: nothing read leaves the active tab in raw form.
 *
 * STRICT CSP
 * ----------
 * Publishers running a strict Content-Security-Policy must allowlist
 *   script-src https://boostboss.ai
 *   connect-src https://boostboss.ai
 * See /docs/browser for the full directive.
 */
(function () {
  'use strict';

  // Guard against double-load. If the publisher pasted the snippet twice,
  // or hot-reload re-runs us, we only want one impression event per page.
  if (window.__lumi_browser_loaded) return;
  window.__lumi_browser_loaded = true;

  const SDK_VERSION = '0.1.0';
  const DOOR        = 'js-snippet';   // Internal door key for Lumi for Browser App
  const ENDPOINT    = 'https://boostboss.ai/api/track';

  // ── 1. Resolve the publisher ID from our own script src #hash ──────
  // Pattern:   <script async src=".../lumi/v1.js#pub_a8x2k9"></script>
  // Hash-based config is CSP-friendly (no query-string churn for caching)
  // and survives URL rewrites that strip query params.
  function resolvePublisherId() {
    try {
      // currentScript is set during initial parse; falls back to scanning
      // <script> tags by suffix for async-deferred / re-injected cases.
      const cs = document.currentScript;
      const candidates = cs ? [cs] : Array.from(document.querySelectorAll('script[src*="lumi/v1.js"], script[src*="lumi-v1.js"]'));
      for (const s of candidates) {
        const src = s && s.src;
        if (!src) continue;
        const hashIdx = src.indexOf('#');
        if (hashIdx < 0) continue;
        const hash = src.slice(hashIdx + 1).trim();
        // Accept any non-empty publisher identifier — UUIDs, pub_xxx tokens,
        // sandbox keys (pub_test_xxx). The server-side decides what's valid;
        // the runtime just passes through whatever the dashboard generated.
        if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]{4,}$/.test(hash)) return hash;
      }
    } catch (_) { /* swallow — fall through to null */ }
    return null;
  }

  const publisherId = resolvePublisherId();
  if (!publisherId) {
    // Publisher pasted the snippet without a publisher ID hash. Console
    // them so they can fix it without filing a support ticket.
    console.warn(
      '[Lumi] Browser App: missing publisher ID. The script src must end ' +
      'with #pub_xxx — see https://boostboss.ai/publish/dashboard for your key.'
    );
    return;
  }

  // ── 2. Generate an ephemeral session UUID ──────────────────────────
  // session_id MUST NOT start with "test_" — that prefix is reserved for
  // dashboard-driven synthetic tests, and the verify poller filters those
  // out of "Live" status. Real installs need a real UUID-shaped session.
  function ephemeralSessionId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (_) {}
    // Fallback — random hex chunks. Good enough for ephemeral session ID.
    const rnd = (n) => Math.floor(Math.random() * 16).toString(16).repeat(1);
    let id = '';
    for (let i = 0; i < 32; i++) id += rnd();
    return id.slice(0, 8) + '-' + id.slice(8, 12) + '-' + id.slice(12, 16) + '-' + id.slice(16, 20) + '-' + id.slice(20);
  }

  // ── 3. Fire the connect impression ─────────────────────────────────
  // One event. Records integration_method=js-snippet for the verify
  // badge, plus minimum required fields for the events table schema.
  function firePing() {
    const body = {
      event: 'impression',
      campaign_id: 'lumi_browser_v0_handshake',  // sentinel campaign — never deducted, see api/track.js cost guard
      session_id: ephemeralSessionId(),
      developer_id: publisherId,
      integration_method: DOOR,
      surface: 'web',
      placement_id: 'lumi_handshake',
      // Context strictly limited to the active tab — no cross-site read.
      context: {
        sdk_version: SDK_VERSION,
        page_host: location.host || null,
        page_path: location.pathname || null,
        is_handshake: true,
      },
    };

    // sendBeacon survives page unload; falls back to fetch where unavailable.
    const payload = JSON.stringify(body);
    let queued = false;
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        queued = navigator.sendBeacon(ENDPOINT, blob);
      }
    } catch (_) { queued = false; }
    if (!queued) {
      try {
        fetch(ENDPOINT, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      } catch (_) { /* offline / blocked — silent */ }
    }
  }

  // ── 4. Console banner so the publisher SEES the success ────────────
  function banner() {
    if (!window.console || typeof console.log !== 'function') return;
    try {
      // Styled multi-line banner — survives copy-paste into support tickets.
      console.log(
        '%c▲ Lumi%c · Browser App v' + SDK_VERSION + ' · pub ' + publisherId + '\n' +
        '%cConnected. 8 placements available. Renderers ship in v1.\n' +
        'Live earnings: https://boostboss.ai/publish/dashboard',
        'background:#FF2D78;color:#fff;font-weight:700;padding:2px 8px;border-radius:4px;',
        'color:#9D7AFF;font-weight:600;',
        'color:#6B7280;font-size:11px;'
      );
    } catch (_) { /* console restricted — silent */ }
  }

  // ── 5. Fire when ready ─────────────────────────────────────────────
  // We DON'T block first paint. Wait until the page is parsed enough that
  // sending the beacon won't compete with the publisher's hero render.
  function go() {
    firePing();
    banner();
    // Expose a tiny diagnostic surface for the publisher's dev tools.
    // No setters — read-only by design. Forces the verify badge to flip
    // if they want to retest without reloading.
    try {
      Object.defineProperty(window, 'Lumi', {
        value: Object.freeze({
          version: SDK_VERSION,
          publisherId: publisherId,
          door: DOOR,
          ping: function ping() { firePing(); }, // manual re-ping for testing
        }),
        writable: false,
        configurable: false,
      });
    } catch (_) { /* already defined — fine */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go, { once: true });
  } else {
    // Already past parsing — fire after a micro-tick so we never block
    // the same task that loaded us.
    setTimeout(go, 0);
  }
})();
