#!/usr/bin/env node
/**
 * pl:daily-tick — Idempotent daily housekeeping for V2 lead lifecycle.
 *
 * Two responsibilities (NEXT_STEPS.md P1.2 + P1.3):
 *
 *   1. Nurture revival: entities with phase=nurture and nurture_due_at <= today
 *      → set phase=awaiting (next agent heartbeat picks up).
 *
 *   2. Outreach timeout: entities with phase=outreach-active AND
 *      last_contact_at older than --timeout-days (default 21) AND no recent
 *      reply → set phase=archived with reason='no_response_${N}d'.
 *
 * Both transitions go through setEntityPhase so Discord sync hooks fire
 * automatically (tag swap + thread message + profile card edit).
 *
 * Usage:
 *   npm run pl:daily-tick
 *   npm run pl:daily-tick -- --dry-run
 *   npm run pl:daily-tick -- --timeout-days 14
 *
 * Schedule: Hermes cron `every 24h at 09:00`, paused in dev (D3).
 */

import { parseArgs, emit, listEntities } from './_pl-shared.js';
import { setEntityPhase, ENTITY_PHASE } from '../../core/leads/discovery-store.js';

const args = parseArgs(process.argv.slice(2));
const dryRun = args['dry-run'] === true;
const timeoutDays = Number(args['timeout-days'] || 21);
const now = new Date();
const today = now.toISOString().slice(0, 10);

const entities = listEntities();

// ── 1. Nurture revival ──
const nurtureCandidates = entities.filter((e) => {
  if (e.phase !== ENTITY_PHASE.NURTURE) return false;
  if (!e.nurture_due_at) return false;
  return new Date(e.nurture_due_at).getTime() <= now.getTime();
});

const nurtureResults = [];
for (const e of nurtureCandidates) {
  if (dryRun) {
    nurtureResults.push({ entityKey: e.entityKey, name: e.latest?.name, due_at: e.nurture_due_at, action: 'would_revive' });
    continue;
  }
  const r = setEntityPhase({
    entityKey: e.entityKey,
    phase: ENTITY_PHASE.AWAITING,
    note: `Nurture revived (due ${e.nurture_due_at?.slice(0,10)})`,
  });
  nurtureResults.push({ entityKey: e.entityKey, name: e.latest?.name, due_at: e.nurture_due_at, action: r.ok ? 'revived' : 'failed', reason: r.reason });
}

// ── 2. Outreach timeout → archive ──
const timeoutMs = timeoutDays * 86400 * 1000;
const timeoutCandidates = entities.filter((e) => {
  if (e.phase !== ENTITY_PHASE.OUTREACH_ACTIVE) return false;
  if (e.do_not_contact) return false;
  const lastContact = e.last_contact_at ? new Date(e.last_contact_at).getTime() : 0;
  if (!lastContact) return false;
  return (now.getTime() - lastContact) >= timeoutMs;
});

const timeoutResults = [];
for (const e of timeoutCandidates) {
  const daysAgo = Math.floor((now.getTime() - new Date(e.last_contact_at).getTime()) / 86400000);
  if (dryRun) {
    timeoutResults.push({ entityKey: e.entityKey, name: e.latest?.name, last_contact_at: e.last_contact_at, days_ago: daysAgo, action: 'would_archive' });
    continue;
  }
  const r = setEntityPhase({
    entityKey: e.entityKey,
    phase: ENTITY_PHASE.ARCHIVED,
    archive_reason: `no_response_${daysAgo}d`,
    note: `Auto-archived after ${daysAgo}d no contact (threshold ${timeoutDays}d)`,
  });
  timeoutResults.push({ entityKey: e.entityKey, name: e.latest?.name, days_ago: daysAgo, action: r.ok ? 'archived' : 'failed', reason: r.reason });
}

emit({
  ok: true,
  date: today,
  dry_run: dryRun,
  timeout_days: timeoutDays,
  nurture: {
    candidates: nurtureCandidates.length,
    results: nurtureResults,
  },
  outreach_timeout: {
    candidates: timeoutCandidates.length,
    results: timeoutResults,
  },
});
