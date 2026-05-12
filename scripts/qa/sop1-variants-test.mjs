#!/usr/bin/env node
/**
 * SOP-1 入口变体覆盖测试 · 跑之前没测过的输入形式
 *
 * Cases:
 *   places-multi      places-api 多 query 形式
 *   single-phone      single-enrich 纯电话
 *   single-url        single-enrich Google Maps URL
 *   single-chained    single-enrich 链式 audit (默认 chain)
 *   image-card        ingest-image 完整流程
 *
 * 每个 case 关联同一 Discord demo thread (variants test).
 * 控制台 + Discord 双输出.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createTask, readTask, listTasks } from '../../core/tasks/task-store.js';

const G='\x1b[32m', C='\x1b[36m', Y='\x1b[33m', R='\x1b[31m', D='\x1b[2m', X='\x1b[0m';
const FORUM = process.env.WEBSITE_TASKS_FORUM_CHANNEL_ID;
const BOT = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN;
if (!FORUM || !BOT) { console.error('missing env'); process.exit(1); }

const DISCORD = 'https://discord.com/api/v10';

async function createForumThread(name, content) {
  const r = await fetch(`${DISCORD}/channels/${FORUM}/threads`, {
    method: 'POST', headers: { Authorization: `Bot ${BOT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, message: { content }, auto_archive_duration: 60 }),
  });
  if (!r.ok) throw new Error(`thread create ${r.status}: ${await r.text()}`);
  return r.json();
}

async function postToThread(threadId, content) {
  const r = await fetch(`${DISCORD}/channels/${threadId}/messages`, {
    method: 'POST', headers: { Authorization: `Bot ${BOT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!r.ok) console.error(`post ${r.status}: ${(await r.text()).slice(0,200)}`);
}

const demoStamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
const thread = await createForumThread(
  `🧪 SOP-1 变体覆盖 · ${demoStamp}`,
  `# SOP-1 入口变体覆盖测试\n\n之前没测过的形式 · 5 case (places multi-query / single phone / single URL / single chained audit / image)\n\nadmin: https://tasks.profitslocal.com/admin/tasks`,
);
const threadId = thread.id;
const threadUrl = `https://discord.com/channels/${thread.guild_id}/${threadId}`;
console.log(`${G}✓${X} thread: ${threadUrl}\n`);

const CASES = [
  {
    id: 'places-multi',
    label: 'places-api · 多 query (cafe brisbane + cafe gold coast)',
    spec: () => ({
      kind: 'places-intake',
      source: { platform: 'discord', author: 'sop1-variants', thread_id: threadId, message_id: null },
      input: { text: 'variant: places multi-query', attachments: [] },
      target: {
        cli: 'pl:places-search-intake',
        args: ['--query', '"cafe brisbane"', '--query', '"cafe gold coast"', '--limit', '2'],
        timeout_ms: 120_000,
      },
    }),
    timeout: 120_000,
  },
  {
    id: 'single-phone',
    label: 'single-enrich · 纯电话',
    spec: () => ({
      kind: 'single-enrich',
      source: { platform: 'discord', author: 'sop1-variants', thread_id: threadId, message_id: null },
      input: { text: 'variant: phone only · 0731717777', attachments: [] },
      target: {
        cli: 'pl:single-enrich',
        args: ['--phone', '0731717777', '--no-chain'],
        timeout_ms: 60_000,
      },
    }),
    timeout: 60_000,
  },
  {
    id: 'single-url',
    label: 'single-enrich · Google Maps URL',
    spec: () => ({
      kind: 'single-enrich',
      source: { platform: 'discord', author: 'sop1-variants', thread_id: threadId, message_id: null },
      input: { text: 'variant: gbp url', attachments: [] },
      target: {
        cli: 'pl:single-enrich',
        args: ['--gbp-url', 'https://maps.google.com/?cid=12834419530488693862', '--no-chain'],
        timeout_ms: 60_000,
      },
    }),
    timeout: 60_000,
  },
  {
    id: 'single-chained',
    label: 'single-enrich · 链式 audit (默认 chain)',
    spec: () => ({
      kind: 'single-enrich',
      source: { platform: 'discord', author: 'sop1-variants', thread_id: threadId, message_id: null },
      input: { text: 'variant: chained audit', attachments: [] },
      target: {
        cli: 'pl:single-enrich',
        args: ['--business-name', 'Bond Plumbing', '--city', 'gold-coast', '--niche', 'plumber'],
        // 不加 --no-chain · 默认会 chain audit
        timeout_ms: 90_000,
      },
    }),
    timeout: 90_000,
  },
  {
    id: 'image-card',
    label: 'image · 完整流程 (real image file)',
    spec: () => {
      // 用一张本地真图测路径 · G-6.1 OCR 未做 · 操作员仍填字段
      const imagePath = path.resolve('clients/dicki-s-new-farm/audit/current-site-desktop.png');
      return {
        kind: 'image-extract',
        source: { platform: 'discord', author: 'sop1-variants', thread_id: threadId, message_id: null },
        input: { text: 'variant: image (G-6.1 manual fields)', attachments: [] },
        target: {
          cli: 'pl:ingest-image',
          args: [
            '--image', imagePath,
            '--business-name', 'Dicki\'s New Farm',
            '--phone', '0731717777',
            '--niche', 'restaurant',
            '--city', 'brisbane',
          ],
          timeout_ms: 60_000,
        },
      };
    },
    timeout: 60_000,
  },
];

const ONLY = process.argv.slice(2).includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const filtered = ONLY ? CASES.filter(c => c.id === ONLY) : CASES;

async function waitTask(id, timeoutMs, label) {
  const start = Date.now();
  let lastStatus = null;
  while (Date.now() - start < timeoutMs) {
    const t = readTask(id);
    if (!t) return null;
    if (t.status !== lastStatus) {
      console.log(`  ${D}${new Date().toISOString().slice(11, 19)}${X} ${label} · ${C}${t.status}${X}`);
      lastStatus = t.status;
    }
    if (['done', 'failed'].includes(t.status)) return t;
    await new Promise(r => setTimeout(r, 3000));
  }
  return readTask(id);
}

await postToThread(threadId, `## 开跑 · ${filtered.length} 个变体`);

const summary = [];

for (const c of filtered) {
  console.log(`\n${C}▶ ${c.label}${X}`);
  await postToThread(threadId, `---\n### 🎯 ${c.label}`);
  const task = createTask(c.spec());
  console.log(`  ${G}✓${X} task ${task.task_id}`);
  await postToThread(threadId, `📥 \`${task.task_id}\` · args=\`${c.spec().target.args.join(' ')}\``);

  const final = await waitTask(task.task_id, c.timeout, c.id);
  const status = final?.status || 'timeout';
  const dur = Math.round((final?.duration_ms || 0) / 1000);
  const emoji = status === 'done' ? '✅' : status === 'failed' ? '❌' : '⚠️';
  const tail = final?.progress?.slice(-3).map(p =>
    `· ${(p.at||'').slice(11, 19)} ${p.step||p.event} ${(p.detail||p.message||'').slice(0, 80)}`
  ).join('\n') || '(no progress)';
  await postToThread(threadId, `${emoji} \`${status}\` · 用时 ${dur}s\n\`\`\`\n${tail}\n\`\`\``);

  // chained?
  const chained = listTasks({}).filter(t =>
    t.task_id !== task.task_id && t.source?.author?.includes('auto-chain') &&
    new Date(t.created_at) > new Date(task.created_at)
  );
  let chainResult = null;
  if (chained.length > 0) {
    await postToThread(threadId, `🔗 链式: ${chained.map(t => `\`${t.task_id}\` (${t.kind})`).join(' · ')}`);
    chainResult = await waitTask(chained[0].task_id, 600_000, `${c.id}.chain`);
    if (chainResult) {
      const e2 = chainResult.status === 'done' ? '✅' : '❌';
      await postToThread(threadId, `${e2} chained ${chainResult.kind} → \`${chainResult.status}\` · ${Math.round((chainResult.duration_ms||0)/1000)}s`);
    }
  }
  summary.push({ id: c.id, status, dur, chained: chained.length, chain_status: chainResult?.status });
}

await postToThread(threadId, `---\n## ✅ 变体测试完成\n\n${summary.map(s => `· **${s.id}**: ${s.status} (${s.dur}s)${s.chained?` + chain ${s.chain_status}`:''}`).join('\n')}`);

console.log(`\n${G}✓ done${X}`);
console.log(`thread: ${threadUrl}`);
console.log(`summary:`); for(const s of summary) console.log(' ', s.id, '→', s.status, s.dur+'s', s.chained?`+chain:${s.chain_status}`:'');
