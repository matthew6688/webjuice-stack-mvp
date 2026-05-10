#!/usr/bin/env node

import fs from 'fs';
import { execFileSync } from 'child_process';
import { QUEUE_ACTION_DEFINITIONS } from '../../core/funnel/stage-config.js';
import { appendQueueOperation, buildQueueOperation } from '../../core/funnel/queue-operations.js';

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input || '';
const payload = inputPath ? JSON.parse(fs.readFileSync(inputPath, 'utf8')) : args;
const action = clean(payload.queue_action || payload.queueAction || payload.action);
const entityKey = clean(payload.entity_key || payload.entityKey || payload['entity-key']);
const clientSlug = clean(payload.client_slug || payload.clientSlug || payload['client-slug']);
const company = clean(payload.company);
const actor = clean(payload.actor) || 'profitslocal-admin';
const dryRun = payload.dry_run === true || payload.dry_run === 'true' || args['dry-run'] === 'true';

const definition = actionDefinition(action, { entityKey, clientSlug });
if (!definition) {
  console.error(JSON.stringify({ ok: false, error: `Unsupported lead queue action: ${action}` }, null, 2));
  process.exit(1);
}

const command = ['run', definition.script, '--', ...definition.args];
if (dryRun && !definition.args.includes('--dry-run') && definition.supportsDryRun) command.push('--dry-run');

const result = {
  ok: true,
  dryRun,
  action,
  entityKey,
  clientSlug,
  company,
  actor,
  command: ['npm', ...command].join(' '),
  startedAt: new Date().toISOString(),
  output: '',
  operationLogPath: args['operation-log'] || '',
};

try {
  if (dryRun && definition.noopDryRun) {
    result.output = 'Dry run only; command was not executed.';
  } else {
    result.output = execFileSync('npm', command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  result.finishedAt = new Date().toISOString();
  const operation = buildQueueOperation({
    action,
    entityKey,
    clientSlug,
    company,
    actor,
    dryRun,
    command: result.command,
    status: 'succeeded',
    outputPath: args.output || '',
    outputPreview: result.output,
    createdAt: result.startedAt,
    finishedAt: result.finishedAt,
    operationId: payload.operation_id || payload.operationId || '',
  });
  const appended = appendQueueOperation(operation, args['operation-log'] || undefined);
  result.operationId = operation.operationId;
  result.operationLogPath = appended.logPath;
} catch (error) {
  result.finishedAt = new Date().toISOString();
  const operation = buildQueueOperation({
    action,
    entityKey,
    clientSlug,
    company,
    actor,
    dryRun,
    command: result.command,
    status: 'failed',
    outputPath: args.output || '',
    outputPreview: result.output,
    error: error.stderr || error.message || String(error),
    createdAt: result.startedAt,
    finishedAt: result.finishedAt,
    operationId: payload.operation_id || payload.operationId || '',
  });
  const appended = appendQueueOperation(operation, args['operation-log'] || undefined);
  result.operationId = operation.operationId;
  result.operationLogPath = appended.logPath;
  result.error = operation.error;
  if (args.output) fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

if (args.output) fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));

function actionDefinition(value, { entityKey, clientSlug }) {
  const definition = QUEUE_ACTION_DEFINITIONS[value];
  if (!definition || (definition.requiresEntityKey && !entityKey) || (definition.requiresClientSlug && !clientSlug)) return null;
  return {
    ...definition,
    args: definition.args({ entityKey, clientSlug }),
  };
}

function clean(value) {
  return String(value || '').trim();
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
