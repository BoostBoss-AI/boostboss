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

  // ── 5. Build a short page-context summary ──────────────────────────
  // Used by the auction to match relevant ads. Visible-tab text only,
  // truncated, no input values or password fields. v0 keeps this very
  // simple — v1 will add the smarter context extractor.
  function buildContext() {
    try {
      const title = (document.title || '').trim();
      const metaDesc = (function () {
        const m = document.querySelector('meta[name="description"]');
        return m && m.getAttribute('content') ? m.getAttribute('content').trim() : '';
      })();
      const h1 = (function () {
        const el = document.querySelector('h1');
        return el && el.textContent ? el.textContent.trim() : '';
      })();
      const path = (location.pathname || '/').replace(/^\/+/, '').replace(/\/+$/, '');
      const parts = [title, h1, metaDesc, path].filter(Boolean);
      // Single-sentence context, length-capped so we don't ship full page text.
      return parts.join(' · ').slice(0, 280) || 'general browse';
    } catch (_) {
      return 'general browse';
    }
  }

  // ── 6. Ad fetch — calls /api/lumi-fetch with publisher_id + context ─
  // Returns an ad object or null (no fill / rate limited / no publisher).
  function fetchAd(placement, contextOverride) {
    const body = {
      publisher_id: publisherId,
      context:      contextOverride || buildContext(),
      placement:    placement,
      format:       'native',
      session_id:   __sessionId,
      page_url:     location.href || null,
    };
    return fetch('https://boostboss.ai/api/lumi-fetch', {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'X-Lumi-Source': 'browser-app' },
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.ad) ? j.ad : null; })
      .catch(function () { return null; });
  }

  // ── 7. Impression + click beacons ──────────────────────────────────
  // Impression fires once per rendered ad when the element first
  // intersects the viewport. Click fires immediately on tap.
  function fireImpression(ad) {
    if (!ad || !ad.impression_url) return;
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ad.impression_url);
        return;
      }
    } catch (_) {}
    try { fetch(ad.impression_url, { mode: 'no-cors', credentials: 'omit', keepalive: true }).catch(function () {}); }
    catch (_) {}
  }
  function onClick(ad) {
    // Navigate to click_url (which 302s through /api/track for attribution).
    // Opens in a new tab so the publisher's app keeps its state.
    if (!ad) return;
    const url = ad.click_url || ad.cta_url;
    if (!url) return;
    try { window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (_) { location.href = url; }
  }

  // ── 8. Visibility-based impression tracking ─────────────────────────
  // IntersectionObserver fires the impression beacon once when the ad
  // element first enters the viewport. No-op fallback for ancient
  // browsers — they get the impression on render instead.
  function observeImpression(el, ad) {
    if (!el || !ad) return;
    if (typeof IntersectionObserver === 'undefined') {
      fireImpression(ad);
      return;
    }
    let fired = false;
    const io = new IntersectionObserver(function (entries) {
      for (const e of entries) {
        if (e.isIntersecting && !fired) {
          fired = true;
          fireImpression(ad);
          try { io.disconnect(); } catch (_) {}
          return;
        }
      }
    }, { threshold: 0.4 });
    try { io.observe(el); } catch (_) { fireImpression(ad); }
  }

  // ── 9. Style-injection guard ───────────────────────────────────────
  // Injects the Lumi CSS namespace once. All placements use BEM-prefixed
  // classes (lumi-*) so we don't collide with the publisher's stylesheet.
  let __stylesInjected = false;
  function injectStyles() {
    if (__stylesInjected) return;
    __stylesInjected = true;
    const css = [
      // Corner unit — fixed bottom-right, dismissable, sliding entrance
      '.lumi-corner{position:fixed;bottom:18px;right:18px;width:300px;max-width:calc(100vw - 36px);background:#fff;border:1px solid #E5E7EB;border-radius:14px;box-shadow:0 12px 32px rgba(15,15,26,0.18);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;font-size:13px;color:#0F0F1A;z-index:2147483000;overflow:hidden;animation:lumi-slide-in 0.4s cubic-bezier(0.16,1,0.3,1) both}',
      '.lumi-corner__inner{padding:12px 14px 14px;position:relative}',
      '.lumi-corner__disclosure{font-size:9.5px;font-weight:700;color:#E01E65;letter-spacing:0.08em;text-transform:uppercase;display:flex;align-items:center;gap:6px;margin-bottom:7px}',
      '.lumi-corner__disclosure-mark{background:#FF2D78;color:#fff;font-weight:900;letter-spacing:-0.5px;font-size:8.5px;padding:1px 4px;border-radius:3px}',
      '.lumi-corner__close{position:absolute;top:8px;right:9px;width:20px;height:20px;background:transparent;border:none;color:#9CA3AF;font-size:15px;line-height:1;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;padding:0}',
      '.lumi-corner__close:hover{background:#F3F4F6;color:#0F0F1A}',
      '.lumi-corner__image{width:100%;height:104px;background:#F3F4F6;border-radius:8px;margin-bottom:9px;overflow:hidden;display:block;object-fit:cover}',
      '.lumi-corner__headline{font-weight:700;font-size:13.5px;line-height:1.35;color:#0F0F1A;margin-bottom:4px}',
      '.lumi-corner__body{font-size:12px;color:#4B5563;line-height:1.45;margin-bottom:10px}',
      '.lumi-corner__cta{display:inline-block;background:#FF2D78;color:#fff;font-weight:700;font-size:12px;padding:7px 14px;border-radius:7px;text-decoration:none;cursor:pointer;border:none;font-family:inherit}',
      '.lumi-corner__cta:hover{background:#E01E65}',
      '@keyframes lumi-slide-in{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '@media (prefers-reduced-motion: reduce){.lumi-corner{animation:none}}',
    ].join('\n');
    try {
      const style = document.createElement('style');
      style.setAttribute('data-lumi-styles', 'v0.1');
      style.appendChild(document.createTextNode(css));
      document.head.appendChild(style);
    } catch (_) {}
  }

  // ── 10. Corner unit placement ──────────────────────────────────────
  // The simplest placement to ship — no DOM scanning required. Fixed
  // position bottom-right, dismissable, one per page, lasts the session.
  // Auto-disabled if the publisher's app already has a corner-unit area
  // (we look for [data-lumi-disable] = "corner").
  let __cornerShown = false;
  function renderCornerUnit() {
    if (__cornerShown) return;
    if (document.querySelector('[data-lumi-disable="corner"], [data-lumi-disable="all"]')) return;
    fetchAd('corner').then(function (ad) {
      if (!ad) return;
      __cornerShown = true;
      injectStyles();
      const el = document.createElement('div');
      el.className = 'lumi-corner';
      el.setAttribute('role', 'complementary');
      el.setAttribute('aria-label', 'Sponsored content');
      // Build via createElement instead of innerHTML so we never inject
      // unsanitized ad copy into the publisher's DOM as HTML.
      const inner = document.createElement('div');
      inner.className = 'lumi-corner__inner';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'lumi-corner__close';
      closeBtn.setAttribute('aria-label', 'Close sponsored content');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        try { el.parentNode && el.parentNode.removeChild(el); } catch (_) {}
      });
      inner.appendChild(closeBtn);

      const disclosure = document.createElement('div');
      disclosure.className = 'lumi-corner__disclosure';
      const mark = document.createElement('span');
      mark.className = 'lumi-corner__disclosure-mark';
      mark.textContent = 'BB';
      disclosure.appendChild(mark);
      disclosure.appendChild(document.createTextNode(' ' + (ad.disclosure_label || 'Sponsored')));
      inner.appendChild(disclosure);

      if (ad.image_url) {
        const img = document.createElement('img');
        img.className = 'lumi-corner__image';
        img.src = ad.image_url;
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        inner.appendChild(img);
      }

      if (ad.headline) {
        const h = document.createElement('div');
        h.className = 'lumi-corner__headline';
        h.textContent = ad.headline;
        inner.appendChild(h);
      }

      if (ad.body) {
        const b = document.createElement('div');
        b.className = 'lumi-corner__body';
        b.textContent = ad.body;
        inner.appendChild(b);
      }

      const cta = document.createElement('button');
      cta.className = 'lumi-corner__cta';
      cta.type = 'button';
      cta.textContent = (ad.cta_label || 'Learn more') + ' →';
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        onClick(ad);
      });
      inner.appendChild(cta);

      el.appendChild(inner);
      // Also let the whole card surface count as a click target — but
      // only if the click landed outside the close button or CTA.
      el.addEventListener('click', function (e) {
        if (e.target && (e.target.closest('.lumi-corner__close') || e.target.closest('.lumi-corner__cta'))) return;
        onClick(ad);
      });

      // Insert into DOM and start impression-on-visibility watch
      document.body.appendChild(el);
      observeImpression(el, ad);
    });
  }

  // Ephemeral session id, reused across all ad-fetch calls on this page.
  const __sessionId = (function () {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch (_) {}
    return 'lumi_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now();
  })();

  // ── 11. Fire when ready ────────────────────────────────────────────
  // We DON'T block first paint. Wait until the page is parsed enough that
  // sending the beacon won't compete with the publisher's hero render.
  function go() {
    firePing();
    banner();
    // Render the corner unit after a short delay so the publisher's app
    // has time to lay out its own UI first. Feels less intrusive.
    setTimeout(renderCornerUnit, 1500);
    // Expose a tiny diagnostic surface for the publisher's dev tools.
    // No setters — read-only by design.
    try {
      Object.defineProperty(window, 'Lumi', {
        value: Object.freeze({
          version: SDK_VERSION,
          publisherId: publisherId,
          door: DOOR,
          ping: function ping() { firePing(); },
          corner: function corner() { __cornerShown = false; renderCornerUnit(); },
          context: buildContext(),
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
