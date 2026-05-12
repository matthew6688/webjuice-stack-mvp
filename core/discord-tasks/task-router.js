/**
 * ⚠ DEPRECATED for new Discord-to-task routing (2026-05-12).
 *
 * SOP-0 Task System supersedes this module's routeWebsiteTaskMessage and
 * persistAndMaybeDispatchWebsiteTask functions:
 *   - New entry: post in #website-tasks forum (channel 1503702990761099419)
 *   - New listener: scripts/cli/pl-task-listener.js (discord.js gateway)
 *   - New router:  core/tasks/intent-router.js (ollama → regex)
 *   - New store:   core/tasks/task-store.js → data/tasks/<id>.json
 *
 * Kept (not deleted) because still imported by legacy scripts:
 *   - scripts/discord/route-website-task.js (manual CLI shim)
 *   - scripts/discord/test-website-task-router.js (legacy test)
 *   - scripts/leads/image-lead-discovery.js indirectly via task-log
 *
 * For NEW work, use `core/tasks/task-store.js#createTask({...})` directly.
 * See docs/SOP_0_TASK_SYSTEM.md §0-§4.
 */

import fs from 'fs';
import path from 'path';
import {
  createDiscordThreadFromMessage,
  sendDiscordChannelMessage,
  sendDiscordThreadedMessage,
} from '../funnel/discord.js';

export const WEBSITE_TASK_CHANNEL_ENV = 'WEBSITE_TASKS_DISCORD_CHANNEL_ID';

export function routeWebsiteTaskMessage({
  message,
  channelId = '',
  now = new Date().toISOString(),
  dataRoot = path.join('data', 'discord-tasks'),
} = {}) {
  const normalized = normalizeDiscordMessage(message, channelId);
  const intent = classifyWebsiteTask(normalized);
  const taskId = buildTaskId(normalized, intent);
  const taskDir = path.join(dataRoot, taskId);
  const taskPath = path.join(taskDir, 'task.json');
  const logPath = path.join(taskDir, 'task-log.jsonl');
  const threadName = buildThreadName({ taskId, intent, message: normalized });
  const task = {
    schemaVersion: 1,
    taskId,
    createdAt: now,
    updatedAt: now,
    source: {
      platform: 'discord',
      channelName: 'website-task',
      channelId: normalized.channelId,
      messageId: normalized.messageId,
      messageUrl: normalized.messageUrl,
      authorId: normalized.authorId,
      authorName: normalized.authorName,
    },
    rawText: normalized.content,
    attachments: normalized.attachments,
    intent,
    thread: {
      name: threadName,
      id: normalized.threadId,
      url: normalized.threadUrl,
      status: normalized.threadId ? 'existing' : 'pending',
    },
    artifacts: {
      taskPath,
      logPath,
      expectedClientRoot: intent.clientSlug ? `clients/${intent.clientSlug}` : '',
    },
    nextAction: intent.nextAction,
  };
  return { task, taskDir, taskPath, logPath, threadName, initialPayload: buildTaskIntakePayload(task) };
}

export async function persistAndMaybeDispatchWebsiteTask({
  message,
  channelId = process.env[WEBSITE_TASK_CHANNEL_ENV] || '',
  botToken = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '',
  dataRoot = path.join('data', 'discord-tasks'),
  send = false,
  fetchImpl = fetch,
  now = new Date().toISOString(),
} = {}) {
  const routed = routeWebsiteTaskMessage({ message, channelId, dataRoot, now });
  fs.mkdirSync(routed.taskDir, { recursive: true });
  writeJson(routed.taskPath, routed.task);

  let discord = { ok: true, dryRun: true };
  if (send) {
    if (!botToken) throw new Error('Missing WEBSITE_TASKS_DISCORD_BOT_TOKEN or DISCORD_BOT_TOKEN');
    discord = await dispatchTaskToDiscordThread({
      task: routed.task,
      payload: routed.initialPayload,
      channelId,
      botToken,
      fetchImpl,
    });
    routed.task.thread = {
      ...routed.task.thread,
      id: discord.threadId || routed.task.thread.id,
      url: discord.threadUrl || routed.task.thread.url,
      status: discord.threadId ? 'ready' : 'pending',
      messageId: discord.threadMessageId || discord.messageId || '',
    };
    routed.task.updatedAt = now;
    writeJson(routed.taskPath, routed.task);
  }

  return {
    ok: true,
    dryRun: !send,
    task: routed.task,
    taskPath: routed.taskPath,
    logPath: routed.logPath,
    initialPayload: routed.initialPayload,
    discord,
  };
}

