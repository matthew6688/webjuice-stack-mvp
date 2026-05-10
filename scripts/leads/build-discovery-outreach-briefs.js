#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  buildDiscoveryQueues,
  loadDiscoveryEntities,
  updateDiscoveryEntityStatus,
} from '../../core/leads/discovery-store.js';

const args = parseArgs(process.argv.slice(2));
const storeRoot = path.resolve(args['store-root'] || args.storeRoot || path.join('data', 'leads'));
const limit = Number(args.limit || 5);
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const queues = buildDiscoveryQueues({ storeRoot, limit });
const entitiesByKey = new Map(loadDiscoveryEntities({ storeRoot }).map((entity) => [entity.entityKey, entity]));
const selected = queues.enrichment
  .map((item) => entitiesByKey.get(item.entityKey))
  .filter(Boolean)
  .slice(0, limit);

const briefs = [];
for (const entity of selected) {
  const brief = buildBrief(entity);
  if (!dryRun) {
    const outPath = path.join(storeRoot, 'outreach-briefs', entity.entityKey, 'outreach-brief.json');
    writeJson(outPath, brief);
    updateDiscoveryEntityStatus({
      entityKey: entity.entityKey,
      status: 'ready_for_outreach_brief',
      note: `Discovery outreach brief written: ${outPath}`,
      storeRoot,
    });
    brief.outputPath = outPath;
  }
  briefs.push(brief);
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  count: briefs.length,
  briefs: briefs.map((brief) => ({
    entityKey: brief.entityKey,
    businessName: brief.businessName,
    channelRecommendation: brief.channelRecommendation,
    offerAngle: brief.offerAngle,
    outputPath: brief.outputPath || '',
  })),
}, null, 2));

function buildBrief(entity) {
  const latest = entity.latest || {};
  const auditPath = path.join(storeRoot, 'audits', entity.entityKey, 'current-site-audit.json');
  const audit = readJsonIfExists(auditPath) || {};
  const topFindings = Array.isArray(audit.findings)
    ? audit.findings.filter((finding) => finding.severity !== 'low').slice(0, 3)
    : [];
  const businessName = latest.name || entity.entityKey;
  const firstName = String(businessName).split(/\s+/)[0] || 'there';
  const offerAngle = audit.outreachHook
    || topFindings[0]?.title
    || `${businessName} has strong Maps demand but needs a clearer website path.`;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceType: 'maps_scraper_discovery_store',
    entityKey: entity.entityKey,
    businessName,
    niche: latest.niche || latest.category || '',
    city: latest.city || '',
    phone: latest.phone || '',
    website: latest.website || '',
    googleMapsUrl: latest.google_maps_url || '',
    discoveryScore: latest.discoveryScore ?? null,
    websiteStatus: latest.websiteStatus || '',
    audit: {
      path: fs.existsSync(auditPath) ? auditPath : '',
      score: audit.score ?? null,
      verdict: audit.verdict || '',
      salesDecision: audit.salesDecision || '',
      summary: audit.summary || '',
      findings: topFindings.map((finding) => ({
        title: finding.title,
        severity: finding.severity,
        evidence: finding.evidence,
        fix: finding.fix,
      })),
    },
    channelRecommendation: latest.phone ? 'call_or_sms_first' : latest.website ? 'contact_form_or_manual_research' : 'manual_review',
    offerAngle,
    proofPoints: [
      latest.review_count ? `${latest.review_count} Google reviews listed in Maps scrape` : '',
      Number.isFinite(latest.rating) ? `${latest.rating} Maps rating` : '',
      audit.score ? `Cheap site audit score ${audit.score}/100` : '',
      audit.salesDecision ? `Audit decision: ${audit.salesDecision}` : '',
    ].filter(Boolean),
    coldMessageDraft: compactSentence(`Hey ${firstName}, I was looking at ${businessName}${latest.city ? ` in ${latest.city}` : ''}. ${offerAngle} I made a quick note on what I would tighten first; happy to send it over if useful.`),
    followUpDraft: compactSentence(`Quick follow-up on ${businessName}: the main opportunity I noticed is ${topFindings[0]?.fix || 'making the next step clearer on mobile'}. Worth me sending the short audit?`),
    guardrails: [
      'This is a draft, not a final send.',
      'Do not mention review body text.',
      'Do not claim Google API verification until it has been run.',
      'Find email/contact path only after operator accepts the offer angle.',
    ],
  };
}

function compactSentence(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
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
