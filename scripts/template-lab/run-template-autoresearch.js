#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || process.cwd());
const niche = normalizeId(args.niche || 'roofing');
const page = normalizeId(args.page || 'home');
const runId = normalizeId(args['run-id'] || args.runId || new Date().toISOString().replace(/[:.]/g, '-'));
const targetScore = Number(args['target-score'] || args.targetScore || 95);
const maxRounds = Number(args['max-rounds'] || args.maxRounds || 1);
const execute = Boolean(args.execute);
const openDesignMode = args.mode ? normalizeId(args.mode) : '';
const variants = String(args.variant || 'medium-framework-no-llm')
  .split(',')
  .map((item) => normalizeId(item))
  .filter(Boolean);
const families = String(args.families || args.family || '')
  .split(',')
  .map((item) => normalizeId(item))
  .filter(Boolean);

if (!families.length) {
  console.error('Usage: node scripts/template-lab/run-template-autoresearch.js --niche roofing --families family-a,family-b [--execute]');
  process.exit(1);
}

const summaryRoot = path.join(root, 'data', 'template-experiments', niche, `autoresearch-${runId}`);
fs.mkdirSync(summaryRoot, { recursive: true });

const results = [];
for (const family of families) {
  const familyResult = runFamilyLoop({ family });
  results.push(familyResult);
  fs.writeFileSync(path.join(summaryRoot, `${family}.json`), `${JSON.stringify(familyResult, null, 2)}\n`);
}

const summary = {
  schemaVersion: 1,
  niche,
  page,
  runId,
  execute,
  openDesignMode: openDesignMode || null,
  targetScore,
  maxRounds,
  variants,
  families: results,
  accepted: results.filter((item) => item.accepted).map((item) => item.family),
  pending: results.filter((item) => !item.accepted).map((item) => item.family),
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(summaryRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

function runFamilyLoop({ family }) {
  const attempts = [];
  for (let round = 1; round <= maxRounds; round += 1) {
    for (const variant of variants) {
      const attemptRunId = `${runId}-${family}-r${round}-${variant}`;
      const experiment = runExperiment({ family, variant, attemptRunId });
      attempts.push(experiment);
      if (experiment.accepted) {
        return {
          family,
          accepted: true,
          reason: 'target_score_met_with_native_clean_finish',
          best: experiment,
          attempts,
        };
      }
    }
  }

  const best = attempts
    .filter((attempt) => typeof attempt.score === 'number')
    .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs)[0] || attempts[0] || null;
  return {
    family,
    accepted: false,
    reason: best?.failureReason || 'no_attempt_met_target_score',
    best,
    attempts,
  };
}

function runExperiment({ family, variant, attemptRunId }) {
  const command = [
    process.execPath,
    'scripts/template-lab/run-open-design-experiments.js',
    '--root',
    root,
    '--niche',
    niche,
    '--family',
    family,
    '--page',
    page,
    '--run-id',
    attemptRunId,
    '--variant',
    variant,
  ];
  if (openDesignMode) command.push('--mode', openDesignMode);
  if (execute) command.push('--execute');

  const started = Date.now();
  const run = spawnSync(command[0], command.slice(1), {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 128 * 1024 * 1024,
  });
  const durationMs = Date.now() - started;
  const parsed = parseJsonOutput(run.stdout);
  const variantResult = parsed?.variants?.[0] || {};
  const scorePath = variantResult.scorePath ? path.join(root, variantResult.scorePath) : '';
  const score = scorePath && fs.existsSync(scorePath) ? JSON.parse(fs.readFileSync(scorePath, 'utf8')) : null;
  const state = score?.htmlFiles?.[0]
    ? readJsonIfExists(path.join(root, score.htmlFiles[0], '..', 'open-design-run-state.json'))
    : null;
  const nativeCleanFinish = Boolean(state?.nativeCleanFinish);
  const completionMode = state?.completionMode || null;
  const accepted = Boolean(
    execute
      ? score?.ok && score.score >= targetScore && nativeCleanFinish && completionMode === 'native'
      : variantResult.ok,
  );

  return {
    family,
    variant,
    runId: attemptRunId,
    execute,
    openDesignMode: openDesignMode || null,
    status: run.status,
    durationMs,
    score: score?.score ?? variantResult.score ?? null,
    ok: Boolean(score?.ok ?? variantResult.ok),
    accepted,
    nativeCleanFinish,
    completionMode,
    outDir: variantResult.outDir || null,
    promptPath: variantResult.promptPath || null,
    scorePath: variantResult.scorePath || null,
    experimentRoot: parsed?.experimentRoot || null,
    failureReason: failureReason({ run, score, nativeCleanFinish, completionMode }),
  };
}

function failureReason({ run, score, nativeCleanFinish, completionMode }) {
  if (run.status !== 0) return 'experiment_command_failed';
  if (!execute) return '';
  if (!score) return 'missing_score';
  if (!nativeCleanFinish) return 'missing_native_clean_finish';
  if (completionMode !== 'native') return `completion_mode_${completionMode || 'unknown'}`;
  if (!score.ok) return score.findings?.[0]?.code || 'score_not_ok';
  if (score.score < targetScore) return `score_below_${targetScore}`;
  return '';
}

function parseJsonOutput(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    const start = stdout.indexOf('{');
    const end = stdout.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return JSON.parse(stdout.slice(start, end + 1));
  }
}

function readJsonIfExists(filePath) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
}

function normalizeId(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
