#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  WEBSITE_STATUS,
  buildMapsScraperDiscoveryRun,
  readMapsScraperJsonl,
  writeMapsScraperDiscoveryRun,
} from '../../core/leads/maps-scraper-discovery.js';

const rows = [
  {
    title: 'No Site Dumplings',
    category: 'Chinese restaurant',
    address: '1 Test St',
    phone: '0400 000 000',
    review_count: 900,
    review_rating: 4.7,
    place_id: 'place_no_site',
    link: 'https://maps.google.com/?cid=1',
    images: Array.from({ length: 10 }, (_, index) => ({ title: String(index), image: `https://img/${index}` })),
  },
  {
    title: 'Facebook Only Cafe',
    category: 'Cafe',
    address: '2 Test St',
    phone: '0400 000 001',
    web_site: 'https://facebook.com/testcafe',
    review_count: 200,
    review_rating: 4.8,
    place_id: 'place_social',
  },
  {
    title: 'Old HTTP Grill',
    category: 'Restaurant',
    address: '3 Test St',
    phone: '0400 000 002',
    web_site: 'http://old-grill.example',
    review_count: 600,
    review_rating: 4.6,
    place_id: 'place_http',
  },
  {
    title: 'Polished Site Dining',
    category: 'Restaurant',
    address: '4 Test St',
    phone: '0400 000 003',
    web_site: 'https://polished.example',
    review_count: 1600,
    review_rating: 4.7,
    place_id: 'place_polished',
  },
  {
    title: 'Search Agency Pty Ltd',
    category: 'Internet marketing service',
    address: '5 Test St',
    phone: '0400 000 004',
    web_site: 'https://agency.example',
    review_count: 300,
    review_rating: 4.9,
    place_id: 'place_irrelevant',
  },
];

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maps-scraper-discovery-'));
const rawPath = path.join(tempDir, 'results.maps.json');
fs.writeFileSync(rawPath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);

const parsedRows = readMapsScraperJsonl(rawPath);
const run = buildMapsScraperDiscoveryRun({
  rows: parsedRows,
  query: 'restaurants in Test City',
  niche: 'restaurant',
  city: 'Test City',
  runId: 'test-run',
});
const outputs = writeMapsScraperDiscoveryRun(run, tempDir);

assert.equal(run.totals.rawRows, 5);
assert.equal(run.costPolicy.googlePlacesApi, 'not_used_in_discovery');
assert.equal(run.costPolicy.emailExtraction, 'disabled');
assert.equal(run.costPolicy.reviewBodyExtraction, 'disabled');
assert.equal(run.leads[0].websiteStatus, WEBSITE_STATUS.NO_WEBSITE);
assert.equal(run.queue.starterCandidates.length, 2);
assert.equal(run.queue.auditCandidates.length, 1);
assert.ok(run.queue.manualReview.length + run.queue.skipped.length >= 1);
const irrelevant = run.leads.find((lead) => lead.place_id === 'place_irrelevant');
assert.equal(irrelevant.relevance.relevant, false);
assert.equal(irrelevant.recommendedAction, 'skip');
assert.ok(fs.existsSync(outputs.discoveryRun));
assert.ok(fs.existsSync(outputs.compactLeads));
assert.ok(fs.existsSync(outputs.toolLog));

console.log(JSON.stringify({
  ok: true,
  tempDir,
  totals: run.totals,
  topLead: run.leads[0],
}, null, 2));
