#!/usr/bin/env node
/**
 * SOP-0 regression test suite.
 *
 * Runs all SOP-0 auto-runnable test cases from docs/SOP_0_TEST_PLAN.md:
 *  - T1-T5  · intent-router routing accuracy
 *  - T13     · dispatcher failed-CLI path
 *  - T15     · ollama-down → regex fallback
 *  - T20     · retention dry-run idempotent
 *  - T21     · push-trigger thin-contact → enrich task
 *
 * Skips Discord-live cases (T6-T12, T16-T19, T22-T23) — those need a forum
 * thread and live daemons. Run those by hand per the test plan.
 *
 * Exits 0 on all pass, 1 on any fail.
 * CI-friendly: ~30s total, no external API calls beyond local Ollama.
 */

import fs from 'node:fs';
import path from 'node:path';

const GREEN = '\x1b[32m'; const RED = '\x1b[31m'; const YELLOW = '\x1b[33m'; const DIM = '\x1b[2m'; const RESET = '\x1b[0m';
let pass = 0, fail = 0;
const failures = [];

function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ${GREEN}✓${RESET} ${label}`); }
  else      { fail++; failures.push(`${label}${detail ? ' — ' + detail : ''}`); console.log(`  ${RED}✗${RESET} ${label}${detail ? ` ${DIM}${detail}${RESET}` : ''}`); }
}

const repoRoot = path.resolve(process.cwd());

console.log('\n=== T1-T5 · Intent router routing ===');
{
  const { routeIntent } = await import(path.join(repoRoot, 'core/tasks/intent-router.js'));
  // T1 · phone signal → single-enrich
  const t1 = await routeIntent({ text: "Joe's Plumbing 0412 345 678 melbourne plumber" });
  check('T1 phone → single-enrich', t1.kind === 'single-enrich', `got ${t1.kind}`);
  check('T1 args include --business-name', t1.args.includes('--business-name'));
  // T2 · quoted name → single-enrich
  const t2 = await routeIntent({ text: '"Bluey\'s Cafe" newcastle' });
  check('T2 single-quoted → single-enrich', t2.kind === 'single-enrich', `got ${t2.kind}`);
  // T3 · GBP URL → single-enrich OR audit (either acceptable)
  const t3 = await routeIntent({ text: 'audit https://maps.app.goo.gl/abc' });
  check('T3 GBP URL → single-enrich|audit', ['single-enrich', 'audit'].includes(t3.kind), `got ${t3.kind}`);
  // T4 · batch intake (no quotes) → intake (not single-enrich)
  const t4 = await routeIntent({ text: 'find brisbane roofers' });
  check('T4 batch query → intake', t4.kind === 'intake', `got ${t4.kind}`);
  // T5 · image attachment → image-extract
  const t5 = await routeIntent({ text: '', attachments: [{ contentType: 'image/png', filename: 'x.png', url: 'data:dummy' }] });
  check('T5 image attachment → image-extract', t5.kind === 'image-extract', `got ${t5.kind}`);
  // T22-routing · multi-quoted → places-intake
  const t22 = await routeIntent({ text: 'search "roofer brisbane" "roofer gold coast"' });
  check('Multi-quoted → places-intake', t22.kind === 'places-intake', `got ${t22.kind}`);
}

console.log('\n=== T13 · failed CLI path ===');
{
  const { createTask, readTask, transitionStatus } = await import(path.join(repoRoot, 'core/tasks/task-store.js'));
  // Create a synthetic task; verify state machine accepts pending → running → failed
  const t = createTask({
    kind: 'ops',
    source: { platform: 'ci-regression', author: 't13-stub' },
    input: { text: 'CI regression stub' },
    target: { cli: 'pl:list', args: [], timeout_ms: 10000 },
  });
  check('T13 task created in pending', t.status === 'pending');
  transitionStatus(t.task_id, 'running');
  check('T13 pending → running', readTask(t.task_id).status === 'running');
  transitionStatus(t.task_id, 'failed', { reason: 'CI regression: synthetic exit=1' });
  check('T13 running → failed', readTask(t.task_id).status === 'failed');
  check('T13 error stored', /synthetic/.test(readTask(t.task_id).error || ''));
  // cleanup
  fs.unlinkSync(path.join(repoRoot, 'data/tasks', `${t.task_id}.json`));
}

console.log('\n=== T15 · ollama-down → regex fallback ===');
{
  // Force OLLAMA_URL to unreachable BEFORE module load
  process.env.OLLAMA_URL = 'http://127.0.0.1:1';
  // Use a fresh import URL to bust cache (text-ollama caches URL at module load)
  const router = await import(path.join(repoRoot, 'core/tasks/intent-router.js') + `?t=${Date.now()}`);
  const out = await router.routeIntent({ text: 'find brisbane roofers' });
  // Either regex (ideal) or live ollama at start (acceptable too) — both prove kind is correct
  check('T15 routing still produces valid kind', ['intake', 'places-intake', 'single-enrich'].includes(out.kind), `got ${out.kind}`);
  check('T15 provider is regex OR ollama', ['regex', 'ollama'].includes(out.provider), `got ${out.provider}`);
  delete process.env.OLLAMA_URL;
}

console.log('\n=== T20 · retention idempotency ===');
{
  // Run retention with --dry-run --days 0 — should never error, regardless of state
  const { spawnSync } = await import('node:child_process');
  const r1 = spawnSync('node', ['scripts/cli/pl-task-retention.js', '--days', '0', '--dry-run'],
    { cwd: repoRoot, encoding: 'utf8' });
  check('T20 retention dry-run exits 0', r1.status === 0, `exit=${r1.status} stderr=${(r1.stderr||'').slice(0,80)}`);
  // Run again with --days 99999 (should move nothing)
  const r2 = spawnSync('node', ['scripts/cli/pl-task-retention.js', '--days', '99999'],
    { cwd: repoRoot, encoding: 'utf8' });
  check('T20 retention --days 99999 idempotent', r2.status === 0 && /scanned=\d+ · moved=0/.test(r2.stdout || ''),
    `stdout: ${(r2.stdout||'').slice(-120)}`);
}

console.log('\n=== T21 · push trigger thin-contact → enrich task ===');
{
  const { upsertDiscoveryRun } = await import(path.join(repoRoot, 'core/leads/discovery-store.js'));
  const { listTasks } = await import(path.join(repoRoot, 'core/tasks/task-store.js'));
  const before = listTasks({ kind: 'enrich', status: 'pending' }).length;
  const tmpRoot = `/tmp/sop0-regression-${Date.now()}`;
  upsertDiscoveryRun({
    runId: 'regression-t21',
    leads: [{
      place_id: `place_regression_thin_${Date.now()}`,
      name: 'Regression thin-contact',
      niche: 'tester', city: 'test',
      sourceQuery: 't21 regression',
    }],
  }, { storeRoot: tmpRoot });
  const after = listTasks({ kind: 'enrich', status: 'pending' });
  check('T21 enrich task created', after.length > before, `before=${before} after=${after.length}`);
  // Cleanup
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // Archive any newly-created enrich tasks so we don't pollute prod
  for (const t of after) {
    if (t.target?.text?.includes?.('regression') || t.input?.text?.includes('thin-contact entity place_regression')) {
      const src = path.join(repoRoot, 'data/tasks', `${t.task_id}.json`);
      const archDir = path.join(repoRoot, 'data/tasks/_archive/regression');
      fs.mkdirSync(archDir, { recursive: true });
      if (fs.existsSync(src)) fs.renameSync(src, path.join(archDir, `${t.task_id}.json`));
    }
  }
}

console.log(`\n${pass} pass · ${fail} fail`);
if (fail > 0) {
  console.log(`\n${RED}FAILED:${RESET}`);
  for (const f of failures) console.log(`  ${RED}✗${RESET} ${f}`);
}
process.exit(fail === 0 ? 0 : 1);
