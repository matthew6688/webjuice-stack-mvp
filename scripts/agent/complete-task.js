#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { runAgentTask, saveRunResult } from '../../core/agents/runner.js';
import { validatePreReviewGate } from '../../core/agents/review-gate.js';
import { getLatestGithubActionsRun } from '../../core/deploy/github-actions.js';
import { buildAgentReviewEmail, sendCustomerEmail } from '../../core/funnel/customer-email.js';
import { buildAgentReviewDiscordMessage, sendDiscordChannelMessage, sendDiscordWebhook } from '../../core/funnel/discord.js';
import { recordCaseNotification } from '../../core/cases/case-file.js';
import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../../core/finance/ledger.js';
import { agentRuntimeLedgerInput } from '../../core/finance/service-costs.js';

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
  qaScreenshots: args['qa-screenshots'] || args.qaScreenshots || '',
  devDeployUrl: args['dev-deploy-url'] || args.devDeployUrl || task.previewUrl || '',
  dryRun: args.execute !== 'true',
});
const agentRuntimeCost = recordAgentRuntimeCost(result, args);
const preReviewGate = validatePreReviewGate(result);

let deployResult = null;
if (boolArg(args, 'check-deploy') && result.pushed && !result.dryRun) {
  deployResult = await waitForDeploy(task.repo, task.branch || 'dev', {
    timeoutMs: Number(args['deploy-timeout'] || args.deployTimeout || 180000),
    intervalMs: Number(args['deploy-interval'] || args.deployInterval || 10000),
  });
}

let customerEmail = { ok: false, skipped: true };
const caseFile = result.caseRecord?.caseFile || null;
if (boolArg(args, 'send-email') && result.ok && !result.dryRun && caseFile && !preReviewGate.ok) {
  customerEmail = {
    ok: false,
    skipped: true,
    reason: 'pre_review_gate_failed',
    missing: preReviewGate.missing,
  };
} else if (boolArg(args, 'send-email') && result.ok && !result.dryRun && caseFile) {
  const message = buildAgentReviewEmail({
    caseFile,
    runResult: result,
    deployResult,
    extraRevisionUrl: args['extra-revision-url'] || args.extraRevisionUrl || process.env.EXTRA_REVISION_CHECKOUT_URL || '',
  });
  if (message) customerEmail = await sendCustomerEmail(process.env, message, {
    ledgerPath: args.ledger || DEFAULT_LEDGER_PATH,
    clientSlug: task.clientSlug || result.clientSlug || null,
    campaignId: args.campaign || task.campaignId || null,
    emailMetadata: { taskId: task.id, kind: task.kind || task.type || '' },
  });
}

const discordNotification = await sendAgentReviewDiscord({
  args,
  task,
  caseFile,
  runResult: result,
  deployResult,
});

const completeResult = {
  ...result,
  audit: {
    ...(result.audit || {}),
    devDeployUrl: args['dev-deploy-url'] || args.devDeployUrl || result.previewUrl || task.previewUrl || '',
    customerEmailId: customerEmail.id || '',
  },
  deployResult,
  customerEmail,
  discordNotification,
  agentRuntimeCost,
  preReviewGate,
};
const outputPath = args.output || path.join('data/agent-runs', `${task.id}.complete.json`);
saveRunResult(completeResult, outputPath);

console.log(`Agent completion result written: ${outputPath}`);
console.log(`Status: ${completeResult.ok ? 'ok' : 'failed'}`);
console.log(`Dry run: ${completeResult.dryRun ? 'yes' : 'no'}`);
console.log(`Deploy: ${deployResult ? `${deployResult.status}${deployResult.conclusion ? `/${deployResult.conclusion}` : ''}` : 'not checked'}`);
console.log(`Email: ${customerEmail.ok ? 'sent' : (customerEmail.skipped ? 'skipped' : 'failed')}`);
if (!preReviewGate.ok) console.log(`Pre-review gate: failed (${preReviewGate.missing.join(', ')})`);
else console.log('Pre-review gate: passed');
console.log(`Discord: ${discordNotification.ok ? (discordNotification.dryRun ? 'dry-run' : 'sent') : (discordNotification.skipped ? 'skipped' : 'failed')}`);
console.log(`Runtime cost: ${agentRuntimeCost ? agentRuntimeCost.amount : 'not recorded'}`);
for (const step of completeResult.steps) {
  console.log(`- ${step.id}: ${step.ok ? 'ok' : 'failed'} (${step.command})`);
  if (!step.ok && step.output) console.log(indent(step.output));
}

