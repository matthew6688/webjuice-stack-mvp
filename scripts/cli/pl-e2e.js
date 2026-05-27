#!/usr/bin/env node
/**
 * pl:e2e · One-shot end-to-end pipeline driver for a single client slug.
 *
 * Chains the canonical pipeline in order, each step gated by the prior:
 *
 *   1. pl:data-checkpoint    · refuse on RED · warn on YELLOW
 *   2. pl:enrich-handoff     · OPTIONAL (default skip · explicit --enrich · costs LLM money)
 *   3. pl:assemble-handoff   · canonical photos/source manifest · 19/19 utilization
 *   4. pl:validate-handoff   · schema gate · refused → halt
 *   5. pl:compose-site       · renders HTML pages → experiments/v2-compare/<slug>/
 *
 * Each step's exit code halts the chain. Writes a summary to
 * clients/<slug>/v2/e2e-summary.json so the run is auditable.
 *
 * Usage:
 *   npm run pl:e2e -- --slug <slug>                     # default: assemble + validate + compose
 *   npm run pl:e2e -- --slug <slug> --enrich            # also run enrich (LLM · ~$0.50/run)
 *   npm run pl:e2e -- --slug <slug> --skip-checkpoint   # legacy/smoke bypass
 *   npm run pl:e2e -- --slug <slug> --dry-run           # show what would run
 *   npm run pl:e2e -- --slug <slug> --out <dir>         # override compose output dir
 *
 * Spec: skills/profitslocal-build-research-pack/SKILL.md
 * Tied to codex P2 directive (overnight 2026-05-22 iter 3).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function parseArgs() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const n = argv[i + 1];
      if (!n || n.startsWith('--')) { out[k] = true; }
      else { out[k] = n; i++; }
    }
  }
  return out;
}

function die(msg) { console.error(`[pl:e2e] ERROR: ${msg}`); process.exit(1); }

async function runStep(label, npmCmd, args, opts = {}) {
  return new Promise((resolve) => {
    const fullCmd = ['run', '--silent', npmCmd, '--', ...args];
    console.log(`\n[pl:e2e] ▶ ${label}`);
    console.log(`[pl:e2e]   npm ${fullCmd.join(' ')}`);
    const t0 = Date.now();
    const p = spawn('npm', fullCmd, {
      stdio: opts.quietStdout ? ['ignore', 'pipe', 'inherit'] : ['ignore', 'inherit', 'inherit'],
      cwd: REPO,
      env: { ...process.env, ...(opts.env || {}) },
    });
    let buf = '';
    if (opts.quietStdout) p.stdout?.on('data', (c) => { buf += c.toString(); });
    p.on('close', (code) => {
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`[pl:e2e] ✓ ${label} · ${dt}s`);
        resolve({ label, ok: true, code, durationSec: parseFloat(dt), out: buf });
      } else {
        console.error(`[pl:e2e] ✗ ${label} FAILED · exit ${code} · ${dt}s`);
        resolve({ label, ok: false, code, durationSec: parseFloat(dt), out: buf });
      }
    });
  });
}

const args = parseArgs();
if (!args.slug) {
  die('Missing --slug. Usage: npm run pl:e2e -- --slug <slug> [--enrich] [--skip-checkpoint] [--skip-validate] [--out <dir>] [--dry-run]');
}
const slug = String(args.slug);
const dryRun = Boolean(args['dry-run']);
const enrichEnabled = Boolean(args.enrich);
const skipCheckpoint = Boolean(args['skip-checkpoint']);
const skipValidate = Boolean(args['skip-validate']);

const clientDir = path.join(REPO, 'clients', slug);
if (!fs.existsSync(clientDir)) {
  die(`Client dir not found: clients/${slug}/ — run pl:build-handoff first or check --slug`);
}

const outDir = args.out
  ? path.resolve(args.out)
  : path.join(REPO, 'experiments', 'v2-compare', slug);

const steps = [];

// 1. checkpoint — gates everything after it
steps.push({
  label: '1/5 data-checkpoint',
  npmCmd: 'pl:data-checkpoint',
  argsFor: () => ['--slug', slug],
  skipIf: () => skipCheckpoint,
  required: !skipCheckpoint,
});

// 2. enrich (OPTIONAL · LLM cost)
if (enrichEnabled) {
  steps.push({
    label: '2/5 enrich-handoff (LLM)',
    npmCmd: 'pl:enrich-handoff',
    argsFor: () => ['--slug', slug],
    required: true,
  });
}

// 3. assemble — fills od-package
steps.push({
  label: `${enrichEnabled ? '3' : '2'}/5 assemble-handoff`,
  npmCmd: 'pl:assemble-handoff',
  argsFor: () => skipCheckpoint
    ? ['--slug', slug, '--skip-checkpoint']
    : ['--slug', slug],
  required: true,
});

// 4. validate — schema gate
steps.push({
  label: `${enrichEnabled ? '4' : '3'}/5 validate-handoff`,
  npmCmd: 'pl:validate-handoff',
  argsFor: () => ['--slug', slug],
  skipIf: () => skipValidate,
  required: !skipValidate,
});

// 4b. validate-single-page-brief — single-page-specific gate · only when --single-page (codex R16 Q-Y-3 a)
const singlePageMode = process.argv.includes('--single-page');
if (singlePageMode) {
  steps.push({
    label: `${enrichEnabled ? '5' : '4'}/5 validate-single-page-brief`,
    npmCmd: 'pl:validate-single-page-brief',
    argsFor: () => ['--slug', slug],
    required: true,
  });
}

// 5. compose — produce HTML
steps.push({
  label: `${enrichEnabled ? (singlePageMode ? '6' : '5') : (singlePageMode ? '5' : '4')}/5 compose-site`,
  npmCmd: 'pl:compose-site',
  argsFor: () => {
    const a = ['--handoff', path.join('clients', slug, 'v2/handoff/od-package'), '--out', path.relative(REPO, outDir)];
    if (skipValidate) a.push('--skip-validate');
    return a;
  },
  required: true,
});

console.log(`\n[pl:e2e] slug=${slug} steps=${steps.length} enrich=${enrichEnabled} out=${path.relative(REPO, outDir)}`);

if (dryRun) {
  console.log('\n[pl:e2e] DRY RUN · would execute:');
  for (const s of steps) {
    if (s.skipIf?.()) console.log(`  ⊘ ${s.label} (skipped via flag)`);
    else console.log(`  npm run ${s.npmCmd} -- ${s.argsFor().join(' ')}`);
  }
  process.exit(0);
}

const summary = {
  slug,
  enrichEnabled,
  skipCheckpoint,
  skipValidate,
  outDir: path.relative(REPO, outDir),
  startedAt: new Date().toISOString(),
  steps: [],
  ok: true,
};

for (const step of steps) {
  if (step.skipIf?.()) {
    console.log(`\n[pl:e2e] ⊘ ${step.label} skipped (flag)`);
    summary.steps.push({ label: step.label, skipped: true });
    continue;
  }
  const res = await runStep(step.label, step.npmCmd, step.argsFor());
  summary.steps.push(res);
  if (!res.ok && step.required) {
    summary.ok = false;
    summary.failedAt = step.label;
    summary.exitCode = res.code;
    break;
  }
}

summary.finishedAt = new Date().toISOString();
summary.totalSec = summary.steps.reduce((s, x) => s + (x.durationSec || 0), 0).toFixed(1);

// Surface key downstream artifacts in the summary
const odPackage = path.join(clientDir, 'v2/handoff/od-package');
summary.artifacts = {
  checkpoint: fs.existsSync(path.join(clientDir, 'v2/checkpoint.json')),
  v2Spec: fs.existsSync(path.join(odPackage, 'v2-spec.json')),
  composedPages: fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith('.html')).length : 0,
  composedOut: path.relative(REPO, outDir),
};

const summaryPath = path.join(clientDir, 'v2', 'e2e-summary.json');
try {
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
} catch (e) {
  console.warn(`[pl:e2e] could not write summary: ${e.message}`);
}

console.log(`\n[pl:e2e] ${'─'.repeat(50)}`);
console.log(`[pl:e2e] slug=${slug} · ${summary.ok ? '✓ ALL STEPS GREEN' : '✗ HALTED at ' + summary.failedAt}`);
console.log(`[pl:e2e] total=${summary.totalSec}s · composed=${summary.artifacts.composedPages} pages · out=${summary.artifacts.composedOut}`);
console.log(`[pl:e2e] summary → ${path.relative(REPO, summaryPath)}`);

process.exit(summary.ok ? 0 : 1);
