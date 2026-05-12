/**
 * Master MD auto-refresh helper
 *
 * Matthew 2026-05-13: master.md 不要等 audit · 越早越好 · 后续 audit / enrich /
 * dedup / photos 完了再自动 refresh。
 *
 * 调用方:
 *   - core/leads/discovery-store.js · upsertDiscoveryRun 写 entity 后
 *   - scripts/leads/run-audit-pipeline.js · audit 写完后
 *   - core/leads/dedup-detector.js · merge 后 (重定向到 canonical)
 *   - scripts/cli/pl-run-enrichment-batch.js · 补全后
 *
 * 实现: fire-and-forget createTask(kind='ops', cli='leads:build-master-md')
 * 去重: 如果同 entityKey 已有 pending/running master-md 任务 → 跳过
 * 失败兜底: 永不 throw · 静默 log · SOP-1 主路径不被反向阻塞
 */

import path from 'node:path';

let _createTask = null;
let _listTasks = null;

// Lazy import to avoid circular deps with task-store (which may import discovery-store)
async function loadTaskStore() {
  if (_createTask) return { createTask: _createTask, listTasks: _listTasks };
  const mod = await import('../tasks/task-store.js');
  _createTask = mod.createTask;
  _listTasks = mod.listTasks;
  return { createTask: _createTask, listTasks: _listTasks };
}

/**
 * Queue a master.md rebuild for one entity.
 * 触发后台 SOP-0 task · dispatcher 会跑 `leads:build-master-md --entity-key X`
 * @param {string} entityKey
 * @param {object} opts { reason: 'intake' | 'enrich' | 'audit' | 'dedup' | 'photos' }
 */
export async function enqueueMasterMdRefresh(entityKey, opts = {}) {
  if (!entityKey) return null;
  const reason = opts.reason || 'unknown';
  try {
    const { createTask, listTasks } = await loadTaskStore();

    // 去重: 同 entityKey 已有 pending/running build-master-md → 跳过
    // (debounce — batch 一次写 N 个 entity 不会创 N 个任务)
    const existing = listTasks({ kind: 'ops' }).filter((t) =>
      ['pending', 'running'].includes(t.status)
      && t.target?.cli === 'leads:build-master-md'
      && (t.target?.args || []).includes(entityKey)
    );
    if (existing.length > 0) return existing[0];

    const task = createTask({
      kind: 'ops',
      source: {
        platform: 'internal',
        thread_id: null,
        author: `master-md-refresh (${reason})`,
        message_id: null,
      },
      input: {
        text: `auto: refresh master.md for ${entityKey} (trigger=${reason})`,
        attachments: [],
      },
      target: {
        cli: 'leads:build-master-md',
        args: ['--entity-key', entityKey],
        timeout_ms: 120_000,
      },
    });
    return task;
  } catch (err) {
    // 永不阻塞 caller · SOP-1 主路径独立 · master-md 是增强不是核心
    console.error(`[master-md-refresh] enqueue failed for ${entityKey}: ${err.message}`);
    return null;
  }
}

/**
 * Batch version · 一次 queue 一组 entityKey
 * dispatcher 仍然 1 个 entity 1 个 task (因为 build-master-md CLI 按 --entity-key 单跑)
 * 但 listTasks 去重保证同 entity 同时只有 1 task
 */
export async function enqueueMasterMdRefreshBatch(entityKeys, opts = {}) {
  if (!Array.isArray(entityKeys) || entityKeys.length === 0) return [];
  const results = [];
  for (const k of entityKeys) {
    results.push(await enqueueMasterMdRefresh(k, opts));
  }
  return results;
}
