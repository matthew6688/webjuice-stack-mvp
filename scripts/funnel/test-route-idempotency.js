#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { routeFunnelSubmission } from '../../core/funnel/submission-router.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'funnel-idempotency-'));
const common = {
  provider: 'stripe',
  dryRun: false,
  sendDiscord: false,
  sendEmail: false,
  tasksDir: path.join(root, 'tasks'),
  submissionsDir: path.join(root, 'submissions'),
  entitlementsDir: path.join(root, 'orders'),
  casesDir: path.join(root, 'cases'),
  ledgerPath: path.join(root, 'ledger.jsonl'),
};
const event = {
  id: 'evt_test_idempotency_001',
  object: 'event',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_idempotency_001',
      object: 'checkout.session',
      amount_total: 39900,
      currency: 'usd',
      payment_status: 'paid',
      customer_email: 'owner@example.com',
      metadata: {
        tier: 'one_time',
        business_name: 'Opa Bar & Mezze',
        client_slug: 'opa-bar-mezze-restaurant',
        repo: 'matthew6688/opa-bar-mezze-restaurant',
        template: 'webjuice-restaurant',
        preview_url: 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
      },
    },
  },
};

const first = await routeFunnelSubmission(event, common);
const second = await routeFunnelSubmission(event, common);
const ledgerLines = fs.existsSync(common.ledgerPath)
  ? fs.readFileSync(common.ledgerPath, 'utf8').trim().split('\n').filter(Boolean)
  : [];
const taskFiles = listFiles(common.tasksDir);

const assertions = {
  firstCreatesTask: first.ok === true && Boolean(first.taskPath) && first.duplicate !== true,
  secondIsDuplicate: second.ok === true && second.duplicate === true,
  secondSkipsTask: second.taskPath === null,
  ledgerWrittenOnce: ledgerLines.length === 1,
  taskWrittenOnce: taskFiles.length === 1,
};
const failed = Object.entries(assertions)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  assertions,
  failed,
  first: { ok: first.ok, duplicate: first.duplicate, taskPath: first.taskPath, submissionPath: first.submissionPath },
  second: { ok: second.ok, duplicate: second.duplicate, taskPath: second.taskPath, submissionPath: second.submissionPath },
  ledgerLines: ledgerLines.length,
  taskFiles,
}, null, 2));

if (failed.length) process.exit(1);

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true })
    .map((file) => path.join(dir, file))
    .filter((file) => fs.statSync(file).isFile());
}
