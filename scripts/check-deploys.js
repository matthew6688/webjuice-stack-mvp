#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../core/env/load-local-env.js';
import { getLatestGithubActionsRun } from '../core/deploy/github-actions.js';

loadLocalEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

const args = parseArgs();
const targets = resolveTargets(args);
const results = [];

for (const target of targets) {
  try {
    const result = await getLatestGithubActionsRun(target.repo, {
      branch: args.branch || 'main',
      timeoutMs: Number(args.timeout || 10000),
    });
    results.push({ clientSlug: target.clientSlug, ...result });
  } catch (error) {
    results.push({
      clientSlug: target.clientSlug,
      repo: target.repo,
      ok: false,
      found: false,
      status: 'error',
      conclusion: null,
      errors: [error.message],
    });
  }
}

if (args.output) {
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify({ results }, null, 2)}\n`);
}

for (const result of results) {
  console.log(`\n[${result.clientSlug || 'repo'}] ${result.repo}`);
  console.log(`Status: ${result.ok ? 'ok' : 'failed'} (${result.status}${result.conclusion ? `/${result.conclusion}` : ''})`);
  if (result.name) console.log(`Workflow: ${result.name}`);
  if (result.url) console.log(`Run: ${result.url}`);
  for (const error of result.errors || []) console.log(`Error: ${error}`);
}

process.exit(results.every((result) => result.ok) ? 0 : 1);

function resolveTargets(args) {
  if (args.repo) return [{ clientSlug: '', repo: args.repo }];
  if (args.client) return [targetFromClient(args.client)];
  if (args.all) return listClientSlugs(args.all === true ? 'clients' : args.all).map(targetFromClient);

  console.error('Usage: node scripts/check-deploys.js --repo owner/name | --client slug | --all clients');
  process.exit(1);
}

function targetFromClient(slug) {
  const checkoutPath = path.join('clients', slug, 'funnel', 'checkout.json');
  const checkout = readJsonIfExists(checkoutPath);
  return { clientSlug: slug, repo: checkout?.hiddenFields?.repo || '' };
}

function listClientSlugs(root) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
