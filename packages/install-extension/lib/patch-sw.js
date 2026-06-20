'use strict';

const fs = require('fs').promises;
const os = require('os');

const MARKER = '@boostbossai/install-extension';
const BEGIN = '// ───── BEGIN @boostbossai/install-extension ─────';
const END = '// ───── END @boostbossai/install-extension ─────';

/**
 * Prepend the LumiBackground init shim to the service worker file.
 *
 * - For ES module workers (manifest.background.type === 'module'), use
 *   `import` statements.
 * - For classic workers, use `importScripts` to load the bundled UMD-ish file.
 *
 * Idempotent: re-runs detect the marker and skip.
 *
 * Returns { alreadyPatched, lineCount }.
 */
async function patchServiceWorker(swPath, publisherId, swType) {
  let original;
  try {
    original = await fs.readFile(swPath, 'utf8');
  } catch (err) {
    throw new Error(
      `Could not read service worker file at ${swPath}: ${err.message}`
    );
  }

  if (original.includes(MARKER)) {
    return { alreadyPatched: true, lineCount: 0 };
  }

  const eol = detectEol(original);
  const block = buildBlock(publisherId, swType, eol);
  const lineCount = block.split(eol).length;

  const patched = block + eol + original;
  await fs.writeFile(swPath, patched, 'utf8');

  return { alreadyPatched: false, lineCount };
}

/**
 * Reverse the patch by stripping the leading BEGIN..END block.
 */
async function unpatchServiceWorker(swPath) {
  const original = await fs.readFile(swPath, 'utf8');
  if (!original.includes(MARKER)) {
    return { changed: false };
  }
  // Match leading block + a single trailing newline (any flavor).
  const re = new RegExp(
    `^${escapeRe(BEGIN)}[\\s\\S]*?${escapeRe(END)}\\r?\\n?`,
    ''
  );
  const patched = original.replace(re, '');
  if (patched === original) {
    // Marker is present but our wrapper isn't — bail loudly.
    throw new Error(
      `Service worker contains a Lumi marker but no removable block. ` +
      `Edit ${swPath} by hand.`
    );
  }
  await fs.writeFile(swPath, patched, 'utf8');
  return { changed: true };
}

function buildBlock(publisherId, swType, eol) {
  const header = [
    BEGIN,
    `// Added by @boostbossai/install-extension — do not edit by hand.`,
    `// To uninstall: npx @boostbossai/install-extension --uninstall`,
  ];

  let body;
  if (swType === 'module') {
    body = [
      `import { LumiBackground } from '@boostbossai/lumi-extension';`,
      `LumiBackground.init({ publisherId: '${publisherId}' });`,
    ];
  } else {
    // Classic worker — load the runtime via importScripts. The runtime ships
    // a classic build at dist/background.classic.js that exposes self.LumiBackground.
    body = [
      `importScripts('./node_modules/@boostbossai/lumi-extension/dist/background.classic.js');`,
      `self.LumiBackground.init({ publisherId: '${publisherId}' });`,
    ];
  }

  return [...header, ...body, END].join(eol);
}

function detectEol(s) {
  if (s.indexOf('\r\n') !== -1) return '\r\n';
  if (s.indexOf('\n') !== -1) return '\n';
  return os.EOL;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  patchServiceWorker,
  unpatchServiceWorker,
  MARKER,
};
