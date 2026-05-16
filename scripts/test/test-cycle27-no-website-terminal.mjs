/**
 * cycle-27 · TDD test · audit pipeline records entity terminal when no website
 *
 * Matthew (2026-05-16 Bunbury Roofing + JK Murnane · 3rd recurrence):
 *   Entities with no website (starter_candidate · manual_review) survive
 *   cheap-audit, get audit_now=true, detailed audit enqueued. Detailed audit
 *   sees no URL · returns early with reason 'no website'. Entity stays
 *   phase=None forever · batch.entities never records · KPI gate stuck.
 *
 * Fix: run-audit-pipeline.js's "no website" branch must call
 *   recordEntityTerminal with phase='audit-pending' so KPI gate counts them.
 *
 * Contract:
 *   - run-audit-pipeline.js source references recordEntityTerminal in
 *     the no-website early-return branch
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · audit pipeline records starter-candidate (no website) as terminal\n');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'scripts/leads/run-audit-pipeline.js'), 'utf8');

t('no-website branch calls recordEntityTerminal', () => {
  // Find the no-website branch context
  const noWebsiteIdx = src.indexOf("no website URL on entity");
  assert.ok(noWebsiteIdx > 0, 'no-website warning line must exist');
  const slice = src.slice(noWebsiteIdx, noWebsiteIdx + 800);
  assert.ok(/recordEntityTerminal/.test(slice),
    'no-website branch must call recordEntityTerminal · otherwise batch.entities never gets the entry · KPI gate stalls');
});

t('starter-candidate / no-website phase = audit-pending or starter-ready', () => {
  const noWebsiteIdx = src.indexOf("no website URL on entity");
  const slice = src.slice(noWebsiteIdx, noWebsiteIdx + 800);
  assert.ok(/audit-pending|starter-ready|audit_pending/i.test(slice),
    'must record with phase audit-pending (or starter-ready) · KPI categorizes correctly');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
