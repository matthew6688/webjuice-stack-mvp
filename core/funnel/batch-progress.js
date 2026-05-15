/**
 * V3 cycle-26 · Batch progress emitter.
 *
 * Posts per-entity progress lines to the parent #lead-discovery-runs batch
 * thread so operator can see every lead's journey in one place (instead of
 * opening 5 #website-leads threads).
 *
 * Usage:
 *   await emitBatchProgress(entityKey, { event: 'thread_opened', title, threadUrl });
 *   await emitBatchProgress(entityKey, { event: 'phase_change', from, to });
 *   await emitBatchProgress(entityKey, { event: 'published', deployUrl });
 *   await emitBatchProgress(entityKey, { event: 'archived', reason });
 *
 * Looks up entity.batches[-1] → batch thread_id via pipeline-batch-thread.
 * No-op (silent) if entity not in a batch or batch state missing.
 */
import fs from 'node:fs';
import path from 'node:path';

const DISCORD_API = 'https://discord.com/api/v10';

function botToken() {
  return process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
}

function readEntity(entityKey, storeRoot = 'data/leads') {
  const p = path.join(storeRoot, 'entities', `${entityKey}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function readBatchState(batchId) {
  const p = path.join('data/v2/pipeline-batches', `${batchId}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const EMOJI = {
  thread_opened: '🆕',
  phase_change:  '🔄',
  graded:        '🎯',
  qualification_pass: '✅',
  qualification_fail: '⚠️',
  built:         '🛠️',
  published:     '🚀',
  archived:      '🗄️',
};

export function lineFor(entity, event, payload = {}) {
  const name = entity?.latest?.name || entity?.entityKey || '?';
  const threadUrl = entity?.discord_thread_id
    ? `https://discord.com/channels/${process.env.DISCORD_GUILD_ID || '1493925728570310756'}/${entity.discord_thread_id}`
    : null;
  const nameLink = threadUrl ? `[${name}](${threadUrl})` : `**${name}**`;
  const emoji = EMOJI[event] || 'ℹ️';
  switch (event) {
    case 'thread_opened':       return `${emoji} ${nameLink} · #website-leads thread opened`;
    case 'phase_change':        return `${emoji} ${nameLink} · phase: \`${payload.from || 'awaiting'}\` → \`${payload.to || 'awaiting'}\``;
    case 'graded':              return `${emoji} ${nameLink} · grade: **${payload.grade || '?'}**${payload.score != null ? ` · audit ${payload.score}/100` : ''}`;
    case 'qualification_pass':  return `${emoji} ${nameLink} · 资格复核 PASS · 总分 ${payload.score || '?'}/100 → ready-to-build`;
    case 'qualification_fail':  return `${emoji} ${nameLink} · 资格复核 FAIL · 总分 ${payload.score || '?'}/100 → qa-pending (operator 补字段)`;
    case 'built':               return `${emoji} ${nameLink} · demo built (Stage 8)`;
    case 'published':           return `${emoji} ${nameLink} · published · ${payload.deployUrl || '?'}`;
    case 'archived':            return `${emoji} ${nameLink} · archived (D-grade) · ${payload.reason || ''}`;
    default:                    return `${emoji} ${nameLink} · ${event}`;
  }
}

/**
 * Post a progress line to the entity's batch thread.
 * @param {string} entityKey
 * @param {{event: string, [k: string]: any}} payload
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function emitBatchProgress(entityKey, payload = {}) {
  if (!entityKey || !payload?.event) return { ok: false, reason: 'missing args' };
  const entity = readEntity(entityKey);
  if (!entity) return { ok: false, reason: 'entity_not_found' };
  const batches = Array.isArray(entity.batches) ? entity.batches : [];
  const batchId = batches[batches.length - 1];
  if (!batchId) return { ok: true, skipped: 'no_batch' };
  const state = readBatchState(batchId);
  if (!state?.thread_id) return { ok: true, skipped: 'no_batch_thread' };

  const content = lineFor(entity, payload.event, payload);
  try {
    const r = await fetch(`${DISCORD_API}/channels/${state.thread_id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken()}`,
        'Content-Type': 'application/json',
        'User-Agent': 'profitslocal-batch-progress',
      },
      body: JSON.stringify({ content }),
    });
    if (!r.ok) return { ok: false, reason: `discord_${r.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
