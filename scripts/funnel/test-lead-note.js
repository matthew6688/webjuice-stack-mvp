#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { recordLeadNote, readLeadNotes } from '../../core/funnel/lead-notes.js';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-note-'));
const previousCwd = process.cwd();
process.chdir(root);

try {
  const clientSlug = 'note-smoke-restaurant';
  const caseDir = path.join(root, 'data', 'cases', clientSlug, 'order-123');
  fs.mkdirSync(caseDir, { recursive: true });
  fs.writeFileSync(path.join(caseDir, 'case.json'), JSON.stringify({
    clientSlug,
    order: { id: 'order-123', paymentStatus: '' },
    customer: { company: 'Note Smoke Restaurant' },
    discord: {
      salesThreadId: 'thread-123',
      salesWorkspaceChannelId: 'forum-leads',
    },
    paths: {
      casePath: path.join(caseDir, 'case.json'),
      contextPath: path.join(caseDir, 'context-packet.json'),
      timelinePath: path.join(caseDir, 'timeline.jsonl'),
    },
    updatedAt: '2026-05-08T10:00:00.000Z',
  }), 'utf8');
  fs.writeFileSync(path.join(caseDir, 'timeline.jsonl'), '', 'utf8');
  fs.writeFileSync(path.join(caseDir, 'context-packet.json'), '{}', 'utf8');
  const outreachDir = path.join(root, 'clients', clientSlug, 'outreach');
  fs.mkdirSync(path.join(outreachDir, 'email'), { recursive: true });
  fs.writeFileSync(path.join(outreachDir, 'outreach-pack.json'), JSON.stringify({
    clientSlug,
    businessName: 'Note Smoke Restaurant',
    previewUrl: 'https://note-smoke-dev.pages.dev/',
    assets: { screenshots: { desktop: 'desktop.png', mobile: 'mobile.png' }, video: 'demo.mp4' },
    generatedAt: '2026-05-08T10:01:00.000Z',
  }), 'utf8');
  fs.writeFileSync(path.join(outreachDir, 'email', '01.json'), JSON.stringify({
    to: 'owner@example.com',
    subject: 'Preview ready',
    generatedAt: '2026-05-08T10:02:00.000Z',
    sendResult: { status: 'sent', provider: 'agentic-email', sentAt: '2026-05-08T10:03:00.000Z' },
  }), 'utf8');

  const calls = [];
  const result = await recordLeadNote({
    client_slug: clientSlug,
    order_id: 'order-123',
    company: 'Note Smoke Restaurant',
    actor: 'matthew',
    note: 'Called the owner. Asked to follow up next Tuesday.',
    next_follow_up_due: '2026-05-13',
  }, {
    clientsRoot: path.join(root, 'clients'),
    casesDir: path.join(root, 'data', 'cases'),
    discordBotToken: 'bot-token',
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(String(init.body)) : null });
      if (String(url).includes('/messages')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 'msg-1', channel_id: 'thread-123', guild_id: 'guild-1' }),
        };
      }
      if (String(url).includes('/channels/forum-leads')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            id: 'forum-leads',
            type: 15,
            available_tags: [
              { id: 'tag-restaurant', name: 'restaurant' },
              { id: 'tag-followup', name: 'follow-up-due' },
            ],
          }),
        };
      }
      if (String(url).includes('/channels/thread-123')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 'thread-123', name: '[Follow-up] Note Smoke Restaurant' }),
        };
      }
      return { ok: true, status: 200, text: async () => '{}' };
    },
  });

  assert.equal(result.ok, true);
  const notes = readLeadNotes(clientSlug, { clientsRoot: path.join(root, 'clients') });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].nextFollowUpDue, '2026-05-13');

  const timeline = fs.readFileSync(path.join(caseDir, 'timeline.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.ok(timeline.some((entry) => entry.type === 'lead_note_recorded'));
  assert.ok(timeline.some((entry) => entry.note === 'Called the owner. Asked to follow up next Tuesday.'));

  const index = loadLeadOutreachIndex({
    clientsRoot: path.join(root, 'clients'),
    casesRoot: path.join(root, 'data', 'cases'),
    paidIntakesRoot: path.join(root, 'data', 'paid-intakes'),
  });
  const record = index.records.find((item) => item.clientSlug === clientSlug);
  assert.ok(record);
  assert.equal(record.stageKey, 'follow_up_due');
  assert.equal(record.nextFollowUpDue, '2026-05-13');
  assert.equal(record.latestLeadNote?.note, 'Called the owner. Asked to follow up next Tuesday.');

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      notesLength: notes.length,
      stageKey: record?.stageKey,
      nextFollowUpDue: record?.nextFollowUpDue,
      timelineTypes: timeline.map((entry) => entry.type),
      discordCalls: calls.length,
    },
  }, null, 2));
} finally {
  process.chdir(previousCwd);
}
