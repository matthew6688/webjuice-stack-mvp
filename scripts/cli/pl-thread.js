#!/usr/bin/env node
/**
 * pl:thread — Get or create the Discord forum thread for an entity.
 * Second call on same entity returns the same thread_id (idempotent).
 *
 * Usage:
 *   npm run pl:thread -- <entityKey>
 *   LEAD_THREAD_DRY_RUN=true npm run pl:thread -- <entityKey>
 */

import { parseArgs, die, emit, readEntity } from './_pl-shared.js';
import { openLeadThread } from '../../core/funnel/lead-thread-sync.js';

const args = parseArgs(process.argv.slice(2));
const entityKey = args._[0] || args['entity-key'];
if (!entityKey) die('Usage: pl:thread <entityKey>');

const before = readEntity(entityKey);
if (!before) die(`entity not found: ${entityKey}`);

const result = await openLeadThread(entityKey);
emit({
  ok: result.ok !== false,
  entityKey,
  result,
});
