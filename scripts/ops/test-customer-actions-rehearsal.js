#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { buildApprovalWorkflowDispatch, buildRevisionWorkflowDispatch } from '../../core/ops/workflow-dispatch.js';
import { routeFunnelSubmission } from '../../core/funnel/submission-router.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'customer-actions-rehearsal-'));
let seq = 0;
const autoThreads = new Map();

const fakeFetch = async (url, options = {}) => {
  const isWebhook = String(url).startsWith('https://discord.test/webhook');
  const isThreadCreate = /\/messages\/[^/]+\/threads$/.test(url);
  const isWebsiteChannel = /\/channels\/website-channel\/messages$/.test(String(url));
  const websiteChannelMessage = String(url).match(/\/channels\/website-channel\/messages\/([^/?]+)$/);
  const existingThread = String(url).match(/\/channels\/(website-thread-\d+)\/messages$/);
  let data;
  if (isWebhook) {
    data = { id: `sales-message-${++seq}`, channel_id: 'sales-channel', guild_id: 'guild-1' };
  } else if (isThreadCreate) {
    data = { id: `sales-thread-${seq}`, guild_id: 'guild-1' };
  } else if (isWebsiteChannel) {
    const messageId = `handoff-message-${++seq}`;
    autoThreads.set(messageId, `website-thread-${seq}`);
    data = { id: messageId, channel_id: 'website-channel', guild_id: 'guild-1' };
  } else if (websiteChannelMessage) {
    const messageId = websiteChannelMessage[1];
    data = { id: messageId, channel_id: 'website-channel', guild_id: 'guild-1', thread: { id: autoThreads.get(messageId) } };
  } else if (existingThread) {
    data = { id: `thread-message-${++seq}`, channel_id: existingThread[1], guild_id: 'guild-1' };
  } else {
    data = { id: `message-${++seq}`, channel_id: 'unknown', guild_id: 'guild-1' };
  }
  return { ok: true, status: 200, text: async () => JSON.stringify(data) };
};

const env = {
  SALES_DISCORD_WEBHOOK_URL: 'https://discord.test/webhook',
  REVISE_DISCORD_WEBHOOK_URL: 'https://discord.test/webhook',
  DISCORD_BOT_TOKEN: 'sales-bot-token',
  WEBSITE_TASKS_DISCORD_CHANNEL_ID: 'website-channel',
  WEBSITE_TASKS_DISCORD_BOT_TOKEN: 'handoff-bot-token',
  WEBSITE_AGENT_MENTION: '<@1501073096696664184>',
};

const commonOptions = {
  sendDiscord: true,
  sendEmail: false,
  dryRun: false,
  fetchImpl: fakeFetch,
  tasksDir: path.join(root, 'tasks'),
  submissionsDir: path.join(root, 'submissions'),
  entitlementsDir: path.join(root, 'entitlements'),
  casesDir: path.join(root, 'cases'),
  ledgerPath: path.join(root, 'ledger.jsonl'),
  env,
};

const sale = await routeFunnelSubmission({
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_customer_actions_001',
      payment_status: 'paid',
      mode: 'payment',
      amount_total: 39900,
      currency: 'usd',
      customer_details: { email: 'owner@example.com' },
      metadata: {
        repo: 'matthew6688/opa-bar-mezze-restaurant',
        client_slug: 'opa-bar-mezze-restaurant',
        tier: 'one_time',
        preview_url: 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
        business_name: 'Opa Bar & Mezze',
      },
    },
  },
}, {
  ...commonOptions,
  provider: 'stripe',
});

const websiteThreadId = sale.caseRecord?.caseFile?.discord?.websiteTaskThreadId || '';
const taskPath = sale.taskPath || '';

const revisionPayload = {
  order_id: 'cs_test_customer_actions_001',
  email: 'owner@example.com',
  client_slug: 'opa-bar-mezze-restaurant',
  repo: 'matthew6688/opa-bar-mezze-restaurant',
  requested_changes: 'Please tighten the headline and replace the first gallery photo.',
  files: ['hero-note.pdf'],
  asset_refs: '[{"filename":"hero-note.pdf","secureUrl":"https://res.cloudinary.com/demo/raw/upload/hero-note.pdf"}]',
  submitted_at: '2026-05-07T18:20:00.000Z',
};

const revisionDispatch = buildRevisionWorkflowDispatch(revisionPayload);
const revision = await routeFunnelSubmission({ fields: revisionPayload }, {
  ...commonOptions,
  provider: 'tally',
  kind: 'revision',
});

const approvalDispatch = buildApprovalWorkflowDispatch({
  order_id: 'cs_test_customer_actions_001',
  email: 'owner@example.com',
  client_slug: 'opa-bar-mezze-restaurant',
  repo: 'matthew6688/opa-bar-mezze-restaurant',
  task_path: taskPath,
}, {
  APPROVAL_ALLOW_DRY_RUN: 'true',
});

const approval = JSON.parse(execFileSync(process.execPath, [
  'scripts/agent/resolve-approved-task.js',
  '--cases-dir',
  path.join(root, 'cases'),
  '--client',
  'opa-bar-mezze-restaurant',
  '--order',
  'cs_test_customer_actions_001',
  '--email',
  'owner@example.com',
  '--task',
  taskPath,
], {
  cwd: process.cwd(),
  encoding: 'utf8',
}).trim());

const assertions = {
  saleOk: sale.ok === true,
  websiteThreadCreated: Boolean(websiteThreadId),
  revisionDispatchWorkflowCorrect: revisionDispatch.workflow === 'route-funnel-event.yml',
  revisionOk: revision.ok === true,
  revisionReusesWebsiteThread: revision.caseRecord?.caseFile?.discord?.websiteTaskThreadId === websiteThreadId,
  revisionReusesCase: revision.caseRecord?.ref?.casePath === sale.caseRecord?.ref?.casePath,
  approvalDispatchWorkflowCorrect: approvalDispatch.workflow === 'publish-approved.yml',
  approvalResolvesSameThread: approval.discord?.websiteTaskThreadId === websiteThreadId,
  approvalTargetsDevToMain: approval.sourceBranch === 'dev' && approval.targetBranch === 'main',
};

const failed = Object.entries(assertions)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  root,
  websiteThreadId,
  assertions,
  failed,
  casePath: sale.caseRecord?.ref?.casePath || '',
}, null, 2));

if (failed.length) process.exit(1);
