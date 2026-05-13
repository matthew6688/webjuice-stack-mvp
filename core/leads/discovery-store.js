import fs from 'fs';
import path from 'path';
import { createTask, listTasks } from '../tasks/task-store.js';
import { computeDiscoveryScore } from './discovery-score.js';

/**
 * SOP-0 P5 · spawn an `enrich` task on first thin-contact write.
 * Debounce: skip if any enrich task is already pending or running
 * (pl:run-enrichment-batch processes ALL pending entities in one run).
 * Best-effort — failures are swallowed in the caller's try/catch.
 */
function maybeSpawnEnrichTask(entityKey) {
  if (!entityKey) return null;
  const existingPending = listTasks({ kind: 'enrich', status: 'pending', limit: 1 });
  if (existingPending.length > 0) return null;
  const existingRunning = listTasks({ kind: 'enrich', status: 'running', limit: 1 });
  if (existingRunning.length > 0) return null;
  return createTask({
    kind: 'enrich',
    source: {
      platform:   'internal',
      thread_id:  null,
      author:     'discovery-store.mergeLeadIntoEntity',
      message_id: null,
    },
    input: {
      text: `auto: thin-contact entity ${entityKey} needs enrichment`,
      attachments: [],
    },
    target: {
      cli:               'pl:run-enrichment-batch',
      args:              ['--skip-approval'],
      target_entity_key: entityKey,
      timeout_ms:        600_000,  // 10min for batch of pending entities
    },
  });
}

export const DISCOVERY_ENTITY_STATUS = {
  DISCOVERED: 'discovered',
  SCORED: 'scored',
  QUEUED_FOR_AUDIT: 'queued_for_audit',
  QUEUED_FOR_ENRICHMENT: 'queued_for_enrichment',
  READY_FOR_OUTREACH_BRIEF: 'ready_for_outreach_brief',
  PROMOTED: 'promoted',
  SKIPPED: 'skipped',
  MANUAL_REVIEW: 'manual_review',
  CONTACTED: 'contacted',
  MERGED: 'merged', // set by pl:dedup-merge on loser entity (SOP_X_DEDUP §2.2 step 7)
};

// V2 lifecycle phase — DISCORD_OUTREACH_PRD.md §7.1
// 8 mutually-exclusive phases that drive Discord forum tag swapping and admin sub-cells.
// Coexists with legacy `entity.status` (kept for backward compat — Discord paid-intake flow,
// stage-config-driven admin, etc.). Phase is set explicitly by setEntityPhase; never derived
// implicitly from status.
export const ENTITY_PHASE = {
  AWAITING: 'awaiting',
  OUTREACH_ACTIVE: 'outreach-active',
  REPLIED: 'replied',
  PROPOSAL_SENT: 'proposal-sent',
  NURTURE: 'nurture',
  PAID: 'paid',
  ARCHIVED: 'archived',
  NEEDS_HUMAN: 'needs-human',
};

const ENTITY_PHASE_VALUES = new Set(Object.values(ENTITY_PHASE));

const STATUS_RANK = {
  discovered: 10,
  scored: 20,
  manual_review: 25,
  queued_for_audit: 30,
  queued_for_enrichment: 40,
  ready_for_outreach_brief: 50,
  promoted: 60,
  contacted: 70,
  skipped: 5,
};

export function defaultDiscoveryStoreRoot() {
  return path.join('data', 'leads');
}

export function discoveryEntityKey(lead = {}) {
  if (lead.entityKey) return safeKey(lead.entityKey);
  const placeId = clean(lead.place_id || lead.placeId);
  if (placeId) return `place_${safeKey(placeId)}`;
  const cid = clean(lead.cid);
  if (cid) return `cid_${safeKey(cid)}`;
  if (lead.sourceType === 'image_lead') {
    const name = slugify(lead.name || lead.businessName || 'unknown');
    const phone = digits(lead.phone);
    return `image_${safeKey(`${name}_${phone || 'nophone'}`)}`;
  }
  const domain = hostname(lead.website || lead.websiteUrl);
  if (domain) return `domain_${safeKey(domain)}`;
  const phone = digits(lead.phone);
  if (phone) return `phone_${safeKey(phone)}`;
  const name = slugify(lead.name || lead.businessName || lead.company || 'unknown');
  const location = slugify(lead.address || lead.city || lead.sourceQuery || 'unknown');
  return `name_${safeKey(`${name}_${location}`)}`;
}

