#!/usr/bin/env node
/**
 * V3 cycle-25 · Clean slate test harness reset.
 *
 * 1. Archive+lock all active threads in #website-leads, #website-projects, #lead-discovery-runs
 * 2. Strip per-entity discord refs + cycle-21..24 cached fields (keep entity data)
 * 3. Empty data/queues/*.jsonl
 * 4. Archive data/tasks/*.json into _archive/cycle-21-24/
 *
 * Idempotent. --dry-run supported.
 */
import fs from 'node:fs';
import path from 'node:path';
import { archiveAndLockThread } from '../../core/funnel/lead-thread-sync.js';

const DRY = process.argv.includes('--dry-run');
const DISCORD_API = 'https://discord.com/api/v10';

const CHANNELS = {
  leads:     process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID,
  projects:  process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID,
  discovery: process.env.LEAD_DISCOVERY_RUNS_DISCORD_CHANNEL_ID,
};
const BOT = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;

async function discordGet(p) {
  const r = await fetch(`${DISCORD_API}${p}`, { headers: { Authorization: `Bot ${BOT}` } });
  if (!r.ok) throw new Error(`GET ${p}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function listActiveThreads(channelId) {
  const cd = await discordGet(`/channels/${channelId}`);
  const ad = await discordGet(`/guilds/${cd.guild_id}/threads/active`);
  return (ad.threads || []).filter((t) => t.parent_id === channelId);
}

async function step1_archiveThreads() {
  console.log('\n── Step 1 · archive Discord threads ──');
  for (const [name, id] of Object.entries(CHANNELS)) {
    if (!id) { console.log(`  ${name}: no channel id · skip`); continue; }
    const threads = await listActiveThreads(id);
    console.log(`  #${name} (${id}): ${threads.length} active`);
    for (const t of threads) {
      if (DRY) { console.log(`    [dry] archive ${t.id} · ${t.name}`); continue; }
      const r = await archiveAndLockThread(t.id, { reason: 'cycle-25 clean slate · test restart' });
      console.log(`    ${r.ok ? '✓' : '✗'} ${t.id} · ${t.name}${r.ok ? '' : ' · ' + r.reason}`);
      await new Promise(r => setTimeout(r, 400)); // gentle rate-limit
    }
  }
}

const FIELDS_TO_STRIP = [
  'discord_thread_id', 'discord_project_thread_id', 'discord_thread_meta',
  'project_thread_id', 'exclusion_filter', 'predict_grade',
  'enrichment_attempted_at', 'enrichment_yielded', 'audit',
  'qualification', 'detailed_audit', 'master_md_path', 'build', 'publish',
  'grade', 'demo_url', 'pages_url', 'qualification_runs',
];

function step2_resetEntities() {
  console.log('\n── Step 2 · strip entity discord refs + cached audit fields ──');
  const dir = path.join(process.cwd(), 'data/leads/entities');
  if (!fs.existsSync(dir)) { console.log('  no entity dir · skip'); return; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let touched = 0;
  for (const f of files) {
    const p = path.join(dir, f);
    const e = JSON.parse(fs.readFileSync(p, 'utf8'));
    let dirty = false;
    for (const k of FIELDS_TO_STRIP) {
      if (e[k] !== undefined) { delete e[k]; dirty = true; }
    }
    if (e.phase && e.phase !== 'awaiting') { e.phase = 'awaiting'; dirty = true; }
    if (dirty) {
      if (!DRY) fs.writeFileSync(p, JSON.stringify(e, null, 2));
      touched++;
    }
  }
  console.log(`  stripped ${touched}/${files.length} entities · phase→awaiting`);
}

function step3_emptyQueues() {
  console.log('\n── Step 3 · empty queues ──');
  const dir = path.join(process.cwd(), 'data/queues');
  if (!fs.existsSync(dir)) { console.log('  no queue dir · skip'); return; }
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.jsonl')) continue;
    const p = path.join(dir, f);
    const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).length;
    if (!DRY) fs.writeFileSync(p, '');
    console.log(`  cleared ${f} (was ${lines} lines)`);
  }
}

function step4_archiveTasks() {
  console.log('\n── Step 4 · archive task files ──');
  const dir = path.join(process.cwd(), 'data/tasks');
  if (!fs.existsSync(dir)) { console.log('  no task dir · skip'); return; }
  const archiveDir = path.join(dir, '_archive', 'cycle-21-24');
  if (!DRY) fs.mkdirSync(archiveDir, { recursive: true });
  let moved = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const src = path.join(dir, f);
    const dst = path.join(archiveDir, f);
    if (!DRY) fs.renameSync(src, dst);
    moved++;
  }
  console.log(`  moved ${moved} task files → _archive/cycle-21-24/`);
}

(async () => {
  if (!BOT) { console.error('missing bot token'); process.exit(1); }
  console.log(`Clean slate · ${DRY ? 'DRY-RUN' : 'LIVE'}`);
  await step1_archiveThreads();
  step2_resetEntities();
  step3_emptyQueues();
  step4_archiveTasks();
  console.log('\n✓ Clean slate done. Run `npm run pl:discord-snapshot` to verify.');
})();
