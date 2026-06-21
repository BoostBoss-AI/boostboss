// @boostbossai/lumi-extension — suggested chip renderer
//
// Tappable quick-reply pill for popup/sidepanel "you might also try" rows.
//
// Shape:
//   LumiChip.mount({ publisherId, container, contextHint })

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

export const LumiChip = {
  async mount(opts = {}) {
    const { container, contextHint } = opts;
    const publisherId = await resolvePublisherId(opts.publisherId);
    if (!publisherId) return null;

    const sessionId = await getSessionId();
    const contextUrl = contextHint || (await getActiveTabUrl());
    const ad = await fetchAd({
      publisherId,
      placement: PLACEMENTS.CHIP,
      contextUrl,
      sessionId,
    });
    if (!ad) return null;

    const host = container || document.body;
    if (!host) return null;

    const btn = document.createElement('button');
    btn.setAttribute('data-lumi-placement', 'chip');
    btn.setAttribute('type', 'button');
    btn.style.cssText = [
      'all: initial',
      'display: inline-flex',
      'align-items: center',
      'gap: 6px',
      'box-sizing: border-box',
      'font-family: -apple-system, system-ui, sans-serif',
      'font-size: 12px',
      'font-weight: 500',
      'line-height: 1.2',
      'color: #0F0F1A',
      'background: #FAFAF7',
      'border: 1px solid #FF2D78',
      'border-radius: 999px',
      'padding: 6px 12px',
      'margin: 4px 4px 4px 0',
      'cursor: pointer',
      'max-width: 280px',
      'white-space: nowrap',
      'overflow: hidden',
      'text-overflow: ellipsis',
    ].join(';');

    const label = document.createElement('span');
    label.textContent = ad.headline || ad.cta_label || ad.cta || 'Try this';
    label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;min-width:0';
    btn.appendChild(label);

    const arrow = document.createElement('span');
    arrow.textContent = '→';
    arrow.style.cssText = 'color:#FF2D78;font-weight:700;flex-shrink:0';
    btn.appendChild(arrow);

    btn.addEventListener('click', () => openClick(ad));

    host.appendChild(btn);
    observeImpression(btn, ad, { sessionId });
    return btn;
  },
};

export default LumiChip;
