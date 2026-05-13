#!/usr/bin/env node
/**
 * scripts/cli/pl-task-listener.js · SOP-0 P2.3
 *
 * Long-running Discord gateway listener for #website-tasks forum.
 *  - ProfitsLocal Handoff bot (token in WEBSITE_TASKS_DISCORD_BOT_TOKEN)
 *  - On forum ThreadCreate: extract first message → routeIntent → createTask
 *    → PATCH thread tags [kind, pending] → reply confirm
 *  - On MessageReactionAdd in `human`-tagged threads: ✅ re-trigger / 🗑 give up
 *  - Boot catch-up: scan active threads with no task file → backfill
 *
 * Run (foreground for testing):
 *   node --env-file=.env.local scripts/cli/pl-task-listener.js
 *
 * Run (daemon · P2.4 will write launchd plist):
 *   launchctl bootstrap gui/$UID ai.profitslocal.task-listener.plist
 *
 * SOP-0 §5.2.
 */

import { Client, GatewayIntentBits, Partials, Events, ChannelType } from 'discord.js';
import {
  createTask,
  findByThreadId,
  loadForumTags,
  appliedTagsFor,
  transitionStatus,
  appendProgress,
  readTask,
  KINDS,
} from '../../core/tasks/task-store.js';
import { routeIntent } from '../../core/tasks/intent-router.js';
import { prepareImageTask } from '../../core/tasks/image-task-prep.js';

const TOKEN = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN;
const FORUM_ID = process.env.WEBSITE_TASKS_FORUM_CHANNEL_ID;

if (!TOKEN) { console.error('Missing WEBSITE_TASKS_DISCORD_BOT_TOKEN'); process.exit(2); }
if (!FORUM_ID) { console.error('Missing WEBSITE_TASKS_FORUM_CHANNEL_ID'); process.exit(2); }

const TAGS = loadForumTags();
const DISCORD_API = 'https://discord.com/api/v10';

/* ─── Discord client ──────────────────────────────────────────────── */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  // Partials needed so reactions on uncached old messages still fire
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

/* ─── Helpers ─────────────────────────────────────────────────────── */

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

async function patchThreadTags(threadId, tagIds) {
  const res = await fetch(`${DISCORD_API}/channels/${threadId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'sop0-task-listener',
    },
    body: JSON.stringify({ applied_tags: tagIds }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    log('patchThreadTags failed', res.status, text.slice(0, 200));
  }
  return res.ok;
}

async function postThreadReply(threadId, content) {
  const res = await fetch(`${DISCORD_API}/channels/${threadId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'sop0-task-listener',
    },
    body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    log('postThreadReply failed', res.status, text.slice(0, 200));
    return null;
  }
  const data = await res.json().catch(() => null);
  return data?.id || null;
}

function normalizeAttachments(msg) {
  if (!msg?.attachments) return [];
  return [...msg.attachments.values()].map((a) => ({
    id: a.id,
    filename: a.name,
    url: a.url,
    contentType: a.contentType,
    size: a.size,
  }));
}

/* ─── Core flow: new forum thread → task ──────────────────────────── */

