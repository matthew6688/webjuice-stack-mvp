#!/usr/bin/env node

import { attachPagesDomain } from '../../core/domain/cloudflare-pages.js';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

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
if (!args.domain || !args.project) {
  console.error('Usage: node scripts/domain/attach-pages.js --domain example.com --project pages-project');
  process.exit(1);
}

if (args['dry-run'] === 'true' || args.dryRun === 'true') {
  console.log(`Dry run: would attach ${args.domain} to Cloudflare Pages project ${args.project}`);
  process.exit(0);
}

const result = await attachPagesDomain({
  accountId: process.env.CF_ACCOUNT_ID,
  token: process.env.CF_API_TOKEN,
  projectName: args.project,
  domain: args.domain,
});

console.log(JSON.stringify(result, null, 2));
