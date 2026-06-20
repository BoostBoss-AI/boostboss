#!/usr/bin/env node
'use strict';

/**
 * @boostbossai/install-desktop
 *
 * One-command installer for Lumi for Computer App.
 *
 *   npx @boostbossai/install-desktop pub_a8x2k9f9
 *   npx @boostbossai/install-desktop --uninstall
 *
 * Zero dependencies. Node 18+. Cross-platform.
 */

const path = require('path');
const process = require('process');

const { detectProjectType, findRendererHtml } = require('../lib/detect.js');
const { patchElectronHtml, unpatchElectronHtml } = require('../lib/patch-electron.js');
const { writeInstallLog, readInstallLog, deleteInstallLog } = require('../lib/log.js');
const banner = require('../lib/banner.js');

const PUBLISHER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{4,}$/;
const DOCS_URL = 'https://boostboss.ai/docs/computer';
const DASHBOARD_URL = 'https://boostboss.ai/publish/dashboard';

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
        'Usage: npx @boostbossai/install-desktop <publisherId>',
        'Find your publisher ID at https://boostboss.ai/publish/dashboard',
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

  // 1. Detect project type.
  let detection;
  try {
    detection = await detectProjectType(cwd);
  } catch (err) {
    banner.error(
      'Could not read ./package.json in this directory.',
      [
        'Run this command from the root of your Electron or Tauri project.',
        `See ${DOCS_URL} for help.`,
      ]
    );
    process.exit(1);
  }

  if (detection.type === 'unknown') {
    banner.error(
      "This doesn't look like an Electron or Tauri project.",
      [
        'Lumi for Computer App requires one of those.',
        `See ${DOCS_URL} for help.`,
      ]
    );
    process.exit(1);
  }

  if (detection.type === 'tauri') {
    banner.info(
      'Detected a Tauri project.',
      [
        'Tauri integration coming v1.3.',
        'For now, manually paste the script tag into your renderer HTML —',
        `see ${DOCS_URL}#tauri`,
      ]
    );
    process.exit(0);
  }

  // 2. Electron: find renderer HTML.
  let rendererPath;
  try {
    rendererPath = await findRendererHtml(cwd);
  } catch (err) {
    banner.error(
      'Could not find a renderer HTML file.',
      [
        'Lumi needs to inject a <script> tag into the <head> of your',
        'renderer HTML (the one loaded by BrowserWindow.loadFile or loadURL).',
        '',
        `Pass --html <path> or see ${DOCS_URL}#html for help.`,
      ]
    );
    process.exit(1);
  }

  // 3. Patch.
  let patchResult;
  try {
    patchResult = await patchElectronHtml(rendererPath, publisherId);
  } catch (err) {
    banner.error(
      `Failed to patch ${path.relative(cwd, rendererPath)}.`,
      [
        err && err.message ? err.message : String(err),
        `See ${DOCS_URL} for help.`,
      ]
    );
    process.exit(1);
  }

  if (patchResult.alreadyInstalled) {
    banner.info(
      `Lumi is already installed in ${path.relative(cwd, rendererPath)}.`,
      [
        'No changes made. Your existing install is good to go.',
        `To uninstall: npx @boostbossai/install-desktop --uninstall`,
      ]
    );
    process.exit(0);
  }

  // 4. Write log.
  try {
    await writeInstallLog(cwd, {
      publisherId,
      door: 'computer-app',
      patches: [
        {
          file: path.relative(cwd, rendererPath),
          action: 'insert-script',
          marker: patchResult.marker,
        },
      ],
    });
  } catch (err) {
    banner.error(
      'Patched your HTML but could not write .lumi-install-log.',
      [
        'Uninstall will need to be done manually. Sorry.',
        err && err.message ? err.message : String(err),
      ]
    );
    // Don't exit 1 — the install itself worked.
  }

  // 5. Success banner.
  banner.installSuccess({
    framework: 'Electron',
    frameworkVersion: detection.version,
    patchedFile: path.relative(cwd, rendererPath),
    publisherId,
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

  for (const patch of log.patches || []) {
    const fullPath = path.join(cwd, patch.file);
    try {
      if (patch.action === 'insert-script') {
        await unpatchElectronHtml(fullPath, patch.marker);
        reversed.push(patch.file);
      } else {
        failed.push({ file: patch.file, reason: `unknown action: ${patch.action}` });
      }
    } catch (err) {
      failed.push({
        file: patch.file,
        reason: err && err.message ? err.message : String(err),
      });
    }
  }

  try {
    await deleteInstallLog(cwd);
  } catch (_e) {
    // Non-fatal.
  }

  banner.uninstallSuccess({ reversed, failed });
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  banner.error(
    'Unexpected error.',
    [err && err.stack ? err.stack : String(err)]
  );
  process.exit(1);
});