export function upsertDiscoveryRun(run, {
  storeRoot = defaultDiscoveryStoreRoot(),
  runPath = '',
  generatedAt = new Date().toISOString(),
} = {}) {
  const leads = Array.isArray(run?.leads) ? run.leads : [];
  fs.mkdirSync(path.join(storeRoot, 'entities'), { recursive: true });
  fs.mkdirSync(path.join(storeRoot, 'reports'), { recursive: true });
  fs.mkdirSync(path.join(storeRoot, 'queues'), { recursive: true });

  const events = [];
  const entityKeys = [];
  for (const lead of leads) {
    const entityKey = discoveryEntityKey(lead);
    entityKeys.push(entityKey);
    const entity = readEntity(storeRoot, entityKey) || createEntity(entityKey, lead, generatedAt);
    mergeLeadIntoEntity(entity, lead, run, { runPath, generatedAt });
    writeEntity(storeRoot, entity);
    events.push({
      at: generatedAt,
      event: 'discovery_entity_upserted',
      entityKey,
      placeId: lead.place_id || '',
      cid: lead.cid || '',
      name: lead.name || '',
      status: entity.status,
      recommendedAction: lead.recommendedAction || '',
      discoveryScore: lead.discoveryScore ?? null,
      runId: run.runId || '',
      query: run.query || lead.sourceQuery || '',
      runPath,
    });
  }

  appendEvents(storeRoot, [
    {
      at: generatedAt,
      event: 'discovery_run_indexed',
      runId: run?.runId || '',
      query: run?.query || '',
      runPath,
      rawRows: run?.totals?.rawRows ?? leads.length,
      leads: leads.length,
      entityKeys,
      costPolicy: run?.costPolicy || {},
    },
    ...events,
  ]);
  const index = rebuildDiscoveryIndex({ storeRoot });

  // Matthew 2026-05-13: master.md 不要等 audit · 入库即自动建/更新
  // fire-and-forget · 去重在 enqueueMasterMdRefresh 里 · 失败不反向阻塞 SOP-1 主路径
  if (process.env.SOP1_DISABLE_MASTER_MD_AUTOREFRESH !== '1' && entityKeys.length > 0) {
    import('./master-md-refresh.js')
      .then((m) => m.enqueueMasterMdRefreshBatch(entityKeys, { reason: 'intake' }))
      .catch((err) => console.error(`[discovery-store] master-md enqueue err: ${err.message}`));
  }

  return {
    ok: true,
    storeRoot,
    indexed: leads.length,
    uniqueEntities: index.totals.entities,
    indexPath: path.join(storeRoot, 'discovery-index.json'),
    eventsPath: path.join(storeRoot, 'discovery-events.jsonl'),
  };
}

export function loadDiscoveryIndex({ storeRoot = defaultDiscoveryStoreRoot() } = {}) {
  const indexPath = path.join(storeRoot, 'discovery-index.json');
  if (!fs.existsSync(indexPath)) return rebuildDiscoveryIndex({ storeRoot });
  return readJson(indexPath) || rebuildDiscoveryIndex({ storeRoot });
}

