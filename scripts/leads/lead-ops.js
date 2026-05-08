#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { runLeadOps, saveLeadOpsArtifacts } from '../../core/leads/lead-ops.js';

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || args.clientSlug;

if (!clientSlug && !args.input) {
  console.error('Usage: node scripts/leads/lead-ops.js --client slug');
  console.error('   or: node scripts/leads/lead-ops.js --input lead.json --client slug');
  process.exit(1);
}

const payload = args.input
  ? JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'))
  : {};

const result = runLeadOps({
  ...payload,
  clientSlug: clientSlug || payload.clientSlug,
  sourceType: args.source || payload.sourceType,
  evidencePath: args.evidence,
  contentPath: args.content,
  designPath: args.design,
  preservationPath: args.preservation,
  pagesPath: args.pages,
  googleSearchPath: args['google-search'] || args.googleSearchPath,
});

const saved = saveLeadOpsArtifacts(result, {
  intake: args['out-intake'],
  research: args['out-research'],
  redesignCheck: args['out-redesign'],
  readyToBuild: args['out-ready'],
  outreachBrief: args['out-brief'],
  leadOps: args.out || args['out-lead-ops'],
});

console.log(JSON.stringify({
  ok: true,
  clientSlug: result.clientSlug,
  summary: result.summary,
  paths: saved,
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    parsed[key] = value;
    if (value !== true) i += 1;
  }
  return parsed;
}

