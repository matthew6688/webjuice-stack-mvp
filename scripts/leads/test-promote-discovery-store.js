#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { buildMapsScraperDiscoveryRun } from '../../core/leads/maps-scraper-discovery.js';
import { upsertDiscoveryRun, updateDiscoveryEntityStatus } from '../../core/leads/discovery-store.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-discovery-store-'));
const storeRoot = path.join(root, 'data', 'leads');
const clientsRoot = path.join(root, 'clients');
const entityKey = 'place_promo_place';
const run = buildMapsScraperDiscoveryRun({
  runId: 'promote-store-test',
  query: 'restaurants in Test City',
  niche: 'restaurant',
  city: 'Test City',
  rows: [
    {
      title: 'Promo Place',
      category: 'Restaurant',
      address: '9 Test St',
      phone: '0400 333 444',
      web_site: 'http://promo.example',
      review_count: 800,
      review_rating: 4.7,
      place_id: 'promo_place',
      link: 'https://maps.google.com/?cid=9',
    },
  ],
});
upsertDiscoveryRun(run, { storeRoot, runPath: 'fixture/discovery-run.json' });

const auditDir = path.join(storeRoot, 'audits', entityKey);
fs.mkdirSync(auditDir, { recursive: true });
fs.writeFileSync(path.join(auditDir, 'current-site-audit.json'), `${JSON.stringify({
  score: 40,
  verdict: 'clear_redesign_opportunity',
  salesDecision: 'build_mockup',
  summary: 'The current website has a weak enquiry path.',
  findings: [],
}, null, 2)}\n`);
for (const filename of ['current-site-audit.md', 'current-site.html', 'current-site-text.txt']) {
  fs.writeFileSync(path.join(auditDir, filename), 'fixture\n');
}
updateDiscoveryEntityStatus({ entityKey, status: 'ready_for_outreach_brief', storeRoot });

const briefDir = path.join(storeRoot, 'outreach-briefs', entityKey);
fs.mkdirSync(briefDir, { recursive: true });
fs.writeFileSync(path.join(briefDir, 'outreach-brief.json'), `${JSON.stringify({
  entityKey,
  businessName: 'Promo Place',
  offerAngle: 'The enquiry path can be clearer.',
}, null, 2)}\n`);

const result = spawnSync(process.execPath, [
  'scripts/leads/promote-discovery-store-candidates.js',
  '--store-root', storeRoot,
  '--clients-root', clientsRoot,
  '--limit', '1',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

assert.equal(result.status, 0, result.stderr);
const body = JSON.parse(result.stdout);
assert.equal(body.promoted.length, 1);
const promoted = body.promoted[0];
assert.equal(promoted.clientSlug, 'promo-place');
assert.ok(fs.existsSync(path.join(clientsRoot, 'promo-place', 'lead', 'lead-intake.json')));
assert.ok(fs.existsSync(path.join(clientsRoot, 'promo-place', 'lead', 'lead-ops.json')));
assert.ok(fs.existsSync(path.join(clientsRoot, 'promo-place', 'audit', 'current-site-audit.json')));
assert.ok(fs.existsSync(path.join(clientsRoot, 'promo-place', 'outreach', 'discovery-outreach-brief.json')));

const entity = JSON.parse(fs.readFileSync(path.join(storeRoot, 'entities', `${entityKey}.json`), 'utf8'));
assert.equal(entity.status, 'promoted');
assert.equal(entity.promotedClientSlug, 'promo-place');

console.log(JSON.stringify({
  ok: true,
  root,
  promoted,
}, null, 2));
