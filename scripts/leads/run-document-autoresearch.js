#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || process.cwd());
const runId = normalizeId(args['run-id'] || args.runId || new Date().toISOString().replace(/[:.]/g, '-'));
const variants = String(args.variants || 'baseline,strict-v2').split(',').map(normalizeId).filter(Boolean);
const providers = args.providers || 'deterministic';
const timeout = String(args.timeout || args['timeout-ms'] || 180000);
const targetScore = Number(args['target-score'] || args.targetScore || 90);
const outRoot = path.join(root, 'data', 'qa', 'document-model-comparison', `autoresearch-${runId}`);
fs.mkdirSync(outRoot, { recursive: true });

const attempts = [];
for (const variant of variants) {
  const childRunId = `${runId}-${variant}`;
  const command = [
    process.execPath,
    'scripts/leads/run-document-model-comparison.js',
    '--root',
    root,
    '--run-id',
    childRunId,
    '--prompt-variant',
    variant,
    '--providers',
    providers,
    '--timeout',
    timeout,
  ];
  if (args['claude-budget']) command.push('--claude-budget', String(args['claude-budget']));
  if (args['claude-model']) command.push('--claude-model', String(args['claude-model']));
  if (args.think !== undefined) command.push('--think', String(args.think));

  const started = Date.now();
  const run = spawnSync(command[0], command.slice(1), {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Date.now() - started;
  const summary = parseJsonOutput(run.stdout);
  attempts.push({
    variant,
    status: run.status,
    durationMs,
    summaryPath: summary?.outRoot ? path.join(summary.outRoot, 'summary.json') : '',
    bestProvider: summary?.bestProvider || null,
    bestScore: bestScore(summary),
    ok: Boolean(summary?.providers?.some((provider) => provider.ok && provider.score >= targetScore)),
    stdoutExcerpt: run.stdout.slice(0, 1000),
    stderrExcerpt: run.stderr.slice(0, 1000),
  });
}

const ranked = [...attempts].sort((a, b) => b.bestScore - a.bestScore || a.durationMs - b.durationMs);
const summary = {
  schemaVersion: 1,
  runId,
  providers,
  variants,
  targetScore,
  attempts,
  best: ranked[0] || null,
  accepted: ranked.filter((attempt) => attempt.ok),
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(outRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

function bestScore(summary) {
  return Math.max(0, ...(summary?.providers || []).map((provider) => provider.score || 0));
}

function parseJsonOutput(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    const start = stdout.indexOf('{');
    const end = stdout.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    return JSON.parse(stdout.slice(start, end + 1));
  }
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
