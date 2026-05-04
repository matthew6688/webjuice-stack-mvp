#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { listPagesDomains } from '../../core/domain/cloudflare-pages.js';

const args = parseArgs();
if (!args.project) {
  console.error('Usage: node scripts/domain/pages-status.js --project pages-project [--domain example.com] [--output domain-status.json]');
  process.exit(1);
}

const result = await listPagesDomains({
  accountId: process.env.CF_ACCOUNT_ID,
  token: process.env.CF_API_TOKEN,
  projectName: args.project,
});

const domains = args.domain
  ? result.filter((domain) => domain.name === args.domain)
  : result;
const output = {
  projectName: args.project,
  domain: args.domain || '',
  domains,
  checkedAt: new Date().toISOString(),
};

if (args.output) {
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`);
}

console.log(JSON.stringify(output, null, 2));

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
