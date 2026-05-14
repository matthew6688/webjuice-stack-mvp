#!/usr/bin/env node
/**
 * pl:rename-keepers-titles · V3 D35
 *
 * 一次性把现有 #website-projects 8 个 keepers thread:
 *   1. 改 title 为新格式: [niche-中文] [stage-中文] [grade] name
 *   2. PUT /pins/{messageId} · 把 profile card pin 到 thread 顶
 *   3. PATCH 刷新 profile card (新 7-section 布局)
 *
 * Dry-run default · --apply 真改。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENTITIES_DIR = path.join(REPO, 'data/leads/entities');
const DISCORD_API = 'https://discord.com/api/v10';

function readEntity(key) {
  const p = path.join(ENTITIES_DIR, `${key}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeEntity(e) {
  fs.writeFileSync(path.join(ENTITIES_DIR, `${e.entityKey}.json`), JSON.stringify(e, null, 2) + '\n');
}

const botToken = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
if (!botToken) {
  console.error('FATAL: WEBSITE_TASKS_DISCORD_BOT_TOKEN not set');
  process.exit(1);
}

const targets = fs.readdirSync(ENTITIES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => readEntity(f.replace(/\.json$/, '')))
  .filter((e) => e && e.project_thread_id);

console.log(`\n=== pl:rename-keepers-titles · ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
console.log(`Found ${targets.length} entity 含 project_thread_id\n`);

(async () => {
  const { buildThreadTitle } = await import(path.join(REPO, 'core/funnel/display-vocab.js'));
  const { upsertProjectProfileCard } = await import(path.join(REPO, 'core/funnel/lead-thread-sync.js'));

  for (const e of targets) {
    // V3 D35 · 给每个 keeper set 默认 sales_stage='demo-ready'
    if (!e.sales_stage) {
      e.sales_stage = 'demo-ready';
      if (APPLY) writeEntity(e);
    }
    const newTitle = buildThreadTitle(e, 'projects');
    const tid = e.project_thread_id;
    const mid = e.project_profile_message_id;
    console.log(`  ${tid}  ${newTitle}`);

    if (!APPLY) continue;

    // 1. Rename thread
    try {
      const r = await fetch(`${DISCORD_API}/channels/${tid}`, {
        method: 'PATCH',
        headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTitle }),
      });
      if (!r.ok) console.error(`    rename FAIL · ${r.status}`);
    } catch (err) {
      console.error(`    rename FAIL · ${err.message}`);
    }
    await new Promise((res) => setTimeout(res, 250));

    // 2. Pin profile card
    if (mid) {
      try {
        const r = await fetch(`${DISCORD_API}/channels/${tid}/pins/${mid}`, {
          method: 'PUT',
          headers: { Authorization: `Bot ${botToken}` },
        });
        if (!r.ok && r.status !== 204) console.error(`    pin FAIL · ${r.status}`);
      } catch (err) {
        console.error(`    pin FAIL · ${err.message}`);
      }
      await new Promise((res) => setTimeout(res, 250));
    }

    // 3. Refresh profile card with new 7-section layout
    try {
      const r = await upsertProjectProfileCard(e.entityKey);
      if (!r.ok) console.error(`    profile refresh FAIL · ${r.reason}`);
    } catch (err) {
      console.error(`    profile refresh FAIL · ${err.message}`);
    }
    await new Promise((res) => setTimeout(res, 250));
  }

  console.log('\n' + (APPLY ? '✅ done · 8 threads updated' : '[DRY-RUN] · 加 --apply 真改'));
})();
