#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { sendReadyForReviewEmail } from '../../core/ops/review-email-gate.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-review-email-gate-'));
const readyCaseDir = path.join(root, 'data', 'cases', 'opa-bar-mezze-restaurant', 'dryrun_review_gate_001');
const blockedCaseDir = path.join(root, 'data', 'cases', 'opa-bar-mezze-restaurant', 'dryrun_review_gate_002');
const resendCalls = [];

seedCase(readyCaseDir, { status: 'ready_for_customer_review' });
seedCase(blockedCaseDir, { status: 'blocked' });

const dryRunReady = await sendReadyForReviewEmail({
  caseDir: readyCaseDir,
  send: false,
});

const sentReady = await sendReadyForReviewEmail({
  caseDir: readyCaseDir,
  send: true,
  env: {
    RESEND_API_KEY: 're_test_123',
    FROM_EMAIL: 'ProfitsLocal <hello@example.com>',
  },
  fetchImpl: async (url, options = {}) => {
    resendCalls.push({ url, body: JSON.parse(options.body || '{}') });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 're_123' }),
      text: async () => JSON.stringify({ id: 're_123' }),
    };
  },
});

const blocked = await sendReadyForReviewEmail({
  caseDir: blockedCaseDir,
  send: true,
  env: {
    RESEND_API_KEY: 're_test_123',
  },
});

const readyTimeline = fs.readFileSync(path.join(readyCaseDir, 'timeline.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const assertions = {
  dryRunGatePasses: dryRunReady.ok === true && dryRunReady.send === false,
  actualSendPasses: sentReady.ok === true && sentReady.sendResult?.ok === true,
  resendCalledOnce: resendCalls.length === 1 && resendCalls[0].url === 'https://api.resend.com/emails',
  resendUsesDraftSubject: resendCalls[0]?.body?.subject === 'Your Opa Bar & Mezze dev preview is ready',
  timelineRecorded: readyTimeline.some((entry) => entry.type === 'customer_review_email_sent'),
  blockedRejected: blocked.ok === false && blocked.message.includes('ready_for_customer_review'),
};

const failed = Object.entries(assertions).filter(([, value]) => value !== true).map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  root,
  assertions,
  failed,
  readyResultPath: path.join(readyCaseDir, 'customer-review-email-send.json'),
  blockedResultPath: path.join(blockedCaseDir, 'customer-review-email-send.json'),
}, null, 2));

if (failed.length) process.exit(1);

function seedCase(dir, { status }) {
  fs.mkdirSync(dir, { recursive: true });
  const casePath = path.join(dir, 'case.json');
  const contextPath = path.join(dir, 'context-packet.json');
  const timelinePath = path.join(dir, 'timeline.jsonl');
  const reviewDraftPath = path.join(dir, 'customer-review-email-draft.json');
  const checklistPath = path.join(dir, 'ops-checklist.json');
  fs.writeFileSync(casePath, `${JSON.stringify({
    schemaVersion: 1,
    caseId: 'opa-bar-mezze-restaurant_case',
    status: 'dev_pushed_needs_review',
    clientSlug: 'opa-bar-mezze-restaurant',
    repo: 'matthew6688/opa-bar-mezze-restaurant',
    branch: 'dev',
    previewUrl: 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
    order: { id: path.basename(dir), provider: 'dry_run', tier: 'dry_run' },
    customer: { company: 'Opa Bar & Mezze', email: 'matthew6688@gmail.com' },
    discord: { websiteTaskThreadId: 'website-thread-1' },
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
  fs.writeFileSync(checklistPath, `${JSON.stringify({ status, stages: [], nextActions: [] }, null, 2)}\n`);
  fs.writeFileSync(reviewDraftPath, `${JSON.stringify({
    to: 'matthew6688@gmail.com',
    subject: 'Your Opa Bar & Mezze dev preview is ready',
    text: 'Preview ready',
    html: '<p>Preview ready</p>',
  }, null, 2)}\n`);
}
