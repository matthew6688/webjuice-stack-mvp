#!/usr/bin/env node
/**
 * cycle-25 · Deep line-by-line audit of #website-leads threads.
 * Dumps each thread: title, every message (truncated), embed sections,
 * cross-checks against entity store, flags anomalies.
 */
import fs from 'node:fs';
import path from 'node:path';

const DISCORD_API = 'https://discord.com/api/v10';
const BOT = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
const LEADS_CH = process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID;

async function dGet(p) {
  const r = await fetch(`${DISCORD_API}${p}`, { headers: { Authorization: `Bot ${BOT}` } });
  if (!r.ok) throw new Error(`GET ${p}: ${r.status}`);
  return r.json();
}

function loadEntity(entityKey) {
  const p = path.join(process.cwd(), 'data/leads/entities', `${entityKey}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Map thread slug → entity key by reading entity files
function buildEntityIndex() {
  const dir = path.join(process.cwd(), 'data/leads/entities');
  const idx = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (e.discord_thread_id) idx[e.discord_thread_id] = e;
  }
  return idx;
}

(async () => {
  if (!BOT || !LEADS_CH) { console.error('missing env'); process.exit(1); }
  const cd = await dGet(`/channels/${LEADS_CH}`);
  const ad = await dGet(`/guilds/${cd.guild_id}/threads/active`);
  const threads = (ad.threads || []).filter((t) => t.parent_id === LEADS_CH);
  const idx = buildEntityIndex();

  console.log(`\n═══ Deep audit · ${threads.length} threads in #website-leads ═══\n`);

  for (const t of threads) {
    const entity = idx[t.id];
    const msgs = await dGet(`/channels/${t.id}/messages?limit=50`);
    msgs.reverse(); // oldest first

    console.log(`\n${'━'.repeat(80)}`);
    console.log(`THREAD ${t.id}`);
    console.log(`  title: ${t.name}`);
    console.log(`  msgs:  ${msgs.length}`);
    if (entity) {
      console.log(`  entity: ${entity.key} · phase=${entity.phase} · grade=${entity.grade || 'n/a'} · predict_grade=${entity.predict_grade?.grade || 'n/a'}`);
      console.log(`  exclusion_filter: ${JSON.stringify(entity.exclusion_filter || null).slice(0, 200)}`);
      const l = entity.latest || {};
      console.log(`  latest: review=${l.review_count} rating=${l.rating} phone=${!!l.phone} email=${!!l.email} site=${!!l.website}`);
    } else {
      console.log(`  ⚠ entity not found for thread`);
    }
    console.log();

    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const ts = m.timestamp?.slice(11, 19) || '??';
      const author = m.author?.username || '?';
      console.log(`  [${i}] ${ts} · ${author}`);
      if (m.content) {
        for (const line of m.content.split('\n')) {
          console.log(`      | ${line.slice(0, 200)}`);
        }
      }
      if (m.embeds?.length) {
        for (const emb of m.embeds) {
          if (emb.title)       console.log(`      ▸ embed.title: ${emb.title.slice(0, 100)}`);
          if (emb.description) {
            for (const line of emb.description.split('\n')) {
              console.log(`      ▸ ${line.slice(0, 200)}`);
            }
          }
          if (emb.fields?.length) {
            for (const f of emb.fields) {
              console.log(`      ▸ field[${f.name}]: ${String(f.value).split('\n')[0].slice(0, 120)}`);
            }
          }
        }
      }
      if (m.attachments?.length) {
        for (const a of m.attachments) {
          console.log(`      📎 ${a.filename} (${a.size}B · ${a.content_type})`);
        }
      }
      console.log();
    }
  }
})();
