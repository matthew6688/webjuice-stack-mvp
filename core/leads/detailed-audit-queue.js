/**
 * core/leads/detailed-audit-queue.js · V3 D43 (2026-05-14)
 *
 * Throttled in-process queue for detailedAudit (M2 stage 1-4 · 5-8 min/entity ·
 * Playwright + vision LLM). Limit concurrency to 1 · 30s gap between starts ·
 * to keep mac mini cool.
 *
 * Triggered by cheap-audit-queue when predict-A/B.
 * Spawns `leads:run-pipeline --entity-key X` via createTask (so dispatcher picks it up).
 *
 * Priority queue: higher predict-priority runs first (predict-A=100 > predict-B=75).
 */

import fs from 'node:fs';
import path from 'node:path';

const QUEUE_FILE = path.join(process.cwd(), 'data/leads/queues/detailed-audit-pending.jsonl');
const DETAIL_AUDIT_INTER_MS = parseInt(process.env.DETAIL_AUDIT_INTER_MS || '30000', 10); // 30s between starts

let workerRunning = false;
const inMemQueue = []; // priority sorted desc
const enqueuedKeys = new Set();

function persistQueue() {
  try {
    fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
    const lines = inMemQueue.map((q) => JSON.stringify(q)).join('\n') + (inMemQueue.length ? '\n' : '');
    fs.writeFileSync(QUEUE_FILE, lines);
  } catch (err) {
    console.warn(`[detailed-audit-queue] persist failed: ${err.message}`);
  }
}

function loadQueueOnStart() {
  try {
    if (!fs.existsSync(QUEUE_FILE)) return;
    const lines = fs.readFileSync(QUEUE_FILE, 'utf8').trim().split('\n').filter(Boolean);
    for (const l of lines) {
      try {
        const item = JSON.parse(l);
        if (item.entityKey && !enqueuedKeys.has(item.entityKey)) {
          inMemQueue.push(item);
          enqueuedKeys.add(item.entityKey);
        }
      } catch { /* skip */ }
    }
    inMemQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    if (inMemQueue.length) console.error(`[detailed-audit-queue] resumed ${inMemQueue.length} from disk`);
  } catch { /* fine */ }
}
loadQueueOnStart();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Enqueue an entity for detailedAudit. Priority desc.
 */
export function enqueueDetailedAudit(entityKey, { reason = 'predict-grade', priority = 50 } = {}) {
  if (!entityKey) return false;
  if (enqueuedKeys.has(entityKey)) return false;
  inMemQueue.push({ entityKey, reason, priority, enqueued_at: new Date().toISOString() });
  enqueuedKeys.add(entityKey);
  // Sort by priority desc
  inMemQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  persistQueue();
  if (!workerRunning) {
    workerRunning = true;
    runWorker().catch((err) => {
      console.error(`[detailed-audit-queue] worker crashed: ${err.message}`);
      workerRunning = false;
    });
  }
  return true;
}

/**
 * Spawn a detailedAudit task via the task store · dispatcher picks it up.
 * Returns task_id or null.
 */
async function spawnAuditTask(entityKey) {
  try {
    const { createTask } = await import('../tasks/task-store.js');
    const task = createTask({
      kind: 'audit',
      source: {
        platform: 'internal',
        thread_id: null,  // 没 thread · dispatcher 会 fallback bot-log if needed
        author: 'cheap-audit-queue → predict A/B chain',
        message_id: null,
      },
      input: {
        text: `auto: detailedAudit for ${entityKey} (predict-A/B)`,
        attachments: [],
      },
      target: {
        cli: 'leads:run-pipeline',
        args: ['--entity-key', entityKey],
        target_entity_key: entityKey,
        timeout_ms: 900_000, // 15 min · enough for 4-stage pipeline
      },
    });
    return task?.task_id || null;
  } catch (err) {
    console.error(`[detailed-audit-queue] spawnAuditTask failed ${entityKey}: ${err.message}`);
    return null;
  }
}

async function runWorker() {
  while (inMemQueue.length > 0) {
    const item = inMemQueue.shift();
    persistQueue();
    try {
      const taskId = await spawnAuditTask(item.entityKey);
      console.error(`[detailed-audit-queue] enqueued ${item.entityKey} → task ${taskId} (priority=${item.priority} reason=${item.reason})`);
    } catch (err) {
      console.error(`[detailed-audit-queue] error ${item.entityKey}: ${err.message}`);
    }
    enqueuedKeys.delete(item.entityKey);
    // Inter-task throttle (give dispatcher + Playwright headroom)
    if (inMemQueue.length > 0) await sleep(DETAIL_AUDIT_INTER_MS);
  }
  workerRunning = false;
}

export function queueStatus() {
  return {
    pending: inMemQueue.length,
    running: workerRunning,
    interMs: DETAIL_AUDIT_INTER_MS,
  };
}
