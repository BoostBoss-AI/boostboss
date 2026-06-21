// @boostbossai/lumi-extension — loading-state ad renderer
//
// Watches the popup/sidepanel `container` (defaults to document.body) for
// spinner-like elements that stay visible for >1.5s, then mounts a
// sponsored card in their place. Also supports explicit
// `[data-lumi-slot="loading"]` markers — those are treated as immediate
// candidates (publisher already declared "show ad here while loading").
//
// Shape:
//   LumiLoading.observe({ publisherId, container, contextHint })
//
// Detection heuristic:
//   - `[aria-busy="true"]`
//   - `.spinner`, `.loading` (class includes)
//   - `[data-lumi-slot="loading"]` — explicit marker
//
// Judgment calls (documented for future tuning):
//   1. We mount INSIDE the matched element, not replace it. Publisher's
//      own spinner stays in DOM (so cleanup logic doesn't break) but is
//      hidden via display:none on the spinner's children. Cheaper than
//      tracking original markup for restoration.
//   2. Threshold is 1.5s of continuous visibility — short enough to catch
//      most LLM call latencies, long enough to skip transient renders.
//   3. We only fetch one ad per `observe()` call — once shown, we
//      disconnect. Re-arm requires a new observe() call. This matches the
//      "loading-state ad shown during processing" intent (one prompt, one
//      ad), and avoids stacked fetches if multiple spinners flash.
//   4. `[data-lumi-slot="loading"]` markers bypass the 1.5s wait — the
//      publisher has opted in explicitly.

import {
  PLACEMENTS,
  fetchAd,
  observeImpression,
  openClick,
  getSessionId,
  getActiveTabUrl,
} from './shared.js';

const PUB_KEY = 'lumi_publisher_id';
const LOADING_DELAY_MS = 1500;

async function resolvePublisherId(explicit) {
  if (explicit) return explicit;
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return null;
  try {
    const got = await chrome.storage.local.get(PUB_KEY);
    return (got && got[PUB_KEY]) || null;
  } catch (_e) {
    return null;
  }
}

function isSpinnerLike(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.getAttribute && el.getAttribute('aria-busy') === 'true') return true;
  if (el.matches && el.matches('[data-lumi-slot="loading"]')) return true;
  const cls = el.className && typeof el.className === 'string' ? el.className : '';
  if (/\b(spinner|loading)\b/i.test(cls)) return true;
  return false;
}

function isExplicitSlot(el) {
  return !!(el && el.matches && el.matches('[data-lumi-slot="loading"]'));
}

function findSpinners(container) {
  const matches = [];
  if (!container || !container.querySelectorAll) return matches;
  try {
    const found = container.querySelectorAll(
      '[aria-busy="true"], .spinner, .loading, [data-lumi-slot="loading"]'
    );
    for (const el of found) matches.push(el);
  } catch (_e) { /* silent */ }
  return matches;
}

