#!/usr/bin/env node
/**
 * Snippet validator for friendly-snippets.
 *
 * Tiers of checking:
 *  1. Structural: valid JSON, required fields, field types.
 *  2. Prefix hygiene: non-empty, no leading/trailing space, unique within a file,
 *     no pure punctuation/number prefixes (they pollute completion menus — see
 *     review on #357).
 *  3. Body grammar (VS Code snippet grammar): balanced ${}/backticks, valid
 *     tabstop numbering (no duplicate stops with conflicting placeholders),
 *     known variables only, valid choice syntax, nested placeholders checked
 *     recursively.
 *
 * Notes on grammar interpretation (vs the VS Code snippet spec):
 *  - Array bodies are joined with \n before parsing (spec behaviour).
 *  - `$` followed by a lowercase identifier (e.g. `$home`, `${home:default}`)
 *    is reported as a warning, not an error: some engines pass it through
 *    literally, but VS Code resolves it as an (unknown) variable.
 *  - `\$` escapes, `` ` ``code blocks``, `$(...)` are passed through literally.
 *
 * Usage: node debug/validate-snippets.mjs [--errors-only] [files...]
 * (No files = all snippet JSONs tracked by git.)
 * Exit code: 1 if any errors, 0 otherwise. Warnings never fail.
 */
import fs from 'node:fs';
import process from 'node:process';
import { execSync } from 'node:child_process';

const KNOWN_VARS = new Set([
  'TM_SELECTED_TEXT', 'TM_CURRENT_LINE', 'TM_CURRENT_WORD',
  'TM_LINE_INDEX', 'TM_LINE_NUMBER', 'TM_FILENAME', 'TM_FILENAME_BASE',
  'TM_DIRECTORY', 'TM_FILEPATH', 'RELATIVE_FILEPATH', 'CLIPBOARD',
  'WORKSPACE_NAME', 'WORKSPACE_FOLDER', 'CURRENT_YEAR', 'CURRENT_YEAR_SHORT',
  'CURRENT_MONTH', 'CURRENT_MONTH_NAME', 'CURRENT_MONTH_NAME_SHORT',
  'CURRENT_DATE', 'CURRENT_DAY_NAME', 'CURRENT_DAY_NAME_SHORT',
  'CURRENT_HOUR', 'CURRENT_MINUTE', 'CURRENT_SECOND',
  'CURRENT_TIMEZONE_OFFSET', 'RANDOM', 'RANDOM_HEX', 'UUID',
  'BLOCK_COMMENT_START', 'BLOCK_COMMENT_END', 'LINE_COMMENT',
]);

let errors = 0, warnings = 0;
const err = (f, name, msg) => { errors++; console.error(`ERROR ${f}${name ? ` [${name}]` : ''}: ${msg}`); };
const errorsOnly = process.argv.includes('--errors-only');
const warn = errorsOnly ? (f, name, msg) => {} : (f, name, msg) => { warnings++; console.warn(`WARN  ${f}${name ? ` [${name}]` : ''}: ${msg}`); };

/** Find the matching `}` for a `{` at index open (with escape handling). */
function matchBrace(s, open) {
  let depth = 0;
  for (let j = open; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '{') depth++;
    else if (s[j] === '}') { depth--; if (depth === 0) return j; }
  }
  return -1;
}

/**
 * Validate one snippet body (already joined into a single string).
 * `seen` maps tabstop number -> placeholder text (shared across recursion so
 * nested stops are included in numbering/dup checks).
 */