export function loadDiscoveryEntities({ storeRoot = defaultDiscoveryStoreRoot() } = {}) {
  const entitiesDir = path.join(storeRoot, 'entities');
  if (!fs.existsSync(entitiesDir)) return [];
  return fs.readdirSync(entitiesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJson(path.join(entitiesDir, file)))
    .filter(Boolean)
    .sort((a, b) => String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')));
}

export function updateDiscoveryEntityStatus({
  entityKey,
  lead,
  status,
  clientSlug = '',
  note = '',
  storeRoot = defaultDiscoveryStoreRoot(),
  at = new Date().toISOString(),
} = {}) {
  const key = entityKey || discoveryEntityKey(lead);
  const entity = readEntity(storeRoot, key);
  if (!entity) return { ok: false, reason: 'entity_not_found', entityKey: key };
  entity.status = status || entity.status;
  entity.lastStatusAt = at;
  if (clientSlug) entity.promotedClientSlug = clientSlug;
  if (note) entity.notes = uniqueValues([...(entity.notes || []), note]);
  entity.history = [
    ...(entity.history || []),
    { at, event: 'status_updated', status: entity.status, clientSlug, note },
  ];
  writeEntity(storeRoot, entity);
  appendEvents(storeRoot, [{ at, event: 'discovery_entity_status_updated', entityKey: key, status: entity.status, clientSlug, note }]);
  rebuildDiscoveryIndex({ storeRoot });
  return { ok: true, entityKey: key, status: entity.status };
}

// Patch entity with V2 lifecycle phase. Strict read-merge-write — never touches fields
// outside {phase, sub_status, archive_reason, history, phaseChangedAt}. Backward-compat
// invariant: legacy entity.status field is left untouched.
//
// DISCORD_OUTREACH_PRD.md §13 invariant 1 & 2: writeEntity is wholesale-overwrite, so the
// only safe path is read → mutate-in-place → write the same object back. Callers writing
// other entity fields elsewhere must follow the same rule or risk dropping phase.
export function setEntityPhase({
  entityKey,
  phase,
  sub_status = undefined,
  archive_reason = undefined,
  note = '',
  storeRoot = defaultDiscoveryStoreRoot(),
  at = new Date().toISOString(),
} = {}) {
  if (!entityKey) return { ok: false, reason: 'entityKey required' };
  if (!phase || !ENTITY_PHASE_VALUES.has(phase)) {
    return { ok: false, reason: 'invalid_phase', phase, allowed: [...ENTITY_PHASE_VALUES] };
  }
  if (phase === ENTITY_PHASE.ARCHIVED && !archive_reason) {
    return { ok: false, reason: 'archive_reason required for phase=archived' };
  }
  const entity = readEntity(storeRoot, entityKey);
  if (!entity) return { ok: false, reason: 'entity_not_found', entityKey };

  const prevPhase = entity.phase || null;
  const prevSubStatus = entity.sub_status || null;
  const isNoOp = prevPhase === phase
    && (sub_status === undefined || prevSubStatus === sub_status)
    && (archive_reason === undefined || entity.archive_reason === archive_reason);

  entity.phase = phase;
  if (sub_status !== undefined) entity.sub_status = sub_status || null;
  if (archive_reason !== undefined) entity.archive_reason = archive_reason || null;
  entity.phaseChangedAt = at;

  if (!isNoOp) {
    entity.history = [
      ...(entity.history || []),
      {
        at,
        event: 'phase_changed',
        from: prevPhase,
        to: phase,
        sub_status: entity.sub_status || null,
        archive_reason: entity.archive_reason || null,
        note: note || '',
      },
    ];
  }
  writeEntity(storeRoot, entity);
  appendEvents(storeRoot, [{
    at,
    event: 'entity_phase_changed',
    entityKey,
    from: prevPhase,
    to: phase,
    sub_status: entity.sub_status || null,
    archive_reason: entity.archive_reason || null,
    noop: isNoOp,
    note: note || '',
  }]);

  // V2 Discord sync hook — DISCORD_OUTREACH_PRD.md §9 + Block 4.5
  // Async fire-and-forget. Skipped when entity has no thread (C-grade / pre-V2)
  // or when SKIP_LEAD_THREAD_SYNC=true (test mode).
  if (!isNoOp && entity.discord_thread_id && !process.env.SKIP_LEAD_THREAD_SYNC) {
    import('../funnel/lead-thread-sync.js').then(async ({ swapPhaseTag, appendThreadMessage, upsertProfileCard }) => {
      try {
        await swapPhaseTag(entityKey);
        const msg = `🔄 Phase ${prevPhase || '(none)'} → **${phase}**${entity.sub_status ? ` (${entity.sub_status})` : ''}${note ? ` — ${note}` : ''}`;
        await appendThreadMessage(entityKey, msg);
        await upsertProfileCard(entityKey);
      } catch (err) {
        console.warn(`[setEntityPhase] thread sync failed: ${err.message}`);
      }
    }).catch((err) => console.warn(`[setEntityPhase] thread sync import failed: ${err.message}`));
  }

  return {
    ok: true,
    entityKey,
    phase: entity.phase,
    sub_status: entity.sub_status || null,
    archive_reason: entity.archive_reason || null,
    from: prevPhase,
    noop: isNoOp,
  };
}

export function rebuildDiscoveryIndex({ storeRoot = defaultDiscoveryStoreRoot() } = {}) {
  fs.mkdirSync(storeRoot, { recursive: true });
  const entities = loadDiscoveryEntities({ storeRoot });
  const index = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    storeRoot,
    totals: {
      entities: entities.length,
      promoted: entities.filter((entity) => entity.status === DISCOVERY_ENTITY_STATUS.PROMOTED).length,
      skipped: entities.filter((entity) => entity.status === DISCOVERY_ENTITY_STATUS.SKIPPED).length,
      needsAudit: entities.filter((entity) => entity.status === DISCOVERY_ENTITY_STATUS.QUEUED_FOR_AUDIT).length,
      needsEnrichment: entities.filter((entity) => entity.status === DISCOVERY_ENTITY_STATUS.QUEUED_FOR_ENRICHMENT).length,
      readyForOutreachBrief: entities.filter((entity) => entity.status === DISCOVERY_ENTITY_STATUS.READY_FOR_OUTREACH_BRIEF).length,
    },
    statusCounts: countBy(entities, (entity) => entity.status || 'unknown'),
    actionCounts: countBy(entities, (entity) => entity.latest?.recommendedAction || 'unknown'),
    websiteStatusCounts: countBy(entities, (entity) => entity.latest?.websiteStatus || 'unknown'),
    entities: entities.map((entity) => summarizeEntity(entity)),
  };
  writeJson(path.join(storeRoot, 'discovery-index.json'), index);
  return index;
}

