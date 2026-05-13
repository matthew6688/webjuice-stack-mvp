/**
 * M2-D3 · Grade router — persist lead grade with Discord thread + cold-outreach queue.
 *
 * Behaviour by grade:
 *   A · open Discord thread + auto-spawn demo_build task (M3 auto demo · 2026-05-13)
 *   B · open Discord thread + auto-spawn demo_build task
 *   C · open Discord thread + enqueue cold-outreach (batch template path)
 *   D · skip everything (archived)
 *
 * Dedup: cold-outreach queue is idempotent by entityKey.
 *        demo_build task debounced via task-store listTasks check (no double pending).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const QUEUE_PATH = path.join(REPO_ROOT, 'data', 'leads', 'cold-outreach-queue.json');

function readQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8')); } catch { return []; }
}

function writeQueue(items) {
  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(items, null, 2));
}

export function enqueueColdOutreach(entityKey, { reason } = {}) {
  const items = readQueue();
  if (items.some((it) => it.entityKey === entityKey)) return false;
  items.push({
    entityKey,
    enqueued_at: new Date().toISOString(),
    reason: reason || 'C-grade auto-enqueue',
    status: 'pending',
  });
  writeQueue(items);
  return true;
}

/**
 * Persist a lead grade decision.
 *
 * @param {object} opts
 * @param {string} opts.entityKey
 * @param {'A'|'B'|'C'|'D'} opts.grade
 * @param {object} [opts.__mockDiscord]  test-mode {openLeadThread:fn}
 */
export async function persistLeadGrade({ entityKey, grade, __mockDiscord } = {}) {
  if (!entityKey) throw new Error('entityKey required');
  const g = String(grade || '').toUpperCase();

  let thread = null;
  if (['A', 'B', 'C'].includes(g)) {
    if (__mockDiscord?.openLeadThread) {
      thread = await __mockDiscord.openLeadThread({ entityKey, grade: g });
    } else {
      // Production path — defer to real Discord client; best-effort.
      try {
        const mod = await import('../funnel/lead-thread-sync.js');
        if (typeof mod.openLeadThread === 'function') {
          thread = await mod.openLeadThread({ entityKey, grade: g });
        }
      } catch (err) {
        // M1 dependency may be absent in dev — non-fatal
      }
    }
  }

  let enqueued = false;
  if (g === 'C') {
    enqueued = enqueueColdOutreach(entityKey, { reason: 'C-grade auto-enqueue' });
  }

  // V3 M3 auto-demo hook (2026-05-13): grade A/B trigger demo_build task.
  // Dispatcher picks up · spawns `pl:build-from-reference --slug <slug>` ·
  // outputs clients/<slug>/v2/concept/reference-adapter/index.html.
  // Debounced: skip if any pending/running demo_build already for this entity.
  let demoTaskId = null;
  if (g === 'A' || g === 'B') {
    demoTaskId = await maybeSpawnDemoBuild(entityKey).catch(() => null);
  }

  return { entityKey, grade: g, thread, enqueued, demoTaskId };
}

async function maybeSpawnDemoBuild(entityKey) {
  try {
    const { createTask, listTasks } = await import('../tasks/task-store.js');
    // Debounce: skip if pending/running demo_build for same entity.
    // Match on target.target_entity_key (set on task creation) — args contain
    // the slug not entityKey, so we can't filter args.
    const existing = listTasks({ kind: 'demo_build' }).filter(
      (t) => ['pending', 'running'].includes(t.status)
        && t.target?.target_entity_key === entityKey
    );
    if (existing.length > 0) return null;

    // Derive slug from entity (consistent with build-master-md.js slugify)
    const slug = await deriveSlug(entityKey);
    if (!slug) return null;

    const task = createTask({
      kind: 'demo_build',
      source: {
        platform: 'internal',
        thread_id: null,
        author: 'grade-router.maybeSpawnDemoBuild',
        message_id: null,
      },
      input: {
        text: `auto: M3 demo build for grade A/B entity ${entityKey} (slug=${slug})`,
        attachments: [],
      },
      target: {
        cli: 'pl:build-from-reference',
        args: ['--slug', slug],
        target_entity_key: entityKey,
        timeout_ms: 6 * 60 * 1000,  // 6 min · adapter typically 3 min
      },
    });
    return task?.task_id || null;
  } catch (err) {
    // Non-fatal: M1 dependency may be absent in dev / task-store path missing
    console.error('[grade-router] maybeSpawnDemoBuild failed:', err.message);
    return null;
  }
}

async function deriveSlug(entityKey) {
  try {
    const fp = path.join(REPO_ROOT, 'data/leads/entities', `${entityKey}.json`);
    if (!fs.existsSync(fp)) return null;
    const entity = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const name = entity?.latest?.name || entityKey;
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  } catch { return null; }
}
