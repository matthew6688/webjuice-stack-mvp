/**
 * M2-D3 · Grade router — persist lead grade with Discord thread + cold-outreach queue.
 *
 * Behaviour by grade:
 *   A · open Discord thread (no cold-outreach queue · personalized follow-up)
 *   B · open Discord thread (no cold-outreach queue · personalized follow-up)
 *   C · open Discord thread + enqueue cold-outreach (batch template path)
 *   D · skip everything (archived)
 *
 * Dedup: cold-outreach queue is idempotent by entityKey.
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

  return { entityKey, grade: g, thread, enqueued };
}