async function sendAgentReviewDiscord({ args, task, caseFile, runResult, deployResult }) {
  if (!boolArg(args, 'send-discord')) return { ok: false, skipped: true };
  if (!caseFile) return { ok: false, skipped: true, reason: 'missing_case_file' };
  const kind = task.kind === 'revision' ? 'revision' : 'sale';
  const webhookUrl = kind === 'revision'
    ? process.env.REVISE_DISCORD_WEBHOOK_URL
    : process.env.SALES_DISCORD_WEBHOOK_URL;
  const threadId = discordThreadId(caseFile, kind);
  const payload = buildAgentReviewDiscordMessage({ caseFile, runResult, deployResult });
  if (!threadId) return { ok: false, skipped: true, reason: 'missing_discord_thread_id', payload };
  if (runResult.dryRun || boolArg(args, 'dry-discord')) {
    return { ok: true, dryRun: true, threadId, payload };
  }
  if (caseFile.discord?.websiteTaskThreadId) {
    const botToken = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
    if (!botToken) return { ok: false, skipped: true, reason: 'missing_website_task_bot_token', threadId, payload };
    const discord = await sendDiscordChannelMessage({
      channelId: threadId,
      botToken,
      payload,
    });
    discord.threadId = threadId;
    discord.threadReused = true;
    const record = recordCaseNotification(caseFile.paths, {
      type: 'agent_review_discord_sent',
      kind: 'website_task',
      ok: true,
      discord,
    });
    return { ok: true, threadId, payload, discord, caseRecord: record };
  }
  if (!webhookUrl) return { ok: false, skipped: true, reason: 'missing_webhook_url', threadId, payload };
  const discord = await sendDiscordWebhook(webhookUrl, payload, {
    threadId,
    botToken: process.env.DISCORD_BOT_TOKEN || '',
  });
  const record = recordCaseNotification(caseFile.paths, {
    type: 'agent_review_discord_sent',
    kind,
    ok: true,
    discord,
  });
  return { ok: true, threadId, payload, discord, caseRecord: record };
}

function discordThreadId(caseFile, kind) {
  const discord = caseFile.discord || {};
  if (discord.websiteTaskThreadId) return discord.websiteTaskThreadId;
  return kind === 'revision'
    ? discord.revisionThreadId || discord.salesThreadId || discord.lastChannelId || ''
    : discord.salesThreadId || discord.lastChannelId || '';
}

process.exit(completeResult.ok && (!deployResult || deployResult.ok) ? 0 : 1);

function recordAgentRuntimeCost(result, args) {
  const rawRate = args['runtime-cost-per-minute'] || args.runtimeCostPerMinute || process.env.AGENT_RUNTIME_COST_PER_MINUTE;
  if (rawRate === undefined || rawRate === '') return null;
  const costPerMinute = Number(rawRate);
  if (!Number.isFinite(costPerMinute)) return null;
  return appendLedgerEvent(agentRuntimeLedgerInput({
    clientSlug: result.clientSlug || null,
    campaignId: args.campaign || null,
    taskId: result.taskId,
    mode: result.mode,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    costPerMinute,
    provider: args['runtime-provider'] || args.runtimeProvider || 'agent-runtime',
    metadata: {
      repo: result.repo || '',
      dryRun: result.dryRun,
      pushed: result.pushed,
    },
  }), args.ledger || DEFAULT_LEDGER_PATH);
}

function indent(text) {
  return String(text)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}
