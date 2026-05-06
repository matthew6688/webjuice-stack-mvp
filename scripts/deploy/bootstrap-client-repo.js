#!/usr/bin/env node

import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import {
  buildClientRepoBootstrapPlan,
  executeClientRepoBootstrapPlan,
  validateBootstrapEnvironment,
} from '../../core/deploy/client-repo-bootstrap.js';

loadLocalEnv();

const args = parseArgs();

if (!args.repo || !args['repo-dir']) {
  console.error('Usage: node scripts/deploy/bootstrap-client-repo.js --repo owner/name --repo-dir /path/client-repo [--pages-project-name name] [--execute true] [--wait true]');
  process.exit(1);
}

const plan = buildClientRepoBootstrapPlan({
  repo: args.repo,
  repoDir: path.resolve(args['repo-dir']),
  pagesProjectName: args['pages-project-name'] || args.pagesProjectName || '',
  defaultBranch: args.main || 'main',
  devBranch: args.dev || 'dev',
  privateRepo: args.private !== 'false',
  waitForActions: args.wait === 'true',
});

const envCheck = validateBootstrapEnvironment(process.env);
if (!envCheck.ok) {
  console.error(`Missing required environment variables: ${envCheck.missing.join(', ')}`);
  process.exit(1);
}

const dryRun = args.execute !== 'true';
const result = executeClientRepoBootstrapPlan(plan, { dryRun });
console.log(JSON.stringify({
  ok: true,
  dryRun,
  repo: plan.repo,
  repoDir: plan.repoDir,
  pagesProjectName: plan.pagesProjectName,
  stepOrder: plan.steps.map((step) => step.id),
  executed: result.executed,
}, null, 2));

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
