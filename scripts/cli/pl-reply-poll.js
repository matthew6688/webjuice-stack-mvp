#!/usr/bin/env node
/**
 * pl:reply-poll — Fetch new inbound emails from agentic-inbox and route each
 * to the V2 reply pipeline if it matches a known lead entity.
 *
 * Pull-mode replacement for the (unimplemented) push webhook on inbound:
 *   1. GET /api/v1/mailboxes/{id}/emails?folder=inbox since last_seen
 *   2. For each reply, find matching entity by:
 *      a. thread_id == one of entity.outbound_message_ids   (preferred)
 *      b. sender email == entity.latest.email
 *      c. else: skip (unmatchable)
 *   3. Call applyV2ReplyClassification flow:
 *      classifyReply → setEntityPhase → Discord hook (auto)
 *   4. Persist last_seen timestamp to data/leads/reply-poll-state.json
 *
 * Idempotency: tracks processed message IDs to avoid double-handling.
 * Designed to be called from Hermes cron every 5 minutes (per D-decision).
 *
 * Usage:
 *   npm run pl:reply-poll
 *   npm run pl:reply-poll -- --since 2026-05-11T00:00:00Z
 *   npm run pl:reply-poll -- --dry-run
 */

import fs from 'fs';
import path from 'path';
import { parseArgs, emit, listEntities, ENTITIES_DIR } from './_pl-shared.js';
import { classifyReplyWithFallback } from '../../core/llm/reply-classifier.js';
import { lookupPlaybook } from '../../core/sales/reply-playbook.js';
import { setEntityPhase } from '../../core/leads/discovery-store.js';
import { appendThreadMessage } from '../../core/funnel/lead-thread-sync.js';

const args = parseArgs(process.argv.slice(2));
const dryRun = args['dry-run'] === true;

const STATE_PATH = path.join('data', 'leads', 'reply-poll-state.json');
const state = fs.existsSync(STATE_PATH)
  ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  : { last_seen: '2026-01-01T00:00:00.000Z', processed_message_ids: [] };
const sinceArg = args.since || state.last_seen;
const processedSet = new Set(state.processed_message_ids || []);

const MAILBOX_ID = process.env.AGENTIC_INBOX_MAILBOX_ID || 'hi@profitslocal.com';
const BASE_URL = process.env.AGENTIC_INBOX_URL || 'https://mail.profitslocal.com';
const cfHeaders = {
  'CF-Access-Client-Id': process.env.AGENTIC_INBOX_ACCESS_CLIENT_ID,
  'CF-Access-Client-Secret': process.env.AGENTIC_INBOX_ACCESS_CLIENT_SECRET,
};

if (!cfHeaders['CF-Access-Client-Id']) {
  console.error('AGENTIC_INBOX_ACCESS_CLIENT_ID not set in .env.local');
  process.exit(2);
}

const url = `${BASE_URL.replace(/\/+$/, '')}/api/v1/mailboxes/${encodeURIComponent(MAILBOX_ID)}/emails?folder=inbox&limit=50`;
const listResponse = await fetch(url, { headers: cfHeaders });
if (!listResponse.ok) {
  console.error(`agentic-inbox list failed: ${listResponse.status}`);
  process.exit(3);
}
const listData = await listResponse.json();
const emails = listData.emails || listData;

const entities = listEntities().filter((e) => e.grade?.investment_level && e.grade.investment_level !== 'D');

function findEntity(email) {
  // Match by thread_id linkage to a known outbound
  if (email.in_reply_to || email.thread_id) {
    const target = email.in_reply_to || email.thread_id;
    for (const e of entities) {
      const ids = e.outbound_message_ids || [];
      if (ids.includes(target)) return { entity: e, by: 'thread_id' };
    }
  }
  // Match by sender email
  const sender = String(email.sender || '').toLowerCase();
  for (const e of entities) {
    const entityEmail = String(e.latest?.email || '').toLowerCase();
    if (entityEmail && entityEmail === sender) return { entity: e, by: 'sender_email' };
  }
  return null;
}

const sinceTs = new Date(sinceArg).getTime();
const newEmails = (emails || []).filter((e) => {
  const ts = new Date(e.date || e.received_at || 0).getTime();
  if (ts <= sinceTs) return false;
  if (processedSet.has(e.id)) return false;
  return true;
});

