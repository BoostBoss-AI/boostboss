// @boostbossai/lumi-extension — install onboarding renderer
//
// One-time sponsored card during post-install flow. Persisted via
// chrome.storage.local so it fires exactly once per install.
//
// Shape:
//   LumiOnboarding.mount({ publisherId, container, contextHint })
//
// Visual: large hero card with welcome headline, sponsor disclosure,
// optional image, body, and CTA.

import {
  PLACEMENTS,
  fetchAd,
  observeImpression,
  openClick,
  getSessionId,
  getActiveTabUrl,
} from './shared.js';

const PUB_KEY = 'lumi_publisher_id';
const ONBOARDING_FLAG = 'lumi_onboarding_shown';

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

async function hasShown() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return false;
  try {
    const got = await chrome.storage.local.get(ONBOARDING_FLAG);
    return !!(got && got[ONBOARDING_FLAG]);
  } catch (_e) {
    return false;
  }
}

async function markShown() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
  try {
    await chrome.storage.local.set({ [ONBOARDING_FLAG]: true });
  } catch (_e) { /* silent */ }
}

export const LumiOnboarding = {
  async mount(opts = {}) {
    const { container, contextHint } = opts;
    const publisherId = await resolvePublisherId(opts.publisherId);
    if (!publisherId) return null;

    if (await hasShown()) return null;

    const sessionId = await getSessionId();
    const contextUrl = contextHint || (await getActiveTabUrl());
    const ad = await fetchAd({
      publisherId,
      placement: PLACEMENTS.ONBOARDING,
      contextUrl,
      sessionId,
    });
    if (!ad) return null;

    const host = container || document.body;
    if (!host) return null;

    const root = document.createElement('section');
    root.setAttribute('data-lumi-placement', 'onboarding');
    root.style.cssText = [
      'all: initial',
      'display: block',
      'box-sizing: border-box',
      'font-family: -apple-system, system-ui, sans-serif',
      'background: #fff',
      'border: 1px solid #E5E7EB',
      'border-radius: 14px',
      'padding: 24px',
      'margin: 16px auto',
      'max-width: 520px',
      'color: #0F0F1A',
      'box-shadow: 0 4px 16px rgba(15,15,26,0.06)',
    ].join(';');

    // Disclosure pill row
    const pillRow = document.createElement('div');
    pillRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:16px';

    const pill = document.createElement('span');
    pill.textContent = 'BB';
    pill.style.cssText = 'display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;background:#FF2D78;color:#fff';
    pillRow.appendChild(pill);

    const sponsored = document.createElement('span');
    sponsored.textContent = 'Sponsored welcome';
    sponsored.style.cssText = 'font-size:11px;color:#4B5563;text-transform:uppercase;letter-spacing:0.06em;font-weight:600';
    pillRow.appendChild(sponsored);

    root.appendChild(pillRow);

    if (ad.image_url) {
      const img = document.createElement('img');
      img.src = ad.image_url;
      img.alt = '';
      img.style.cssText = [
        'display:block',
        'width:100%',
        'max-height:200px',
        'object-fit:cover',
        'border-radius:10px',
        'margin-bottom:18px',
      ].join(';');
      root.appendChild(img);
    }

    const welcome = document.createElement('div');
    welcome.textContent = 'Welcome!';
    welcome.style.cssText = 'font-size:13px;color:#4B5563;font-weight:600;margin-bottom:6px';
    root.appendChild(welcome);

    const headline = document.createElement('h2');
    headline.textContent = ad.headline || '';
    headline.style.cssText = 'all:unset;display:block;font-family:-apple-system,system-ui,sans-serif;font-size:22px;font-weight:700;line-height:1.25;margin-bottom:10px;color:#0F0F1A';
    root.appendChild(headline);

    if (ad.body) {
      const body = document.createElement('p');
      body.textContent = ad.body;
      body.style.cssText = 'all:unset;display:block;font-family:-apple-system,system-ui,sans-serif;font-size:14px;line-height:1.5;color:#4B5563;margin-bottom:18px';
      root.appendChild(body);
    }

    const ctaRow = document.createElement('div');
    ctaRow.style.cssText = 'display:flex;align-items:center;gap:12px';

    const cta = document.createElement('button');
    cta.setAttribute('type', 'button');
    cta.textContent = ad.cta_label || ad.cta || 'Get started';
    cta.style.cssText = [
      'all: unset',
      'display:inline-block',
      'font-family: -apple-system, system-ui, sans-serif',
      'font-size:14px',
      'font-weight:600',
      'padding:10px 18px',
      'border-radius:8px',
      'background:#FF2D78',
      'color:#fff',
      'cursor:pointer',
      'text-align:center',
    ].join(';');
    cta.addEventListener('click', () => openClick(ad));
    ctaRow.appendChild(cta);

    const dismiss = document.createElement('button');
    dismiss.setAttribute('type', 'button');
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = 'Maybe later';
    dismiss.style.cssText = [
      'all: unset',
      'font-family: -apple-system, system-ui, sans-serif',
      'font-size:13px',
      'padding:8px 12px',
      'color:#4B5563',
      'cursor:pointer',
    ].join(';');
    dismiss.addEventListener('click', () => root.remove());
    ctaRow.appendChild(dismiss);

    root.appendChild(ctaRow);

    host.appendChild(root);

    // Persist the flag and fire impression on visibility. We set the
    // flag now (not after impression) so that even if the user closes
    // the popup before the impression beacon fires, the card won't
    // re-show on subsequent opens.
    markShown().catch(() => {});
    observeImpression(root, ad, { sessionId });
    return root;
  },
};

export default LumiOnboarding;
