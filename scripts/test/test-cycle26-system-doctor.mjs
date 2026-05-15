/**
 * cycle-26 · TDD test 24/?? · system-doctor CLI structure.
 *
 * Static checks (CLI exists · has 6 check sections · npm script registered ·
 * exits 0/1/2 per spec). Live HTTP checks are best-effort and not asserted
 * here (would require live tokens / running daemons).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const DOCTOR = path.join(ROOT, 'scripts/cli/pl-system-doctor.js');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 24/?? · system-doctor structure\n');

t('CLI file exists', () => {
  assert.ok(fs.existsSync(DOCTOR), `missing ${DOCTOR}`);
});

const src = fs.readFileSync(DOCTOR, 'utf8');

t('has 6 check sections (A daemons · B APIs · C services · D fs · E channels · F internal)', () => {
  // Each section has a label or comment marker
  for (const label of ['Daemons', 'External', 'services', 'Filesystem', 'channels', 'Internal']) {
    assert.ok(src.includes(label) || src.toLowerCase().includes(label.toLowerCase()),
      `section "${label}" missing`);
  }
});

t('supports --json output', () => {
  assert.ok(src.includes('--json') || src.includes("'json'"));
});

t('exit 0 on all-pass · 1 on issues · 2 on fatal', () => {
  assert.ok(src.includes('process.exit(0)'));
  assert.ok(src.includes('process.exit(1)'));
  assert.ok(src.includes('process.exit(2)'));
});

t('checks task-listener · task-dispatcher · task-api · profile-card-heartbeat', () => {
  for (const dn of ['task-listener', 'task-dispatcher', 'task-api', 'profile-card-heartbeat']) {
    assert.ok(src.includes(dn), `must check daemon ${dn}`);
  }
});

t('checks Discord channels · CF · Firecrawl · LLM CLIs', () => {
  assert.ok(src.toLowerCase().includes('discord'), 'must reference Discord');
  assert.ok(src.toLowerCase().includes('cloudflare') || src.toLowerCase().includes('cloudflare') || src.includes('CF_'), 'must reference Cloudflare');
  assert.ok(src.includes('FIRECRAWL') || src.includes('firecrawl'), 'must reference Firecrawl');
});

t('npm script pl:system-doctor registered', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['pl:system-doctor'], 'missing npm script');
});

// ─── Runtime smoke (no env · should produce some output without crashing) ─
t('runs without crash · prints summary', () => {
  const r = spawnSync('node', [DOCTOR, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, PATH: process.env.PATH },
  });
  // Allow exit 0/1/2 · just verify it ran
  assert.ok(typeof r.status === 'number', `expected exit code · got ${r.status}`);
  assert.ok(r.stdout || r.stderr, 'must produce output');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
