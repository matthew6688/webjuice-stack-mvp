#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadLeadOutreachIndex, matchesLeadView } from '../../core/funnel/lead-outreach-index.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-outreach-sent-'));
const previousCwd = process.cwd();
process.chdir(root);

try {
  const clientSlug = 'sent-smoke-restaurant';
  const outreachDir = path.join('clients', clientSlug, 'outreach');
  const emailDir = path.join(outreachDir, 'email');
  fs.mkdirSync(emailDir, { recursive: true });
  fs.writeFileSync(path.join(outreachDir, 'outreach-pack.json'), JSON.stringify({
    clientSlug,
    business: { name: 'Sent Smoke Restaurant' },
    previewUrl: 'https://sent-smoke-dev.pages.dev/',
    assets: {
      screenshots: { desktop: 'desktop.png', mobile: 'mobile.png' },
      video: 'demo.mp4',
    },
    emailBrief: {
      proofPoints: ['Preview ready'],
    },
    generatedAt: '2026-05-08T10:00:00.000Z',
  }), 'utf8');
  fs.writeFileSync(path.join(emailDir, '01-sent.json'), JSON.stringify({
    subject: 'Sent Smoke Restaurant: website preview',
    to: 'owner@example.com',
    generatedAt: '2026-05-08T10:05:00.000Z',
    dryRun: false,
    sendResult: {
      status: 'sent',
      provider: 'resend',
      sentAt: '2026-05-08T10:06:00.000Z',
      id: 're_test_sent_001',
    },
  }), 'utf8');

  const index = loadLeadOutreachIndex({
    clientsRoot: path.join(root, 'clients'),
    casesRoot: path.join(root, 'data', 'cases'),
    paidIntakesRoot: path.join(root, 'data', 'paid-intakes'),
  });
  const record = index.records.find((item) => item.clientSlug === clientSlug);
  assert.ok(record, 'expected synthetic lead record');
  assert.equal(record.stageKey, 'outreach_sent');
  assert.equal(record.outreachSent, true);
  assert.equal(record.outreachSendId, 're_test_sent_001');
  assert.equal(matchesLeadView(record, 'outreach_sent'), true);

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      hasRecord: Boolean(record),
      stageKey: record?.stageKey,
      outreachSent: record?.outreachSent === true,
      sendId: record?.outreachSendId === 're_test_sent_001',
      viewMatches: matchesLeadView(record, 'outreach_sent'),
    },
  }, null, 2));
} finally {
  process.chdir(previousCwd);
}
