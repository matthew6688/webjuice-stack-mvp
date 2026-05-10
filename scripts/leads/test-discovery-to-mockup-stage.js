#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';
import { buildMapsScraperDiscoveryRun } from '../../core/leads/maps-scraper-discovery.js';
import { loadDiscoveryEntities, upsertDiscoveryRun, updateDiscoveryEntityStatus } from '../../core/leads/discovery-store.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'discovery-to-mockup-'));
const storeRoot = path.join(root, 'data', 'leads');
const clientsRoot = path.join(root, 'clients');
const casesRoot = path.join(root, 'data', 'cases');
const paidIntakesRoot = path.join(root, 'data', 'paid-intakes');
const publicRoot = path.join(root, 'public', 'admin-artifacts');
const entityKey = 'place_stage_place';

const run = buildMapsScraperDiscoveryRun({
  runId: 'stage-migration-test',
  query: 'restaurants in Stage City',
  niche: 'restaurant',
  city: 'Stage City',
  rows: [
    {
      title: 'Stage Place',
      category: 'Restaurant',
      address: '22 Stage St',
      phone: '0400 222 333',
      web_site: 'http://stage.example',
      review_count: 640,
      review_rating: 4.6,
      place_id: 'stage_place',
      link: 'https://maps.google.com/?cid=22',
    },
  ],
});

upsertDiscoveryRun(run, { storeRoot, runPath: 'fixture/discovery-run.json' });
writeDiscoveryAudit();
writeDiscoveryBrief();
updateDiscoveryEntityStatus({ entityKey, status: 'ready_for_outreach_brief', storeRoot });

let discoveryIndex = loadLeadOutreachIndex({ clientsRoot, casesRoot, paidIntakesRoot, discoveryRoot: storeRoot });
const discoveryRecord = discoveryIndex.records.find((record) => record.discoveryStoreKey === entityKey);
assert.ok(discoveryRecord, 'expected raw discovery record before promote');
assert.equal(discoveryRecord.pipelineStage, 'researching');

