'use strict';

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Spawn `npm install <pkg>` in cwd. Resolves on exit 0, rejects otherwise.
 *
 * If no package.json exists at cwd, npm install will create node_modules but
 * complain. We pre-create a minimal package.json if missing so the install
 * is clean.
 */
async function npmInstallRuntime(cwd, pkgSpec) {
  await ensurePackageJson(cwd);
  return runNpm(['install', '--save', pkgSpec], cwd);
}

async function npmUninstallRuntime(cwd, pkgName) {
  return runNpm(['uninstall', pkgName], cwd);
}

async function ensurePackageJson(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  try {
    await fs.access(pkgPath);
    return; // exists
  } catch (_e) {
    // Doesn't exist — create a minimal one so npm doesn't whine.
    const stub = {
      name: path.basename(cwd) || 'chrome-extension',
      version: '0.0.0',
      private: true,
    };
    await fs.writeFile(pkgPath, JSON.stringify(stub, null, 2) + '\n', 'utf8');
  }
}

function runNpm(args, cwd) {
  return new Promise((resolve, reject) => {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCmd, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32', // npm.cmd needs shell on Windows
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

module.exports = {
  npmInstallRuntime,
  npmUninstallRuntime,
};
