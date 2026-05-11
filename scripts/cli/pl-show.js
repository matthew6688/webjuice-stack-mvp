#!/usr/bin/env node
/**
 * pl:show — Markdown summary of one entity. Human-readable.
 *
 * Usage: npm run pl:show -- <entityKey>
 */

import path from 'path';
import { readEntity, readDetailedAudit, parseArgs, die, ROOT } from './_pl-shared.js';
import { deriveLocale, nowInLocale } from '../../core/leads/locale.js';

const args = parseArgs(process.argv.slice(2));
const entityKey = args._[0] || args['entity-key'];
if (!entityKey) die('Usage: pl:show <entityKey>');

const entity = readEntity(entityKey);
if (!entity) die(`entity not found: ${entityKey}`);

const latest = entity.latest || {};
const grade = entity.grade || null;
const audit = readDetailedAudit(entityKey)?.detailed_audit || null;
const locale = deriveLocale(entity);

const lines = [];
lines.push(`# ${latest.name || entityKey}`);
lines.push('');
lines.push(`- **Entity key**: \`${entityKey}\``);
lines.push(`- **Niche**: ${latest.niche || '—'}`);
lines.push(`- **Address**: ${latest.address || '—'}`);
lines.push(`- **Phone**: ${latest.phone || '—'}`);
lines.push(`- **Website**: ${latest.website || '—'}  (\`${latest.websiteStatus || '—'}\`)`);
lines.push(`- **Rating / Reviews**: ${latest.rating ?? '—'}★ / ${latest.review_count ?? '—'}`);
lines.push(`- **Locale**: ${locale.timezone} ${locale.state ? `(${locale.state})` : ''} — 客户本地 ${nowInLocale(locale)}`);
lines.push('');

lines.push('## V2 status');
lines.push(`- **Grade**: ${grade?.investment_level || '—'}${grade?.product_tier ? ` / ${grade.product_tier}` : ''}`);
lines.push(`- **Pricing**: ${grade?.recommended_pricing?.one_time || '—'}${grade?.recommended_pricing?.monthly ? ` + ${grade.recommended_pricing.monthly}` : ''}`);
lines.push(`- **Phase**: ${entity.phase || '—'}${entity.sub_status ? ` (${entity.sub_status})` : ''}`);
lines.push(`- **Archive reason**: ${entity.archive_reason || '—'}`);
lines.push(`- **Discord thread**: ${entity.discord_thread_id ? `\`${entity.discord_thread_id}\`` : '—'}`);
lines.push(`- **Legacy status**: \`${entity.status || '—'}\``);
lines.push('');

if (audit) {
  lines.push('## Audit summary');
  lines.push(`- **Score**: ${audit.audit_score ?? '—'}/100`);
  lines.push(`- **Decision**: ${audit.decision || '—'}`);
  const hardTriggers = audit.hard_triggers || [];
  if (hardTriggers.length) lines.push(`- **Hard triggers**: ${hardTriggers.join(', ')}`);
  const rel = path.relative(ROOT, path.join(ROOT, 'data/v2/fixtures/detailed-audit', `${entityKey}.json`));
  lines.push(`- **Fixture**: \`${rel}\``);
  lines.push('');
}

if (grade?.skip_reasons?.length) {
  lines.push('## Skip reasons (D-grade only)');
  for (const r of grade.skip_reasons) lines.push(`- \`${r.id}\` — ${r.reason}`);
  lines.push('');
}

const history = entity.history || [];
if (history.length) {
  lines.push('## Recent history');
  for (const h of history.slice(-5)) {
    lines.push(`- \`${h.at}\` ${h.event}${h.from && h.to ? ` ${h.from} → ${h.to}` : ''}${h.note ? ` — ${h.note}` : ''}`);
  }
}

console.log(lines.join('\n'));
