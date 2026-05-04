#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { runAgentTask, saveRunResult } from '../../core/agents/runner.js';
import { getLatestGithubActionsRun } from '../../core/deploy/github-actions.js';
import { buildAgentReviewEmail, sendCustomerEmail } from '../../core/funnel/customer-email.js';

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

async function waitForDeploy(repo, branch, { timeoutMs = 180000, intervalMs = 10000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await getLatestGithubActionsRun(repo, { branch, timeoutMs: 20000 });
    if (latest.status === 'completed') return latest;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return latest || {
    repo,
    branch,
    ok: false,
    found: false,
    status: 'timeout',
    conclusion: null,
    errors: [`Timed out after ${timeoutMs}ms waiting for deploy.`],
  };
}

const args = parseArgs();
if (!args.task || !args['repo-dir']) {
  console.error('Usage: node scripts/agent/complete-task.js --task task.json --repo-dir /path/repo [--execute true] [--checkout true] [--push true] [--check-deploy true] [--send-email true]');
  process.exit(1);
}

const task = JSON.parse(fs.readFileSync(args.task, 'utf8'));
const result = runAgentTask(task, {
  repoDir: args['repo-dir'],
  assetsDir: args['assets-dir'] || args.assetsDir || '',
  repoRoot: args['repo-root'] || args.repoRoot || process.cwd(),
  checkout: boolArg(args, 'checkout'),
  push: boolArg(args, 'push'),
  dryRun: args.execute !== 'true',
});

let deployResult = null;
if (boolArg(args, 'check-deploy') && result.pushed && !result.dryRun) {
  deployResult = await waitForDeploy(task.repo, task.branch || 'dev', {
    timeoutMs: Number(args['deploy-timeout'] || args.deployTimeout || 180000),
    intervalMs: Number(args['deploy-interval'] || args.deployInterval || 10000),
  });
}

let customerEmail = { ok: false, skipped: true };
const caseFile = result.caseRecord?.caseFile || null;
if (boolArg(args, 'send-email') && result.ok && !result.dryRun && caseFile) {
  const message = buildAgentReviewEmail({
    caseFile,
    runResult: result,
    deployResult,
    extraRevisionUrl: args['extra-revision-url'] || args.extraRevisionUrl || process.env.EXTRA_REVISION_CHECKOUT_URL || '',
  });
  if (message) customerEmail = await sendCustomerEmail(process.env, message);
}

const completeResult = {
  ...result,
  deployResult,
  customerEmail,
};
const outputPath = args.output || path.join('data/agent-runs', `${task.id}.complete.json`);
saveRunResult(completeResult, outputPath);

console.log(`Agent completion result written: ${outputPath}`);
console.log(`Status: ${completeResult.ok ? 'ok' : 'failed'}`);
console.log(`Dry run: ${completeResult.dryRun ? 'yes' : 'no'}`);
console.log(`Deploy: ${deployResult ? `${deployResult.status}${deployResult.conclusion ? `/${deployResult.conclusion}` : ''}` : 'not checked'}`);
console.log(`Email: ${customerEmail.ok ? 'sent' : (customerEmail.skipped ? 'skipped' : 'failed')}`);
for (const step of completeResult.steps) {
  console.log(`- ${step.id}: ${step.ok ? 'ok' : 'failed'} (${step.command})`);
}

process.exit(completeResult.ok && (!deployResult || deployResult.ok) ? 0 : 1);
