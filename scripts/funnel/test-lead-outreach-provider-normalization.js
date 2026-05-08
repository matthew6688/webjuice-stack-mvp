#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-outreach-provider-'));
const previousCwd = process.cwd();
process.chdir(root);

try {
  seedInstantlyRepliedClient();
  seedSmartleadBouncedClient();
  seedAgenticEmailClient();

  const index = loadLeadOutreachIndex({
    clientsRoot: path.join(root, 'clients'),
    casesRoot: path.join(root, 'data', 'cases'),
    paidIntakesRoot: path.join(root, 'data', 'paid-intakes'),
  });

  const instantly = index.records.find((item) => item.clientSlug === 'instantly-smoke');
  const smartlead = index.records.find((item) => item.clientSlug === 'smartlead-smoke');
  const agentic = index.records.find((item) => item.clientSlug === 'agentic-email-smoke');

  assert.ok(instantly, 'expected instantly record');
  assert.equal(instantly.stageKey, 'replied');
  assert.equal(instantly.outreachProvider, 'instantly');
  assert.equal(instantly.replyState, 'replied');
  assert.equal(instantly.outreachCampaignId, 'camp-123');
  assert.equal(instantly.outreachLeadId, 'lead@example.com');
  assert.equal(instantly.outreachThreadUrl, 'https://app.instantly.ai/unibox/thread-123');

  assert.ok(smartlead, 'expected smartlead record');
  assert.equal(smartlead.stageKey, 'bounced');
  assert.equal(smartlead.outreachProvider, 'smartlead');
  assert.equal(smartlead.bounceState, 'bounced');
  assert.equal(smartlead.outreachCampaignId, 987);
  assert.equal(smartlead.outreachLeadId, 'smartlead@example.com');

  assert.ok(agentic, 'expected agentic email record');
  assert.equal(agentic.stageKey, 'replied');
  assert.equal(agentic.outreachProvider, 'agentic-email');
  assert.equal(agentic.replyState, 'replied');
  assert.equal(agentic.outreachThreadUrl, 'https://mail.profitslocal.com/thread/agentic-123');

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      instantly: {
        stageKey: instantly.stageKey,
        provider: instantly.outreachProvider,
        replyState: instantly.replyState,
        campaignId: instantly.outreachCampaignId,
      },
      smartlead: {
        stageKey: smartlead.stageKey,
        provider: smartlead.outreachProvider,
        bounceState: smartlead.bounceState,
        campaignId: smartlead.outreachCampaignId,
      },
      agentic: {
        stageKey: agentic.stageKey,
        provider: agentic.outreachProvider,
        replyState: agentic.replyState,
        threadUrl: agentic.outreachThreadUrl,
      },
    },
  }, null, 2));
} finally {
  process.chdir(previousCwd);
}

function seedInstantlyRepliedClient() {
  const clientSlug = 'instantly-smoke';
  const outreachDir = path.join('clients', clientSlug, 'outreach');
  const emailDir = path.join(outreachDir, 'email');
  fs.mkdirSync(emailDir, { recursive: true });
  fs.writeFileSync(path.join(outreachDir, 'outreach-pack.json'), JSON.stringify({
    clientSlug,
    business: { name: 'Instantly Smoke' },
    previewUrl: 'https://instantly-smoke-dev.pages.dev/',
    assets: { screenshots: { desktop: 'desktop.png', mobile: 'mobile.png' }, video: 'demo.mp4' },
    generatedAt: '2026-05-08T12:00:00.000Z',
  }), 'utf8');
  fs.writeFileSync(path.join(emailDir, '01-instantly.json'), JSON.stringify({
    subject: 'Instantly Smoke: preview',
    to: 'lead@example.com',
    generatedAt: '2026-05-08T12:05:00.000Z',
    dryRun: false,
    sendResult: {
      status: 'sent',
      provider: 'instantly',
      sourceSystem: 'instantly',
      sentAt: '2026-05-08T12:06:00.000Z',
      id: 'hook-evt-001',
    },
    providerEvent: {
      event_type: 'reply_received',
      timestamp: '2026-05-08T13:00:00.000Z',
      campaign_id: 'camp-123',
      lead_email: 'lead@example.com',
      email_id: 'msg-123',
      unibox_url: 'https://app.instantly.ai/unibox/thread-123',
      reply_text_snippet: 'Interested, send me more.',
    },
  }), 'utf8');
}

function seedSmartleadBouncedClient() {
  const clientSlug = 'smartlead-smoke';
  const outreachDir = path.join('clients', clientSlug, 'outreach');
  const emailDir = path.join(outreachDir, 'email');
  fs.mkdirSync(emailDir, { recursive: true });
  fs.writeFileSync(path.join(outreachDir, 'outreach-pack.json'), JSON.stringify({
    clientSlug,
    business: { name: 'Smartlead Smoke' },
    previewUrl: 'https://smartlead-smoke-dev.pages.dev/',
    assets: { screenshots: { desktop: 'desktop.png', mobile: 'mobile.png' }, video: 'demo.mp4' },
    generatedAt: '2026-05-08T12:00:00.000Z',
  }), 'utf8');
  fs.writeFileSync(path.join(emailDir, '01-smartlead.json'), JSON.stringify({
    subject: 'Smartlead Smoke: preview',
    to: 'smartlead@example.com',
    generatedAt: '2026-05-08T12:05:00.000Z',
    dryRun: false,
    sendResult: {
      status: 'sent',
      provider: 'smartlead',
      sourceSystem: 'smartlead',
      sentAt: '2026-05-08T12:06:00.000Z',
      id: 'smartlead-send-001',
    },
    providerEvent: {
      event: 'EMAIL_BOUNCED',
      timestamp: '2026-05-08T13:10:00.000Z',
      campaign_id: 987,
      lead_id: 'smartlead@example.com',
      email: { message_id: 'sl-msg-001' },
      lead: { email: 'smartlead@example.com' },
    },
  }), 'utf8');
}

function seedAgenticEmailClient() {
  const clientSlug = 'agentic-email-smoke';
  const outreachDir = path.join('clients', clientSlug, 'outreach');
  const emailDir = path.join(outreachDir, 'email');
  fs.mkdirSync(emailDir, { recursive: true });
  fs.writeFileSync(path.join(outreachDir, 'outreach-pack.json'), JSON.stringify({
    clientSlug,
    business: { name: 'Agentic Inbox Smoke' },
    previewUrl: 'https://agentic-email-smoke-dev.pages.dev/',
    assets: { screenshots: { desktop: 'desktop.png', mobile: 'mobile.png' }, video: 'demo.mp4' },
    generatedAt: '2026-05-08T12:00:00.000Z',
  }), 'utf8');
  fs.writeFileSync(path.join(emailDir, '01-agentic.json'), JSON.stringify({
    subject: 'Agentic Inbox Smoke: preview',
    to: 'agentic@example.com',
    generatedAt: '2026-05-08T12:05:00.000Z',
    dryRun: false,
    sendResult: {
      status: 'sent',
      provider: 'agentic-email',
      sourceSystem: 'agentic-email',
      sentAt: '2026-05-08T12:06:00.000Z',
      id: 'agentic-send-001',
      externalThreadUrl: 'https://mail.profitslocal.com/thread/agentic-123',
    },
    providerEvent: {
      provider: 'agentic-email',
      status: 'replied',
      timestamp: '2026-05-08T13:15:00.000Z',
      threadUrl: 'https://mail.profitslocal.com/thread/agentic-123',
      replySnippet: 'Looks good, tell me pricing.',
      leadEmail: 'agentic@example.com',
    },
  }), 'utf8');
}
