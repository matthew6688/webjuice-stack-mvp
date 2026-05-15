/**
 * cycle-26 · TDD test 3/5 · Terminal-failure unifier.
 *
 * Verifies core/leads/terminal-archive.js exports archiveLeadAsRejected()
 * which atomically:
 *   - sets entity.grade = { grade: 'D', reason }
 *   - sets entity.phase = 'archived'
 *   - records entity.archive_reason
 *   - returns { ok, entity, threadAction } (threadAction can be a no-op in dry mode)
 *
 * Tests use --dry-run for thread side-effects (no Discord call).
 * Pre-Phase-B: FAILS (file doesn't exist).
 * Post-Phase-B: PASSES + each of 9 terminal-fail paths exercises the unifier.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TERMINAL_FAIL_PATHS, ENTITY_PHASE } from '../../core/contracts/discord-messages.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 3/5 · terminal-archive unifier\n');

// ─── A · Module + export exists ─────────────────────────────────────────────
let mod;
try { mod = await import('../../core/leads/terminal-archive.js'); }
catch (e) { mod = { __err: e.message }; }

t('terminal-archive.js module loads', () => {
  assert.ok(!mod.__err, `import failed: ${mod.__err}`);
});

t('archiveLeadAsRejected exported as function', () => {
  assert.equal(typeof mod.archiveLeadAsRejected, 'function');
});

if (typeof mod.archiveLeadAsRejected !== 'function') {
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(1);
}

// ─── B · Per-fixture: each of 9 terminal-fail paths ─────────────────────────
// Set up isolated test data dir
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle26-terminal-'));
const ENTITIES_DIR = path.join(TMP, 'leads', 'entities');
fs.mkdirSync(ENTITIES_DIR, { recursive: true });

function makeEntity(key, overrides = {}) {
  return {
    key,
    phase: 'awaiting',
    grade: null,
    latest: {
      name: `Test ${key}`,
      niche: 'plumbing',
      review_count: 25,
      rating: 4.5,
      phone: '0412345678',
      website: 'https://t.example',
    },
    ...overrides,
  };
}

function writeEntity(e) {
  fs.writeFileSync(path.join(ENTITIES_DIR, `${e.key}.json`), JSON.stringify(e, null, 2));
}
function readEntity(key) {
  return JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, `${key}.json`), 'utf8'));
}

for (const p of TERMINAL_FAIL_PATHS) {
  const key = `fixture_${p.id}`;
  writeEntity(makeEntity(key));

  await ta(`${p.id} · archiveLeadAsRejected sets phase=archived + grade.D`, async () => {
    const r = await mod.archiveLeadAsRejected(key, {
      reason: `test fixture: ${p.id}`,
      layer: p.stage,
      storeRoot: TMP + '/leads',  // isolated dir
      dryRun: true,                // no Discord call
    });
    assert.ok(r && r.ok, `expected ok=true, got: ${JSON.stringify(r).slice(0, 200)}`);
    const e = readEntity(key);
    assert.equal(e.phase, ENTITY_PHASE.ARCHIVED, `phase should be archived`);
    const g = typeof e.grade === 'string' ? e.grade : e.grade?.grade;
    assert.equal(g, 'D', `grade should be D · saw ${JSON.stringify(e.grade)}`);
    assert.ok(String(e.archive_reason || '').includes(p.id), `archive_reason should include path id "${p.id}" · saw "${e.archive_reason}"`);
  });
}

// ─── C · Contract: TERMINAL_FAIL_PATHS lists exactly 9 paths ─────────────────
t('TERMINAL_FAIL_PATHS has 10 entries (cycle-26 P5 added stage7_pregate_fail)', () => {
  assert.equal(TERMINAL_FAIL_PATHS.length, 10, `expected 10 terminal paths, got ${TERMINAL_FAIL_PATHS.length}`);
});
t('each terminal path has id + handler="archiveLeadAsRejected"', () => {
  for (const p of TERMINAL_FAIL_PATHS) {
    assert.ok(p.id, `path missing id: ${JSON.stringify(p)}`);
    assert.equal(p.handler, 'archiveLeadAsRejected', `path ${p.id} handler should be archiveLeadAsRejected`);
  }
});

// cleanup
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
