#!/usr/bin/env node
/**
 * pl:context — Compressed agent-facing context for one lead. < 3000 chars.
 *
 * Used by Hermes profitslocal-lead-ops skill: agent reads thread + this context
 * to decide next action. Sections (5):
 *   1. Identity (name/niche/contact/locale)
 *   2. V2 status (grade/phase/audit highlights)
 *   3. Sales signals (review snippets, contact velocity)
 *   4. Recent activity (last 5 history entries)
 *   5. Recommended next actions (from grade + phase)
 *
 * Usage: npm run pl:context -- <entityKey>
 */

import { readEntity, readDetailedAudit, parseArgs, die } from './_pl-shared.js';
import { deriveLocale, nowInLocale } from '../../core/leads/locale.js';

const args = parseArgs(process.argv.slice(2));
const entityKey = args._[0] || args['entity-key'];
if (!entityKey) die('Usage: pl:context <entityKey>');

const entity = readEntity(entityKey);
if (!entity) die(`entity not found: ${entityKey}`);

const latest = entity.latest || {};
const grade = entity.grade || null;
const audit = readDetailedAudit(entityKey)?.detailed_audit || null;
const locale = deriveLocale(entity);

const sections = [];

// 1 — Identity
sections.push([
  '### 1. Identity',
  `- ${latest.name || entityKey}`,
  `- Niche: ${latest.niche || '—'} | Categories: ${(latest.categories || []).slice(0, 3).join(', ')}`,
  `- Address: ${latest.address || '—'}`,
  `- Phone: ${latest.phone || '—'} | Email: ${latest.email || '—'}`,
  `- Website: ${latest.website || 'NONE'} (${latest.websiteStatus || '—'})`,
  `- Client local now: ${nowInLocale(locale)} (${locale.timezone})`,
].join('\n'));

// 2 — V2 status
const statusLines = [
  '### 2. V2 status',
  `- Grade: ${grade?.investment_level || '—'}${grade?.product_tier ? ` / ${grade.product_tier}` : ''}`,
  `- Pricing: ${grade?.recommended_pricing?.one_time || '—'}`,
  `- Phase: ${entity.phase || '—'}${entity.sub_status ? ` (${entity.sub_status})` : ''}`,
];
if (audit) {
  statusLines.push(`- Audit: ${audit.audit_score ?? '—'}/100 — ${audit.decision || '—'}`);
  if (audit.hard_triggers?.length) statusLines.push(`- Hard triggers: ${audit.hard_triggers.join(', ')}`);
}
sections.push(statusLines.join('\n'));

// 3 — Sales signals
const signalLines = ['### 3. Sales signals'];
signalLines.push(`- Reviews: ${latest.review_count ?? 0} @ ${latest.rating ?? '—'}★`);
if (grade?.investment_reason) signalLines.push(`- Why this grade: ${grade.investment_reason}`);
if (grade?.product_tier_reason) signalLines.push(`- Why this tier: ${grade.product_tier_reason}`);
if (entity.signals) {
  const s = entity.signals;
  signalLines.push(`- Email signals: sent=${s.sent ?? 0} opened=${s.opened ?? 0} clicked=${s.clicked ?? 0} replied=${s.replied ?? 0}`);
}
if (entity.last_reply_class) signalLines.push(`- Last reply class: \`${entity.last_reply_class}\``);
sections.push(signalLines.join('\n'));

// 4 — Recent activity
const history = entity.history || [];
const recent = history.slice(-5);
if (recent.length) {
  sections.push([
    '### 4. Recent activity (last 5)',
    ...recent.map((h) => {
      const arrow = h.from && h.to ? ` ${h.from}→${h.to}` : '';
      return `- ${h.at} ${h.event}${arrow}${h.note ? ` — ${h.note}` : ''}`;
    }),
  ].join('\n'));
}

// 5 — Recommended next actions
const next = ['### 5. Recommended next action'];
const phase = entity.phase || 'unset';
const level = grade?.investment_level || null;
if (level === 'D') next.push('- Auto-archived per hard skip rule; no action.');
else if (phase === 'awaiting' && level === 'A') next.push('- Draft cold email v1 (variant picker → audit-led tone). Send only after operator ✅.');
else if (phase === 'awaiting' && level === 'B') next.push('- Lower priority. Draft variant; wait for slot before sending.');
else if (phase === 'outreach-active') next.push(`- Check days-since-last-contact; if > 3 propose follow-up #${(entity.signals?.sent || 1)}.`);
else if (phase === 'replied') next.push(`- Reply class = \`${entity.last_reply_class || 'unclassified'}\`. Consult playbook → draft response.`);
else if (phase === 'nurture') next.push(`- Nurture queued; do nothing until nurture_due_at reached.`);
else if (phase === 'paid') next.push('- Handoff to project flow (existing intake pipeline).');
else if (phase === 'archived') next.push(`- Archived (${entity.archive_reason || 'unknown'}); do not contact.`);
else next.push(`- No clear next action for phase=${phase} grade=${level}. Flag for human.`);
sections.push(next.join('\n'));

const out = sections.join('\n\n');
console.log(out);

// Stderr footer for quick byte-count sanity check (kept out of stdout for pipeability)
process.stderr.write(`\n[pl:context] ${out.length} chars\n`);
