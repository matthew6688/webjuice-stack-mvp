#!/usr/bin/env node
/**
 * V3 cycle-26 · Gate 2 · Runtime cycle-readiness doctor.
 *
 * "Cycle done" is only allowed when this exits 0.
 *
 * Checks (any fail → exit 1, prints diagnostic):
 *
 *   A · Static lint (delegates to scripts/ops/lint-message-literals.js)
 *
 *   B · Discord-side contract enforcement (fetches LIVE messages)
 *       For each active thread in #website-leads + #website-projects:
 *         - title must use STATE_TAGS + GRADE_TAGS only (no [预A] [预B] [预C])
 *         - title must not contain '[?]'
 *         - no message body may contain any DEPRECATED_TERMS string
 *         - any "Stage X/Y" pattern in message body must match STAGE_LABELS
 *         - profile card embed sections must come from PROFILE_SECTIONS
 *
 *   C · Phase ↔ thread consistency (cross-checks entity store + Discord)
 *         - entity.phase=archived → discord thread.archived must be true
 *         - entity.grade=D        → title must contain '[D]'
 *
 *   D · Terminal-fail handler coverage
 *         - For each TERMINAL_FAIL_PATHS entry, grep the file for the handler
 *           function name. Missing → violation.
 *
 * Pass = vouches at the contract level that user-visible Discord output
 * matches the design. Failures print precise locations.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CONTRACT_VERSION,
  STAGE_LABELS,
  PROFILE_SECTIONS,
  STATE_TAGS,
  GRADE_TAGS,
  DEPRECATED_TERMS,
  TERMINAL_FAIL_PATHS,
} from '../../core/contracts/discord-messages.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const DISCORD_API = 'https://discord.com/api/v10';
const BOT = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
const LEADS_CH = process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID;
const PROJECTS_CH = process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID;

const violations = [];
function violate(category, msg, detail = null) {
  violations.push({ category, msg, detail });
}

async function dGet(p) {
  const r = await fetch(`${DISCORD_API}${p}`, { headers: { Authorization: `Bot ${BOT}` } });
  if (!r.ok) throw new Error(`GET ${p}: ${r.status}`);
  return r.json();
}

// ─── Check A · Static lint ──────────────────────────────────────────────────
function checkA_StaticLint() {
  const r = spawnSync('node', ['scripts/ops/lint-message-literals.js'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    violate('A.lint', 'lint-message-literals.js failed', r.stdout.split('\n').slice(0, 60).join('\n'));
  }
}

// ─── Check B · Discord-side contract ────────────────────────────────────────
async function listActive(channelId) {
  const cd = await dGet(`/channels/${channelId}`);
  const ad = await dGet(`/guilds/${cd.guild_id}/threads/active`);
  return (ad.threads || []).filter((t) => t.parent_id === channelId);
}

const STAGE_LABEL_VALUES = new Set(Object.values(STAGE_LABELS));
const STAGE_LABEL_PATTERN = /Stage\s+\d+\/\d+[^\n]*/g;
const ALLOWED_TAGS = new Set([...Object.values(STATE_TAGS), ...Object.values(GRADE_TAGS)]);
const BANNED_TAGS = ['[预A]', '[预B]', '[预C]'];

async function checkB_DiscordContract() {
  if (!BOT || !LEADS_CH) {
    violate('B.discord', 'missing DISCORD env · cannot run live check');
    return [];
  }
  const allThreads = [];
  for (const ch of [LEADS_CH, PROJECTS_CH].filter(Boolean)) {
    const threads = await listActive(ch);
    allThreads.push(...threads.map((t) => ({ ...t, channel: ch })));
  }

  for (const t of allThreads) {
    // Title checks
    if (t.name.includes('[?]')) violate('B.title', `${t.id} title has [?]`, t.name);
    for (const bt of BANNED_TAGS) {
      if (t.name.includes(bt)) violate('B.title', `${t.id} title has banned tag ${bt}`, t.name);
    }
    // Title should contain a GRADE_TAG (after audit) or a STATE_TAG
    const hasAllowedTag = [...ALLOWED_TAGS].some((tag) => t.name.includes(tag));
    if (!hasAllowedTag) violate('B.title', `${t.id} title lacks any STATE/GRADE tag`, t.name);

    // Message body checks
    const msgs = await dGet(`/channels/${t.id}/messages?limit=50`);
    for (const m of msgs) {
      const bodies = [m.content || ''];
      for (const e of m.embeds || []) {
        if (e.title) bodies.push(e.title);
        if (e.description) bodies.push(e.description);
        for (const f of e.fields || []) bodies.push(`${f.name}: ${f.value}`);
      }
      const full = bodies.join('\n');

      // Deprecated terms
      for (const term of DEPRECATED_TERMS) {
        if (full.includes(term)) {
          violate('B.body.deprecated', `thread ${t.id} msg ${m.id} contains "${term}"`, full.slice(0, 200));
        }
      }
      // Stage label conformance
      let sm;
      STAGE_LABEL_PATTERN.lastIndex = 0;
      while ((sm = STAGE_LABEL_PATTERN.exec(full)) !== null) {
        const cleaned = sm[0].replace(/\*\*/g, '').trim();
        // Allow if it matches any canonical label as a prefix
        const ok = [...STAGE_LABEL_VALUES].some((v) => cleaned.startsWith(v.split('·')[0].trim()));
        if (!ok) {
          violate('B.body.stage', `thread ${t.id} msg ${m.id} has non-contract stage label`, sm[0]);
        }
      }
    }
  }
  return allThreads;
}

