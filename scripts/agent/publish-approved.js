#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { publishApprovedTask, savePublishResult } from '../../core/agents/publisher.js';
import { getLatestGithubActionsRun } from '../../core/deploy/github-actions.js';
import { buildLivePublishedEmail, sendCustomerEmail } from '../../core/funnel/customer-email.js';

loadLocalEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

function boolArg(args, key, defaultValue = false) {
  if (args[key] === undefined) return defaultValue;
  return args[key] === true || String(args[key]).toLowerCase() === 'true';
}

async function waitForDeploy(repo, branch, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await getLatestGithubActionsRun(repo, { branch, timeoutMs: 20000 });
    if (latest.status === 'completed') return latest;
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  return latest || { repo, branch, ok: false, status: 'timeout', conclusion: null };
}

const args = parseArgs();
if (!args.task || !args['repo-dir']) {
  console.error('Usage: node scripts/agent/publish-approved.js --task task.json --repo-dir /path/repo [--execute true] [--push true] [--check-deploy true] [--send-email true]');
  process.exit(1);
}

const task = JSON.parse(fs.readFileSync(args.task, 'utf8'));
const publishResult = publishApprovedTask(task, {
  repoDir: args['repo-dir'],
  repoRoot: args['repo-root'] || args.repoRoot || process.cwd(),
  sourceBranch: args.source || args.sourceBranch || task.branch || 'dev',
  targetBranch: args.target || args.targetBranch || 'main',
  liveUrl: args['live-url'] || args.liveUrl || '',
  push: boolArg(args, 'push'),
  dryRun: args.execute !== 'true',
});

let deployResult = null;
if (boolArg(args, 'check-deploy') && publishResult.pushed && !publishResult.dryRun) {
  deployResult = await waitForDeploy(task.repo, args.target || args.targetBranch || 'main', Number(args['deploy-timeout'] || 180000));
}

let customerEmail = { ok: false, skipped: true };
const caseFile = publishResult.caseRecord?.caseFile || null;
if (boolArg(args, 'send-email') && publishResult.ok && !publishResult.dryRun && caseFile) {
  const message = buildLivePublishedEmail({
    caseFile,
    publishResult,
    deployResult,
    liveUrl: args['live-url'] || args.liveUrl || '',
  });
  if (message) customerEmail = await sendCustomerEmail(process.env, message);
}

const result = { ...publishResult, deployResult, customerEmail };
const outputPath = args.output || path.join('data/agent-runs', `${task.id}.publish.json`);
savePublishResult(result, outputPath);

console.log(`Publish result written: ${outputPath}`);
console.log(`Status: ${result.ok ? 'ok' : 'failed'}`);
console.log(`Dry run: ${result.dryRun ? 'yes' : 'no'}`);
console.log(`Pushed: ${result.pushed ? 'yes' : 'no'}`);
console.log(`Deploy: ${deployResult ? `${deployResult.status}${deployResult.conclusion ? `/${deployResult.conclusion}` : ''}` : 'not checked'}`);
console.log(`Email: ${customerEmail.ok ? 'sent' : (customerEmail.skipped ? 'skipped' : 'failed')}`);
for (const step of result.steps) {
  console.log(`- ${step.id}: ${step.ok ? 'ok' : 'failed'} (${step.command})`);
}

process.exit(result.ok && (!deployResult || deployResult.ok) ? 0 : 1);