async function handleNewForumThread(thread) {
  if (thread.parentId !== FORUM_ID) return;
  if (findByThreadId(thread.id)) {
    log('skip: task already exists for thread', thread.id);
    return;
  }
  // Fetch the starter message (first post in the forum thread)
  let starter = null;
  try {
    starter = await thread.fetchStarterMessage();
  } catch (err) {
    // forum threads sometimes don't have a fetchable starter immediately; retry once
    await new Promise((r) => setTimeout(r, 1500));
    try { starter = await thread.fetchStarterMessage(); } catch {}
  }
  if (!starter) {
    log('skip: no starter message for thread', thread.id);
    return;
  }
  // Bot-authored threads skipped by default (avoid self-loops). Override with
  // LISTENER_ALLOW_BOTS=1 for E2E smoke tests where we create test threads
  // via a sibling bot token.
  if (starter.author?.bot && process.env.LISTENER_ALLOW_BOTS !== '1') {
    log('skip: starter authored by bot', thread.id, starter.author.username);
    return;
  }

  const text = starter.content || thread.name || '';
  const attachments = normalizeAttachments(starter);
  const hasImage = attachments.some((a) => (a.contentType || '').toLowerCase().startsWith('image/'));

  log('routing thread', thread.id, '·', text.slice(0, 60), hasImage ? `· ${attachments.length} attachment(s)` : '');

  // Immediate "received" reply for image tasks — vision extract takes 20-70s,
  // user would otherwise see silence. Send BEFORE any LLM work.
  if (hasImage) {
    await postThreadReply(thread.id,
      `📥 已收到 · ${attachments.length} 个附件 · 正在路由意图并启动 vision OCR/extract…`);
  }

  const route = await routeIntent({ text, attachments });
  log('route → kind=' + route.kind, 'provider=' + route.provider, 'cli=' + route.target_cli, 'conf=' + route.confidence);

  // SOP-0 P6.X · image-extract prep MUST complete BEFORE createTask, otherwise
  // dispatcher's fs.watch fires immediately on the half-prepared task and spawns
  // pl:ingest-image with empty args → fails before we can patch.
  // (Discovered 2026-05-12 thread 1503742230933012550 race condition.)
  let imagePrep = null;
  if (route.kind === 'image-extract' && hasImage) {
    try {
      imagePrep = await prepareImageTask({ taskId: 'pre-' + thread.id, attachments });
      if (imagePrep.ok) {
        log('image.prep ok · ' + imagePrep.extracted.businessName + ' · ' + imagePrep.extracted.niche + '/' + imagePrep.extracted.city + ' · ' + imagePrep.extracted.latency_ms + 'ms');
        await postThreadReply(thread.id,
          `🔍 OCR/extract 完成 · 用时 ${(imagePrep.extracted.latency_ms / 1000).toFixed(1)}s · 商家="${imagePrep.extracted.businessName}" · ${imagePrep.extracted.niche}/${imagePrep.extracted.city}`);
      } else {
        log('image.prep failed: ' + imagePrep.reason);
        // V3 Bug B fix (2026-05-13 · live E2E found UX gap):
        // When OCR runs but misses niche/city, operator needs to know
        // exactly what's missing and how to fill it in.
        const x = imagePrep.extracted || {};
        const extractedLine = (x.businessName || x.phone || x.address || x.website)
          ? `· OCR 提取到: ${[
              x.businessName && `name="${x.businessName}"`,
              x.phone && `phone=${x.phone}`,
              x.address && `address="${x.address}"`,
              x.website && `web=${x.website}`,
              x.niche && `niche=${x.niche}`,
              x.city && `city=${x.city}`,
            ].filter(Boolean).join(' · ')}`
          : '';
        const missing = [];
        if (!x.niche) missing.push('niche');
        if (!x.city) missing.push('city');
        if (!x.businessName) missing.push('business-name');
        const action = missing.length
          ? `**请补 ${missing.map(m => '`' + m + '`').join(' + ')}**:\n`
            + `1️⃣ 在 thread 里回贴: \`${missing.map(m => m + '=<value>').join(' ')}\`\n`
            + `2️⃣ 然后 react ✅ 让任务重试\n`
            + `(或直接 react 🗑 放弃这条)`
          : `请人工填入需要的字段后 react ✅ 重试`;
        await postThreadReply(thread.id,
          `⚠ 图片识别了 · 但还缺关键信息 · 转人工\n${extractedLine}\n${action}`);
      }
    } catch (err) {
      log('image.prep error', err.message);
      await postThreadReply(thread.id, `⚠ OCR/extract 出错 · ${err.message}`);
      imagePrep = { ok: false, reason: 'exception: ' + err.message };
    }
  }

  // Final args/attachments resolved — NOW create task with ready-to-run target
  const finalArgs = imagePrep?.ok ? imagePrep.args : (route.args || []);
  const finalAttachments = imagePrep?.local_attachments?.length
    ? imagePrep.local_attachments
    : attachments;

  const task = createTask({
    kind: route.kind,
    source: {
      platform:   'discord',
      thread_id:  thread.id,
      author:     starter.author?.username || 'unknown',
      message_id: starter.id,
    },
    input: { text, attachments: finalAttachments },
    target: {
      cli:               route.target_cli,
      args:              finalArgs,
      target_entity_key: route.target_entity_key,
    },
  });
  appendProgress(task.task_id, 'router.resolved',
    `kind=${route.kind} provider=${route.provider} cli=${route.target_cli || 'none'} conf=${route.confidence}`);
  if (imagePrep?.ok) {
    appendProgress(task.task_id, 'image.prep.ok',
      `vision=${imagePrep.extracted.latency_ms}ms · businessName="${imagePrep.extracted.businessName}" · ${imagePrep.extracted.niche}/${imagePrep.extracted.city}`);
  } else if (imagePrep) {
    appendProgress(task.task_id, 'image.prep.failed', imagePrep.reason);
  }

  // Apply forum tags [kind, pending|human]
  let pendingKind = route.kind;
  let pendingStatus = 'pending';
  if (!route.target_cli && route.kind !== 'ops') {
    pendingStatus = 'human';
    appendProgress(task.task_id, 'router.no_cli', `kind=${route.kind} but no target_cli; needs operator triage`);
    transitionStatus(task.task_id, 'human', { reason: 'router resolved kind but no target_cli mapping' });
  }
  if (route.kind === 'image-extract' && hasImage && (!imagePrep || !imagePrep.ok)) {
    pendingStatus = 'human';
    const reason = imagePrep?.reason || 'image prep failed';
    appendProgress(task.task_id, 'image.gate', `→ human · ${reason}`);
    transitionStatus(task.task_id, 'human', { reason: `image-extract prep: ${reason}` });
  }
  const [kindTag, statusTag] = appliedTagsFor(pendingKind, pendingStatus);
  await patchThreadTags(thread.id, [kindTag, statusTag]);

  // Status message reply · V3 D25 (2026-05-13): 人话版 · business-first · 技术细节折叠
  const { renderTaskCreatedMessage } = await import('../../core/discord-tasks/humanize.js');
  const humanRoute = { ...route, args: finalArgs };
  const msgId = await postThreadReply(thread.id, renderTaskCreatedMessage({ task, route: humanRoute }));
  if (msgId) {
    const t = readTask(task.task_id);
    if (t) {
      t.discord.status_message_id = msgId;
      const fs = await import('node:fs');
      const path = await import('node:path');
      // direct atomic write via task-store would be cleaner, but writeTask validates and
      // bumps updated_at — that's fine here.
      const { writeTask } = await import('../../core/tasks/task-store.js');
      writeTask(t);
    }
  }
  log('task', task.task_id, 'created · status=', pendingStatus);
}