// SOP-1 出口契约 gate: 只有 enrichment-complete (或 unenrichable) 的 entity 才能
// 进入 SOP-2 的 cheap-site-audit 队列. 'pending' 表示 SOP-1 还没把联系方式补全.
// Backwards-compat: 旧 entity 没有 enrichment_status 字段 → 视作 'complete' (legacy).
// 详见 SOP-X-Handoff §1.1 + SOP-1 §3.6.4.
function isEnrichmentReady(entity) {
  const status = entity.enrichment_status;
  if (!status) return true; // legacy entity (no field) → treat as complete
  return status === 'complete' || status === 'unenrichable';
}

export function buildDiscoveryQueues({ storeRoot = defaultDiscoveryStoreRoot(), limit = 50 } = {}) {
  const entities = loadDiscoveryEntities({ storeRoot });
  const active = entities.filter((entity) => entity.status !== DISCOVERY_ENTITY_STATUS.SKIPPED);
  const cheapSiteAudit = active
    .filter((entity) => entity.status === DISCOVERY_ENTITY_STATUS.QUEUED_FOR_AUDIT)
    .filter((entity) => entity.latest?.website)
    .filter(isEnrichmentReady)
    .sort(byScore)
    .slice(0, limit)
    .map(queueItem);
  const enrichment = active
    .filter((entity) => entity.status === DISCOVERY_ENTITY_STATUS.QUEUED_FOR_ENRICHMENT || ['starter_candidate'].includes(entity.latest?.recommendedAction))
    .filter((entity) => !entity.promotedClientSlug)
    .sort(byScore)
    .slice(0, limit)
    .map((entity) => ({ ...queueItem(entity), reason: enrichmentReason(entity) }));
  const outreachBrief = active
    .filter((entity) => entity.promotedClientSlug || entity.status === DISCOVERY_ENTITY_STATUS.READY_FOR_OUTREACH_BRIEF)
    .sort(byScore)
    .slice(0, limit)
    .map(queueItem);

  const queues = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    storeRoot,
    costPolicy: {
      googlePlacesApi: 'selected_candidates_only',
      tinyfishOrSiteAudit: 'selected_candidates_only',
      emailExtraction: 'after_offer_angle_exists',
    },
    cheapSiteAudit,
    enrichment,
    outreachBrief,
  };
  const queueDir = path.join(storeRoot, 'queues');
  fs.mkdirSync(queueDir, { recursive: true });
  writeJson(path.join(queueDir, 'cheap-site-audit.json'), cheapSiteAudit);
  writeJson(path.join(queueDir, 'selected-enrichment.json'), enrichment);
  writeJson(path.join(queueDir, 'outreach-brief.json'), outreachBrief);
  writeJson(path.join(queueDir, 'queues.json'), queues);
  appendEvents(storeRoot, [{
    at: queues.generatedAt,
    event: 'discovery_queues_built',
    cheapSiteAudit: cheapSiteAudit.length,
    enrichment: enrichment.length,
    outreachBrief: outreachBrief.length,
  }]);
  return queues;
}

