#!/usr/bin/env node
/**
 * cycle-26 · TDD runner · runs all 5 tests · reports pass/fail per file.
 * Exit 0 only when all 5 pass.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TESTS = [
  'scripts/test/test-cycle26-stage-messages.mjs',
  'scripts/test/test-cycle26-profile-card.mjs',
  'scripts/test/test-cycle26-terminal-unifier.mjs',
  'scripts/test/test-cycle26-snapshot-classifier.mjs',
  'scripts/test/test-cycle26-migrate-phase.mjs',
  // cycle-26 expanded TDD (after E2E surfacing) · 4 added
  'scripts/test/test-cycle26-title-state-machine.mjs',
  'scripts/test/test-cycle26-batch-progress.mjs',
  'scripts/test/test-cycle26-stage7-format.mjs',
  'scripts/test/test-cycle26-cross-file-integrity.mjs',
  // cycle-26 master.md data lineage (covers SOP-MASTER-MD-DATA-LINEAGE.md spec)
  'scripts/test/test-cycle26-master-md-data-lineage.mjs',
  // cycle-26 asset integrity (publish 后 master.md + assets 必须 live)
  'scripts/test/test-cycle26-asset-integrity.mjs',
  // cycle-26 pipeline-end summary message (fix-of-record · 7 sections)
  'scripts/test/test-cycle26-pipeline-summary.mjs',
  // cycle-26 profile-card realtime refresh (writeEntity hook · 11 state-change paths)
  'scripts/test/test-cycle26-profile-card-realtime.mjs',
  // cycle-26 master.md frontmatter accuracy (entity values fidelity)
  'scripts/test/test-cycle26-master-md-accuracy.mjs',
  // cycle-26 master.md FULL population w/ real Ace Roofing production fixture
  'scripts/test/test-cycle26-master-md-full-population.mjs',
  // cycle-26 huashu HTML render fidelity (master.md → master.report.html structure parity)
  'scripts/test/test-cycle26-html-render-fidelity.mjs',
  // cycle-26 customer-facing audit · internal data isolation
  'scripts/test/test-cycle26-customer-audit-isolation.mjs',
  // cycle-26 internal audit report · completeness
  'scripts/test/test-cycle26-internal-audit-completeness.mjs',
  // cycle-26 3-way report consistency (master.md / customer / internal · same data)
  'scripts/test/test-cycle26-three-report-consistency.mjs',
  // cycle-26 P2 · profile-card verify-after-PATCH + retry on 429 / 5xx
  'scripts/test/test-cycle26-profile-card-verify.mjs',
  // cycle-26 P2.3 · heartbeat doctor static (drift-detection CLI exists)
  'scripts/test/test-cycle26-heartbeat-doctor.mjs',
  // cycle-26 P5 · skip-post on archived thread (prevents Discord auto-unarchive)
  'scripts/test/test-cycle26-skip-archived-post.mjs',
  // cycle-26 P5 · KPI dashboard message (replaces per-entity batch noise)
  'scripts/test/test-cycle26-kpi-dashboard.mjs',
  // cycle-26 P7 · system-doctor CLI (6-section health check)
  'scripts/test/test-cycle26-system-doctor.mjs',
  // cycle-26 P8 · build-assets extractor (logo/photos/colors/content prep for redesign)
  'scripts/test/test-cycle26-build-assets-extractor.mjs',
  // cycle-26 P9b · no zombie threads invariant (1 entity = 1 visible thread)
  'scripts/test/test-cycle26-no-zombie-threads.mjs',
  // cycle-26 cycle-27 · batch.entities terminal-state recorder (KPI gate · Matthew 2026-05-15 E2E)
  'scripts/test/test-cycle26-batch-terminal-recorder.mjs',
  // cycle-27 · archive without thread records batch.entities (Places L2 exclusion invariant)
  'scripts/test/test-cycle27-archive-without-thread.mjs',
  // cycle-27 · geo AU + multi-country router (full AU city coverage · future-proof)
  'scripts/test/test-cycle27-geo-au.mjs',
  // cycle-27 · intake CLI waits for cheap-audit queue to drain before exit
  'scripts/test/test-cycle27-queue-drain.mjs',
  // cycle-27 · batch state file lock (concurrent recordEntityTerminal race)
  'scripts/test/test-cycle27-batch-state-lock.mjs',
  // cycle-27 · batch-thread v2 message builders (zero emoji · list businesses · LLM judge blockquote)
  'scripts/test/test-cycle27-batch-thread-messages.mjs',
];

const results = [];
for (const t of TESTS) {
  console.log(`\n══════════════════════════════════════════`);
  console.log(`  ${t}`);
  console.log(`══════════════════════════════════════════`);
  const r = spawnSync('node', ['--env-file-if-exists=.env.local', t], { cwd: ROOT, stdio: 'inherit' });
  results.push({ test: t, code: r.status });
}

console.log('\n══════════════════════════════════════════');
console.log('  cycle-26 TDD summary');
console.log('══════════════════════════════════════════');
let pass = 0, fail = 0;
for (const r of results) {
  console.log(`  ${r.code === 0 ? '✓ PASS' : '✗ FAIL'}  ${r.test}`);
  if (r.code === 0) pass++; else fail++;
}
console.log(`\n${pass}/${results.length} test files passed`);
process.exit(fail === 0 ? 0 : 1);
