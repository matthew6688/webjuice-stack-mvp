/**
 * V3 cycle-26 (2026-05-15) · Terminal-failure unifier.
 *
 * Single function that ALL pipeline-exit-to-D paths must call:
 *   - exclusion-filter Layer 1/2/3 hit
 *   - Stage 1 sitemap > 10 hard-gate
 *   - Stage 3a grade=D
 *   - any other "this lead is rejected" terminal state
 *
 * Effect (atomic per-entity):
 *   1. entity.grade        = { grade: 'D', reason }
 *   2. entity.phase        = 'archived'
 *   3. entity.archive_reason = `${path_id}: ${reason}`  (path_id from TERMINAL_FAIL_PATHS)
 *   4. entity.archived_at  = now
 *   5. entity.history      += event=archived_as_rejected
 *
 * Discord side (skipped if dryRun):
 *   - swap title prefix → [D]
 *   - post final "🗄 archived" message
 *   - archive + lock thread
 *
 * Callers MUST NOT setEntityPhase('archived') directly · always go through here.
 * Linter doesn't check this yet · cycle-doctor D.terminal does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ENTITY_PHASE, TERMINAL_FAIL_PATHS } from '../contracts/discord-messages.js';

const VALID_PATH_IDS = new Set(TERMINAL_FAIL_PATHS.map((p) => p.id));

function defaultStoreRoot() {
  return path.join('data', 'leads');
}

function readEntityFile(storeRoot, entityKey) {
  const p = path.join(storeRoot, 'entities', `${entityKey}.json`);
  if (!fs.existsSync(p)) return { ok: false, reason: 'entity_not_found', path: p };
  return { ok: true, entity: JSON.parse(fs.readFileSync(p, 'utf8')), path: p };
}

function writeEntityFile(filePath, entity) {
  fs.writeFileSync(filePath, JSON.stringify(entity, null, 2));
}

/**
 * Archive an entity as rejected (grade=D · phase=archived) atomically.
 *
 * @param {string} entityKey
 * @param {object} opts
 * @param {string} opts.reason                    — human-readable reason (for thread message + history)
 * @param {string} [opts.pathId]                  — TERMINAL_FAIL_PATHS.id (validated)
 * @param {string} [opts.layer]                   — informational (e.g. 'Stage 1', 'exclusion-filter')
 * @param {string} [opts.storeRoot]               — default 'data/leads'
 * @param {boolean} [opts.dryRun=false]           — skip Discord side-effects
 * @param {Function} [opts.fetchImpl=fetch]       — for tests
 * @returns {Promise<{ok, entity, threadAction}>}
 */
export async function archiveLeadAsRejected(entityKey, opts = {}) {
  const {
    reason = '(no reason)',
    pathId = null,
    layer = null,
    storeRoot = defaultStoreRoot(),
    dryRun = false,
    fetchImpl = (typeof fetch !== 'undefined' ? fetch : null),
  } = opts;

  if (!entityKey) return { ok: false, reason: 'entityKey_required' };
  if (pathId && !VALID_PATH_IDS.has(pathId)) {
    return { ok: false, reason: 'invalid_pathId', pathId, allowed: [...VALID_PATH_IDS] };
  }

  const r = readEntityFile(storeRoot, entityKey);
  if (!r.ok) return { ok: false, reason: r.reason, path: r.path };
  const entity = r.entity;

  // Build archive_reason · include pathId tag so doctor/snapshot can attribute
  const tag = pathId || (layer ? layer.replace(/\s+/g, '_').toLowerCase() : 'terminal_fail');
  const at = new Date().toISOString();

  const prevPhase = entity.phase || null;
  const prevGrade = entity.grade || null;

  entity.phase = ENTITY_PHASE.ARCHIVED;
  entity.grade = { grade: 'D', reason };
  entity.archive_reason = `${tag}: ${reason}`;
  entity.archived_at = at;
  entity.history = [
    ...(entity.history || []),
    { at, event: 'archived_as_rejected', from_phase: prevPhase, pathId: tag, reason },
  ];

  writeEntityFile(r.path, entity);

  // Discord side-effects (skipped in dry-run / tests)
  // Order: rename title (with [D] tag) → swap forum tags → post archive msg → archive+lock
  let threadAction = { skipped: true };
  if (!dryRun && entity.discord_thread_id) {
    try {
      const { swapPhaseTag, appendThreadMessage, archiveAndLockThread, renameThreadToCurrentTitle } =
        await import('../funnel/lead-thread-sync.js');
      // 1. Rename title using buildThreadTitle (will show [D] since grade=D · phase=archived)
      await renameThreadToCurrentTitle(entityKey, { fetchImpl }).catch((e) => console.warn(`[terminal-archive] rename failed: ${e.message}`));
      // 2. Swap applied_tags (forum chips)
      await swapPhaseTag(entityKey, { fetchImpl }).catch(() => {});
      // 3. Final archive message
      await appendThreadMessage(
        entity.discord_thread_id,
        `🗄 **${entityKey}** archived as rejected · ${tag}\n${reason}`,
        { fetchImpl },
      ).catch(() => {});
      // 4. Archive + lock (must be last · Discord rejects rename on locked threads)
      const a = await archiveAndLockThread(entity.discord_thread_id, { reason: tag, fetchImpl });
      threadAction = a;
    } catch (err) {
      threadAction = { ok: false, reason: err.message };
    }
  }

  // cycle-27 (Matthew 2026-05-15 Places E2E):
  // Record batch terminal state OUTSIDE the thread branch · L2 / L3 exclusions
  // archive entity BEFORE a thread is opened (cheap-audit-queue defers thread
  // open to survivors). Previously this block was nested inside `if (entity.
  // discord_thread_id)` → entities without threads never got recorded into
  // batch.entities · KPI gate never fired for Places intake L2 exclusions.
  try {
    const { recordEntityTerminal } = await import('../funnel/pipeline-batch-thread.js');
    const batches = entity.batches || [];
    const batchId = batches[batches.length - 1];
    if (batchId) {
      await recordEntityTerminal({
        batchId,
        entityKey,
        name: entity.latest?.name || null,
        threadUrl: entity.discord_thread_id
          ? `https://discord.com/channels/${process.env.DISCORD_GUILD_ID || '1493925728570310756'}/${entity.discord_thread_id}`
          : null,
        phase: 'archived',
        grade: 'D',
        archive_reason: entity.archive_reason || tag,
      });
    }
  } catch (err) {
    console.warn(`[archiveLeadAsRejected] batch record failed: ${err.message}`);
  }

  return { ok: true, entity, threadAction };
}
