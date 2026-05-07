#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { publishApprovedTask, savePublishResult } from '../../core/agents/publisher.js';
import { getLatestGithubActionsRun } from '../../core/deploy/github-actions.js';
import { buildLivePublishedEmail, sendCustomerEmail } from '../../core/funnel/customer-email.js';
import { buildLivePublishedDiscordMessage, sendDiscordChannelMessage, sendDiscordWebhook } from '../../core/funnel/discord.js';
import { updateForumWorkspaceStage } from '../../core/funnel/discord-workspace.js';
import { recordCaseNotification } from '../../core/cases/case-file.js';
import { DEFAULT_LEDGER_PATH } from '../../core/finance/ledger.js';

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
  qaScreenshots: args['qa-screenshots'] || args.qaScreenshots || '',
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
  if (message) customerEmail = await sendCustomerEmail(process.env, message, {
    ledgerPath: args.ledger || DEFAULT_LEDGER_PATH,
    clientSlug: task.clientSlug || publishResult.clientSlug || null,
    campaignId: args.campaign || task.campaignId || null,
    emailMetadata: { taskId: task.id, kind: 'live_published' },
  });
}

const discordNotification = await sendLivePublishedDiscord({
  args,
  task,
  caseFile,
  publishResult,
  deployResult,
});

const result = {
  ...publishResult,
  audit: {
    ...(publishResult.audit || {}),
    devDeployUrl: task.previewUrl || '',
    customerEmailId: customerEmail.id || '',
  },
  deployResult,
  customerEmail,
  discordNotification,
};
const outputPath = args.output || path.join('data/agent-runs', `${task.id}.publish.json`);
savePublishResult(result, outputPath);

console.log(`Publish result written: ${outputPath}`);
console.log(`Status: ${result.ok ? 'ok' : 'failed'}`);
console.log(`Dry run: ${result.dryRun ? 'yes' : 'no'}`);
console.log(`Pushed: ${result.pushed ? 'yes' : 'no'}`);
console.log(`Deploy: ${deployResult ? `${deployResult.status}${deployResult.conclusion ? `/${deployResult.conclusion}` : ''}` : 'not checked'}`);
console.log(`Email: ${customerEmail.ok ? 'sent' : (customerEmail.skipped ? 'skipped' : 'failed')}`);
console.log(`Discord: ${discordNotification.ok ? (discordNotification.dryRun ? 'dry-run' : 'sent') : (discordNotification.skipped ? 'skipped' : 'failed')}`);
for (const step of result.steps) {
  console.log(`- ${step.id}: ${step.ok ? 'ok' : 'failed'} (${step.command})`);
}

process.exit(result.ok && (!deployResult || deployResult.ok) ? 0 : 1);

async function sendLivePublishedDiscord({ args, task, caseFile, publishResult, deployResult }) {
  if (!boolArg(args, 'send-discord')) return { ok: false, skipped: true };
  if (!caseFile) return { ok: false, skipped: true, reason: 'missing_case_file' };
  const kind = task.kind === 'revision' ? 'revision' : 'sale';
  const webhookUrl = kind === 'revision'
    ? process.env.REVISE_DISCORD_WEBHOOK_URL
    : process.env.SALES_DISCORD_WEBHOOK_URL;
  const threadId = discordThreadId(caseFile, kind);
  const liveUrl = args['live-url'] || args.liveUrl || '';
  const payload = buildLivePublishedDiscordMessage({ caseFile, publishResult, deployResult, liveUrl });
  if (!threadId) return { ok: false, skipped: true, reason: 'missing_discord_thread_id', payload };
  if (publishResult.dryRun || boolArg(args, 'dry-discord')) {
    return { ok: true, dryRun: true, threadId, payload };
  }
  if (caseFile.discord?.websiteTaskThreadId) {
    const botToken = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
    if (!botToken) return { ok: false, skipped: true, reason: 'missing_website_task_bot_token', threadId, payload };
    let approvedWorkspace = null;
    let liveWorkspace = null;
    try {
      approvedWorkspace = await updateForumWorkspaceStage({
        workspace: 'projects',
        threadId,
        channelId: caseFile.discord?.websiteWorkspaceChannelId || '',
        botToken,
        kind: 'approved',
        order: {
          clientSlug: caseFile.clientSlug,
          company: caseFile.customer?.company || '',
          template: caseFile.template || '',
        },
        caseFile,
        revision: caseFile.revision || null,
      });
    } catch (error) {
      approvedWorkspace = { ok: false, error: error.message || String(error) };
    }
    const discord = await sendDiscordChannelMessage({
      channelId: threadId,
      botToken,
      payload,
    });
    discord.threadId = threadId;
    discord.threadReused = true;
    try {
      liveWorkspace = await updateForumWorkspaceStage({
        workspace: 'projects',
        threadId,
        channelId: caseFile.discord?.websiteWorkspaceChannelId || '',
        botToken,
        kind: 'live',
        order: {
          clientSlug: caseFile.clientSlug,
          company: caseFile.customer?.company || '',
          template: caseFile.template || '',
        },
        caseFile,
        revision: caseFile.revision || null,
      });
    } catch (error) {
      liveWorkspace = { ok: false, error: error.message || String(error) };
    }
    discord.workspaceUpdate = { approvedWorkspace, liveWorkspace };
    const record = recordCaseNotification(caseFile.paths, {
      type: 'live_publish_discord_sent',
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
    type: 'live_publish_discord_sent',
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
