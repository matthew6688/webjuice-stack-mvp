import fs from 'fs';
import path from 'path';
import { sendDiscordChannelMessage } from '../funnel/discord.js';

export function appendTaskLog(logPath, entry = {}, { now = new Date().toISOString() } = {}) {
  if (!logPath) throw new Error('logPath is required');
  const normalized = {
    at: now,
    event: entry.event || 'task_log',
    stage: entry.stage || '',
    tool: entry.tool || '',
    input: entry.input || '',
    output: entry.output || '',
    evidencePath: entry.evidencePath || '',
    sourceUrl: entry.sourceUrl || '',
    decision: entry.decision || '',
    reason: entry.reason || '',
    nextAction: entry.nextAction || '',
    data: entry.data || {},
  };
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(normalized)}\n`, 'utf8');
  return normalized;
}

export async function mirrorTaskLogToDiscord({
  threadId,
  botToken,
  entry,
  fetchImpl = fetch,
} = {}) {
  if (!threadId || !botToken) return { ok: false, skipped: true, reason: 'missing_thread_or_token' };
  return sendDiscordChannelMessage({
    channelId: threadId,
    botToken,
    fetchImpl,
    payload: buildTaskLogDiscordPayload(entry),
  });
}

export function buildTaskLogDiscordPayload(entry = {}) {
  const title = {
    tool: '工具记录',
    evidence: '证据更新',
    stage: '阶段更新',
    decision: '判断结果',
    error: '需要处理',
  }[entry.event] || '工作日志';
  const lines = [
    `**${title}**`,
    entry.stage ? `阶段：${entry.stage}` : '',
    entry.tool ? `工具：${entry.tool}` : '',
    entry.input ? `输入：${truncate(entry.input, 240)}` : '',
    entry.output ? `输出：${truncate(entry.output, 420)}` : '',
    entry.evidencePath ? `证据：${entry.evidencePath}` : '',
    entry.sourceUrl ? `来源：${entry.sourceUrl}` : '',
    entry.decision ? `判断：${entry.decision}` : '',
    entry.reason ? `原因：${truncate(entry.reason, 420)}` : '',
    entry.nextAction ? `下一步：${entry.nextAction}` : '',
  ].filter(Boolean);
  return {
    username: 'ProfitsLocal Task Log',
    content: lines.join('\n').slice(0, 1900),
    allowed_mentions: { parse: [] },
  };
}

function truncate(value, limit) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
