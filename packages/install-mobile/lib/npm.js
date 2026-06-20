'use strict';

const { spawn } = require('child_process');

/**
 * Spawn `npm install <pkg>` in cwd. Resolves on exit 0, rejects otherwise.
 */
async function npmInstallRuntime(cwd, pkgSpec) {
  return runNpm(['install', '--save', pkgSpec], cwd);
}

async function npmUninstallRuntime(cwd, pkgName) {
  return runNpm(['uninstall', pkgName], cwd);
}

function runNpm(args, cwd) {
  return new Promise((resolve, reject) => {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCmd, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
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

/**
 * Spawn `pod install` inside <cwd>/ios. Mac only — callers must gate on
 * process.platform === 'darwin'. Resolves on exit 0.
 */
async function podInstall(cwd) {
  const iosDir = require('path').join(cwd, 'ios');
  return new Promise((resolve, reject) => {
    const child = spawn('pod', ['install'], {
      cwd: iosDir,
      stdio: 'inherit',
      shell: false,
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pod install exited with code ${code}`));
      }
    });
  });
}

module.exports = {
  npmInstallRuntime,
  npmUninstallRuntime,
  podInstall,
};
