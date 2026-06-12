/**
 * Boost Boss Conversion Pixel
 *
 * Single-file conversion-tracking script for advertisers. Once installed,
 * advertisers can fire conversions from their landing / thank-you page
 * without writing any tracking logic themselves.
 *
 * The pixel handles BOTH attribution paths automatically — one snippet,
 * the script figures out which (or both) to fire based on URL params:
 *
 *   1. AD-AUCTION (publisher side)
 *      Triggered when bbx_auc / bbx_cmp are in the URL (BBX click-through).
 *      Fires to /api/track with auction_id + campaign_id.
 *
 *   2. AFFILIATE (audience side, [[commission-attribution-model]])
 *      Triggered when bb_click is in the URL (boostboss.ai/s/<token> redirect).
 *      Fires to /api/conversions/postback with bb_click. Commission is
 *      computed server-side from the product's default_commission_pct.
 *
 * Both can fire on the same page if the visitor's session has both
 * identifiers (rare but possible).
 *
 * INSTALLATION (one snippet, paste before </head> on your conversion page):
 *
 *   <script async src="https://boostboss.ai/pixel.js"
 *           data-advertiser-id="adv_xxx"></script>
 *   <script>
 *     window.bbq = window.bbq || [];
 *     bbq.push(['track', 'signup',   { value: 29.99, currency: 'USD' }]);
 *     bbq.push(['track', 'purchase', { value: 49.00, idempotency_key: 'ord_12345' }]);
 *   </script>
 *
 * API:
 *   bbq.push(['init',  advertiserId])           // optional override of data-advertiser-id
 *   bbq.push(['track', conversionType, props])  // conversionType ∈ signup|purchase|trial|...
 *
 * `props` may contain:
 *   value           Number — gross purchase value (USD by default)
 *   currency        String — ISO code, defaults USD
 *   external_id     String — your own order id (also used as idempotency_key
 *                            on the affiliate postback if idempotency_key
 *                            isn't supplied separately)
 *   idempotency_key String — explicit dedupe key for affiliate postback
 *   metadata        Object — anything else useful (plan, tier, etc.)
 *
 * Explicit affiliate-only API (skips the ad-auction path):
 *   window.bbx = window.bbx || {};
 *   window.bbx.trackConversion({ type, value, idempotency_key, metadata });
 */
