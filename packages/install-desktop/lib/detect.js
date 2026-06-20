'use strict';

const fs = require('fs').promises;
const path = require('path');

/**
 * Detect whether the project at `cwd` is Electron, Tauri, or unknown.
 * Returns { type: 'electron' | 'tauri' | 'unknown', version: string | null }
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
    const e = new Error(`package.json at ${pkgPath} is not valid JSON: ${err.message}`);
    e.cause = err;
    throw e;
  }

  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});

  // Electron wins if both somehow present (more common, and we don't ship Tauri v0 anyway).
  if (deps.electron) {
    return { type: 'electron', version: cleanVersion(deps.electron) };
  }

  if (deps['@tauri-apps/cli'] || deps['@tauri-apps/api']) {
    return { type: 'tauri', version: cleanVersion(deps['@tauri-apps/cli'] || deps['@tauri-apps/api']) };
  }

  // Tauri can also be detected from src-tauri/ directory.
  try {
    const stat = await fs.stat(path.join(cwd, 'src-tauri'));
    if (stat.isDirectory()) {
      return { type: 'tauri', version: null };
    }
  } catch (_e) {
    // not present, fall through
  }

  return { type: 'unknown', version: null };
}

function cleanVersion(v) {
  if (!v || typeof v !== 'string') return null;
  // Strip leading ^ ~ >= etc. Keep the rest readable.
  return v.replace(/^[\^~>=<\s]+/, '').trim() || null;
}

/**
 * Find the renderer HTML file inside an Electron project at `cwd`.
 * Search order matches the spec. Throws if nothing found and no TTY for prompt.
 */
async function findRendererHtml(cwd) {
  const candidates = [
    path.join('public', 'index.html'),
    path.join('src', 'index.html'),
    path.join('src', 'renderer', 'index.html'),
    path.join('app', 'index.html'),
    'index.html',
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

  // Prompt fallback.
  if (process.stdin.isTTY) {
    const answer = await prompt(
      'Could not auto-detect your renderer HTML.\nPath (relative to project root): '
    );
    if (answer && answer.trim()) {
      const full = path.join(cwd, answer.trim());
      const stat = await fs.stat(full); // throws if missing
      if (stat.isFile()) return full;
    }
  }

  throw new Error('No renderer HTML found. Pass --html <path> or see docs.');
}

function prompt(question) {
  return new Promise((resolve, reject) => {
    let readline;
    try {
      readline = require('readline');
    } catch (err) {
      return reject(err);
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

module.exports = {
  detectProjectType,
  findRendererHtml,
};
