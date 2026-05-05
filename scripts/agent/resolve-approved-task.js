#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

function safeId(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'unknown';
}

const args = parseArgs();
if (!args.client || !args.order || !args.email) {
  console.error('Usage: node scripts/agent/resolve-approved-task.js --client slug --order orderId --email checkout@email [--task data/agent-tasks/...json] [--output approval.json]');
  process.exit(1);
}

const casePath = path.join(args['cases-dir'] || args.casesDir || 'data/cases', safeId(args.client), safeId(args.order), 'case.json');
if (!fs.existsSync(casePath)) throw new Error(`Case file not found: ${casePath}`);

const caseFile = JSON.parse(fs.readFileSync(casePath, 'utf8'));
const expectedEmail = String(caseFile.customer?.email || '').trim().toLowerCase();
const submittedEmail = String(args.email || '').trim().toLowerCase();
if (!expectedEmail || expectedEmail !== submittedEmail) {
  throw new Error('Approval email did not match the checkout email for this order.');
}

const taskPath = args.task || caseFile.latestTask?.path || '';
if (!taskPath) throw new Error('No latest task is recorded on this case.');
if (!fs.existsSync(taskPath)) throw new Error(`Task file not found: ${taskPath}`);

const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
if (task.clientSlug !== caseFile.clientSlug) throw new Error('Task client does not match case client.');
if (task.repo !== caseFile.repo) throw new Error('Task repo does not match case repo.');

const result = {
  ok: true,
  casePath,
  taskPath,
  clientSlug: caseFile.clientSlug,
  repo: caseFile.repo,
  orderId: caseFile.order?.id || args.order,
  email: expectedEmail,
  discord: {
    websiteTaskThreadId: caseFile.discord?.websiteTaskThreadId || '',
    salesThreadId: caseFile.discord?.salesThreadId || '',
    revisionThreadId: caseFile.discord?.revisionThreadId || '',
  },
  sourceBranch: task.branch || caseFile.branch || 'dev',
  targetBranch: 'main',
  liveUrl: args['live-url'] || args.liveUrl || `https://${caseFile.clientSlug}-live.pages.dev`,
};

if (args.output) {
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log(JSON.stringify(result, null, 2));
}
