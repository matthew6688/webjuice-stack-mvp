#!/usr/bin/env node
/**
 * pl-cleanup-archived-threads · V3 D43 cycle-4
 *
 * One-shot script: delete ALL archived threads in #website-leads (and optionally
 * #website-projects). For cleanup of [?]-title D-grade threads left over from
 * pre-cycle-4 behavior.
 *
 * Usage:
 *   node scripts/cli/pl-cleanup-archived-threads.js --dry-run
 *   node scripts/cli/pl-cleanup-archived-threads.js --leads
 *   node scripts/cli/pl-cleanup-archived-threads.js --leads --projects
 *   node scripts/cli/pl-cleanup-archived-threads.js --leads --execute  # 真删
 *
 * Default: dry-run on #website-leads only. Add --execute to actually delete.
 */

import process from 'node:process';

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has('--execute');
const DO_LEADS = args.has('--leads') || (!args.has('--projects'));
const DO_PROJECTS = args.has('--projects');

const TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN');
  process.exit(1);
}

const LEADS_CH = process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID;
const PROJ_CH = process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID;

const DISCORD_API = 'https://discord.com/api/v10';

async function fetchArchivedThreads(channelId) {
  // List public archived threads in a forum/text channel
  const url = `${DISCORD_API}/channels/${channelId}/threads/archived/public?limit=100`;
  const all = [];
  let cursor = null;
  for (let i = 0; i < 20; i++) { // up to 20 pages = 2000 threads
    const u = cursor ? `${url}&before=${cursor}` : url;
    const res = await fetch(u, {
      headers: { Authorization: `Bot ${TOKEN}`, 'User-Agent': 'profitslocal-cleanup' },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Discord fetch failed ${res.status}: ${t}`);
    }
    const data = await res.json();
    const threads = data.threads || [];
    all.push(...threads);
    if (!data.has_more || threads.length === 0) break;
    const last = threads[threads.length - 1];
    cursor = last.thread_metadata?.archive_timestamp || null;
    if (!cursor) break;
    await sleep(500);
  }
  return all;
}

async function deleteThread(threadId) {
  const res = await fetch(`${DISCORD_API}/channels/${threadId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${TOKEN}`, 'User-Agent': 'profitslocal-cleanup' },
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') || '2');
    console.error(`  · 429 retry-after ${retry}s`);
    await sleep(retry * 1000 + 500);
    return deleteThread(threadId);
  }
  return res.ok;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cleanChannel(label, channelId) {
  if (!channelId) {
    console.log(`[${label}] channel id not set · skip`);
    return { found: 0, deleted: 0, failed: 0 };
  }
  console.log(`[${label}] fetching archived threads in ${channelId}...`);
  const archived = await fetchArchivedThreads(channelId);
  console.log(`[${label}] found ${archived.length} archived thread(s)`);
  if (archived.length === 0) return { found: 0, deleted: 0, failed: 0 };

  console.log('--- sample (first 10) ---');
  for (const t of archived.slice(0, 10)) {
    console.log(`  ${t.id}  ${t.name}`);
  }
  if (archived.length > 10) console.log(`  ... +${archived.length - 10} more`);

  if (DRY_RUN) {
    console.log(`[${label}] DRY-RUN · ${archived.length} would be deleted · pass --execute to actually delete`);
    return { found: archived.length, deleted: 0, failed: 0 };
  }

  let deleted = 0;
  let failed = 0;
  for (const t of archived) {
    process.stdout.write(`  deleting ${t.id} "${t.name.slice(0, 50)}"... `);
    const ok = await deleteThread(t.id);
    if (ok) { deleted++; console.log('✓'); }
    else { failed++; console.log('✗'); }
    await sleep(400); // pace · don't burn rate limit
  }
  return { found: archived.length, deleted, failed };
}

(async () => {
  console.log(`\n=== Archived Thread Cleanup · ${DRY_RUN ? 'DRY-RUN' : 'EXECUTE'} ===\n`);
  const results = {};
  if (DO_LEADS) results.leads = await cleanChannel('website-leads', LEADS_CH);
  if (DO_PROJECTS) results.projects = await cleanChannel('website-projects', PROJ_CH);
  console.log('\n=== Summary ===');
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k}: found=${v.found} deleted=${v.deleted} failed=${v.failed}`);
  }
})();
