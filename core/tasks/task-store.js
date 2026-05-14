/**
 * core/tasks/task-store.js · SOP-0 Task System
 *
 * Schema + file IO + state machine + atomic write + tag-ID resolution.
 *
 * Task file path: data/tasks/<task_id>.json
 * task_id format: YYYYMMDD-HHMMSS-rand6  (chrono-sortable → `ls` = time order)
 *
 * Concurrency model: atomic write via tempfile + rename (POSIX guarantee).
 * State transitions: enforced via TRANSITIONS map; illegal transitions throw.
 *
 * Owner: SOP-0 §2 (docs/SOP_0_TASK_SYSTEM.md)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TASKS_DIR = path.resolve(process.cwd(), 'data/tasks');
const TAGS_FILE = path.resolve(process.cwd(), 'data/discord/website-tasks-forum-tags.json');

// V3 (2026-05-13): added demo_build (M3 auto demo · grade A/B trigger) and
// photos_fetch (M5 paid · stripe webhook trigger).
export const KINDS = ['intake', 'enrich', 'audit', 'dedup', 'photos', 'image-extract', 'ops', 'single-enrich', 'places-intake', 'demo_build', 'photos_fetch'];
export const STATUSES = ['pending', 'running', 'done', 'failed', 'human'];
export const SCHEMA_VERSION = 1;

// Allowed status transitions. Self-loops disallowed.
const TRANSITIONS = {
  pending: ['running', 'human'],            // claim → running, or router gives up
  running: ['done', 'failed', 'human'],     // exit 0 / exit≠0 / stuck
  done:    [],                              // terminal
  failed:  ['pending', 'human'],            // operator retry / escalate
  human:   ['pending', 'done'],             // operator ✅ retry / 🗑 give up
};

const MAX_PROGRESS = 50;

/* ─── Tag IDs ─────────────────────────────────────────────────────── */

let _tagsCache = null;
export function loadForumTags() {
  if (_tagsCache) return _tagsCache;
  if (!fs.existsSync(TAGS_FILE)) {
    throw new Error(`Forum tags file missing: ${TAGS_FILE}. Run discord:sync-forums first.`);
  }
  _tagsCache = JSON.parse(fs.readFileSync(TAGS_FILE, 'utf8'));
  return _tagsCache;
}

/** Return [kindTagId, statusTagId] for a task (Discord PATCH applied_tags array). */
export function appliedTagsFor(kind, status) {
  const tags = loadForumTags();
  const k = tags.kind?.[kind];
  const s = tags.status?.[status];
  if (!k) throw new Error(`Unknown kind tag: ${kind}`);
  if (!s) throw new Error(`Unknown status tag: ${status}`);
  return [k, s];
}

/* ─── ID generation ───────────────────────────────────────────────── */

