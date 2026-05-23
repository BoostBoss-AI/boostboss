/**
 * DOM rendering for the four Extension-door placements:
 *   corner    sticky anchored unit (mounts fixed to a screen corner)
 *   newtab    new-tab / home-screen takeover (large hero in the slot)
 *   citation  sponsored source / citation (compact, inline)
 *   toolrec   sponsored tool / skill recommendation ("you might also try")
 *
 * Legacy format names (banner/sidebar/inline/interstitial) still resolve
 * via normalizeFormat so existing integrations don't break.
 *
 * CSS-variable theming via :root or any ancestor of the slot. No eval, no
 * innerHTML for content (only "" for clearing), no inline event handlers —
 * all DOM via createElement so the bundle passes Manifest v3 / strict CSP.
 */
import type { AdPayload, PlacementFormat } from "./types.js";

const CSS = `
.lumi-corner, .lumi-newtab, .lumi-citation, .lumi-toolrec {
  --_p:   var(--lumi-primary, #FF2D78);
  --_t:   var(--lumi-text, #0F0F1A);
  --_m:   var(--lumi-muted, #6B7280);
  --_bg:  var(--lumi-bg, #FFFFFF);
  --_b:   var(--lumi-border, #E5E7EB);
  --_r:   var(--lumi-radius, 12px);
  --_f:   var(--lumi-font, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif);
  font-family: var(--_f); color: var(--_t); box-sizing: border-box;
}
.lumi-disclosure { display: inline-block; font-size: 11px; font-weight: 600; color: var(--_m); letter-spacing: 0.04em; text-transform: uppercase; }
.lumi-eyebrow { display: inline-block; font-size: 11px; font-weight: 700; color: var(--_p); letter-spacing: 0.03em; text-transform: uppercase; }
.lumi-cta { display: inline-flex; align-items: center; justify-content: center; background: var(--_p); color: #fff; font-weight: 600; font-size: 13px; padding: 8px 16px; border-radius: 8px; text-decoration: none; line-height: 1.2; transition: filter 0.15s; white-space: nowrap; }
.lumi-cta:hover { filter: brightness(1.08); }
.lumi-x { position: absolute; top: 8px; right: 10px; width: 26px; height: 26px; border: none; background: transparent; cursor: pointer; font-size: 20px; line-height: 1; color: var(--_m); border-radius: 50%; padding: 0; }
.lumi-x:hover { background: rgba(0,0,0,0.05); color: var(--_t); }

/* corner — sticky anchored unit */
.lumi-corner-anchor { position: fixed; bottom: 24px; right: 24px; width: 320px; z-index: 2147483646; }
.lumi-corner { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 16px; background: var(--_bg); border: 1px solid var(--_b); border-radius: var(--_r); box-shadow: 0 16px 48px rgba(0,0,0,0.22); }
.lumi-corner__media { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; }
.lumi-corner__title { font-size: 15px; font-weight: 700; line-height: 1.3; margin: 0; }
.lumi-corner__sub { font-size: 13px; color: var(--_m); line-height: 1.45; margin: 0; }
.lumi-corner__cta { align-self: stretch; }

/* newtab — new-tab / home-screen takeover */
.lumi-newtab { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px; max-width: 560px; margin: 0 auto; padding: 36px 32px; background: var(--_bg); border: 1px solid var(--_b); border-radius: var(--_r); }
.lumi-newtab__media { width: 100%; max-width: 420px; aspect-ratio: 16/9; object-fit: cover; border-radius: 10px; }
.lumi-newtab__title { font-size: 24px; font-weight: 800; line-height: 1.2; margin: 0; }
.lumi-newtab__sub { font-size: 15px; color: var(--_m); line-height: 1.5; margin: 0; }
.lumi-newtab__cta { padding: 12px 26px; font-size: 15px; }

/* citation — compact inline sponsored source */
.lumi-citation { font-size: 13px; line-height: 1.5; }
.lumi-citation__title { font-weight: 600; }
.lumi-citation__cta { color: var(--_p); font-weight: 600; text-decoration: none; margin-left: 4px; }
.lumi-citation__cta:hover { text-decoration: underline; }

/* toolrec — sponsored tool / skill recommendation */
.lumi-toolrec { position: relative; display: flex; flex-direction: column; gap: 7px; padding: 14px 16px; background: var(--_bg); border: 1px solid var(--_b); border-radius: var(--_r); max-width: 480px; }
.lumi-toolrec__head { display: flex; align-items: center; gap: 10px; }
.lumi-toolrec__title { font-size: 14px; font-weight: 700; line-height: 1.3; margin: 0; }
.lumi-toolrec__sub { font-size: 12px; color: var(--_m); line-height: 1.45; margin: 0; }
.lumi-toolrec__cta { align-self: flex-start; padding: 7px 14px; font-size: 12px; }
@media (max-width: 480px) { .lumi-corner-anchor { left: 12px; right: 12px; width: auto; } }
`;