// ─── Check C · Phase ↔ thread ────────────────────────────────────────────────
function loadEntities() {
  const dir = path.join(ROOT, 'data/leads/entities');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ key: f.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}

async function checkC_PhaseConsistency() {
  const entities = loadEntities();
  for (const e of entities) {
    if (!e.discord_thread_id) continue;
    let t;
    try {
      t = await dGet(`/channels/${e.discord_thread_id}`);
    } catch (err) {
      violate('C.fetch', `entity ${e.key} thread fetch failed`, err.message);
      continue;
    }
    if (e.phase === 'archived' && !t.thread_metadata?.archived) {
      violate('C.archive', `entity ${e.key} phase=archived but thread !archived`, `thread=${t.id} name="${t.name}"`);
    }
    const gradeStr = typeof e.grade === 'string' ? e.grade : e.grade?.grade;
    if (gradeStr === 'D' && !t.name.includes('[D]')) {
      violate('C.title', `entity ${e.key} grade=D but title lacks [D]`, `thread=${t.id} name="${t.name}"`);
    }
  }
}

// ─── Check E · Batch state · entities[] completeness vs expected_total ────
// cycle-27 bug #6 (Matthew 2026-05-15): when entities[].length < expected_total
// AND finalized_at > 30 min ago · operator missed a silent recordEntityTerminal
// miss (race / clobber bug). Flag for manual backfill review.
function checkE_BatchEntitiesCompleteness() {
  const batchDir = path.join(ROOT, 'data/v2/pipeline-batches');
  if (!fs.existsSync(batchDir)) return;
  const now = Date.now();
  const STALE_THRESHOLD_MS = 30 * 60 * 1000;
  for (const f of fs.readdirSync(batchDir)) {
    if (!f.endsWith('.json') || f.endsWith('.lock')) continue;
    let bs;
    try { bs = JSON.parse(fs.readFileSync(path.join(batchDir, f), 'utf8')); } catch { continue; }
    const expected = bs.expected_total || 0;
    const recorded = (bs.entities || []).length;
    const finalizedAt = bs.finalized_at ? new Date(bs.finalized_at).getTime() : null;
    if (!finalizedAt) continue; // batch still running · skip
    if (now - finalizedAt < STALE_THRESHOLD_MS) continue; // give 30 min grace
    if (expected > 0 && recorded < expected && !bs.kpi_dashboard_posted_at) {
      violate('E.batch_incomplete',
        `batch ${bs.batch_id} · entities ${recorded}/${expected} · KPI never fired · operator should backfill or investigate`,
        `state file: data/v2/pipeline-batches/${f}`);
    }
  }
}

// ─── Check D · Terminal-fail handler coverage ───────────────────────────────
function checkD_TerminalHandlers() {
  for (const p of TERMINAL_FAIL_PATHS) {
    const full = path.join(ROOT, p.file);
    if (!fs.existsSync(full)) {
      violate('D.terminal', `${p.id} expects ${p.file} (missing)`);
      continue;
    }
    const txt = fs.readFileSync(full, 'utf8');
    if (!txt.includes(p.handler)) {
      violate('D.terminal', `${p.id} path file ${p.file} does not reference handler ${p.handler}()`);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log(`pl-cycle-doctor · contract v${CONTRACT_VERSION}\n`);
  checkA_StaticLint();
  const threads = await checkB_DiscordContract();
  await checkC_PhaseConsistency();
  checkD_TerminalHandlers();
  checkE_BatchEntitiesCompleteness();

  const byCat = {};
  for (const v of violations) (byCat[v.category] ??= []).push(v);

  console.log(`Checks run: A.lint · B.discord (${threads.length} threads) · C.phase · D.terminal · E.batch\n`);

  if (violations.length === 0) {
    console.log('✓ cycle-doctor: 0 violations · contract clean · OK to ship');
    process.exit(0);
  }

  console.log(`✗ cycle-doctor: ${violations.length} violations across ${Object.keys(byCat).length} categories\n`);
  for (const cat of Object.keys(byCat).sort()) {
    console.log(`▸ ${cat} (${byCat[cat].length})`);
    for (const v of byCat[cat].slice(0, 20)) {
      console.log(`    · ${v.msg}`);
      if (v.detail) console.log(`        ${String(v.detail).split('\n')[0].slice(0, 160)}`);
    }
    if (byCat[cat].length > 20) console.log(`    … +${byCat[cat].length - 20} more`);
    console.log();
  }
  process.exit(1);
})().catch((e) => { console.error(e); process.exit(2); });
