import fs from 'fs';
import path from 'path';

export const DEFAULT_QUEUE_OPERATION_LOG = path.join('data', 'leads', 'queue-operations.jsonl');

export function buildQueueOperation({
  action = '',
  entityKey = '',
  clientSlug = '',
  company = '',
  actor = 'profitslocal-admin',
  dryRun = false,
  command = '',
  status = 'started',
  outputPath = '',
  outputPreview = '',
  error = '',
  costPolicy = {},
  createdAt = new Date().toISOString(),
  finishedAt = '',
  operationId = '',
} = {}) {
  return {
    schemaVersion: 1,
    operationId: operationId || `queue_op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    action,
    entityKey,
    clientSlug,
    company,
    actor,
    dryRun: Boolean(dryRun),
    command,
    status,
    outputPath,
    outputPreview: String(outputPreview || '').slice(0, 2000),
    error: String(error || '').slice(0, 2000),
    costPolicy: {
      googlePlacesApi: 'not_used_by_default',
      reviews: 'not_scraped_by_default',
      emailExtraction: 'not_used_by_default',
      paidEnrichment: 'dry_run_first',
      ...costPolicy,
    },
    createdAt,
    finishedAt,
  };
}

export function appendQueueOperation(entry, logPath = DEFAULT_QUEUE_OPERATION_LOG) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
  return { ok: true, logPath, entry };
}

export function readQueueOperations(logPath = DEFAULT_QUEUE_OPERATION_LOG) {
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, 'utf8')
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
