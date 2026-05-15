/**
 * cycle-27 bug #7 · cheap-audit-queue survivors (predict-C / queued-for-enrichment)
 * must record into batch.entities[] · otherwise KPI gate stalls forever waiting
 * for them.
 *
 * Current behavior:
 *   - predict-D / excluded → archiveLeadAsRejected → recordEntityTerminal ✓
 *   - predict-A / B (audit_now) → detailed-audit chain → records at chain end ✓
 *   - predict-C survivor → sits in phase=None · NEVER recorded
 *   - queued_for_enrichment → enrich task queued · NEVER recorded for THIS batch
 *
 * KPI gate stalls when batch has any predict-C or enrich-pending entity ·
 * operator must manually backfill.
 *
 * Fix: at end of cheap-audit-queue.processOne, call recordEntityTerminal with
 * a non-archive phase ('audit-pending' / 'enrich-pending') so the entity is
 * "accounted for" in batch.entities · KPI fires at expected_total.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 bug #7 · cheap-audit-queue records survivors\n');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

// ─── T1 · cheap-audit-queue calls recordEntityTerminal in survivor branch ────
t('cheap-audit-queue source calls recordEntityTerminal for predict-C survivor', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/leads/cheap-audit-queue.js'), 'utf8');
  // Survivor branch is after the exclusion.excluded return (line ~245).
  const after = src.split('// Branch by exclusion verdict')[1] || '';
  assert.ok(after.includes('recordEntityTerminal'),
    'cheap-audit-queue must call recordEntityTerminal for predict-C / queued_for_enrichment survivors');
});

// ─── T2 · KPI categorizer recognizes new phases ────────────────────────────
t('kpi-dashboard categorize() handles audit-pending + enrich-pending', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/funnel/kpi-dashboard.js'), 'utf8');
  assert.ok(/audit[_-]pending/.test(src), 'kpi-dashboard must handle audit-pending phase');
  assert.ok(/enrich[_-]pending/.test(src), 'kpi-dashboard must handle enrich-pending phase');
});

// ─── T3 · buildKpiDashboard surfaces audit-pending / enrich-pending counts ──
import('../../core/funnel/kpi-dashboard.js').then((mod) => {
  t('buildKpiDashboard renders audit-pending + enrich-pending lines', () => {
    const body = mod.buildKpiDashboard({
      batchState: { niche: 'roofer', city: 'sydney', started_at: '2026-05-15T10:00:00Z', finalized_at: '2026-05-15T10:05:00Z' },
      entities: [
        { entityKey: 'a', phase: 'archived', grade: 'D' },
        { entityKey: 'b', phase: 'audit-pending', grade: 'C', name: 'B' },
        { entityKey: 'c', phase: 'enrich-pending', name: 'C' },
        { entityKey: 'd', phase: 'outreach-active', grade: 'C', name: 'D' },
        { entityKey: 'e', phase: 'ready-to-build', grade: 'B', name: 'E' },
      ],
    });
    // KPI should categorize entities and show counts
    assert.ok(/audit-pending|Audit pending/i.test(body) || /冷队列|cold/i.test(body),
      `KPI should mention audit-pending · body: ${body}`);
    assert.ok(/enrich-pending|enrich/i.test(body),
      'KPI should mention enrich-pending');
  });
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
});