const promote = spawnSync(process.execPath, [
  'scripts/leads/promote-discovery-store-candidates.js',
  '--store-root', storeRoot,
  '--clients-root', clientsRoot,
  '--entity-key', entityKey,
  '--limit', '1',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
assert.equal(promote.status, 0, promote.stderr);
const promoteBody = JSON.parse(promote.stdout);
assert.equal(promoteBody.promoted.length, 1);
const clientSlug = promoteBody.promoted[0].clientSlug;
assert.equal(clientSlug, 'stage-place');

let leadIndex = loadLeadOutreachIndex({ clientsRoot, casesRoot, paidIntakesRoot, discoveryRoot: storeRoot });
const readyLead = leadIndex.records.find((record) => record.clientSlug === clientSlug);
assert.ok(readyLead, 'expected promoted lead record');
assert.equal(readyLead.pipelineStage, 'ready_for_mockup');
assert.equal(readyLead.currentSiteSalesDecision, 'build_mockup');
const promotedEntity = loadDiscoveryEntities({ storeRoot }).find((entity) => entity.entityKey === entityKey);
assert.equal(promotedEntity?.status, 'promoted');
assert.equal(promotedEntity?.promotedClientSlug, clientSlug);

const approve = spawnSync(process.execPath, [
  'scripts/leads/approve-mockup.js',
  '--client-slug', clientSlug,
  '--clients-root', clientsRoot,
  '--cases-root', casesRoot,
  '--paid-intakes-root', paidIntakesRoot,
  '--discovery-root', storeRoot,
  '--actor', 'stage-test',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
assert.equal(approve.status, 0, approve.stderr);
const approveBody = JSON.parse(approve.stdout);
assert.equal(approveBody.ok, true);
assert.equal(approveBody.nextExpectedStage, 'mockup_building');
assert.ok(fs.existsSync(approveBody.requestPath));

leadIndex = loadLeadOutreachIndex({ clientsRoot, casesRoot, paidIntakesRoot, discoveryRoot: storeRoot });
const mockupLead = leadIndex.records.find((record) => record.clientSlug === clientSlug);
assert.ok(mockupLead, 'expected lead after approval');
assert.equal(mockupLead.pipelineStage, 'mockup_building');
assert.equal(mockupLead.humanDecision.action, 'approve_mockup');
assert.equal(mockupLead.nextAction.label, '生成 outreach pack');

const buildArtifacts = spawnSync(process.execPath, [
  'scripts/leads/build-mockup-artifacts.js',
  '--client-slug', clientSlug,
  '--clients-root', clientsRoot,
  '--cases-root', casesRoot,
  '--paid-intakes-root', paidIntakesRoot,
  '--discovery-root', storeRoot,
  '--public-root', publicRoot,
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
assert.equal(buildArtifacts.status, 0, buildArtifacts.stderr);
const artifactsBody = JSON.parse(buildArtifacts.stdout);
assert.equal(artifactsBody.ok, true);
assert.equal(artifactsBody.nextExpectedStage, 'mockup_ready');
assert.ok(fs.existsSync(artifactsBody.packPath), 'expected outreach pack json');
assert.ok(fs.existsSync(artifactsBody.markdownPath), 'expected outreach pack markdown');
assert.ok(fs.existsSync(artifactsBody.manifestPath), 'expected mockup artifact manifest');
assert.ok(fs.existsSync(path.join(publicRoot, clientSlug, 'mockup-preview.html')), 'expected preview html');

leadIndex = loadLeadOutreachIndex({ clientsRoot, casesRoot, paidIntakesRoot, discoveryRoot: storeRoot });
const mockupReadyLead = leadIndex.records.find((record) => record.clientSlug === clientSlug);
assert.ok(mockupReadyLead, 'expected lead after mockup artifact build');
assert.equal(mockupReadyLead.pipelineStage, 'mockup_ready');
assert.equal(mockupReadyLead.assetsReady, true);
assert.equal(mockupReadyLead.previewUrl, `/admin-artifacts/${clientSlug}/mockup-preview.html`);
assert.equal(mockupReadyLead.nextAction.label, '生成 cold outreach draft');

const buildDraft = spawnSync(process.execPath, [
  'scripts/leads/build-outreach-email-draft.js',
  '--client-slug', clientSlug,
  '--clients-root', clientsRoot,
  '--cases-root', casesRoot,
  '--paid-intakes-root', paidIntakesRoot,
  '--discovery-root', storeRoot,
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
assert.equal(buildDraft.status, 0, buildDraft.stderr);
const draftBody = JSON.parse(buildDraft.stdout);
assert.equal(draftBody.ok, true);
assert.equal(draftBody.nextExpectedStage, 'draft_ready');
assert.ok(fs.existsSync(draftBody.artifactPath), 'expected outreach draft json');
assert.ok(fs.existsSync(draftBody.markdownPath), 'expected outreach draft markdown');

leadIndex = loadLeadOutreachIndex({ clientsRoot, casesRoot, paidIntakesRoot, discoveryRoot: storeRoot });
const draftReadyLead = leadIndex.records.find((record) => record.clientSlug === clientSlug);
assert.ok(draftReadyLead, 'expected lead after outreach draft build');
assert.equal(draftReadyLead.pipelineStage, 'draft_ready');
assert.equal(draftReadyLead.emailDraftReady, true);
assert.equal(draftReadyLead.nextAction.label, '发送或跟进 outreach');

console.log(JSON.stringify({
  ok: true,
  root,
  entityKey,
  clientSlug,
  stages: {
    discovery: discoveryRecord.pipelineStage,
    promoted: readyLead.pipelineStage,
    approved: mockupLead.pipelineStage,
    mockupReady: mockupReadyLead.pipelineStage,
    draftReady: draftReadyLead.pipelineStage,
  },
  evidence: {
    intake: path.join(clientsRoot, clientSlug, 'lead', 'lead-intake.json'),
    leadOps: path.join(clientsRoot, clientSlug, 'lead', 'lead-ops.json'),
    audit: path.join(clientsRoot, clientSlug, 'audit', 'current-site-audit.json'),
    note: path.join(clientsRoot, clientSlug, 'outreach', 'lead-notes.jsonl'),
    mockupRequest: approveBody.requestPath,
    outreachPack: artifactsBody.packPath,
    mockupArtifacts: artifactsBody.manifestPath,
    preview: path.join(publicRoot, clientSlug, 'mockup-preview.html'),
    outreachDraft: draftBody.artifactPath,
  },
}, null, 2));

function writeDiscoveryAudit() {
  const auditDir = path.join(storeRoot, 'audits', entityKey);
  fs.mkdirSync(auditDir, { recursive: true });
  fs.writeFileSync(path.join(auditDir, 'current-site-audit.json'), `${JSON.stringify({
    score: 42,
    verdict: 'clear_redesign_opportunity',
    salesDecision: 'build_mockup',
    opportunityConfidence: 'high',
    summary: 'The current site has a weak enquiry path and undersells proof.',
    outreachHook: 'Your site could make bookings and trust proof much easier to see.',
    openDesignDirection: 'Lead with proof, booking clarity, and local restaurant trust.',
    findings: [
      { severity: 'high', title: 'Weak booking path', evidence: 'Primary CTA is hard to find.' },
      { severity: 'medium', title: 'Thin proof', evidence: 'Reviews and venue proof are not prominent.' },
    ],
    priorityActions: [
      { fix: 'Move booking CTA into the first viewport.' },
      { fix: 'Add visible proof and local trust signals.' },
    ],
  }, null, 2)}\n`);
  for (const filename of ['current-site-audit.md', 'current-site.html', 'current-site-text.txt']) {
    fs.writeFileSync(path.join(auditDir, filename), 'stage fixture\n');
  }
}

function writeDiscoveryBrief() {
  const briefDir = path.join(storeRoot, 'outreach-briefs', entityKey);
  fs.mkdirSync(briefDir, { recursive: true });
  fs.writeFileSync(path.join(briefDir, 'outreach-brief.json'), `${JSON.stringify({
    entityKey,
    businessName: 'Stage Place',
    offerAngle: 'Make bookings and trust proof easier to see.',
  }, null, 2)}\n`);
}
