#!/usr/bin/env node

import { getLatestGithubActionsRun } from '../../core/deploy/github-actions.js';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

const args = parseArgs();
if (!args.repo) {
  console.error('Usage: node scripts/deploy/wait-github-action.js --repo owner/name [--branch main] [--timeout-ms 600000]');
  process.exit(1);
}

const branch = args.branch || 'main';
const timeoutMs = Number(args['timeout-ms'] || args.timeoutMs || 600000);
const intervalMs = Number(args['interval-ms'] || args.intervalMs || 5000);
const startedAt = Date.now();
let last = null;

while (Date.now() - startedAt < timeoutMs) {
  last = await getLatestGithubActionsRun(args.repo, { branch, timeoutMs: 20000 });
  if (last.found && last.status === 'completed') {
    console.log(JSON.stringify(last, null, 2));
    process.exit(last.conclusion === 'success' ? 0 : 1);
  }
  await sleep(intervalMs);
}

console.error(JSON.stringify({
  ok: false,
  reason: 'timeout',
  repo: args.repo,
  branch,
  last,
}, null, 2));
process.exit(1);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
