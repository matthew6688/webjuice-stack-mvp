import path from 'path';
import {
  buildDiscoveryQueues,
  discoveryEntityKey,
  upsertDiscoveryRun,
  defaultDiscoveryStoreRoot,
} from './discovery-store.js';
import {
  WEBSITE_STATUS,
  RECOMMENDED_DISCOVERY_ACTION,
  classifyWebsiteStatus,
} from './maps-scraper-discovery.js';

// V2 image-lead ingest: peer to maps-scraper-discovery, sourceType='image_lead'.
// Caller is responsible for OCR/VLM extraction. We just normalize the extracted
// fields into the V2 discovery-run shape and call upsertDiscoveryRun.
export function buildImageLeadDiscoveryRun({
  ocrResult,
  niche = '',
  city = '',
  batchId = '',
  imagePath = '',
  runId = '',
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!ocrResult || typeof ocrResult !== 'object') {
    throw new Error('ocrResult required');
  }
  if (!ocrResult.businessName) {
    throw new Error('ocrResult.businessName required');
  }
  const website = String(ocrResult.website || '').trim();
  const websiteStatus = classifyWebsiteStatus(website);
  // Image-lead default action: manual_review. Why: we have no rating / review
  // count / category signals, so auto-scoring would be noise. Let cheap-audit-v2
  // grade it after entity is written, then admin triage promotes from there.
  const recommendedAction = RECOMMENDED_DISCOVERY_ACTION.MANUAL_REVIEW;
  const lead = {
    sourceType: 'image_lead',
    name: String(ocrResult.businessName).trim(),
    phone: String(ocrResult.phone || '').trim(),
    address: String(ocrResult.address || '').trim(),
    city,
    niche,
    category: String(ocrResult.category || '').trim(),
    categories: [],
    website,
    websiteStatus,
    discoveryScore: 0,
    recommendedAction,
    signals: {
      hasPhone: Boolean(ocrResult.phone),
      hasWebsite: Boolean(website),
      hasImage: Boolean(imagePath || ocrResult.imageUrl),
      imageUrl: String(ocrResult.imageUrl || ''),
      imagePath: imagePath || '',
    },
    sourceQuery: batchId ? `image_lead:${batchId}` : 'image_lead',
  };
  return {
    schemaVersion: 1,
    generatedAt,
    runId,
    query: lead.sourceQuery,
    niche,
    city,
    sourceType: 'image_lead',
    costPolicy: {
      googlePlacesApi: 'not_used_in_discovery',
      emailExtraction: 'disabled',
      reviewBodyExtraction: 'n/a',
      reviewPayloadStorage: 'n/a',
      notes: [
        'Image lead — OCR/VLM extracted fields supplied by caller.',
        'No rating / review signals available; default action manual_review.',
        'cheap-audit-v2 grading runs separately via rescore-v2-cli.',
      ],
    },
    toolLog: {
      tool: 'image-lead-discovery-v2',
      imagePath: imagePath || '',
      imageUrl: String(ocrResult.imageUrl || ''),
      batchId,
    },
    totals: {
      rawRows: 1,
      leads: 1,
      withWebsite: website ? 1 : 0,
      withPhone: lead.phone ? 1 : 0,
      actionCounts: { [recommendedAction]: 1 },
      websiteStatusCounts: { [websiteStatus]: 1 },
    },
    queue: {
      starterCandidates: [],
      auditCandidates: [],
      manualReview: [lead],
      skipped: [],
    },
    leads: [lead],
  };
}

export function runImageLeadToV2({
  imagePath = '',
  ocrResult,
  niche = '',
  city = '',
  batchId = '',
  storeRoot = defaultDiscoveryStoreRoot(),
  dryRun = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  const runId = batchId || `image-${generatedAt.replace(/[:.]/g, '-')}`;
  const run = buildImageLeadDiscoveryRun({
    ocrResult,
    niche,
    city,
    batchId,
    imagePath,
    runId,
    generatedAt,
  });
  const [lead] = run.leads;
  const entityKey = discoveryEntityKey(lead);
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      entityKey,
      action: 'planned_write',
      lead,
      runId,
      storeRoot,
      entityPath: path.join(storeRoot, 'entities', `${entityKey}.json`),
    };
  }
  const store = upsertDiscoveryRun(run, {
    storeRoot,
    runPath: `image_lead:${runId}`,
    generatedAt,
  });
  const queues = buildDiscoveryQueues({ storeRoot });
  return {
    ok: true,
    dryRun: false,
    entityKey,
    action: 'upserted',
    runId,
    storeRoot,
    entityPath: path.join(storeRoot, 'entities', `${entityKey}.json`),
    indexed: store.indexed,
    uniqueEntities: store.uniqueEntities,
    queueCounts: {
      cheapSiteAudit: queues.cheapSiteAudit.length,
      enrichment: queues.enrichment.length,
      outreachBrief: queues.outreachBrief.length,
    },
  };
}
