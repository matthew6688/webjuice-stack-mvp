#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createLeadResearch, saveLeadResearch } from '../../core/leads/research.js';

const args = parseArgs(process.argv.slice(2));

if (!args.input && !args.intake && !args.client) {
  console.error('Usage: npm run leads:research -- --input lead-intake.json [--output lead-research.json]');
  console.error('   or: npm run leads:research -- --client slug [--niche restaurant] [--output clients/slug/lead/lead-research.json]');
  process.exit(1);
}

const intakePath = args.input || args.intake || defaultIntakePath(args.client || '');
const intake = fs.existsSync(intakePath) ? JSON.parse(fs.readFileSync(intakePath, 'utf8')) : undefined;

const result = createLeadResearch({
  intake,
  intakePath,
  clientSlug: args.client || intake?.clientSlug,
  niche: args.niche,
  evidencePath: args.evidence,
  contentPath: args.content,
  designPath: args.design,
  preservationPath: args.preservation,
  pagesPath: args.pages,
  googleSearchPath: args['google-search'] || args.googleSearchPath,
});

const outputPath = args.output || path.join('clients', result.clientSlug, 'lead', 'lead-research.json');
saveLeadResearch(result, outputPath);

console.log(JSON.stringify({
  ok: true,
  clientSlug: result.clientSlug,
  buildMode: result.buildMode,
  gateStatus: result.gateStatus,
  previewability: result.previewability.status,
  productionReadiness: result.productionReadiness.status,
  path: outputPath,
}, null, 2));

function defaultIntakePath(clientSlug) {
  return clientSlug ? path.join('clients', clientSlug, 'lead', 'lead-intake.json') : '';
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
