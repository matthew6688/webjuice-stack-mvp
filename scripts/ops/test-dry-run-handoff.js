#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { dispatchDryRunHandoff } from '../../core/ops/dry-run-handoff.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-dry-run-handoff-'));
const caseDir = path.join(root, 'data', 'cases', 'rich-rare-restaurant', 'dryrun_handoff_test_001');
const calls = [];
let seq = 0;
const state = { tags: [] };

const fetchImpl = async (url, options = {}) => {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : null;
  calls.push({ url, method, body });
  const isForumCreate = /\/channels\/website-channel\/threads$/.test(String(url)) && method === 'POST';
  const isThreadMessage = /\/channels\/website-thread-\d+\/messages$/.test(String(url)) && method === 'POST';
  const isChannelInspect = /\/channels\/website-channel$/.test(String(url));
  const isChannelPatch = /\/channels\/website-channel$/.test(String(url)) && method === 'PATCH';
  let data = {};
  if (isChannelInspect) {
    data = { id: 'website-channel', type: 15, available_tags: state.tags };
  } else if (isChannelPatch) {
    state.tags = (body.available_tags || []).map((tag, index) => ({
      id: tag.id || `tag-${index + 1}`,
      name: tag.name,
      moderated: Boolean(tag.moderated),
      emoji_id: null,
      emoji_name: null,
    }));
    data = { id: 'website-channel', type: 15, available_tags: state.tags };
  } else if (isForumCreate) {
    const threadId = `website-thread-${++seq}`;
    data = { id: threadId, channel_id: 'website-channel', guild_id: 'guild-1', name: body.name };
  } else if (isThreadMessage) {
    data = {
      id: `thread-message-${++seq}`,
      channel_id: String(url).match(/\/channels\/(website-thread-\d+)\/messages$/)?.[1] || '',
      guild_id: 'guild-1',
    };
  }
  const status = isForumCreate ? 201 : 200;
  return { ok: true, status, text: async () => JSON.stringify(data) };
};

seedCase(caseDir);

const dryRun = await dispatchDryRunHandoff({
  caseDir,
  send: false,
  env: {
    WEBSITE_AGENT_MENTION: '<@1501073096696664184>',
  },
});

const sent = await dispatchDryRunHandoff({
  caseDir,
  send: true,
  fetchImpl,
  env: {
    WEBSITE_TASKS_DISCORD_CHANNEL_ID: 'website-channel',
    WEBSITE_TASKS_DISCORD_BOT_TOKEN: 'bot-token',
    WEBSITE_AGENT_MENTION: '<@1501073096696664184>',
  },
});

const updatedCase = JSON.parse(fs.readFileSync(path.join(caseDir, 'case.json'), 'utf8'));
const timeline = fs.readFileSync(path.join(caseDir, 'timeline.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const assertions = {
  dryRunOk: dryRun.ok === true && dryRun.send === false && dryRun.message.includes('Dry-run only'),
  sentOk: sent.ok === true && sent.dispatch?.ok === true,
  createdThread: sent.dispatch?.threadId === 'website-thread-1',
  caseRecordedThread: updatedCase.discord?.websiteTaskThreadId === 'website-thread-1',
  timelineRecorded: timeline.some((entry) => entry.type === 'website_agent_handoff_sent'),
  payloadCarriesBuildPacket: String(sent.payload?.content || '').includes('buildPacket:'),
  payloadCarriesWebsiteSurvey: String(sent.payload?.content || '').includes('websiteSurvey:'),
  payloadHasChineseAction: String(sent.payload?.content || '').includes('请先阅读'),
};

const failed = Object.entries(assertions).filter(([, value]) => value !== true).map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  root,
  assertions,
  failed,
  dispatchResultPath: path.join(caseDir, 'website-handoff-dispatch.json'),
}, null, 2));

if (failed.length) process.exit(1);

