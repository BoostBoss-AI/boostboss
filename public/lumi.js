/**
 * @boostbossai/lumi · JS Snippet for AI app monetization
 *
 * Drop-in browser script that auto-discovers `[data-lumi-slot]` elements,
 * fetches contextually-matched sponsored content from Boost Boss, and
 * renders inside the slot. Same backend as @boostbossai/lumi-mcp; this is
 * the web-surface door of the same ad network.
 *
 * Usage (matches https://boostboss.ai/docs/js-snippet):
 *
 *   <script async
 *     src="https://boostboss.ai/lumi.js"
 *     data-publisher-id="pub_xxx"></script>
 *
 *   <div data-lumi-slot="card"></div>
 *   <div data-lumi-slot="citation" data-lumi-context="checkout flow"></div>
 *
 * Slot types (the five placements the Web door owns):
 *   corner    Corner / sticky anchored unit. Renders fixed to a screen corner.
 *   card      Inline sponsored card. Renders in the slot.
 *   loading   Loading / "thinking"-state ad. Renders in the slot; remove the
 *             slot element when your AI response is ready.
 *   citation  Sponsored source / citation. Compact, inline.
 *   chip      Sponsored suggested-action chip. A tappable pill.
 *   (legacy banner/sidebar/inline/interstitial still resolve — see normalizeFormat)
 *
 * Sandbox: data-publisher-id="pub_test_demo" returns a fixed test creative.
 *
 * Events dispatched on window:
 *   lumi:ready        — SDK booted
 *   lumi:impression   — slot rendered an ad
 *   lumi:click        — user clicked CTA
 *   lumi:close        — user dismissed (corner / card)
 *   lumi:no_fill      — slot stayed empty
 *   lumi:error        — request or parse error; see e.detail.code
 *
 * Every impression / click / dismiss also fires a server-side tracking
 * beacon. Those beacon URLs carry the context fingerprint (ctx=) minted by
 * the auction, so feedback is context-joined end to end.
 *
 * Programmatic API:
 *   Lumi.refresh(selector?)  — re-fetch + re-render. No arg refreshes all.
 *   Lumi.destroy()           — tear down all rendered ads + observers.
 *   Lumi.render(el, opts)    — manual mount for a slot not auto-discovered.
 *   Lumi.trackConversion(o)  — fire a publisher-side conversion event.
 *   Lumi.getLastError()      — last error object or null.
 *   Lumi.setDebug(bool)      — toggle debug logging at runtime.
 *   Lumi.version             — semver string.
 */

