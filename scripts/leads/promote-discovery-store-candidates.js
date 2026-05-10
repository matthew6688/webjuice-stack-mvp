#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createLeadIntake, saveLeadIntake } from '../../core/leads/intake.js';
import { runLeadOps, saveLeadOpsArtifacts } from '../../core/leads/lead-ops.js';
import {
  loadDiscoveryEntities,
  updateDiscoveryEntityStatus,
} from '../../core/leads/discovery-store.js';

const args = parseArgs(process.argv.slice(2));
const storeRoot = path.resolve(args['store-root'] || args.storeRoot || path.join('data', 'leads'));
const clientsRoot = args['clients-root'] || args.clientsRoot || 'clients';
const limit = Number(args.limit || args.top || 3);
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const runLeadOpsFlag = args['run-lead-ops'] !== 'false' && args.runLeadOps !== 'false';
const explicitKeys = String(args['entity-key'] || args.entityKey || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const entities = loadDiscoveryEntities({ storeRoot });
const selected = selectEntities(entities).slice(0, limit);
const promoted = [];

for (const entity of selected) {
  const latest = entity.latest || {};
  const clientSlug = uniqueClientSlug(slugify(latest.name || entity.entityKey), clientsRoot);
  const clientDir = path.join(clientsRoot, clientSlug);
  const leadDir = path.join(clientDir, 'lead');
  const auditDir = path.join(clientDir, 'audit');
  const outreachDir = path.join(clientDir, 'outreach');
  const discoveryAuditDir = path.join(storeRoot, 'audits', entity.entityKey);
  const discoveryBriefPath = path.join(storeRoot, 'outreach-briefs', entity.entityKey, 'outreach-brief.json');
  const discoveryBrief = readJsonIfExists(discoveryBriefPath) || {};
  const auditJson = readJsonIfExists(path.join(discoveryAuditDir, 'current-site-audit.json')) || {};

  const intake = createLeadIntake({
    sourceType: 'maps_scraper',
    clientSlug,
    leadId: entity.entityKey,
    businessName: latest.name,
    industry: latest.category || latest.niche,
    city: latest.city,
    websiteUrl: latest.website,
    googleMapsUrl: latest.google_maps_url,
    phone: latest.phone,
    address: latest.address,
    rating: latest.rating,
    reviewCount: latest.review_count,
    observations: [
      latest.websiteStatus ? `Maps scraper website status: ${latest.websiteStatus}.` : '',
      Number.isFinite(latest.discoveryScore) ? `Discovery score: ${latest.discoveryScore}.` : '',
      discoveryBrief.offerAngle ? `Discovery offer angle: ${discoveryBrief.offerAngle}` : '',
      auditJson.summary ? `Cheap site audit summary: ${auditJson.summary}` : '',
    ].filter(Boolean),
    services: latest.categories || [],
    rawInputs: {
      discoveryStoreEntity: path.join(storeRoot, 'entities', `${entity.entityKey}.json`),
      discoveryAudit: fs.existsSync(path.join(discoveryAuditDir, 'current-site-audit.json')) ? path.join(discoveryAuditDir, 'current-site-audit.json') : '',
      discoveryOutreachBrief: fs.existsSync(discoveryBriefPath) ? discoveryBriefPath : '',
    },
  });

  const discoveryLogEntry = {
    at: new Date().toISOString(),
    event: 'discovery_store_candidate_promoted',
    sourceType: 'maps_scraper',
    tool: 'lead discovery store',
    entityKey: entity.entityKey,
    storeRoot,
    discoveryScore: latest.discoveryScore ?? null,
    recommendedAction: latest.recommendedAction || '',
    websiteStatus: latest.websiteStatus || '',
    auditPath: path.join(discoveryAuditDir, 'current-site-audit.json'),
    outreachBriefPath: discoveryBriefPath,
    costPolicy: {
      googlePlacesApi: 'not_used',
      emailExtraction: 'not_used',
      reviewBodyExtraction: 'not_used',
      promotedFrom: 'discovery_store',
    },
  };

  if (!dryRun) {
    fs.mkdirSync(leadDir, { recursive: true });
    fs.mkdirSync(auditDir, { recursive: true });
    fs.mkdirSync(outreachDir, { recursive: true });
    saveLeadIntake(intake, path.join(leadDir, 'lead-intake.json'));
    fs.appendFileSync(path.join(leadDir, 'discovery-log.jsonl'), `${JSON.stringify(discoveryLogEntry)}\n`, 'utf8');
    copyAuditArtifacts(discoveryAuditDir, auditDir);
    if (fs.existsSync(discoveryBriefPath)) {
      fs.copyFileSync(discoveryBriefPath, path.join(outreachDir, 'discovery-outreach-brief.json'));
    }
    if (runLeadOpsFlag) {
      const leadOps = runLeadOps({
        clientSlug,
        intake,
        currentSiteAudit: auditJson,
        sourceType: 'maps_scraper',
        paths: {
          intake: path.join(leadDir, 'lead-intake.json'),
          research: path.join(leadDir, 'lead-research.json'),
          redesignCheck: path.join(leadDir, 'redesign-check.json'),
          readyToBuild: path.join(leadDir, 'ready-to-build.json'),
          outreachBrief: path.join(outreachDir, 'outreach-brief.json'),
          leadOps: path.join(leadDir, 'lead-ops.json'),
        },
      });
      saveLeadOpsArtifacts(leadOps);
    }
    updateDiscoveryEntityStatus({
      entityKey: entity.entityKey,
      status: 'promoted',
      clientSlug,
      note: `Promoted from discovery store to ${clientSlug}.`,
      storeRoot,
    });
  }

  promoted.push({
    entityKey: entity.entityKey,
    businessName: latest.name || '',
    clientSlug,
    dryRun,
    runLeadOps: runLeadOpsFlag,
    paths: {
      intake: path.join(leadDir, 'lead-intake.json'),
      audit: path.join(auditDir, 'current-site-audit.json'),
      discoveryLog: path.join(leadDir, 'discovery-log.jsonl'),
      discoveryOutreachBrief: path.join(outreachDir, 'discovery-outreach-brief.json'),
      leadOps: path.join(leadDir, 'lead-ops.json'),
    },
  });
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  selected: selected.length,
  promoted,
}, null, 2));

function selectEntities(allEntities) {
  if (explicitKeys.length) {
    const keySet = new Set(explicitKeys);
    return allEntities.filter((entity) => keySet.has(entity.entityKey));
  }
  return allEntities
    .filter((entity) => entity.status === 'ready_for_outreach_brief')
    .filter((entity) => !entity.promotedClientSlug)
    .sort((a, b) => Number(b.latest?.discoveryScore || 0) - Number(a.latest?.discoveryScore || 0));
}

function copyAuditArtifacts(fromDir, toDir) {
  for (const filename of [
    'current-site-desktop.png',
    'current-site-mobile.png',
    'current-site.html',
    'current-site-text.txt',
    'current-site-audit.json',
    'current-site-audit.md',
  ]) {
    const from = path.join(fromDir, filename);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(toDir, filename));
  }
}

function uniqueClientSlug(baseSlug, root) {
  let slug = baseSlug || 'unknown-lead';
  let index = 2;
  while (fs.existsSync(path.join(root, slug))) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }
  return slug;
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function slugify(value) {
  return String(value || 'unknown-lead')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown-lead';
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