function checkBodyGrammar(file, name, s, seen, depth = 0) {
  // Note: scanning stops at the first anomaly that makes the remainder
  // ambiguous (unbalanced ${) or unreliable (dangling $, unbalanced backtick),
  // so at most one such diagnostic is reported per snippet body.
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue; } // escaped char
    if (s[i] === '`') { // code block: skip to closing backtick
      const close = s.indexOf('`', i + 1);
      if (close === -1) { warn(file, name, 'unbalanced backtick — treated as literal by most snippet engines, but pairing or escaping it is safer'); return; }
      i = close + 1; continue;
    }
    if (s[i] !== '$') { i++; continue; }
    if (i + 1 >= s.length) { warn(file, name, 'dangling $ at end of body — literal in most engines, but VS Code requires \\$ for literal dollar (common in LaTeX math delimiters)'); return; }
    const c = s[i + 1];

    if (c === '$') { i += 1; continue; } // $$ → literal $; re-scan next char (its stop still counts)

    if (c === '{') {
      const j = matchBrace(s, i + 1);
      if (j === -1) { err(file, name, `unbalanced \${ ... } starting at offset ${i}`); return; }
      const inner = s.slice(i + 2, j);
      checkBracesContent(file, name, inner, seen, depth);
      i = j + 1; continue;
    }

    if (/\d/.test(c)) { // simple $N tabstop
      const digits = s.slice(i + 1).match(/^\d+/)[0];
      seen.set(Number(digits), seen.get(Number(digits)) ?? null);
      i += 1 + digits.length; continue;
    }

    // $identifier — variable reference
    const m = s.slice(i + 1).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (m) {
      if (/[A-Z]/.test(m[0]) && m[0] === m[0].toUpperCase()) {
        // Uppercase form looks like an intended snippet variable
        if (!KNOWN_VARS.has(m[0])) err(file, name, `unknown variable $${m[0]}`);
      } else {
        // Lowercase: shell-ish text in some engines; VS Code sees an unknown
        // variable. Warn so authors can escape as \$ if literal is intended.
        warn(file, name, `$${m[0]}: lowercase variable — escape as \\$${m[0]} if literal text is intended`);
      }
      i += 1 + m[0].length; continue;
    }

    // Anything else after $ is a literal '$'
    i++;
  }
  // numbering sanity (only at top level, not inside placeholder recursion)
  if (depth === 0) {
    const positives = [...seen.keys()].filter((n) => n > 0).sort((a, b) => a - b);
    for (let k = 1; k < positives.length; k++) {
      if (positives[k] - positives[k - 1] > 1) {
        warn(file, name, `tabstop numbers skip values (${positives.join(',')}) — intentional?`);
        break;
      }
    }
  }
}

/** Validate the content inside ${ ... } (tabstop/choice/variable/transform). */
function checkBracesContent(file, name, inner, seen, depth) {
  const head = inner.split(/[:|/]/)[0];
  if (head === '') {
    err(file, name, `empty tabstop number in \`${inner}\``);
    return;
  }
  if (head !== head.trim() || /\s/.test(head)) {
    err(file, name, `malformed tabstop/variable name \`${inner}\` (whitespace in head)`);
    return;
  }
  if (/^\d+$/.test(head)) {
    const n = Number(head);
    const rest = inner.slice(head.length);
    const recordStop = () => { if (!seen.has(n)) seen.set(n, null); };
    if (rest === '') {
      recordStop(); // ${n} bare brace form still counts as a stop
    } else if (rest.startsWith(':')) {
      const text = inner.slice(head.length + 1);
      if (n === 0) warn(file, name, '${0:...} has a placeholder; $0 should be a bare final cursor position');
      const prev = seen.get(n);
      if (prev !== undefined && prev !== null && prev !== text) {
        err(file, name, `tabstop $${n} defined twice with different placeholders: ${JSON.stringify(prev)} vs ${JSON.stringify(text)}`);
      }
      if (prev === undefined || prev === null) seen.set(n, text);
      // Recurse into placeholder text so nested ${...}/$N are validated too
      if (depth < 10) checkBodyGrammar(file, name, text, seen, depth + 1);
    } else if (rest.startsWith('|')) {
      recordStop();
      // choice: |a,b,c| — items non-empty; unescaped , or | only as separators
      if (!/^\|((\\.|[^|,])+)(,((\\.|[^|,])+))*\|$/.test(rest)) {
        err(file, name, `invalid choice syntax \`${inner}\` (must be \${1|a,b,c|})`);
      }
    } else if (rest.startsWith('/')) {
      recordStop();
      warn(file, name, `tabstop transform on $${n} (not deeply validated)`);
    }
  } else if (KNOWN_VARS.has(head)) {
    // variable, with optional :default or /transform — not deeply validated
  } else {
    // Unknown ${...} form. Without a default, VS Code resolves unknown
    // variables to an EMPTY string — silent deletion — so uppercase forms
    // (which look like intended snippet variables) are errors. With a
    // :default the text still renders (no cursor stop), so that is a warning.
    const hasDefault = inner.slice(head.length).startsWith(':');
    const looksLikeVar = /[A-Z]/.test(head) && head === head.toUpperCase();
    if (!hasDefault && looksLikeVar) {
      err(file, name, `unknown variable \`${inner}\` — VS Code expands it to an empty string (use a tabstop \${n} or add a default)`);
    } else {
      warn(file, name, `unknown variable \`${inner}\` — expands to default/literal text, not a cursor stop`);
    }
  }
}