(function (window, document) {
  "use strict";

  if (window.Lumi && window.Lumi.__loaded) return;     // idempotent

  // ── Config ─────────────────────────────────────────────────────────
  const VERSION    = "0.2.0";
  const SESSION_ID = "lumi_" + Math.random().toString(36).slice(2, 12) + "_" + Date.now();
  const DEFAULT_API_BASE = "https://boostboss.ai";

  const script = document.currentScript ||
    document.querySelector('script[src*="lumi.js"]');
  let publisherId = script ? script.getAttribute("data-publisher-id") : null;
  let apiBase     = (script && script.getAttribute("data-api-base")) || DEFAULT_API_BASE;
  let debug       = script && script.getAttribute("data-debug") === "true";

  // ── State ──────────────────────────────────────────────────────────
  const slots      = new Map();   // element -> { ad, format, context, mounted, frequency, observed }
  let lastError    = null;
  let cssInjected  = false;
  let observer     = null;
  let initialized  = false;

  // ── Placement taxonomy ─────────────────────────────────────────────
  // The five placements the Web door owns. Legacy slot names from the
  // pre-matrix taxonomy still resolve so existing integrations don't break.
  const CORE_FORMATS   = ["corner", "card", "loading", "citation", "chip"];
  const LEGACY_FORMATS = { banner: "card", sidebar: "card", inline: "citation", interstitial: "corner" };
  const FORMAT_PREF    = { corner: "corner", card: "native", loading: "native", citation: "native", chip: "native" };
  function normalizeFormat(raw) {
    const f = String(raw || "").toLowerCase().trim();
    if (CORE_FORMATS.indexOf(f) >= 0) return f;
    return LEGACY_FORMATS[f] || "card";
  }

  // ── Logging ────────────────────────────────────────────────────────
  function log(msg, ...args) {
    if (debug) console.log("[lumi]", msg, ...args);
  }
  function emitError(code, message, detail) {
    lastError = { code, message, detail: detail || null, ts: Date.now() };
    if (debug) console.warn("[lumi] " + code + ": " + message, detail || "");
    dispatch("error", lastError);
  }

  // ── Events ─────────────────────────────────────────────────────────
  function dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent("lumi:" + name, { detail }));
    } catch (_e) { /* SSR or sandboxed envs */ }
  }

  // ── Inject styles once ─────────────────────────────────────────────
  function injectStyles() {
    if (cssInjected) return;
    cssInjected = true;
    const style = document.createElement("style");
    style.id = "lumi-styles";
    style.textContent = `
.lumi-corner, .lumi-cardbox, .lumi-loading, .lumi-citation, .lumi-chip {
  --_p:   var(--lumi-primary, #FF2D78);
  --_t:   var(--lumi-text, #0F0F1A);
  --_m:   var(--lumi-muted, #6B7280);
  --_bg:  var(--lumi-bg, #FFFFFF);
  --_b:   var(--lumi-border, #E5E7EB);
  --_r:   var(--lumi-radius, 12px);
  --_f:   var(--lumi-font, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif);
  font-family: var(--_f);
  color: var(--_t);
  box-sizing: border-box;
}
.lumi-disclosure {
  display: inline-block; font-size: 11px; font-weight: 600;
  color: var(--_m); letter-spacing: 0.04em; text-transform: uppercase;
}
.lumi-cta {
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--_p); color: #fff; font-weight: 600; font-size: 13px;
  padding: 8px 16px; border-radius: 8px; text-decoration: none; line-height: 1.2;
  transition: filter 0.15s; white-space: nowrap;
}
.lumi-cta:hover { filter: brightness(1.08); }
.lumi-x {
  position: absolute; top: 8px; right: 10px;
  width: 24px; height: 24px; border: none; background: transparent;
  cursor: pointer; font-size: 18px; line-height: 1; color: var(--_m); padding: 0;
}
.lumi-x:hover { color: var(--_t); }

/* ── card — inline sponsored card ── */
.lumi-cardbox {
  position: relative; display: flex; flex-direction: column; gap: 8px;
  padding: 14px 16px; background: var(--_bg);
  border: 1px solid var(--_b); border-left: 3px solid var(--_p);
  border-radius: var(--_r); max-width: 540px;
}
.lumi-cardbox__media { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; }
.lumi-cardbox__title { font-size: 15px; font-weight: 700; line-height: 1.3; margin: 0; }
.lumi-cardbox__sub   { font-size: 13px; color: var(--_m); line-height: 1.45; margin: 0; }
.lumi-cardbox__cta   { align-self: flex-start; }

/* ── corner — sticky anchored unit ── */
.lumi-corner-anchor { position: fixed; bottom: 24px; right: 24px; width: 320px; z-index: 2147483646; }
.lumi-corner {
  position: relative; display: flex; flex-direction: column; gap: 8px;
  padding: 16px; background: var(--_bg);
  border: 1px solid var(--_b); border-radius: var(--_r);
  box-shadow: 0 16px 48px rgba(0,0,0,0.22);
}
.lumi-corner__media { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; }
.lumi-corner__title { font-size: 15px; font-weight: 700; line-height: 1.3; margin: 0; }
.lumi-corner__sub   { font-size: 13px; color: var(--_m); line-height: 1.45; margin: 0; }
.lumi-corner__cta   { align-self: stretch; }

/* ── loading — "thinking"-state ad ── */
.lumi-loading {
  position: relative; overflow: hidden;
  padding: 13px 16px; background: var(--_bg);
  border: 1px solid var(--_b); border-radius: var(--_r); max-width: 540px;
}
.lumi-loading::after {
  content: ''; position: absolute; top: 0; left: -40%; width: 40%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0,0,0,0.045), transparent);
  animation: lumi-shim 1.4s infinite;
}
.lumi-loading__title { font-size: 13px; font-weight: 700; margin: 6px 0 3px; }
.lumi-loading__sub   { font-size: 12px; color: var(--_m); margin: 0 0 8px; }
.lumi-loading__cta   { color: var(--_p); font-weight: 600; text-decoration: none; font-size: 12px; }
.lumi-loading__cta:hover { text-decoration: underline; }
@keyframes lumi-shim { to { left: 120%; } }

/* ── citation — sponsored source ── */
.lumi-citation { font-size: 13px; line-height: 1.5; }
.lumi-citation__title { font-weight: 600; }
.lumi-citation__cta {
  color: var(--_p); font-weight: 600; text-decoration: none; margin-left: 4px;
}
.lumi-citation__cta:hover { text-decoration: underline; }

/* ── chip — suggested-action pill ── */
.lumi-chip {
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--_bg); border: 1px solid var(--_p); border-radius: 999px;
  padding: 7px 14px; margin: 4px 6px 4px 0;
  font-size: 12px; font-weight: 600; color: var(--_t);
  text-decoration: none; cursor: pointer; transition: background 0.15s;
}
.lumi-chip:hover { background: rgba(255,45,120,0.07); }
.lumi-chip__dot  { width: 6px; height: 6px; border-radius: 50%; background: var(--_p); flex-shrink: 0; }
.lumi-chip__tag  { font-size: 9px; color: var(--_m); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }

@media (max-width: 480px) {
  .lumi-corner-anchor { left: 12px; right: 12px; width: auto; }
}
    `;
    document.head.appendChild(style);
  }

  // ── Backend call ───────────────────────────────────────────────────
  async function fetchAd(opts) {
    if (!publisherId) {
      emitError("BBX_NO_PUBLISHER_ID", "data-publisher-id missing on script tag");
      return null;
    }
    const context = (opts.context || "").trim();
    if (!context) {
      emitError("BBX_BAD_REQUEST", "context required for fetchAd");
      return null;
    }
    const format = opts.format || "card";

    const body = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: "get_sponsored_content",
        arguments: {
          context_summary: context,
          format_preference: FORMAT_PREF[format] || "native",
          session_id: SESSION_ID,
          // Snippet uses publisher_id as the public identifier; backend
          // also accepts it under developer_api_key for sandbox prefix
          // detection (api/_lib/sandbox.js). Same value either way.
          developer_api_key: publisherId,
          publisher_id:      publisherId,
          user_language:     navigator.language ? navigator.language.split("-")[0] : "en",
          host_app:          "web",
          surface:           "web-" + format,
        },
      },
    };

    let resp;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      resp = await fetch(apiBase.replace(/\/$/, "") + "/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Lumi-Source": "js-snippet",
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
    } catch (e) {
      emitError(e.name === "AbortError" ? "BBX_TIMEOUT" : "BBX_NETWORK",
        e.message || "network error", { name: e.name });
      return null;
    }

    if (!resp.ok) {
      emitError("BBX_HTTP_" + resp.status, "backend returned HTTP " + resp.status);
      return null;
    }

    let json;
    try { json = await resp.json(); } catch (_e) {
      emitError("BBX_BAD_RESPONSE", "invalid JSON in response");
      return null;
    }

    const txt = json && json.result && json.result.content && json.result.content[0] && json.result.content[0].text;
    if (!txt) {
      emitError("BBX_BAD_RESPONSE", "empty result content");
      return null;
    }
    let payload;
    try { payload = JSON.parse(txt); } catch (_e) {
      emitError("BBX_BAD_RESPONSE", "result text not JSON");
      return null;
    }

    if (!payload.sponsored) {
      dispatch("no_fill", { context, reason: payload.reason || null });
      return null;
    }

    return {
      adId:         payload.sponsored.campaign_id,
      auctionId:    payload.auction && payload.auction.auction_id,
      type:         payload.sponsored.type || "native",
      headline:     payload.sponsored.headline || "",
      subtext:      payload.sponsored.subtext || "",
      mediaUrl:     payload.sponsored.media_url || null,
      ctaLabel:     payload.sponsored.cta_label || "Learn more",
      ctaUrl:       payload.sponsored.cta_url || "#",
      disclosure:   payload.sponsored.disclosure_label || "Sponsored",
      tracking:     payload.sponsored.tracking || {},
      isSandbox:    !!(payload.auction && payload.auction.sandbox),
    };
  }

  // ── Beacons ────────────────────────────────────────────────────────
  // Fire a server-side tracking beacon. The URL is minted by the auction
  // and already carries auction_id + the context fingerprint (ctx=), so
  // every impression / click / dismiss is context-joined. Image() is used
  // so cross-origin GET beacons don't trip CORS.
  function beacon(url) {
    if (!url) return;
    try {
      const img = new Image(1, 1);
      img.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;";
      img.src = url;
    } catch (_e) { /* ignore */ }
  }

  // ── Slot context derivation ────────────────────────────────────────
  function deriveContext(el) {
    const explicit = el.getAttribute("data-lumi-context");
    if (explicit && explicit.trim()) return explicit.trim();
    const h1 = document.querySelector("h1");
    const title = (h1 && h1.textContent && h1.textContent.trim()) ||
                  document.title ||
                  location.pathname;
    return String(title).slice(0, 280);
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function makeDisclosure(ad) {
    const span = document.createElement("span");
    span.className = "lumi-disclosure";
    span.textContent = ad.disclosure;
    return span;
  }

  function closeButton(onClick) {
    const b = document.createElement("button");
    b.className = "lumi-x";
    b.setAttribute("aria-label", "Dismiss");
    b.textContent = "×";
    b.addEventListener("click", onClick);
    return b;
  }

  function buildCta(ad, slotEl, cls) {
    const a = document.createElement("a");
    a.className = "lumi-cta" + (cls ? " " + cls : "");
    a.href = ad.ctaUrl;
    a.target = "_blank";
    a.rel = "noopener sponsored";
    a.textContent = ad.ctaLabel;
    a.addEventListener("click", function () {
      // Server-side click feedback — context-joined via the ctx= in the URL.
      beacon(ad.tracking && ad.tracking.click);
      dispatch("click", { adId: ad.adId, auctionId: ad.auctionId, slot: slotEl });
    });
    return a;
  }

  function addMedia(parent, ad, cls) {
    if (!ad.mediaUrl) return;
    const img = document.createElement("img");
    img.className = cls;
    img.src = ad.mediaUrl;
    img.alt = "";
    img.onerror = function () { img.remove(); };
    parent.appendChild(img);
  }

  // card — inline sponsored card with a dismiss control.
  function renderCard(el, ad) {
    el.classList.add("lumi-cardbox");
    el.innerHTML = "";
    el.appendChild(closeButton(function () {
      beacon(ad.tracking && ad.tracking.dismiss);
      dispatch("close", { adId: ad.adId, auctionId: ad.auctionId });
      el.innerHTML = ""; el.style.display = "none";
    }));
    el.appendChild(makeDisclosure(ad));
    addMedia(el, ad, "lumi-cardbox__media");
    const h = document.createElement("p");
    h.className = "lumi-cardbox__title";
    h.textContent = ad.headline;
    el.appendChild(h);
    if (ad.subtext) {
      const s = document.createElement("p");
      s.className = "lumi-cardbox__sub";
      s.textContent = ad.subtext;
      el.appendChild(s);
    }
    el.appendChild(buildCta(ad, el, "lumi-cardbox__cta"));
  }

  // corner — sticky anchored unit. Mounts a fixed-position element to the
  // body; the slot div itself becomes a hidden cleanup anchor.
  function renderCorner(el, ad) {
    el.style.display = "none";
    const anchor = document.createElement("div");
    anchor.className = "lumi-corner-anchor";
    const card = document.createElement("div");
    card.className = "lumi-corner";
    card.appendChild(closeButton(function () {
      beacon(ad.tracking && ad.tracking.close);
      dispatch("close", { adId: ad.adId, auctionId: ad.auctionId });
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    }));
    card.appendChild(makeDisclosure(ad));
    addMedia(card, ad, "lumi-corner__media");
    const h = document.createElement("p");
    h.className = "lumi-corner__title";
    h.textContent = ad.headline;
    card.appendChild(h);
    if (ad.subtext) {
      const s = document.createElement("p");
      s.className = "lumi-corner__sub";
      s.textContent = ad.subtext;
      card.appendChild(s);
    }
    card.appendChild(buildCta(ad, el, "lumi-corner__cta"));
    anchor.appendChild(card);
    document.body.appendChild(anchor);
    // Track the anchor so destroy()/unmountSlot can remove it.
    const slot = slots.get(el);
    if (slot) slot.backdrop = anchor;
  }

  // loading — "thinking"-state ad. Shown while the AI generates; the
  // publisher removes the slot element when the response is ready.
  function renderLoading(el, ad) {
    el.classList.add("lumi-loading");
    el.innerHTML = "";
    el.appendChild(makeDisclosure(ad));
    const h = document.createElement("div");
    h.className = "lumi-loading__title";
    h.textContent = ad.headline;
    el.appendChild(h);
    if (ad.subtext) {
      const s = document.createElement("div");
      s.className = "lumi-loading__sub";
      s.textContent = ad.subtext;
      el.appendChild(s);
    }
    const a = buildCta(ad, el, "lumi-loading__cta");
    a.textContent = ad.ctaLabel + " →";
    el.appendChild(a);
  }

  // citation — compact sponsored source, sits inline in an answer.
  function renderCitation(el, ad) {
    el.classList.add("lumi-citation");
    el.innerHTML = "";
    el.appendChild(makeDisclosure(ad));
    el.appendChild(document.createTextNode(" "));
    const t = document.createElement("span");
    t.className = "lumi-citation__title";
    t.textContent = ad.headline;
    el.appendChild(t);
    el.appendChild(document.createTextNode(" "));
    const a = buildCta(ad, el, "lumi-citation__cta");
    a.textContent = ad.ctaLabel + " ↗";
    el.appendChild(a);
  }

  // chip — suggested-action pill. The whole pill is the click target.
  function renderChip(el, ad) {
    el.innerHTML = "";
    const chip = document.createElement("a");
    chip.className = "lumi-chip";
    chip.href = ad.ctaUrl;
    chip.target = "_blank";
    chip.rel = "noopener sponsored";
    const dot = document.createElement("span");
    dot.className = "lumi-chip__dot";
    const label = document.createElement("span");
    label.textContent = ad.ctaLabel || ad.headline;
    const tag = document.createElement("span");
    tag.className = "lumi-chip__tag";
    tag.textContent = "Ad";
    chip.appendChild(dot);
    chip.appendChild(label);
    chip.appendChild(tag);
    chip.addEventListener("click", function () {
      beacon(ad.tracking && ad.tracking.click);
      dispatch("click", { adId: ad.adId, auctionId: ad.auctionId, slot: el });
    });
    el.appendChild(chip);
  }

  function renderAdIntoSlot(el, ad) {
    const format = normalizeFormat(el.getAttribute("data-lumi-slot"));
    injectStyles();
    if (format === "corner")        renderCorner(el, ad);
    else if (format === "loading")  renderLoading(el, ad);
    else if (format === "citation") renderCitation(el, ad);
    else if (format === "chip")     renderChip(el, ad);
    else                            renderCard(el, ad);   // card is the default

    beacon(ad.tracking && ad.tracking.impression);
    dispatch("impression", {
      adId: ad.adId, auctionId: ad.auctionId,
      slot: el, format, sandbox: ad.isSandbox,
    });
  }

  // ── Slot lifecycle ─────────────────────────────────────────────────
  async function mountSlot(el) {
    if (slots.has(el) && slots.get(el).mounted) return;   // already done

    const format    = normalizeFormat(el.getAttribute("data-lumi-slot"));
    const context   = deriveContext(el);
    const frequency = (el.getAttribute("data-lumi-frequency") || "session").toLowerCase();
    const fallback  = el.getAttribute("data-lumi-fallback");

    slots.set(el, { mounted: false, format, context, frequency, fallback, backdrop: null });

    log("mounting slot", { format, context });

    const ad = await fetchAd({ context, format });
    if (!ad) {
      // Show fallback if any
      if (fallback) {
        const fEl = document.querySelector(fallback);
        if (fEl) {
          const clone = fEl.cloneNode(true);
          clone.style.display = "";
          el.innerHTML = "";
          el.appendChild(clone);
        }
      }
      const slot = slots.get(el);
      if (slot) slot.mounted = true;
      return;
    }

    renderAdIntoSlot(el, ad);
    const slot = slots.get(el);
    if (slot) { slot.ad = ad; slot.mounted = true; }
  }

  function unmountSlot(el) {
    const slot = slots.get(el);
    if (!slot) return;
    if (slot.backdrop && slot.backdrop.parentNode) slot.backdrop.parentNode.removeChild(slot.backdrop);
    el.innerHTML = "";
    el.classList.remove("lumi-cardbox", "lumi-loading", "lumi-citation");
    el.style.display = "";
    slots.delete(el);
  }

  function discoverSlots() {
    const found = document.querySelectorAll("[data-lumi-slot]");
    for (let i = 0; i < found.length; i++) {
      const el = found[i];
      if (!slots.has(el)) mountSlot(el);
    }
  }

  // ── MutationObserver for SPAs ──────────────────────────────────────
  function startObserver() {
    if (observer || typeof MutationObserver === "undefined") return;
    observer = new MutationObserver(function (mutations) {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type !== "childList") continue;
        // Newly-added slots
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches("[data-lumi-slot]")) mountSlot(node);
          if (node.querySelectorAll) {
            const inner = node.querySelectorAll("[data-lumi-slot]");
            for (let j = 0; j < inner.length; j++) mountSlot(inner[j]);
          }
        });
        // Removed slots — clean up state to avoid leaks
        m.removedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (slots.has(node)) unmountSlot(node);
          if (node.querySelectorAll) {
            const inner = node.querySelectorAll("[data-lumi-slot]");
            for (let j = 0; j < inner.length; j++) {
              if (slots.has(inner[j])) unmountSlot(inner[j]);
            }
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  // ── Public API ─────────────────────────────────────────────────────
  const Lumi = {
    version:    VERSION,
    __loaded:   true,

    /** Re-fetch + re-render. Pass a CSS selector or element to scope; omit to refresh all. */
    refresh: function (selector) {
      if (!selector) {
        slots.forEach(function (_meta, el) {
          unmountSlot(el);
          mountSlot(el);
        });
        return;
      }
      let els;
      if (typeof selector === "string") els = document.querySelectorAll(selector);
      else if (selector instanceof Element) els = [selector];
      else els = [];
      for (let i = 0; i < els.length; i++) {
        if (slots.has(els[i])) unmountSlot(els[i]);
        mountSlot(els[i]);
      }
    },

    /** Tear down all rendered ads, observers, and event listeners. */
    destroy: function () {
      stopObserver();
      slots.forEach(function (_m, el) { unmountSlot(el); });
      slots.clear();
      const sty = document.getElementById("lumi-styles");
      if (sty) sty.remove();
      cssInjected = false;
      initialized = false;
    },

    /** Mount a slot manually (use when slot is added in a way the observer misses). */
    render: function (target, opts) {
      let el = null;
      if (typeof target === "string") el = document.querySelector(target);
      else if (target instanceof Element) el = target;
      if (!el) { emitError("BBX_BAD_TARGET", "render() target not found: " + target); return; }
      if (opts && opts.format) el.setAttribute("data-lumi-slot", opts.format);
      if (opts && opts.context) el.setAttribute("data-lumi-context", opts.context);
      if (slots.has(el)) unmountSlot(el);
      mountSlot(el);
    },

    /**
     * Fire a conversion event tied to an ad served in this session.
     *
     * Phase B (2026-05-11) — adds publisher-side conversion firing for
     * in-app conversions (signup/purchase happens on the same page that
     * hosted the ad). For conventional advertiser-side conversions on a
     * separate thank-you page, advertisers should still use pixel.js with
     * the bbx_auc query param (see public/pixel.js).
     *
     * @param {Object} opts
     * @param {string} opts.type         conversion type, e.g. "signup", "purchase"
     * @param {string} [opts.adId]       campaign_id of the ad that converted (required if no slot match)
     * @param {string} [opts.auctionId]  auction_id of the originating ad (recommended for attribution)
     * @param {string|Element} [opts.slot] alternative — provide the slot we rendered into
     * @param {number} [opts.value]      conversion value in USD (e.g. 29.99)
     * @param {string} [opts.currency]   ISO 4217 currency; default USD
     * @param {string} [opts.externalId] advertiser's user/order id for reconciliation
     */
    trackConversion: function (opts) {
      opts = opts || {};
      if (!opts.type || typeof opts.type !== "string") {
        emitError("BBX_BAD_REQUEST", "trackConversion: 'type' is required (e.g. 'signup')");
        return;
      }

      // Resolve adId + auctionId from the slot reference if needed.
      var adId      = opts.adId      || null;
      var auctionId = opts.auctionId || null;
      if (!adId || !auctionId) {
        var slotEl = null;
        if (opts.slot) {
          slotEl = (typeof opts.slot === "string")
            ? document.querySelector(opts.slot)
            : opts.slot;
        }
        if (slotEl && slots.has(slotEl)) {
          var s = slots.get(slotEl);
          if (s && s.ad) {
            adId      = adId      || s.ad.adId;
            auctionId = auctionId || s.ad.auctionId;
          }
        } else {
          // Best-effort: walk every mounted slot and take the first
          // one's ad context. Useful for "one ad per page" sites that
          // don't bother passing slot references.
          slots.forEach(function (m) {
            if ((!adId || !auctionId) && m && m.ad) {
              adId      = adId      || m.ad.adId;
              auctionId = auctionId || m.ad.auctionId;
            }
          });
        }
      }

      if (!adId) {
        emitError("BBX_BAD_REQUEST",
          "trackConversion: cannot determine adId — pass opts.adId, opts.slot, or call after an ad has rendered");
        return;
      }

      var body = {
        event:           "conversion",
        campaign_id:     adId,
        auction_id:      auctionId,
        conversion_type: opts.type,
        value:           (opts.value != null) ? Number(opts.value) : null,
        currency:        opts.currency || "USD",
        external_id:     opts.externalId || null,
        session_id:      SESSION_ID,
      };

      try {
        fetch(apiBase.replace(/\/$/, "") + "/api/track", {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            "X-Lumi-Source": "js-snippet",
          },
          body: JSON.stringify(body),
        }).then(function (r) {
          if (!r.ok) {
            emitError("BBX_HTTP_" + r.status, "conversion beacon rejected: HTTP " + r.status);
          } else {
            dispatch("conversion", {
              adId: adId, auctionId: auctionId,
              type: opts.type, value: body.value, currency: body.currency,
            });
          }
        }).catch(function (e) {
          emitError("BBX_NETWORK", "conversion beacon failed: " + (e && e.message));
        });
      } catch (e) {
        emitError("BBX_NETWORK", "conversion beacon threw: " + (e && e.message));
      }
    },

    /** Last error object or null. */
    getLastError: function () { return lastError; },

    /** Toggle debug logging at runtime. */
    setDebug: function (on) { debug = !!on; },

    /** Internal: read current state — useful for tests. */
    _state: function () {
      return { publisherId, apiBase, sessionId: SESSION_ID, slotCount: slots.size };
    },
  };

  window.Lumi = Lumi;

  // ── Boot ───────────────────────────────────────────────────────────
  function init() {
    if (initialized) return;
    initialized = true;
    if (!publisherId) {
      emitError("BBX_NO_PUBLISHER_ID",
        "lumi.js loaded but no data-publisher-id found. Add it to your <script> tag.");
      return;
    }
    log("boot", { publisherId, apiBase, sessionId: SESSION_ID });
    discoverSlots();
    startObserver();
    dispatch("ready", { version: VERSION, sessionId: SESSION_ID });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