export function buildDiscoveryReport({ storeRoot = defaultDiscoveryStoreRoot() } = {}) {
  const index = rebuildDiscoveryIndex({ storeRoot });
  const entities = loadDiscoveryEntities({ storeRoot });
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    totals: index.totals,
    statusCounts: index.statusCounts,
    actionCounts: index.actionCounts,
    websiteStatusCounts: index.websiteStatusCounts,
    topCandidates: entities.sort(byScore).slice(0, 20).map(queueItem),
    nextActions: [
      'Run cheap site audit for audit_candidate entities with independent websites.',
      'Promote only starter_candidate/audit_candidate entities with a clear contact path or weak website signal.',
      'Use Google Places API only for promoted candidates before official evidence/build/outreach.',
      'Use email/contact extraction only after a candidate has a concrete offer angle.',
    ],
  };
  const reportPath = path.join(storeRoot, 'reports', 'discovery-report.json');
  writeJson(reportPath, report);
  return { report, reportPath };
}

function createEntity(entityKey, lead, at) {
  return {
    schemaVersion: 1,
    entityKey,
    firstSeenAt: at,
    lastSeenAt: at,
    status: statusForLead(lead),
    lastStatusAt: at,
    identifiers: {},
    latest: {},
    runs: [],
    history: [],
    notes: [],
  };
}

function mergeLeadIntoEntity(entity, lead, run, { runPath, generatedAt }) {
  entity.lastSeenAt = maxDate(entity.lastSeenAt, generatedAt);
  entity.identifiers = {
    place_id: clean(lead.place_id || entity.identifiers?.place_id),
    cid: clean(lead.cid || entity.identifiers?.cid),
    data_id: clean(lead.data_id || entity.identifiers?.data_id),
    websiteDomain: hostname(lead.website || entity.latest?.website || ''),
    phoneDigits: digits(lead.phone || entity.latest?.phone || ''),
  };
  // SOP-1 出口承诺: entity 必须 enrichment-complete 才进 SOP-2 audit 队列.
  // 默认 'pending' for new thin-contact entities; 自动升 'complete' when contact 出现.
  // Legacy entities (no field) treated as 'complete' by isEnrichmentReady gate (backwards-compat).
  // See SOP-X-Handoff §2.3 + SOP-1 §3.6.
  //
  // Predicate: a "thin-contact" entity has no phone AND no website (see
  // core/leads/thin-contact.js — same logic, but applied to the merged
  // post-write state below).
  const mergedPhone = lead.phone || entity.latest?.phone || '';
  const mergedWebsite = lead.website || entity.latest?.website || '';
  const thinContact = !mergedPhone && !mergedWebsite;
  const currentEnrichmentStatus = entity.enrichment_status;
  let newlyPending = false;
  if (!currentEnrichmentStatus) {
    // First write — set default based on thin-contact status at this moment
    entity.enrichment_status = thinContact ? 'pending' : 'complete';
    if (thinContact) newlyPending = true;
  } else if (currentEnrichmentStatus === 'pending' && !thinContact) {
    // Was pending, now we have contact info (gosom re-scrape or merge added it) → upgrade
    entity.enrichment_status = 'complete';
  }
  // SOP-0 P5 · push-based enrichment trigger.
  // When an entity newly becomes thin-contact-pending, create a SOP-0 task
  // (kind=enrich) so dispatcher spawns pl:run-enrichment-batch immediately
  // — no waiting for periodic scan. Debounced: skip if any enrich task is
  // already pending or running (one batch run clears the whole queue).
  // Wrapped in try/catch so task-store failures never break entity merge.
  if (newlyPending) {
    try {
      maybeSpawnEnrichTask(entity.entityKey);
    } catch (err) {
      // Best-effort. Log but don't propagate.
      if (process.env.SOP0_DEBUG) {
        console.error('[SOP-0] maybeSpawnEnrichTask failed:', err.message);
      }
    }
  }
  // 'unenrichable' / 'partial' are set by pl:run-enrichment-batch after enrichLead() runs.
  // Never auto-downgrade complete → pending.
  // G-3: stamp batch_id onto entity if the run was started by pl:pipeline-batch-start.
  // batch_id (string) groups all leads from the same batch task — used by Hermes
  // / Discord to filter "what came from batch X" without scanning every entity.
  // See SOP-1 §5 entity schema.
  const batchId = clean(lead.batch_id || run.batchId || '');
  entity.latest = {
    ...entity.latest,
    sourceType: lead.sourceType || 'maps_scraper',
    name: clean(lead.name || entity.latest?.name),
    category: clean(lead.category || entity.latest?.category),
    categories: Array.isArray(lead.categories) ? lead.categories : entity.latest?.categories || [],
    address: clean(lead.address || entity.latest?.address),
    // V3 bug fix #9: normalize city to Title Case (was inconsistent:
    // gold-coast / brisbane / Brisbane depending on entry). Hyphens → spaces.
    city: normalizeCity(clean(lead.city || run.city || entity.latest?.city)),
    // V3 bug fix #6: places-search-intake leaves niche empty. Fallback to
    // sourceQuery first word + GMB categories before giving up.
    niche: normalizeNiche(
      clean(lead.niche || run.niche || entity.latest?.niche),
      { categories: lead.categories || entity.latest?.categories, sourceQuery: lead.sourceQuery || run.query }
    ),
    phone: clean(lead.phone || entity.latest?.phone),
    website: clean(lead.website || entity.latest?.website),
    google_maps_url: clean(lead.google_maps_url || entity.latest?.google_maps_url),
    rating: lead.rating ?? entity.latest?.rating ?? null,
    review_count: lead.review_count ?? entity.latest?.review_count ?? null,
    websiteStatus: clean(lead.websiteStatus || entity.latest?.websiteStatus),
    // M1-D2/D7 · unified discoveryScore. Prefer caller-supplied score (gosom
    // already computed one), else derive from entity shape so all 4 entry
    // points produce a consistent score for the same business.
    discoveryScore: lead.discoveryScore ?? computeUnifiedDiscoveryScore(lead, entity),
    recommendedAction: clean(lead.recommendedAction || entity.latest?.recommendedAction),
    sourceQuery: clean(lead.sourceQuery || run.query || entity.latest?.sourceQuery),
    signals: lead.signals || entity.latest?.signals || {},
    batch_id: batchId || entity.latest?.batch_id || '',
    // SOP-0 v1.5 source provenance · used by master-md "来源" section.
    // rank = position in search/scrape result list (1-based). null for image_lead etc.
    discovery_rank: lead.discovery_rank ?? entity.latest?.discovery_rank ?? null,
    google_places_provider: lead.google_places_provider || entity.latest?.google_places_provider || null,
  };
  if (batchId) {
    entity.batches = Array.from(new Set([...(entity.batches || []), batchId])).slice(-20);
  }
  const nextStatus = statusForLead(lead);
  if (shouldPromoteStatus(entity.status, nextStatus)) {
    entity.status = nextStatus;
    entity.lastStatusAt = generatedAt;
  }
  const runRef = {
    runId: run.runId || '',
    query: run.query || lead.sourceQuery || '',
    runPath,
    at: generatedAt,
    discoveryScore: lead.discoveryScore ?? null,
    recommendedAction: lead.recommendedAction || '',
  };
  if (!(entity.runs || []).some((item) => item.runId === runRef.runId && item.query === runRef.query)) {
    entity.runs = [...(entity.runs || []), runRef].slice(-20);
  }
  entity.history = [
    ...(entity.history || []),
    {
      at: generatedAt,
      event: 'seen_in_discovery_run',
      runId: run.runId || '',
      query: run.query || lead.sourceQuery || '',
      score: lead.discoveryScore ?? null,
      action: lead.recommendedAction || '',
      status: entity.status,
    },
  ].slice(-100);
}

