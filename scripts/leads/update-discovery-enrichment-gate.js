#!/usr/bin/env node

import path from 'path';
import { updateEnrichmentGate, enrichmentGateLabel } from '../../core/leads/enrichment-gate.js';

const args = parseArgs(process.argv.slice(2));
const entityKey = clean(args['entity-key'] || args.entityKey);
const status = clean(args.status || 'approved');
const operator = clean(args.operator || args.actor) || 'profitslocal-admin';
const note = clean(args.note);
const storeRoot = path.resolve(args['store-root'] || args.storeRoot || path.join('data', 'leads'));

if (!entityKey) {
  console.error(JSON.stringify({ ok: false, error: 'entity-key is required' }, null, 2));
  process.exit(1);
}

try {
  const result = updateEnrichmentGate({ entityKey, status, operator, note, storeRoot });
  console.log(JSON.stringify({
    ok: true,
    entityKey,
    status: result.gate.status,
    label: enrichmentGateLabel(result.gate.status),
    path: path.relative(process.cwd(), result.path),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
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