function validateFile(file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(file, '', `invalid JSON: ${e.message}`);
    return;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    err(file, '', 'top-level must be an object');
    return;
  }
  const prefixes = new Map();
  const reportedDup = new Set();
  for (const [name, snip] of Object.entries(data)) {
    if (typeof snip !== 'object' || snip === null || Array.isArray(snip)) {
      err(file, name, 'snippet must be an object');
      continue;
    }
    // prefix
    let pfxs = snip.prefix;
    if (typeof pfxs === 'string') pfxs = [pfxs];
    if (!Array.isArray(pfxs) || pfxs.length === 0 || !pfxs.every((p) => typeof p === 'string' && p.length > 0)) {
      err(file, name, `invalid prefix: ${JSON.stringify(snip.prefix)}`);
    } else {
      for (const p of pfxs) {
        if (p !== p.trim()) err(file, name, `prefix has leading/trailing whitespace: ${JSON.stringify(p)}`);
        if (/^[\d\W]+$/.test(p)) warn(file, name, `prefix is only digits/punctuation: ${JSON.stringify(p)} (pollutes completion menus)`);
        if (prefixes.has(p)) {
          if (!reportedDup.has(p)) {
            reportedDup.add(p);
            err(file, name, `duplicate prefix ${JSON.stringify(p)} (also on "${prefixes.get(p)}")`);
          }
        } else prefixes.set(p, name);
      }
    }
    // body
    const body = snip.body;
    const isEmpty = body === '' || (Array.isArray(body) && body.length === 0);
    if (isEmpty) {
      err(file, name, 'empty body — snippet expands to nothing');
    } else if (typeof body === 'string') checkBodyGrammar(file, name, body, new Map());
    else if (Array.isArray(body) && body.every((l) => typeof l === 'string')) {
      // VS Code joins array bodies with \n before parsing; grammar is whole-body
      checkBodyGrammar(file, name, body.join('\n'), new Map());
    } else {
      err(file, name, `invalid body (must be string or string[]): ${JSON.stringify(body)?.slice(0, 60)}`);
    }
    // description
    if ('description' in snip && typeof snip.description !== 'string') {
      err(file, name, `description must be a string, got ${typeof snip.description}`);
    } else if (!('description' in snip)) {
      warn(file, name, 'missing description (consistency — reviews on #376, #232)');
    }
  }
}

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let targets = files;
if (!targets.length) {
  try {
    targets = execSync('git ls-files "snippets/**/*.json" "snippets/*.json"', { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
  } catch {
    console.error('no files given and not inside a git repo; pass snippet files as arguments');
    process.exit(2);
  }
}
for (const f of targets) validateFile(f);
console.log(`\n${targets.length} files checked: ${errors} errors, ${errorsOnly ? warnings + ' warnings (suppressed)' : warnings + ' warnings'}`);
process.exit(errors ? 1 : 0);
