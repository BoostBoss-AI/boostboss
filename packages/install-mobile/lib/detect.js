'use strict';

const fs = require('fs').promises;
const path = require('path');

/**
 * Detect whether the project at `cwd` is Expo or bare React Native.
 * Returns:
 *   { type: 'expo' | 'bare-rn' | 'unknown',
 *     expoSdkVersion: string | null,
 *     rnVersion: string | null }
 *
 * Throws if package.json cannot be read at all.
 */
async function detectProjectType(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  const raw = await fs.readFile(pkgPath, 'utf8');

  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch (err) {
    const e = new Error(
      `package.json at ${pkgPath} is not valid JSON: ${err.message}`
    );
    e.cause = err;
    throw e;
  }

  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});

  const hasExpo = Boolean(deps.expo);
  const hasRN = Boolean(deps['react-native']);

  if (hasExpo) {
    return {
      type: 'expo',
      expoSdkVersion: cleanVersion(deps.expo),
      rnVersion: cleanVersion(deps['react-native']),
    };
  }

  if (hasRN) {
    return {
      type: 'bare-rn',
      expoSdkVersion: null,
      rnVersion: cleanVersion(deps['react-native']),
    };
  }

  return { type: 'unknown', expoSdkVersion: null, rnVersion: null };
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
