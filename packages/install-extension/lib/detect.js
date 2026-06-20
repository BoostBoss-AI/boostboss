'use strict';

const fs = require('fs').promises;
const path = require('path');

/**
 * Detect a Chrome MV3 extension at cwd.
 *
 * Returns { manifestPath, manifest, manifest_version }.
 * Throws if manifest.json doesn't exist or isn't parseable.
 */
async function detectManifest(cwd) {
  const manifestPath = path.join(cwd, 'manifest.json');

  let raw;
  try {
    raw = await fs.readFile(manifestPath, 'utf8');
  } catch (err) {
    const e = new Error(
      `No manifest.json found at ${manifestPath}. ` +
      'Run this command from the root of your Chrome extension.'
    );
    e.cause = err;
    throw e;
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    const e = new Error(`manifest.json is not valid JSON: ${err.message}`);
    e.cause = err;
    throw e;
  }

  if (!manifest || typeof manifest !== 'object') {
    throw new Error('manifest.json did not parse to a JSON object.');
  }

  return {
    manifestPath,
    manifest,
    manifest_version: manifest.manifest_version,
  };
}

module.exports = {
  detectManifest,
};