let cssInjected = false;
export function injectStyles(target: Document = document): void {
  if (cssInjected) return;
  if (target.getElementById("lumi-styles")) { cssInjected = true; return; }
  const style = target.createElement("style");
  style.id = "lumi-styles";
  style.textContent = CSS;
  target.head.appendChild(style);
  cssInjected = true;
}

/** Reset the cssInjected flag so a fresh render() re-injects styles. @internal */
export function resetStyles(): void { cssInjected = false; }

// ── Placement taxonomy ─────────────────────────────────────────────────
const CORE: readonly string[] = ["corner", "newtab", "citation", "toolrec"];
const LEGACY: Record<string, PlacementFormat> = {
  banner: "toolrec", sidebar: "toolrec", inline: "citation", interstitial: "corner",
};
/** Resolve any slot/format string to one of the four core placements. */
export function normalizeFormat(raw?: string | null): PlacementFormat {
  const f = String(raw || "").toLowerCase().trim();
  if (CORE.indexOf(f) >= 0) return f as PlacementFormat;
  return LEGACY[f] ?? "citation";
}

// ── Beacons ─────────────────────────────────────────────────────────────
/**
 * Fire a server-side tracking beacon (fire-and-forget). The URL is minted
 * by the auction and carries the context fingerprint (ctx=), so every
 * impression / click / close / dismiss is context-joined. Uses an Image
 * pixel in the browser (no CORS preflight) and falls back to fetch in Node.
 */
export function beacon(url: string | null | undefined): void {
  if (!url) return;
  try {
    if (typeof Image !== "undefined") {
      const img = new Image(1, 1);
      img.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;";
      img.src = url;
    } else if (typeof fetch !== "undefined") {
      void fetch(url, { method: "GET", keepalive: true }).catch(() => { /* best-effort */ });
    }
  } catch (_e) { /* ignore */ }
}

/** @deprecated use beacon(). Kept so existing imports keep resolving. */
export function fireImpressionBeacon(url: string): void { beacon(url); }

// ── Building blocks ─────────────────────────────────────────────────────
function makeDisclosure(label: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "lumi-disclosure";
  span.textContent = label;
  return span;
}

function closeButton(onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "lumi-x";
  b.setAttribute("aria-label", "Dismiss");
  b.textContent = "×";
  b.addEventListener("click", onClick);
  return b;
}

function buildCta(ad: AdPayload, cls: string, onClick: () => void): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className = "lumi-cta" + (cls ? " " + cls : "");
  a.href = ad.ctaUrl;
  a.target = "_blank";
  a.rel = "noopener sponsored";
  a.textContent = ad.ctaLabel;
  a.addEventListener("click", () => {
    beacon(ad.tracking.click);   // server-side click feedback (context-joined)
    onClick();
  });
  return a;
}

function addMedia(parent: HTMLElement, ad: AdPayload, cls: string): void {
  if (!ad.mediaUrl) return;
  const img = document.createElement("img");
  img.className = cls;
  img.src = ad.mediaUrl;
  img.alt = "";
  img.onerror = () => img.remove();
  parent.appendChild(img);
}

export interface RenderResult {
  /** Element mounted outside the slot (corner anchor); null otherwise. Tracked for cleanup. */
  backdrop: HTMLElement | null;
}

/** onClose is invoked when the user dismisses an ad — used to emit the close event. */
export function renderAd(
  el: HTMLElement,
  ad: AdPayload,
  format: string,
  onClick: () => void,
  onClose: () => void = () => {},
): RenderResult {
  injectStyles();
  const f = normalizeFormat(format);
  if (f === "corner")  return renderCorner(el, ad, onClick, onClose);
  if (f === "newtab")  return renderNewtab(el, ad, onClick, onClose);
  if (f === "toolrec") return renderToolrec(el, ad, onClick, onClose);
  return renderCitation(el, ad, onClick);
}

