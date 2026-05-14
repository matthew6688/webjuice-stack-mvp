/**
 * core/leads/cheap-audit-queue.js · V3 D43 (2026-05-14)
 *
 * Throttled in-process queue that runs cheap-audit-v2 on entities after intake,
 * predicts A/B/C/D grade, and chains detailedAudit ONLY for predict-A/B.
 *
 * Per Matthew 2026-05-14:
 *   "不能等 cron job · 控制好时间 · 不要让我的 mac mini 太忙"
 *   "如果判定是 D · 就直接 archive"
 *
 * Flow:
 *   intake CLI → upsertDiscoveryRun → enqueueCheapAudit(entityKey) →
 *     [worker · throttled · 1 entity at a time · 2.5s Tinyfish pace]
 *     → cheap-audit-v2 (Stage 1 GBP + Stage 2 site quick-scan if has_website)
 *     → predictGradePreaudit
 *     → action:
 *       predict-D · setEntityPhase('archived')
 *       predict-A/B · enqueueDetailedAudit (chained · also throttled)
 *       predict-C · refresh #website-leads thread (audit-pending tag)
 *       queued_for_enrichment · enqueueEnrichment (separate queue)
 *
 * Throttle:
 *   · Single-thread worker (1 cheap-audit at a time)
 *   · Stage 2 site-fetch uses Tinyfish 30/min (2.5s inter-fetch built into rescore-v2)
 *   · After each entity · sleep CHEAP_AUDIT_INTER_MS (default 3s) to keep mac cool
 *   · detailedAudit chain queue (separate) caps at 1 concurrent · 30s gap
 */

import fs from 'node:fs';
import path from 'node:path';

const QUEUE_FILE = path.join(process.cwd(), 'data/leads/queues/cheap-audit-pending.jsonl');
const CHEAP_AUDIT_INTER_MS = parseInt(process.env.CHEAP_AUDIT_INTER_MS || '3000', 10);

let workerRunning = false;
const inMemQueue = []; // simple FIFO · persisted file used for crash recovery
const enqueuedKeys = new Set(); // dedup within process

function persistQueue() {
  try {
    fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
    const lines = inMemQueue.map((q) => JSON.stringify(q)).join('\n') + (inMemQueue.length ? '\n' : '');
    fs.writeFileSync(QUEUE_FILE, lines);
  } catch (err) {
    console.warn(`[cheap-audit-queue] persist failed: ${err.message}`);
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
    if (inMemQueue.length) console.error(`[cheap-audit-queue] resumed ${inMemQueue.length} from disk`);
  } catch { /* fine */ }
}
loadQueueOnStart();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Enqueue an entity for cheap-audit. Idempotent within process.
 */
export function enqueueCheapAudit(entityKey, { reason = 'intake' } = {}) {
  if (!entityKey) return false;
  if (enqueuedKeys.has(entityKey)) return false;
  inMemQueue.push({ entityKey, reason, enqueued_at: new Date().toISOString() });
  enqueuedKeys.add(entityKey);
  persistQueue();
  // Kick worker if not running
  if (!workerRunning) {
    workerRunning = true;
    runWorker().catch((err) => {
      console.error(`[cheap-audit-queue] worker crashed: ${err.message}`);
      workerRunning = false;
    });
  }
  return true;
}

/**
 * Process one entity through cheap-audit + predict-grade + branch.
 */
