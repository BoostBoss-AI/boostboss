'use strict';

const fs = require('fs').promises;
const path = require('path');

/**
 * Detect the project type. Detection priority:
 *   1. React Native (package.json with `react-native` or `expo` dep) — wins
 *      even when iOS/Android subdirectories exist, because RN projects always
 *      contain those subdirs and the RN install path covers both.
 *   2. Standalone iOS — *.xcworkspace or *.xcodeproj or Podfile at root.
 *   3. Standalone Android — build.gradle.kts or build.gradle or
 *      settings.gradle(.kts) at root.
 *   4. Unknown.
 *
 * Returns:
 *   { type: 'expo' | 'bare-rn' | 'ios-native' | 'android-native' | 'unknown',
 *     expoSdkVersion: string | null,
 *     rnVersion: string | null,
 *     marker: string | null }   // the file that triggered detection
 *
 * The native ios-native / android-native paths are SCAFFOLDED — the CLI will
 * print a clear "scaffolded but not yet implemented" message rather than
 * pretending to install. See packages/lumi-mobile-ios/SCAFFOLD-STATUS.md and
 * packages/lumi-mobile-android/SCAFFOLD-STATUS.md.
 */
async function detectProjectType(cwd, opts = {}) {
  const { forcedPlatform } = opts;

  if (forcedPlatform === 'ios' || forcedPlatform === 'ios-native') {
    return { type: 'ios-native', expoSdkVersion: null, rnVersion: null, marker: '--platform=ios' };
  }
  if (forcedPlatform === 'android' || forcedPlatform === 'android-native') {
    return { type: 'android-native', expoSdkVersion: null, rnVersion: null, marker: '--platform=android' };
  }
  if (forcedPlatform === 'rn' || forcedPlatform === 'react-native') {
    // Fall through to RN auto-detect (still need package.json).
  }

  // 1. Try React Native via package.json.
  const pkgPath = path.join(cwd, 'package.json');
  let pkg = null;
  let pkgReadError = null;
  try {
    const raw = await fs.readFile(pkgPath, 'utf8');
    try {
      pkg = JSON.parse(raw);
    } catch (err) {
      pkgReadError = new Error(
        `package.json at ${pkgPath} is not valid JSON: ${err.message}`
      );
      pkgReadError.cause = err;
    }
  } catch (_e) {
    // No package.json — that's fine, we'll try native detection next.
  }

  if (pkg) {
    const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
    const hasExpo = Boolean(deps.expo);
    const hasRN = Boolean(deps['react-native']);

    if (hasExpo) {
      return {
        type: 'expo',
        expoSdkVersion: cleanVersion(deps.expo),
        rnVersion: cleanVersion(deps['react-native']),
        marker: 'package.json (expo dep)',
      };
    }
    if (hasRN) {
      return {
        type: 'bare-rn',
        expoSdkVersion: null,
        rnVersion: cleanVersion(deps['react-native']),
        marker: 'package.json (react-native dep)',
      };
    }
    // package.json exists but no RN — fall through to native detection.
  }

  // 2. Try iOS native (Xcode project / Podfile).
  const iosMarker = await firstExistingFile(cwd, [
    'Podfile',
    'Package.swift',
  ]);
  if (iosMarker) {
    return {
      type: 'ios-native',
      expoSdkVersion: null, rnVersion: null,
      marker: iosMarker,
    };
  }
  const xcMarker = await firstExistingGlob(cwd, /\.(xcworkspace|xcodeproj)$/);
  if (xcMarker) {
    return {
      type: 'ios-native',
      expoSdkVersion: null, rnVersion: null,
      marker: xcMarker,
    };
  }

  // 3. Try Android native (Gradle).
  const androidMarker = await firstExistingFile(cwd, [
    'build.gradle.kts',
    'build.gradle',
    'settings.gradle.kts',
    'settings.gradle',
  ]);
  if (androidMarker) {
    return {
      type: 'android-native',
      expoSdkVersion: null, rnVersion: null,
      marker: androidMarker,
    };
  }

  // 4. Nothing matched. If we had a JSON parse error earlier, surface it.
  if (pkgReadError) throw pkgReadError;
  return { type: 'unknown', expoSdkVersion: null, rnVersion: null, marker: null };
}

async function firstExistingFile(cwd, names) {
  for (const name of names) {
    const full = path.join(cwd, name);
    try {
      const stat = await fs.stat(full);
      if (stat.isFile()) return name;
    } catch (_e) { /* missing */ }
  }
  return null;
}

async function firstExistingGlob(cwd, regex) {
  try {
    const entries = await fs.readdir(cwd);
    for (const e of entries) {
      if (regex.test(e)) return e;
    }
  } catch (_e) { /* unreadable */ }
  return null;
}

function cleanVersion(v) {
  if (!v || typeof v !== 'string') return null;
  return v.replace(/^[\^~>=<\s]+/, '').trim() || null;
}

/**
 * Find the root component file. Returns the absolute path, or null if none
 * found. Search candidates in order — same order described in the spec.
 *
 * Expo Router projects ship `app/_layout.tsx` instead of `App.tsx`; we check
 * that last so vanilla projects don't accidentally pick it up.
 */
async function findRootComponent(cwd) {
  const candidates = [
    'App.tsx',
    'App.jsx',
    'App.js',
    path.join('src', 'App.tsx'),
    path.join('src', 'App.jsx'),
    path.join('src', 'App.js'),
    path.join('app', '_layout.tsx'),
  ];

  for (const rel of candidates) {
    const full = path.join(cwd, rel);
    try {
      const stat = await fs.stat(full);
      if (stat.isFile()) return full;
    } catch (_e) {
      // not present
    }
  }

  return null;
}

/**
 * Find the Expo config file. Returns the absolute path, or null if neither
 * app.json nor app.config.js / app.config.ts is present.
 */
async function findExpoConfig(cwd) {
  const candidates = ['app.json', 'app.config.js', 'app.config.ts'];
  for (const rel of candidates) {
    const full = path.join(cwd, rel);
    try {
      const stat = await fs.stat(full);
      if (stat.isFile()) return full;
    } catch (_e) {
      // not present
    }
  }
  return null;
}

module.exports = {
  detectProjectType,
  findRootComponent,
  findExpoConfig,
};