function seedCase(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const casePath = path.join(dir, 'case.json');
  const contextPath = path.join(dir, 'context-packet.json');
  const timelinePath = path.join(dir, 'timeline.jsonl');
  const taskDraftPath = path.join(dir, 'agent-task-draft.json');
  const checklistPath = path.join(dir, 'ops-checklist.json');
  const handoffPath = path.join(dir, 'website-handoff.json');

  fs.writeFileSync(casePath, `${JSON.stringify({
    schemaVersion: 1,
    caseId: 'rich-rare-restaurant_dryrun_handoff_test_001',
    status: 'dry_run_created',
    clientSlug: 'rich-rare-restaurant',
    repo: 'matthew6688/rich-rare-restaurant',
    branch: 'dev',
    previewUrl: 'https://rich-rare-restaurant-dev.pages.dev/',
    order: { id: 'dryrun_handoff_test_001', provider: 'dry_run', tier: 'dry_run' },
    customer: { company: 'Rich & Rare Restaurant', email: 'owner@example.com' },
    discord: {
      salesThreadId: '',
      revisionThreadId: '',
      websiteTaskThreadId: '',
      lastChannelId: '',
      lastMessageId: '',
      lastMessageUrl: '',
    },
    paths: {
      casePath,
      contextPath,
      timelinePath,
      buildPacketPath: path.join(dir, 'build-packet.md'),
      artifactsDir: path.join(dir, 'artifacts'),
    },
  }, null, 2)}\n`);
  fs.writeFileSync(contextPath, `${JSON.stringify({ caseId: 'ctx' }, null, 2)}\n`);
  fs.writeFileSync(timelinePath, '');
  fs.writeFileSync(checklistPath, `${JSON.stringify({
    status: 'ready_for_customer_review',
    stages: [],
    nextActions: [],
  }, null, 2)}\n`);
  fs.writeFileSync(handoffPath, `${JSON.stringify({
    clientSlug: 'rich-rare-restaurant',
    businessName: 'Rich & Rare Restaurant',
    repo: 'matthew6688/rich-rare-restaurant',
    previewUrl: 'https://rich-rare-restaurant-dev.pages.dev/',
    orderId: 'dryrun_handoff_test_001',
    buildPacketPath: path.join(dir, 'build-packet.md'),
    summaryText: 'ready',
  }, null, 2)}\n`);
  fs.writeFileSync(taskDraftPath, `${JSON.stringify({
    id: 'task_handoff_001',
    kind: 'sale',
    clientSlug: 'rich-rare-restaurant',
    repo: 'matthew6688/rich-rare-restaurant',
    branch: 'dev',
    requiredContext: {
      evidence: 'clients/rich-rare-restaurant/evidence/evidence.json',
      content: 'clients/rich-rare-restaurant/content.restaurant.json',
      design: 'clients/rich-rare-restaurant/design.restaurant.json',
      brandSpec: 'clients/rich-rare-restaurant/brand-spec.md',
      websiteSurvey: 'clients/rich-rare-restaurant/intake/website-survey.json',
    },
    openDesign: {
      status: 'bound',
      projectId: 'od-rich-rare',
      dataDir: 'clients/rich-rare-restaurant/concept/open-design',
      conceptPath: 'clients/rich-rare-restaurant/concept/open-design/concept.html',
      manifestPath: 'clients/rich-rare-restaurant/concept/open-design/concept-manifest.json',
      productionHandoffPath: 'clients/rich-rare-restaurant/concept/open-design/production-handoff.json',
      continueCommand: 'npm run open-design:continue-concept -- --client rich-rare-restaurant',
      syncCommand: 'npm run open-design:sync-from-app -- --client rich-rare-restaurant',
    },
    productionHandoffPath: 'clients/rich-rare-restaurant/concept/open-design/production-handoff.json',
    repoBootstrap: {
      command: 'npm run deploy:bootstrap-client-repo -- --repo matthew6688/rich-rare-restaurant',
      status: 'ready',
    },
  }, null, 2)}\n`);
}
