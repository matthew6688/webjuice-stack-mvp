#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  persistAndMaybeDispatchWebsiteTask,
  routeWebsiteTaskMessage,
} from '../../core/discord-tasks/task-router.js';
import {
  appendTaskLog,
  buildTaskLogDiscordPayload,
} from '../../core/discord-tasks/task-log.js';
import { buildWebsiteTaskThreadTitle } from '../../core/discord-tasks/thread-title.js';

const qaRoot = path.join('data', 'qa', 'discord-task-router');
fs.rmSync(qaRoot, { recursive: true, force: true });

const imageMessage = {
  id: '1502000000000000001',
  channel_id: '1501072883001065614',
  guild_id: 'guild-1',
  author: { id: 'operator-1', username: 'matthew' },
  content: [
    'Roofing & Restoration',
    '40 years experience call or message now',
    'Call Greg on 0424 371 622',
  ].join('\n'),
  attachments: [{
    id: 'att-1',
    filename: 'roofing-sign.jpg',
    url: 'https://cdn.discordapp.test/roofing-sign.jpg',
    content_type: 'image/jpeg',
  }],
};

const searchMessage = {
  id: '1502000000000000002',
  channel_id: '1501072883001065614',
  guild_id: 'guild-1',
  author: { id: 'operator-1', username: 'matthew' },
  content: 'google search Brisbane roofers leads, push the good ones to mockup if strong',
};

const auditMessage = {
  id: '1502000000000000003',
  channel_id: '1501072883001065614',
  guild_id: 'guild-1',
  author: { id: 'operator-1', username: 'matthew' },
  content: 'audit this existing website for redesign https://example-roofing.com.au',
};

const projectMessage = {
  id: '1502000000000000004',
  channel_id: '1501072883001065614',
  guild_id: 'guild-1',
  author: { id: 'operator-1', username: 'matthew' },
  content: 'Open Design project needs a hero revision and then sync to repo',
};

const imageRoute = routeWebsiteTaskMessage({ message: imageMessage, dataRoot: qaRoot });
const searchRoute = routeWebsiteTaskMessage({ message: searchMessage, dataRoot: qaRoot });
const auditRoute = routeWebsiteTaskMessage({ message: auditMessage, dataRoot: qaRoot });
const projectRoute = routeWebsiteTaskMessage({ message: projectMessage, dataRoot: qaRoot });

const calls = [];
const fetchImpl = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
  if (/\/messages\/1502000000000000001\/threads$/.test(String(url)) && options.method === 'POST') {
    return jsonResponse(201, { id: 'thread-image-1', guild_id: 'guild-1' });
  }
  if (/\/channels\/thread-image-1\/messages$/.test(String(url)) && options.method === 'POST') {
    return jsonResponse(200, { id: 'thread-message-1', channel_id: 'thread-image-1', guild_id: 'guild-1' });
  }
  return jsonResponse(404, { error: 'unexpected call' });
};

const sent = await persistAndMaybeDispatchWebsiteTask({
  message: imageMessage,
  channelId: '1501072883001065614',
  botToken: 'test-token',
  dataRoot: qaRoot,
  send: true,
  fetchImpl,
  now: '2026-05-09T00:00:00.000Z',
});

const persistedOnly = await persistAndMaybeDispatchWebsiteTask({
  message: {
    ...searchMessage,
    id: '1502000000000000005',
    threadId: 'existing-thread-1',
  },
  channelId: '1501072883001065614',
  botToken: '',
  dataRoot: qaRoot,
  send: false,
  now: '2026-05-09T00:02:00.000Z',
});

const logEntry = appendTaskLog(sent.logPath, {
  event: 'tool',
  stage: '图片线索识别',
  tool: 'web search',
  input: '"0424 371 622" roofing',
  output: 'matched directory listing; no dedicated website found',
  sourceUrl: 'https://betterpages.com.au/item/mb-roofing/',
  decision: '可继续',
  reason: '可联系且没有独立官网，是 starter mockup 机会。',
  nextAction: '创建 ready-to-build payload',
}, { now: '2026-05-09T00:01:00.000Z' });
const logPayload = buildTaskLogDiscordPayload(logEntry);
const stageTitle = buildWebsiteTaskThreadTitle({
  stage: 'ready_for_mockup',
  businessName: 'M&B Roofing',
  industry: 'roofing',
  city: 'Western Sydney',
});

const result = {
  ok: true,
  routes: {
    image: imageRoute.task.intent.kind,
    search: searchRoute.task.intent.kind,
    audit: auditRoute.task.intent.kind,
    project: projectRoute.task.intent.kind,
  },
  artifacts: {
    taskExists: fs.existsSync(sent.taskPath),
    logExists: fs.existsSync(sent.logPath),
    taskPath: sent.taskPath,
    logPath: sent.logPath,
    persistedOnlyTaskExists: fs.existsSync(persistedOnly.taskPath),
  },
  discord: {
    createdThread: sent.task.thread.id === 'thread-image-1',
    postedInitialPayload: calls.some((call) => /\/channels\/thread-image-1\/messages$/.test(call.url)),
    initialPayloadMentionsNoOne: sent.initialPayload.allowed_mentions?.parse?.length === 0,
  },
  log: {
    payloadHasTool: logPayload.content.includes('工具：web search'),
    payloadHasEvidenceUrl: logPayload.content.includes('betterpages.com.au'),
  },
  title: {
    stageTitle,
    titleLooksSynced: stageTitle === '[可做 Mockup] M&B Roofing · roofing · Western Sydney',
  },
  persistedOnly: {
    dryRun: persistedOnly.dryRun === true,
    existingThreadPreserved: persistedOnly.task.thread.id === 'existing-thread-1',
  },
};

result.assertions = {
  imageRoute: result.routes.image === 'image_lead_discovery',
  searchRoute: result.routes.search === 'lead_search_discovery',
  auditRoute: result.routes.audit === 'site_audit',
  projectRoute: result.routes.project === 'website_project_task',
  taskPersisted: result.artifacts.taskExists,
  persistedOnlyTaskCreated: result.artifacts.persistedOnlyTaskExists,
  persistedOnlyKeepsThread: result.persistedOnly.dryRun && result.persistedOnly.existingThreadPreserved,
  logPersisted: result.artifacts.logExists,
  threadCreated: result.discord.createdThread,
  initialPayloadPosted: result.discord.postedInitialPayload,
  noAccidentalMention: result.discord.initialPayloadMentionsNoOne,
  logPayloadReadable: result.log.payloadHasTool && result.log.payloadHasEvidenceUrl,
  stageTitleTemplate: result.title.titleLooksSynced,
};

fs.mkdirSync(qaRoot, { recursive: true });
fs.writeFileSync(path.join(qaRoot, 'summary.json'), `${JSON.stringify(result, null, 2)}\n`);

if (!Object.values(result.assertions).every(Boolean)) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));

function jsonResponse(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value),
  };
}