export async function dispatchTaskToDiscordThread({
  task,
  payload,
  channelId,
  botToken,
  fetchImpl = fetch,
} = {}) {
  const sourceMessageId = task?.source?.messageId || '';
  const sourceChannelId = task?.source?.channelId || channelId;
  const existingThreadId = task?.thread?.id || '';
  if (existingThreadId) {
    const posted = await sendDiscordChannelMessage({
      channelId: existingThreadId,
      botToken,
      payload,
      fetchImpl,
    });
    return {
      ...posted,
      threadId: existingThreadId,
      threadUrl: task.thread.url || posted.messageUrl,
      threadReused: true,
    };
  }
  if (sourceMessageId && sourceChannelId) {
    const thread = await createDiscordThreadFromMessage({
      fetchImpl,
      botToken,
      channelId: sourceChannelId,
      messageId: sourceMessageId,
      threadName: task.thread.name,
    });
    if (!thread.ok) {
      throw new Error(`Discord task thread creation failed: ${thread.status || ''} ${thread.error || 'thread_create_failed'}`.trim());
    }
    const posted = await sendDiscordChannelMessage({
      channelId: thread.threadId,
      botToken,
      payload,
      fetchImpl,
    });
    return {
      ...posted,
      threadId: thread.threadId,
      threadUrl: thread.threadUrl,
      threadName: task.thread.name,
      threadCreatedByBot: true,
      threadMessageId: posted.messageId,
      threadMessageUrl: posted.messageUrl,
    };
  }
  return sendDiscordThreadedMessage({
    channelId,
    botToken,
    payload,
    threadName: task.thread.name,
    fetchImpl,
  });
}

export function buildTaskIntakePayload(task) {
  const intent = task.intent || {};
  const lines = [
    `任务已接收：${intent.label}`,
    '',
    `来源：#website-task / ${task.source?.messageId || 'manual'}`,
    `任务 ID：${task.taskId}`,
    `将使用流程：${intent.workflowLabel}`,
    `关联能力：${intent.skills.join(' + ')}`,
    `下一步：${intent.nextAction}`,
    '',
    '我会把每一步工具调用、证据、判断理由写回这个 thread，并同步到 repo/admin。',
    '',
    `task: ${task.artifacts?.taskPath || ''}`,
    `log: ${task.artifacts?.logPath || ''}`,
  ];
  return {
    username: 'ProfitsLocal Task Router',
    content: lines.join('\n').slice(0, 1900),
    allowed_mentions: { parse: [] },
  };
}

