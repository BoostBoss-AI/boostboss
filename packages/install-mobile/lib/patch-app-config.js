'use strict';

const fs = require('fs').promises;
const path = require('path');

const PLUGIN_NAME = '@boostbossai/lumi-mobile';

/**
 * Add the Lumi plugin to an Expo `app.json` or `app.config.js`. Idempotent.
 *
 * For `app.json` we do a real JSON edit. For `app.config.js` / `app.config.ts`
 * we only do a marker-comment insertion above module.exports, since safely
 * mutating arbitrary JS is out of scope for a zero-dep CLI.
 *
 * Returns { changed, mode } where mode is 'json' | 'js-comment' | 'unchanged'.
 */
async function patchAppConfig(configPath) {
  const base = path.basename(configPath);
  if (base === 'app.json') {
    return patchAppJson(configPath);
  }
  return patchAppConfigJs(configPath);
}

async function patchAppJson(configPath) {
  const raw = await fs.readFile(configPath, 'utf8');
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${path.basename(configPath)} is not valid JSON: ${err.message}`);
  }

  const indent = detectJsonIndent(raw);
  const trailingNl = raw.endsWith('\n');

  // Expo config keys can live at the root or under `expo`.
  const expoBlock = cfg.expo && typeof cfg.expo === 'object' ? cfg.expo : cfg;

  if (!Array.isArray(expoBlock.plugins)) {
    expoBlock.plugins = [];
  }

  const alreadyPresent = expoBlock.plugins.some((p) => {
    if (typeof p === 'string') return p === PLUGIN_NAME;
    if (Array.isArray(p) && typeof p[0] === 'string') return p[0] === PLUGIN_NAME;
    return false;
  });

  if (alreadyPresent) {
    return { changed: false, mode: 'unchanged' };
  }

  expoBlock.plugins.push(PLUGIN_NAME);

  const out = JSON.stringify(cfg, null, indent) + (trailingNl ? '\n' : '');
  await fs.writeFile(configPath, out, 'utf8');
  return { changed: true, mode: 'json' };
}

/**
 * For app.config.js / app.config.ts we drop a marker comment at the top of
 * the file directing the publisher to add the plugin entry by hand. We don't
 * try to mutate JS — too easy to break a TS file with a regex.
 */
async function patchAppConfigJs(configPath) {
  const raw = await fs.readFile(configPath, 'utf8');

  if (raw.includes(PLUGIN_NAME)) {
    return { changed: false, mode: 'unchanged' };
  }

  const marker = [
    `// ───── BEGIN @boostbossai/install-mobile ─────`,
    `// TODO: Add "${PLUGIN_NAME}" to the plugins array of this config, e.g.:`,
    `//   plugins: [ ... existing ..., "${PLUGIN_NAME}" ]`,
    `// ───── END @boostbossai/install-mobile ─────`,
    '',
  ].join('\n');

  const patched = marker + raw;
  await fs.writeFile(configPath, patched, 'utf8');
  return { changed: true, mode: 'js-comment' };
}

/**
 * Reverse the patch.
 */
async function unpatchAppConfig(configPath) {
  const base = path.basename(configPath);
  if (base === 'app.json') {
    return unpatchAppJson(configPath);
  }
  return unpatchAppConfigJs(configPath);
}

async function unpatchAppJson(configPath) {
  const raw = await fs.readFile(configPath, 'utf8');
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${path.basename(configPath)} is not valid JSON: ${err.message}`);
  }

  const indent = detectJsonIndent(raw);
  const trailingNl = raw.endsWith('\n');
  const expoBlock = cfg.expo && typeof cfg.expo === 'object' ? cfg.expo : cfg;

  if (!Array.isArray(expoBlock.plugins)) {
    return { changed: false };
  }

  const before = expoBlock.plugins.length;
  expoBlock.plugins = expoBlock.plugins.filter((p) => {
    if (typeof p === 'string') return p !== PLUGIN_NAME;
    if (Array.isArray(p) && typeof p[0] === 'string') return p[0] !== PLUGIN_NAME;
    return true;
  });

  if (expoBlock.plugins.length === before) {
    return { changed: false };
  }

  if (expoBlock.plugins.length === 0) {
    delete expoBlock.plugins;
  }

  const out = JSON.stringify(cfg, null, indent) + (trailingNl ? '\n' : '');
  await fs.writeFile(configPath, out, 'utf8');
  return { changed: true };
}

async function unpatchAppConfigJs(configPath) {
  const raw = await fs.readFile(configPath, 'utf8');
  const re =
    /\/\/ ─+ BEGIN @boostbossai\/install-mobile ─+[\s\S]*?\/\/ ─+ END @boostbossai\/install-mobile ─+\r?\n?/;
  const patched = raw.replace(re, '');
  if (patched === raw) {
    return { changed: false };
  }
  await fs.writeFile(configPath, patched, 'utf8');
  return { changed: true };
}

function detectJsonIndent(raw) {
  const m = raw.match(/\n([ \t]+)"/);
  if (!m) return 2;
  const ws = m[1];
  if (ws[0] === '\t') return '\t';
  return ws.length;
}

module.exports = {
  patchAppConfig,
  unpatchAppConfig,
  PLUGIN_NAME,
};