async function processOne(entityKey) {
  const fs2 = await import('node:fs');
  const path2 = await import('node:path');
  const entityPath = path2.join(process.cwd(), 'data/leads/entities', `${entityKey}.json`);
  if (!fs2.existsSync(entityPath)) {
    console.error(`[cheap-audit-queue] entity not found: ${entityKey}`);
    return;
  }
  let entity;
  try {
    entity = JSON.parse(fs2.readFileSync(entityPath, 'utf8'));
  } catch (err) {
    console.error(`[cheap-audit-queue] entity parse failed ${entityKey}: ${err.message}`);
    return;
  }

  // Run cheap-audit-v2 (Stage 1 only · skip Stage 2 site-fetch here to keep fast;
  // detailedAudit will do its own full fetch later if predict-A/B)
  const { cheapAuditV2 } = await import('../scoring/cheap-audit-v2.js');
  let cheapResult;
  try {
    cheapResult = cheapAuditV2({
      entity,
      fetchPayload: null,  // 不在这里跑 Tinyfish · detailedAudit 跑 Playwright
      sourceQuery: entity.latest?.sourceQuery,
    });
  } catch (err) {
    console.error(`[cheap-audit-queue] cheap-audit failed ${entityKey}: ${err.message}`);
    return;
  }

  // Predict grade
  const { predictGradePreaudit } = await import('./predict-grade.js');
  const predict = predictGradePreaudit({ entity, cheapAudit: cheapResult });

  // Write cheap-audit + prediction to entity
  try {
    const fresh = JSON.parse(fs2.readFileSync(entityPath, 'utf8'));
    fresh.cheap_audit = {
      action: cheapResult.action,
      reason: cheapResult.reason,
      gbp_quality: cheapResult.gbp_quality,
      final_score: cheapResult.final_score,
      fired_triggers: cheapResult.fired_triggers,
      relevance_pass: cheapResult.relevance_pass,
      priority: cheapResult.priority || cheapResult.gbp_quality || 0,
      at: cheapResult.timestamp,
    };
    fresh.predict_grade = {
      grade: predict.predict_grade,
      priority: predict.priority,
      audit_now: predict.audit_now,
      reasons: predict.reasons,
      at: new Date().toISOString(),
    };
    fs2.writeFileSync(entityPath, JSON.stringify(fresh, null, 2) + '\n');
    console.error(`[cheap-audit-queue] ${entityKey} · cheap.action=${cheapResult.action} · predict=${predict.predict_grade} · priority=${predict.priority} · audit_now=${predict.audit_now}`);
  } catch (err) {
    console.error(`[cheap-audit-queue] write entity failed ${entityKey}: ${err.message}`);
    return;
  }

  // Branch by predict_grade
  if (predict.predict_grade === 'D') {
    // D · setEntityPhase archived · NO thread opened (cycle-4 fix: D never gets a thread)
    try {
      const { setEntityPhase, ENTITY_PHASE } = await import('./discovery-store.js');
      setEntityPhase({
        entityKey,
        phase: ENTITY_PHASE.ARCHIVED,
        archive_reason: `predict-D · ${predict.reasons.join(' · ')}`,
        note: 'cheap-audit-queue auto-archive (predict-D · no thread)',
      });
    } catch (err) {
      console.error(`[cheap-audit-queue] setEntityPhase archived failed ${entityKey}: ${err.message}`);
    }
    return;
  }

  // Predict A/B/C · NOW open #website-leads thread (cycle-4 · deferred from intake)
  // Title will be accurate because predict-grade is set on entity before thread create.
  if (!process.env.SOP1_DISABLE_AUTO_OPEN_LEADS) {
    try {
      const { openLeadThread, refreshThreadAndPost } = await import('../funnel/lead-thread-sync.js');
      const r = await openLeadThread(entityKey);
      if (r?.ok) {
        console.error(`[cheap-audit-queue] ${entityKey} · thread ${r.reused ? 'reused' : 'opened'} (predict-${predict.predict_grade})`);
        // V3 D43 cycle-7 (Matthew 2026-05-14): post cheap-audit + predict summary
        // immediately so thread isn't empty for predict-C entities (no detail audit).
        try {
          const { cheapAuditPredictMessage } = await import('../funnel/audit-stage-messages.js');
          // Read fresh entity (has new cheap_audit + predict_grade just written)
          const fresh = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
          const summary = cheapAuditPredictMessage({ entity: fresh, cheapAudit: cheapResult, predict });
          await refreshThreadAndPost(entityKey, summary, { skipCard: true });
        } catch (err) {
          console.error(`[cheap-audit-queue] ${entityKey} · post cheap-summary failed: ${err.message}`);
        }
      } else {
        console.error(`[cheap-audit-queue] ${entityKey} · openLeadThread failed: ${r?.reason || 'unknown'}`);
      }
    } catch (err) {
      console.error(`[cheap-audit-queue] ${entityKey} · openLeadThread error: ${err.message}`);
    }
  }

  if (cheapResult.action === 'queued_for_enrichment') {
    // No phone/email · enrich first · queue for SOP-1 enrichment
    console.error(`[cheap-audit-queue] ${entityKey} · queued_for_enrichment (no contact)`);
    return;
  }

  if (predict.audit_now) {
    // Predict A/B · enqueue detailedAudit
    try {
      const { enqueueDetailedAudit } = await import('./detailed-audit-queue.js');
      enqueueDetailedAudit(entityKey, { reason: `predict-${predict.predict_grade}`, priority: predict.priority });
    } catch (err) {
      // detailed-audit-queue may not exist yet · degrade gracefully
      console.warn(`[cheap-audit-queue] detailedAudit enqueue skipped (queue not implemented yet): ${err.message}`);
    }
    return;
  }

  // Predict C · 不立刻 audit · 进 cold queue · 等触发
  // (LEAD-JOURNEY: cold-outreach-queue 已有 file at data/leads/cold-outreach-queue.json)
  // 这里只标记 entity 状态 · 不主动开队列(grade-router 在 detailedAudit 后才 enqueue)
  console.error(`[cheap-audit-queue] ${entityKey} · predict-C · 留 backlog · 等触发`);
}

async function runWorker() {
  while (inMemQueue.length > 0) {
    const item = inMemQueue.shift();
    persistQueue();
    try {
      await processOne(item.entityKey);
    } catch (err) {
      console.error(`[cheap-audit-queue] processOne error ${item.entityKey}: ${err.message}`);
    }
    enqueuedKeys.delete(item.entityKey);
    // Throttle · 不让 mac mini 烧
    if (inMemQueue.length > 0) await sleep(CHEAP_AUDIT_INTER_MS);
  }
  workerRunning = false;
}

/**
 * For tests · process queue synchronously to drain.
 */
export async function drainQueue() {
  await runWorker();
}

export function queueStatus() {
  return {
    pending: inMemQueue.length,
    running: workerRunning,
    interMs: CHEAP_AUDIT_INTER_MS,
  };
}
