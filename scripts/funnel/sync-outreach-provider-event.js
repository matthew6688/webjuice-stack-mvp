#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { syncOutreachProviderEvent } from '../../core/funnel/outreach-provider-event.js';

const args = parseArgs(process.argv.slice(2));
if (!args.input) {
  console.error('Usage: node scripts/funnel/sync-outreach-provider-event.js --input payload.json [--dry-run true] [--output result.json]');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
const result = await syncOutreachProviderEvent(payload, {
  dryRun: args['dry-run'] === 'true',
  sendDiscord: args['send-discord'] !== 'false',
  clientsRoot: args['clients-root'] || 'clients',
  casesDir: args['cases-dir'] || 'data/cases',
  fetchImpl: fetch,
});

if (args.output) {
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    parsed[arg.slice(2)] = argv[i + 1]?.startsWith('--') ? 'true' : (argv[i + 1] || 'true');
  }
  return parsed;
}
