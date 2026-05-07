#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { routeFunnelSubmission } from '../../core/funnel/submission-router.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'revision-thread-reuse-'));
let seq = 0;
const calls = [];
const autoThreads = new Map();

const fakeFetch = async (url, options = {}) => {
  const body = options.body ? JSON.parse(options.body) : null;
  calls.push({ url, body });
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
      id: 'cs_test_revision_reuse_sale_001',
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

const revision = await routeFunnelSubmission({
  fields: {
    order_id: 'cs_test_revision_reuse_sale_001',
    email: 'owner@example.com',
    client_slug: 'opa-bar-mezze-restaurant',
    repo: 'matthew6688/opa-bar-mezze-restaurant',
    requested_changes: 'Please tighten the hero copy and swap the lead photo.',
    attachment_summary: 'hero-notes.pdf (application/pdf, 4 KB)',
    asset_refs: '[{"filename":"hero-notes.pdf","secureUrl":"https://res.cloudinary.com/demo/raw/upload/hero-notes.pdf"}]',
  },
}, {
  ...commonOptions,
  provider: 'tally',
  kind: 'revision',
});

const saleThread = sale.caseRecord?.caseFile?.discord?.websiteTaskThreadId || '';
const revisionThread = revision.caseRecord?.caseFile?.discord?.websiteTaskThreadId || '';
const sameCase = sale.caseRecord?.ref?.casePath === revision.caseRecord?.ref?.casePath;

const assertions = {
  saleOk: sale.ok === true,
  revisionOk: revision.ok === true,
  sameCasePath: sameCase,
  sameWebsiteThread: Boolean(saleThread && saleThread === revisionThread),
  revisionReusedThread: revision.websiteAgentHandoff?.discord?.threadReused === true,
  revisionTaskCreated: String(revision.taskPath || '').includes('revision-'),
  revisionAttachmentPreserved: revision.order?.files?.some((item) => String(item).includes('hero-notes.pdf')) === true,
};

const failed = Object.entries(assertions).filter(([, value]) => value !== true).map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  root,
  saleThread,
  revisionThread,
  assertions,
  failed,
}, null, 2));

if (failed.length) process.exit(1);
