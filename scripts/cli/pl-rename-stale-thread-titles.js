#!/usr/bin/env node
/**
 * pl-rename-stale-thread-titles · V3 D43 cycle-5
 *
 * One-shot: scan all entities with discord_thread_id, rename any thread whose
 * title doesn't match the entity's current state (e.g. [?] when entity now has
 * a grade). Idempotent.
 *
 * Usage:
 *   node scripts/cli/pl-rename-stale-thread-titles.js --dry-run
 *   node scripts/cli/pl-rename-stale-thread-titles.js --execute
 */

import fs from 'node:fs';
import path from 'node:path';

const REPO = '/Users/matthew/Developer/google-map-website-v3';
const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has('--execute');
const ONLY_QUESTION_MARK = args.has('--only-?');

const entitiesDir = path.join(REPO, 'data/leads/entities');

const { renameThreadToCurrentTitle } = await import(path.join(REPO, 'core/funnel/lead-thread-sync.js'));
const { buildLeadThreadName } = await import(path.join(REPO, 'core/funnel/profile-card.js'));

const TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN;
if (!TOKEN) { console.error('Missing DISCORD_BOT_TOKEN'); process.exit(1); }

const files = fs.readdirSync(entitiesDir).filter(f => f.endsWith('.json'));
console.log(`Scanning ${files.length} entities...\n`);

let scanned = 0, candidates = 0, renamed = 0, unchanged = 0, failed = 0, skipped = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

for (const f of files) {
  scanned++;
  let entity;
  try { entity = JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8')); } catch { continue; }
  const tid = entity.project_thread_id || entity.discord_thread_id;
  if (!tid) { skipped++; continue; }
  const channel = entity.project_thread_id ? 'projects' : 'leads';
  const desiredTitle = buildLeadThreadName(entity, channel);

  // Fetch current title
  const r = await fetch(`https://discord.com/api/v10/channels/${tid}`, {
    headers: { Authorization: `Bot ${TOKEN}`, 'User-Agent': 'profitslocal-rename' },
  });
  if (!r.ok) { failed++; console.log(`  ✗ ${entity.entityKey || f} · fetch fail ${r.status}`); continue; }
  const data = await r.json();
  const currentTitle = data.name;
  if (currentTitle === desiredTitle) { unchanged++; continue; }
  if (ONLY_QUESTION_MARK && !currentTitle.includes('[?]')) { skipped++; continue; }

  candidates++;
  console.log(`  ${DRY_RUN ? '[DRY]' : '[GO ]'}  ${tid}  "${currentTitle}"`);
  console.log(`         → "${desiredTitle}"`);

  if (!DRY_RUN) {
    const res = await renameThreadToCurrentTitle(entity.entityKey);
    if (res.ok && !res.unchanged) renamed++;
    else if (res.ok && res.unchanged) unchanged++;
    else { failed++; console.log(`         ✗ ${res.reason}`); }
    await sleep(800); // 50 req / 10 min Discord guild limit safety
  }
}

console.log(`\n=== Summary ===`);
console.log(`  scanned:   ${scanned}`);
console.log(`  skipped:   ${skipped}  (no thread / not-?)`);
console.log(`  unchanged: ${unchanged}`);
console.log(`  candidates ${DRY_RUN ? 'would rename' : 'renamed'}: ${DRY_RUN ? candidates : renamed}`);
console.log(`  failed:    ${failed}`);
if (DRY_RUN) console.log(`\nRun with --execute to actually rename.`);
