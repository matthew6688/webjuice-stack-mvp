#!/usr/bin/env node
/**
 * V3 cycle-26 P9 · Re-archive "zombie" threads (locked=true but archived=false).
 *
 * Problem: Discord auto-unarchives forum threads on any POST. Before P9 fix
 * the dispatcher posted "系统任务 完成" to leads threads AFTER archive ·
 * unarchiving them. They stay locked (write-protected) but visible in channel ·
 * confusing operator with duplicate (leads + projects).
 *
 * This CLI scans #website-leads + #website-projects · finds threads with
 * locked=true AND archived=false · re-PATCHes them archived=true. Now safe
 * because P9 stopped the dispatcher from posting to them.
 *
 * Usage:
 *   npm run pl:rearchive-zombies            # live · re-archive all
 *   npm run pl:rearchive-zombies -- --dry-run   # detect only
 */
const TOKEN = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
const LEADS_CH = process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID;
const PROJECTS_CH = process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID;
const DISCORD_API = 'https://discord.com/api/v10';
const DRY = process.argv.includes('--dry-run');

if (!TOKEN) { console.error('missing DISCORD bot token'); process.exit(2); }

async function dGet(p) {
  const r = await fetch(`${DISCORD_API}${p}`, { headers: { Authorization: `Bot ${TOKEN}` } });
  if (!r.ok) throw new Error(`GET ${p}: ${r.status}`);
  return r.json();
}

async function listActive(channelId) {
  const cd = await dGet(`/channels/${channelId}`);
  const ad = await dGet(`/guilds/${cd.guild_id}/threads/active`);
  return (ad.threads || []).filter((t) => t.parent_id === channelId);
}

async function rearchive(threadId) {
  const r = await fetch(`${DISCORD_API}/channels/${threadId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ archived: true, locked: true, auto_archive_duration: 60 }),
  });
  return { ok: r.ok, status: r.status };
}

(async () => {
  console.log(`pl-rearchive-zombies · ${DRY ? 'DRY-RUN' : 'LIVE'}\n`);
  let zombies = 0, fixed = 0, fail = 0;
  for (const [name, ch] of [['leads', LEADS_CH], ['projects', PROJECTS_CH]].filter((x) => x[1])) {
    const threads = await listActive(ch);
    for (const t of threads) {
      const isZombie = t.thread_metadata?.locked === true && t.thread_metadata?.archived !== true;
      if (!isZombie) continue;
      zombies++;
      console.log(`  zombie #${name} · ${t.id} · ${t.name}`);
      if (DRY) continue;
      const r = await rearchive(t.id);
      if (r.ok) { fixed++; console.log(`    ✓ re-archived`); }
      else { fail++; console.log(`    ✗ HTTP ${r.status}`); }
      // gentle rate-limit
      await new Promise((res) => setTimeout(res, 300));
    }
  }
  console.log(`\n${DRY ? 'detected' : 'processed'}: zombies=${zombies} · fixed=${fixed} · failed=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((err) => { console.error('FATAL:', err.message); process.exit(2); });
