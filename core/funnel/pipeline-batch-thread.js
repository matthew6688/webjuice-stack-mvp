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

/**
 * cycle-27 (Matthew 2026-05-15 roofer gold-coast batch race):
 * Cross-process file lock on batch state. dispatcher spawns 1 audit task per
 * entity in parallel processes · each calls recordEntityTerminal → read-
 * modify-write of <batchId>.json. Without locking the writes clobber each
 * other · entities go missing from bs.entities[] · KPI gate never fires.
 *
 * Lock file: `<batchStatePath>.lock` containing PID. Atomic via `flag: 'wx'`
 * (fails if exists). Stale lock detection via `process.kill(pid, 0)`.
 *
 * Returns a release function. Caller MUST call release() (use try/finally).
 */
export async function acquireBatchStateLock(batchId, { maxMs = 10_000, pollMs = 30 } = {}) {
  const statePath = batchStatePath(batchId);
  const lockPath = statePath + '.lock';
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try {
      // Atomic create-if-not-exists · throws EEXIST if held
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return function release() {
        try { fs.unlinkSync(lockPath); } catch { /* already gone · OK */ }
      };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Stale-lock check: if holder PID not alive, remove lock + retry
      try {
        const raw = fs.readFileSync(lockPath, 'utf8').trim();
        const pid = parseInt(raw, 10);
        if (!isNaN(pid) && pid !== process.pid) {
          try {
            process.kill(pid, 0); // throws ESRCH if dead
          } catch (killErr) {
            if (killErr.code === 'ESRCH') {
              try { fs.unlinkSync(lockPath); } catch {}
              continue; // retry immediately
            }
          }
        }
      } catch { /* lock file disappeared mid-check · retry */ }
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
  throw new Error(`acquireBatchStateLock timeout (${maxMs}ms) for ${batchId}`);
}

/**
 * cycle-27 (Matthew 2026-05-15 4-batch silent-miss diagnosis):
 * Lock-protected read-modify-write helper. All batch state mutations should
 * go through this · NOT call readBatchState + writeBatchState separately ·
 * stale snapshots clobber entities[] written by concurrent recordEntityTerminal.
 *
 * @param {string} batchId
 * @param {(bs: object) => object|undefined|Promise<object|undefined>} mutator
 *   Receives the current batch state (just-read inside the lock).
 *   May modify in place or return a new object. Falsy return = use mutated input.
 * @returns Promise<object> the persisted batch state
 */
export async function mutateBatchState(batchId, mutator) {
  if (!batchId) throw new Error('mutateBatchState: batchId required');
  if (typeof mutator !== 'function') throw new Error('mutateBatchState: mutator must be a function');
  const release = await acquireBatchStateLock(batchId);
  try {
    const bs = readBatchState(batchId);
    if (!bs) throw new Error(`mutateBatchState: batch state not found for ${batchId}`);
    const ret = await mutator(bs);
    const next = ret || bs;
    writeBatchState(next);
    return next;
  } finally {
    release();
  }
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

  // cycle-27 (Matthew 2026-05-15): v2 typography · zero emoji body · structured
  const { batchStartMessage } = await import('./batch-thread-messages.js');
  const body = batchStartMessage({
    batchId, niche, city, count,
    source: runFlags.source || null,
    runFlags,
    startedAt: new Date().toISOString(),
  });

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
    batchId, // alias for new consumers
    title,
    channel_id: channelId(),
    thread_id: data.id,
    thread_url: data.guild_id ? `https://discord.com/channels/${data.guild_id}/${data.id}` : '',
    initial_message_id: data.last_message_id || '',
    niche, city, count, runFlags,
    started_at: new Date().toISOString(),
    finished_at: null,
    finalized_at: null, // set on KPI dashboard post
    current_tag: 'in-progress',
    stages: [],
    issues: [],
    leads: [],
    entities: [], // cycle-26 P5: appended by publish-demo per-entity for KPI dashboard
    expected_total: count, // operator-requested count · KPI gate
    cost_usd_total: 0, // accumulated by stage emitters
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
export async function postStageUpdate({ batchId, stage, status, summary, swapTag = null, rawContent = false }) {
  // cycle-27 (4-batch silent-miss fix): read OUTSIDE lock to do Discord I/O
  // (network) without holding the lock. Only the STATE WRITE goes under lock.
  const state = readBatchState(batchId);
  if (!state) throw new Error(`no batch state for ${batchId}`);
  if (!state.thread_id) throw new Error('batch has no thread_id');

  // cycle-27 (Matthew 2026-05-15): rawContent=true → caller pre-formatted the
  // full message via batch-thread-messages.js v2 builder · zero emoji body ·
  // no auto-prefix. Legacy callers (rawContent=false) still get ✅/❌/⏭️ prefix.
  let body;
  if (rawContent) {
    body = String(summary || '');
  } else {
    const emoji = { ok: '✅', fail: '❌', skip: '⏭️', paused: '⏸️', info: '📝' }[status] || 'ℹ️';
    const head = status === 'ok' ? `${emoji} **${stage}**`
                : status === 'fail' ? `${emoji} **${stage}** · 失败`
                : `${emoji} **${stage}**`;
    body = `${head}\n${summary}`;
  }

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

  // tag swap (Discord I/O · outside lock)
  if (swapTag) {
    const tagIds = await resolveTagIds([swapTag]);
    await fetch(`${DISCORD_API}/channels/${state.thread_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bot ${botToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ applied_tags: tagIds }),
    });
  }

  // cycle-27 fix: state mutation MUST be inside lock · otherwise concurrent
  // recordEntityTerminal writes get clobbered by our stale snapshot.
  const persisted = await mutateBatchState(batchId, (bs) => {
    bs.stages = bs.stages || [];
    bs.stages.push({
      stage, status, summary,
      at: new Date().toISOString(),
      message_id: data.id,
      fallback: emitRes.fallback || null,
    });
    if (swapTag) bs.current_tag = swapTag;
  });

  return {
    message_id: data.id,
    message_url: persisted.thread_url ? `${persisted.thread_url}/${data.id}` : '',
    current_tag: persisted.current_tag,
  };
}

/**
 * Finalize batch — apply terminal tag, record finished_at.
 */
export async function finalizeBatch({ batchId, terminalTag, summary, skipDedupAudit = false, skipPost = false }) {
  // cycle-26 P9: skipPost lets caller (scrape-docker) update batch state without
  // posting · the real KPI dashboard fires later from publish-demo /
  // terminal-archive when all expected entities are accounted for.
  // cycle-27: v2 typography · use batchFinalizeMessage builder (zero emoji body)
  let r = { message_id: null };
  if (!skipPost) {
    const { batchFinalizeMessage } = await import('./batch-thread-messages.js');
    const bs = readBatchState(batchId);
    const v2body = batchFinalizeMessage({
      query: bs?.runFlags?.query || null,
      count: (bs?.entities?.length) ?? null,
      expectedTotal: bs?.expected_total ?? null,
    });
    r = await postStageUpdate({
      batchId, stage: '批次完成', status: terminalTag === 'completed' ? 'ok' : 'info',
      summary: v2body, swapTag: terminalTag, rawContent: true,
    });
  }
  // cycle-27 fix (4-batch silent-miss): mark finished_at via mutateBatchState
  // (lock-protected) · NOT via raw read+write. Otherwise our stale snapshot
  // would later clobber recordEntityTerminal's entity additions.
  await mutateBatchState(batchId, (bs) => { bs.finished_at = new Date().toISOString(); });

  // SOP-X-Dedup hook · auto-run dedup-audit after EVERY batch that finalizes
  // with terminalTag === 'completed'. Previously only fired from
  // pl:pipeline-batch-step --finalize path; lifted here so ALL callers
  // (places-search-intake, future direct callers) get auto-dedup.
  // Suspects land in data/leads/dedup-review-queue.json → operator visits
  // /admin/v2-leads/dedup-review. Set skipDedupAudit:true to bypass.
  if (!skipDedupAudit && terminalTag === 'completed') {
    let dedupResult;
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
      dedupResult = {
        ok: out.status === 0,
        ran_at: new Date().toISOString(),
        total_suspects: parsed?.total_suspects ?? null,
        summary: parsed?.summary ?? null,
        exit_code: out.status,
      };
      // cycle-27: v2 typography · use batchDedupMessage builder
      if (out.status === 0 && parsed) {
        try {
          const { batchDedupMessage } = await import('./batch-thread-messages.js');
          const v2body = batchDedupMessage({
            dupGroups: parsed.total_groups ?? parsed.total_suspects ?? 0,
            suspectCount: parsed.total_suspects ?? null,
          });
          await postStageUpdate({ batchId, stage: '去重审核', status: 'ok', summary: v2body, rawContent: true });
        } catch {}
      }
    } catch (err) {
      dedupResult = { ok: false, error: err.message };
    }
    // persist dedup_audit field via lock-protected mutate
    await mutateBatchState(batchId, (bs) => { bs.dedup_audit = dedupResult; });
  }

  return r;
}

/**
 * cycle-26 cycle-27 (Matthew 2026-05-15 E2E retest):
 * Record an entity reaching a terminal-eligible state into batch.entities[].
 * Fires KPI dashboard once entities.length >= expected_total.
 *
 * Idempotent · upserts by entityKey. Call sites:
 *   - terminal-archive.js · archived (D-grade or any stage-fail)
 *   - pl-check-qualification.js · ready-to-build / qa-pending verdicts
 *   - pl-publish-demo.js · outreach-active (published)
 *
 * Why centralized: previously each call site had its own copy of the
 * append-and-fire block. pl-check-qualification.js never had one ·
 * KPI gate never fired in plumbers/gold-coast E2E (BCV stuck at
 * ready-to-build · batch.entities stayed at 2/3).
 */
export async function recordEntityTerminal({
  batchId,
  entityKey,
  name = null,
  threadUrl = null,
  phase,
  grade = null,
  archive_reason = null,
  fetchImpl = null,
}) {
  if (!batchId || !entityKey || !phase) {
    return { ok: false, reason: 'missing required fields (batchId / entityKey / phase)' };
  }

  // cycle-27 (race fix): acquire cross-process lock around read-modify-write
  // BUT release it BEFORE any Discord I/O. The lock window must be short ·
  // KPI fire (network HTTP) can happen outside lock with a snapshot copy.
  let bs;
  let mustFireKpi = false;
  let release;
  try {
    release = await acquireBatchStateLock(batchId);
  } catch (err) {
    return { ok: false, reason: `lock acquire failed: ${err.message}` };
  }
  try {
    bs = readBatchState(batchId);
    if (!bs) return { ok: false, reason: `batch state not found: ${batchId}` };

    bs.entities = bs.entities || [];
    const entry = { entityKey, name, threadUrl, phase, grade, archive_reason };
    const idx = bs.entities.findIndex((x) => x.entityKey === entityKey);
    if (idx >= 0) bs.entities[idx] = entry; else bs.entities.push(entry);
    bs.finalized_at = new Date().toISOString();

    const expected = bs.expected_total || bs.lead_count || 0;
    if (expected > 0 && bs.entities.length >= expected && !bs.kpi_dashboard_posted_at) {
      // Claim KPI ownership atomically inside the lock · only one process fires
      bs.kpi_dashboard_posted_at = new Date().toISOString();
      mustFireKpi = true;
    }
    writeBatchState(bs);
  } finally {
    release();
  }

  // KPI fire AFTER lock release · network I/O must not block other writers
  let kpiFired = false;
  if (mustFireKpi) {
    try {
      const { buildKpiDashboard } = await import('./kpi-dashboard.js');
      const { appendThreadMessage } = await import('./lead-thread-sync.js');
      const dashboard = buildKpiDashboard({ batchState: bs, entities: bs.entities });
      const opts = fetchImpl ? { force: true, fetchImpl } : { force: true };
      if (bs.thread_id) await appendThreadMessage(bs.thread_id, dashboard, opts).catch(() => {});
      if (process.env.PL_PARENT_THREAD_ID) {
        await appendThreadMessage(process.env.PL_PARENT_THREAD_ID, dashboard, opts).catch(() => {});
      }
      kpiFired = true;
    } catch (err) {
      console.warn(`[recordEntityTerminal] KPI fire failed: ${err.message}`);
    }
  }
  const expected = bs.expected_total || bs.lead_count || 0;
  return { ok: true, count: bs.entities.length, expected, kpiFired };
}
