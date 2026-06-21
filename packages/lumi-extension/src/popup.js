// @boostbossai/lumi-extension — popup renderer
//
// Mounts a minimal sponsored card at the bottom of the popup body.
// Bare-functional v0: headline + body + CTA + dismiss.

import {
  PLACEMENTS,
  fetchAd,
  observeImpression,
  openClick,
  getSessionId,
  getActiveTabUrl,
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
  if (!publisherId) return; // not initialized yet

  const sessionId = await getSessionId();
  const contextUrl = await getActiveTabUrl();
  const ad = await fetchAd({
    publisherId,
    placement: PLACEMENTS.POPUP,
    contextUrl,
    sessionId,
  });
  if (!ad) return;

  const root = document.createElement('div');
  root.setAttribute('data-lumi-placement', 'popup-card');
  root.style.cssText = [
    'all: initial',
    'display: block',
    'box-sizing: border-box',
    'font-family: -apple-system, system-ui, sans-serif',
    'background: #fff',
    'border: 1px solid #e5e7eb',
    'border-radius: 8px',
    'padding: 12px',
    'margin: 8px',
    'max-width: 320px',
    'color: #111',
  ].join(';');

  const label = document.createElement('div');
  label.textContent = 'Sponsored';
  label.style.cssText = 'font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px';
  root.appendChild(label);

  const headline = document.createElement('div');
  headline.textContent = ad.headline || '';
  headline.style.cssText = 'font-size:14px;font-weight:600;margin-bottom:4px;line-height:1.3';
  root.appendChild(headline);

  if (ad.body) {
    const body = document.createElement('div');
    body.textContent = ad.body;
    body.style.cssText = 'font-size:12px;color:#444;line-height:1.4;margin-bottom:8px';
    root.appendChild(body);
  }

  const ctaRow = document.createElement('div');
  ctaRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px';

  const cta = document.createElement('button');
  cta.textContent = ad.cta || 'Learn more';
  cta.style.cssText = [
    'font-size:12px',
    'padding:6px 12px',
    'border:0',
    'border-radius:6px',
    'background:#111',
    'color:#fff',
    'cursor:pointer',
  ].join(';');
  cta.addEventListener('click', () => openClick(ad));

  const dismiss = document.createElement('button');
  dismiss.textContent = '✕';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.style.cssText = [
    'font-size:12px',
    'padding:4px 8px',
    'border:0',
    'background:transparent',
    'color:#888',
    'cursor:pointer',
  ].join(';');
  dismiss.addEventListener('click', () => root.remove());

  ctaRow.appendChild(cta);
  ctaRow.appendChild(dismiss);
  root.appendChild(ctaRow);

  document.body.appendChild(root);

  observeImpression(root, ad, { sessionId });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    render().catch(() => {});
  });
} else {
  render().catch(() => {});
}

// Auto-mount the 5 secondary placements (citation, chip, card, loading,
// onboarding). Per Publisher Agreement §4.1 these run by default; publishers
// suppress individual ones with data-lumi-disable="<placement>".
try { startAutoMount(); } catch (_e) { /* silent */ }
