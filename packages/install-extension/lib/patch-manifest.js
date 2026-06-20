'use strict';

const fs = require('fs').promises;

const STORAGE_PERM = 'storage';
const BB_HOST = 'https://boostboss.ai/*';

/**
 * Add "storage" to permissions[] and "https://boostboss.ai/*" to
 * host_permissions[] in the manifest.json at manifestPath. Idempotent.
 *
 * Returns { addedStoragePerm, addedHost }.
 */
async function patchManifest(manifestPath) {
  const raw = await fs.readFile(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    throw new Error(`manifest.json is not valid JSON: ${err.message}`);
  }

  const indent = detectJsonIndent(raw);
  const trailingNl = raw.endsWith('\n');

  let addedStoragePerm = false;
  let addedHost = false;

  if (!Array.isArray(manifest.permissions)) {
    manifest.permissions = [];
  }
  if (!manifest.permissions.includes(STORAGE_PERM)) {
    manifest.permissions.push(STORAGE_PERM);
    addedStoragePerm = true;
  }

  if (!Array.isArray(manifest.host_permissions)) {
    manifest.host_permissions = [];
  }
  if (!manifest.host_permissions.includes(BB_HOST)) {
    manifest.host_permissions.push(BB_HOST);
    addedHost = true;
  }

  if (addedStoragePerm || addedHost) {
    const out = JSON.stringify(manifest, null, indent) + (trailingNl ? '\n' : '');
    await fs.writeFile(manifestPath, out, 'utf8');
  }

  return { addedStoragePerm, addedHost };
}

/**
 * Remove an entry we added previously. Idempotent.
 * opts: { removePerm?: string, removeHost?: string }
 */
async function unpatchManifest(manifestPath, opts) {
  const raw = await fs.readFile(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    throw new Error(`manifest.json is not valid JSON: ${err.message}`);
  }

  const indent = detectJsonIndent(raw);
  const trailingNl = raw.endsWith('\n');
  let changed = false;

  if (opts.removePerm && Array.isArray(manifest.permissions)) {
    const before = manifest.permissions.length;
    manifest.permissions = manifest.permissions.filter(
      (p) => p !== opts.removePerm
    );
    if (manifest.permissions.length !== before) changed = true;
    if (manifest.permissions.length === 0) delete manifest.permissions;
  }

  if (opts.removeHost && Array.isArray(manifest.host_permissions)) {
    const before = manifest.host_permissions.length;
    manifest.host_permissions = manifest.host_permissions.filter(
      (h) => h !== opts.removeHost
    );
    if (manifest.host_permissions.length !== before) changed = true;
    if (manifest.host_permissions.length === 0) delete manifest.host_permissions;
  }

  if (changed) {
    const out = JSON.stringify(manifest, null, indent) + (trailingNl ? '\n' : '');
    await fs.writeFile(manifestPath, out, 'utf8');
  }

  return { changed };
}

/**
 * Best-effort detection of JSON indentation. Defaults to 2.
 */
function detectJsonIndent(raw) {
  const m = raw.match(/\n([ \t]+)"/);
  if (!m) return 2;
  const ws = m[1];
  if (ws[0] === '\t') return '\t';
  return ws.length;
}

module.exports = {
  patchManifest,
  unpatchManifest,
};
