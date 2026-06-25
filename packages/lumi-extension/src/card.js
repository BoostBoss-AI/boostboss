// @boostbossai/lumi-extension — inline sponsored card renderer
//
// Richer card for popup or sidepanel. Headline + body + optional image + CTA.
//
// Shape:
//   LumiCard.mount({ publisherId, container, contextHint })
//
// Visual: ~140px tall, white background, BB disclosure pill, optional image
// (24:9 ratio at top), headline, body line, CTA button.

import {
  PLACEMENTS,
  fetchAd,
  observeImpression,
  openClick,
  getSessionId,
  getActiveTabUrl,
  makeBrandLine,
  makeVoucher,
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

export const LumiCard = {
  async mount(opts = {}) {
    const { container, contextHint } = opts;
    const publisherId = await resolvePublisherId(opts.publisherId);
    if (!publisherId) return null;

    const sessionId = await getSessionId();
    const contextUrl = contextHint || (await getActiveTabUrl());
    const ad = await fetchAd({
      publisherId,
      placement: PLACEMENTS.CARD,
      contextUrl,
      sessionId,
    });
    if (!ad) return null;

    const host = container || document.body;
    if (!host) return null;

    const root = document.createElement('div');
    root.setAttribute('data-lumi-placement', 'card');
    root.style.cssText = [
      'all: initial',
      'display: block',
      'box-sizing: border-box',
      'font-family: -apple-system, system-ui, sans-serif',
      'background: #fff',
      'border: 1px solid #E5E7EB',
      'border-radius: 10px',
      'padding: 12px',
      'margin: 8px 0',
      'max-width: 360px',
      'color: #0F0F1A',
      'overflow: hidden',
    ].join(';');

    // Disclosure pill row
    const pillRow = document.createElement('div');
    pillRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px';

    const pill = document.createElement('span');
    pill.textContent = 'BB';
    pill.style.cssText = [
      'display:inline-block',
      'font-size:10px',
      'font-weight:700',
      'padding:2px 6px',
      'border-radius:4px',
      'background:#FF2D78',
      'color:#fff',
    ].join(';');
    pillRow.appendChild(pill);

    const sponsored = document.createElement('span');
    sponsored.textContent = 'Sponsored';
    sponsored.style.cssText = 'font-size:10px;color:#4B5563;text-transform:uppercase;letter-spacing:0.05em';
    pillRow.appendChild(sponsored);

    root.appendChild(pillRow);

    // Brand line — Creatives library brand_kit.
    const brand = makeBrandLine(ad);
    if (brand) root.appendChild(brand);

    if (ad.image_url) {
      const img = document.createElement('img');
      img.src = ad.image_url;
      img.alt = '';
      // 24:9 ratio strip across the top of the card.
      img.style.cssText = [
        'display:block',
        'width:100%',
        'aspect-ratio:24/9',
        'object-fit:cover',
        'border-radius:6px',
        'margin-bottom:10px',
      ].join(';');
      root.appendChild(img);
    }

    const headline = document.createElement('div');
    headline.textContent = ad.headline || '';
    headline.style.cssText = 'font-size:14px;font-weight:600;line-height:1.3;margin-bottom:4px;color:#0F0F1A';
    root.appendChild(headline);

    if (ad.body) {
      const body = document.createElement('div');
      body.textContent = ad.body;
      body.style.cssText = 'font-size:12px;color:#4B5563;line-height:1.4;margin-bottom:10px';
      root.appendChild(body);
    }

    // Voucher endcard — Creatives library voucher.
    const voucher = makeVoucher(ad);
    if (voucher) root.appendChild(voucher);

    const cta = document.createElement('button');
    cta.setAttribute('type', 'button');
    cta.textContent = ad.cta_label || ad.cta || 'Learn more';
    cta.style.cssText = [
      'all: unset',
      'display:inline-block',
      'font-family: -apple-system, system-ui, sans-serif',
      'font-size:12px',
      'font-weight:600',
      'padding:8px 14px',
      'border-radius:6px',
      'background:#FF2D78',
      'color:#fff',
      'cursor:pointer',
      'text-align:center',
    ].join(';');
    cta.addEventListener('click', () => openClick(ad));
    root.appendChild(cta);

    host.appendChild(root);
    observeImpression(root, ad, { sessionId });
    return root;
  },
};

export default LumiCard;