// corner — sticky anchored unit. Mounts a fixed-position element to the
// body; the slot element itself becomes a hidden cleanup anchor.
function renderCorner(el: HTMLElement, ad: AdPayload, onClick: () => void, onClose: () => void): RenderResult {
  el.style.display = "none";
  const anchor = document.createElement("div");
  anchor.className = "lumi-corner-anchor";
  const card = document.createElement("div");
  card.className = "lumi-corner";
  card.appendChild(closeButton(() => {
    beacon(ad.tracking.close);
    if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    onClose();
  }));
  card.appendChild(makeDisclosure(ad.disclosureLabel));
  addMedia(card, ad, "lumi-corner__media");
  const h = document.createElement("p");
  h.className = "lumi-corner__title"; h.textContent = ad.headline;
  card.appendChild(h);
  if (ad.body) {
    const s = document.createElement("p");
    s.className = "lumi-corner__sub"; s.textContent = ad.body;
    card.appendChild(s);
  }
  card.appendChild(buildCta(ad, "lumi-corner__cta", onClick));
  anchor.appendChild(card);
  document.body.appendChild(anchor);
  return { backdrop: anchor };
}

// newtab — new-tab / home-screen takeover. A large hero rendered in the slot.
function renderNewtab(el: HTMLElement, ad: AdPayload, onClick: () => void, onClose: () => void): RenderResult {
  el.classList.add("lumi-newtab");
  el.innerHTML = "";
  el.appendChild(closeButton(() => {
    beacon(ad.tracking.dismiss);
    el.innerHTML = ""; el.classList.remove("lumi-newtab");
    onClose();
  }));
  el.appendChild(makeDisclosure(ad.disclosureLabel));
  addMedia(el, ad, "lumi-newtab__media");
  const h = document.createElement("p");
  h.className = "lumi-newtab__title"; h.textContent = ad.headline;
  el.appendChild(h);
  if (ad.body) {
    const s = document.createElement("p");
    s.className = "lumi-newtab__sub"; s.textContent = ad.body;
    el.appendChild(s);
  }
  el.appendChild(buildCta(ad, "lumi-newtab__cta", onClick));
  return { backdrop: null };
}

// citation — compact sponsored source, sits inline in a generated answer.
function renderCitation(el: HTMLElement, ad: AdPayload, onClick: () => void): RenderResult {
  el.classList.add("lumi-citation");
  el.innerHTML = "";
  el.appendChild(makeDisclosure(ad.disclosureLabel));
  el.appendChild(document.createTextNode(" "));
  const t = document.createElement("span");
  t.className = "lumi-citation__title"; t.textContent = ad.headline;
  el.appendChild(t);
  el.appendChild(document.createTextNode(" "));
  const a = buildCta(ad, "lumi-citation__cta", onClick);
  a.className = "lumi-citation__cta";   // link-style, override the button base
  a.textContent = ad.ctaLabel + " ↗";
  el.appendChild(a);
  return { backdrop: null };
}

// toolrec — sponsored tool / skill recommendation ("you might also try…").
function renderToolrec(el: HTMLElement, ad: AdPayload, onClick: () => void, onClose: () => void): RenderResult {
  el.classList.add("lumi-toolrec");
  el.innerHTML = "";
  el.appendChild(closeButton(() => {
    beacon(ad.tracking.dismiss);
    el.innerHTML = ""; el.classList.remove("lumi-toolrec"); el.style.display = "none";
    onClose();
  }));
  const head = document.createElement("div");
  head.className = "lumi-toolrec__head";
  const eyebrow = document.createElement("span");
  eyebrow.className = "lumi-eyebrow";
  eyebrow.textContent = "You might also try";
  head.appendChild(eyebrow);
  head.appendChild(makeDisclosure(ad.disclosureLabel));
  el.appendChild(head);
  const h = document.createElement("p");
  h.className = "lumi-toolrec__title"; h.textContent = ad.headline;
  el.appendChild(h);
  if (ad.body) {
    const s = document.createElement("p");
    s.className = "lumi-toolrec__sub"; s.textContent = ad.body;
    el.appendChild(s);
  }
  el.appendChild(buildCta(ad, "lumi-toolrec__cta", onClick));
  return { backdrop: null };
}

/** Tear down a slot's DOM and any associated anchor. */
export function unmountSlot(el: HTMLElement, backdrop: HTMLElement | null): void {
  if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
  el.innerHTML = "";
  el.classList.remove(
    "lumi-newtab", "lumi-citation", "lumi-toolrec",
    "lumi-card", "lumi-banner", "lumi-sidebar", "lumi-inline", "lumi-interstitial",
  );
  el.style.display = "";
}