/* ─── Reaction handler: ✅ retry / 🗑 abandon for `human`-tagged threads ─ */

async function handleReaction(reaction, user, type) {
  if (user.bot) return;
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  const channel = reaction.message?.channel;
  if (!channel || !channel.parentId || channel.parentId !== FORUM_ID) return;
  const threadId = channel.id;
  const task = findByThreadId(threadId);
  const emoji = reaction.emoji.name;
  // Always log incoming reactions for diagnostics — silent-ignore was confusing
  // operators who didn't know if their emoji even reached the listener.
  log('reaction', type, emoji, '· user=' + user.username, '· thread=' + threadId,
      '· task=' + (task?.task_id || 'NONE'),
      '· status=' + (task?.status || 'NONE'));
  if (!task) return;
  if (task.status !== 'human') {
    // Reactions on non-human tasks ignored intentionally (avoid retriggering
    // expensive ops). Post one-line note so operator knows we saw the click.
    await postThreadReply(threadId,
      `_(已记录表情 ${emoji}，但任务当前状态为 \`${task.status}\` — 仅 \`human\` 状态的任务接受 ✅/❌ 重试/放弃。如需操作 \`done\`/\`failed\` 任务，请使用后台 /tasks 页面。)_`);
    return;
  }
  // Accept multiple emoji synonyms — operator on mobile/desktop varies.
  // RETRY: ✅ ✔ ✔️ 🔁 🔄
  // ABANDON: 🗑 🗑️ ❌ ✖ ✖️ 🚫
  const RETRY = new Set(['✅', '✔', '✔️', '🔁', '🔄']);
  const ABANDON = new Set(['🗑', '🗑️', '❌', '✖', '✖️', '🚫']);
  if (RETRY.has(emoji)) {
    transitionStatus(task.task_id, 'pending', { reason: `retry by ${user.username}` });
    appendProgress(task.task_id, 'operator.retry', `${user.username} requested retry via ${emoji}`);
    const [kindTag, statusTag] = appliedTagsFor(task.kind, 'pending');
    await patchThreadTags(threadId, [kindTag, statusTag]);
    await postThreadReply(threadId, `🔁 ${user.username} 请求重试任务 · 状态已切换为 \`pending\` (通过 ${emoji})`);
  } else if (ABANDON.has(emoji)) {
    transitionStatus(task.task_id, 'done', { reason: `abandoned by ${user.username}` });
    appendProgress(task.task_id, 'operator.abandon', `${user.username} marked task done via ${emoji}`);
    const [kindTag, statusTag] = appliedTagsFor(task.kind, 'done');
    await patchThreadTags(threadId, [kindTag, statusTag]);
    await postThreadReply(threadId, `🗑 ${user.username} 已放弃任务 · 状态已切换为 \`done\` (通过 ${emoji})`);
  }
  // Other emojis silently ignored (operator can use any non-mapped emoji as bookmark).
}

