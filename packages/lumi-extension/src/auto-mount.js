// @boostbossai/lumi-extension — auto-mount observer
//
// Heuristic auto-placement for the 5 secondary placements (citation, chip,
// card, loading, onboarding). Mirrors the Browser App's 3-tier strategy:
//   Tier 1 — explicit publisher slot marker wins:
//              <div data-lumi-slot="citation"></div>
//   Tier 2 — heuristic detection of common UI patterns
//   Tier 3 — safe default fallback (free-floating container appended to body)
//
// Honors per-placement opt-out:
//   <div data-lumi-disable="citation"></div>  // suppress one
//   <div data-lumi-disable="all"></div>       // suppress all auto-mounts
//
// Onboarding fires once per install via chrome.storage.local seen flag.

import { LumiCitation } from './citation.js';
import { LumiChip } from './chip.js';
import { LumiCard } from './card.js';
import { LumiLoading } from './loading.js';
import { LumiOnboarding } from './onboarding.js';

const ONBOARDING_SEEN_KEY = 'lumi_onboarding_seen';
const SECONDARY_PLACEMENTS = ['citation', 'chip', 'card', 'loading'];

// Risky containers we never auto-inject into. Mirror the Browser App rule.
const RISKY_SELECTORS = [
  'pre', 'code', '[contenteditable="true"]',
  'input', 'textarea', 'select',
  '[role="alert"]', '[role="status"]',
  '.system-message', '[data-system]',
  '.code-block', '.codeblock', '.monaco-editor', '.CodeMirror',
  'header', 'nav', '[role="banner"], [role="navigation"]',
  '[data-lumi-placement]',
];

function isInsideRiskyContainer(el) {
  if (!el || typeof el.closest !== 'function') return false;
  return RISKY_SELECTORS.some((sel) => {
    try { return !!el.closest(sel); } catch (_e) { return false; }
  });
}

function disabled(placement) {
  return !!document.querySelector(
    `[data-lumi-disable="${placement}"], [data-lumi-disable="all"]`
  );
}

function explicitSlot(placement) {
  const el = document.querySelector(`[data-lumi-slot="${placement}"]`);
  if (!el || el.__lumiFilled) return null;
  if (isInsideRiskyContainer(el)) return null;
  return el;
}

// Heuristic detection — common UI patterns in extension surfaces.
function findAIResponseContainer() {
  const candidates = [
    '[data-role="assistant"]:last-of-type',
    '.message.assistant:last-of-type',
    '.ai-response:last-of-type',
    '[data-message-author-role="assistant"]:last-of-type',
    '.chat-message[data-role="ai"]:last-of-type',
    '[data-author="ai"]:last-of-type',
    '.assistant-message:last-of-type',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && !isInsideRiskyContainer(el)) return el;
  }
  return null;
}

function findSuggestionContainer() {
  const candidates = [
    '[data-suggestions]',
    '.suggested-actions',
    '.quick-replies',
    '.suggestion-chips',
    '[role="toolbar"][aria-label*="suggest" i]',
    '.chips-row',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && !isInsideRiskyContainer(el)) return el;
  }
  return null;
}

function findFeedContainer() {
  const candidates = [
    '[data-feed]', '[data-results]',
    '.feed', '.results-list', '.list-feed',
    '[role="feed"]', '[role="list"]',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && !isInsideRiskyContainer(el)) return el;
  }
  return null;
}

function findLoadingTarget() {
  // Loading-state ad replaces / sits beside a spinner.
  const candidates = [
    '[data-loading="true"]',
    '.loading:not(:empty)', '.spinner',
    '[aria-busy="true"]',
    '[role="progressbar"]',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && !isInsideRiskyContainer(el)) return el;
  }
  return null;
}

// Tier 3 — safe default: free-floating container appended to body.
function safeDefaultContainer(placement) {
  const id = `lumi-safe-${placement}`;
  let host = document.getElementById(id);
  if (host) return host;
  host = document.createElement('div');
  host.id = id;
  host.setAttribute('data-lumi-safe-default', placement);
  // Bottom-anchored, low-profile; placement modules paint their own visual.
  host.style.cssText = [
    'position: fixed',
    'left: 0', 'right: 0', 'bottom: 0',
    'z-index: 2147483640',
    'pointer-events: auto',
  ].join(';');
  document.body.appendChild(host);
  return host;
}

const __mounted = Object.create(null);

async function tryMount(placement) {
  if (__mounted[placement]) return;
  if (disabled(placement)) return;

  let target = explicitSlot(placement);
  if (!target) {
    if (placement === 'citation') target = findAIResponseContainer();
    else if (placement === 'chip') target = findSuggestionContainer() || findAIResponseContainer();
    else if (placement === 'card') target = findFeedContainer();
    else if (placement === 'loading') target = findLoadingTarget();
  }
  if (!target) target = safeDefaultContainer(placement);
  if (!target) return;

  const mountFn = {
    citation: LumiCitation.mount.bind(LumiCitation),
    chip: LumiChip.mount.bind(LumiChip),
    card: LumiCard.mount.bind(LumiCard),
    loading: LumiLoading.mount.bind(LumiLoading),
  }[placement];
  if (!mountFn) return;

  try {
    const node = await mountFn({ container: target });
    if (node) {
      __mounted[placement] = true;
      if (target.__lumiFilled !== undefined) target.__lumiFilled = true;
    }
  } catch (_e) { /* silent */ }
}

async function fireOnboardingOnce() {
  if (disabled('onboarding')) return;
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
  try {
    const got = await chrome.storage.local.get(ONBOARDING_SEEN_KEY);
    if (got && got[ONBOARDING_SEEN_KEY]) return;
    const target = explicitSlot('onboarding') || safeDefaultContainer('onboarding');
    const node = await LumiOnboarding.mount({ container: target });
    if (node) {
      await chrome.storage.local.set({ [ONBOARDING_SEEN_KEY]: Date.now() });
    }
  } catch (_e) { /* silent */ }
}

let __observer = null;
let __scheduled = false;

function scheduleScan() {
  if (__scheduled) return;
  __scheduled = true;
  // Defer to next frame to coalesce mutation bursts.
  (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16))(async () => {
    __scheduled = false;
    for (const p of SECONDARY_PLACEMENTS) {
      if (!__mounted[p]) await tryMount(p);
    }
  });
}

/**
 * Start auto-mount inside the current surface (popup, sidepanel, or newtab).
 * Idempotent — safe to call multiple times.
 */
export function startAutoMount() {
  if (__observer) return;
  // Initial scan after DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scheduleScan();
      fireOnboardingOnce().catch(() => {});
    });
  } else {
    scheduleScan();
    fireOnboardingOnce().catch(() => {});
  }
  // SPA support — watch for late-injected containers.
  if (typeof MutationObserver !== 'undefined' && document.body) {
    __observer = new MutationObserver(() => scheduleScan());
    __observer.observe(document.body, { childList: true, subtree: true });
  }
}

/** Stop the observer — used by tests / hot-reload. */
export function stopAutoMount() {
  if (__observer) {
    __observer.disconnect();
    __observer = null;
  }
}

export default { startAutoMount, stopAutoMount };
