/**
 * core/funnel/discord-emit.js · V3 D43 (2026-05-14)
 *
 * Unified Discord notification + audit log emitter.
 *
 * Per Matthew (2026-05-14):
 *   "我希望所有的阶段转接，流转discord都有记录和notification，如果不能
 *    update 对对应的thread，或者没有thread，请更新到bot-log channel"
 *
 * Contract:
 *   1. Every stage/phase/status transition calls emitDiscord(...)
 *   2. emitDiscord tries: explicit threadId > entityKey-resolved thread > channelId
 *   3. On any post failure OR no target → fall back to bot-log channel
 *   4. ALWAYS append a structured event to data/heartbeats/discord-events.jsonl
 *      (auditable trail · cron can pick up gaps)
 *
 * Exported helpers:
 *   · emitDiscord(opts)                             — generic
 *   · emitPhaseTransition(entity, fromPhase, toPhase, note?)
 *   · emitTaskTransition(task, fromStatus, toStatus, reason?)
 *   · emitGenericEvent(event, summary, context?)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const BOT_LOG_CHANNEL_ID = '1493926218574200942';
const DISCORD_API = 'https://discord.com/api/v10';

function botToken() {
  return process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
}

function botLogChannel() {
  return process.env.BOT_LOG_DISCORD_CHANNEL_ID || BOT_LOG_CHANNEL_ID;
}

function appendEventLog(entry) {
  try {
    const dir = path.join(REPO, 'data/heartbeats');
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(path.join(dir, 'discord-events.jsonl'), line);
  } catch { /* never throw from logger */ }
}

async function postRaw(channelOrThreadId, content) {
  const tok = botToken();
  if (!tok || !channelOrThreadId) {
    return { ok: false, status: 0, error: tok ? 'no_target' : 'no_token' };
  }
  try {
    const r = await fetch(`${DISCORD_API}/channels/${channelOrThreadId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${tok}`,
        'Content-Type': 'application/json',
        'User-Agent': 'profitslocal-discord-emit',
      },
      body: JSON.stringify({ content: String(content).slice(0, 2000) }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return { ok: false, status: r.status, error: text.slice(0, 200) };
    }
    const data = await r.json().catch(() => null);
    return { ok: true, status: r.status, message_id: data?.id || null };
  } catch (err) {
    return { ok: false, status: 0, error: err.message?.slice(0, 200) };
  }
}

function lookupEntity(entityKey) {
  if (!entityKey) return null;
  try {
    const p = path.join(REPO, 'data/leads/entities', `${entityKey}.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return null; }
}

/**
 * Generic emit · the workhorse.
 *
 * @param {object} opts
 * @param {string?} opts.threadId      · explicit thread to post to (highest priority)
 * @param {string?} opts.channelId     · explicit channel (fallback before bot-log)
 * @param {string?} opts.entityKey     · resolve thread from entity.discord_thread_id
 * @param {string}  opts.content       · message body (required)
 * @param {string}  opts.event         · structured event name (e.g. 'phase.transition')
 * @param {object?} opts.context       · arbitrary metadata for audit log
 * @returns {Promise<{ok, target, fallback, message_id?, error?}>}
 */
export async function emitDiscord({ threadId, channelId, entityKey, content, event, context = {} } = {}) {
  if (!content) {
    appendEventLog({ event, ok: false, error: 'no_content', context });
    return { ok: false, error: 'no_content' };
  }

  // Resolve target precedence
  const entity = entityKey ? lookupEntity(entityKey) : null;
  const entityName = entity?.latest?.name || entityKey || null;
  const entityThread = entity?.discord_thread_id || entity?.project_thread_id || null;
  const primary = threadId || entityThread || channelId || null;

  let result = null;
  if (primary) {
    result = await postRaw(primary, content);
    if (result.ok) {
      appendEventLog({
        event, ok: true, target: primary, target_type: threadId ? 'thread' : entityThread ? 'entity-thread' : 'channel',
        entityKey, entityName, message_id: result.message_id, context,
      });
      return { ok: true, target: primary, fallback: null, message_id: result.message_id };
    }
  }

  // Fallback to bot-log (with context prefix so operator knows where it came from)
  const botLogCid = botLogChannel();
  const prefix = primary
    ? `_(fallback · target ${primary} failed: ${result?.error || 'no target'})_\n`
    : `_(fallback · no thread for entity ${entityName || entityKey || '?'})_\n`;
  const botLogContent = prefix + content;
  const botLogResult = await postRaw(botLogCid, botLogContent);

  appendEventLog({
    event, ok: botLogResult.ok, target: botLogCid, target_type: 'bot-log',
    fallback_reason: primary ? `target_failed_${result?.status}` : 'no_target',
    entityKey, entityName,
    primary_attempt: primary ? { target: primary, error: result?.error } : null,
    message_id: botLogResult.message_id, context,
  });

  return {
    ok: botLogResult.ok,
    target: botLogCid,
    fallback: 'bot-log',
    message_id: botLogResult.message_id,
    error: botLogResult.ok ? null : botLogResult.error,
  };
}

/** Phase transition · entity flow (e.g. awaiting → design-ready → qa-pending → ready-to-build → archived) */
export async function emitPhaseTransition(entity, fromPhase, toPhase, note = '') {
  const name = entity?.latest?.name || entity?.entityKey || '(unknown)';
  const noteSuffix = note ? ` · ${note}` : '';
  const content = `🔄 **${name}** · phase: \`${fromPhase || '(none)'}\` → \`${toPhase}\`${noteSuffix}`;
  return emitDiscord({
    entityKey: entity?.entityKey,
    content,
    event: 'phase.transition',
    context: { from: fromPhase, to: toPhase, note },
  });
}

/** Task lifecycle transition · pending → running / done / failed / human */
export async function emitTaskTransition(task, fromStatus, toStatus, reason = '') {
  const kindLabel = {
    'places-intake':   '🔎 精准搜客户',
    'intake':          '⚙️ 后台任务',
    'single-enrich':   '🎯 查 1 个具体客户',
    'image-extract':   '🖼 图片识别',
    'audit':           '🔬 客户网站审计',
    'ops':             '⚙️ 系统任务',
  }[task.kind] || `📋 ${task.kind}`;
  const reasonSuffix = reason ? ` · ${reason}` : '';
  const content = `${kindLabel} · status: \`${fromStatus || '?'}\` → \`${toStatus}\`${reasonSuffix}`;
  return emitDiscord({
    threadId: task.source?.thread_id || task.discord?.thread_id,
    entityKey: task.target?.target_entity_key,
    content,
    event: 'task.transition',
    context: { task_id: task.task_id, kind: task.kind, from: fromStatus, to: toStatus, reason },
  });
}

/** Generic event · for cross-channel migrations / errors / publishes etc */
export async function emitGenericEvent(event, summary, { entityKey, threadId, channelId, ...context } = {}) {
  return emitDiscord({
    threadId,
    channelId,
    entityKey,
    content: summary,
    event,
    context,
  });
}
