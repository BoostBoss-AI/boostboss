'use strict';

const fs = require('fs').promises;
const os = require('os');

/**
 * Insert a <script type="module" src="..."> tag just before </body> in the
 * given HTML file. The src is also used as the idempotency marker.
 *
 * Returns { alreadyPatched }.
 */
async function patchHtml(htmlPath, scriptSrc) {
  let original;
  try {
    original = await fs.readFile(htmlPath, 'utf8');
  } catch (err) {
    throw new Error(`Could not read HTML file at ${htmlPath}: ${err.message}`);
  }

  // Idempotency check — bail if we've already inserted a tag with this src.
  const existsRe = new RegExp(
    `<script[^>]*src=["']${escapeRe(scriptSrc)}["']`,
    'i'
  );
  if (existsRe.test(original)) {
    return { alreadyPatched: true };
  }

  const eol = detectEol(original);
  const tag = `<script type="module" src="${scriptSrc}"></script>`;

  const bodyCloseRe = /<\/body>/i;
  let patched;
  if (bodyCloseRe.test(original)) {
    patched = original.replace(bodyCloseRe, `    ${tag}${eol}  </body>`);
  } else {
    // No </body> — append at end of file. Better than nothing for stripped-down
    // popup HTML.
    const sep = original.endsWith(eol) ? '' : eol;
    patched = original + sep + tag + eol;
  }

  await fs.writeFile(htmlPath, patched, 'utf8');
  return { alreadyPatched: false };
}

/**
 * Reverse the patch by removing the line containing a script tag whose src
 * matches the marker.
 */
async function unpatchHtml(htmlPath, marker) {
  const original = await fs.readFile(htmlPath, 'utf8');
  const lineRe = new RegExp(
    `[ \\t]*<script[^>]*src=["']${escapeRe(marker)}["'][^>]*>\\s*</script>[ \\t]*\\r?\\n?`,
    'gi'
  );
  const patched = original.replace(lineRe, '');
  if (patched === original) {
    return { changed: false };
  }
  await fs.writeFile(htmlPath, patched, 'utf8');
  return { changed: true };
}

function detectEol(s) {
  if (s.indexOf('\r\n') !== -1) return '\r\n';
  if (s.indexOf('\n') !== -1) return '\n';
  return os.EOL;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  patchHtml,
  unpatchHtml,
};
