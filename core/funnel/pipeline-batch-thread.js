/**
 * Pipeline batch thread — manages a forum post in lead-discovery-runs channel
 * for one batch (discovery + audit pipeline run).
 *
 * One batch = one forum thread = stage-by-stage status updates.
 *
 * Forum tags lifecycle:
 *   in-progress → completed   (all stages OK)
 *   in-progress → partial-failed (some leads/stages failed)
 *   in-progress → paused       (operator pause)
 *   in-progress → aborted      (operator kill)
 *
 * Persists batch state at data/v2/pipeline-batches/<batch-id>.json.
 */

import fs from 'fs';
import path from 'path';

const DISCORD_API = 'https://discord.com/api/v10';

export function channelId() {
  return process.env.LEAD_DISCOVERY_RUNS_DISCORD_CHANNEL_ID || '';
}

export function botToken() {
  return process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
}

function repoRoot() {
  return process.cwd();
}

export function batchStatePath(batchId) {
  return path.join(repoRoot(), 'data/v2/pipeline-batches', `${batchId}.json`);
}

export function readBatchState(batchId) {
  const p = batchStatePath(batchId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeBatchState(state) {
  const p = batchStatePath(state.batch_id);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2));
  return p;
}

async function fetchChannelTags() {
  const r = await fetch(`${DISCORD_API}/channels/${channelId()}`, {
    headers: { Authorization: `Bot ${botToken()}` },
  });
  if (!r.ok) throw new Error(`channel fetch failed: ${r.status}`);
  const data = await r.json();
  return data.available_tags || [];
}

export async function resolveTagIds(names) {
  const tags = await fetchChannelTags();
  const wanted = new Set(names);
  return tags.filter((t) => wanted.has(t.name)).map((t) => t.id);
}

/**
 * Create a new forum post in lead-discovery-runs channel for this batch.
 * Persists batch state file.
 *
 * @returns { batch_id, thread_id, message_id, thread_url, state_path }
 */