export function generateTaskId(now = new Date()) {
  const y  = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d  = String(now.getUTCDate()).padStart(2, '0');
  const h  = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const s  = String(now.getUTCSeconds()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex'); // 6 chars
  return `${y}${mo}${d}-${h}${mi}${s}-${rand}`;
}

/* ─── Schema ──────────────────────────────────────────────────────── */

export function makeTask({
  kind,
  source = {},
  input = {},
  target = {},
  taskId = null,
  now = new Date(),
} = {}) {
  if (!KINDS.includes(kind)) throw new Error(`Invalid kind: ${kind}. Must be one of ${KINDS.join(', ')}`);
  const id = taskId || generateTaskId(now);
  return {
    schemaVersion: SCHEMA_VERSION,
    task_id: id,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    kind,
    status: 'pending',
    source: {
      platform: source.platform || 'discord',
      thread_id: source.thread_id || null,
      author: source.author || null,
      message_id: source.message_id || null,
    },
    input: {
      text: input.text || '',
      attachments: input.attachments || [],
    },
    target: {
      cli: target.cli || null,
      args: target.args || [],
      target_entity_key: target.target_entity_key || null,
      timeout_ms: target.timeout_ms || 300000,
    },
    result: {
      entity_keys: [],
      exit_code: null,
      duration_ms: null,
      cost_usd: null,
    },
    progress: [],
    error: null,
    discord: {
      thread_id: source.thread_id || null,
      status_message_id: null,
    },
  };
}

export function validateTask(task) {
  const errors = [];
  if (!task || typeof task !== 'object') return ['not an object'];
  if (task.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion ${task.schemaVersion} ≠ ${SCHEMA_VERSION}`);
  if (!/^\d{8}-\d{6}-[0-9a-f]{6}$/.test(task.task_id || '')) errors.push('invalid task_id format');
  if (!KINDS.includes(task.kind)) errors.push(`invalid kind: ${task.kind}`);
  if (!STATUSES.includes(task.status)) errors.push(`invalid status: ${task.status}`);
  if (!task.created_at) errors.push('missing created_at');
  return errors;
}

/* ─── File IO (atomic) ────────────────────────────────────────────── */

function pathFor(taskId) {
  return path.join(TASKS_DIR, `${taskId}.json`);
}

function ensureDir() {
  fs.mkdirSync(TASKS_DIR, { recursive: true });
}

function atomicWrite(filePath, value) {
  ensureDir();
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, filePath); // POSIX-atomic on same fs
}

export function createTask(spec) {
  const task = makeTask(spec);
  const filePath = pathFor(task.task_id);
  if (fs.existsSync(filePath)) throw new Error(`Task already exists: ${task.task_id}`);
  atomicWrite(filePath, task);
  return task;
}

/**
 * Read a task by id. Scans active dir first, then walks `_archive/` recursively
 * as a fallback. This lets `transitionStatus(archivedTaskId, ...)` work: the
 * task is read from archive, then written to active dir (effectively
 * "promoting" the task back to active when an operator retries via reaction).
 *
 * Returns null if task_id not found anywhere.
 */
export function readTask(taskId) {
  const active = pathFor(taskId);
  if (fs.existsSync(active)) {
    return JSON.parse(fs.readFileSync(active, 'utf8'));
  }
  // Walk archive (last 6 months only — older = not retried anymore)
  const archive = path.join(TASKS_DIR, '_archive');
  if (!fs.existsSync(archive)) return null;
  const stack = [archive];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      if (e.name === `${taskId}.json`) {
        return JSON.parse(fs.readFileSync(full, 'utf8'));
      }
    }
  }
  return null;
}

export function writeTask(task) {
  const errs = validateTask(task);
  if (errs.length) throw new Error(`Invalid task: ${errs.join('; ')}`);
  task.updated_at = new Date().toISOString();
  atomicWrite(pathFor(task.task_id), task);
  return task;
}

export function listTasks({ status = null, kind = null, limit = null } = {}) {
  ensureDir();
  const files = fs.readdirSync(TASKS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse(); // newest first (chrono-sortable id)
  const out = [];
  for (const f of files) {
    try {
      const t = JSON.parse(fs.readFileSync(path.join(TASKS_DIR, f), 'utf8'));
      if (status && t.status !== status) continue;
      if (kind && t.kind !== kind) continue;
      out.push(t);
      if (limit && out.length >= limit) break;
    } catch { /* skip malformed */ }
  }
  return out;
}

/* ─── Lookups ─────────────────────────────────────────────────────── */

/** Find first task by Discord thread_id (catch-up uses this). null if none.
 * Scans both active `data/tasks/*.json` AND `data/tasks/_archive/**\/*.json`
 * so re-runs aren't triggered for already-processed (archived) threads.
 */
export function findByThreadId(threadId) {
  if (!threadId) return null;
  ensureDir();
  const roots = [
    TASKS_DIR,
    path.join(TASKS_DIR, '_archive'),
  ];
  const stack = [...roots];
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      if (!e.name.endsWith('.json')) continue;
      try {
        const t = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (t.discord?.thread_id === threadId || t.source?.thread_id === threadId) return t;
      } catch { /* skip */ }
    }
  }
  return null;
}

/* ─── State machine ───────────────────────────────────────────────── */

export function canTransition(from, to) {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) || false;
}

export function transitionStatus(taskId, newStatus, { reason = null, result = null } = {}) {
  const task = readTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (!canTransition(task.status, newStatus)) {
    throw new Error(`Illegal transition ${task.status} → ${newStatus} for task ${taskId}`);
  }
  const fromStatus = task.status;
  task.status = newStatus;
  if (reason) task.error = reason;
  if (result) task.result = { ...task.result, ...result };
  const written = writeTask(task);
  // V3 D43 · Discord emit on EVERY transition · fallback to bot-log if thread fails
  // Skip running → done/failed/human (dispatcher already posts user-facing message
  // via humanize.js · this would duplicate). Emit terminal-to-terminal too · catch race.
  // Skip when SKIP_DISCORD_EMIT=1 (for test mode).
  if (!process.env.SKIP_DISCORD_EMIT && fromStatus !== newStatus) {
    import('../funnel/discord-emit.js').then(({ emitTaskTransition }) =>
      emitTaskTransition(task, fromStatus, newStatus, reason).catch(() => {})
    ).catch(() => {});
  }
  return written;
}

export function appendProgress(taskId, step, detail = '') {
  const task = readTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  task.progress.push({ at: new Date().toISOString(), step, detail });
  if (task.progress.length > MAX_PROGRESS) {
    task.progress = task.progress.slice(-MAX_PROGRESS);
  }
  return writeTask(task);
}

/* ─── Claim (atomic pending → running) ────────────────────────────── */

/**
 * Try to claim a pending task atomically. Returns the claimed task or null if
 * another process beat us to it. Uses fs.rename to a `.claiming` marker file
 * as a poor-man's lock (only one rename can succeed per source).
 */
export function tryClaim(taskId) {
  const filePath = pathFor(taskId);
  const lockPath = `${filePath}.claiming`;
  // Check current status
  let task;
  try { task = readTask(taskId); } catch { return null; }
  if (!task || task.status !== 'pending') return null;
  // Try to grab claim marker (exclusive create)
  try {
    fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
  } catch {
    return null; // someone else has the claim
  }
  try {
    // Re-read after lock to avoid race
    task = readTask(taskId);
    if (!task || task.status !== 'pending') {
      fs.unlinkSync(lockPath);
      return null;
    }
    task.status = 'running';
    task.updated_at = new Date().toISOString();
    atomicWrite(filePath, task);
    fs.unlinkSync(lockPath);
    return task;
  } catch (err) {
    try { fs.unlinkSync(lockPath); } catch {}
    throw err;
  }
}
