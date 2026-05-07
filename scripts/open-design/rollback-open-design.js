#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args['open-design-root'] || process.env.OPEN_DESIGN_ROOT || '/Users/matthew/Developer/open-design');
const nodeBin = args.node || process.env.OPEN_DESIGN_NODE || '/Users/matthew/.local/share/mise/installs/node/24.15.0/bin/node';
const commit = args.commit || args.ref;
const execute = args.execute === true || args.execute === 'true';

if (!commit) {
  throw new Error('Missing required --commit <verified-commit>.');
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const node24Env = {
  ...process.env,
  PATH: `${path.dirname(nodeBin)}:${process.env.PATH || ''}`,
};

const plan = {
  ok: true,
  execute,
  root,
  commit,
  currentHead: git(root, ['rev-parse', 'HEAD']),
  currentBranch: git(root, ['branch', '--show-current']),
  dirty: git(root, ['status', '--short']).split('\n').filter(Boolean),
  remotes: {
    origin: safeGit(root, ['remote', 'get-url', 'origin']) || null,
    upstream: safeGit(root, ['remote', 'get-url', 'upstream']) || null,
  },
  nodeBin,
  packageManager: packageJson.packageManager || null,
  steps: [
    'Verify the target commit exists locally or in fetched refs.',
    'Refuse rollback when the Open Design checkout is dirty.',
    'Detach HEAD at the verified commit so the active installation truly uses that code.',
    'Reinstall dependencies with Node 24 on PATH.',
    'Rebuild better-sqlite3.',
    'Rebuild the Open Design daemon.',
  ],
};

if (!execute) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

if (plan.dirty.length) {
  throw new Error(`Open Design working tree is dirty. Refusing rollback until reviewed:\n${plan.dirty.join('\n')}`);
}

run(root, ['git', 'rev-parse', '--verify', commit]);
run(root, ['git', 'checkout', '--detach', commit]);
run(root, ['corepack', 'pnpm', 'install', '--frozen-lockfile'], { env: node24Env });
run(root, ['corepack', 'pnpm', 'rebuild', 'better-sqlite3'], { env: node24Env });
run(root, ['corepack', 'pnpm', '--filter', '@open-design/daemon', 'build'], { env: node24Env });

console.log(JSON.stringify({
  ok: true,
  execute,
  root,
  commit,
  detachedHead: git(root, ['rev-parse', 'HEAD']),
  nextStep: `Run one app-visible or headless ProfitsLocal smoke against ${root} before resuming production work.`,
}, null, 2));

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
