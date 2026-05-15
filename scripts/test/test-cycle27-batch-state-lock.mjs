/**
 * cycle-27 · TDD test · concurrent recordEntityTerminal writes (file lock)
 *
 * Bug surfaced in roofer/gold-coast batch (2026-05-15):
 *   5 entities · 5 archives via terminal-archive · only 1-2 ended up in
 *   bs.entities[]. dispatcher spawns audit tasks in parallel processes ·
 *   each calls recordEntityTerminal → readBatchState → mutate → writeBatchState.
 *   Read-modify-write across processes is NOT atomic on the same file.
 *   Last-writer wins · earlier entities clobbered.
 *
 * Contract:
 *   1. `acquireBatchStateLock(batchId)` exists · returns release fn
 *   2. Lock is mutually exclusive (second caller waits for first)
 *   3. Stale lock detection (PID gone → lock free)
 *   4. Timeout if lock held too long (drops with error)
 *   5. recordEntityTerminal acquires + releases lock around read-modify-write
 *   6. Under 5 concurrent recordEntityTerminal calls, all 5 entities land
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

console.log('cycle-27 · batch state file lock (concurrent recordEntityTerminal)\n');

process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN = 'test-token';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle27-lock-'));
const origCwd = process.cwd();
fs.mkdirSync(path.join(tmp, 'data/v2/pipeline-batches'), { recursive: true });
process.chdir(tmp);

const mod = await import('../../core/funnel/pipeline-batch-thread.js');

// ─── T1 · acquireBatchStateLock exists ─────────────────────────────────
await ta('acquireBatchStateLock is exported', async () => {
  assert.equal(typeof mod.acquireBatchStateLock, 'function');
});

// ─── T2 · lock is mutually exclusive (timeout on second caller) ────────
await ta('acquireBatchStateLock blocks second concurrent caller until release', async () => {
  const batchId = 'lock-test-mutex';
  const release1 = await mod.acquireBatchStateLock(batchId, { maxMs: 1000, pollMs: 20 });
  let secondAcquired = false;
  const t0 = Date.now();
  const p2 = mod.acquireBatchStateLock(batchId, { maxMs: 2000, pollMs: 20 }).then((r) => {
    secondAcquired = true;
    r();
  });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(secondAcquired, false, 'second should block while first holds lock');
  release1();
  await p2;
  const waited = Date.now() - t0;
  assert.ok(secondAcquired, 'second should acquire after release');
  assert.ok(waited >= 150, `second waited <150ms · ${waited}ms · not mutually exclusive?`);
});

// ─── T3 · stale lock recovery (PID gone) ───────────────────────────────
await ta('acquireBatchStateLock detects stale lock (PID not alive) and recovers', async () => {
  const batchId = 'lock-test-stale';
  // Write fake lock with nonexistent PID
  const lockPath = mod.batchStatePath(batchId) + '.lock';
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, '999999999'); // PID extremely unlikely to exist
  const t0 = Date.now();
  const release = await mod.acquireBatchStateLock(batchId, { maxMs: 1000, pollMs: 30 });
  const waited = Date.now() - t0;
  assert.ok(waited < 500, `should recover stale lock fast · waited ${waited}ms`);
  release();
});

// ─── T4 · lock times out cleanly when held too long ────────────────────
await ta('acquireBatchStateLock times out with error if lock held too long', async () => {
  const batchId = 'lock-test-timeout';
  const release1 = await mod.acquireBatchStateLock(batchId, { maxMs: 500 });
  let thrown = null;
  try {
    await mod.acquireBatchStateLock(batchId, { maxMs: 200, pollMs: 50 });
  } catch (err) {
    thrown = err;
  }
  release1();
  assert.ok(thrown, 'should throw on timeout');
  assert.ok(/timeout|could not acquire/i.test(thrown.message), `message should mention timeout · got: ${thrown.message}`);
});

// ─── T5 · recordEntityTerminal uses the lock ───────────────────────────
await ta('recordEntityTerminal source references the lock helper', async () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'core/funnel/pipeline-batch-thread.js'), 'utf8');
  // The helper should acquire the lock before the read-modify-write block
  assert.ok(src.includes('acquireBatchStateLock'),
    'recordEntityTerminal must use acquireBatchStateLock to prevent concurrent clobber');
});

// ─── T6 · BIG · 5 concurrent recordEntityTerminal calls · all 5 land ──
await ta('5 concurrent recordEntityTerminal calls all land · no race', async () => {
  const batchId = 'concurrent-record-test';
  const statePath = mod.batchStatePath(batchId);
  // Seed batch state
  fs.writeFileSync(statePath, JSON.stringify({
    batch_id: batchId, batchId, thread_id: '1234567890',
    expected_total: 5, entities: [],
    niche: 'test', city: 'test',
  }, null, 2));

  // Fire 5 concurrent calls (Promise.all)
  const tasks = [1, 2, 3, 4, 5].map((n) =>
    mod.recordEntityTerminal({
      batchId,
      entityKey: `entity_${n}`,
      name: `Entity ${n}`,
      phase: 'archived',
      grade: 'D',
      archive_reason: `test_${n}`,
    })
  );
  const results = await Promise.all(tasks);
  for (const r of results) assert.ok(r.ok, `each call ok · got ${JSON.stringify(r)}`);

  // All 5 must be in batch.entities · regardless of which order they ran
  const bs = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const keys = bs.entities.map((e) => e.entityKey).sort();
  assert.deepEqual(keys, ['entity_1','entity_2','entity_3','entity_4','entity_5'],
    `all 5 must land · got: ${JSON.stringify(keys)}`);
});

process.chdir(origCwd);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
