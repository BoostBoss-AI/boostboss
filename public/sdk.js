/**
 * Boost Boss — Lumi Web SDK (Door 2: JS Snippet)
 * https://boostboss.ai
 *
 * A DOM render engine with a five-placement registry. Drop it into any
 * web-based AI app to serve contextual, on-thesis ads.
 *
 *   <script src="https://boostboss.ai/sdk.js" data-api-key="bb_dev_xxx"></script>
 *
 * Or initialise manually:
 *   BoostBoss.init({ apiKey: "bb_dev_xxx" });
 *   BoostBoss.requestAd({
 *     context:   "user is comparing CRM tools for a small sales team",
 *     placement: "card",
 *     mount:     "#bb-slot",
 *   });
 *
 * ── Placements (the five the Web door owns) ──────────────────────────────
 *   corner    Corner / sticky anchored unit. Self-mounts. Interruptive.
 *   card      Inline sponsored card. Mounts into a container you provide.
 *   loading   Loading / "thinking"-state ad. Mounts into a container;
 *             call clearLoading() (or the returned teardown) when your AI
 *             response is ready.
 *   citation  Sponsored source / citation. Compact, sits inside an answer.
 *   chip      Sponsored suggested-action chip. A tappable quick-reply pill.
 *
 * Every placement carries the request `context` to the auction and logs
 * feedback (impression / click / skip / close / dismiss) — the tracking
 * URLs already carry the context fingerprint, so feedback is context-joined
 * end to end. See db/19_context_fingerprints.sql.
 */
