'use strict';

const fs = require('fs').promises;
const os = require('os');

const SCRIPT_SRC_PREFIX = 'https://boostboss.ai/lumi/v1.js';
const SCRIPT_MARKER_ATTR = 'data-lumi-install="desktop"';
// data-lumi-door tells the shared CDN runtime which door key to send
// to /api/lumi-fetch + /api/track so the publisher's "Computer App"
// verify badge flips (not the shared Browser App badge). Also gates
// the desktop-specific placement renderers (window banner, system
// notification, modal interstitial, sidebar slot, empty-state hero
// with native sound) in the runtime.
const DOOR_ATTR = 'data-lumi-door="mcp"';

/**
 * Build the script tag we inject.
 */
function buildScriptTag(publisherId) {
  return `<script async src="${SCRIPT_SRC_PREFIX}#${publisherId}" ${SCRIPT_MARKER_ATTR} ${DOOR_ATTR}></script>`;
}

/**
 * Build the marker we use to detect an existing install. We don't lock to a
 * specific publisherId so that re-running install detects ANY prior install,
 * not just an exact match — that's the safer idempotency check.
 */
const EXISTING_INSTALL_RE = new RegExp(
  `<script[^>]*\\b${SCRIPT_MARKER_ATTR.replace(/"/g, '"')}[^>]*>\\s*</script>`,
  'i'
);

/**
 * Insert the Lumi script tag just before </head> in the given HTML file.
 * Returns { alreadyInstalled, marker, eol }.
 */
async function patchElectronHtml(htmlPath, publisherId) {
  const original = await fs.readFile(htmlPath, 'utf8');

  if (EXISTING_INSTALL_RE.test(original)) {
    return { alreadyInstalled: true, marker: null };
  }

  const headCloseRe = /<\/head>/i;
  if (!headCloseRe.test(original)) {
    throw new Error(
      `No </head> tag found in ${htmlPath}. ` +
      'Lumi needs a renderer HTML file with a <head>...</head> section.'
    );
  }

  const eol = detectEol(original);
  const tag = buildScriptTag(publisherId);
  const indent = '    ';
  const insertion = `${indent}${tag}${eol}  `;

  const patched = original.replace(headCloseRe, `${insertion}</head>`);

  await fs.writeFile(htmlPath, patched, 'utf8');

  return {
    alreadyInstalled: false,
    marker: tag,
    eol,
  };
}

/**
 * Reverse a previous patch by removing the line containing the marker.
 * We remove the whole line (and its trailing newline) so the file ends up
 * byte-for-byte close to original.
 */
async function unpatchElectronHtml(htmlPath, _marker) {
  const original = await fs.readFile(htmlPath, 'utf8');

  // Remove any line that contains a script tag with our marker attr.
  // Match optional leading whitespace, the tag, and the trailing newline.
  const lineRe = new RegExp(
    `[ \\t]*<script[^>]*\\b${SCRIPT_MARKER_ATTR.replace(/"/g, '"')}[^>]*>\\s*</script>[ \\t]*\\r?\\n?`,
    'gi'
  );

  const patched = original.replace(lineRe, '');

  if (patched === original) {
    // Nothing to remove — already clean.
    return { changed: false };
  }

  await fs.writeFile(htmlPath, patched, 'utf8');
  return { changed: true };
}

function detectEol(s) {
  if (s.indexOf('\r\n') !== -1) return '\r\n';
  if (s.indexOf('\n') !== -1) return '\n';
  return os.EOL;
}

module.exports = {
  patchElectronHtml,
  unpatchElectronHtml,
  buildScriptTag,
};
