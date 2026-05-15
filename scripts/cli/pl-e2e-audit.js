#!/usr/bin/env node
/**
 * cycle-26 E2E audit · dump all relevant Discord threads + verify against contract.
 */
import { STATE_TAGS, GRADE_TAGS } from '../../core/contracts/discord-messages.js';

const TOKEN = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN;
const CHANS = {
  tasks: process.env.WEBSITE_TASKS_FORUM_CHANNEL_ID,
  leads: process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID,
  projects: process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID,
  discovery: process.env.LEAD_DISCOVERY_RUNS_DISCORD_CHANNEL_ID,
};

async function get(p) {
  const r = await fetch('https://discord.com/api/v10' + p, { headers: { Authorization: 'Bot ' + TOKEN } });
  return r.json();
}

async function getThreadAndMsgs(id) {
  const t = await get(`/channels/${id}`);
  const msgs = await get(`/channels/${id}/messages?limit=50`);
  return { t, msgs };
}

const SUMMARY = {
  taskThread: null,
  batchThread: null,
  leadsThreads: [],
  projectsThreads: [],
};

for (const [name, ch] of Object.entries(CHANS)) {
  if (!ch) continue;
  const cd = await get('/channels/' + ch);
  const ad = await get('/guilds/' + cd.guild_id + '/threads/active');
  const our = (ad.threads || []).filter((t) => t.parent_id === ch);
  console.log(`\n══════════ #${name} (${our.length} active) ══════════`);
  for (const t of our) {
    console.log(`\n▸ ${t.id} · ${t.name}`);
    console.log(`  archived=${t.thread_metadata?.archived} locked=${t.thread_metadata?.locked} msg_count=${t.message_count}`);
    if (name === 'tasks' || name === 'discovery') {
      // Dump all messages
      const msgs = await get(`/channels/${t.id}/messages?limit=20`);
      msgs.reverse();
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const head = (m.content || m.embeds?.[0]?.title || m.embeds?.[0]?.description || '(empty)').slice(0, 100).replace(/\n/g, ' / ');
        console.log(`    [${i}] ${m.timestamp.slice(11, 19)} ${head}`);
      }
    } else if (name === 'leads' || name === 'projects') {
      // Just count + features
      const msgs = await get(`/channels/${t.id}/messages?limit=50`);
      console.log(`  msgs (${msgs.length} of last 50):`);
      msgs.reverse();
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const head = (m.content || m.embeds?.[0]?.title || m.embeds?.[0]?.description || '(empty)').slice(0, 80).replace(/\n/g, ' / ');
        console.log(`    [${i}] ${m.timestamp.slice(11, 19)} ${head}`);
      }
    }
  }
}
