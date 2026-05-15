/**
 * cycle-27 · TDD test · `mutateBatchState` lock-protected helper
 *
 * Bug surfaced in 4 consecutive batches (newcastle / adelaide / central-coast /
 * launceston · 2026-05-15): 50-80% of archived entities silently absent from
 * batch.entities[]. Lock + recordEntityTerminal verified correct in isolation.
 *
 * Root cause: `finalizeBatch` (and `postStageUpdate`) do `readBatchState`
 * → mutate → `writeBatchState` WITHOUT the lock. Their stale snapshots clobber
 * recordEntityTerminal's entity additions that happen concurrently.
 *
 * Fix: `mutateBatchState(batchId, mutator)` · acquire lock · read · apply
 * mutator · write · release. Replaces ad-hoc r-m-w in postStageUpdate +
 * finalizeBatch + any other call sites.
 *
 * Contract:
 *   1. mutateBatchState exported · async (lock-aware)
 *   2. Mutator receives the latest bs · returns it (or undefined) · gets persisted
 *   3. Concurrent mutateBatchState calls all land (no clobber)
 *   4. postStageUpdate source uses mutateBatchState (or acquireBatchStateLock)
 *   5. finalizeBatch source uses mutateBatchState (or acquireBatchStateLock)
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

console.log('cycle-27 · mutateBatchState lock helper\n');

process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN = 'test-token';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle27-mutate-'));
const origCwd = process.cwd();
fs.mkdirSync(path.join(tmp, 'data/v2/pipeline-batches'), { recursive: true });
process.chdir(tmp);

const mod = await import('../../core/funnel/pipeline-batch-thread.js');

// ─── T1 · exported ────────────────────────────────────────────────
await ta('mutateBatchState exported as async function', async () => {
  assert.equal(typeof mod.mutateBatchState, 'function');
});

// ─── T2 · basic mutate ────────────────────────────────────────────
await ta('mutateBatchState reads latest · applies mutator · persists', async () => {
  const id = 'mut-basic';
  fs.writeFileSync(mod.batchStatePath(id), JSON.stringify({
    batch_id: id, batchId: id, thread_id: '1', stages: [], entities: [],
  }, null, 2));
  await mod.mutateBatchState(id, (bs) => {
    bs.finished_at = '2026-05-15T10:00:00Z';
    bs.stages.push({ stage: 'test', status: 'ok' });
  });
  const after = mod.readBatchState(id);
  assert.equal(after.finished_at, '2026-05-15T10:00:00Z');
  assert.equal(after.stages.length, 1);
});

// ─── T3 · concurrent mutators all land (no clobber) ──────────────
await ta('5 concurrent mutateBatchState calls all land', async () => {
  const id = 'mut-concurrent';
  fs.writeFileSync(mod.batchStatePath(id), JSON.stringify({
    batch_id: id, batchId: id, thread_id: '1', stages: [], entities: [],
  }, null, 2));
  const tasks = [1, 2, 3, 4, 5].map((n) => mod.mutateBatchState(id, (bs) => {
    bs.entities = bs.entities || [];
    bs.entities.push({ entityKey: `e_${n}`, phase: 'archived' });
  }));
  await Promise.all(tasks);
  const after = mod.readBatchState(id);
  const keys = after.entities.map((e) => e.entityKey).sort();
  assert.deepEqual(keys, ['e_1', 'e_2', 'e_3', 'e_4', 'e_5'],
    `expected 5 entities · got ${JSON.stringify(keys)}`);
});

// ─── T4 · postStageUpdate uses lock (or mutateBatchState) ────────
await ta('postStageUpdate uses acquireBatchStateLock or mutateBatchState', async () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'core/funnel/pipeline-batch-thread.js'), 'utf8');
  const fnBody = src.split('export async function postStageUpdate')[1] || '';
  const fnSlice = fnBody.split('export ')[0]; // body up to next export
  const usesLock = /acquireBatchStateLock|mutateBatchState/.test(fnSlice);
  assert.ok(usesLock,
    'postStageUpdate must wrap its read-modify-write in a lock · concurrent recordEntityTerminal otherwise clobbers stages[]');
});

// ─── T5 · finalizeBatch uses lock (or mutateBatchState) ──────────
await ta('finalizeBatch uses acquireBatchStateLock or mutateBatchState', async () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'core/funnel/pipeline-batch-thread.js'), 'utf8');
  const fnBody = src.split('export async function finalizeBatch')[1] || '';
  const fnSlice = fnBody.split('export ')[0];
  const usesLock = /acquireBatchStateLock|mutateBatchState/.test(fnSlice);
  assert.ok(usesLock,
    'finalizeBatch must lock-protect its trailing writeBatchState · otherwise stale snapshot clobbers entity records');
});

process.chdir(origCwd);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