// M1-D2/D7 · unified-score helper. Build a flat entity-shaped object from the
// merged lead + existing entity.latest so computeDiscoveryScore is fed the most
// complete view available at merge time. Returns null when nothing can be scored
// (matches prior null-when-absent behaviour).
function computeUnifiedDiscoveryScore(lead, entity) {
  try {
    const latest = entity?.latest || {};
    const merged = {
      websiteStatus: lead.websiteStatus || latest.websiteStatus || '',
      website: lead.website || latest.website || '',
      phone: lead.phone || latest.phone || '',
      review_count: lead.review_count ?? latest.review_count ?? 0,
      rating: lead.rating ?? latest.rating ?? 0,
      signals: lead.signals || latest.signals || {},
    };
    const score = computeDiscoveryScore(merged);
    return Number.isFinite(score) ? score : null;
  } catch {
    return null;
  }
}

function statusForLead(lead) {
  if (lead.recommendedAction === 'skip') return DISCOVERY_ENTITY_STATUS.SKIPPED;
  if (lead.recommendedAction === 'manual_review') return DISCOVERY_ENTITY_STATUS.MANUAL_REVIEW;
  if (lead.recommendedAction === 'audit_candidate') return DISCOVERY_ENTITY_STATUS.QUEUED_FOR_AUDIT;
  if (lead.recommendedAction === 'starter_candidate') return DISCOVERY_ENTITY_STATUS.SCORED;
  return DISCOVERY_ENTITY_STATUS.DISCOVERED;
}