function renderInto(host, ad) {
  // Hide existing children so the spinner visual goes away; keep the
  // wrapper so publisher cleanup logic (which usually toggles aria-busy
  // or removes the wrapper) still works correctly.
  for (const child of Array.from(host.children)) {
    try { child.style.display = 'none'; } catch (_e) { /* silent */ }
  }

  const root = document.createElement('div');
  root.setAttribute('data-lumi-placement', 'loading');
  root.style.cssText = [
    'all: initial',
    'display: block',
    'box-sizing: border-box',
    'font-family: -apple-system, system-ui, sans-serif',
    'background: #FAFAF7',
    'border: 1px solid #E5E7EB',
    'border-radius: 10px',
    'padding: 12px',
    'margin: 0',
    'color: #0F0F1A',
  ].join(';');

  const pillRow = document.createElement('div');
  pillRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';

  const pill = document.createElement('span');
  pill.textContent = 'BB';
  pill.style.cssText = 'display:inline-block;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#FF2D78;color:#fff';
  pillRow.appendChild(pill);

  const label = document.createElement('span');
  label.textContent = 'Sponsored while you wait';
  label.style.cssText = 'font-size:10px;color:#4B5563;text-transform:uppercase;letter-spacing:0.05em';
  pillRow.appendChild(label);
  root.appendChild(pillRow);

  const headline = document.createElement('div');
  headline.textContent = ad.headline || '';
  headline.style.cssText = 'font-size:13px;font-weight:600;line-height:1.3;margin-bottom:4px';
  root.appendChild(headline);

  if (ad.body) {
    const body = document.createElement('div');
    body.textContent = ad.body;
    body.style.cssText = 'font-size:12px;color:#4B5563;line-height:1.4;margin-bottom:8px';
    root.appendChild(body);
  }

  const cta = document.createElement('button');
  cta.setAttribute('type', 'button');
  cta.textContent = ad.cta_label || ad.cta || 'Learn more';
  cta.style.cssText = [
    'all: unset',
    'display:inline-block',
    'font-family: -apple-system, system-ui, sans-serif',
    'font-size:12px',
    'font-weight:600',
    'padding:6px 12px',
    'border-radius:6px',
    'background:#FF2D78',
    'color:#fff',
    'cursor:pointer',
  ].join(';');
  cta.addEventListener('click', () => openClick(ad));
  root.appendChild(cta);

  host.appendChild(root);
  return root;
}

export const LumiLoading = {
  observe(opts = {}) {
    const { container, contextHint } = opts;
    const host = container || document.body;
    if (!host) return () => {};

    let cancelled = false;
    let pendingTimer = null;
    let pendingEl = null;
    let observer = null;

    const tryMount = async (el) => {
      if (cancelled) return;
      const publisherId = await resolvePublisherId(opts.publisherId);
      if (!publisherId || cancelled) return;

      const sessionId = await getSessionId();
      const contextUrl = contextHint || (await getActiveTabUrl());
      const ad = await fetchAd({
        publisherId,
        placement: PLACEMENTS.LOADING,
        contextUrl,
        sessionId,
      });
      if (!ad || cancelled || !el.isConnected) return;

      const root = renderInto(el, ad);
      observeImpression(root, ad, { sessionId });
      cleanup();
    };

    const consider = (el) => {
      if (cancelled || pendingEl === el || !isSpinnerLike(el)) return;
      // Explicit slot: mount immediately. Otherwise wait LOADING_DELAY_MS.
      if (isExplicitSlot(el)) {
        pendingEl = el;
        tryMount(el).catch(() => {});
        return;
      }
      pendingEl = el;
      pendingTimer = setTimeout(() => {
        // Re-check visibility before mounting — spinner may have cleared.
        if (cancelled || !el.isConnected) return;
        if (!isSpinnerLike(el)) return;
        tryMount(el).catch(() => {});
      }, LOADING_DELAY_MS);
    };

    const cleanup = () => {
      cancelled = true;
      if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
      if (observer) { try { observer.disconnect(); } catch (_e) { /* silent */ } observer = null; }
    };

    // Initial pass — covers spinners already in DOM when observe() is called.
    for (const el of findSpinners(host)) {
      consider(el);
      if (cancelled) break;
    }

    if (cancelled) return cleanup;

    if (typeof MutationObserver === 'undefined') return cleanup;

    observer = new MutationObserver((mutations) => {
      if (cancelled) return;
      for (const m of mutations) {
        if (m.type === 'attributes' && isSpinnerLike(m.target)) {
          consider(m.target);
        }
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (isSpinnerLike(node)) consider(node);
            for (const child of findSpinners(node)) consider(child);
            if (cancelled) return;
          }
        }
      }
    });
    try {
      observer.observe(host, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-busy', 'class', 'data-lumi-slot'],
      });
    } catch (_e) { /* silent */ }

    return cleanup;
  },
};

export default LumiLoading;
