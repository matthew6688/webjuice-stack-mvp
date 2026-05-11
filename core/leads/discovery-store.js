import fs from 'fs';
import path from 'path';

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
  const placeId = clean(lead.place_id || lead.placeId);
  if (placeId) return `place_${safeKey(placeId)}`;
  const cid = clean(lead.cid);
  if (cid) return `cid_${safeKey(cid)}`;
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

export function buildDiscoveryQueues({ storeRoot = defaultDiscoveryStoreRoot(), limit = 50 } = {}) {
  const entities = loadDiscoveryEntities({ storeRoot });
  const active = entities.filter((entity) => entity.status !== DISCOVERY_ENTITY_STATUS.SKIPPED);
  const cheapSiteAudit = active
    .filter((entity) => entity.status === DISCOVERY_ENTITY_STATUS.QUEUED_FOR_AUDIT)
    .filter((entity) => entity.latest?.website)
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
  entity.latest = {
    ...entity.latest,
    sourceType: lead.sourceType || 'maps_scraper',
    name: clean(lead.name || entity.latest?.name),
    category: clean(lead.category || entity.latest?.category),
    categories: Array.isArray(lead.categories) ? lead.categories : entity.latest?.categories || [],
    address: clean(lead.address || entity.latest?.address),
    city: clean(lead.city || run.city || entity.latest?.city),
    niche: clean(lead.niche || run.niche || entity.latest?.niche),
    phone: clean(lead.phone || entity.latest?.phone),
    website: clean(lead.website || entity.latest?.website),
    google_maps_url: clean(lead.google_maps_url || entity.latest?.google_maps_url),
    rating: lead.rating ?? entity.latest?.rating ?? null,
    review_count: lead.review_count ?? entity.latest?.review_count ?? null,
    websiteStatus: clean(lead.websiteStatus || entity.latest?.websiteStatus),
    discoveryScore: lead.discoveryScore ?? entity.latest?.discoveryScore ?? null,
    recommendedAction: clean(lead.recommendedAction || entity.latest?.recommendedAction),
    sourceQuery: clean(lead.sourceQuery || run.query || entity.latest?.sourceQuery),
    signals: lead.signals || entity.latest?.signals || {},
  };
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
