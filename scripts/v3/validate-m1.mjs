#!/usr/bin/env node
// V3 M1 总验收 · 跑 6 deliverable test · 汇总到 data/qa/m1-validation-summary.json
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const QA = path.join(REPO, 'data', 'qa');

const TESTS = [
  ['M1-D1', 'test-m1-d1-dedup-scoring.mjs'],
  ['M1-D2', 'test-m1-d2-discovery-score.mjs'],
  ['M1-D3', 'test-m1-d3-skill-discovery.mjs'],
  ['M1-D4', 'test-m1-d4-parseargs.mjs'],
  ['M1-D5', 'test-m1-d5-bulk-archive.mjs'],
  ['M1-D6', 'test-m1-d6-live-demo.mjs'],
];

const summary = { overall: 'PASS', tested_at: new Date().toISOString(), deliverables: {} };

console.log('━━━ M1 validation ━━━\n');
for (const [id, file] of TESTS) {
  console.log(`\n[${id}] ${file}`);
  const out = spawnSync('node', [path.join(__dirname, file)], {
    cwd: REPO, encoding: 'utf8', stdio: 'inherit',
  });
  const idLow = id.toLowerCase();
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

const outPath = path.join(QA, 'm1-validation-summary.json');
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

console.log('\n━━━ M1 SUMMARY ━━━');
for (const [id, r] of Object.entries(summary.deliverables)) {
  const tag = r.status === 'PASS' ? '✓' : '✗';
  console.log(`  ${tag} ${id} · ${r.status} · ${r.passed ?? '?'}/${r.tests ?? '?'} passed`);
}
console.log(`\nOverall: ${summary.overall}`);
console.log(`Summary: ${outPath}`);
process.exit(summary.overall === 'PASS' ? 0 : 1);
