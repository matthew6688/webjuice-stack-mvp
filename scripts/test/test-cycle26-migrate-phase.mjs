/**
 * cycle-26 · TDD test 5/5 · Phase rename migration.
 *
 * Verifies scripts/ops/migrate-phase-rename.js:
 *   - Exports runMigration({ storeRoot, dryRun }) → { scanned, migrated, samples }
 *   - In dry-run: counts entities with phase='design-ready' · does NOT write
 *   - In live:    rewrites entity.phase = 'audit-ready' atomically
 *   - Idempotent: 2nd run reports 0 migrated
 *
 * Pre-Phase-B: FAILS (file doesn't exist).
 * Post-Phase-B: PASSES.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let passed = 0, failed = 0;
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 5/5 · migrate-phase-rename\n');

let mod;
try { mod = await import('../../scripts/ops/migrate-phase-rename.js'); }
catch (e) { mod = { __err: e.message }; }

t('migration module loads', () => {
  assert.ok(!mod.__err, `import failed: ${mod.__err}`);
});
t('runMigration exported', () => {
  assert.equal(typeof mod.runMigration, 'function');
});

if (typeof mod.runMigration !== 'function') {
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(1);
}

// ─── Build isolated fixture store ───────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle26-migrate-'));
const ENTITIES_DIR = path.join(TMP, 'entities');
fs.mkdirSync(ENTITIES_DIR, { recursive: true });

const FIXTURES = [
  { key: 'fx_old_1',    phase: 'design-ready' },
  { key: 'fx_old_2',    phase: 'design-ready' },
  { key: 'fx_already',  phase: 'audit-ready' },
  { key: 'fx_other',    phase: 'ready-to-build' },
  { key: 'fx_archived', phase: 'archived' },
];
for (const f of FIXTURES) {
  fs.writeFileSync(path.join(ENTITIES_DIR, `${f.key}.json`), JSON.stringify({ key: f.key, phase: f.phase, latest: { name: f.key } }, null, 2));
}

await ta('dry-run reports 2 candidates · writes nothing', async () => {
  const r = await mod.runMigration({ storeRoot: TMP, dryRun: true });
  assert.equal(r.scanned, 5);
  assert.equal(r.migrated, 2, `expected 2 design-ready entities, got ${r.migrated}`);
  // verify untouched
  const e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, 'fx_old_1.json'), 'utf8'));
  assert.equal(e.phase, 'design-ready', `dry-run should not write · phase still ${e.phase}`);
});

await ta('live run migrates 2 entities · phase=audit-ready', async () => {
  const r = await mod.runMigration({ storeRoot: TMP, dryRun: false });
  assert.equal(r.migrated, 2);
  const e1 = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, 'fx_old_1.json'), 'utf8'));
  const e2 = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, 'fx_old_2.json'), 'utf8'));
  assert.equal(e1.phase, 'audit-ready');
  assert.equal(e2.phase, 'audit-ready');
});

await ta('idempotent · 2nd run migrates 0', async () => {
  const r = await mod.runMigration({ storeRoot: TMP, dryRun: false });
  assert.equal(r.migrated, 0);
});

await ta('non-matching entities untouched', async () => {
  const e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, 'fx_other.json'), 'utf8'));
  assert.equal(e.phase, 'ready-to-build');
  const e2 = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, 'fx_archived.json'), 'utf8'));
  assert.equal(e2.phase, 'archived');
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
