#!/usr/bin/env node

import fs from 'fs';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { routeFunnelSubmission } from '../../core/funnel/submission-router.js';

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

if (!args.input) {
  console.error('Usage: node scripts/funnel/route-tally-submission.js --input tally-webhook.json [--kind sale|revision] [--dry-run true] [--send-discord true]');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
const result = await routeFunnelSubmission(payload, {
  kind: args.kind,
  dryRun: args['dry-run'] === 'true' || args.dryRun === 'true',
  sendDiscord: args['send-discord'] === 'true' || args.sendDiscord === 'true',
  sendEmail: args['send-email'] === 'true' || args.sendEmail === 'true',
  tasksDir: args['tasks-dir'] || args.tasksDir,
  submissionsDir: args['submissions-dir'] || args.submissionsDir,
  entitlementsDir: args['entitlements-dir'] || args.entitlementsDir,
  casesDir: args['cases-dir'] || args.casesDir,
  ledgerPath: args.ledger,
});

console.log(JSON.stringify({
  ok: result.ok,
  kind: result.kind,
  order: result.order,
  taskPath: result.taskPath,
  submissionPath: result.submissionPath,
  entitlement: result.entitlement,
  ledgerEvent: result.ledgerEvent,
  caseRecord: result.caseRecord ? {
    casePath: result.caseRecord.ref.casePath,
    contextPath: result.caseRecord.ref.contextPath,
    status: result.caseRecord.caseFile.status,
  } : null,
  discord: result.discord,
  customerEmail: result.customerEmail,
}, null, 2));
