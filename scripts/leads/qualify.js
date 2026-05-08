#!/usr/bin/env node

import { qualifyLead, saveLeadQualification } from '../../core/leads/qualification.js';

const args = parseArgs();

if (!args.lead && !args.input) {
  console.error('Usage: npm run leads:qualify -- --lead leads.json [--index 0] [--website-scan firecrawl.json] [--output qualification.json]');
  process.exit(1);
}

try {
  const result = qualifyLead({
    leadPath: args.lead || args.input,
    leadIndex: args.index || 0,
    websiteScanPath: args['website-scan'] || args.websiteScan,
    clientSlug: args.client,
    niche: args.niche,
  });
  if (args.output) saveLeadQualification(result, args.output);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseArgs() {
  const parsed = {};
  const argv = process.argv.slice(2);
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
