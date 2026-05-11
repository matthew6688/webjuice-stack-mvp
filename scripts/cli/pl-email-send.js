#!/usr/bin/env node
/**
 * pl:email-send — Send a previously-drafted email via agentic-inbox.
 *
 * Dev phase: HTTP transport to mail.profitslocal.com is NOT yet wired (the
 * worker doesn't expose a public send route; needs Cloudflare Access bypass
 * or a shared-secret protected route). For dev we run in `--dry-run` mode:
 *   - Logs what WOULD have been sent
 *   - Updates entity.phase=outreach-active
 *   - Bumps entity.signals.sent
 *   - Appends Discord thread message (if thread exists)
 *
 * Real transport will be wired during Block 12 E2E.
 *
 * Usage:
 *   npm run pl:email-send -- <entityKey> --to recipient@example.com --subject "..." --body-file path
 *   npm run pl:email-send -- <entityKey> --from-draft   # use last pl:email-draft output
 */

import fs from 'fs';
import path from 'path';
import { parseArgs, die, emit, readEntity, ENTITIES_DIR } from './_pl-shared.js';
import { setEntityPhase, ENTITY_PHASE } from '../../core/leads/discovery-store.js';
import { appendThreadMessage } from '../../core/funnel/lead-thread-sync.js';
import { sendOutbound } from '../../core/integrations/agentic-inbox.js';

const args = parseArgs(process.argv.slice(2));
const entityKey = args._[0] || args['entity-key'];
if (!entityKey) die('Usage: pl:email-send <entityKey> --to <email> --subject "..." --body-file <path>');

const entity = readEntity(entityKey);
if (!entity) die(`entity not found: ${entityKey}`);

const recipient = args.to || entity.latest?.email;
if (!recipient) die('--to <email> required (or set entity.latest.email)');
const subject = args.subject;
const bodyFile = args['body-file'];
const variantId = args.variant || 'unknown';
if (!subject || !bodyFile) die('--subject and --body-file required');
const body = fs.readFileSync(bodyFile, 'utf8');

// --no-dry-run flips on real send (requires CF Access service token in env)
const dryRun = args['no-dry-run'] !== true && args['dry-run'] !== false;

// Build HTML body (markdown → minimal HTML wrap)
const bodyHtml = body.split('\n\n').map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('\n');

let sendResult = { ok: true, dry_run: dryRun, skipped: 'dry-run' };
if (!dryRun) {
  sendResult = await sendOutbound({
    to: recipient,
    subject,
    html: bodyHtml,
    text: body,
    entityKey,
    variantId,
  });
  if (!sendResult.ok) {
    console.warn(`[pl:email-send] send failed: ${sendResult.reason || sendResult.status}`);
  }
} else {
  console.warn('[pl:email-send] DRY-RUN: pass --no-dry-run to send real email');
}

// Only patch entity + advance if the real send succeeded (or in dry-run).
// On send failure (e.g. CF Access 403), leave entity untouched so operator can retry.
let advance = { from: entity.phase, phase: entity.phase, noop: true };
if (sendResult.ok) {
  const entityPath = path.join(ENTITIES_DIR, `${entityKey}.json`);
  const fresh = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
  fresh.signals = fresh.signals || {};
  fresh.signals.sent = (fresh.signals.sent || 0) + 1;
  fresh.last_contact_at = new Date().toISOString();
  fresh.last_sent_variant_id = variantId;
  // Track outbound message_id so pl:reply-poll can match incoming replies by thread_id
  // (stronger match than sender_email; survives when same gmail address is used by
  // multiple entities or when sender email changes mid-thread).
  if (sendResult.messageId) {
    fresh.outbound_message_ids = [...(fresh.outbound_message_ids || []), sendResult.messageId];
    // Cap at 50 to bound entity file size
    if (fresh.outbound_message_ids.length > 50) fresh.outbound_message_ids = fresh.outbound_message_ids.slice(-50);
  }
  fs.writeFileSync(entityPath, JSON.stringify(fresh, null, 2) + '\n');

  advance = setEntityPhase({
    entityKey,
    phase: ENTITY_PHASE.OUTREACH_ACTIVE,
    note: `Sent variant=${variantId} to ${recipient}${dryRun ? ' [dry-run]' : ''}`,
  });
}

// Append to thread (may already be triggered by setEntityPhase hook;
// but explicit append carries the send summary)
let appendResult = { skipped: true, reason: 'no_thread' };
if (entity.discord_thread_id || process.env.LEAD_THREAD_DRY_RUN) {
  appendResult = await appendThreadMessage(entityKey, `📤 **Email sent** (variant=${variantId}${dryRun ? ', DRY-RUN' : ''})
> To: \`${recipient}\`
> Subject: ${subject}
> Body length: ${body.length} chars`);
}

emit({
  ok: sendResult.ok,
  entityKey,
  recipient,
  subject,
  variant_id: variantId,
  dry_run: dryRun,
  send: sendResult,
  advance: { from: advance.from, to: advance.phase, noop: advance.noop },
  thread_append: appendResult,
});
