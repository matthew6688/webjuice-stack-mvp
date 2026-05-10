#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { buildMapsScraperDiscoveryRun } from '../../core/leads/maps-scraper-discovery.js';
import { loadDiscoveryEntities, upsertDiscoveryRun } from '../../core/leads/discovery-store.js';

const storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-triage-'));
const run = buildMapsScraperDiscoveryRun({
  runId: 'manual-triage-test',
  query: 'restaurants in Test City',
  city: 'Test City',
  niche: 'restaurant',
  rows: [
    {
      title: 'Strong HTTPS',
      category: 'Restaurant',
      phone: '0400 111 222',
      web_site: 'https://strong.example',
      review_count: 900,
      review_rating: 4.8,
      place_id: 'strong_https',
    },
    {
      title: 'Okay HTTPS',
      category: 'Restaurant',
      phone: '0400 111 333',
      web_site: 'https://okay.example',
      review_count: 130,
      review_rating: 4.4,
      place_id: 'okay_https',
    },
  ],
});
upsertDiscoveryRun(run, { storeRoot, runPath: 'fixture/discovery-run.json' });

const result = spawnSync(process.execPath, [
  'scripts/leads/triage-discovery-manual-review.js',
  '--store-root', storeRoot,
  '--apply',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

assert.equal(result.status, 0, result.stderr);
const body = JSON.parse(result.stdout);
assert.equal(body.ok, true);
assert.ok(body.counts.queued_for_audit >= 1);
const entities = loadDiscoveryEntities({ storeRoot });
assert.equal(entities.find((entity) => entity.entityKey === 'place_strong_https')?.status, 'queued_for_audit');

console.log(JSON.stringify({
  ok: true,
  storeRoot,
  counts: body.counts,
  outputPath: body.outputPath,
}, null, 2));
