// @boostbossai/lumi-extension — new-tab takeover renderer
//
// Renders a full-page hero sponsored slot. New-tab is the highest-yield
// placement (~$16 RPM) — it gets the largest canvas.

import {
  PLACEMENTS,
  fetchAd,
  observeImpression,
  openClick,
  getSessionId,
  makeBrandLine,
  makeVoucher,
} from './shared.js';
import { startAutoMount } from './auto-mount.js';

const PUB_KEY = 'lumi_publisher_id';

async function getPublisherId() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return null;
  }
  try {
    const got = await chrome.storage.local.get(PUB_KEY);
    return (got && got[PUB_KEY]) || null;
  } catch (_e) {
    return null;
  }
}

async function render() {
  const publisherId = await getPublisherId();
  if (!publisherId) return;

  const sessionId = await getSessionId();
  // New-tab doesn't have a "previous active tab" context — pass null and let
  // server fall back to publisher-wide intent matching.
  const ad = await fetchAd({
    publisherId,
    placement: PLACEMENTS.NEWTAB,
    contextUrl: null,
    sessionId,
  });
  if (!ad) return;

  const hero = document.createElement('section');
  hero.setAttribute('data-lumi-placement', 'newtab-takeover');
  hero.style.cssText = [
    'all: initial',
    'display: flex',
    'flex-direction: column',
    'align-items: center',
    'justify-content: center',
    'box-sizing: border-box',
    'font-family: -apple-system, system-ui, sans-serif',
    'background: linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)',
    'padding: 48px 24px',
    'min-height: 100vh',
    'color: #111',
  ].join(';');

  const inner = document.createElement('div');
  inner.style.cssText = 'max-width:640px;width:100%;text-align:center';
  hero.appendChild(inner);

  const label = document.createElement('div');
  label.textContent = 'Sponsored';
  label.style.cssText = 'font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px';
  inner.appendChild(label);

  // Brand line — Creatives library brand_kit.
  const brand = makeBrandLine(ad);
  if (brand) {
    // Center the brand line on the hero canvas.
    brand.style.justifyContent = 'center';
    brand.style.marginBottom = '14px';
    inner.appendChild(brand);
  }

  if (ad.image_url) {
    const img = document.createElement('img');
    img.src = ad.image_url;
    img.alt = '';
    img.style.cssText = 'display:block;margin:0 auto 24px;max-width:240px;max-height:160px;object-fit:contain';
    inner.appendChild(img);
  }

  const headline = document.createElement('h1');
  headline.textContent = ad.headline || '';
  headline.style.cssText = 'font-size:32px;font-weight:700;line-height:1.2;margin:0 0 16px';
  inner.appendChild(headline);

  if (ad.body) {
    const body = document.createElement('p');
    body.textContent = ad.body;
    body.style.cssText = 'font-size:17px;line-height:1.5;color:#444;margin:0 0 20px';
    inner.appendChild(body);
  }

  // Voucher endcard — Creatives library voucher.
  const voucher = makeVoucher(ad);
  if (voucher) {
    voucher.style.margin = '0 auto 20px';
    voucher.style.maxWidth = '320px';
    inner.appendChild(voucher);
  }

  const cta = document.createElement('button');
  cta.textContent = ad.cta || 'Learn more';
  cta.style.cssText = [
    'font-size:16px',
    'padding:14px 28px',
    'border:0',
    'border-radius:8px',
    'background:#111',
    'color:#fff',
    'cursor:pointer',
    'font-weight:600',
  ].join(';');
  cta.addEventListener('click', () => openClick(ad));
  inner.appendChild(cta);

  const dismiss = document.createElement('button');
  dismiss.textContent = 'Dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.style.cssText = [
    'display:block',
    'margin:20px auto 0',
    'font-size:12px',
    'padding:6px 12px',
    'border:0',
    'background:transparent',
    'color:#888',
    'cursor:pointer',
    'text-decoration:underline',
  ].join(';');
  dismiss.addEventListener('click', () => hero.remove());
  inner.appendChild(dismiss);

  document.body.appendChild(hero);

  observeImpression(hero, ad, { sessionId });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    render().catch(() => {});
  });
} else {
  render().catch(() => {});
}

// Auto-mount the 5 secondary placements per Publisher Agreement §4.1.
try { startAutoMount(); } catch (_e) { /* silent */ }