(function (window, document) {
  "use strict";

  var VERSION = "1.1.0";
  var API_BASE = "https://boostboss.ai/api";
  var SESSION_ID = "bb_" + Math.random().toString(36).substr(2, 12) + "_" + Date.now();

  // The five placements the Web door owns. `interruptive` placements honour
  // minIntervalMs; the rest (inline / citation / chip / loading) do not,
  // since they don't take over the screen.
  var REGISTRY = {
    corner:   { format: "corner", interruptive: true,  selfMount: true  },
    card:     { format: "native", interruptive: false, selfMount: false },
    loading:  { format: "native", interruptive: false, selfMount: false },
    citation: { format: "native", interruptive: false, selfMount: false },
    chip:     { format: "native", interruptive: false, selfMount: false },
  };

  var config = {
    apiKey: null,
    theme: "dark",                 // "dark" | "light"
    accent: "#FF2D78",             // CTA / brand accent colour
    position: "bottom-right",      // corner anchor
    payToRemovePrice: "$4.99/mo",  // corner only; null to hide
    maxAdsPerSession: 10,
    minIntervalMs: 180000,         // 3 min between interruptive ads
    onImpression: null,
    onClick: null,
    onClose: null,
    onError: null,
    debug: false,
  };

  var state = {
    initialized: false,
    adsShown: 0,
    lastInterruptiveAt: 0,
    currentCornerAd: null,
    skipTimer: null,
    progressTimer: null,
    mounts: {},   // placement -> { el, ad, teardown }
  };

  // ── Error & debug ──────────────────────────────────────────────────────
  var lastError = null;
  function sdkError(code, message, detail) {
    lastError = { code: code, message: message, detail: detail || null, ts: Date.now() };
    if (config.debug) console.warn("[BoostBoss] " + code + ": " + message, detail || "");
    if (typeof config.onError === "function") {
      try { config.onError(lastError); } catch (_e) {}
    }
    return null;
  }

  // ── Utilities ──────────────────────────────────────────────────────────
  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Fire a tracking beacon. The URL already carries auction_id + the
  // context fingerprint (ctx=), so every event is context-joined.
  function track(url) {
    if (!url) return;
    try { var img = new Image(); img.src = url; } catch (_e) {}
  }

  // Fire a feedback event for an ad + invoke the matching callback.
  function feedback(ad, type) {
    if (!ad) return;
    track(ad.tracking && ad.tracking[type]);
    if (type === "impression" && config.onImpression) {
      try { config.onImpression(ad); } catch (_e) {}
    } else if (type === "click" && config.onClick) {
      try { config.onClick(ad); } catch (_e) {}
    } else if ((type === "close" || type === "skip" || type === "dismiss") && config.onClose) {
      try { config.onClose(ad, type); } catch (_e) {}
    }
  }

  function resolveMount(mount) {
    if (!mount) return null;
    if (typeof mount === "string") return document.querySelector(mount);
    if (mount.nodeType === 1) return mount;
    return null;
  }

  function clearTimers() {
    if (state.skipTimer)     { clearInterval(state.skipTimer);     state.skipTimer = null; }
    if (state.progressTimer) { clearInterval(state.progressTimer); state.progressTimer = null; }
  }

  // ── Styles ─────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("bb-sdk-styles")) return;
    var style = document.createElement("style");
    style.id = "bb-sdk-styles";
    style.textContent = [
      // Theme tokens — overridable per render via the .bb-light modifier.
      ".bb-root{--bb-bg:#111;--bb-fg:#fff;--bb-muted:#8a8a8a;--bb-border:#242424;--bb-sub:#0a0a0a;--bb-accent:#FF2D78;",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-sizing:border-box}",
      ".bb-root.bb-light{--bb-bg:#fff;--bb-fg:#111;--bb-muted:#666;--bb-border:#e6e6e6;--bb-sub:#fafafa}",
      ".bb-root *,.bb-root *::before,.bb-root *::after{box-sizing:border-box}",
      // Sponsored label
      ".bb-lbl{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--bb-muted);",
      "text-transform:uppercase;letter-spacing:.08em;font-weight:700}",
      ".bb-badge{width:14px;height:14px;border-radius:3px;background:var(--bb-accent);color:#fff;",
      "display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:900}",
      // ── Corner / fullscreen popup ──
      "#bb-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99998;animation:bb-fi .25s ease}",
      "#bb-popup{display:none;position:fixed;z-index:99999;animation:bb-si .35s cubic-bezier(.34,1.56,.64,1)}",
      "#bb-popup.corner.bottom-right{bottom:24px;right:24px;width:320px}",
      "#bb-popup.corner.bottom-left{bottom:24px;left:24px;width:320px}",
      "#bb-popup.corner.top-right{top:24px;right:24px;width:320px}",
      "#bb-popup.corner.top-left{top:24px;left:24px;width:320px}",
      "#bb-popup.fullscreen{top:50%;left:50%;transform:translate(-50%,-50%);width:min(540px,94vw)}",
      ".bb-c{background:var(--bb-bg);border:1px solid var(--bb-border);border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.55)}",
      ".bb-ch{padding:8px 12px;display:flex;align-items:center;justify-content:space-between;background:var(--bb-sub);border-bottom:1px solid var(--bb-border)}",
      ".bb-sr{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;",
      "border:2px solid var(--bb-border);font-size:11px;color:var(--bb-muted);font-weight:700;transition:all .3s;cursor:default;user-select:none}",
      ".bb-sr.ready{border-color:var(--bb-accent);color:var(--bb-accent);cursor:pointer;background:rgba(255,45,120,.1)}",
      ".bb-mw{position:relative;width:100%;aspect-ratio:16/9;background:#000;overflow:hidden}",
      ".bb-mw img,.bb-mw video{width:100%;height:100%;object-fit:cover;display:block}",
      ".bb-vo{display:none;position:absolute;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,.35);cursor:pointer}",
      ".bb-pb{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;font-size:22px}",
      ".bb-mb{position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.65);border:none;border-radius:6px;color:#fff;font-size:12px;padding:5px 10px;cursor:pointer;z-index:2}",
      ".bb-pr{position:absolute;bottom:0;left:0;height:3px;background:var(--bb-accent);width:0%;transition:width .15s linear;z-index:3}",
      ".bb-bd{padding:14px 16px 16px}",
      ".bb-hl{font-size:15px;font-weight:700;color:var(--bb-fg);line-height:1.3;margin-bottom:4px}",
      ".bb-st{font-size:12px;color:var(--bb-muted);margin-bottom:12px}",
      ".bb-ct{display:block;background:var(--bb-accent);color:#fff;text-decoration:none;text-align:center;",
      "padding:10px;border-radius:8px;font-size:13px;font-weight:700;transition:opacity .2s}",
      ".bb-ct:hover{opacity:.9}",
      ".bb-pc{display:block;text-align:center;margin-top:8px;font-size:11px;color:var(--bb-muted);cursor:pointer}",
      ".bb-pc:hover{color:var(--bb-accent)}",
      // ── Inline sponsored card ──
      ".bb-card{position:relative;background:var(--bb-bg);border:1px solid var(--bb-border);border-left:3px solid var(--bb-accent);",
      "border-radius:12px;padding:14px 16px;margin:8px 0;max-width:520px}",
      ".bb-card .bb-card-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;margin:8px 0;display:block}",
      ".bb-card .bb-card-hl{font-size:14px;font-weight:700;color:var(--bb-fg);margin:8px 0 4px;line-height:1.35}",
      ".bb-card .bb-card-bd{font-size:12px;color:var(--bb-muted);line-height:1.5;margin-bottom:10px}",
      ".bb-card .bb-card-ct{display:inline-block;background:var(--bb-accent);color:#fff;text-decoration:none;",
      "padding:7px 16px;border-radius:6px;font-size:12px;font-weight:700}",
      ".bb-x{position:absolute;top:8px;right:10px;width:18px;height:18px;border:none;background:transparent;",
      "color:var(--bb-muted);font-size:14px;line-height:1;cursor:pointer;padding:0}",
      ".bb-x:hover{color:var(--bb-fg)}",
      // ── Loading-state ad ──
      ".bb-loading{position:relative;background:var(--bb-sub);border:1px solid var(--bb-border);border-radius:12px;",
      "padding:13px 16px;margin:8px 0;max-width:520px;overflow:hidden}",
      ".bb-loading::after{content:'';position:absolute;top:0;left:-40%;width:40%;height:100%;",
      "background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);animation:bb-shim 1.4s infinite}",
      ".bb-light .bb-loading::after{background:linear-gradient(90deg,transparent,rgba(0,0,0,.04),transparent)}",
      ".bb-loading .bb-load-hl{font-size:13px;font-weight:700;color:var(--bb-fg);margin:7px 0 3px}",
      ".bb-loading .bb-load-bd{font-size:11px;color:var(--bb-muted);margin-bottom:9px}",
      ".bb-loading .bb-load-ct{font-size:11px;font-weight:700;color:var(--bb-accent);text-decoration:none}",
      // ── Sponsored citation ──
      ".bb-cite{display:inline-flex;align-items:baseline;gap:5px;font-size:12px;line-height:1.4;",
      "max-width:100%;vertical-align:baseline}",
      ".bb-cite .bb-cite-tag{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;",
      "color:#fff;background:var(--bb-accent);border-radius:3px;padding:1px 4px;flex:0 0 auto}",
      ".bb-cite a{color:var(--bb-accent);text-decoration:none;font-weight:600}",
      ".bb-cite a:hover{text-decoration:underline}",
      // ── Suggested-action chip ──
      ".bb-chip{display:inline-flex;align-items:center;gap:7px;background:var(--bb-bg);",
      "border:1px solid var(--bb-accent);border-radius:999px;padding:7px 14px;margin:4px 6px 4px 0;",
      "font-size:12px;font-weight:600;color:var(--bb-fg);cursor:pointer;transition:background .15s}",
      ".bb-chip:hover{background:rgba(255,45,120,.08)}",
      ".bb-chip .bb-chip-dot{width:6px;height:6px;border-radius:50%;background:var(--bb-accent);flex:0 0 auto}",
      ".bb-chip .bb-chip-tag{font-size:9px;color:var(--bb-muted);text-transform:uppercase;letter-spacing:.05em;font-weight:700}",
      "@keyframes bb-si{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}",
      "@keyframes bb-fi{from{opacity:0}to{opacity:1}}",
      "@keyframes bb-shim{to{left:120%}}",
    ].join("");
    document.head.appendChild(style);
  }

  // Apply theme class to a freshly built root element.
  function themed(el) {
    el.classList.add("bb-root");
    if (config.theme === "light") el.classList.add("bb-light");
    if (config.accent) el.style.setProperty("--bb-accent", config.accent);
    return el;
  }

  // ════════════════════════════════════════════════════════════════════════
  // PLACEMENT RENDERERS — one per registry entry. Each returns a teardown fn.
  // ════════════════════════════════════════════════════════════════════════

  // ── corner / fullscreen popup ──────────────────────────────────────────
  function injectCornerDOM() {
    if (document.getElementById("bb-popup")) return;
    var backdrop = themed(document.createElement("div"));
    backdrop.id = "bb-backdrop";
    backdrop.onclick = function () { BoostBoss.close(); };
    document.body.appendChild(backdrop);

    var popup = themed(document.createElement("div"));
    popup.id = "bb-popup";
    popup.innerHTML =
      '<div class="bb-c">' +
        '<div class="bb-ch">' +
          '<span class="bb-lbl"><span class="bb-badge">B</span>Sponsored &middot; Boost Boss</span>' +
          '<div class="bb-sr" id="bb-skip">5</div>' +
        '</div>' +
        '<div class="bb-mw">' +
          '<img id="bb-img" src="" alt="Ad" style="display:none"/>' +
          '<video id="bb-video" playsinline muted style="display:none"></video>' +
          '<div class="bb-vo" id="bb-vo"><div class="bb-pb" id="bb-pi">&#9654;</div></div>' +
          '<button class="bb-mb" id="bb-mb" style="display:none">Unmute</button>' +
          '<div class="bb-pr" id="bb-pr"></div>' +
        '</div>' +
        '<div class="bb-bd">' +
          '<div class="bb-hl" id="bb-hl"></div>' +
          '<div class="bb-st" id="bb-st"></div>' +
          '<a class="bb-ct" id="bb-ct" href="#" target="_blank" rel="noopener"></a>' +
          '<div class="bb-pc" id="bb-pc"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(popup);
    document.getElementById("bb-vo").onclick = function () { BoostBoss.togglePlay(); };
    document.getElementById("bb-mb").onclick = function () { BoostBoss.toggleMute(); };
  }

  function startSkip(el, sec, ad) {
    el.className = "bb-sr";
    el.textContent = sec;
    el.onclick = null;
    var rem = sec;
    state.skipTimer = setInterval(function () {
      rem--;
      if (rem <= 0) {
        clearInterval(state.skipTimer);
        state.skipTimer = null;
        el.textContent = "✕";
        el.className = "bb-sr ready";
        el.onclick = function () { feedback(ad, "skip"); BoostBoss.close(true); };
      } else {
        el.textContent = rem;
      }
    }, 1000);
  }

  function startProgress(video, bar) {
    state.progressTimer = setInterval(function () {
      if (video.duration) bar.style.width = (video.currentTime / video.duration * 100) + "%";
    }, 200);
  }

  function renderCorner(ad, opts) {
    injectCornerDOM();
    var popup    = document.getElementById("bb-popup");
    var backdrop = document.getElementById("bb-backdrop");
    var skip     = document.getElementById("bb-skip");
    var img      = document.getElementById("bb-img");
    var video    = document.getElementById("bb-video");
    var overlay  = document.getElementById("bb-vo");
    var muteBtn  = document.getElementById("bb-mb");
    var progress = document.getElementById("bb-pr");

    video.pause();
    video.removeAttribute("src");
    clearTimers();
    progress.style.width = "0%";
    state.currentCornerAd = ad;

    document.getElementById("bb-hl").textContent = ad.headline || "";
    document.getElementById("bb-st").textContent = ad.subtext || "";
    var cta = document.getElementById("bb-ct");
    cta.textContent = ad.cta_label || "Learn more";
    cta.href = ad.cta_url || "#";
    cta.onclick = function () { feedback(ad, "click"); };

    var pc = document.getElementById("bb-pc");
    if (config.payToRemovePrice) {
      pc.textContent = "Remove ads · " + config.payToRemovePrice;
      pc.style.display = "block";
    } else {
      pc.style.display = "none";
    }

    var fullscreen = opts.format === "fullscreen";
    popup.className = "bb-root" + (config.theme === "light" ? " bb-light" : "") +
      (fullscreen ? " fullscreen" : " corner " + (config.position || "bottom-right"));
    backdrop.style.display = fullscreen ? "block" : "none";
    if (config.accent) popup.style.setProperty("--bb-accent", config.accent);

    if (ad.type === "video") {
      img.style.display = "none";
      video.style.display = "block";
      video.poster = ad.poster_url || "";
      video.muted = true;
      video.src = ad.media_url || "";
      muteBtn.style.display = "block";
      muteBtn.textContent = "Unmute";
      overlay.style.display = "flex";
      document.getElementById("bb-pi").textContent = "⏳";
      video.load();
      video.oncanplay = function () {
        document.getElementById("bb-pi").textContent = "▶";
        video.play().then(function () {
          overlay.style.display = "none";
          startProgress(video, progress);
        }).catch(function () { overlay.style.display = "flex"; });
        video.oncanplay = null;
      };
      video.onerror = function () {
        if (config.debug) console.warn("[BoostBoss] video failed:", ad.media_url);
        if (ad.poster_url) {
          video.style.display = "none";
          overlay.style.display = "none";
          muteBtn.style.display = "none";
          img.src = ad.poster_url;
          img.style.display = "block";
        } else {
          BoostBoss.close();
          return;
        }
        skip.textContent = "✕";
        skip.className = "bb-sr ready";
        skip.onclick = function () { feedback(ad, "skip"); BoostBoss.close(true); };
      };
      video.onended = function () {
        progress.style.width = "100%";
        clearTimers();
        skip.textContent = "✕";
        skip.className = "bb-sr ready";
        skip.onclick = function () { BoostBoss.close(true); };
        feedback(ad, "video_complete");
      };
      startSkip(skip, ad.skippable_after_sec || 5, ad);
    } else {
      img.src = ad.media_url || "";
      img.style.display = ad.media_url ? "block" : "none";
      video.style.display = "none";
      overlay.style.display = "none";
      muteBtn.style.display = "none";
      startSkip(skip, ad.skippable_after_sec || 3, ad);
    }

    popup.style.display = "block";
    state.lastInterruptiveAt = Date.now();
    feedback(ad, "impression");
    return function teardown() { BoostBoss.close(true); };
  }

  // ── inline sponsored card ──────────────────────────────────────────────
  function renderCard(ad, mountEl) {
    var card = themed(document.createElement("div"));
    card.className += " bb-card";
    var media = ad.media_url
      ? '<img class="bb-card-img" src="' + esc(ad.media_url) + '" alt="" />' : "";
    card.innerHTML =
      '<button class="bb-x" aria-label="Dismiss">✕</button>' +
      '<div class="bb-lbl"><span class="bb-badge">B</span>Sponsored &middot; Boost Boss</div>' +
      media +
      '<div class="bb-card-hl">' + esc(ad.headline) + '</div>' +
      (ad.subtext ? '<div class="bb-card-bd">' + esc(ad.subtext) + '</div>' : "") +
      '<a class="bb-card-ct" href="' + esc(ad.cta_url) + '" target="_blank" rel="noopener">' +
        esc(ad.cta_label || "Learn more") + '</a>';
    card.querySelector(".bb-card-ct").addEventListener("click", function () {
      feedback(ad, "click");
    });
    card.querySelector(".bb-x").addEventListener("click", function () {
      feedback(ad, "dismiss");
      if (card.parentNode) card.parentNode.removeChild(card);
    });
    mountEl.appendChild(card);
    feedback(ad, "impression");
    return function teardown() { if (card.parentNode) card.parentNode.removeChild(card); };
  }

  // ── loading / "thinking"-state ad ──────────────────────────────────────
  function renderLoading(ad, mountEl) {
    var box = themed(document.createElement("div"));
    box.className += " bb-loading";
    box.innerHTML =
      '<div class="bb-lbl"><span class="bb-badge">B</span>Sponsored &middot; while you wait</div>' +
      '<div class="bb-load-hl">' + esc(ad.headline) + '</div>' +
      (ad.subtext ? '<div class="bb-load-bd">' + esc(ad.subtext) + '</div>' : "") +
      '<a class="bb-load-ct" href="' + esc(ad.cta_url) + '" target="_blank" rel="noopener">' +
        esc(ad.cta_label || "Learn more") + ' ↗</a>';
    box.querySelector(".bb-load-ct").addEventListener("click", function () {
      feedback(ad, "click");
    });
    mountEl.appendChild(box);
    feedback(ad, "impression");
    // Teardown is silent — when the AI response replaces the loading ad the
    // user did not dismiss it, so no skip/close event is fired. Engagement
    // is captured purely by the presence/absence of a click.
    return function teardown() { if (box.parentNode) box.parentNode.removeChild(box); };
  }

  // ── sponsored citation ─────────────────────────────────────────────────
  function renderCitation(ad, mountEl) {
    var cite = themed(document.createElement("span"));
    cite.className += " bb-cite";
    cite.innerHTML =
      '<span class="bb-cite-tag">Sponsored</span>' +
      '<a href="' + esc(ad.cta_url) + '" target="_blank" rel="noopener">' +
        esc(ad.headline) + ' ↗</a>';
    cite.querySelector("a").addEventListener("click", function () {
      feedback(ad, "click");
    });
    mountEl.appendChild(cite);
    feedback(ad, "impression");
    return function teardown() { if (cite.parentNode) cite.parentNode.removeChild(cite); };
  }

  // ── suggested-action chip ──────────────────────────────────────────────
  function renderChip(ad, mountEl) {
    var chip = themed(document.createElement("a"));
    chip.className += " bb-chip";
    chip.href = ad.cta_url || "#";
    chip.target = "_blank";
    chip.rel = "noopener";
    chip.innerHTML =
      '<span class="bb-chip-dot"></span>' +
      '<span>' + esc(ad.cta_label || ad.headline) + '</span>' +
      '<span class="bb-chip-tag">Ad</span>';
    chip.addEventListener("click", function () { feedback(ad, "click"); });
    mountEl.appendChild(chip);
    feedback(ad, "impression");
    return function teardown() { if (chip.parentNode) chip.parentNode.removeChild(chip); };
  }

  var RENDERERS = {
    corner:   renderCorner,
    card:     renderCard,
    loading:  renderLoading,
    citation: renderCitation,
    chip:     renderChip,
  };

  // ── Network: request an ad from the auction ────────────────────────────
  function requestSponsored(placement, opts) {
    var entry = REGISTRY[placement];
    var timeoutId = null;
    var controller = new AbortController();
    timeoutId = setTimeout(function () { controller.abort(); }, 8000);

    return fetch(API_BASE + "/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lumi-Source": "js-snippet",
      },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: "get_sponsored_content",
          arguments: {
            context_summary:   opts.context || "",
            user_region:       opts.region || (Intl.DateTimeFormat().resolvedOptions().timeZone),
            user_language:     opts.language || (navigator.language ? navigator.language.split("-")[0] : "en"),
            session_id:        SESSION_ID,
            developer_api_key: config.apiKey || "",
            format_preference: opts.format || entry.format,
            surface:           "web-" + placement,
          },
        },
      }),
    }).then(function (resp) {
      if (!resp.ok) return sdkError("SERVER_ERROR", "Server returned HTTP " + resp.status, { status: resp.status });
      return resp.json().then(function (data) {
        var text = data && data.result && data.result.content && data.result.content[0] && data.result.content[0].text;
        if (!text) return sdkError("EMPTY_RESPONSE", "Server returned an empty ad response");
        var parsed;
        try { parsed = JSON.parse(text); }
        catch (e) { return sdkError("PARSE_ERROR", "Failed to parse ad response JSON", e); }
        if (!parsed.sponsored) {
          return sdkError("NO_FILL", "No ad available" + (parsed.reason ? ": " + parsed.reason : ""),
            { reason: parsed.reason });
        }
        return parsed.sponsored;
      });
    }).catch(function (err) {
      return sdkError("FETCH_ERROR",
        err && err.name === "AbortError" ? "Ad request timed out (8s)" : "Network error fetching ad", err);
    }).finally(function () {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────
  var BoostBoss = {
    version: VERSION,
    placements: Object.keys(REGISTRY),

    init: function (opts) {
      Object.assign(config, opts || {});
      if (opts && opts.apiBase) API_BASE = opts.apiBase.replace(/\/+$/, "");
      injectStyles();
      state.initialized = true;
      if (!config.apiKey) {
        sdkError("NO_API_KEY", "No API key provided — ads will not serve. " +
          "Pass apiKey in init() or via the data-api-key attribute.");
      }
      if (config.debug) {
        console.log("[BoostBoss SDK v" + VERSION + "] initialised",
          config.apiKey ? "key: " + String(config.apiKey).substr(0, 12) + "..." : "(no key)",
          "-> " + API_BASE);
      }
      return this;
    },

    /**
     * Request and render an ad.
     *   opts.placement  "corner" | "card" | "loading" | "citation" | "chip"
     *                   (default "corner"; legacy format:"fullscreen" works)
     *   opts.context    what the user is doing — carried to the auction.
     *   opts.mount      CSS selector or element — required for every
     *                   placement except "corner".
     * Resolves to the ad object, or null on any error / no-fill.
     */
    requestAd: function (opts) {
      opts = opts || {};
      if (!state.initialized) this.init({});

      // Resolve placement. Legacy callers pass { format: "fullscreen" }.
      var placement = opts.placement ||
        (opts.format === "fullscreen" ? "corner" : "corner");
      var entry = REGISTRY[placement];
      if (!entry) {
        return Promise.resolve(sdkError("BAD_PLACEMENT",
          "Unknown placement '" + placement + "'. Use one of: " + Object.keys(REGISTRY).join(", ")));
      }

      // Session cap applies to every placement; the minInterval throttle
      // applies only to interruptive placements (corner) so inline units
      // can render as often as the page needs them.
      if (state.adsShown >= config.maxAdsPerSession) {
        return Promise.resolve(sdkError("SESSION_CAP",
          "Session ad cap reached (" + config.maxAdsPerSession + ")"));
      }
      if (entry.interruptive && state.adsShown > 0 &&
          Date.now() - state.lastInterruptiveAt < config.minIntervalMs) {
        return Promise.resolve(sdkError("RATE_LIMITED",
          "Interruptive ad requested too soon — minimum interval is " + config.minIntervalMs + "ms"));
      }

      // DOM-mounted placements need a valid mount target.
      var mountEl = null;
      if (!entry.selfMount) {
        mountEl = resolveMount(opts.mount);
        if (!mountEl) {
          return Promise.resolve(sdkError("NO_MOUNT",
            "Placement '" + placement + "' needs opts.mount (a CSS selector or element)."));
        }
      }

      var self = this;
      return requestSponsored(placement, opts).then(function (ad) {
        if (!ad) return null;
        // Tear down any prior ad in this same placement before re-rendering.
        if (state.mounts[placement] && state.mounts[placement].teardown) {
          try { state.mounts[placement].teardown(); } catch (_e) {}
        }
        var teardown;
        try {
          teardown = RENDERERS[placement](ad, entry.selfMount ? opts : mountEl);
        } catch (e) {
          return sdkError("RENDER_ERROR", "Failed to render placement '" + placement + "'", e);
        }
        state.mounts[placement] = { ad: ad, teardown: teardown };
        state.adsShown++;
        return ad;
      });
    },

    /** Tear down the loading-state ad once your AI response is ready. */
    clearLoading: function () {
      var m = state.mounts.loading;
      if (m && m.teardown) { try { m.teardown(); } catch (_e) {} }
      state.mounts.loading = null;
    },

    /** Remove a rendered placement (e.g. "card", "citation", "chip"). */
    clear: function (placement) {
      var m = state.mounts[placement];
      if (m && m.teardown) { try { m.teardown(); } catch (_e) {} }
      state.mounts[placement] = null;
    },

    /** Close the corner / fullscreen popup. */
    close: function (silent) {
      var video = document.getElementById("bb-video");
      if (video) { video.pause(); video.removeAttribute("src"); }
      var popup = document.getElementById("bb-popup");
      if (popup) popup.style.display = "none";
      var backdrop = document.getElementById("bb-backdrop");
      if (backdrop) backdrop.style.display = "none";
      var pr = document.getElementById("bb-pr");
      if (pr) pr.style.width = "0%";
      clearTimers();
      if (state.currentCornerAd && !silent) feedback(state.currentCornerAd, "close");
      state.currentCornerAd = null;
      state.mounts.corner = null;
    },

    togglePlay: function () {
      var video = document.getElementById("bb-video");
      var overlay = document.getElementById("bb-vo");
      var pr = document.getElementById("bb-pr");
      if (!video) return;
      if (video.paused) {
        video.play(); overlay.style.display = "none"; startProgress(video, pr);
      } else {
        video.pause();
        if (state.progressTimer) { clearInterval(state.progressTimer); state.progressTimer = null; }
        overlay.style.display = "flex";
        document.getElementById("bb-pi").textContent = "▶";
      }
    },

    toggleMute: function () {
      var video = document.getElementById("bb-video");
      var btn = document.getElementById("bb-mb");
      if (!video) return;
      video.muted = !video.muted;
      btn.textContent = video.muted ? "Unmute" : "Mute";
    },

    /** Legacy helper — returns inline card markup as an HTML string.
     *  Prefer requestAd({ placement: "card", mount }). Kept for back-compat. */
    getNativeAdHTML: function (ad) {
      var clickUrl = esc(ad.tracking && ad.tracking.click);
      return '<div class="bb-root bb-card' + (config.theme === "light" ? " bb-light" : "") + '">' +
        '<div class="bb-lbl"><span class="bb-badge">B</span>Sponsored &middot; Boost Boss</div>' +
        '<div class="bb-card-hl">' + esc(ad.headline) + '</div>' +
        '<div class="bb-card-bd">' + esc(ad.subtext) + '</div>' +
        '<a class="bb-card-ct" href="' + esc(ad.cta_url) + '" target="_blank" rel="noopener" ' +
          'data-bb-click="' + clickUrl + '">' + esc(ad.cta_label) + '</a>' +
      '</div>';
    },

    /** Bind click tracking after inserting getNativeAdHTML markup. */
    bindNativeClicks: function (container) {
      var el = container || document;
      el.querySelectorAll("a[data-bb-click]").forEach(function (a) {
        a.addEventListener("click", function () { track(a.dataset.bbClick); });
      });
    },

    getStats: function () {
      return { session: SESSION_ID, adsShown: state.adsShown, lastInterruptiveAt: state.lastInterruptiveAt };
    },

    getLastError: function () { return lastError; },
    setDebug: function (on) { config.debug = !!on; },
  };

  // Auto-init from the <script> tag's data attributes.
  var scripts = document.querySelectorAll('script[src*="sdk.js"]');
  for (var i = 0; i < scripts.length; i++) {
    var key = scripts[i].getAttribute("data-api-key");
    var base = scripts[i].getAttribute("data-api-base");
    var dbg = scripts[i].getAttribute("data-debug");
    if (key || base || dbg != null) {
      BoostBoss.init({
        apiKey: key || null,
        apiBase: base || undefined,
        debug: dbg != null && dbg !== "false",
      });
      break;
    }
  }

  window.BoostBoss = BoostBoss;
})(window, document);