(function () {
  // Queue can already exist if the page used the standard snippet that
  // pushes commands before the script loads — drain it after init.
  var existingQueue = (window.bbq && window.bbq.length) ? window.bbq.slice() : [];
  var ENDPOINT = (window.__BBX_ENDPOINT__) || resolveOriginEndpoint() || 'https://boostboss.ai/api/track';
  var DEBUG    = !!window.__BBX_PIXEL_DEBUG__;

  function resolveOriginEndpoint() {
    // If pixel.js is loaded from a non-prod origin (staging / preview)
    // fire to the same origin so dev environments stay self-contained.
    try {
      var s = document.currentScript;
      if (!s) {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
          if ((scripts[i].src || '').indexOf('/pixel.js') !== -1) { s = scripts[i]; break; }
        }
      }
      if (s && s.src) {
        var u = new URL(s.src, window.location.href);
        return u.origin + '/api/track';
      }
    } catch (_) {}
    return null;
  }

  // Read `bbx_auc` / `bbx_cmp` from the current URL or fall back to the
  // referrer (e.g. when the click landed on a page that then redirected
  // to a conversion page that stripped the query string).
  function readAttribution() {
    var out = { auction_id: null, campaign_id: null };
    function fromUrl(href) {
      try {
        var u = new URL(href);
        var auc = u.searchParams.get('bbx_auc');
        var cmp = u.searchParams.get('bbx_cmp');
        if (auc) out.auction_id  = auc;
        if (cmp) out.campaign_id = cmp;
      } catch (_) {}
    }
    fromUrl(window.location.href);
    if (!out.auction_id && document.referrer) fromUrl(document.referrer);
    // Persist to sessionStorage so a multi-step funnel (landing → signup
    // → success) can still attribute even after the URL is rewritten.
    try {
      if (out.auction_id) {
        sessionStorage.setItem('bbx_auc', out.auction_id);
        if (out.campaign_id) sessionStorage.setItem('bbx_cmp', out.campaign_id);
      } else {
        out.auction_id  = sessionStorage.getItem('bbx_auc');
        out.campaign_id = sessionStorage.getItem('bbx_cmp');
      }
    } catch (_) {}
    return out;
  }

  // ── Affiliate-side attribution (Phase 3b — [[commission-attribution-model]])
  //
  // Read bb_click from the URL params first, fall back to sessionStorage so
  // multi-page funnels work (landing → signup → thank-you). Cookies are NOT
  // checked here — the URL/session pair is more reliable across Safari ITP
  // and ad-blockers.
  function readBBClick() {
    var click = null;
    try {
      var u = new URL(window.location.href);
      click = u.searchParams.get('bb_click');
      if (click) {
        try { sessionStorage.setItem('bbx_click', click); } catch (_) {}
        return click;
      }
    } catch (_) {}
    try { return sessionStorage.getItem('bbx_click') || null; } catch (_) {}
    return null;
  }

  // Resolve affiliate postback endpoint to the same origin as pixel.js
  // (so staging / preview environments stay self-contained).
  function affiliatePostbackEndpoint() {
    try {
      var s = document.currentScript;
      if (!s) {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
          if ((scripts[i].src || '').indexOf('/pixel.js') !== -1) { s = scripts[i]; break; }
        }
      }
      if (s && s.src) {
        var u = new URL(s.src, window.location.href);
        return u.origin + '/api/conversions/postback';
      }
    } catch (_) {}
    return 'https://boostboss.ai/api/conversions/postback';
  }

  function fireAffiliateConversion(conversionType, props) {
    var bbClick = readBBClick();
    if (!bbClick) {
      log('no bb_click — skipping affiliate conversion postback');
      return Promise.resolve({ skipped: 'no_bb_click' });
    }
    var body = {
      bb_click:        bbClick,
      event_type:      conversionType || 'signup',
      amount:          (props && props.value  != null) ? Number(props.value)
                     : (props && props.amount != null) ? Number(props.amount) : 0,
      currency:        (props && props.currency) || 'USD',
      // External_id doubles as idempotency_key on the affiliate path when
      // the advertiser hasn't supplied an explicit one. Order IDs are the
      // most common stable dedupe value advertisers already have.
      idempotency_key: (props && (props.idempotency_key || props.external_id)) || null,
      metadata:        (props && props.metadata) || {},
    };
    log('firing affiliate conversion', body);
    var url = affiliatePostbackEndpoint();

    // fetch with keepalive — survives the user navigating away (closing
    // the thank-you tab, clicking through, etc.). Returns a Promise so
    // advertisers using window.bbx.trackConversion can await it if they
    // really want to.
    try {
      return fetch(url, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (r) {
        return r.json().then(function (j) {
          if (DEBUG) log(r.ok ? 'affiliate conversion accepted' : ('rejected ' + r.status), j);
          return j;
        }).catch(function () { return { status: r.status }; });
      }).catch(function (e) {
        log('affiliate fetch failed:', e && e.message);
        return { error: e && e.message };
      });
    } catch (e) {
      log('affiliate fetch threw:', e && e.message);
      return Promise.resolve({ error: e && e.message });
    }
  }

  // Resolve the advertiser id from data-advertiser-id on the script tag,
  // a previously-pushed init command, or a window override.
  function readAdvertiserId() {
    if (window.__BBX_ADVERTISER_ID__) return String(window.__BBX_ADVERTISER_ID__);
    try {
      var s = document.currentScript || (function () {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
          if ((scripts[i].src || '').indexOf('/pixel.js') !== -1) return scripts[i];
        }
        return null;
      })();
      if (s && s.getAttribute('data-advertiser-id')) {
        return s.getAttribute('data-advertiser-id');
      }
    } catch (_) {}
    return null;
  }

  function log() {
    if (!DEBUG) return;
    try { console.log.apply(console, ['[bbq]'].concat([].slice.call(arguments))); } catch (_) {}
  }

  function fire(conversionType, props) {
    var attr = readAttribution();
    if (!attr.campaign_id && !attr.auction_id) {
      log('no attribution — skipping. Pass bbx_auc/bbx_cmp in the click URL.');
      return;
    }
    if (!attr.campaign_id) {
      log('no campaign_id — pixel will fire but advertiser dashboard cannot attribute');
    }

    var body = {
      event:           'conversion',
      campaign_id:     attr.campaign_id,
      auction_id:      attr.auction_id,
      conversion_type: conversionType || 'signup',
      value:           (props && props.value != null) ? Number(props.value) : null,
      currency:        (props && props.currency) || 'USD',
      external_id:     (props && props.external_id) || null,
      session_id:      (props && props.session_id) || null,
    };

    log('firing conversion', body);
    var url  = ENDPOINT;
    var json = JSON.stringify(body);

    // Prefer fetch with keepalive — same survival semantics as
    // sendBeacon for nav-away cases, but with a real Content-Type
    // header that Vercel's body parser handles reliably (sendBeacon's
    // Blob path has been flaky on serverless runtimes).
    try {
      fetch(url, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: json,
      }).then(function (r) {
        if (DEBUG) {
          r.text().then(function (t) {
            log(r.ok ? 'conversion accepted' : ('rejected ' + r.status + ': ' + t));
          });
        }
      }).catch(function (e) { log('fetch failed:', e && e.message); });
      return;
    } catch (_) {}

    // sendBeacon fallback — only if fetch is unavailable (legacy browsers).
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([json], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      }
    } catch (_) {}
  }

  // Public command processor. Each item is [verb, ...args].
  // 'track' fires BOTH attribution paths — fire() handles the ad-auction
  // side (bbx_auc/bbx_cmp), fireAffiliateConversion() handles the
  // affiliate side (bb_click). Either or both are no-ops if their
  // identifier isn't present in the URL/session.
  function process(cmd) {
    if (!Array.isArray(cmd) || cmd.length === 0) return;
    var verb = cmd[0];
    if (verb === 'init') {
      window.__BBX_ADVERTISER_ID__ = cmd[1];
    } else if (verb === 'track') {
      var conversionType = cmd[1];
      var props          = cmd[2] || {};
      fire(conversionType, props);                    // ad-auction path
      fireAffiliateConversion(conversionType, props); // affiliate path
    }
  }

  // Replace the pre-load array stub with a real queue object whose
  // .push() runs the command synchronously. Drain anything queued
  // before the script loaded.
  var queue = { push: function (cmd) { process(cmd); } };
  window.bbq = queue;
  for (var i = 0; i < existingQueue.length; i++) process(existingQueue[i]);

  // Explicit affiliate-only API — for advertisers who want to skip the
  // ad-auction firing (e.g. they don't run BBX ads, only have affiliates)
  // OR want a Promise back so they can await the postback.
  //
  //   window.bbx.trackConversion({ type: 'purchase', value: 49.00,
  //                                idempotency_key: 'ord_12345',
  //                                metadata: { plan: 'pro' } })
  //     .then(r => console.log('attributed:', r));
  window.bbx = window.bbx || {};
  window.bbx.trackConversion = function (opts) {
    opts = opts || {};
    var type = opts.type || opts.event_type || 'signup';
    return fireAffiliateConversion(type, opts);
  };

  // Auto-init from data-advertiser-id if no explicit init command ran.
  if (!window.__BBX_ADVERTISER_ID__) {
    var adv = readAdvertiserId();
    if (adv) window.__BBX_ADVERTISER_ID__ = adv;
  }

  // On page load, capture bb_click into sessionStorage even if track
  // hasn't been called yet — so the multi-step funnel (landing → signup
  // → thank-you) preserves attribution even if the URL is rewritten
  // before the conversion fires.
  readBBClick();
})();
