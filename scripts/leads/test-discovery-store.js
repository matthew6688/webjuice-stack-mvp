#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildDiscoveryQueues,
  buildDiscoveryReport,
  loadDiscoveryIndex,
  upsertDiscoveryRun,
  updateDiscoveryEntityStatus,
} from '../../core/leads/discovery-store.js';
import { buildMapsScraperDiscoveryRun } from '../../core/leads/maps-scraper-discovery.js';

const storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-discovery-store-'));

const rows = [
  {
    title: 'Repeat Cafe',
    category: 'Cafe',
    address: '1 Test St, Test City',
    phone: '0400 000 100',
    web_site: 'https://facebook.com/repeatcafe',
    review_count: 500,
    review_rating: 4.8,
    place_id: 'repeat_place',
    link: 'https://maps.google.com/?cid=100',
  },
  {
    title: 'Audit Grill',
    category: 'Restaurant',
    address: '2 Test St, Test City',
    phone: '0400 000 200',
    web_site: 'http://audit-grill.example',
    review_count: 850,
    review_rating: 4.5,
    place_id: 'audit_place',
    link: 'https://maps.google.com/?cid=200',
  },
];

const runOne = buildMapsScraperDiscoveryRun({
  rows,
  query: 'restaurants in Test City',
  niche: 'restaurant',
  city: 'Test City',
  runId: 'store-test-1',
});
const first = upsertDiscoveryRun(runOne, { storeRoot, runPath: 'data/maps-scraper/runs/store-test-1/discovery-run.json' });
assert.equal(first.indexed, 2);
assert.equal(first.uniqueEntities, 2);

const runTwo = buildMapsScraperDiscoveryRun({
  rows: rows.map((row) => ({ ...row, review_count: Number(row.review_count) + 1 })),
  query: 'restaurants in Test City',
  niche: 'restaurant',
  city: 'Test City',
  runId: 'store-test-2',
});
const second = upsertDiscoveryRun(runTwo, { storeRoot, runPath: 'data/maps-scraper/runs/store-test-2/discovery-run.json' });
assert.equal(second.indexed, 2);
assert.equal(second.uniqueEntities, 2, 'repeat scrape should dedupe by place_id');

const index = loadDiscoveryIndex({ storeRoot });
assert.equal(index.totals.entities, 2);
assert.ok(index.statusCounts.scored >= 1);
assert.ok(index.statusCounts.queued_for_audit >= 1);

const promoted = updateDiscoveryEntityStatus({
  entityKey: 'place_repeat_place',
  status: 'promoted',
  clientSlug: 'repeat-cafe',
  storeRoot,
});
assert.equal(promoted.ok, true);
const audited = updateDiscoveryEntityStatus({
  entityKey: 'place_audit_place',
  status: 'queued_for_enrichment',
  note: 'Synthetic cheap audit passed.',
  storeRoot,
});
assert.equal(audited.ok, true);

const queues = buildDiscoveryQueues({ storeRoot });
assert.equal(queues.cheapSiteAudit.length, 0, 'audited candidates should leave the cheap audit queue');
assert.ok(queues.enrichment.length >= 1);
assert.ok(fs.existsSync(path.join(storeRoot, 'queues', 'queues.json')));

const { report, reportPath } = buildDiscoveryReport({ storeRoot });
assert.equal(report.totals.entities, 2);
assert.ok(fs.existsSync(reportPath));
assert.ok(fs.existsSync(path.join(storeRoot, 'discovery-events.jsonl')));

console.log(JSON.stringify({
  ok: true,
  storeRoot,
  totals: report.totals,
  statusCounts: report.statusCounts,
  queueCounts: {
    cheapSiteAudit: queues.cheapSiteAudit.length,
    enrichment: queues.enrichment.length,
    outreachBrief: queues.outreachBrief.length,
  },
  reportPath,
}, null, 2));
