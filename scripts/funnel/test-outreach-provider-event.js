#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { syncOutreachProviderEvent } from '../../core/funnel/outreach-provider-event.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-provider-event-'));
const previousCwd = process.cwd();
process.chdir(root);

try {
  seedClient();
  seedCase();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : null });
    if (method === 'GET' && String(url).includes('/channels/forum-leads')) {
      return response({
        id: 'forum-leads',
        type: 15,
        available_tags: [
          { id: 'tag-restaurant', name: 'restaurant' },
          { id: 'tag-qualified', name: 'qualified' },
          { id: 'tag-replied', name: 'replied' },
          { id: 'tag-bounced', name: 'bounced' },
          { id: 'tag-followup', name: 'follow-up-due' },
          { id: 'tag-paid', name: 'paid' },
        ],
      });
    }
    if (method === 'PATCH' && String(url).includes('/channels/forum-leads')) {
      return response({
        id: 'forum-leads',
        available_tags: [
          { id: 'tag-restaurant', name: 'restaurant' },
          { id: 'tag-qualified', name: 'qualified' },
          { id: 'tag-replied', name: 'replied' },
          { id: 'tag-bounced', name: 'bounced' },
          { id: 'tag-followup', name: 'follow-up-due' },
          { id: 'tag-paid', name: 'paid' },
        ],
      });
    }
    if (method === 'POST' && String(url).includes('/channels/thread-123/messages')) {
      return response({ id: 'msg-123', channel_id: 'thread-123', guild_id: 'guild-1' });
    }
    if (method === 'PATCH' && String(url).includes('/channels/thread-123')) {
      return response({ id: 'thread-123', guild_id: 'guild-1' });
    }
    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  };

  const result = await syncOutreachProviderEvent({
    provider: 'agentic-email',
    order_id: 'order-123',
    company: 'Agentic Reply Client',
    event: {
      provider: 'agentic-email',
      status: 'replied',
      timestamp: '2026-05-08T14:00:00.000Z',
      threadUrl: 'https://mail.profitslocal.com/thread/abc',
      replySnippet: 'Sounds good. What is the price?',
      leadEmail: 'owner@example.com',
    },
  }, {
    clientsRoot: path.join(root, 'clients'),
    casesDir: path.join(root, 'data', 'cases'),
    discordBotToken: 'bot-token',
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.clientSlug, 'agentic-reply-client');
  assert.equal(result.leadMatch.ok, true);
  assert.equal(result.outreachState.replyState, 'replied');
  assert.equal(result.forumSync.ok, true);
  assert.equal(result.forumSync.stage.threadName, '[Replied] Agentic Reply Client');
  assert.deepEqual(result.forumSync.stage.appliedTagIds, ['tag-restaurant', 'tag-replied']);

  const artifact = JSON.parse(fs.readFileSync(path.join(root, 'clients', 'agentic-reply-client', 'outreach', 'email', '01-reply.json'), 'utf8'));
  assert.equal(artifact.providerEvent.status, 'replied');
  assert.equal(artifact.sendResult.externalThreadUrl, 'https://mail.profitslocal.com/thread/abc');

  const timelinePath = path.join(root, 'data', 'cases', 'agentic-reply-client', 'order-123', 'timeline.jsonl');
  const timeline = fs.readFileSync(timelinePath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.ok(timeline.some((entry) => entry.type === 'outreach_provider_event_received'));
  assert.ok(timeline.some((entry) => entry.type === 'lead_workspace_outreach_updated'));

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      replyState: result.outreachState.replyState,
      clientSlug: result.clientSlug,
      forumThreadName: result.forumSync.stage.threadName,
      forumTags: result.forumSync.stage.appliedTagIds,
      timelineTypes: timeline.map((entry) => entry.type),
      fetchCalls: calls.length,
    },
  }, null, 2));
} finally {
  process.chdir(previousCwd);
}

function seedClient() {
  const dir = path.join('clients', 'agentic-reply-client', 'outreach', 'email');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '01-reply.json'), JSON.stringify({
    provider: 'agentic-email',
    to: 'owner@example.com',
    generatedAt: '2026-05-08T13:00:00.000Z',
    sendResult: {
      status: 'sent',
      provider: 'agentic-email',
      sourceSystem: 'agentic-email',
      sentAt: '2026-05-08T13:05:00.000Z',
      externalThreadUrl: 'https://mail.profitslocal.com/thread/abc',
    },
    leadWorkspace: {
      threadId: 'thread-123',
      channelId: 'forum-leads',
      name: '[Lead] Agentic Reply Client',
      tagIds: ['tag-restaurant', 'tag-cold'],
      threadUrl: 'https://discord.com/channels/guild-1/thread-123',
    },
  }, null, 2));
}

function seedCase() {
  const dir = path.join('data', 'cases', 'agentic-reply-client', 'order-123');
  fs.mkdirSync(dir, { recursive: true });
  const caseFile = {
    schemaVersion: 1,
    caseId: 'agentic-reply-client_order-123',
    status: 'paid_task_queued',
    clientSlug: 'agentic-reply-client',
    repo: 'matthew6688/agentic-reply-client',
    branch: 'dev',
    previewUrl: 'https://agentic-reply-client-dev.pages.dev/',
    template: 'webjuice-restaurant',
    order: { id: 'order-123', provider: 'manual', tier: 'one_time', amount: 399, currency: 'USD', paymentStatus: 'not_paid' },
    customer: { company: 'Agentic Reply Client', email: 'owner@example.com', phone: '', domain: '' },
    revision: { policy: null, used: 0, remaining: null, lastReason: '' },
    discord: {
      salesThreadId: 'thread-123',
      salesWorkspaceChannelId: 'forum-leads',
      salesWorkspaceType: 'forum_post',
      salesWorkspaceName: '[Lead] Agentic Reply Client',
      salesWorkspaceTagIds: ['tag-restaurant', 'tag-cold'],
      revisionThreadId: '',
      websiteTaskThreadId: '',
      revisionWorkspaceChannelId: '',
      revisionWorkspaceType: '',
      revisionWorkspaceName: '',
      revisionWorkspaceTagIds: [],
      websiteWorkspaceChannelId: '',
      websiteWorkspaceType: '',
      websiteWorkspaceName: '',
      websiteWorkspaceTagIds: [],
      lastChannelId: '',
      lastMessageId: '',
      lastMessageUrl: '',
      lastThreadUrl: 'https://discord.com/channels/guild-1/thread-123',
      threadCreatedByBot: true,
    },
    sourceOfTruth: {},
    activeConstraints: [],
    lockedDecisions: [],
    latestTask: null,
    paths: {
      casePath: path.join(dir, 'case.json'),
      contextPath: path.join(dir, 'context-packet.json'),
      timelinePath: path.join(dir, 'timeline.jsonl'),
      decisionsPath: path.join(dir, 'decisions.jsonl'),
      customerMessagesPath: path.join(dir, 'customer-messages.jsonl'),
      agentRunsPath: path.join(dir, 'agent-runs.jsonl'),
      buildPacketPath: path.join(dir, 'build-packet.md'),
      artifactsDir: path.join(dir, 'artifacts'),
    },
    createdAt: '2026-05-08T13:00:00.000Z',
    updatedAt: '2026-05-08T13:00:00.000Z',
  };
  fs.writeFileSync(path.join(dir, 'case.json'), `${JSON.stringify(caseFile, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'context-packet.json'), `${JSON.stringify({ clientSlug: 'agentic-reply-client' }, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'timeline.jsonl'), '');
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
