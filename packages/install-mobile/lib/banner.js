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
  ['Sponsored citation',       '~$4.50 RPM'],
  ['Suggested chip',           '~$4.50 RPM'],
  ['Inline sponsored card',    '~$6.50 RPM'],
  ['Loading-state ad',         '~$7.00 RPM'],
  ['Pre-roll video',           '~$11.00 RPM'],
  ['Rewarded video',           '~$35.00 RPM'],
  ['Bottom banner',            '~$6.50 RPM'],
  ['Inline native banner',     '~$7.50 RPM'],
  ['Full-screen interstitial', '~$18.00 RPM'],
  ['Splash sponsor',           '~$15.00 RPM'],
];

const REWARDED_LABEL = 'Rewarded video';

function installSuccess({
  publisherId,
  projectType,           // 'expo' | 'bare-rn'
  detectedLabel,         // e.g. "Expo SDK 50"
  runtimeVersion,
  appConfigPatched,      // { file, mode } | null
  rootPatched,           // { file, wrappedTag } | null
  podInstallStatus,      // 'ran' | 'skipped-non-mac' | null
}) {
  const lines = [];

  lines.push('');
  lines.push(`  ${c.pink}${c.bold}▲ Lumi for Mobile App${c.reset}  ${c.gray}·${c.reset}  ${c.pink}Boost Boss${c.reset}`);
  lines.push('');
  lines.push(`  ${c.green}✓${c.reset} Detected ${c.bold}${detectedLabel}${c.reset}`);
  lines.push(`  ${c.green}✓${c.reset} Installed ${c.bold}@boostbossai/lumi-mobile v${runtimeVersion}${c.reset}`);

  if (appConfigPatched) {
    const note =
      appConfigPatched.mode === 'js-comment'
        ? `${c.gray}(added TODO comment — add plugin entry by hand)${c.reset}`
        : `${c.gray}(+1 plugin)${c.reset}`;
    lines.push(
      `  ${c.green}✓${c.reset} Patched ${c.cyan}${appConfigPatched.file}${c.reset} ${note}`
    );
  }

  if (rootPatched) {
    const wrapNote = rootPatched.wrappedTag
      ? `${c.gray}(wrapped <${rootPatched.wrappedTag}> with <LumiProvider />)${c.reset}`
      : `${c.gray}(wrapped root with <LumiProvider />)${c.reset}`;
    lines.push(
      `  ${c.green}✓${c.reset} Patched ${c.cyan}${rootPatched.file}${c.reset} ${wrapNote}`
    );
  }

  if (podInstallStatus === 'ran') {
    lines.push(`  ${c.green}✓${c.reset} Linked CocoaPods ${c.gray}(cd ios && pod install)${c.reset}`);
  } else if (podInstallStatus === 'skipped-non-mac') {
    lines.push(
      `  ${c.yellow}!${c.reset} Skipped ${c.cyan}pod install${c.reset} ${c.gray}(not macOS — run on a Mac before iOS build)${c.reset}`
    );
  }

  lines.push(`  ${c.green}✓${c.reset} Linked to publisher ${c.bold}${publisherId}${c.reset}`);
  lines.push(`  ${c.green}✓${c.reset} 10 placements auto-enabled:`);

  const nameCol = Math.max.apply(null, PLACEMENTS.map((p) => p[0].length));
  for (const [name, rpm] of PLACEMENTS) {
    const pad = ' '.repeat(nameCol - name.length + 4);
    const trailing =
      name === REWARDED_LABEL
        ? `  ${c.pink}← highest-CPM ad format${c.reset}`
        : '';
    lines.push(
      `        ${c.dim}${name}${pad}${c.reset}${c.gray}${rpm}${c.reset}${trailing}`
    );
  }

  lines.push('');
  const rebuildHint =
    projectType === 'expo'
      ? `${c.cyan}npx expo run:ios${c.reset} ${c.gray}or${c.reset} ${c.cyan}npx expo run:android${c.reset}`
      : `${c.cyan}react-native run-ios${c.reset} ${c.gray}or${c.reset} ${c.cyan}react-native run-android${c.reset}`;
  lines.push(`  Rebuild your app (${rebuildHint}).`);
  lines.push(`  First impression typically arrives within 60 seconds.`);
  lines.push('');
  lines.push(`  Track live earnings → ${c.cyan}https://boostboss.ai/publish/dashboard${c.reset}`);
  lines.push(`  To uninstall:        ${c.dim}npx @boostbossai/install-mobile --uninstall${c.reset}`);
  lines.push('');

  process.stdout.write(lines.join('\n') + '\n');
}

function uninstallSuccess({ reversed, failed }) {
  const lines = [];
  lines.push('');
  lines.push(`  ${c.pink}${c.bold}▲ Lumi for Mobile App${c.reset}  ${c.gray}·${c.reset}  ${c.pink}uninstalled${c.reset}`);
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
    lines.push(`  ${c.green}Uninstalled cleanly.${c.reset} Rebuild your app to clear the SDK.`);
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

function note(msg) {
  process.stdout.write(`  ${c.gray}${msg}${c.reset}\n`);
}

function help() {
  const lines = [
    '',
    `  ${c.pink}${c.bold}▲ Lumi for Mobile App${c.reset}  ${c.gray}·${c.reset}  ${c.pink}Boost Boss${c.reset}`,
    '',
    '  Install:    npx @boostbossai/install-mobile <publisherId>',
    '  Uninstall:  npx @boostbossai/install-mobile --uninstall',
    '',
    `  Docs:       ${c.cyan}https://boostboss.ai/docs/mobile${c.reset}`,
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
  note,
  help,
};
