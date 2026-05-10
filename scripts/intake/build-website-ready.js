#!/usr/bin/env node

import path from 'path';
import { buildWebsiteReady, saveWebsiteReadyOutputs } from '../../core/intake/website-ready.js';

const args = parseArgs();

if (!args.client && !args.evidence) {
  console.error('Usage: npm run intake:build-website-ready -- --client slug [--source outbound|paid_intake|inbound|manual] [--case data/cases/.../case.json] [--task data/agent-tasks/...json] [--confirmed true]');
  process.exit(1);
}

const clientSlug = args.client || clientSlugFromEvidencePath(args.evidence);
const casePath = args.case || '';
const buildPacketPath = args['build-packet'] || args.buildPacket || (casePath
  ? path.join(path.dirname(casePath), 'build-packet.md')
  : '');

try {
  const result = buildWebsiteReady({
    clientSlug,
    niche: args.niche || 'restaurant',
    route: args.route || 'website',
    sourceType: args.source || args.sourceType,
    customerConfirmed: args.confirmed || args.confirm,
    evidencePath: args.evidence,
    contentPath: args.content,
    designPath: args.design,
    brandSpecPath: args.brand,
    checkoutPath: args.checkout,
    casePath,
    taskPath: args.task,
    paidIntakePath: args['paid-intake'] || args.paidIntake,
    surveyPath: args.survey,
    buildPacketPath,
  });
  saveWebsiteReadyOutputs(result, { dryRun: Boolean(args['dry-run'] || args.dryRun) });

  console.log(`Website ready: ${clientSlug}`);
  console.log(`Readiness:     ${result.survey.readiness}`);
  console.log(`Ready:         ${result.survey.readyToBuild ? 'yes' : 'no'}`);
  console.log(`Survey:        ${result.paths.surveyPath}`);
  console.log(`Build packet:  ${result.paths.buildPacketPath}`);
  if (result.survey.missing.length) {
    console.log('Missing:');
    for (const item of result.survey.missing) console.log(`- ${item}`);
  }
  if (result.survey.decisions.length) {
    console.log('Decisions:');
    for (const item of result.survey.decisions) console.log(`- ${item}`);
  }
  process.exit(result.survey.readiness === 'blocked_conflicting_evidence' ? 1 : 0);
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

function clientSlugFromEvidencePath(filePath) {
  const parts = path.normalize(filePath || '').split(path.sep);
  const clientsIndex = parts.lastIndexOf('clients');
  return clientsIndex >= 0 ? parts[clientsIndex + 1] : '';
}