export async function startBatchThread({ batchId, title, summary, niche, city, count, runFlags = {} }) {
  if (!channelId()) throw new Error('LEAD_DISCOVERY_RUNS_DISCORD_CHANNEL_ID not set');
  if (!botToken()) throw new Error('bot token not set');

  const tagIds = await resolveTagIds(['in-progress']);

  const body = [
    `🚀 **批次流水线已启动**`,
    `行业 niche: \`${niche}\` · 城市 city: \`${city}\` · 目标条数 count: \`${count}\``,
    `启动时间: ${new Date().toISOString()}`,
    `批次 batch_id: \`${batchId}\``,
    summary ? `\n${summary}` : '',
    `\n_运行参数 flags_: ${Object.entries(runFlags).map(([k, v]) => `${k}=${v}`).join(' · ') || '(默认)'}`,
  ].filter(Boolean).join('\n');

  const r = await fetch(`${DISCORD_API}/channels/${channelId()}/threads`, {
    method: 'POST',
    headers: { Authorization: `Bot ${botToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: title,
      auto_archive_duration: 10080,
      applied_tags: tagIds,
      message: { content: body },
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`forum thread create failed: ${r.status} ${JSON.stringify(data)}`);

  const state = {
    batch_id: batchId,
    title,
    channel_id: channelId(),
    thread_id: data.id,
    thread_url: data.guild_id ? `https://discord.com/channels/${data.guild_id}/${data.id}` : '',
    initial_message_id: data.last_message_id || '',
    niche, city, count, runFlags,
    started_at: new Date().toISOString(),
    finished_at: null,
    current_tag: 'in-progress',
    stages: [],
    issues: [],
    leads: [], // populated as discovery + audit progresses
  };
  const statePath = writeBatchState(state);

  return {
    batch_id: batchId,
    thread_id: state.thread_id,
    message_id: state.initial_message_id,
    thread_url: state.thread_url,
    state_path: statePath,
  };
}

/**
 * Post a stage progress update to the batch thread, optionally swap the
 * applied tag for the post (e.g. in-progress → paused / completed).
 *
 * @param {Object} opts
 * @param {string} opts.batchId
 * @param {string} opts.stage     stage label (e.g. "Stage 0 Discovery")
 * @param {string} opts.status    "ok" | "fail" | "skip" | "paused" | "info"
 * @param {string} opts.summary   markdown body
 * @param {string?} opts.swapTag  one of forum tag names to apply (replaces current)
 */
export async function postStageUpdate({ batchId, stage, status, summary, swapTag = null }) {
  const state = readBatchState(batchId);
  if (!state) throw new Error(`no batch state for ${batchId}`);
  if (!state.thread_id) throw new Error('batch has no thread_id');

  // V3 D43 · 简化 · stage label 已经够说明状态 (✅ on stage = success implicit) ·
  // 不再追加 _成功_ / _失败_ 后缀 · 不再加时间(thread 自带 timestamp)
  const emoji = { ok: '✅', fail: '❌', skip: '⏭️', paused: '⏸️', info: '📝' }[status] || 'ℹ️';
  const head = status === 'ok' ? `${emoji} **${stage}**`
              : status === 'fail' ? `${emoji} **${stage}** · 失败`
              : `${emoji} **${stage}**`;
  const body = `${head}\n${summary}`;

  // V3 D43 · 通过 unified emit (fallback bot-log on thread fail) + audit log
  const { emitDiscord } = await import('./discord-emit.js');
  const emitRes = await emitDiscord({
    threadId: state.thread_id,
    content: body,
    event: 'batch.stage',
    context: { batchId, stage, status },
  });
  if (!emitRes.ok) throw new Error(`stage post failed: ${emitRes.error || 'unknown'}`);
  const data = { id: emitRes.message_id };

  state.stages.push({
    stage, status, summary,
    at: new Date().toISOString(),
    message_id: data.id,
    fallback: emitRes.fallback || null,
  });

  if (swapTag) {
    const tagIds = await resolveTagIds([swapTag]);
    await fetch(`${DISCORD_API}/channels/${state.thread_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bot ${botToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ applied_tags: tagIds }),
    });
    state.current_tag = swapTag;
  }

  writeBatchState(state);

  return {
    message_id: data.id,
    message_url: state.thread_url ? `${state.thread_url}/${data.id}` : '',
    current_tag: state.current_tag,
  };
}

/**
 * Finalize batch — apply terminal tag, record finished_at.
 */
export async function finalizeBatch({ batchId, terminalTag, summary, skipDedupAudit = false }) {
  const r = await postStageUpdate({
    batchId,
    stage: '🏁 批次完成',
    status: terminalTag === 'completed' ? 'ok' : 'info',
    summary,
    swapTag: terminalTag,
  });
  const state = readBatchState(batchId);
  state.finished_at = new Date().toISOString();

  // SOP-X-Dedup hook · auto-run dedup-audit after EVERY batch that finalizes
  // with terminalTag === 'completed'. Previously only fired from
  // pl:pipeline-batch-step --finalize path; lifted here so ALL callers
  // (places-search-intake, future direct callers) get auto-dedup.
  // Suspects land in data/leads/dedup-review-queue.json → operator visits
  // /admin/v2-leads/dedup-review. Set skipDedupAudit:true to bypass.
  if (!skipDedupAudit && terminalTag === 'completed') {
    try {
      const { spawnSync } = await import('node:child_process');
      const out = spawnSync('node', [
        '--env-file-if-exists=.env.local',
        'scripts/cli/pl-dedup-audit.js',
      ], { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      let parsed = null;
      try {
        const jsonMatch = (out.stdout || '').match(/\{[\s\S]*?\n\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {}
      state.dedup_audit = {
        ok: out.status === 0,
        ran_at: new Date().toISOString(),
        total_suspects: parsed?.total_suspects ?? null,
        summary: parsed?.summary ?? null,
        exit_code: out.status,
      };
      // Post a thread update so operators see dedup ran
      if (out.status === 0 && parsed) {
        // V3 D43 · 去 dedup-audit 英文 + admin URL (admin 已弃) · 中文人话
        const dedupSummary = parsed.total_suspects > 0
          ? `发现 **${parsed.total_suspects}** 组疑似重复 · 在 #website-leads 人工复核`
          : `0 组重复 · 数据库干净`;
        try {
          await postStageUpdate({ batchId, stage: '🔍 去重审核', status: 'ok', summary: dedupSummary });
        } catch {}
      }
    } catch (err) {
      state.dedup_audit = { ok: false, error: err.message };
    }
  }

  writeBatchState(state);
  return r;
}
