/* ─────────────────────────────────────────────────────────────────
 * Boost Boss dashboard auth guard
 * Mounted on /ads/dashboard and /publish/dashboard before any other
 * scripts. Intercepts every fetch() to /api/* and:
 *
 *   1. Catches 401 responses
 *   2. Attempts a one-shot refresh via /api/auth?action=refresh
 *      using the refresh_token saveSession() persisted
 *   3. On refresh success → retries the original request with the
 *      new access_token, transparently to the caller
 *   4. On refresh failure → clears all session keys + redirects to
 *      /ads/signin or /publish/signin with ?expired=1 so the signin
 *      page can show a friendly toast and pre-fill the email field
 *
 * Refreshes are single-flight: if 10 simultaneous fetches all hit a
 * 401, only ONE refresh call is made and all 10 wait on the same
 * promise. Prevents Supabase rate-limiting and refresh-token
 * rotation races.
 *
 * Safe to load before any other scripts — no DOM dependencies, no
 * fetch calls of its own at boot time, no waiting on userProfile or
 * currentUser to be set. The wrap on window.fetch is installed at
 * module evaluation time.
 * ───────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Avoid double-mount when the same script is loaded twice (e.g.
  // by a stale Vercel cache layer + a fresh deploy in the same tab).
  if (window.__bbAuthGuardMounted) return;
  window.__bbAuthGuardMounted = true;

  var originalFetch = window.fetch.bind(window);

  function isPublisherSurface() {
    try { return window.location.pathname.startsWith('/publish'); } catch (_) { return false; }
  }
  function ns() { return isPublisherSurface() ? 'bb_pub' : 'bb_adv'; }
  function signinPath() { return isPublisherSurface() ? '/publish/signin' : '/ads/signin'; }

  function getRefreshToken() {
    try {
      return localStorage.getItem(ns() + '_refresh') || localStorage.getItem('bb_refresh') || null;
    } catch (_) { return null; }
  }

  // Update every storage key + every in-memory token slot the
  // dashboards might read. We over-write rather than inspect to keep
  // this script independent of the dashboard's internal state.
  function setAccessToken(newToken) {
    if (!newToken) return;
    try {
      localStorage.setItem(ns() + '_token', newToken);
      localStorage.setItem('bb_token', newToken);

      // Advertiser dashboard wraps the token in a JSON blob inside
      // bb_session_token — keep that in sync so the next page nav
      // doesn't reload a stale access_token.
      try {
        var raw = localStorage.getItem('bb_session_token');
        if (raw) {
          var obj = JSON.parse(raw);
          if (obj && typeof obj === 'object') {
            obj.token = newToken;
            localStorage.setItem('bb_session_token', JSON.stringify(obj));
          }
        }
      } catch (_) {}

      // Publisher dashboard stores under bb_dev_session.
      try {
        var devRaw = localStorage.getItem('bb_dev_session');
        if (devRaw) {
          var devObj = JSON.parse(devRaw);
          if (devObj && typeof devObj === 'object') {
            devObj.token = newToken;
            localStorage.setItem('bb_dev_session', JSON.stringify(devObj));
          }
        }
      } catch (_) {}
    } catch (_) {}

    // Mutate live references that long-running closures may hold.
    try { if (window.currentUser && typeof window.currentUser === 'object') window.currentUser.token = newToken; } catch (_) {}
    try { if (window.userProfile && typeof window.userProfile === 'object' && 'token' in window.userProfile) window.userProfile.token = newToken; } catch (_) {}
  }

  function setRefreshToken(newRefresh) {
    if (!newRefresh) return;
    try {
      localStorage.setItem(ns() + '_refresh', newRefresh);
      localStorage.setItem('bb_refresh', newRefresh);
    } catch (_) {}
  }

  function clearSession() {
    var keys = [
      'bb_session_token', 'bb_user_data',
      'bb_adv_token', 'bb_adv_user', 'bb_adv_profile', 'bb_adv_refresh',
      'bb_pub_token', 'bb_pub_user', 'bb_pub_profile', 'bb_pub_refresh',
      'bb_token', 'bb_user', 'bb_profile', 'bb_refresh',
      'bb_dev_session', 'bb_dev_data',
    ];
    try { keys.forEach(function (k) { localStorage.removeItem(k); }); } catch (_) {}
  }

  function redirectToSignin() {
    try {
      // Don't loop if we're already on a signin page.
      var p = window.location.pathname || '';
      if (p.indexOf('/signin') !== -1 || p.indexOf('/signup') !== -1) return;
      window.location.href = signinPath() + '?expired=1';
    } catch (_) {}
  }

  // Single-flight refresh promise — shared across all parallel callers.
  var refreshing = null;

  function doRefresh() {
    if (refreshing) return refreshing;
    var rt = getRefreshToken();
    if (!rt) return Promise.reject(new Error('no_refresh_token'));

    refreshing = originalFetch('/api/auth?action=refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || !j || !j.session || !j.session.access_token) {
            var err = new Error((j && j.error) || 'refresh_failed');
            err.refreshFailed = true;
            throw err;
          }
          setAccessToken(j.session.access_token);
          if (j.session.refresh_token) setRefreshToken(j.session.refresh_token);
          return j.session.access_token;
        });
      })
      .finally(function () { refreshing = null; });

    return refreshing;
  }

  // The interceptor. Wraps fetch so 401s get one retry after a refresh.
  window.fetch = function (input, init) {
    init = init || {};
    var url = '';
    try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (_) {}

    // Don't intercept the refresh endpoint itself — prevents recursion
    // when the refresh itself fails.
    if (url.indexOf('/api/auth?action=refresh') !== -1) {
      return originalFetch(input, init);
    }

    return originalFetch(input, init).then(function (res) {
      // Only intervene on 401s coming from our own API surface.
      if (res.status !== 401) return res;
      var isOurApi = url.indexOf('/api/') !== -1 || url.indexOf('/v1/') !== -1;
      if (!isOurApi) return res;

      // No refresh token at all → straight to signin.
      if (!getRefreshToken()) {
        clearSession();
        redirectToSignin();
        return res;
      }

      return doRefresh().then(function (newToken) {
        // Build a new init with the fresh bearer + retry once.
        var retryInit = Object.assign({}, init);
        var hdrs = retryInit.headers ? Object.assign({}, retryInit.headers) : {};
        // Headers may be a Headers instance — normalize to plain object.
        if (init.headers && typeof init.headers.forEach === 'function') {
          hdrs = {};
          init.headers.forEach(function (v, k) { hdrs[k] = v; });
        }
        hdrs['Authorization'] = 'Bearer ' + newToken;
        retryInit.headers = hdrs;
        return originalFetch(input, retryInit);
      }).catch(function (err) {
        // Refresh truly failed — wipe + bounce.
        if (err && err.refreshFailed) {
          clearSession();
          redirectToSignin();
        }
        return res;  // surface the original 401 so callers' .catch still fires
      });
    });
  };
})();
