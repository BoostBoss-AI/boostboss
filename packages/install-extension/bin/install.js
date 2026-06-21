#!/usr/bin/env node
'use strict';

/**
 * @boostbossai/install-extension
 *
 * One-command installer for Lumi for Browser Extension App (Chrome MV3).
 *
 *   npx @boostbossai/install-extension pub_a8x2k9f9
 *   npx @boostbossai/install-extension --uninstall
 *
 * Zero dependencies. Node 18+. Cross-platform.
 */

const path = require('path');
const process = require('process');

const { detectManifest } = require('../lib/detect.js');
const { npmInstallRuntime, npmUninstallRuntime } = require('../lib/npm.js');
const {
  patchManifest,
  unpatchManifest,
} = require('../lib/patch-manifest.js');
const {
  patchServiceWorker,
  unpatchServiceWorker,
} = require('../lib/patch-sw.js');
const { patchHtml, unpatchHtml } = require('../lib/patch-html.js');
const { writeInstallLog, readInstallLog, deleteInstallLog } = require('../lib/log.js');
const banner = require('../lib/banner.js');

const PUBLISHER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{4,}$/;
const DOCS_URL = 'https://boostboss.ai/docs/extension';
const DASHBOARD_URL = 'https://boostboss.ai/publish/dashboard';
const RUNTIME_PKG = '@boostbossai/lumi-extension';
const RUNTIME_VERSION = '0.2.0';

// Map surfaces → (manifest key path, runtime js file).
const SURFACES = [
  {
    name: 'popup',
    manifestPath: ['action', 'default_popup'],
    runtimeFile: 'popup.js',
  },
  {
    name: 'sidepanel',
    manifestPath: ['side_panel', 'default_path'],
    runtimeFile: 'sidepanel.js',
  },
  {
    name: 'newtab',
    manifestPath: ['chrome_url_overrides', 'newtab'],
    runtimeFile: 'newtab.js',
  },
];

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--uninstall') || argv.includes('-u')) {
    return uninstall();
  }

  if (argv.includes('--help') || argv.includes('-h')) {
    banner.help();
    process.exit(0);
  }

  const publisherId = argv[0];

  if (!publisherId) {
    banner.error(
      'Missing publisher ID.',
      [
        'Usage: npx @boostbossai/install-extension <publisherId>',
        `Find your publisher ID at ${DASHBOARD_URL}`,
      ]
    );
    process.exit(1);
  }

  if (!PUBLISHER_ID_RE.test(publisherId)) {
    banner.error(
      `Publisher ID "${publisherId}" looks malformed.`,
      [
        'It should be 5+ characters, start with a letter or digit,',
        'and contain only letters, digits, underscores, dots, or hyphens.',
        `Find yours at ${DASHBOARD_URL}`,
      ]
    );
    process.exit(1);
  }

  return install(publisherId);
}

