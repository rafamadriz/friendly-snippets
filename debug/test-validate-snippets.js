#!/usr/bin/env node
/**
 * Test harness for debug/validate-snippets.js.
 *
 * Writes fixture snippet files to a temp dir, runs the validator as a
 * subprocess, and asserts that the expected ERROR/WARN diagnostics appear
 * (and that "clean" fixtures produce none).
 *
 * Usage: node debug/test-validate-snippets.js
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snipval-test-'));
const f = (name, objOrText) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, typeof objOrText === 'string' ? objOrText : JSON.stringify(objOrText, null, 2));
  return file;
};

// ---------------------------------------------------------------- clean cases
const CLEAN = f('clean.json', {
  'basic tabstops': {
    prefix: 'bas',
    body: ['${1:one} ${2:two} $0'],
    description: 'fine',
  },
  'same stop same text': {
    prefix: 'sst',
    body: 'x${1:foo}y${1:foo}z$0',
    description: 'repeated identical placeholder is allowed',
  },
  'simple stop reuse': {
    prefix: 'ssr',
    body: ['${1:var}', 'print($1)', '$0'],
    description: 'mirror via bare $1',
  },
  nested: {
    prefix: 'nst',
    body: ['${1:outer ${2:inner} done} $0'],
    description: 'nested placeholders validated recursively',
  },
  choices: {
    prefix: 'cho',
    body: ['${1|a,b,c|} ${2|yes,no|} $0'],
    description: 'valid choice syntax',
  },
  variables: {
    prefix: 'var',
    body: ['${TM_FILENAME_BASE} $CURRENT_YEAR ${RELATIVE_FILEPATH:unused default} $0'],
    description: 'known variables with optional defaults',
  },
  escaped: {
    prefix: 'esc',
    body: ['\\$HOME \\${1} \\} \`code $0 block\`'],
    description: 'escapes and balanced code block',
  },
  shellLiterals: {
    prefix: 'sh',
    body: ['echo $(pwd) \\$1 \\$@ "$0"'],
    description: 'escaped shell vars, literal $(...) passes through',
  },
  stringBody: {
    prefix: 'str',
    body: 'just text ${1:with a stop}$0',
    description: 'string body form',
  },
  multilineBacktick: {
    prefix: 'mlb',
    body: ['const x = `starts', 'and $0 ends`'],
    description: 'code block spanning array lines',
  },
  prefixArray: {
    prefix: ['pa1', 'pa2'],
    body: ['$0'],
    description: 'array of prefixes',
  },
});

// -------------------------------------------------------------- broken cases
// Each entry: [snippet object, expected substring of one diagnostic]
const BROKEN = [
  [{ prefix: 'dup', body: '$0', description: '' }, null], // baseline, no issue
  [{ prefix: ' ', body: '$0', description: 'x' }, 'leading/trailing whitespace'],
  [{ prefix: '1', body: '$0', description: 'x' }, 'only digits/punctuation'],
  [{ prefix: 'ok', body: '$0', description: 42 }, 'description must be a string'],
  [{ prefix: 'ok2', body: [42], description: 'x' }, 'invalid body'],
  [{ prefix: '', body: '$0', description: 'x' }, 'invalid prefix'],
  [{ body: '$0', description: 'x' }, 'invalid prefix'],
  [{ prefix: 'k1', body: '$0' }, 'missing description'], // warn
  [{ prefix: 'k2', body: '${1:one} ${1:two} $0', description: 'x' }, 'defined twice with different placeholders'],
  [{ prefix: 'k3', body: ['${1:a}', '${2:b}', '${4:d} $0'], description: 'x' }, 'skip values'],
  [{ prefix: 'k4', body: '${0:final} $0', description: 'x' }, 'placeholder; $0 should be'],
  [{ prefix: 'k5', body: '${SELECTION}', description: 'x' }, 'unknown variable `SELECTION`'],
  [{ prefix: 'k6', body: '$NOT_A_VAR $0', description: 'x' }, 'unknown variable $NOT_A_VAR'],
  [{ prefix: 'k7', body: '${1|a,b} $0', description: 'x' }, 'invalid choice syntax'],
  [{ prefix: 'k8', body: '${1|,} $0', description: 'x' }, 'invalid choice syntax'],
  [{ prefix: 'k9', body: '${1:unclosed ${2:x} $0', description: 'x' }, 'unbalanced ${ ... }'],
  [{ prefix: 'ka', body: 'ends with $', description: 'x' }, 'dangling $'],
  [{ prefix: 'kb', body: '`unclosed code $0', description: 'x' }, 'unbalanced backtick'],
  [{ prefix: 'kc', body: '${1:outer ${2:in} ${1:conflict}} $0', description: 'x' }, 'defined twice with different placeholders'],
  [{ prefix: 'kd', body: '$HOME is literal in shell $0', description: 'x' }, 'unknown variable $HOME'],
  [{ prefix: 'ke', body: '${module:MyModule} $0', description: 'x' }, 'unknown variable `module:MyModule`'],
  [{ prefix: 'kf', body: '$home is lowercase $0', description: 'x' }, 'lowercase variable'],
  [{ prefix: 'kg', body: '${1/(.*)/${1:/upcase}/} $0', description: 'x' }, 'not deeply validated'],
  [{ prefix: 'kh', body: '${NAME} $0', description: 'x' }, 'expands it to an empty string'],
  [{ prefix: 'ki', body: '${2} ${4} $0', description: 'x' }, 'skip values'],
  [{ prefix: 'kj', body: '$${1:i} $${1:j} $0', description: 'x' }, 'defined twice with different placeholders'],
  [{ prefix: 'kk', body: '${1 } $0', description: 'x' }, 'whitespace in head'],
  [{ prefix: 'kl', body: [], description: 'x' }, 'empty body'],
];

const brokenObjs = { snip0: { prefix: 'dup', body: '$0', description: '' } }; // baseline; also the first 'dup' prefix
BROKEN.forEach(([snip], idx) => { brokenObjs[`snip${idx}`] = snip; });
brokenObjs['snipDupB'] = { prefix: 'dup', body: '$0', description: 'x' }; // second 'dup' → duplicate-prefix error
const BAD = f('broken.json', brokenObjs);
const INVALID_JSON = f('invalid.json', '{ "oops": ');

// ------------------------------------------------------------------ run it
const run = (files) => {
  const r = spawnSync('node', ['debug/validate-snippets.js', ...files], {
    encoding: 'utf8', cwd: path.join(import.meta.dirname, '..'),
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ''}`); }
};

console.log('== clean fixture ==');
const rClean = run([CLEAN]);
const cleanDiags = rClean.out.split('\n').filter((l) => /^(ERROR|WARN)/.test(l));
check('exit code 0', rClean.code === 0, `got ${rClean.code}`);
check('no diagnostics', cleanDiags.length === 0, cleanDiags.join(' | '));

console.log('== broken fixture ==');
const rBad = run([BAD]);
check('exit code 1', rBad.code === 1, `got ${rBad.code}`);
const badOut = rBad.out;
const diagFor = (key) => badOut.split('\n').filter((l) => /^(ERROR|WARN)/.test(l) && l.includes(`[${key}]`));
for (const [idx, [, expected]] of BROKEN.entries()) {
  const key = `snip${idx}`;
  const diags = diagFor(key);
  if (expected === null) {
    check(`${key}: no diagnostic expected`, diags.length === 0, diags.join(' | '));
  } else {
    check(`${key}: reports "${expected.slice(0, 40)}"`, diags.some((l) => l.includes(expected)),
      diags[0] || 'no diagnostic');
  }
}
check('duplicate prefix reported once', (badOut.match(/duplicate prefix "dup"/g) || []).length === 1);

console.log('== invalid JSON ==');
const rJson = run([INVALID_JSON]);
check('exit code 1', rJson.code === 1);
check('invalid JSON diagnostic', rJson.out.includes('invalid JSON'));

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
