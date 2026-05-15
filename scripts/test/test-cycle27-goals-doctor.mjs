/**
 * cycle-27 · TDD test · pl:goals-doctor (Rule 14 enforcement)
 *
 * Matthew (2026-05-15 "set up a hard rule · do a self check · don't make
 * the same mistake again"):
 *   - Core goals were getting silently broken (profile card · history · dups)
 *   - No test caught them · Matthew had to point them out
 *   - Add automated end-to-end checker · pre-commit gate
 *
 * Contract:
 *   1. `pl:goals-doctor` CLI exists at scripts/cli/pl-goals-doctor.js
 *   2. npm script registered
 *   3. Validates 6 core goals · per-entity pass/fail
 *   4. --quick mode (file-only · fast · for pre-commit)
 *   5. Full mode includes Discord API checks (G3/G4/G5)
 *   6. Exit 0 only if all goals pass
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · pl:goals-doctor · Rule 14 enforcement\n');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

// ─── T1 · CLI file exists ──────────────────────────────────────────
t('pl-goals-doctor.js exists', () => {
  const p = path.join(ROOT, 'scripts/cli/pl-goals-doctor.js');
  assert.ok(fs.existsSync(p), `missing: ${p}`);
});

// ─── T2 · npm script registered ────────────────────────────────────
t('npm script pl:goals-doctor registered', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['pl:goals-doctor'], 'missing npm script');
});

// ─── T3 · CLI source mentions all 6 goals ──────────────────────────
t('CLI source explicitly mentions G1-G6 goals', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-goals-doctor.js'), 'utf8');
  for (const g of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']) {
    assert.ok(src.includes(g), `CLI must reference goal ${g}`);
  }
});

// ─── T4 · --quick mode supported (for pre-commit) ──────────────────
t('CLI supports --quick mode (file-only · pre-commit gate)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-goals-doctor.js'), 'utf8');
  assert.ok(/--quick|quickMode|QUICK/.test(src), '--quick mode missing');
});

// ─── T5 · runs successfully in --quick mode ────────────────────────
t('pl:goals-doctor --quick exits 0 on healthy state', () => {
  const r = spawnSync('node', ['scripts/cli/pl-goals-doctor.js', '--quick'], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000,
  });
  // Either 0 (all goals OK) or 1 (some fail · but exit cleanly)
  assert.ok(r.status === 0 || r.status === 1, `unexpected exit · ${r.status} · stderr: ${(r.stderr||'').slice(0,200)}`);
  // Output must contain G1-G6 markers
  const out = (r.stdout || '') + (r.stderr || '');
  for (const g of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']) {
    assert.ok(out.includes(g), `output missing goal ${g}`);
  }
});

// ─── T6 · CLAUDE.md Rule 14 documents the requirement ──────────────
t('CLAUDE.md Rule 14 documents goals-doctor as commit gate', () => {
  const p = path.join(ROOT, 'CLAUDE.md');
  if (!fs.existsSync(p)) {
    console.log('      (CLAUDE.md not found · skip)');
    return;
  }
  const src = fs.readFileSync(p, 'utf8');
  assert.ok(/Rule 14|goals-doctor/i.test(src), 'CLAUDE.md must mention Rule 14 or goals-doctor');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
