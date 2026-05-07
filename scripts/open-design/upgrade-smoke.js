#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args['open-design-root'] || process.env.OPEN_DESIGN_ROOT || '/Users/matthew/Developer/open-design');
const nodeBin = args.node || process.env.OPEN_DESIGN_NODE || '/Users/matthew/.local/share/mise/installs/node/24.15.0/bin/node';
const execute = args.execute === true || args.execute === 'true';
const apply = args.apply === true || args.apply === 'true';
const remoteRef = args.ref || 'upstream/main';
const worktreeRoot = path.resolve(args.worktree || path.join(os.tmpdir(), `open-design-upgrade-smoke-${Date.now()}`));

const currentHead = git(root, ['rev-parse', 'HEAD']);
const originUrl = safeGit(root, ['remote', 'get-url', 'origin']);
const upstreamUrl = safeGit(root, ['remote', 'get-url', 'upstream']);
if (originUrl) {
  git(root, ['fetch', 'origin', 'main', '--quiet']);
}
if (upstreamUrl) {
  git(root, ['fetch', 'upstream', 'main', '--quiet']);
}
const originHead = originUrl ? git(root, ['rev-parse', 'origin/main']) : null;
const upstreamHead = upstreamUrl ? git(root, ['rev-parse', 'upstream/main']) : null;
const targetHead = git(root, ['rev-parse', remoteRef]);
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const node24Env = {
  ...process.env,
  PATH: `${path.dirname(nodeBin)}:${process.env.PATH || ''}`,
};

const plan = {
  ok: true,
  execute,
  apply,
  root,
  remoteRef,
  currentHead,
  originHead,
  upstreamHead,
  targetHead,
  remotes: {
    origin: originUrl || null,
    upstream: upstreamUrl || null,
  },
  forkContainsUpstream: Boolean(originHead && upstreamHead && gitExitOk(root, ['merge-base', '--is-ancestor', 'upstream/main', 'origin/main'])),
  currentVsTarget: revListCounts(root, currentHead, targetHead),
  currentBranch: git(root, ['branch', '--show-current']),
  dirty: git(root, ['status', '--short']).split('\n').filter(Boolean),
  nodeBin,
  packageManager: packageJson.packageManager || null,
  worktreeRoot,
  suggestedCommands: {
    smoke: 'npm run open-design:upgrade-smoke -- --execute true',
    apply: 'npm run open-design:upgrade-smoke -- --execute true --apply true',
    rollback: 'npm run open-design:rollback -- --commit <verified-commit> --execute true',
  },
  steps: [
    'Do not update the active Open Design checkout directly.',
    'Create a temporary git worktree at the target upstream ref.',
    'Install dependencies in the worktree.',
    'Build the daemon.',
    'Run a ProfitsLocal Open Design smoke against the worktree with isolated OD_DATA_DIR.',
    'Only switch OPEN_DESIGN_ROOT after the smoke passes.',
    'If --apply true is set, merge the verified upstream ref into the local fork checkout and push origin/main.',
  ],
};

if (!execute) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

if (plan.dirty.length) {
  throw new Error(`Open Design working tree is dirty. Refusing upgrade smoke until reviewed:\n${plan.dirty.join('\n')}`);
}

rm(worktreeRoot);
run(root, ['git', 'worktree', 'add', '--detach', worktreeRoot, targetHead]);
run(worktreeRoot, ['corepack', 'pnpm', 'install', '--frozen-lockfile'], { env: node24Env });
run(worktreeRoot, ['corepack', 'pnpm', 'rebuild', 'better-sqlite3'], { env: node24Env });
run(worktreeRoot, ['corepack', 'pnpm', '--filter', '@open-design/daemon', 'build'], { env: node24Env });

const smokeClient = `open-design-upgrade-smoke-${Date.now()}`;
const smoke = spawnSync('npm', [
  'run',
  'open-design:run-concept',
  '--',
  '--client',
  smokeClient,
  '--open-design-root',
  worktreeRoot,
  '--node',
  nodeBin,
  '--mode',
  'isolated',
  '--prompt',
  "Skip questions. Upgrade smoke only. Do not fetch the web. Create index.html with text 'Open Design upgrade smoke ok'.",
  '--timeout-ms',
  '240000',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

if (smoke.status !== 0) {
  console.error(smoke.stdout);
  console.error(smoke.stderr);
  process.exit(smoke.status || 1);
}

console.log(smoke.stdout);
const result = {
  ok: true,
  execute,
  apply,
  currentHead,
  originHead,
  upstreamHead,
  targetHead,
  smokeClient,
  worktreeRoot,
  nextStep: apply
    ? `Upgrade smoke passed. Local fork checkout at ${root} has been updated and pushed to origin/main.`
    : `Upgrade smoke passed. Review ${worktreeRoot}, then run --apply true to merge ${remoteRef} into the fork checkout if desired.`,
};

if (apply) {
  if (!originUrl) {
    throw new Error('Cannot apply upgrade because origin remote is missing.');
  }
  const currentBranch = git(root, ['branch', '--show-current']);
  if (currentBranch !== 'main') {
    throw new Error(`Refusing --apply on branch ${currentBranch}. Switch to main first.`);
  }
  run(root, ['git', 'fetch', 'origin', 'main']);
  run(root, ['git', 'fetch', remoteRef.split('/')[0], remoteRef.split('/')[1] || 'main']);
  run(root, ['git', 'merge', '--ff-only', 'origin/main']);
  if (gitExitOk(root, ['merge-base', '--is-ancestor', targetHead, 'HEAD'])) {
    result.applyStatus = 'no_op_target_already_in_head';
  } else {
    const mergeResult = spawnSync('git', ['merge', '--no-edit', targetHead], { cwd: root, encoding: 'utf8' });
    if (mergeResult.status !== 0) {
      throw new Error(`git merge --no-edit ${targetHead} failed in ${root}\n${mergeResult.stdout}\n${mergeResult.stderr}`);
    }
    result.applyStatus = 'merged_target_into_main';
  }
  run(root, ['git', 'push', 'origin', 'main']);
  result.postApplyHead = git(root, ['rev-parse', 'HEAD']);
}

console.log(JSON.stringify(result, null, 2));

function git(cwd, argv) {
  return run(cwd, ['git', ...argv]).stdout.trim();
}

function safeGit(cwd, argv) {
  const result = spawnSync('git', argv, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    return '';
  }
  return result.stdout.trim();
}

function run(cwd, argv, options = {}) {
  const result = spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8', env: options.env || process.env });
  if (result.status !== 0) {
    throw new Error(`${argv.join(' ')} failed in ${cwd}\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function rm(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function gitExitOk(cwd, argv) {
  const result = spawnSync('git', argv, { cwd, encoding: 'utf8' });
  return result.status === 0;
}

function revListCounts(cwd, left, right) {
  const raw = git(cwd, ['rev-list', '--left-right', '--count', `${left}...${right}`]);
  const [ahead = '0', behind = '0'] = raw.split(/\s+/);
  return {
    leftOnly: Number(ahead),
    rightOnly: Number(behind),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
