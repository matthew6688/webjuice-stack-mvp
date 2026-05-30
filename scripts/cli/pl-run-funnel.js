#!/usr/bin/env node
/**
 * pl-run-funnel · thin RESUMABLE orchestrator for the lead funnel (codex R123/R124/R135).
 *
 * One Hermes entry that CHAINS the EXISTING stage CLIs in order — it does NOT reimplement any stage and it
 * does NOT own the not-yet-cleared identity-resolution canonical lane (that stays gated elsewhere).
 * Architecture (codex): one intent surface · many stage executors · one durable batch state.
 *   discovery → enrichment → audit+grade+master.md   (each = an existing CLI · per-stage CLIs stay for debug)
 *
 * Defaults to DRY-RUN (prints the plan, no execution). `--execute` runs the stage CLIs. Resumable: a stage
 * already 'ok' in the batch-state file is skipped. Per-batch counters; never blocks for a human.
 *
 * Usage:
 *   npm run pl:run-funnel -- --niche roofing --city "Sydney NSW" [--source gosom|places] [--execute] [--resume <batchId>]
 * State: data/leads/funnel-runs/<batchId>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const a = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--niche') a.niche = process.argv[++i];
  else if (k === '--city') a.city = process.argv[++i];
  else if (k === '--source') a.source = process.argv[++i];
  else if (k === '--count') a.count = process.argv[++i];
  else if (k === '--execute') a.execute = true;
  else if (k === '--resume') a.resume = process.argv[++i];
}
if (!a.niche || !a.city) { console.error('Usage: --niche <n> --city "<c>" [--source gosom|places] [--execute] [--resume <batchId>]'); process.exit(2); }
const source = a.source || 'gosom';

// The funnel = existing stage CLIs in order. NOTE: the identity-resolution canonical-write lane is NOT here —
// it stays gated until OpenCLI-enabled real-page clearance (codex R133/R134). This funnel runs the proven stages.
const STAGES = [
  { name: 'discovery', cli: source === 'places' ? 'pl:places-search-intake' : 'pl:scrape-docker', argsFor: () => ['--niche', a.niche, '--city', a.city, ...(a.count ? ['--limit', a.count] : [])] },
  { name: 'enrichment', cli: 'pl:run-enrichment-batch', argsFor: () => ['--niche', a.niche] },
  { name: 'audit-grade-master', cli: 'leads:run-pipeline', argsFor: () => ['--niche', a.niche] },
];

const runsDir = path.join(REPO, 'data/leads/funnel-runs');
fs.mkdirSync(runsDir, { recursive: true });
const batchId = a.resume || `funnel-${source}-${a.niche}-${a.city}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const statePath = path.join(runsDir, `${batchId}.json`);
const state = a.resume && fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { batchId, niche: a.niche, city: a.city, source, stages: {}, counters: {} };
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

console.log(`\n[run-funnel] ${batchId} · ${a.execute ? 'EXECUTE' : 'DRY-RUN (use --execute to run)'}`);
for (const st of STAGES) {
  const argv = st.argsFor();
  const prior = state.stages[st.name];
  if (prior && prior.status === 'ok') { console.log(`  ⏭  ${st.name} · already ok (resume) — skip`); continue; }
  console.log(`  ▸ ${st.name} → npm run ${st.cli} -- ${argv.join(' ')}`);
  if (!a.execute) { state.stages[st.name] = state.stages[st.name] || { status: 'planned' }; continue; }
  const t0 = Date.now();
  try {
    execFileSync('npm', ['run', '-s', st.cli, '--', ...argv], { cwd: REPO, stdio: 'inherit', timeout: 1_800_000 });
    state.stages[st.name] = { status: 'ok', ms: Date.now() - t0 };
    save();
  } catch (e) {
    // never block for a human · record + stop the chain (resume picks up here)
    state.stages[st.name] = { status: 'failed', error: String(e.message).slice(0, 160), ms: Date.now() - t0 };
    save();
    console.error(`  ✗ ${st.name} failed: ${state.stages[st.name].error} — chain stopped; re-run with --resume ${batchId}`);
    process.exit(1);
  }
}
save();
console.log(`\n  state → ${path.relative(REPO, statePath)}`);
console.log(a.execute ? '  ✅ funnel complete (or resumed to next pending stage)' : '  (dry-run · no stage executed · identity canonical lane stays gated until clearance)');
