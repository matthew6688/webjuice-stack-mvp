#!/usr/bin/env node
/**
 * pl:reply-handle — Process an incoming customer reply.
 *
 *   1. classify reply text → 12 classes
 *   2. update entity.last_reply_class
 *   3. lookup playbook → recommended_phase + draft_prompt_outline
 *   4. advance entity phase via setEntityPhase
 *   5. post summary to Discord thread
 *
 * Usage:
 *   npm run pl:reply-handle -- <entityKey> --message-text "..."
 *   npm run pl:reply-handle -- <entityKey> --message-file path/to/reply.txt
 *   LEAD_THREAD_DRY_RUN=true ... (for dry-run)
 */

import fs from 'fs';
import { parseArgs, die, emit, readEntity, ENTITIES_DIR } from './_pl-shared.js';
import path from 'path';
import { classifyReply } from '../../core/llm/reply-classifier.js';
import { lookupPlaybook } from '../../core/sales/reply-playbook.js';
import { setEntityPhase } from '../../core/leads/discovery-store.js';
import { appendThreadMessage } from '../../core/funnel/lead-thread-sync.js';

const args = parseArgs(process.argv.slice(2));
const entityKey = args._[0] || args['entity-key'];
if (!entityKey) die('Usage: pl:reply-handle <entityKey> --message-text "..." | --message-file path');

let messageText = args['message-text'] || args.message;
if (!messageText && args['message-file']) {
  messageText = fs.readFileSync(args['message-file'], 'utf8');
}
if (!messageText) die('--message-text or --message-file required');

const entity = readEntity(entityKey);
if (!entity) die(`entity not found: ${entityKey}`);

// 1. Classify
const classified = classifyReply(messageText);

// 2. Patch entity.last_reply_class (read-merge-write, preserves everything else)
const entityPath = path.join(ENTITIES_DIR, `${entityKey}.json`);
const fresh = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
fresh.last_reply_class = classified.class;
fresh.last_reply_at = new Date().toISOString();
fresh.last_reply_excerpt = messageText.slice(0, 300);
fresh.signals = fresh.signals || {};
fresh.signals.replied = (fresh.signals.replied || 0) + 1;
fresh.last_contact_at = new Date().toISOString();
fs.writeFileSync(entityPath, JSON.stringify(fresh, null, 2) + '\n', 'utf8');

// 3. Lookup playbook
const playbook = lookupPlaybook(classified.class);

// 4. Advance phase per playbook (triggers Discord hooks automatically)
const advance = setEntityPhase({
  entityKey,
  phase: playbook.recommended_phase,
  archive_reason: ['unsubscribe', 'no', 'bounced'].includes(classified.class) ? classified.class : undefined,
  note: `Reply class=${classified.class}; ${playbook.recommended_action}`,
});

// 5. Post summary to lead thread (no-op if no thread, fire-and-forget via async)
const summaryMsg = `💬 **Reply received** (class=\`${classified.class}\`, confidence=${classified.confidence})
> ${messageText.slice(0, 200)}${messageText.length > 200 ? '…' : ''}

**Playbook**: ${playbook.recommended_action}
**Phase**: ${entity.phase || '—'} → ${playbook.recommended_phase}

Next: agent will draft a response per playbook prompt. React ✅ to send / ❌ to discard.`;

const appendResult = entity.discord_thread_id || process.env.LEAD_THREAD_DRY_RUN
  ? await appendThreadMessage(entityKey, summaryMsg)
  : { ok: true, skipped: true, reason: 'no_thread' };

emit({
  ok: true,
  entityKey,
  classified,
  playbook: {
    class: classified.class,
    recommended_phase: playbook.recommended_phase,
    recommended_action: playbook.recommended_action,
    draft_prompt_outline: playbook.draft_prompt_outline,
  },
  advance: { from: advance.from, to: advance.phase, noop: advance.noop },
  thread_append: appendResult,
});