async function install(publisherId) {
  const cwd = process.cwd();

  // 1. Detect MV3 manifest.
  let detection;
  try {
    detection = await detectManifest(cwd);
  } catch (err) {
    banner.error(
      'Could not read ./manifest.json in this directory.',
      [
        'Run this command from the root of your Chrome extension.',
        `See ${DOCS_URL} for help.`,
        err && err.message ? err.message : String(err),
      ]
    );
    process.exit(1);
  }

  if (detection.manifest_version === 2) {
    banner.error(
      'Lumi for Browser Extension App requires Manifest V3.',
      [
        'Chrome Web Store has been MV3-only since 2024.',
        'Migrate first → https://developer.chrome.com/docs/extensions/migrating/',
      ]
    );
    process.exit(1);
  }

  if (detection.manifest_version !== 3) {
    banner.error(
      `Unsupported manifest_version: ${detection.manifest_version}.`,
      [
        'Lumi for Browser Extension App requires Manifest V3.',
        'Migrate first → https://developer.chrome.com/docs/extensions/migrating/',
      ]
    );
    process.exit(1);
  }

  const manifest = detection.manifest;
  const manifestPath = detection.manifestPath;

  // 2. Install runtime SDK from npm.
  process.stdout.write(`  Installing ${RUNTIME_PKG}...\n`);
  try {
    await npmInstallRuntime(cwd, `${RUNTIME_PKG}@${RUNTIME_VERSION}`);
  } catch (err) {
    banner.error(
      `Failed to install ${RUNTIME_PKG}.`,
      [
        'Make sure npm is installed and you have a package.json (or one will be created).',
        err && err.message ? err.message : String(err),
      ]
    );
    process.exit(1);
  }

  const patches = [];
  const patchedSummary = {
    manifestPermAdded: false,
    manifestHostAdded: false,
    serviceWorker: null,
    surfaces: [], // {name, file}
  };

  // 3. Patch manifest.json — add permissions + host_permissions.
  let manifestPatchResult;
  try {
    manifestPatchResult = await patchManifest(manifestPath);
  } catch (err) {
    banner.error(
      `Failed to patch ${path.relative(cwd, manifestPath)}.`,
      [
        err && err.message ? err.message : String(err),
        `See ${DOCS_URL} for help.`,
      ]
    );
    process.exit(1);
  }

  if (manifestPatchResult.addedStoragePerm) {
    patches.push({
      file: path.relative(cwd, manifestPath),
      action: 'add-permission',
      value: 'storage',
    });
    patchedSummary.manifestPermAdded = true;
  }
  if (manifestPatchResult.addedHost) {
    patches.push({
      file: path.relative(cwd, manifestPath),
      action: 'add-host',
      value: 'https://boostboss.ai/*',
    });
    patchedSummary.manifestHostAdded = true;
  }

  // 4. Patch service worker if declared.
  const swRelPath =
    manifest.background && typeof manifest.background.service_worker === 'string'
      ? manifest.background.service_worker
      : null;

  if (swRelPath) {
    const swAbsPath = path.join(cwd, swRelPath);
    const swType =
      manifest.background.type === 'module' ? 'module' : 'classic';
    try {
      const result = await patchServiceWorker(swAbsPath, publisherId, swType);
      if (result.alreadyPatched) {
        patchedSummary.serviceWorker = { file: swRelPath, alreadyPatched: true };
      } else {
        patches.push({
          file: swRelPath,
          action: 'prepend-lines',
          lineCount: result.lineCount,
          marker: '@boostbossai/install-extension',
          swType,
        });
        patchedSummary.serviceWorker = { file: swRelPath, alreadyPatched: false };
      }
    } catch (err) {
      banner.error(
        `Failed to patch service worker ${swRelPath}.`,
        [err && err.message ? err.message : String(err)]
      );
      process.exit(1);
    }
  }

  // 5. Patch HTML surfaces (popup, sidepanel, newtab).
  for (const surface of SURFACES) {
    const relHtml = getDeep(manifest, surface.manifestPath);
    if (!relHtml || typeof relHtml !== 'string') continue;

    const htmlAbs = path.join(cwd, relHtml);
    const scriptSrc = `./node_modules/${RUNTIME_PKG}/dist/${surface.runtimeFile}`;
    try {
      const result = await patchHtml(htmlAbs, scriptSrc);
      if (result.alreadyPatched) {
        patchedSummary.surfaces.push({
          name: surface.name,
          file: relHtml,
          alreadyPatched: true,
        });
      } else {
        patches.push({
          file: relHtml,
          action: 'insert-script-before-body-close',
          marker: scriptSrc,
        });
        patchedSummary.surfaces.push({
          name: surface.name,
          file: relHtml,
          alreadyPatched: false,
        });
      }
    } catch (err) {
      banner.error(
        `Failed to patch ${surface.name} HTML (${relHtml}).`,
        [err && err.message ? err.message : String(err)]
      );
      process.exit(1);
    }
  }

  // 6. Write install log.
  try {
    await writeInstallLog(cwd, {
      publisherId,
      door: 'browser-extension-app',
      patches,
    });
  } catch (err) {
    banner.error(
      'Patched everything but could not write .lumi-install-log.',
      [
        'Uninstall will need to be done manually. Sorry.',
        err && err.message ? err.message : String(err),
      ]
    );
    // Don't exit — the install itself worked.
  }

  // 7. Success banner.
  banner.installSuccess({
    publisherId,
    runtimeVersion: RUNTIME_VERSION,
    manifestPermAdded: patchedSummary.manifestPermAdded,
    manifestHostAdded: patchedSummary.manifestHostAdded,
    serviceWorker: patchedSummary.serviceWorker,
    surfaces: patchedSummary.surfaces,
  });
}

async function uninstall() {
  const cwd = process.cwd();

  let log;
  try {
    log = await readInstallLog(cwd);
  } catch (err) {
    banner.error(
      'No .lumi-install-log found in this directory.',
      [
        'Either Lumi was never installed here,',
        "or you're in the wrong directory.",
        `See ${DOCS_URL}#uninstall for manual removal steps.`,
      ]
    );
    process.exit(1);
  }

  const reversed = [];
  const failed = [];

  // Reverse patches in reverse order — HTML/SW patches first, then manifest perms.
  const patches = (log.patches || []).slice().reverse();

  for (const patch of patches) {
    const fullPath = path.join(cwd, patch.file);
    try {
      if (patch.action === 'add-permission') {
        await unpatchManifest(fullPath, {
          removePerm: patch.value,
        });
        reversed.push(`${patch.file} (permission: ${patch.value})`);
      } else if (patch.action === 'add-host') {
        await unpatchManifest(fullPath, {
          removeHost: patch.value,
        });
        reversed.push(`${patch.file} (host: ${patch.value})`);
      } else if (patch.action === 'prepend-lines') {
        await unpatchServiceWorker(fullPath);
        reversed.push(patch.file);
      } else if (patch.action === 'insert-script-before-body-close') {
        await unpatchHtml(fullPath, patch.marker);
        reversed.push(patch.file);
      } else {
        failed.push({
          file: patch.file,
          reason: `unknown action: ${patch.action}`,
        });
      }
    } catch (err) {
      failed.push({
        file: patch.file,
        reason: err && err.message ? err.message : String(err),
      });
    }
  }

  // Uninstall the runtime npm package.
  process.stdout.write(`  Uninstalling ${RUNTIME_PKG}...\n`);
  try {
    await npmUninstallRuntime(cwd, RUNTIME_PKG);
  } catch (err) {
    failed.push({
      file: 'node_modules',
      reason: `npm uninstall failed: ${err && err.message ? err.message : String(err)}`,
    });
  }

  try {
    await deleteInstallLog(cwd);
  } catch (_e) {
    // Non-fatal.
  }

  banner.uninstallSuccess({ reversed, failed });
  if (failed.length > 0) process.exit(1);
}

function getDeep(obj, keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

main().catch((err) => {
  banner.error(
    'Unexpected error.',
    [err && err.stack ? err.stack : String(err)]
  );
  process.exit(1);
});
