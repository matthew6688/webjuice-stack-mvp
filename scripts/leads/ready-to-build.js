#!/usr/bin/env node

import fs from 'fs';
import { createBuildReadyDecision } from '../../core/leads/build-ready.js';

const args = parseArgs(process.argv.slice(2));

if (!args.client && !args.input && !args.research) {
  console.error('Usage: npm run leads:build-ready -- --client slug');
  console.error('   or: npm run leads:build-ready -- --research clients/slug/lead/lead-research.json');
  process.exit(1);
}

const result = createBuildReadyDecision({
  clientSlug: args.client,
  intakePath: args.input || '',
  research: loadJson(args.research),
  evidencePath: args.evidence,
  contentPath: args.content,
  designPath: args.design,
  brandSpecPath: args.brand,
  casePath: args.case,
  taskPath: args.task,
  paidIntakePath: args['paid-intake'] || args.paidIntake,
  surveyPath: args.survey,
  buildPacketPath: args['build-packet'] || args.buildPacket,
  customerConfirmed: args.confirmed || args.confirm,
});

console.log(JSON.stringify({
  ok: true,
  clientSlug: result.clientSlug,
  status: result.status,
  reason: result.reason,
  buildMode: result.buildMode,
  previewability: result.previewability.status,
  productionReadiness: result.productionReadiness.status,
  websiteReady: result.websiteReady?.readiness || '',
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}

function loadJson(filePath) {
  if (!filePath) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
