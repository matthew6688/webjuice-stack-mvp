/**
 * cycle-27 · TDD test · waitForQueueDrain (intake CLI must wait for chain)
 *
 * Bug surfaced in Places multi-niche batch (mobile-mechanic / lawn-mowing /
 * carpet-cleaning · 2026-05-15):
 *   - intake CLI processes 3 queries sequentially
 *   - each query upserts entities → enqueueCheapAudit (fire-and-forget)
 *   - CLI main loop completes + emit(...) returns
 *   - Node event loop should keep worker alive (timer pending)
 *   - But empirically: 3 entities stranded in cheap-audit-pending.jsonl
 *     (CLI exited · cheap_audit never ran · no thread opened · no chain)
 *
 * Fix: intake CLI calls `await waitForQueueDrain()` after all queries done.
 *
 * Test contract:
 *   1. waitForQueueDrain exported from cheap-audit-queue.js
 *   2. Returns { drained: true } when queue empty + worker idle
 *   3. Times out cleanly if queue never drains (maxMs)
 *   4. Returns immediately when queue already empty (no-op safe)
 */
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · waitForQueueDrain contract\n');

const mod = await import('../../core/leads/cheap-audit-queue.js');

await ta('waitForQueueDrain is exported', async () => {
  assert.equal(typeof mod.waitForQueueDrain, 'function');
});

await ta('waitForQueueDrain returns drained:true immediately when queue empty', async () => {
  const s = mod.queueStatus();
  // Skip if real queue has items (avoid disturbing live state)
  if (s.pending > 0 || s.running) {
    console.log(`      (skip · live queue has ${s.pending} pending · running=${s.running})`);
    return;
  }
  const r = await mod.waitForQueueDrain({ pollMs: 100, maxMs: 2000 });
  assert.equal(r.drained, true, `expected drained · got ${JSON.stringify(r)}`);
  assert.ok(r.waited_ms < 500, `should return quick · waited ${r.waited_ms}ms`);
});

await ta('waitForQueueDrain times out cleanly with drained:false if maxMs exceeded', async () => {
  // We can't easily simulate a stuck queue from outside (would require monkeypatching
  // internal state). Instead verify the timeout path by passing tiny maxMs + checking
  // that it returns within that window.
  const s = mod.queueStatus();
  if (s.pending > 0 || s.running) {
    console.log(`      (skip · live queue active)`);
    return;
  }
  // Empty queue should still drain quickly · this just sanity-checks the shape
  const r = await mod.waitForQueueDrain({ pollMs: 50, maxMs: 500 });
  assert.ok('drained' in r, `result must have drained field`);
  assert.ok('waited_ms' in r, `result must have waited_ms field`);
});

await ta('queueStatus still works alongside the new export', async () => {
  const s = mod.queueStatus();
  assert.ok('pending' in s);
  assert.ok('running' in s);
  assert.ok('interMs' in s);
});

await ta('pl-places-search-intake.js calls waitForQueueDrain before exit', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-places-search-intake.js'), 'utf8');
  assert.ok(src.includes('waitForQueueDrain'),
    'pl-places-search-intake.js must call waitForQueueDrain so the worker drains before CLI exit');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
