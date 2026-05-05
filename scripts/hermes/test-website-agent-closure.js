#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import os from 'os';
import { routeFunnelSubmission } from '../../core/funnel/submission-router.js';
import { recordCaseNotification } from '../../core/cases/case-file.js';
import {
  buildAgentReviewDiscordMessage,
  buildLivePublishedDiscordMessage,
  sendDiscordChannelMessage,
} from '../../core/funnel/discord.js';
import {
  buildAgentReviewEmail,
  buildLivePublishedEmail,
} from '../../core/funnel/customer-email.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'website-agent-closure-'));
let seq = 0;
const calls = [];
const autoThreads = new Map();

const fakeFetch = async (url, options = {}) => {
  const body = options.body ? JSON.parse(options.body) : null;
  calls.push({ url, body });
  const isWebhook = String(url).startsWith('https://discord.test/webhook');
  const isThreadCreate = /\/messages\/[^/]+\/threads$/.test(url);
  const isWebsiteChannel = /\/channels\/website-channel\/messages$/.test(url);
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
    data = {
      id: messageId,
      channel_id: 'website-channel',
      guild_id: 'guild-1',
    };
  } else if (websiteChannelMessage) {
    const messageId = websiteChannelMessage[1];
    data = {
      id: messageId,
      channel_id: 'website-channel',
      guild_id: 'guild-1',
      thread: { id: autoThreads.get(messageId) },
    };
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
  FROM_EMAIL: 'ProfitsLocal <hello@example.com>',
};
const session = {
  id: 'cs_test_closure_001',
  payment_status: 'paid',
  mode: 'payment',
  amount_total: 39900,
  currency: 'usd',
  customer_details: { email: 'closure@example.com' },
  metadata: {
    repo: 'matthew6688/opa-bar-mezze-restaurant',
    client_slug: 'opa-bar-mezze-restaurant',
    tier: 'one_time',
    preview_url: 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
    business_name: 'Opa Bar & Mezze',
  },
};

const commonOptions = {
  provider: 'stripe',
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
  data: { object: session },
}, commonOptions);

const revision = await routeFunnelSubmission({
  fields: {
    order_id: session.id,
    repo: session.metadata.repo,
    client_slug: session.metadata.client_slug,
    email: session.customer_details.email,
    feedback: 'Please update the hero headline and make the website more premium.',
    preview_url: session.metadata.preview_url,
  },
}, {
  ...commonOptions,
  provider: 'tally',
  kind: 'revision',
});

const saleThread = sale.caseRecord.caseFile.discord.websiteTaskThreadId;
const revisionThread = revision.caseRecord.caseFile.discord.websiteTaskThreadId;
const saleCasePaths = sale.caseRecord.caseFile.paths;
const revisionCasePaths = revision.caseRecord.caseFile.paths;
const casePath = saleCasePaths.casePath;
let caseFile = JSON.parse(fs.readFileSync(casePath, 'utf8'));

const runResult = {
  ok: true,
  taskId: revision.task.id,
  mode: 'revision',
  repo: session.metadata.repo,
  branch: 'dev',
  dryRun: false,
  pushed: true,
  commit: 'devcommit123',
  previewUrl: session.metadata.preview_url,
  changedFiles: ['src/app/page.tsx', 'src/components/Menu.tsx'],
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
};
const reviewDiscord = await sendDiscordChannelMessage({
  channelId: saleThread,
  botToken: env.WEBSITE_TASKS_DISCORD_BOT_TOKEN,
  payload: buildAgentReviewDiscordMessage({
    caseFile,
    runResult,
    deployResult: { status: 'completed', conclusion: 'success' },
  }),
  fetchImpl: fakeFetch,
});
reviewDiscord.threadId = saleThread;
reviewDiscord.threadReused = true;
const reviewRecord = recordCaseNotification(caseFile.paths, {
  type: 'agent_review_discord_sent',
  kind: 'website_task',
  ok: true,
  discord: reviewDiscord,
});
caseFile = reviewRecord.caseFile;
const reviewEmail = buildAgentReviewEmail({
  caseFile,
  runResult,
  deployResult: { status: 'completed', conclusion: 'success' },
  extraRevisionUrl: 'https://profitslocal.com/revision',
});

const publishResult = {
  ok: true,
  taskId: revision.task.id,
  mode: 'publish',
  repo: session.metadata.repo,
  sourceBranch: 'dev',
  targetBranch: 'main',
  dryRun: false,
  pushed: true,
  commit: 'livecommit123',
  devCommit: 'devcommit123',
  liveUrl: 'https://opa.example.com',
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
};
const publishDiscord = await sendDiscordChannelMessage({
  channelId: saleThread,
  botToken: env.WEBSITE_TASKS_DISCORD_BOT_TOKEN,
  payload: buildLivePublishedDiscordMessage({
    caseFile,
    publishResult,
    deployResult: { status: 'completed', conclusion: 'success' },
    liveUrl: publishResult.liveUrl,
  }),
  fetchImpl: fakeFetch,
});
publishDiscord.threadId = saleThread;
publishDiscord.threadReused = true;
const publishRecord = recordCaseNotification(caseFile.paths, {
  type: 'live_publish_discord_sent',
  kind: 'website_task',
  ok: true,
  discord: publishDiscord,
});
caseFile = publishRecord.caseFile;
const liveEmail = buildLivePublishedEmail({
  caseFile,
  publishResult,
  deployResult: { status: 'completed', conclusion: 'success' },
  liveUrl: publishResult.liveUrl,
});

const assertions = {
  saleOk: sale.ok,
  revisionOk: revision.ok,
  oneCaseFolder: saleCasePaths.casePath === revisionCasePaths.casePath,
  sameWebsiteThread: Boolean(saleThread && saleThread === revisionThread),
  revisionReusedThread: revision.websiteAgentHandoff?.discord?.threadReused === true,
  revisionPostedToExistingThread: calls.some((call) => call.url.includes(`/channels/${saleThread}/messages`)),
  taskHasCaseContext: Boolean(sale.task.case?.casePath && sale.task.case?.contextPath),
  taskHasEvidencePointers: Boolean(
    sale.task.requiredContext?.evidence
    && sale.task.requiredContext?.content
    && sale.task.requiredContext?.design
    && sale.task.requiredContext?.brandSpec
  ),
  taskHasHuashu: sale.task.designProtocol?.requiredSkill === 'huashu-design',
  taskHasOpenDesign: sale.task.designProtocol?.openDesignSkills?.includes('web-prototype'),
  caseTracksRevisionUsage: caseFile.revision?.used === 1,
  reviewPostedToSameWebsiteThread: reviewDiscord.threadId === saleThread && reviewDiscord.threadReused === true,
  publishPostedToSameWebsiteThread: publishDiscord.threadId === saleThread && publishDiscord.threadReused === true,
  reviewEmailHasApprovalAndRevisionLinks: Boolean(
    reviewEmail?.text?.includes('/approve?')
    && reviewEmail?.text?.includes('/revise?')
    && reviewEmail?.text?.includes(session.id)
  ),
  liveEmailHasLiveUrlAndOrderId: Boolean(
    liveEmail?.text?.includes(publishResult.liveUrl)
    && liveEmail?.text?.includes(session.id)
  ),
  caseMemoryTracksReviewAndPublishNotifications: caseFile.discord?.websiteTaskThreadId === saleThread
    && caseFile.status === 'revision_task_queued',
};

const failed = Object.entries(assertions)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  root,
  saleThread,
  revisionThread,
  assertions,
  failed,
  discordCalls: calls.map((call) => call.url),
}, null, 2));

if (failed.length) process.exit(1);
