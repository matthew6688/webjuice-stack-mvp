#!/usr/bin/env node
/**
 * V3 cycle-26 · Gate 1 · Static lint for Discord message literal duplication.
 *
 * Fails if:
 *   1. Any DEPRECATED_TERMS string appears in code (outside the contract file).
 *   2. Any 'Stage \d+/\d+' literal appears outside core/contracts/.
 *   3. Any banned phase tag ([预A] [预B] [预C]) appears in code.
 *
 * Run: `npm run lint:messages` (or pre-commit hook).
 * Exit 0 = clean. Exit 1 = violations (printed line-by-line).
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEPRECATED_TERMS } from '../../core/contracts/discord-messages.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const CONTRACT_PATH = path.join(ROOT, 'core/contracts/discord-messages.js');

// Directories to scan
const SCAN_DIRS = ['core', 'scripts'];
// Files to exclude (legacy archived / data / contract itself)
// LINT-WHITELIST: contract file owns the canonical strings; lint + doctor
// reference the banned terms in their own docstrings/scan logic.
// migrate-phase-rename.js MUST reference old value · it migrates it.
// pl-check-qualification.js keeps back-compat CLI alias --all-design-ready.
const LINT_WHITELIST = new Set([
  CONTRACT_PATH,
  path.join(ROOT, 'scripts/ops/lint-message-literals.js'),
  path.join(ROOT, 'scripts/cli/pl-cycle-doctor.js'),
  path.join(ROOT, 'scripts/ops/migrate-phase-rename.js'),
  path.join(ROOT, 'scripts/cli/pl-check-qualification.js'),
]);
const EXCLUDE = (p) =>
  LINT_WHITELIST.has(p) ||
  p.includes('/node_modules/') ||
  p.includes('/_archive/') ||
  p.includes('/data/') ||
  p.includes('/.git/') ||
  // cycle-26 TDD tests intentionally reference banned strings to verify rejection
  /\/scripts\/test\/test-cycle26-/.test(p);

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (EXCLUDE(full)) continue;
    if (f.isDirectory()) walk(full, out);
    else if (f.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// Regex literals we ban OUTSIDE the contract file.
const REGEX_RULES = [
  { id: 'stage_literal', re: /Stage\s+\d+\/\d+/g, msg: 'literal "Stage X/Y" · import STAGE_LABELS from contracts/discord-messages.js' },
  { id: 'predict_phase_tag', re: /\[预[ABC]\]/g, msg: 'banned predict-phase tag [预A|预B|预C] · cycle-23 deprecated · use GRADE_TAGS' },
];

const violations = [];
const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');

  // Rule 1 · DEPRECATED_TERMS literal scan
  for (const term of DEPRECATED_TERMS) {
    let idx = 0;
    while ((idx = text.indexOf(term, idx)) !== -1) {
      const lineNo = text.slice(0, idx).split('\n').length;
      violations.push({
        file: path.relative(ROOT, file),
        line: lineNo,
        rule: 'deprecated_term',
        term,
        context: lines[lineNo - 1]?.trim().slice(0, 120),
      });
      idx += term.length;
    }
  }

  // Rule 2 · regex bans
  for (const rule of REGEX_RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      const lineNo = text.slice(0, m.index).split('\n').length;
      violations.push({
        file: path.relative(ROOT, file),
        line: lineNo,
        rule: rule.id,
        term: m[0],
        context: lines[lineNo - 1]?.trim().slice(0, 120),
        hint: rule.msg,
      });
    }
  }
}

if (violations.length === 0) {
  console.log(`✓ lint-message-literals: 0 violations across ${files.length} files`);
  process.exit(0);
}

// Group by file for readable output
const byFile = {};
for (const v of violations) (byFile[v.file] ??= []).push(v);

console.log(`✗ lint-message-literals: ${violations.length} violations in ${Object.keys(byFile).length} files`);
console.log();
for (const f of Object.keys(byFile).sort()) {
  console.log(`  ${f}`);
  for (const v of byFile[f]) {
    console.log(`    L${v.line}  [${v.rule}]  "${v.term}"`);
    if (v.context) console.log(`           > ${v.context}`);
    if (v.hint) console.log(`           ↳ ${v.hint}`);
  }
  console.log();
}
process.exit(1);
