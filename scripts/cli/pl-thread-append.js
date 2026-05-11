#!/usr/bin/env node
/**
 * pl:thread-append — Append a text message to an entity's Discord forum thread.
 *
 * Usage:
 *   npm run pl:thread-append -- <entityKey> "📤 sent variant=v_audit-led"
 *   LEAD_THREAD_DRY_RUN=true npm run pl:thread-append -- <entityKey> "test"
 */

import { parseArgs, die, emit, readEntity } from './_pl-shared.js';
import { appendThreadMessage } from '../../core/funnel/lead-thread-sync.js';

const args = parseArgs(process.argv.slice(2));
const entityKey = args._[0] || args['entity-key'];
const content = args._.slice(1).join(' ') || args.message || args.content;
if (!entityKey || !content) die('Usage: pl:thread-append <entityKey> <message>');

const entity = readEntity(entityKey);
if (!entity) die(`entity not found: ${entityKey}`);
if (!entity.discord_thread_id && !process.env.LEAD_THREAD_DRY_RUN) {
  die('entity has no discord_thread_id; run pl:thread first');
}

const result = await appendThreadMessage(entityKey, content);
emit({ ok: result.ok !== false, entityKey, result });
