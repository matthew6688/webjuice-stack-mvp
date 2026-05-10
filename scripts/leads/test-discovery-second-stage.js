#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { buildMapsScraperDiscoveryRun } from '../../core/leads/maps-scraper-discovery.js';
import { upsertDiscoveryRun, updateDiscoveryEntityStatus } from '../../core/leads/discovery-store.js';

const storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-discovery-second-stage-'));
const run = buildMapsScraperDiscoveryRun({
  runId: 'second-stage-test',
  query: 'restaurants in Test City',
  niche: 'restaurant',
  city: 'Test City',
  rows: [
    {
      title: 'Audit Ready Cafe',
      category: 'Cafe',
      address: '1 Test St',
      phone: '0400 100 200',
      web_site: 'http://audit-ready.example',
      review_count: 700,
      review_rating: 4.8,
      place_id: 'audit_ready_place',
      link: 'https://maps.google.com/?cid=1',
    },
  ],
});
upsertDiscoveryRun(run, { storeRoot, runPath: 'fixture/discovery-run.json' });
const auditDir = path.join(storeRoot, 'audits', 'place_audit_ready_place');
fs.mkdirSync(auditDir, { recursive: true });
fs.writeFileSync(path.join(auditDir, 'current-site-audit.json'), `${JSON.stringify({
  score: 42,
  verdict: 'clear_redesign_opportunity',
  salesDecision: 'build_mockup',
  summary: 'The current site has a weak mobile conversion path.',
  outreachHook: 'Your Maps demand looks strong, but the website makes booking harder than it needs to be.',
  findings: [
    {
      severity: 'high',
      title: 'Booking path is weak',
      evidence: 'No booking CTA was captured above the fold.',
      fix: 'Add a persistent booking CTA.',
    },
  ],
}, null, 2)}\n`);
updateDiscoveryEntityStatus({
  entityKey: 'place_audit_ready_place',
  status: 'queued_for_enrichment',
  storeRoot,
});

const plan = runNode('scripts/leads/plan-discovery-enrichment.js', ['--store-root', storeRoot, '--limit', '1']);
assert.equal(plan.status, 0, plan.stderr);
const planJson = JSON.parse(plan.stdout);
assert.equal(planJson.selected, 1);
assert.match(planJson.items[0].tinyfishCommand, /--dry-run/);
assert.match(planJson.items[0].googlePlacesCommand, /--dry-run/);
assert.equal(planJson.items[0].costGate, 'planned');

const approveGate = runNode('scripts/leads/update-discovery-enrichment-gate.js', [
  '--store-root', storeRoot,
  '--entity-key', 'place_audit_ready_place',
  '--status', 'approved',
  '--operator', 'stage-test',
  '--note', 'Approved selected enrichment cost for high-confidence audit candidate.',
]);
assert.equal(approveGate.status, 0, approveGate.stderr);
const approveGateJson = JSON.parse(approveGate.stdout);
assert.equal(approveGateJson.status, 'approved');

const approvedPlan = runNode('scripts/leads/plan-discovery-enrichment.js', ['--store-root', storeRoot, '--limit', '1', '--live', 'true']);
assert.equal(approvedPlan.status, 0, approvedPlan.stderr);
const approvedPlanJson = JSON.parse(approvedPlan.stdout);
assert.equal(approvedPlanJson.items[0].costGate, 'approved');

const brief = runNode('scripts/leads/build-discovery-outreach-briefs.js', ['--store-root', storeRoot, '--limit', '1']);
assert.equal(brief.status, 0, brief.stderr);
const briefJson = JSON.parse(brief.stdout);
assert.equal(briefJson.count, 1);
assert.equal(briefJson.briefs[0].channelRecommendation, 'call_or_sms_first');
assert.ok(fs.existsSync(path.join(storeRoot, 'outreach-briefs', 'place_audit_ready_place', 'outreach-brief.json')));

console.log(JSON.stringify({
  ok: true,
  storeRoot,
  enrichmentPlan: planJson.outputPath,
  approvedGate: approveGateJson.path,
  brief: briefJson.briefs[0],
}, null, 2));

function runNode(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}
