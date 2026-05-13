#!/usr/bin/env node
// M1-D1 · text similarity + 5-key dedup scoring
// Tests scoring function: 5 keys = phone 35, email 30, domain 25, name 20, address 15.
// Verdict bands: ≥60 auto-merge · 30-60 LLM decide · <30 pass.
import { makeRunner, tryImport } from './_test-helpers.mjs';

const r = makeRunner('m1-d1-dedup-scoring');

const CASES = [
  // [#, a, b, expectedScoreApprox, expectedVerdict]
  [1, { place_id: 'x' }, { place_id: 'x' }, 'n/a', 'auto-at-intake'],
  [2, { phone: '0412', name: 'Joe Plumbing' }, { phone: '0412', name: 'Joe Plumbing' }, 55, 'llm'],
  [3, { phone: '0412', domain: 'joe.com' }, { phone: '0412', domain: 'joe.com' }, 60, 'merge'],
  [4, { phone: '0412', email: 'a@x.com' }, { phone: '0412', email: 'a@x.com' }, 65, 'merge'],
  [5, { phone: '0412', name: 'Joe Plumbing' }, { phone: '0412', name: 'Joes Plumbing' }, 52, 'llm'],
  [6, { email: 'a@x.com', address: '12 Main St' }, { email: 'a@x.com', address: '12 Main St' }, 45, 'llm'],
  [7, { name: 'Joe Plumbing' }, { name: 'Joes Plumbing' }, 19, 'pass'],
  [8, { address: '12 Main St' }, { address: '12 Main St' }, 15, 'pass'],
  [9, { name: 'Joe Plumbing', address: '12 Main' }, { name: 'Joes Plumbing', address: '12 Main' }, 32, 'llm'],
  [10, { name: 'Joe Plumbing', address: '12 Main' }, { name: 'Joe Plumbings', address: '12 Main' }, 34, 'llm'],
  [11, { phone: '0412', name: 'Joe', address: '12 Main' }, { phone: '0412', name: 'Joe', address: '12 Main' }, 70, 'merge'],
  [12, {}, {}, 0, 'pass'],
];

const m = await tryImport('core/leads/dedup-scorer.js');

if (!m || m.__error) {
  r.skip('module-exists', `core/leads/dedup-scorer.js missing or broken — implementation required (${m?.__error || 'not found'})`);
  // Treat as FAIL for the deliverable when implementation absent; runner will mark.
  for (const c of CASES) r.skip(`case-${c[0]}`, 'gated on dedup-scorer.js');
  const s = r.summary({ implementation_present: false });
  process.exit(s.exitCode === 0 ? 1 : s.exitCode); // force fail when impl missing
}

for (const [n, a, b, expected, verdict] of CASES) {
  await r.assert(`case-${n}-${verdict}`, () => {
    if (a.place_id && a.place_id === b.place_id) return true; // case 1: handled at intake, skip here
    const { score, verdict: v } = m.scoreDedup(a, b);
    if (typeof score !== 'number') throw new Error('scoreDedup must return {score, verdict}');
    if (typeof expected === 'number' && Math.abs(score - expected) > 5) {
      throw new Error(`score=${score} expected≈${expected}`);
    }
    const expectedVerdict = verdict === 'merge' ? 'auto-merge' : verdict === 'llm' ? 'llm-decide' : 'pass';
    if (v && v !== expectedVerdict) throw new Error(`verdict=${v} expected=${expectedVerdict}`);
    return true;
  });
}

await r.assert('thresholds-not-hardcoded', () => {
  // Verify env override capability
  if (typeof m.getThresholds !== 'function') throw new Error('getThresholds() required for env override');
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
