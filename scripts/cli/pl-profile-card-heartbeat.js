#!/usr/bin/env node
/**
 * V3 cycle-26 · Profile card heartbeat doctor.
 *
 * Defense line 5 (per SOP-MASTER-MD-DATA-LINEAGE asset integrity).
 *
 * Cron schedule: every 5 minutes (or invoked manually).
 * Scans all active #website-leads + #website-projects threads · for each:
 *   1. Fetch live embed
 *   2. Build expected embed from entity state
 *   3. Diff hash · if mismatch → call upsertProfileCard to fix
 *   4. Log all actions (audit trail)
 *
 * Exit 0 = no drift found · 1 = drift fixed (auto-healed) · 2 = error
 *
 * Usage:
 *   npm run pl:profile-card-heartbeat
 *   npm run pl:profile-card-heartbeat -- --entity-key X    # single check
 *   npm run pl:profile-card-heartbeat -- --dry-run         # detect only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderProfileCard } from '../../core/funnel/profile-card.js';
import { upsertProfileCard } from '../../core/funnel/lead-thread-sync.js';
import { readDetailedAudit } from '../../core/funnel/lead-thread-helpers.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENTITIES_DIR = path.join(REPO, 'data/leads/entities');
const TOKEN = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
const DISCORD_API = 'https://discord.com/api/v10';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[k] = true; continue; }
    out[k] = next; i++;
  }
  return out;
}

function hashEmbed(embed) {
  if (!embed) return null;
  const desc = String(embed.description || '');
  return `${embed.title || ''}|${desc.length}|${desc.slice(0, 200)}`;
}

async function checkEntity(entityKey, dryRun) {
  const p = path.join(ENTITIES_DIR, `${entityKey}.json`);
  if (!fs.existsSync(p)) return { entityKey, ok: false, reason: 'entity_not_found' };
  const e = JSON.parse(fs.readFileSync(p, 'utf8'));
  const threadId = e.discord_thread_id || e.project_thread_id;
  const messageId = e.discord_profile_message_id;
  if (!threadId || !messageId) return { entityKey, ok: true, skipped: 'no_thread_or_message' };

  // cycle-26: skip archived / locked / D-grade · those are terminal state · drift OK + Discord rejects PATCH on locked
  if (e.phase === 'archived') return { entityKey, ok: true, skipped: 'archived' };
  const gradeStr = typeof e.grade === 'string' ? e.grade : e.grade?.grade;
  if (gradeStr === 'D') return { entityKey, ok: true, skipped: 'grade_d' };

  // Check thread metadata · skip if Discord-side archived/locked (legacy threads · same reason)
  try {
    const cr = await fetch(`${DISCORD_API}/channels/${threadId}`, { headers: { Authorization: `Bot ${TOKEN}` } });
    if (cr.ok) {
      const cd = await cr.json();
      if (cd.thread_metadata?.archived || cd.thread_metadata?.locked) {
        return { entityKey, ok: true, skipped: 'thread_locked_or_archived' };
      }
    }
  } catch { /* best-effort · proceed */ }

  // Build expected
  const audit = readDetailedAudit(entityKey)?.detailed_audit || null;
  const expectedEmbed = renderProfileCard(e, { audit });
  const expectedHash = hashEmbed(expectedEmbed);

  // Fetch actual
  let actualEmbed;
  try {
    const r = await fetch(`${DISCORD_API}/channels/${threadId}/messages/${messageId}`, {
      headers: { Authorization: `Bot ${TOKEN}` },
    });
    if (!r.ok) return { entityKey, ok: false, reason: `fetch_${r.status}` };
    const data = await r.json();
    actualEmbed = data.embeds?.[0];
  } catch (err) {
    return { entityKey, ok: false, reason: `fetch_err: ${err.message}` };
  }
  const actualHash = hashEmbed(actualEmbed);

  if (actualHash === expectedHash) return { entityKey, ok: true, in_sync: true };

  // Drift detected
  if (dryRun) {
    return { entityKey, ok: true, drift: true, fixed: false, expected: expectedHash?.slice(0, 60), actual: actualHash?.slice(0, 60) };
  }
  // Auto-fix
  const fixResult = await upsertProfileCard(entityKey);
  return { entityKey, ok: fixResult.ok, drift: true, fixed: fixResult.ok, verified: fixResult.verified, reason: fixResult.reason };
}

(async () => {
  if (!TOKEN) { console.error('Missing DISCORD bot token'); process.exit(2); }
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args['dry-run'];

  let keys;
  if (args['entity-key']) {
    keys = [args['entity-key']];
  } else {
    // Scan all entities with an active thread
    keys = [];
    for (const f of fs.readdirSync(ENTITIES_DIR)) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8'));
        if (e.discord_thread_id || e.project_thread_id) {
          if (e.discord_profile_message_id) keys.push(f.replace(/\.json$/, ''));
        }
      } catch {}
    }
  }

  console.log(`pl-profile-card-heartbeat · ${dryRun ? 'DRY-RUN' : 'LIVE'} · scanning ${keys.length} entities\n`);

  let driftCount = 0, fixedCount = 0, errorCount = 0;
  for (const k of keys) {
    const r = await checkEntity(k, dryRun);
    if (r.skipped) continue;
    if (!r.ok && !r.drift) {
      errorCount++;
      console.log(`  ✗ ${k} · ${r.reason}`);
    } else if (r.in_sync) {
      // silent (no log clutter for happy path)
    } else if (r.drift) {
      driftCount++;
      if (r.fixed) {
        fixedCount++;
        console.log(`  🔧 ${k} · drift fixed${r.verified ? ' (verified)' : ''}`);
      } else {
        console.log(`  ⚠ ${k} · drift detected${dryRun ? ' (dry-run · no fix)' : ' (fix failed: ' + (r.reason || 'unknown') + ')'}`);
      }
    }
    // Gentle Discord rate limit
    await new Promise((res) => setTimeout(res, 100));
  }

  console.log(`\nsummary: scanned=${keys.length} · in_sync=${keys.length - driftCount - errorCount} · drift=${driftCount} · fixed=${fixedCount} · errors=${errorCount}`);
  if (errorCount > 0) process.exit(2);
  if (driftCount > 0 && !dryRun) process.exit(1); // signal "drift was found + fixed"
  process.exit(0);
})().catch((err) => { console.error('FATAL:', err.stack || err.message); process.exit(2); });
