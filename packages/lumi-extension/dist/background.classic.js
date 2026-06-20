// Classic (non-module) service-worker build. For extensions whose manifest
// does NOT set background.type === "module", the CLI inlines an importScripts
// call that loads this file, then does `self.LumiBackground.init(...)`.
//
// v0 stub: inline the same logic as src/background.js but without ES import
// syntax. Mirrors shared.js + background.js. A future build step will
// generate this automatically; for now it's hand-written so the install path
// works end-to-end.

(function (root) {
  'use strict';

  var API_ORIGIN = 'https://boostboss.ai';
  var LUMI_FETCH_URL = API_ORIGIN + '/api/lumi-fetch';
  var LUMI_IMPRESSION_URL = API_ORIGIN + '/api/lumi-impression';
  var HANDSHAKE_URL = API_ORIGIN + '/api/lumi-handshake';
  var PUB_KEY = 'lumi_publisher_id';
  var SESSION_KEY = 'lumi_session_id';
  var HANDSHAKE_DONE_KEY = 'lumi_handshake_done';

  function randomUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    var bytes = crypto.getRandomValues(new Uint8Array(16));
    var hex = Array.prototype.map.call(bytes, function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
    return (
      hex.slice(0, 8) + '-' +
      hex.slice(8, 12) + '-' +
      '4' + hex.slice(13, 16) + '-' +
      ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20) + '-' +
      hex.slice(20, 32)
    );
  }

  async function getSessionId() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.session) {
      return randomUuid();
    }
    try {
      var got = await chrome.storage.session.get(SESSION_KEY);
      if (got && got[SESSION_KEY]) return got[SESSION_KEY];
      var id = randomUuid();
      await chrome.storage.session.set({ [SESSION_KEY]: id });
      return id;
    } catch (_e) {
      return randomUuid();
    }
  }

  async function getActiveTabUrl() {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return null;
    try {
      var tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      var tab = tabs && tabs[0];
      return tab && tab.url ? tab.url : null;
    } catch (_e) {
      return null;
    }
  }

  async function fetchAd(opts) {
    var body = {
      publisher_id: opts.publisherId,
      placement: opts.placement,
      surface: 'browser-extension-app',
      context: opts.contextUrl ? { url: opts.contextUrl } : null,
      session_id: opts.sessionId,
      sdk: 'lumi-extension',
      sdk_version: '0.1.0',
    };
    try {
      var res = await fetch(LUMI_FETCH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      var data = await res.json();
      if (!data || !data.ad) return null;
      return data.ad;
    } catch (_e) {
      return null;
    }
  }

  async function sendHandshake(publisherId) {
    try {
      var got = await chrome.storage.local.get(HANDSHAKE_DONE_KEY);
      if (got && got[HANDSHAKE_DONE_KEY]) return;
    } catch (_e) {}

    var sessionId = await getSessionId();
    var payload = {
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
    } catch (_e) {}
  }

  var LumiBackground = {
    init: function (opts) {
      var publisherId = opts && opts.publisherId;
      if (!publisherId) {
        console.warn('[lumi] init called without publisherId — ads disabled.');
        return;
      }

      try {
        chrome.storage.local.set({ [PUB_KEY]: publisherId });
      } catch (_e) {}

      sendHandshake(publisherId).catch(function () {});

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
          if (!msg || msg.type !== 'lumi/fetch-ad') return false;
          (async function () {
            var sessionId = await getSessionId();
            var contextUrl = msg.contextUrl || (await getActiveTabUrl());
            var ad = await fetchAd({
              publisherId: publisherId,
              placement: msg.placement,
              contextUrl: contextUrl,
              sessionId: sessionId,
            });
            return ad;
          })()
            .then(function (ad) { sendResponse({ ok: true, ad: ad }); })
            .catch(function (err) {
              sendResponse({ ok: false, error: err && err.message });
            });
          return true;
        });
      }
    },
  };

  root.LumiBackground = LumiBackground;
})(typeof self !== 'undefined' ? self : globalThis);
