#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { runAgentTask, saveRunResult } from '../../core/agents/runner.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

const args = parseArgs();

if (!args.task || !args['repo-dir']) {
  console.error('Usage: node scripts/agent/run-task.js --task agent-tasks/pending/task.json --repo-dir /path/repo [--assets-dir /path/public/images] [--execute true] [--checkout true] [--push true]');
  process.exit(1);
}

const task = JSON.parse(fs.readFileSync(args.task, 'utf8'));
const result = runAgentTask(task, {
  repoDir: args['repo-dir'],
  assetsDir: args['assets-dir'] || args.assetsDir || '',
  repoRoot: args['repo-root'] || args.repoRoot || process.cwd(),
  checkout: args.checkout === 'true',
  push: args.push === 'true',
  dryRun: args.execute !== 'true',
});

const outputPath = args.output || path.join('agent-tasks', result.ok ? 'done' : 'running', `${task.id}.result.json`);
saveRunResult(result, outputPath);

console.log(`Agent run result written: ${outputPath}`);
console.log(`Status: ${result.ok ? 'ok' : 'failed'}`);
console.log(`Dry run: ${result.dryRun ? 'yes' : 'no'}`);
console.log(`Case context: ${result.context?.hasCaseContext ? 'loaded' : 'not loaded'}`);
if (result.caseRecord && !result.caseRecord.skipped) {
  console.log(`Case updated: ${result.caseRecord.dryRun ? 'dry-run' : (result.caseRecord.ok ? 'yes' : 'no')}`);
}
for (const step of result.steps) {
  console.log(`- ${step.id}: ${step.ok ? 'ok' : 'failed'} (${step.command})`);
}
if (result.changedFiles?.length) {
  console.log('Changed files:');
  for (const file of result.changedFiles) console.log(`- ${file}`);
}

process.exit(result.ok ? 0 : 1);
