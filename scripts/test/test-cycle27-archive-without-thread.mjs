/**
 * cycle-27 · TDD test · archiveLeadAsRejected records batch.entities[]
 *                       even when entity has NO discord_thread_id.
 *
 * Bug surfaced in Places API E2E (electrician/toowoomba):
 *   - L2 exclusion path: cheap-audit-queue.js detects "too many reviews"
 *     BEFORE opening lead thread (threads only open for SURVIVED)
 *   - archiveLeadAsRejected runs but skips batch.entities push because
 *     the entire push block is inside `if (entity.discord_thread_id)`
 *   - Consequence: batch.entities never reaches expected_total → KPI dashboard
 *     never fires
 *
 * Fix: batch.entities recording must run regardless of thread state.
 * Use `recordEntityTerminal` helper (cycle-26 cycle-27 extracted) ·
 * call it OUTSIDE the discord_thread_id branch.
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

console.log('cycle-27 · archive without thread · batch.entities invariant\n');

process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN = 'test-token';

// Sandbox · isolated cwd so we don't touch real store
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle27-no-thread-'));
const origCwd = process.cwd();

// Mirror project's storeRoot layout under tmp
fs.mkdirSync(path.join(tmp, 'data/leads/entities'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'data/leads/runs'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'data/v2/pipeline-batches'), { recursive: true });

const entityKey = 'place_test_no_thread_archive';
const batchId = 'places-test-batch-001';

// Entity has NO discord_thread_id (L2 excluded · cheap-audit-queue never opened thread)
const entity = {
  schemaVersion: 1,
  entityKey,
  latest: { name: 'Big Chain Electrician', city: 'Toowoomba', niche: 'electrician' },
  status: 'graded',
  phase: 'cheap-audited',
  batches: [batchId],
  exclusion_filter: {
    excluded: true,
    layer: 2,
    reason: '345 reviews > electrician 阈值 200 (大企业/连锁)',
    exclusions: [{ id: 'too_large', layer: 2 }],
  },
  // intentionally NO discord_thread_id
};
fs.writeFileSync(
  path.join(tmp, 'data/leads/entities', `${entityKey}.json`),
  JSON.stringify(entity, null, 2),
);

// Batch state · expected_total = 1 → 1 archive should fire KPI
const batchState = {
  batch_id: batchId,
  batchId,
  thread_id: '1234567890',
  expected_total: 1,
  entities: [],
  niche: 'electrician',
  city: 'toowoomba',
  started_at: new Date(Date.now() - 60_000).toISOString(),
};
fs.writeFileSync(
  path.join(tmp, 'data/v2/pipeline-batches', `${batchId}.json`),
  JSON.stringify(batchState, null, 2),
);

process.chdir(tmp);

// Inject fetchImpl mock via dry-run env (terminal-archive checks DRY_RUN to skip Discord side-effects)
process.env.PL_DRY_RUN_DISCORD = '1';

await ta('archiveLeadAsRejected pushes to batch.entities even when entity has NO thread', async () => {
  const { archiveLeadAsRejected } = await import('../../core/leads/terminal-archive.js');
  const r = await archiveLeadAsRejected(entityKey, {
    reason: '345 reviews > electrician 阈值 200',
    pathId: 'layer2_too_large',
    layer: 'Stage 1 · Layer 2',
    storeRoot: path.join(tmp, 'data/leads'),
  });
  assert.ok(r.ok, `archive should succeed · got ${JSON.stringify(r)}`);

  const bs = JSON.parse(fs.readFileSync(
    path.join(tmp, 'data/v2/pipeline-batches', `${batchId}.json`),
    'utf8',
  ));
  assert.equal(bs.entities.length, 1, `expected 1 entry · got ${bs.entities.length}`);
  assert.equal(bs.entities[0].entityKey, entityKey);
  assert.equal(bs.entities[0].phase, 'archived');
  assert.equal(bs.entities[0].grade, 'D');
});

await ta('archive without thread STILL fires KPI when batch.entities meets expected_total', async () => {
  const bs = JSON.parse(fs.readFileSync(
    path.join(tmp, 'data/v2/pipeline-batches', `${batchId}.json`),
    'utf8',
  ));
  // After archiving entity (1/1 expected), kpi_dashboard_posted_at marker should be set
  // (helper sets this once it tries to fire · regardless of whether Discord POST succeeded)
  assert.ok(bs.kpi_dashboard_posted_at,
    `kpi_dashboard_posted_at should be set · got ${bs.kpi_dashboard_posted_at}`);
});

process.chdir(origCwd);
delete process.env.PL_DRY_RUN_DISCORD;
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