const results = [];
let maxTs = sinceArg;
for (const email of newEmails) {
  const ts = new Date(email.date).getTime();
  if (ts > new Date(maxTs).getTime()) maxTs = email.date;

  const matched = findEntity(email);
  if (!matched) {
    // Log unmatched to data/leads/reply-poll-unmatched.jsonl for operator inspection.
    // Common reasons: reply to non-V2 outbound, spam, list mail.
    if (!dryRun) {
      const unmatchedPath = path.join('data', 'leads', 'reply-poll-unmatched.jsonl');
      fs.mkdirSync(path.dirname(unmatchedPath), { recursive: true });
      fs.appendFileSync(unmatchedPath, JSON.stringify({
        at: new Date().toISOString(),
        message_id: email.id,
        sender: email.sender,
        subject: email.subject,
        snippet: (email.snippet || '').slice(0, 200),
        in_reply_to: email.in_reply_to,
      }) + '\n');
    }
    results.push({ message_id: email.id, sender: email.sender, subject: email.subject?.slice(0, 60), result: 'unmatched' });
    processedSet.add(email.id);
    continue;
  }

  // Fetch full body — list endpoint only returns snippet
  let rawText = String(email.body || email.text || email.snippet || '');
  if (!email.body && !email.text) {
    try {
      const fullR = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/v1/mailboxes/${encodeURIComponent(MAILBOX_ID)}/emails/${email.id}`, { headers: cfHeaders });
      if (fullR.ok) {
        const full = await fullR.json();
        rawText = String(full.body || full.text || full.snippet || '');
      }
    } catch {}
  }
  // Strip Gmail quote, HTML tags, decode entities
  const beforeQuote = rawText.split(/<blockquote|<div class="gmail_quote/)[0];
  const plainText = beforeQuote
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // T0-tier: regex first; Ollama qwen3.5:9b fallback only when regex returns unclear.
  // ~99% of replies hit regex path (zero cost); ~1% touch Ollama (~3s + $0).
  const classified = await classifyReplyWithFallback(plainText);
  const playbook = lookupPlaybook(classified.class);

  if (dryRun) {
    results.push({
      message_id: email.id, sender: email.sender, entityKey: matched.entity.entityKey,
      matched_by: matched.by, classified_as: classified.class, confidence: classified.confidence,
      recommended_phase: playbook.recommended_phase, dry_run: true,
    });
    continue;
  }

  // Patch entity (read-merge-write)
  const entityPath = path.join(ENTITIES_DIR, `${matched.entity.entityKey}.json`);
  const fresh = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
  fresh.last_reply_class = classified.class;
  fresh.last_reply_at = email.date;
  fresh.last_reply_excerpt = plainText.slice(0, 300);
  fresh.signals = fresh.signals || {};
  fresh.signals.replied = (fresh.signals.replied || 0) + 1;
  fresh.last_contact_at = email.date;
  fresh.inbound_message_ids = [...(fresh.inbound_message_ids || []), email.id];
  fs.writeFileSync(entityPath, JSON.stringify(fresh, null, 2) + '\n', 'utf8');

  const advance = setEntityPhase({
    entityKey: matched.entity.entityKey,
    phase: playbook.recommended_phase,
    archive_reason: ['unsubscribe', 'no', 'bounced'].includes(classified.class) ? classified.class : undefined,
    note: `Reply class=${classified.class}; ${playbook.recommended_action}`,
  });

  // Append rich reply context to thread (the setEntityPhase hook would post phase change too)
  if (matched.entity.discord_thread_id) {
    await appendThreadMessage(matched.entity.entityKey,
      `💬 **Reply auto-ingested** (poll, class=\`${classified.class}\`, by=${matched.by})\n> ${plainText.slice(0, 200)}${plainText.length > 200 ? '…' : ''}\n\n**Playbook**: ${playbook.recommended_action}`);
  }

  processedSet.add(email.id);
  results.push({
    message_id: email.id, sender: email.sender, entityKey: matched.entity.entityKey,
    matched_by: matched.by, classified_as: classified.class,
    advance: { from: advance.from, to: advance.phase },
  });
}

if (!dryRun) {
  // Cap processed list at 500 most recent to bound state file size
  state.last_seen = maxTs;
  state.processed_message_ids = [...processedSet].slice(-500);
  state.last_poll_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

emit({
  ok: true,
  scanned: emails?.length || 0,
  new_since: sinceArg,
  matched: results.filter((r) => r.entityKey).length,
  unmatched: results.filter((r) => r.result === 'unmatched').length,
  dry_run: dryRun,
  results,
});
