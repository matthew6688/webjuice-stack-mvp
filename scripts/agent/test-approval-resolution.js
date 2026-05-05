#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'approval-resolution-'));
const clientSlug = 'opa-bar-mezze-restaurant';
const orderId = 'cs_test_approval_resolution_001';
const email = 'owner@example.com';
const repo = 'matthew6688/opa-bar-mezze-restaurant';
const casesDir = path.join(root, 'cases');
const tasksDir = path.join(root, 'tasks');
const caseDir = path.join(casesDir, clientSlug, orderId);
const taskPath = path.join(tasksDir, clientSlug, `sale-${orderId}.json`);
const casePath = path.join(caseDir, 'case.json');
const contextPath = path.join(caseDir, 'context-packet.json');

fs.mkdirSync(path.dirname(taskPath), { recursive: true });
fs.mkdirSync(caseDir, { recursive: true });
writeJson(taskPath, {
  id: `sale_${clientSlug}_${orderId}`,
  kind: 'sale',
  clientSlug,
  repo,
  branch: 'dev',
  previewUrl: `https://${clientSlug}-dev.pages.dev/`,
});
writeJson(casePath, {
  schemaVersion: 1,
  caseId: `${clientSlug}_${orderId}`,
  status: 'dev_pushed_needs_review',
  clientSlug,
  repo,
  branch: 'dev',
  previewUrl: `https://${clientSlug}-dev.pages.dev/`,
  order: { id: orderId, provider: 'stripe', tier: 'one_time' },
  customer: { email, company: 'Opa Bar & Mezze' },
  discord: {
    websiteTaskThreadId: 'website-thread-approval-001',
    salesThreadId: 'sales-thread-approval-001',
  },
  latestTask: {
    id: `sale_${clientSlug}_${orderId}`,
    kind: 'sale',
    status: 'pending',
    path: taskPath,
  },
  paths: {
    casePath,
    contextPath,
    timelinePath: path.join(caseDir, 'timeline.jsonl'),
    customerMessagesPath: path.join(caseDir, 'customer-messages.jsonl'),
    agentRunsPath: path.join(caseDir, 'agent-runs.jsonl'),
    artifactsDir: path.join(caseDir, 'artifacts'),
  },
});

const success = runResolve(['--client', clientSlug, '--order', orderId, '--email', email]);
const wrongEmail = runResolve(['--client', clientSlug, '--order', orderId, '--email', 'other@example.com'], {
  expectFailure: true,
});
const wrongOrder = runResolve(['--client', clientSlug, '--order', 'cs_test_missing', '--email', email], {
  expectFailure: true,
});
const explicitTask = runResolve(['--client', clientSlug, '--order', orderId, '--email', email, '--task', taskPath]);

const assertions = {
  successOk: success.ok === true,
  successResolvesCase: success.result?.casePath === casePath,
  successResolvesTask: success.result?.taskPath === taskPath,
  successKeepsWebsiteThread: success.result?.discord?.websiteTaskThreadId === 'website-thread-approval-001',
  successUsesDevToMain: success.result?.sourceBranch === 'dev' && success.result?.targetBranch === 'main',
  wrongEmailRejected: wrongEmail.failed === true && /email did not match/i.test(wrongEmail.error),
  wrongOrderRejected: wrongOrder.failed === true && /Case file not found/i.test(wrongOrder.error),
  explicitTaskOk: explicitTask.ok === true && explicitTask.result?.taskPath === taskPath,
};
const failed = Object.entries(assertions)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  root,
  assertions,
  failed,
  resolved: success.result,
}, null, 2));

if (failed.length) process.exit(1);

function runResolve(extraArgs, { expectFailure = false } = {}) {
  try {
    const output = execFileSync(process.execPath, [
      'scripts/agent/resolve-approved-task.js',
      '--cases-dir',
      casesDir,
      ...extraArgs,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (expectFailure) return { failed: false, ok: false, error: 'Expected failure but command passed.' };
    return { ok: true, result: JSON.parse(output) };
  } catch (error) {
    const message = `${error.stdout || ''}${error.stderr || ''}${error.message || ''}`.trim();
    if (!expectFailure) return { ok: false, failed: true, error: message };
    return { ok: false, failed: true, error: message };
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
