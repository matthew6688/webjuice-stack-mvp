/**
 * cycle-26 · TDD test 27 · batch.entities[] terminal-state recorder.
 *
 * Bug class: KPI dashboard never fired in E2E (plumbers / gold coast / 3)
 * because pl-check-qualification.js set phase=ready-to-build but did NOT
 * push to batch.entities[]. Only D-archive path did. So entities.length
 * stayed at 2/3 forever · KPI gate (length >= expected_total) failed.
 *
 * Contract: every terminal-eligible verdict (archived / ready-to-build /
 * qa-pending / published) must record into batch.entities[] via a single
 * helper · `recordEntityTerminal`. Helper:
 *   - reads/writes batch state idempotently
 *   - upserts entry by entityKey
 *   - fires KPI dashboard once entities.length >= expected_total
 *
 * Tests:
 *   1. helper exists + is exported from pipeline-batch-thread.js
 *   2. records entry into batch.entities[] (insert)
 *   3. updates existing entry by entityKey (no duplicate)
 *   4. fires KPI dashboard exactly once when threshold met
 *   5. does NOT fire KPI if entities.length < expected_total
 *   6. pl-check-qualification.js calls helper on ready-to-build verdict
 *   7. terminal-archive.js calls helper (no regression)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 27/27 · batch terminal-state recorder\n');

process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN = 'test-token';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

// ─── T1 · helper exists & exported ─────────────────────────────────────────
const mod = await import('../../core/funnel/pipeline-batch-thread.js');
t('recordEntityTerminal is exported from pipeline-batch-thread.js', () => {
  assert.equal(typeof mod.recordEntityTerminal, 'function',
    'recordEntityTerminal must be exported');
});

// Temp batch dir for isolation
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle26-batch-recorder-'));
const origCwd = process.cwd();
const stateDir = path.join(tmp, 'data/v2/pipeline-batches');
fs.mkdirSync(stateDir, { recursive: true });

// Stub state file
const batchId = 'pipe-test-recorder-001';
const statePath = path.join(stateDir, `${batchId}.json`);
fs.writeFileSync(statePath, JSON.stringify({
  batch_id: batchId,
  batchId,
  thread_id: '1234567890',
  expected_total: 3,
  entities: [],
  niche: 'test',
  city: 'test',
}, null, 2));

process.chdir(tmp);

const kpiCalls = [];
const fetchImpl = async (url, opts = {}) => {
  if (opts.method === 'POST') {
    kpiCalls.push({ url, body: opts.body });
    return { ok: true, status: 200, text: async () => '{}' };
  }
  if (opts.method === 'PATCH') return { ok: true, status: 200, text: async () => '{}' };
  return { ok: true, status: 200, json: async () => ({ thread_metadata: { archived: false, locked: false } }) };
};

// ─── T2 · inserts entry ─────────────────────────────────────────────────────
await ta('recordEntityTerminal inserts entry into batch.entities[]', async () => {
  await mod.recordEntityTerminal({
    batchId,
    entityKey: 'domain_one.com',
    name: 'One',
    phase: 'archived',
    grade: 'D',
    archive_reason: 'stage2_sitemap_too_large',
    fetchImpl,
  });
  const bs = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(bs.entities.length, 1, `expected 1 entry · got ${bs.entities.length}`);
  assert.equal(bs.entities[0].entityKey, 'domain_one.com');
  assert.equal(bs.entities[0].phase, 'archived');
});

// ─── T3 · upserts (no duplicate on same key) ───────────────────────────────
await ta('recordEntityTerminal upserts by entityKey · no duplicate', async () => {
  await mod.recordEntityTerminal({
    batchId,
    entityKey: 'domain_one.com',
    name: 'One',
    phase: 'archived',
    grade: 'D',
    archive_reason: 'stage2_sitemap_too_large',
    fetchImpl,
  });
  const bs = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(bs.entities.length, 1, `still 1 entry after upsert · got ${bs.entities.length}`);
});

// ─── T4 · does NOT fire KPI when below threshold ───────────────────────────
await ta('does NOT fire KPI dashboard when entities.length < expected_total', async () => {
  kpiCalls.length = 0;
  await mod.recordEntityTerminal({
    batchId,
    entityKey: 'domain_two.com',
    name: 'Two',
    phase: 'archived',
    grade: 'D',
    archive_reason: 'stage1_no_website',
    fetchImpl,
  });
  // 2/3 · should NOT fire
  const kpiFired = kpiCalls.some((c) => (c.body || '').includes('批次 KPI') || (c.body || '').includes('KPI'));
  assert.equal(kpiFired, false, 'KPI fired too early at 2/3');
});

// ─── T5 · fires KPI exactly once when threshold met ────────────────────────
await ta('fires KPI dashboard when entities.length >= expected_total', async () => {
  kpiCalls.length = 0;
  await mod.recordEntityTerminal({
    batchId,
    entityKey: 'domain_three.com',
    name: 'Three',
    phase: 'ready-to-build',
    grade: 'C',
    fetchImpl,
  });
  const kpiFired = kpiCalls.some((c) => (c.body || '').includes('KPI') || (c.body || '').includes('批次完成'));
  assert.equal(kpiFired, true, 'KPI did not fire at 3/3 expected_total');
});

process.chdir(origCwd);
fs.rmSync(tmp, { recursive: true, force: true });

// ─── T6 · pl-check-qualification.js wires the helper ───────────────────────
t('pl-check-qualification.js calls recordEntityTerminal on ready-to-build', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-check-qualification.js'), 'utf8');
  assert.ok(src.includes('recordEntityTerminal'),
    'pl-check-qualification.js must import + call recordEntityTerminal · KPI dashboard depends on it');
});

t('pl-check-qualification.js records both ready-to-build AND qa-pending', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-check-qualification.js'), 'utf8');
  // Must call helper for both non-archive verdicts (archive already covered by terminal-archive)
  const rtbIdx = src.indexOf("'ready-to-build'");
  const qaIdx = src.indexOf("'qa-pending'");
  const helperIdx = src.indexOf('recordEntityTerminal');
  assert.ok(rtbIdx > 0 && qaIdx > 0 && helperIdx > 0,
    'must reference both verdicts AND the helper');
});

// ─── T7 · terminal-archive still works (no regression) ─────────────────────
t('terminal-archive.js still records to batch.entities[] (regression guard)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/leads/terminal-archive.js'), 'utf8');
  assert.ok(
    src.includes('recordEntityTerminal') || src.includes('bs.entities.push') || src.includes('bs.entities[idx]'),
    'terminal-archive must still push to batch.entities[]');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
