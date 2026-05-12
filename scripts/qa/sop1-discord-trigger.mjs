#!/usr/bin/env node
/**
 * SOP-1 Discord 真触发测试 · 让 listener 真处理 bot 发的 4 种 query
 *
 * 前提: listener 跑在 LISTENER_ALLOW_BOTS=1 模式
 *       (foreground · /tmp/listener-bots.log)
 *
 * Posts 4 forum threads, each with one query type, observes listener routing
 * and dispatcher outcomes.
 */

const FORUM = process.env.WEBSITE_TASKS_FORUM_CHANNEL_ID;
const BOT = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN;
const DISCORD = 'https://discord.com/api/v10';

const QUERIES = [
  { id: 'natural', title: 'find sydney plumbers', content: 'find sydney plumbers' },
  { id: 'multi-quoted', title: 'multi-query places', content: 'search "roofer hobart" "roofer launceston"' },
  { id: 'single-name+phone', title: 'single name+phone', content: '"Bond Plumbing" (07)55735253 gold coast' },
  { id: 'single-gbp-url', title: 'single GBP URL', content: 'audit https://maps.app.goo.gl/4q9SShXJEKEMaqGZA' },
];

async function createForumThread(name, content) {
  const r = await fetch(`${DISCORD}/channels/${FORUM}/threads`, {
    method: 'POST',
    headers: { Authorization: `Bot ${BOT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `🧪 listener test · ${name}`, message: { content }, auto_archive_duration: 60 }),
  });
  if (!r.ok) throw new Error(`thread ${name}: ${r.status} ${await r.text()}`);
  return r.json();
}

const created = [];
for (const q of QUERIES) {
  const t = await createForumThread(q.title, q.content);
  created.push({ ...q, thread_id: t.id });
  console.log(`✓ posted "${q.title}" → ${t.id}`);
  await new Promise(r => setTimeout(r, 3000)); // 给 listener 间隔接每个
}

console.log('\n--- waiting 60s for listener routing + dispatcher ---\n');
await new Promise(r => setTimeout(r, 60_000));

import('../../core/tasks/task-store.js').then(async ({ listTasks }) => {
  const all = listTasks({});
  console.log('=== tasks created since test ===');
  for (const c of created) {
    const task = all.find(t => t.source?.thread_id === c.thread_id);
    console.log(`\n[${c.id}] thread ${c.thread_id}`);
    console.log(`  content: "${c.content}"`);
    if (task) {
      console.log(`  task: ${task.task_id} · kind=${task.kind} · status=${task.status} · cli=${task.target?.cli}`);
      console.log(`  provider=${task.routing?.provider || '?'}`);
    } else {
      console.log(`  ⚠ NO task found · listener may have skipped or still processing`);
    }
  }
});
