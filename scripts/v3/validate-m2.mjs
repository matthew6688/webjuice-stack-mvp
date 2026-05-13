#!/usr/bin/env node
// V3 M2 总验收 · 跑 10 deliverable test · 汇总到 data/qa/m2-validation-summary.json
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const QA = path.join(REPO, 'data', 'qa');

const TESTS = [
  ['M2-D1', 'test-m2-d1-rescore-all.mjs'],
  ['M2-D2', 'test-m2-d2-reviews-cascade.mjs'],
  ['M2-D3', 'test-m2-d3-c-grade-thread.mjs'],
  ['M2-D4', 'test-m2-d4-batch-send.mjs'],
  ['M2-D5', 'test-m2-d5-staleness.mjs'],
  ['M2-D6', 'test-m2-d6-master-md.mjs'],
  ['M2-D7', 'test-m2-d7-od-prep.mjs'],
  ['M2-D8', 'test-m2-d8-forum-tags.mjs'],
  ['M2-D9', 'test-m2-d9-customer-audience.mjs'],
  ['M2-D10', 'test-m2-d10-v2-structure.mjs'],
];

const summary = { overall: 'PASS', tested_at: new Date().toISOString(), deliverables: {} };

console.log('━━━ M2 validation ━━━\n');
for (const [id, file] of TESTS) {
  console.log(`\n[${id}] ${file}`);
  const out = spawnSync('node', [path.join(__dirname, file)], {
    cwd: REPO, encoding: 'utf8', stdio: 'inherit',
  });
  const idLow = id.toLowerCase();
  // Require trailing dash so m2-d1 doesn't match m2-d10 evidence file.
  const prefix = idLow + '-';
  const candidates = fs.existsSync(QA) ? fs.readdirSync(QA).filter(f => f.startsWith(prefix)) : [];
  let evidence = null;
  if (candidates[0]) {
    try { evidence = JSON.parse(fs.readFileSync(path.join(QA, candidates[0]), 'utf8')); } catch {}
  }
  summary.deliverables[id] = {
    status: out.status === 0 ? 'PASS' : 'FAIL',
    exit_code: out.status,
    tests: evidence?.total || null,
    passed: evidence?.passed || null,
    skipped: evidence?.skipped || null,
    failed: evidence?.failed || null,
    evidence_file: candidates[0] ? `data/qa/${candidates[0]}` : null,
  };
  if (out.status !== 0) summary.overall = 'FAIL';
}

const outPath = path.join(QA, 'm2-validation-summary.json');
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

console.log('\n━━━ M2 SUMMARY ━━━');
for (const [id, r] of Object.entries(summary.deliverables)) {
  const tag = r.status === 'PASS' ? '✓' : '✗';
  console.log(`  ${tag} ${id} · ${r.status} · ${r.passed ?? '?'}/${r.tests ?? '?'} passed`);
}
console.log(`\nOverall: ${summary.overall}`);
console.log(`Summary: ${outPath}`);
process.exit(summary.overall === 'PASS' ? 0 : 1);
