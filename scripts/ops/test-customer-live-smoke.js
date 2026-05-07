#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = process.cwd();
const DEFAULT_MAIN_REPO = 'matthew6688/webjuice-stack-mvp';

function parseArgs(argv = process.argv.slice(2)) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    parsed[key] = !next || next.startsWith('--') ? true : next;
  }
  return parsed;
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ghJson(args) {
  const output = execFileSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

function ghRunList({ repo, workflow, limit = 20 }) {
  return ghJson([
    'run',
    'list',
    '--repo',
    repo,
    '--workflow',
    workflow,
    '--limit',
    String(limit),
    '--json',
    'databaseId,workflowName,displayTitle,status,conclusion,createdAt,updatedAt,url',
  ]);
}

function ghRunView({ repo, runId }) {
  return ghJson([
    'run',
    'view',
    String(runId),
    '--repo',
    repo,
    '--json',
    'databaseId,workflowName,displayTitle,status,conclusion,createdAt,updatedAt,url',
  ]);
}

async function waitForWorkflowRun({ repo, workflow, requestedAt, timeoutMs = 120000, settleMs = 8000, complete = true }) {
  const requestedTime = Date.parse(requestedAt);
  const started = Date.now();
  let matched = null;
  while (Date.now() - started < timeoutMs) {
    const runs = ghRunList({ repo, workflow, limit: 20 });
    matched = runs
      .filter((run) => Date.parse(run.createdAt) >= requestedTime - settleMs)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] || null;
    if (matched && !complete) return matched;
    if (matched) {
      const view = ghRunView({ repo, runId: matched.databaseId });
      if (view.status === 'completed') return view;
      matched = view;
    }
    await sleep(10000);
  }
  return matched;
}

function decodeContent(base64) {
  return Buffer.from(base64, 'base64').toString('utf8');
}

function ghReadRepoJson({ repo, filePath, ref = 'main' }) {
  try {
    const payload = ghJson(['api', `repos/${repo}/contents/${filePath}?ref=${ref}`]);
    if (!payload.content) return null;
    return JSON.parse(decodeContent(payload.content));
  } catch (error) {
    return null;
  }
}

async function fetchPage(url) {
  const response = await fetch(url);
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    url,
    title: extractTitle(text),
    includesOrderId: /order id/i.test(text),
    includesForm: /<form/i.test(text),
    snippet: text.slice(0, 500),
  };
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

