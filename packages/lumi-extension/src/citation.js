// @boostbossai/lumi-extension — sponsored citation renderer
//
// Inline single-line citation that appends under an AI response in a
// popup or sidepanel surface. Visual: [BB] Sponsored — Brand · tagline →
//
// Shape:
//   LumiCitation.mount({ publisherId, container, contextHint })
//
// - publisherId: required; falls back to chrome.storage.local if omitted.
// - container:   DOM node to append the citation into. Defaults to document.body.
// - contextHint: optional string passed as contextUrl override for richer
//                intent matching (e.g. the AI prompt text).

import {
  PLACEMENTS,
  fetchAd,
  observeImpression,
  openClick,
  getSessionId,
  getActiveTabUrl,
} from './shared.js';

const PUB_KEY = 'lumi_publisher_id';

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

export const LumiCitation = {
  async mount(opts = {}) {
    const { container, contextHint } = opts;
    const publisherId = await resolvePublisherId(opts.publisherId);
    if (!publisherId) return null;

    const sessionId = await getSessionId();
    const contextUrl = contextHint || (await getActiveTabUrl());
    const ad = await fetchAd({
      publisherId,
      placement: PLACEMENTS.CITATION,
      contextUrl,
      sessionId,
    });
    if (!ad) return null;

    const host = container || document.body;
    if (!host) return null;

    const root = document.createElement('div');
    root.setAttribute('data-lumi-placement', 'citation');
    root.style.cssText = [
      'all: initial',
      'display: flex',
      'align-items: center',
      'gap: 6px',
      'box-sizing: border-box',
      'font-family: -apple-system, system-ui, sans-serif',
      'font-size: 12px',
      'line-height: 1.3',
      'color: #4B5563',
      'padding: 6px 10px',
      'margin: 6px 0',
      'border-top: 1px solid #E5E7EB',
      'max-height: 30px',
      'overflow: hidden',
      'white-space: nowrap',
      'cursor: pointer',
    ].join(';');

    const pill = document.createElement('span');
    pill.textContent = 'BB';
    pill.style.cssText = [
      'display: inline-block',
      'font-size: 10px',
      'font-weight: 700',
      'letter-spacing: 0.04em',
      'padding: 2px 6px',
      'border-radius: 4px',
      'background: #FF2D78',
      'color: #fff',
      'flex-shrink: 0',
    ].join(';');
    root.appendChild(pill);

    const sponsored = document.createElement('span');
    sponsored.textContent = 'Sponsored';
    sponsored.style.cssText = 'color:#0F0F1A;font-weight:600;flex-shrink:0';
    root.appendChild(sponsored);

    const dash = document.createElement('span');
    dash.textContent = '—';
    dash.style.cssText = 'color:#4B5563;flex-shrink:0';
    root.appendChild(dash);

    const brand = document.createElement('span');
    brand.textContent = ad.brand || ad.headline || '';
    brand.style.cssText = 'color:#0F0F1A;font-weight:600;flex-shrink:0';
    root.appendChild(brand);

    if (ad.body || ad.tagline) {
      const sep = document.createElement('span');
      sep.textContent = '·';
      sep.style.cssText = 'color:#4B5563;flex-shrink:0';
      root.appendChild(sep);

      const tagline = document.createElement('span');
      tagline.textContent = ad.tagline || ad.body || '';
      tagline.style.cssText = 'color:#4B5563;overflow:hidden;text-overflow:ellipsis;min-width:0';
      root.appendChild(tagline);
    }

    const arrow = document.createElement('span');
    arrow.textContent = '→';
    arrow.style.cssText = 'color:#FF2D78;font-weight:700;flex-shrink:0;margin-left:auto';
    root.appendChild(arrow);

    root.addEventListener('click', () => openClick(ad));

    host.appendChild(root);
    observeImpression(root, ad, { sessionId });
    return root;
  },
};

export default LumiCitation;
