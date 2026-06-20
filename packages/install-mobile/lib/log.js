'use strict';

const fs = require('fs').promises;
const path = require('path');

const LOG_FILENAME = '.lumi-install-log';
const LOG_VERSION = '1.0';

async function writeInstallLog(cwd, { publisherId, door, projectType, patches }) {
  const logPath = path.join(cwd, LOG_FILENAME);
  const payload = {
    version: LOG_VERSION,
    publisherId,
    installedAt: new Date().toISOString(),
    door,
    projectType,
    patches,
  };
  const json = JSON.stringify(payload, null, 2) + '\n';
  await fs.writeFile(logPath, json, 'utf8');
  return logPath;
}

async function readInstallLog(cwd) {
  const logPath = path.join(cwd, LOG_FILENAME);
  const raw = await fs.readFile(logPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    const e = new Error(`${LOG_FILENAME} is not valid JSON: ${err.message}`);
    e.cause = err;
    throw e;
  }
}

async function deleteInstallLog(cwd) {
  const logPath = path.join(cwd, LOG_FILENAME);
  await fs.unlink(logPath);
}

module.exports = {
  writeInstallLog,
  readInstallLog,
  deleteInstallLog,
  LOG_FILENAME,
};
