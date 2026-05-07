#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { getLatestGithubActionsRun } from '../../core/deploy/github-actions.js';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

const args = parseArgs();
if (!args.repo || !args['repo-dir']) {
  console.error('Usage: node scripts/deploy/ensure-dev-action-trigger.js --repo owner/name --repo-dir /path/repo [--branch dev] [--timeout-ms 45000]');
  process.exit(1);
}

const repo = args.repo;
const repoDir = args['repo-dir'];
const branch = args.branch || 'dev';
const timeoutMs = Number(args['timeout-ms'] || args.timeoutMs || 45000);
const intervalMs = Number(args['interval-ms'] || args.intervalMs || 5000);
const result = await ensureActionTrigger({ repo, repoDir, branch, timeoutMs, intervalMs });
console.log(JSON.stringify(result, null, 2));

async function ensureActionTrigger({ repo, repoDir, branch, timeoutMs, intervalMs }) {
  const startedAt = Date.now();
  let last = null;
  while (Date.now() - startedAt < timeoutMs) {
    last = await getLatestGithubActionsRun(repo, { branch, timeoutMs: 20000 });
    if (last.found) {
      return {
        ok: true,
        repo,
        branch,
        strategy: 'detected_existing_run',
        run: last,
      };
    }
    await sleep(intervalMs);
  }

  execFileSync('git', ['checkout', branch], { cwd: repoDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '--allow-empty', '-m', `chore: retrigger ${branch} deploy after bootstrap`], {
    cwd: repoDir,
    stdio: 'ignore',
  });
  execFileSync('git', ['push', 'origin', branch], { cwd: repoDir, stdio: 'ignore' });

  const retriggerStart = Date.now();
  while (Date.now() - retriggerStart < timeoutMs) {
    last = await getLatestGithubActionsRun(repo, { branch, timeoutMs: 20000 });
    if (last.found) {
      return {
        ok: true,
        repo,
        branch,
        strategy: 'retriggered_with_empty_commit',
        run: last,
      };
    }
    await sleep(intervalMs);
  }

  return {
    ok: false,
    repo,
    branch,
    strategy: 'retriggered_with_empty_commit',
    reason: 'no_run_detected',
    run: last,
  };
}

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
