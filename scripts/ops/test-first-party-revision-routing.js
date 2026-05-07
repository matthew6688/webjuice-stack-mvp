#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { routeFunnelSubmission } from '../../core/funnel/submission-router.js';
import { createEntitlementFromOrder } from '../../core/funnel/entitlements.js';
import { buildCaseReference } from '../../core/cases/case-file.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'first-party-revision-route-'));
const entitlementsDir = path.join(root, 'data/funnel/orders');
const tasksDir = path.join(root, 'data/agent-tasks');
const submissionsDir = path.join(root, 'data/funnel/submissions');
const casesDir = path.join(root, 'data/cases');
const order = {
  orderId: 'cs_test_first_party_revision_001',
  clientSlug: 'opa-bar-mezze-restaurant',
  repo: 'matthew6688/opa-bar-mezze-restaurant',
  previewUrl: 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
  company: 'Opa Bar & Mezze',
  email: 'owner@example.com',
  tier: 'one_time',
  amount: 399,
  currency: 'USD',
};

createEntitlementFromOrder(order, { entitlementsDir, dryRun: false });
const caseRef = buildCaseReference(order, { casesDir });
fs.mkdirSync(path.dirname(caseRef.casePath), { recursive: true });
fs.writeFileSync(caseRef.casePath, `${JSON.stringify({
  schemaVersion: 1,
  caseId: caseRef.caseId,
  clientSlug: order.clientSlug,
  repo: order.repo,
  branch: 'dev',
  previewUrl: order.previewUrl,
  order: { id: order.orderId, tier: order.tier, amount: order.amount, currency: order.currency },
  customer: { company: order.company, email: order.email },
  discord: { websiteTaskThreadId: 'thread_live_test_001' },
  latestTask: null,
  paths: {
    casePath: caseRef.casePath,
    contextPath: caseRef.contextPath,
    timelinePath: caseRef.timelinePath,
    decisionsPath: caseRef.decisionsPath,
    customerMessagesPath: caseRef.customerMessagesPath,
    agentRunsPath: caseRef.agentRunsPath,
    artifactsDir: caseRef.artifactsDir,
  },
}, null, 2)}\n`);

const payload = {
  order_id: order.orderId,
  email: order.email,
  client_slug: order.clientSlug,
  repo: order.repo,
  preview_url: order.previewUrl,
  requested_changes: 'Keep the website unchanged; this is a first-party revision routing smoke.',
  confirm_revision_scope: 'on',
  submitted_at: '2026-05-07T09:00:00.000Z',
  files: ['smoke.txt (raw, 12 B) https://res.cloudinary.com/demo/raw/upload/smoke.txt'],
};

const result = await routeFunnelSubmission(payload, {
  provider: 'tally',
  kind: 'revision',
  dryRun: false,
  sendDiscord: false,
  sendEmail: false,
  entitlementsDir,
  tasksDir,
  submissionsDir,
  casesDir,
});

const task = result.taskPath ? JSON.parse(fs.readFileSync(result.taskPath, 'utf8')) : null;
const caseFile = JSON.parse(fs.readFileSync(caseRef.casePath, 'utf8'));
const assertions = {
  ok: result.ok === true,
  clientSlugPreserved: result.order?.clientSlug === order.clientSlug,
  repoPreserved: result.order?.repo === order.repo,
  taskCreated: Boolean(result.taskPath && fs.existsSync(result.taskPath)),
  taskUsesSameClient: task?.clientSlug === order.clientSlug,
  taskUsesRevisionKind: task?.kind === 'revision',
  caseLatestTaskWritten: String(caseFile.latestTask?.kind || '') === 'revision',
  caseThreadStillPresent: caseFile.discord?.websiteTaskThreadId === 'thread_live_test_001',
  entitlementConsumed: result.entitlement?.entitlement?.revisionUsed === 1,
};

const failed = Object.entries(assertions).filter(([, value]) => value !== true).map(([key]) => key);
const output = { ok: failed.length === 0, root, assertions, failed, taskPath: result.taskPath, submissionPath: result.submissionPath };
console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