function shouldPromoteStatus(current, next) {
  if (current === DISCOVERY_ENTITY_STATUS.PROMOTED || current === DISCOVERY_ENTITY_STATUS.CONTACTED) return false;
  return (STATUS_RANK[next] || 0) >= (STATUS_RANK[current] || 0);
}

function summarizeEntity(entity) {
  return {
    entityKey: entity.entityKey,
    status: entity.status,
    firstSeenAt: entity.firstSeenAt,
    lastSeenAt: entity.lastSeenAt,
    runCount: (entity.runs || []).length,
    promotedClientSlug: entity.promotedClientSlug || '',
    identifiers: entity.identifiers || {},
    latest: entity.latest || {},
  };
}

function queueItem(entity) {
  return {
    entityKey: entity.entityKey,
    status: entity.status,
    name: entity.latest?.name || '',
    city: entity.latest?.city || '',
    niche: entity.latest?.niche || entity.latest?.category || '',
    phone: entity.latest?.phone || '',
    website: entity.latest?.website || '',
    googleMapsUrl: entity.latest?.google_maps_url || '',
    websiteStatus: entity.latest?.websiteStatus || '',
    discoveryScore: entity.latest?.discoveryScore ?? null,
    recommendedAction: entity.latest?.recommendedAction || '',
    promotedClientSlug: entity.promotedClientSlug || '',
    lastSeenAt: entity.lastSeenAt || '',
  };
}

function enrichmentReason(entity) {
  if (entity.latest?.recommendedAction === 'starter_candidate') return 'Starter candidate: verify official contact path before mockup/outreach.';
  return 'Audit candidate: run cheap site audit first, then verify selected facts with paid APIs only if still promising.';
}

function readEntity(storeRoot, entityKey) {
  return readJson(path.join(storeRoot, 'entities', `${safeKey(entityKey)}.json`));
}

function writeEntity(storeRoot, entity) {
  writeJson(path.join(storeRoot, 'entities', `${safeKey(entity.entityKey)}.json`), entity);
}

function appendEvents(storeRoot, events) {
  if (!events.length) return;
  fs.mkdirSync(storeRoot, { recursive: true });
  fs.appendFileSync(path.join(storeRoot, 'discovery-events.jsonl'), `${events.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function byScore(a, b) {
  return Number(b.latest?.discoveryScore || 0) - Number(a.latest?.discoveryScore || 0)
    || Number(b.latest?.review_count || 0) - Number(a.latest?.review_count || 0);
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function clean(value) {
  return String(value || '').trim();
}

// V3 bug fix #9: normalize city across 4 entry points.
// Examples: "brisbane" → "Brisbane" · "gold-coast" → "Gold Coast" · "Brisbane" → "Brisbane"
function normalizeCity(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  // Replace hyphens/underscores with spaces, then Title Case each word.
  return s.replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// V3 bug fix #6: niche fallback chain — explicit lead.niche → GMB categories
// first word → sourceQuery first 2 words minus the city. Catches places-search
// case where lead has no niche field but search was for "panel beater Brisbane".
function normalizeNiche(value, { categories, sourceQuery } = {}) {
  const s = String(value || '').trim();
  if (s) return s;
  if (Array.isArray(categories) && categories.length) {
    const first = String(categories[0] || '').trim();
    if (first) return first.toLowerCase();
  }
  const q = String(sourceQuery || '').trim();
  if (q) {
    // Strip common city words; take first 1-2 meaningful tokens
    const tokens = q.toLowerCase().split(/\s+/).filter(t => t && !['brisbane', 'sydney', 'melbourne', 'perth', 'adelaide', 'gold', 'coast', 'sunshine', 'in', 'near', 'the'].includes(t));
    if (tokens.length) return tokens.slice(0, 2).join(' ');
  }
  return '';
}

function hostname(value) {
  try {
    return new URL(String(value || '').trim()).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function digits(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'unknown';
}

function safeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'unknown';
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function maxDate(...values) {
  return values.filter(Boolean).sort().slice(-1)[0] || '';
}
