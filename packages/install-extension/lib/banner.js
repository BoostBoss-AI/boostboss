'use strict';

/**
 * ANSI-colored banner output. No deps.
 *
 * Honors NO_COLOR (https://no-color.org/) and skips ANSI codes when stdout
 * isn't a TTY.
 */

const useColor = (function () {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout && process.stdout.isTTY);
})();

function code(seq) {
  return useColor ? seq : '';
}

const c = {
  reset: code('\x1b[0m'),
  bold: code('\x1b[1m'),
  dim: code('\x1b[2m'),
  green: code('\x1b[32m'),
  red: code('\x1b[31m'),
  yellow: code('\x1b[33m'),
  cyan: code('\x1b[36m'),
  magenta: code('\x1b[35m'),
  pink: code('\x1b[38;5;205m'),
  gray: code('\x1b[90m'),
};

const PLACEMENTS = [
  ['Sponsored citation',    '~$4.50 RPM'],
  ['Suggested chip',        '~$4.50 RPM'],
  ['Inline sponsored card', '~$6.50 RPM'],
  ['Loading-state ad',      '~$7.00 RPM'],
  ['Popup card',            '~$7.50 RPM'],
  ['Side panel slot',       '~$8.00 RPM'],
  ['New-tab takeover',      '~$16.00 RPM'],
  ['Install onboarding',    '~$9.00 RPM'],
];

function installSuccess({
  publisherId,
  runtimeVersion,
  manifestPermAdded,
  manifestHostAdded,
  serviceWorker,
  surfaces,
}) {
  const lines = [];

  lines.push('');
  lines.push(`  ${c.pink}${c.bold}▲ Lumi for Browser Extension App${c.reset}  ${c.gray}·${c.reset}  ${c.pink}Boost Boss${c.reset}`);
  lines.push('');
  lines.push(`  ${c.green}✓${c.reset} Detected ${c.bold}Manifest V3 extension${c.reset}`);
  lines.push(`  ${c.green}✓${c.reset} Installed ${c.bold}@boostbossai/lumi-extension v${runtimeVersion}${c.reset}`);

  const permsCount = (manifestPermAdded ? 1 : 0);
  const hostsCount = (manifestHostAdded ? 1 : 0);
  if (permsCount + hostsCount > 0) {
    const parts = [];
    if (permsCount) parts.push(`+${permsCount} permission`);
    if (hostsCount) parts.push(`+${hostsCount} host`);
    lines.push(
      `  ${c.green}✓${c.reset} Patched ${c.cyan}manifest.json${c.reset} ${c.gray}(${parts.join(', ')})${c.reset}`
    );
  } else {
    lines.push(
      `  ${c.green}✓${c.reset} ${c.cyan}manifest.json${c.reset} ${c.gray}(no changes — already configured)${c.reset}`
    );
  }

  if (serviceWorker) {
    const note = serviceWorker.alreadyPatched
      ? `${c.gray}(already patched)${c.reset}`
      : `${c.gray}(service worker init)${c.reset}`;
    lines.push(
      `  ${c.green}✓${c.reset} Patched ${c.cyan}${serviceWorker.file}${c.reset} ${note}`
    );
  }

  for (const s of surfaces) {
    const note = s.alreadyPatched
      ? `${c.gray}(already patched)${c.reset}`
      : `${c.gray}(runtime script)${c.reset}`;
    lines.push(
      `  ${c.green}✓${c.reset} Patched ${c.cyan}${s.file}${c.reset} ${note}`
    );
  }

  lines.push(`  ${c.green}✓${c.reset} Linked to publisher ${c.bold}${publisherId}${c.reset}`);
  lines.push(`  ${c.green}✓${c.reset} 8 placements auto-enabled:`);

  const nameCol = Math.max.apply(null, PLACEMENTS.map((p) => p[0].length));
  for (const [name, rpm] of PLACEMENTS) {
    const pad = ' '.repeat(nameCol - name.length + 4);
    lines.push(`        ${c.dim}${name}${pad}${c.reset}${c.gray}${rpm}${c.reset}`);
  }

  lines.push('');
  lines.push(`  Reload your extension in ${c.cyan}chrome://extensions${c.reset} to apply.`);
  lines.push(`  First impression typically arrives within 60 seconds.`);
  lines.push('');
  lines.push(`  Track live earnings → ${c.cyan}https://boostboss.ai/publish/dashboard${c.reset}`);
  lines.push(`  To uninstall:        ${c.dim}npx @boostbossai/install-extension --uninstall${c.reset}`);
  lines.push('');

  process.stdout.write(lines.join('\n') + '\n');
}

function uninstallSuccess({ reversed, failed }) {
  const lines = [];
  lines.push('');
  lines.push(`  ${c.pink}${c.bold}▲ Lumi for Browser Extension App${c.reset}  ${c.gray}·${c.reset}  ${c.pink}uninstalled${c.reset}`);
  lines.push('');
  if (reversed.length === 0 && failed.length === 0) {
    lines.push(`  ${c.yellow}!${c.reset} Nothing to reverse. .lumi-install-log was empty.`);
  }
  for (const file of reversed) {
    lines.push(`  ${c.green}✓${c.reset} Reverted ${c.cyan}${file}${c.reset}`);
  }
  for (const { file, reason } of failed) {
    lines.push(`  ${c.red}✗${c.reset} ${c.cyan}${file}${c.reset} ${c.gray}— ${reason}${c.reset}`);
  }
  if (failed.length === 0) {
    lines.push('');
    lines.push(`  ${c.green}Uninstalled cleanly.${c.reset} Reload your extension in chrome://extensions.`);
  } else {
    lines.push('');
    lines.push(`  ${c.yellow}Some patches could not be reversed.${c.reset} Edit those files by hand.`);
  }
  lines.push('');
  process.stdout.write(lines.join('\n') + '\n');
}

function error(headline, body) {
  const lines = [];
  lines.push('');
  lines.push(`  ${c.red}${c.bold}✗ ${headline}${c.reset}`);
  if (Array.isArray(body)) {
    lines.push('');
    for (const ln of body) {
      lines.push(`  ${c.gray}${ln}${c.reset}`);
    }
  } else if (typeof body === 'string' && body) {
    lines.push('');
    lines.push(`  ${c.gray}${body}${c.reset}`);
  }
  lines.push('');
  process.stderr.write(lines.join('\n') + '\n');
}

function info(headline, body) {
  const lines = [];
  lines.push('');
  lines.push(`  ${c.cyan}${c.bold}ℹ ${headline}${c.reset}`);
  if (Array.isArray(body)) {
    lines.push('');
    for (const ln of body) {
      lines.push(`  ${c.gray}${ln}${c.reset}`);
    }
  }
  lines.push('');
  process.stdout.write(lines.join('\n') + '\n');
}

function help() {
  const lines = [
    '',
    `  ${c.pink}${c.bold}▲ Lumi for Browser Extension App${c.reset}  ${c.gray}·${c.reset}  ${c.pink}Boost Boss${c.reset}`,
    '',
    '  Install:    npx @boostbossai/install-extension <publisherId>',
    '  Uninstall:  npx @boostbossai/install-extension --uninstall',
    '',
    `  Docs:       ${c.cyan}https://boostboss.ai/docs/extension${c.reset}`,
    `  Dashboard:  ${c.cyan}https://boostboss.ai/publish/dashboard${c.reset}`,
    '',
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

module.exports = {
  installSuccess,
  uninstallSuccess,
  error,
  info,
  help,
};
