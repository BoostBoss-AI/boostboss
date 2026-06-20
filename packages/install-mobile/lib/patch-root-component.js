'use strict';

const fs = require('fs').promises;
const os = require('os');

const IMPORT_LINE = `import { LumiProvider } from '@boostbossai/lumi-mobile';`;
const IMPORT_MARKER = '@boostbossai/lumi-mobile';
const WRAP_MARKER = '<LumiProvider';

// JSX root candidates we prefer to wrap (in priority order). If the
// outermost element is one of these we wrap THAT element. Otherwise we
// wrap whatever the first JSX element after `return (` is.
const PREFERRED_ROOTS = [
  'SafeAreaProvider',
  'NavigationContainer',
  'View',
  'SafeAreaView',
  'Fragment',
];

/**
 * Wrap the root return element of the root component file with
 * <LumiProvider publisherId="..."> ... </LumiProvider>.
 *
 * Heuristic, AST-free:
 *   1. If <LumiProvider already appears in the file -> skip (idempotent).
 *   2. Insert `import { LumiProvider } from '@boostbossai/lumi-mobile';` near
 *      the top, after the existing import block.
 *   3. Find a `return (` followed by JSX. Locate the outermost JSX element
 *      (the first balanced tag pair after `return (`), and wrap it.
 *
 * Returns:
 *   { alreadyPatched, wrappedTag, eol }
 *
 * Throws if we can't find a return statement with JSX — caller should fall
 * back to a manual-instruction banner.
 */
async function patchRootComponent(filePath, publisherId) {
  const original = await fs.readFile(filePath, 'utf8');
  const eol = detectEol(original);

  if (original.includes(WRAP_MARKER) || original.includes(IMPORT_MARKER)) {
    return { alreadyPatched: true, wrappedTag: null, eol };
  }

  // 1. Insert the import line.
  const withImport = insertImport(original, eol);

  // 2. Wrap the JSX root.
  const wrapped = wrapJsxRoot(withImport, publisherId, eol);

  await fs.writeFile(filePath, wrapped.text, 'utf8');
  return { alreadyPatched: false, wrappedTag: wrapped.tag, eol };
}

/**
 * Reverse the patch by:
 *   - removing the import line
 *   - removing the <LumiProvider publisherId="..."> ... </LumiProvider> wrapper
 *     while preserving the inner JSX
 */
async function unpatchRootComponent(filePath) {
  const original = await fs.readFile(filePath, 'utf8');

  if (!original.includes(IMPORT_MARKER) && !original.includes(WRAP_MARKER)) {
    return { changed: false };
  }

  let patched = original;

  // Strip the import line. Tolerate single or double quotes.
  patched = patched.replace(
    /^[ \t]*import\s*\{\s*LumiProvider\s*\}\s*from\s*['"]@boostbossai\/lumi-mobile['"];?\r?\n?/m,
    ''
  );

  // Strip the wrapping tags, preserving inner content.
  // Match <LumiProvider publisherId="..."> ... </LumiProvider>, non-greedy.
  patched = patched.replace(
    /<LumiProvider[^>]*>([\s\S]*?)<\/LumiProvider>/,
    (_m, inner) => inner.trim()
  );

  if (patched === original) {
    return { changed: false };
  }

  await fs.writeFile(filePath, patched, 'utf8');
  return { changed: true };
}

/* ───────── internals ───────── */

function detectEol(s) {
  if (s.indexOf('\r\n') !== -1) return '\r\n';
  if (s.indexOf('\n') !== -1) return '\n';
  return os.EOL;
}

/**
 * Insert the import line. Place it after the last `import ... from '...';`
 * line in the file. If there are no imports at all, prepend.
 */
function insertImport(src, eol) {
  const lines = src.split(/\r?\n/);
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s.+from\s+['"][^'"]+['"];?\s*$/.test(lines[i])) {
      lastImportIdx = i;
    } else if (/^\s*import\s+['"][^'"]+['"];?\s*$/.test(lines[i])) {
      // side-effect import: `import './x.css';`
      lastImportIdx = i;
    }
  }

  if (lastImportIdx === -1) {
    return IMPORT_LINE + eol + src;
  }

  lines.splice(lastImportIdx + 1, 0, IMPORT_LINE);
  return lines.join(eol);
}

/**
 * Find a `return (` (or `return <`) inside the source and wrap the outermost
 * JSX element. Returns { text, tag } where tag is what we wrapped (for
 * banner output).
 */
function wrapJsxRoot(src, publisherId, eol) {
  // Try parenthesized return first: `return (` ... `);`
  const parenMatch = findReturnParens(src);
  if (parenMatch) {
    const inner = src.slice(parenMatch.innerStart, parenMatch.innerEnd);
    const tag = detectOutermostTag(inner) || 'root';
    const opener = `<LumiProvider publisherId="${publisherId}">`;
    const closer = `</LumiProvider>`;
    // Preserve internal whitespace; just wrap.
    const wrappedInner =
      eol +
      indentBlock(opener + eol + inner.trim() + eol + closer, '    ') +
      eol +
      '  ';
    const text =
      src.slice(0, parenMatch.innerStart) +
      wrappedInner +
      src.slice(parenMatch.innerEnd);
    return { text, tag };
  }

  // Fallback: `return <X ...>...</X>;` on a single chain.
  const bareMatch = findReturnBareJsx(src);
  if (bareMatch) {
    const inner = src.slice(bareMatch.innerStart, bareMatch.innerEnd);
    const tag = detectOutermostTag(inner) || 'root';
    const replacement = `(${eol}    <LumiProvider publisherId="${publisherId}">${eol}      ${inner.trim()}${eol}    </LumiProvider>${eol}  )`;
    const text =
      src.slice(0, bareMatch.innerStart) +
      replacement +
      src.slice(bareMatch.innerEnd);
    return { text, tag };
  }

  throw new Error(
    'Could not find a `return (...)` JSX block to wrap with <LumiProvider />. ' +
    'Open the file and wrap your root component manually.'
  );
}

