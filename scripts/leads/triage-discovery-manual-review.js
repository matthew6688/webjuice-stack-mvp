#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  loadDiscoveryEntities,
  updateDiscoveryEntityStatus,
} from '../../core/leads/discovery-store.js';

const args = parseArgs(process.argv.slice(2));
const storeRoot = path.resolve(args['store-root'] || args.storeRoot || path.join('data', 'leads'));
const limit = Number(args.limit || 20);
const apply = Boolean(args.apply);
const entities = loadDiscoveryEntities({ storeRoot })
  .filter((entity) => entity.status === 'manual_review')
  .sort((a, b) => Number(b.latest?.discoveryScore || 0) - Number(a.latest?.discoveryScore || 0))
  .slice(0, limit);

const triage = entities.map((entity) => {
  const item = classify(entity);
  if (apply && item.nextStatus !== 'manual_review') {
    updateDiscoveryEntityStatus({
      entityKey: entity.entityKey,
      status: item.nextStatus,
      note: `Manual review triage: ${item.reason}`,
      storeRoot,
    });
  }
  return item;
});

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  apply,
  storeRoot,
  counts: triage.reduce((counts, item) => {
    counts[item.nextStatus] = (counts[item.nextStatus] || 0) + 1;
    return counts;
  }, {}),
  triage,
};

const outPath = path.join(storeRoot, 'queues', 'manual-review-triage.json');
writeJson(outPath, output);

console.log(JSON.stringify({
  ok: true,
  apply,
  outputPath: path.relative(process.cwd(), outPath),
  counts: output.counts,
  triage: triage.map((item) => ({
    entityKey: item.entityKey,
    name: item.name,
    nextStatus: item.nextStatus,
    reason: item.reason,
  })),
}, null, 2));

function classify(entity) {
  const latest = entity.latest || {};
  const score = Number(latest.discoveryScore || 0);
  const reviews = Number(latest.review_count || 0);
  const rating = Number(latest.rating || 0);
  const websiteStatus = latest.websiteStatus || '';
  const strongDemand = reviews >= 300 && rating >= 4.4;
  const mediumDemand = reviews >= 100 && rating >= 4.3;
  let nextStatus = 'manual_review';
  let reason = 'Keep in manual review; signal is not strong enough for cheap audit.';
  if (websiteStatus === 'independent_https_site' && (score >= 55 || strongDemand)) {
    nextStatus = 'queued_for_audit';
    reason = 'HTTPS site but demand is strong enough to justify cheap audit before spending on enrichment.';
  } else if (websiteStatus === 'independent_https_site' && mediumDemand) {
    nextStatus = 'manual_review';
    reason = 'Decent demand but HTTPS site may already be competent; operator should inspect before audit.';
  }
  return {
    entityKey: entity.entityKey,
    name: latest.name || '',
    website: latest.website || '',
    websiteStatus,
    discoveryScore: score,
    rating,
    reviewCount: reviews,
    phone: latest.phone || '',
    nextStatus,
    reason,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
