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
    const key = args[i].slice(2);
    const next = args[i + 1];
    parsed[key] = next?.startsWith('--') ? true : (next || true);
  }
  return parsed;
}

function boolArg(args, dashed, camel, defaultValue = false) {
  const value = args[dashed] ?? args[camel];
  if (value === undefined) return defaultValue;
  return value === true || String(value).toLowerCase() === 'true';
}

function readPayload(args) {
  if (args.input) return JSON.parse(fs.readFileSync(args.input, 'utf8'));
  if (args['payload-json']) return JSON.parse(String(args['payload-json']));
  if (args.payloadJson) return JSON.parse(String(args.payloadJson));
  if (process.env.FUNNEL_EVENT_PAYLOAD) return JSON.parse(process.env.FUNNEL_EVENT_PAYLOAD);
  throw new Error('Missing payload. Use --input, --payload-json, or FUNNEL_EVENT_PAYLOAD.');
}

function normalizeProvider(provider) {
  if (!provider || provider === 'auto') return undefined;
  if (!['stripe', 'tally'].includes(provider)) {
    throw new Error(`Unsupported provider "${provider}". Use auto, stripe, or tally.`);
  }
  return provider;
}

const args = parseArgs();

try {
  const payload = readPayload(args);
  const result = await routeFunnelSubmission(payload, {
    provider: normalizeProvider(args.provider),
    kind: args.kind,
    dryRun: boolArg(args, 'dry-run', 'dryRun'),
    sendDiscord: boolArg(args, 'send-discord', 'sendDiscord', true),
    sendEmail: boolArg(args, 'send-email', 'sendEmail', true),
    tasksDir: args['tasks-dir'] || args.tasksDir,
    submissionsDir: args['submissions-dir'] || args.submissionsDir,
    entitlementsDir: args['entitlements-dir'] || args.entitlementsDir,
    casesDir: args['cases-dir'] || args.casesDir,
    ledgerPath: args.ledger,
    extraRevisionUrl: args['extra-revision-url'] || args.extraRevisionUrl,
  });

  const summary = {
    ok: result.ok,
    provider: result.provider,
    kind: result.kind,
    dryRun: boolArg(args, 'dry-run', 'dryRun'),
    duplicate: result.duplicate === true,
    clientSlug: result.order?.clientSlug,
    orderId: result.order?.orderId,
    repo: result.order?.repo,
    tier: result.order?.tier,
    amount: result.order?.amount,
    currency: result.order?.currency,
    taskPath: result.taskPath,
    submissionPath: result.submissionPath,
    entitlement: result.entitlement ? {
      ok: result.entitlement.ok,
      reason: result.entitlement.reason,
      orderId: result.entitlement.entitlement?.orderId,
      revisionUsed: result.entitlement.entitlement?.revisionUsed,
      revisionLimit: result.entitlement.entitlement?.revisionPolicy?.limit,
      revisionPolicy: result.entitlement.entitlement?.revisionPolicy?.type,
    } : null,
    ledgerEvent: result.ledgerEvent ? {
      id: result.ledgerEvent.id,
      type: result.ledgerEvent.type,
      category: result.ledgerEvent.category,
      amount: result.ledgerEvent.amount,
      currency: result.ledgerEvent.currency,
    } : null,
    caseRecord: summarizeCaseRecord(result.caseRecord),
    discord: result.discord,
    websiteAgentHandoff: result.websiteAgentHandoff,
    customerEmail: result.customerEmail,
  };

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '## Funnel Event Routed',
      '',
      `- OK: ${summary.ok}`,
      `- Provider: ${summary.provider}`,
      `- Kind: ${summary.kind}`,
      `- Dry run: ${summary.dryRun}`,
      `- Duplicate: ${summary.duplicate}`,
      `- Client: ${summary.clientSlug || 'unknown'}`,
      `- Order: ${summary.orderId || 'unknown'}`,
      `- Task: ${summary.taskPath || 'none'}`,
      `- Submission: ${summary.submissionPath || 'none'}`,
      `- Case: ${summary.caseRecord?.casePath || 'none'}`,
      '',
    ].join('\n'));
  }

  if (args.output) {
    fs.writeFileSync(args.output, `${JSON.stringify(summary, null, 2)}\n`);
  }
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}

function summarizeCaseRecord(caseRecord) {
  if (!caseRecord) return null;
  const paths = caseRecord.ref || caseRecord.caseFile?.paths || {};
  return {
    caseId: caseRecord.ref?.caseId || caseRecord.caseFile?.caseId || '',
    casePath: paths.casePath || '',
    contextPath: paths.contextPath || '',
    timelinePath: paths.timelinePath || '',
    customerMessagesPath: paths.customerMessagesPath || '',
    agentRunsPath: paths.agentRunsPath || '',
    status: caseRecord.caseFile?.status || '',
  };
}