export function classifyWebsiteTask(message) {
  const text = String(message.content || '').trim();
  const lower = text.toLowerCase();
  const urls = extractUrls(text);
  const imageAttachments = (message.attachments || []).filter(isImageAttachment);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(text);
  const hasLeadLanguage = /(lead|leads|客户|线索|潜在客户|google\s*search|谷歌|搜索|scrape|roof|roofer|plumber|hvac|dentist|salon|law firm|photographer)/i.test(text);
  const hasAuditLanguage = /(audit|seo|redesign|官网|网站|current site|existing site|现有网站|改版)/i.test(text);
  const hasProjectLanguage = /(open design|demo|repo|github|revision|publish|dev|live|设计|修改|项目)/i.test(text);

  if (imageAttachments.length || (/图片|照片|招牌|名片|截图|image|photo/i.test(text) && hasPhone)) {
    return {
      kind: 'image_lead_discovery',
      label: '图片线索识别',
      workflow: 'image-lead-discovery',
      workflowLabel: '图片/OCR 线索 discovery -> lead-ops -> admin stage',
      skills: ['image-lead-discovery', 'lead-ops'],
      priority: 'lead',
      clientSlug: inferClientSlug(text),
      nextAction: '读取图片/OCR文字，搜索电话/商家信息，保存证据，再判断跳过、需人工或可做 Mockup。',
      confidence: imageAttachments.length ? 0.92 : 0.78,
    };
  }
  if (hasLeadLanguage && /(google\s*search|谷歌|搜索|scrape|find|找|discovery)/i.test(text)) {
    return {
      kind: 'lead_search_discovery',
      label: '批量线索搜索',
      workflow: 'lead-search-discovery',
      workflowLabel: 'Google/地图线索搜索 -> qualification -> lead-ops',
      skills: ['lead-ops'],
      priority: 'lead',
      clientSlug: '',
      nextAction: '按行业和城市做小批量 discovery，筛掉不可联系/无突破口的 lead，把可推进对象写入 admin。',
      confidence: 0.86,
    };
  }
  if (urls.length && hasAuditLanguage) {
    return {
      kind: 'site_audit',
      label: '现有网站 Audit',
      workflow: 'site-audit',
      workflowLabel: '网站抓取 + SEO audit + redesign 判断',
      skills: ['site-audit', 'seo-audit', 'lead-ops'],
      priority: 'lead',
      clientSlug: inferClientSlug(urls[0]),
      nextAction: '抓取官网截图/文本/SEO，按分数判断跳过、需人工或可做 Mockup。',
      confidence: 0.9,
    };
  }
  if (hasProjectLanguage) {
    return {
      kind: 'website_project_task',
      label: '网站项目任务',
      workflow: 'website-agent-handoff',
      workflowLabel: '读取 case/task/open-design 绑定，继续项目执行',
      skills: ['huashu-design', 'open-design', 'design-review'],
      priority: 'project',
      clientSlug: inferClientSlug(text),
      nextAction: '定位 case、repo、Open Design project，然后在同一个工作线程里推进修改和 QA。',
      confidence: 0.74,
    };
  }
  return {
    kind: 'general_website_task',
    label: '普通网站任务',
    workflow: 'manual-triage',
    workflowLabel: '人工/AI 分类后再选择具体流程',
    skills: ['lead-ops'],
    priority: 'triage',
    clientSlug: inferClientSlug(text),
    nextAction: '先澄清任务目标，再决定进入 lead discovery、site audit、mockup 或项目修改。',
    confidence: 0.52,
  };
}

export function normalizeDiscordMessage(message = {}, fallbackChannelId = '') {
  const channelId = message.channel_id || message.channelId || fallbackChannelId || '';
  const guildId = message.guild_id || message.guildId || '';
  const messageId = message.id || message.messageId || '';
  const threadId = message.thread?.id || message.threadId || '';
  return {
    channelId,
    guildId,
    messageId,
    messageUrl: guildId && channelId && messageId ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}` : '',
    threadId,
    threadUrl: guildId && threadId ? `https://discord.com/channels/${guildId}/${threadId}` : '',
    authorId: message.author?.id || message.authorId || '',
    authorName: message.author?.username || message.authorName || '',
    content: message.content || '',
    attachments: (message.attachments || []).map((attachment) => ({
      id: attachment.id || '',
      filename: attachment.filename || attachment.name || '',
      url: attachment.url || '',
      contentType: attachment.content_type || attachment.contentType || '',
      size: attachment.size || 0,
    })),
  };
}

export function buildThreadName({ taskId, intent, message }) {
  const prefix = {
    image_lead_discovery: 'lead-img',
    lead_search_discovery: 'lead-search',
    site_audit: 'site-audit',
    website_project_task: 'project',
    general_website_task: 'task',
  }[intent.kind] || 'task';
  const hint = intent.clientSlug || inferClientSlug(message.content) || taskId;
  return `${prefix}-${hint}`.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

function buildTaskId(message, intent) {
  const base = message.messageId || `${Date.now()}`;
  const hint = intent.clientSlug || inferClientSlug(message.content) || intent.kind || 'task';
  return `${slugify(hint)}-${String(base).slice(-8)}`;
}

function inferClientSlug(value) {
  const text = String(value || '');
  const url = extractUrls(text)[0] || '';
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return slugify(host.split('.')[0]);
    } catch {
      return '';
    }
  }
  const businessLine = text.split(/\r?\n/).map((line) => line.trim()).find((line) => (
    line.length >= 3
    && line.length <= 70
    && !/(call|phone|email|http|www|搜索|google|找|帮我|please|请)/i.test(line)
  ));
  return slugify(businessLine || '');
}

function isImageAttachment(attachment) {
  const type = String(attachment.contentType || attachment.content_type || '').toLowerCase();
  const filename = String(attachment.filename || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic)$/i.test(filename);
}

function extractUrls(value) {
  return [...String(value || '').matchAll(/https?:\/\/[^\s)]+/g)].map((match) => match[0]);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