/* ─── Boot catch-up: backfill missed threads ──────────────────────── */

async function catchUp() {
  log('boot catch-up: scanning active forum threads…');
  let channel;
  try {
    channel = await client.channels.fetch(FORUM_ID);
  } catch (err) {
    log('catch-up: failed to fetch forum channel', err.message);
    return;
  }
  if (!channel || channel.type !== ChannelType.GuildForum) {
    log('catch-up: channel is not a forum', channel?.type);
    return;
  }
  const fetched = await channel.threads.fetchActive().catch((err) => {
    log('catch-up: fetchActive failed', err.message); return null;
  });
  if (!fetched) return;
  let backfilled = 0;
  for (const [, thread] of fetched.threads) {
    if (findByThreadId(thread.id)) continue;
    log('catch-up: backfilling thread', thread.id, thread.name);
    try {
      await handleNewForumThread(thread);
      backfilled++;
    } catch (err) {
      log('catch-up: backfill error', thread.id, err.message);
    }
  }
  log(`catch-up complete · backfilled=${backfilled}`);
}

/* ─── Wire events ─────────────────────────────────────────────────── */

client.once(Events.ClientReady, async (c) => {
  log(`logged in as ${c.user.tag} · listening forum ${FORUM_ID}`);
  await catchUp();
});

client.on(Events.ThreadCreate, async (thread) => {
  try {
    await handleNewForumThread(thread);
  } catch (err) {
    log('ThreadCreate handler error', err.message);
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try { await handleReaction(reaction, user, 'add'); }
  catch (err) { log('MessageReactionAdd error', err.message); }
});

client.on('error', (err) => log('client error', err.message));
client.on('warn', (msg) => log('client warn', msg));

process.on('SIGTERM', () => { log('SIGTERM · disconnecting'); client.destroy(); process.exit(0); });
process.on('SIGINT',  () => { log('SIGINT · disconnecting');  client.destroy(); process.exit(0); });

/* ─── Boot ────────────────────────────────────────────────────────── */

client.login(TOKEN).catch((err) => {
  console.error('login failed:', err.message);
  process.exit(1);
});
