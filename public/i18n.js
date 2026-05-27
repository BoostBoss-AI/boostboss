// Boost Boss i18n — URL-based language routing.
// Locale lives in the first path segment, e.g. /zh-TW/publish/mcp.
// When the user switches language, we preserve the rest of the path —
// /publish/mcp → /zh-TW/publish/mcp, /zh/publish → /ja/publish, etc.
(function () {
  'use strict';

  var DICT_VERSION = 'bb-20260421';
  var SUPPORTED   = ['en', 'zh', 'zh-TW', 'ja', 'ko', 'vi'];
  var DEFAULT     = 'en';
  var STORAGE_KEY = 'bb_lang';   // localStorage key for saved language preference

  // Paths whose pages have been translated AND have /:lang/<path> rewrites
  // in vercel.json. When the current page has a locale prefix, links to
  // these paths get rewritten in-place so the user keeps their language
  // selection across in-site navigation.
  // Anything NOT in this list (e.g. /publish/signup, /docs, /trust) keeps
  // its bare path and routes to the default locale — by design, since
  // those pages don't have translations yet.
  var LOCALIZED_PATHS = {
    '/publish': 1,
    '/publish/mcp': 1,
    '/publish/ai-apps': 1,
    '/publish/extensions': 1,
    '/publish/bots': 1,
    '/publish/no-code': 1,
    '/ads': 1
  };

  // Parse first path segment, e.g. "/en/foo" -> "en"
  function pathLang() {
    var seg = (window.location.pathname || '/').split('/')[1] || '';
    return SUPPORTED.indexOf(seg) !== -1 ? seg : null;
  }

  function getLang() {
    return pathLang() || DEFAULT;
  }

  // Remove leading locale segment from a path, if present.
  // "/zh-TW/publish/mcp" -> "/publish/mcp"
  // "/publish/mcp"       -> "/publish/mcp"  (untouched)
  // "/zh-TW"             -> "/"
  function stripLocaleFromPath(pathname) {
    var parts = (pathname || '/').split('/');
    if (parts.length > 1 && SUPPORTED.indexOf(parts[1]) !== -1) {
      parts.splice(1, 1);
      var stripped = parts.join('/');
      return stripped || '/';
    }
    return pathname || '/';
  }

  // Build the URL to navigate to when switching to `lang`, preserving the
  // current page path. Includes window.location.search/hash so query params
  // and anchors survive the locale switch.
  function targetForLang(lang) {
    var rest = stripLocaleFromPath(window.location.pathname);
    var prefix = (rest === '/' || rest === '') ? ('/' + lang) : ('/' + lang + rest);
    return prefix + (window.location.search || '') + (window.location.hash || '');
  }

  // Save / load the user's preferred language. localStorage may throw in
  // private-browsing modes or storage-disabled embeds — wrap everything.
  function savePref(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
  }
  function loadPref() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return (v && SUPPORTED.indexOf(v) !== -1) ? v : null;
    } catch (_) { return null; }
  }

  // If the current URL has no locale prefix but the user has a saved
  // preference (and the path has a locale-prefixed equivalent), redirect
  // to the user's preferred-language URL. Replaces history so the back
  // button doesn't loop. Returns true if a redirect was kicked off, so
  // the caller can short-circuit any further work.
  function maybeRedirectToSavedLang() {
    if (pathLang()) return false;          // URL already has a locale — URL wins
    var saved = loadPref();
    if (!saved || saved === DEFAULT) return false;
    // Only auto-redirect on pages that have a translated equivalent.
    // Strip query/hash before checking the path.
    var p = window.location.pathname;
    var q = p.indexOf('?'); if (q >= 0) p = p.substring(0, q);
    var h = p.indexOf('#'); if (h >= 0) p = p.substring(0, h);
    if (p.length > 1 && p.charAt(p.length - 1) === '/') p = p.slice(0, -1);
    if (!LOCALIZED_PATHS[p]) return false;
    var target = '/' + saved + p + (window.location.search || '') + (window.location.hash || '');
    window.location.replace(target);
    return true;
  }

  // Rewrite every internal <a href="..."> on the page so that links pointing
  // at a translated page get the current locale prefix. Skips the language
  // dropdown (handled separately), already-prefixed links, and any link
  // whose href isn't in LOCALIZED_PATHS.
  function localizeNavLinks() {
    var lang = pathLang();
    if (!lang) return; // No locale in URL — leave everything alone
    var anchors = document.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      // Skip language dropdown entries — apply() handles those
      if (a.hasAttribute('data-lang')) continue;
      if (a.closest && a.closest('.nav-lang-menu')) continue;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) !== '/') continue;
      // Split off any query string and hash so the path lookup is clean
      var qIdx = href.indexOf('?');
      var hIdx = href.indexOf('#');
      var cut = -1;
      if (qIdx >= 0) cut = qIdx;
      if (hIdx >= 0 && (cut < 0 || hIdx < cut)) cut = hIdx;
      var pathOnly = (cut >= 0) ? href.substring(0, cut) : href;
      var suffix   = (cut >= 0) ? href.substring(cut)    : '';
      // If already locale-prefixed, leave it (idempotent)
      var first = pathOnly.split('/')[1];
      if (SUPPORTED.indexOf(first) !== -1) continue;
      // Only rewrite known-translated paths
      if (!LOCALIZED_PATHS[pathOnly]) continue;
      a.setAttribute('href', '/' + lang + pathOnly + suffix);
    }
  }

  function getText(dict, keyPath) {
    var parts = keyPath.split('.');
    var cur = dict;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function loadDict(lang) {
    return fetch('/i18n/' + lang + '.json?v=' + DICT_VERSION, { cache: 'default' })
      .then(function (r) { if (!r.ok) throw new Error(lang + ' missing'); return r.json(); });
  }

  function apply(dict) {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      var val = getText(dict, key);
      if (val === undefined) continue;
      if (el.hasAttribute('data-i18n-html')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }
    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var n = attrNodes[j];
      var pairs = n.getAttribute('data-i18n-attr').split(',');
      for (var k = 0; k < pairs.length; k++) {
        var bits = pairs[k].trim().split(':');
        if (bits.length !== 2) continue;
        var v = getText(dict, bits[1].trim());
        if (v !== undefined) n.setAttribute(bits[0].trim(), v);
      }
    }

    // Dropdown active state + button label
    var active = getLang();
    var menuLinks = document.querySelectorAll('.nav-lang-menu a[data-lang]');
    for (var m = 0; m < menuLinks.length; m++) {
      var lang = menuLinks[m].getAttribute('data-lang');
      menuLinks[m].classList.toggle('active', lang === active);
      // Point each menu link at the locale-prefixed version of the CURRENT
      // page so right-click / "open in new tab" preserves context.
      menuLinks[m].setAttribute('href', targetForLang(lang));
    }
    var btnLabel = document.querySelector('.nav-lang span');
    if (btnLabel) btnLabel.textContent = active.toUpperCase();
    document.documentElement.lang = active;
    // Reveal the page now that translations are in place. The inline
    // preload in each page's <head> hid the body via visibility:hidden
    // to prevent the English-flash before the dict resolves.
    document.documentElement.classList.remove('bb-i18n-loading');
  }

  // Public API — switch language, keep the user on the same page.
  // Also remembers the choice in localStorage so future visits land in
  // the same language by default.
  window.setBBLang = function (lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    if (lang === getLang()) return;
    savePref(lang);
    window.location.href = targetForLang(lang);
  };

  function init() {
    // Saved-language redirect runs first. If we navigate away, nothing
    // else should fire (the page is about to be replaced).
    if (maybeRedirectToSavedLang()) return;

    var lang = pathLang();
    // If the URL has an explicit locale, treat it as the user's choice and
    // remember it for next time. Doesn't fire for bare paths that fell back
    // to DEFAULT — those weren't explicit.
    if (lang) savePref(lang);

    var active = lang || DEFAULT;
    // Rewrite internal nav links before the dict resolves — purely URL-based,
    // doesn't depend on translation content.
    localizeNavLinks();
    loadDict(active).then(apply).catch(function (err) {
      console.error('[i18n init]', err);
      // Don't leave the page hidden if the dict failed to load — show
      // whatever the page has (English defaults from the HTML).
      document.documentElement.classList.remove('bb-i18n-loading');
    });

    // Intercept dropdown clicks so we route cleanly (history push + reload)
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.nav-lang-menu a[data-lang]');
      if (!a) return;
      e.preventDefault();
      window.setBBLang(a.getAttribute('data-lang'));
      var wrap = document.getElementById('navLangWrap');
      if (wrap) wrap.classList.remove('open');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