async function postApproval({ siteUrl, payload }) {
  const requestedAt = new Date().toISOString();
  const response = await fetch(`${siteUrl}/api/approval-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return {
    requestedAt,
    status: response.status,
    ok: response.ok,
    body: json,
  };
}

async function postRevision({ siteUrl, payload, attachmentName, attachmentText }) {
  const requestedAt = new Date().toISOString();
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) form.set(key, String(value));
  if (attachmentName && attachmentText) {
    const blob = new Blob([attachmentText], { type: 'text/plain' });
    form.append('files', blob, attachmentName);
  }
  const response = await fetch(`${siteUrl}/api/revision-submit`, {
    method: 'POST',
    body: form,
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return {
    requestedAt,
    status: response.status,
    ok: response.ok,
    body: json,
  };
}

function summarizeAssertions(assertions) {
  const failed = Object.entries(assertions)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  return {
    ok: failed.length === 0,
    failed,
    assertions,
  };
}

const args = parseArgs();
const siteUrl = String(args['site-url'] || 'https://profitslocal.com').replace(/\/+$/, '');
const repo = String(args.repo || DEFAULT_MAIN_REPO);
const approvalOrderId = String(args['approval-order-id'] || 'cs_test_b1NsMZTui0nhviPT4xGh6r5orYmCzLQjeDQCc5qnKgYe3BDUb0bb7etXY7');
const approvalEmail = String(args['approval-email'] || 'matthew6688@gmail.com').toLowerCase();
const approvalClient = String(args['approval-client'] || 'opa-bar-mezze-restaurant');
const approvalRepo = String(args['approval-repo'] || 'matthew6688/opa-bar-mezze-restaurant');
const approvalPreview = String(args['approval-preview'] || 'https://opa-bar-mezze-restaurant-dev.pages.dev/');
const approvalTaskPath = String(args['approval-task-path'] || '');
const revisionOrderId = String(args['revision-order-id'] || approvalOrderId);
const revisionEmail = String(args['revision-email'] || approvalEmail).toLowerCase();
const revisionClient = String(args['revision-client'] || approvalClient);
const revisionRepo = String(args['revision-repo'] || approvalRepo);
const revisionPreview = String(args['revision-preview'] || approvalPreview);
const revisionCasePath = String(args['revision-case-path'] || `data/cases/${revisionClient}/${revisionOrderId}/case.json`);
const revisionOrderPath = String(args['revision-order-path'] || `data/funnel/orders/${revisionClient}/${revisionOrderId}.json`);
const timeoutMs = Number(args['timeout-ms'] || 900000);

const outDir = ensureDir(path.join(ROOT, 'data/ops-smoke', `customer-live-${nowStamp()}`));
const tempAttachment = path.join(os.tmpdir(), `profitslocal-live-smoke-${Date.now()}.txt`);
writeText(tempAttachment, `Official revision live smoke at ${new Date().toISOString()}\nKeep customer-facing content unchanged; only verify routing/thread/case continuity.\n`);

const localCase = readJson(path.join(ROOT, revisionCasePath));
const beforeRemoteCase = ghReadRepoJson({ repo, filePath: revisionCasePath, ref: 'main' });
const beforeRemoteOrder = ghReadRepoJson({ repo, filePath: revisionOrderPath, ref: 'main' });

const approvalPage = await fetchPage(`${siteUrl}/approve?order_id=${encodeURIComponent(approvalOrderId)}&email=${encodeURIComponent(approvalEmail)}&client_slug=${encodeURIComponent(approvalClient)}&repo=${encodeURIComponent(approvalRepo)}&preview_url=${encodeURIComponent(approvalPreview)}`);
const revisionPage = await fetchPage(`${siteUrl}/revision?order_id=${encodeURIComponent(revisionOrderId)}&email=${encodeURIComponent(revisionEmail)}&client_slug=${encodeURIComponent(revisionClient)}&repo=${encodeURIComponent(revisionRepo)}&preview_url=${encodeURIComponent(revisionPreview)}`);

writeJson(path.join(outDir, 'page-approval.json'), approvalPage);
writeJson(path.join(outDir, 'page-revision.json'), revisionPage);

const approvalPayload = {
  order_id: approvalOrderId,
  email: approvalEmail,
  client_slug: approvalClient,
  repo: approvalRepo,
  preview_url: approvalPreview,
  dry_run: 'true',
};
if (approvalTaskPath) approvalPayload.task_path = approvalTaskPath;

const approvalResponse = await postApproval({ siteUrl, payload: approvalPayload });
writeJson(path.join(outDir, 'approval-request.json'), approvalResponse);
const approvalRun = approvalResponse.ok
  ? await waitForWorkflowRun({
      repo,
      workflow: 'publish-approved.yml',
      requestedAt: approvalResponse.requestedAt,
      timeoutMs: Math.min(timeoutMs, 240000),
      complete: true,
    })
  : null;
writeJson(path.join(outDir, 'approval-workflow.json'), approvalRun || { ok: false, reason: 'run_not_found' });

const revisionPayload = {
  order_id: revisionOrderId,
  email: revisionEmail,
  client_slug: revisionClient,
  repo: revisionRepo,
  preview_url: revisionPreview,
  requested_changes: `官方 live smoke：请保持站点内容不变，只验证 revision 能回到同一个 case / website thread，并生成新的 dev 任务。时间：${new Date().toISOString()}`,
  confirm_revision_scope: 'on',
  submitted_at: new Date().toISOString(),
};

const revisionResponse = await postRevision({
  siteUrl,
  payload: revisionPayload,
  attachmentName: path.basename(tempAttachment),
  attachmentText: fs.readFileSync(tempAttachment, 'utf8'),
});
writeJson(path.join(outDir, 'revision-request.json'), revisionResponse);
const revisionRun = revisionResponse.ok
  ? await waitForWorkflowRun({
      repo,
      workflow: 'route-funnel-event.yml',
      requestedAt: revisionResponse.requestedAt,
      timeoutMs,
      complete: true,
    })
  : null;
writeJson(path.join(outDir, 'revision-workflow.json'), revisionRun || { ok: false, reason: 'run_not_found' });

const afterRemoteCase = ghReadRepoJson({ repo, filePath: revisionCasePath, ref: 'main' });
const afterRemoteOrder = ghReadRepoJson({ repo, filePath: revisionOrderPath, ref: 'main' });
writeJson(path.join(outDir, 'revision-case-before.json'), beforeRemoteCase);
writeJson(path.join(outDir, 'revision-case-after.json'), afterRemoteCase);
writeJson(path.join(outDir, 'revision-order-before.json'), beforeRemoteOrder);
writeJson(path.join(outDir, 'revision-order-after.json'), afterRemoteOrder);

const assertions = {
  approvalPageOk: approvalPage.ok && approvalPage.includesOrderId && approvalPage.includesForm,
  revisionPageOk: revisionPage.ok && revisionPage.includesOrderId && revisionPage.includesForm,
  approvalRequestAccepted: approvalResponse.ok && approvalResponse.body?.success === true,
  approvalWorkflowCompleted: approvalRun?.status === 'completed',
  approvalWorkflowSucceeded: approvalRun?.conclusion === 'success',
  revisionRequestAccepted: revisionResponse.ok && revisionResponse.body?.success === true,
  revisionWorkflowCompleted: revisionRun?.status === 'completed',
  revisionWorkflowSucceeded: revisionRun?.conclusion === 'success',
  revisionCaseStillSameThread: afterRemoteCase?.discord?.websiteTaskThreadId === beforeRemoteCase?.discord?.websiteTaskThreadId,
  revisionUsedIncremented: Number(afterRemoteCase?.revision?.used) === Number(beforeRemoteCase?.revision?.used) + 1,
  revisionRemainingDecremented: Number(afterRemoteCase?.revision?.remaining) === Number(beforeRemoteCase?.revision?.remaining) - 1,
  orderRevisionUsedIncremented: Number(afterRemoteOrder?.revisionUsed) === Number(beforeRemoteOrder?.revisionUsed) + 1,
  revisionLatestTaskUpdated: String(afterRemoteCase?.latestTask?.id || '') !== '' && String(afterRemoteCase?.latestTask?.id || '') !== String(beforeRemoteCase?.latestTask?.id || ''),
  revisionLatestTaskKindIsRevision: String(afterRemoteCase?.latestTask?.kind || '') === 'revision',
  localReferenceThreadKnown: Boolean(localCase?.discord?.websiteTaskThreadId),
};

const summary = summarizeAssertions(assertions);
const output = {
  ok: summary.ok,
  siteUrl,
  repo,
  outDir,
  approval: {
    orderId: approvalOrderId,
    requestedAt: approvalResponse.requestedAt,
    workflowRunId: approvalRun?.databaseId || null,
    workflowUrl: approvalRun?.url || '',
  },
  revision: {
    orderId: revisionOrderId,
    requestedAt: revisionResponse.requestedAt,
    workflowRunId: revisionRun?.databaseId || null,
    workflowUrl: revisionRun?.url || '',
    websiteTaskThreadIdBefore: beforeRemoteCase?.discord?.websiteTaskThreadId || '',
    websiteTaskThreadIdAfter: afterRemoteCase?.discord?.websiteTaskThreadId || '',
  },
  assertions: summary.assertions,
  failed: summary.failed,
};

writeJson(path.join(outDir, 'summary.json'), output);
console.log(JSON.stringify(output, null, 2));
if (!summary.ok) process.exit(1);
