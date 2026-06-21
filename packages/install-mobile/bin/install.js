#!/usr/bin/env node
'use strict';

/**
 * @boostbossai/install-mobile
 *
 * One-command installer for Lumi for Mobile App (Expo + bare React Native).
 *
 *   npx @boostbossai/install-mobile pub_a8x2k9f9
 *   npx @boostbossai/install-mobile --uninstall
 *
 * Zero dependencies. Node 18+. Cross-platform (with pod-install gated to Mac).
 */

const path = require('path');
const process = require('process');

const {
  detectProjectType,
  findRootComponent,
  findExpoConfig,
} = require('../lib/detect.js');
const {
  npmInstallRuntime,
  npmUninstallRuntime,
  podInstall,
} = require('../lib/npm.js');
const {
  patchAppConfig,
  unpatchAppConfig,
} = require('../lib/patch-app-config.js');
const {
  patchRootComponent,
  unpatchRootComponent,
} = require('../lib/patch-root-component.js');
const {
  writeInstallLog,
  readInstallLog,
  deleteInstallLog,
} = require('../lib/log.js');
const banner = require('../lib/banner.js');

const PUBLISHER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{4,}$/;
const DOCS_URL = 'https://boostboss.ai/docs/mobile';
const DASHBOARD_URL = 'https://boostboss.ai/publish/dashboard';
const RUNTIME_PKG = '@boostbossai/lumi-mobile';
const RUNTIME_VERSION = '0.2.0';
const RUNTIME_SPEC_RECORDED = `${RUNTIME_PKG}@^${RUNTIME_VERSION}`;

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
        'Usage: npx @boostbossai/install-mobile <publisherId>',
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

  // 1. Detect project type.
  let detection;
  try {
    detection = await detectProjectType(cwd);
  } catch (err) {
    banner.error(
      'Could not read ./package.json in this directory.',
      [
        'Run this command from the root of your React Native project.',
        `See ${DOCS_URL} for help.`,
        err && err.message ? err.message : String(err),
      ]
    );
    process.exit(1);
  }

  if (detection.type === 'unknown') {
    banner.error(
      "This doesn't look like a React Native project.",
      [
        'Lumi for Mobile App requires Expo or bare React Native.',
        `See ${DOCS_URL} for help.`,
      ]
    );
    process.exit(1);
  }

  const projectType = detection.type; // 'expo' | 'bare-rn'
  const detectedLabel = buildDetectedLabel(detection);

  // 2. Install the runtime SDK from npm.
  process.stdout.write(`  Installing ${RUNTIME_PKG}...\n`);
  try {
    await npmInstallRuntime(cwd, `${RUNTIME_PKG}@${RUNTIME_VERSION}`);
  } catch (err) {
    banner.error(
      `Failed to install ${RUNTIME_PKG}.`,
      [
        'Make sure npm is on PATH and your package.json is in this directory.',
        err && err.message ? err.message : String(err),
      ]
    );
    process.exit(1);
  }

  const patches = [];
  patches.push({
    file: 'package.json',
    action: 'add-dep',
    value: RUNTIME_SPEC_RECORDED,
  });

  // 3. (Expo only) Patch app.json / app.config.js — register plugin.
  let appConfigPatched = null;
  if (projectType === 'expo') {
    const cfgPath = await findExpoConfig(cwd);
    if (cfgPath) {
      try {
        const result = await patchAppConfig(cfgPath);
        const rel = path.relative(cwd, cfgPath);
        if (result.changed) {
          patches.push({
            file: rel,
            action: 'add-plugin',
            value: '@boostbossai/lumi-mobile',
            mode: result.mode,
          });
          appConfigPatched = { file: rel, mode: result.mode };
        } else {
          appConfigPatched = { file: rel, mode: 'unchanged' };
        }
      } catch (err) {
        banner.error(
          `Failed to patch ${path.relative(cwd, cfgPath)}.`,
          [err && err.message ? err.message : String(err)]
        );
        process.exit(1);
      }
    } else {
      banner.info(
        'No app.json or app.config.js found — skipping plugin registration.',
        [
          'If you add an Expo config later, add this entry to its plugins array:',
          '  "@boostbossai/lumi-mobile"',
        ]
      );
    }
  }

  // 4. Patch the root component (both Expo and bare RN).
  const rootPath = await findRootComponent(cwd);
  let rootPatched = null;
  if (!rootPath) {
    banner.error(
      'Could not find a root component file.',
      [
        'Looked for: App.tsx, App.jsx, App.js, src/App.{tsx,jsx,js}, app/_layout.tsx.',
        'Open your root component and wrap its return with <LumiProvider publisherId="...">.',
        `See ${DOCS_URL}#manual-wrap for guidance.`,
      ]
    );
    process.exit(1);
  }
  try {
    const result = await patchRootComponent(rootPath, publisherId);
    const rel = path.relative(cwd, rootPath);
    if (result.alreadyPatched) {
      rootPatched = { file: rel, wrappedTag: null, alreadyPatched: true };
    } else {
      patches.push({
        file: rel,
        action: 'wrap-root',
        markerImport: '@boostbossai/lumi-mobile',
        markerWrap: '<LumiProvider',
      });
      rootPatched = {
        file: rel,
        wrappedTag: result.wrappedTag,
        alreadyPatched: false,
      };
    }
  } catch (err) {
    banner.error(
      `Failed to wrap root component (${path.relative(cwd, rootPath)}).`,
      [
        err && err.message ? err.message : String(err),
        `See ${DOCS_URL}#manual-wrap for guidance.`,
      ]
    );
    process.exit(1);
  }

  // 5. (Bare RN only) pod install — Mac only.
  let podInstallStatus = null;
  if (projectType === 'bare-rn') {
    if (process.platform === 'darwin') {
      process.stdout.write(`  Linking CocoaPods (cd ios && pod install)...\n`);
      try {
        await podInstall(cwd);
        podInstallStatus = 'ran';
        patches.push({
          file: 'ios/Podfile.lock',
          action: 'pod-install',
          value: '@boostbossai/lumi-mobile',
        });
      } catch (err) {
        // Non-fatal — banner will note that the user can re-run.
        banner.info(
          'pod install failed — you can re-run it manually.',
          [
            err && err.message ? err.message : String(err),
            'Run: cd ios && pod install',
          ]
        );
        podInstallStatus = null;
      }
    } else {
      podInstallStatus = 'skipped-non-mac';
      process.stdout.write(
        '  Skipping `pod install` (not macOS). Run `cd ios && pod install` on a Mac before building for iOS.\n'
      );
    }
  }

  // 6. Write install log.
  try {
    await writeInstallLog(cwd, {
      publisherId,
      door: 'mobile-app',
      projectType,
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
    projectType,
    detectedLabel,
    runtimeVersion: RUNTIME_VERSION,
    appConfigPatched,
    rootPatched,
    podInstallStatus,
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

  // Reverse in reverse order — source-file patches first, then npm.
  const patches = (log.patches || []).slice().reverse();

  for (const patch of patches) {
    const fullPath = path.join(cwd, patch.file);
    try {
      if (patch.action === 'wrap-root') {
        await unpatchRootComponent(fullPath);
        reversed.push(patch.file);
      } else if (patch.action === 'add-plugin') {
        await unpatchAppConfig(fullPath);
        reversed.push(patch.file);
      } else if (patch.action === 'pod-install') {
        // Pods regenerate on next `pod install`; nothing to revert in our log.
        // Skip silently.
      } else if (patch.action === 'add-dep') {
        // Handled below via `npm uninstall`.
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
    reversed.push(`package.json (${RUNTIME_PKG})`);
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

function buildDetectedLabel(detection) {
  if (detection.type === 'expo') {
    return detection.expoSdkVersion
      ? `Expo SDK ${detection.expoSdkVersion}`
      : 'Expo';
  }
  if (detection.type === 'bare-rn') {
    return detection.rnVersion
      ? `Bare React Native ${detection.rnVersion}`
      : 'Bare React Native';
  }
  return 'React Native';
}

main().catch((err) => {
  banner.error(
    'Unexpected error.',
    [err && err.stack ? err.stack : String(err)]
  );
  process.exit(1);
});
