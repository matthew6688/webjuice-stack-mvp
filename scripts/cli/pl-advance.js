#!/usr/bin/env node
/**
 * pl:advance — Change an entity's V2 phase. Single write entry point used by
 * Hermes agent + admin emergency buttons. Wraps setEntityPhase from Block 1.2.
 *
 * Usage:
 *   npm run pl:advance -- <entityKey> --to outreach-active
 *   npm run pl:advance -- <entityKey> --to archived --reason ghosted_30d
 *   npm run pl:advance -- <entityKey> --to outreach-active --sub-status follow-up-1
 *   npm run pl:advance -- <entityKey> --to awaiting --note "operator manual"
 */

import { parseArgs, die, emit, readEntity } from './_pl-shared.js';
import { setEntityPhase, ENTITY_PHASE } from '../../core/leads/discovery-store.js';

const args = parseArgs(process.argv.slice(2));
const entityKey = args._[0] || args['entity-key'];
if (!entityKey) die('Usage: pl:advance <entityKey> --to <phase> [--reason X] [--sub-status Y] [--note Z]');
const phase = args.to || args.phase;
if (!phase) die('--to <phase> required');

const allowed = Object.values(ENTITY_PHASE);
if (!allowed.includes(phase)) {
  die(`invalid phase '${phase}'. Allowed: ${allowed.join(', ')}`);
}

const before = readEntity(entityKey);
if (!before) die(`entity not found: ${entityKey}`);

const result = setEntityPhase({
  entityKey,
  phase,
  sub_status: args['sub-status'],
  archive_reason: args.reason || args['archive-reason'],
  note: args.note || '',
});

if (!result.ok) die(result.reason || 'setEntityPhase failed');

emit({
  ok: true,
  entityKey,
  from: result.from,
  to: result.phase,
  sub_status: result.sub_status,
  archive_reason: result.archive_reason,
  noop: result.noop,
});
