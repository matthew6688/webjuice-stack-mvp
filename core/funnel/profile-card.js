/**
 * Lead thread profile card — pinned-style top message in each Discord forum post.
 * DISCORD_OUTREACH_PRD.md §8.
 *
 * Single render function used by:
 *   - Discord lead thread (this module, via openLeadThread/upsertProfileCard)
 *   - Admin lead detail page (Block 5.3, server-render same fields to HTML)
 *
 * Renders to a Discord embed object (one source of truth — admin reuses fields).
 * 16 fields per spec; Discord embeds support up to 25 fields × 6000 chars total.
 */

import fs from 'node:fs';
import path from 'node:path';
import { deriveLocale, nowInLocale } from '../leads/locale.js';
import { readManifest } from '../leads/asset-manifest.js';

const COLORS = {
  A: 0x2ecc71, // green
  B: 0x3498db, // blue
  C: 0x95a5a6, // gray
  D: 0xe74c3c, // red
  default: 0x7f8c8d,
};

function slugifyName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function fmtDaysAgo(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const days = Math.floor(ms / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

function fmtSignals(s = {}) {
  const sent = s.sent ?? 0;
  const opened = s.opened ?? 0;
  const clicked = s.clicked ?? 0;
  const replied = s.replied ?? 0;
  return `sent=${sent} open=${opened} click=${clicked} reply=${replied}`;
}

function fmtSocials(socials) {
  if (!socials) return '—';
  if (typeof socials === 'string') return socials;
  const entries = Object.entries(socials);
  if (!entries.length) return '—';
  return entries.map(([k, v]) => `${k}: ${v}`).slice(0, 3).join(' · ');
}

function quickLinksField(clientSlug, calendlyUrl) {
  try {
    const manifest = readManifest(clientSlug);
    const lines = [];
    const byType = (t) => manifest.assets.find((a) => a.type === t);
    const masterDoc = byType('document');
    const report = byType('report');
    const shots = manifest.assets.filter((a) => a.type === 'screenshot');
    const videos = manifest.assets.filter((a) => a.type === 'video');
    const proposals = manifest.assets.filter((a) => a.type === 'presentation');
    if (masterDoc) lines.push(`📄 Master MD: \`${masterDoc.localPath}\``);
    if (report) lines.push(`📊 Audit report: \`${report.localPath}\``);
    if (shots.length) lines.push(`🖼️ Screenshots (${shots.length})`);
    if (videos.length) lines.push(`🎥 Walkthrough (${videos.length})`);
    if (proposals.length) lines.push(`📋 Proposal (${proposals.length})`);
    if (calendlyUrl) lines.push(`🗓 Calendly: ${calendlyUrl}`);
    return lines.length ? lines.join('\n') : '— no assets yet —';
  } catch {
    return calendlyUrl ? `🗓 Calendly: ${calendlyUrl}` : '— no assets yet —';
  }
}

/**
 * Read CF Pages demo URL from cf-pages-deploy.json if available.
 * V3 D34 (2026-05-14): channel='projects' adds Demo LIVE URL field.
 */
function readDemoUrl(clientSlug) {
  if (!clientSlug) return '';
  try {
    const p = path.join('clients', clientSlug, 'v2/concept/reference-adapter/cf-pages-deploy.json');
    if (!fs.existsSync(p)) return '';
    const rec = JSON.parse(fs.readFileSync(p, 'utf8'));
    return rec.demo_url || '';
  } catch {
    return '';
  }
}

/**
 * Render an entity to a Discord embed representing the lead profile card.
 * Pure function — no I/O except asset manifest read for quick-links field.
 *
 * @param {object} entity — entity JSON from data/leads/entities/<key>.json
 * @param {object} opts
 * @param {object} [opts.audit] — detailed_audit fixture if available
 * @param {string} [opts.calendlyUrl]
 * @param {string} [opts.channel] — 'leads' (default · no demo) | 'projects' (with demo URL) | 'paid' (M5 · 加 paid info)
 * @returns {object} Discord embed object
 */
export function renderProfileCard(entity, { audit = null, calendlyUrl = '', channel = 'leads' } = {}) {
  const latest = entity.latest || {};
  const grade = entity.grade || {};
  const locale = deriveLocale(entity);
  const clientSlug = entity.promotedClientSlug || slugifyName(latest.name || '');
  const level = grade.investment_level || null;

  const niche = latest.niche || latest.category || '—';
  const titleParts = [];
  if (niche !== '—') titleParts.push(`[${niche}]`);
  titleParts.push(latest.name || entity.entityKey);
  if (level) titleParts.push(`— ${level}${grade.product_tier ? `/${grade.product_tier}` : ''}`);

  const phaseLabel = entity.phase || 'unset';
  const subStatus = entity.sub_status ? ` (${entity.sub_status})` : '';

  const fields = [
    // Contact (5)
    { name: '📞 Phone', value: latest.phone || '—', inline: true },
    { name: '✉️ Primary email', value: latest.email || '—', inline: true },
    { name: '✉️ Backup email', value: latest.backup_email || '—', inline: true },
    { name: '🌐 Website', value: latest.website ? `${latest.website}\n(${latest.websiteStatus || 'unknown'})` : '—', inline: false },
    { name: '👤 Decision maker', value: latest.decision_maker || '—', inline: true },
    { name: '📱 Social', value: fmtSocials(latest.social_links || latest.socials), inline: true },
    // Locale (1)
    { name: '🌏 客户本地', value: `${nowInLocale(locale) || '—'} (${locale.timezone}${locale.state ? `, ${locale.state}` : ''})`, inline: false },
    // V2 status (5)
    { name: 'Grade', value: `${level || '—'}${grade.product_tier ? `/${grade.product_tier}` : ''}`, inline: true },
    { name: 'Phase', value: `${phaseLabel}${subStatus}`, inline: true },
    { name: 'Audit', value: audit?.audit_score != null ? `${audit.audit_score}/100${audit.decision ? ` · ${audit.decision}` : ''}` : '—', inline: true },
    { name: 'Last contact', value: entity.last_contact_at ? `${entity.last_contact_at.slice(0, 10)} (${fmtDaysAgo(entity.last_contact_at)})` : '—', inline: true },
    { name: 'Email stats', value: fmtSignals(entity.signals), inline: true },
    { name: 'Est value', value: entity.est_value ? `$${entity.est_value}` : (grade.recommended_pricing?.one_time || '—'), inline: true },
    // Quick links (1, multi-line)
    { name: '🔗 Quick links', value: quickLinksField(clientSlug, calendlyUrl), inline: false },
  ];

  // V3 D34 (2026-05-14): channel-specific extra fields
  if (channel === 'projects') {
    const demoUrl = readDemoUrl(clientSlug);
    fields.push({
      name: '🌐 Demo LIVE',
      value: demoUrl ? demoUrl : '— 还没 publish —',
      inline: false,
    });
  } else if (channel === 'paid') {
    fields.push({
      name: '💳 Payment',
      value: entity.paid_at
        ? `Paid ${entity.paid_at.slice(0, 10)} · ${entity.subscription_type || 'one-time'}`
        : '— pending —',
      inline: true,
    });
    fields.push({
      name: '🔁 Revision',
      value: `r${entity.current_revision_round || 0} · ${entity.revision_status || 'pending'}`,
      inline: true,
    });
  }

  // Validate 25-field / 6000-char Discord limits
  const totalChars = fields.reduce((sum, f) => sum + (f.name.length + f.value.length), 0)
    + titleParts.join(' ').length;
  if (totalChars > 5500) {
    // truncate quick-links if blob is too big
    fields[fields.length - 1].value = fields[fields.length - 1].value.slice(0, 900);
  }

  return {
    title: titleParts.join(' '),
    description: `📍 ${latest.address || '—'}`,
    color: COLORS[level] || COLORS.default,
    fields,
    footer: { text: `entityKey: ${entity.entityKey}` },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper for thread title prefix. Niche moved to title per PRD §7.3.
 */
export function buildLeadThreadName(entity) {
  const latest = entity.latest || {};
  const grade = entity.grade || {};
  const level = grade.investment_level || '?';
  const niche = latest.niche || latest.category || '';
  const nichePrefix = niche ? `[${niche}] ` : '';
  return `${nichePrefix}[${level}] ${latest.name || entity.entityKey}`.slice(0, 100);
}