/**
 * Match the FIRST `return (` we find, then scan forward to the matching
 * close paren, balancing parens. Returns { innerStart, innerEnd } pointing
 * at the contents between `(` and `)`.
 */
function findReturnParens(src) {
  const re = /\breturn\s*\(/g;
  const m = re.exec(src);
  if (!m) return null;

  let depth = 1;
  let i = m.index + m[0].length;
  const innerStart = i;

  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return { innerStart, innerEnd: i };
      }
    } else if (ch === '"' || ch === "'" || ch === '`') {
      // skip strings
      const end = skipString(src, i);
      i = end;
      continue;
    } else if (ch === '/' && src[i + 1] === '/') {
      // line comment
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? src.length : nl;
      continue;
    } else if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    i++;
  }

  return null;
}

/**
 * Match `return <X ...` (no parens). Find the JSX element start, then balance
 * tags until the matching close. We use a coarse depth count on `<X` / `</X>`
 * for the OUTERMOST tag name.
 */
function findReturnBareJsx(src) {
  const re = /\breturn\s+(<[A-Za-z][A-Za-z0-9_.]*)/g;
  const m = re.exec(src);
  if (!m) return null;

  // innerStart points at the `<`.
  const innerStart = m.index + 'return'.length + (m[0].length - 'return'.length - m[1].length);
  const tagNameMatch = /^<([A-Za-z][A-Za-z0-9_.]*)/.exec(m[1]);
  if (!tagNameMatch) return null;
  const tagName = tagNameMatch[1];

  const innerEnd = findClosingTagEnd(src, innerStart, tagName);
  if (innerEnd === -1) return null;

  return { innerStart, innerEnd };
}

/**
 * From `<TagName ...` at startIdx, scan forward balancing opens of <TagName ...>
 * with </TagName>. Returns the index AFTER the matching </TagName>, or -1 if
 * not found. Also tolerates self-closing `<TagName ... />` at the top level.
 */
function findClosingTagEnd(src, startIdx, tagName) {
  // Detect self-closing on the first tag.
  const firstTagEnd = src.indexOf('>', startIdx);
  if (firstTagEnd === -1) return -1;
  const firstTagText = src.slice(startIdx, firstTagEnd + 1);
  if (/\/>\s*$/.test(firstTagText)) {
    return firstTagEnd + 1;
  }

  const openRe = new RegExp(`<${escapeRe(tagName)}(\\s|>|/)`, 'g');
  const closeRe = new RegExp(`</${escapeRe(tagName)}\\s*>`, 'g');

  let depth = 1;
  let cursor = firstTagEnd + 1;

  while (cursor < src.length) {
    openRe.lastIndex = cursor;
    closeRe.lastIndex = cursor;
    const openHit = openRe.exec(src);
    const closeHit = closeRe.exec(src);

    if (!closeHit) return -1;

    if (openHit && openHit.index < closeHit.index) {
      depth++;
      // Skip past this opener's `>`.
      const gt = src.indexOf('>', openHit.index);
      if (gt === -1) return -1;
      // If self-closing, don't bump depth.
      const text = src.slice(openHit.index, gt + 1);
      if (/\/>\s*$/.test(text)) depth--;
      cursor = gt + 1;
    } else {
      depth--;
      cursor = closeHit.index + closeHit[0].length;
      if (depth === 0) return cursor;
    }
  }

  return -1;
}

/**
 * Look at the inner JSX block and return the tag name of the outermost
 * element (e.g. "SafeAreaProvider"). Used only for the banner label —
 * the actual wrap doesn't depend on this.
 */
function detectOutermostTag(inner) {
  const trimmed = inner.replace(/^[\s\r\n]+/, '');
  const m = /^<\s*(>|[A-Za-z][A-Za-z0-9_.]*)/.exec(trimmed);
  if (!m) return null;
  const name = m[1] === '>' ? 'Fragment' : m[1];
  // Surface preference is informational; we always wrap the outermost.
  return PREFERRED_ROOTS.includes(name) ? name : name;
}

function indentBlock(text, prefix) {
  return text
    .split(/\r?\n/)
    .map((ln) => (ln.length ? prefix + ln : ln))
    .join('\n');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function skipString(src, startIdx) {
  const quote = src[startIdx];
  let i = startIdx + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) {
      // template literal interpolation
      if (quote === '`' && src[i - 1] === '$' && src[i] === '{') {
        // skip until matching `}` — coarse
        let depth = 1;
        i++;
        while (i < src.length && depth > 0) {
          if (src[i] === '{') depth++;
          else if (src[i] === '}') depth--;
          i++;
        }
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return src.length;
}

module.exports = {
  patchRootComponent,
  unpatchRootComponent,
  IMPORT_LINE,
  WRAP_MARKER,
};
