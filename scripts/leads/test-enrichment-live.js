#!/usr/bin/env node
/**
 * Live enrichment test on a real entity from data/leads/entities.
 *
 * Default target: Regan Brothers Roof Restoration (the only no_website
 * roofing entity in the store) — the V2 high-value test case for whether
 * search alone can fill the gaps.
 *
 * Usage:
 *   npm run leads:test-enrichment-live
 *   npm run leads:test-enrichment-live -- --entity-key place_chij...
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import { enrichLead } from '../../core/leads/enrichment.js';
import { readLedger, summarizeLeadSpend } from '../../core/finance/ledger.js';
import { clearAllBuckets } from '../../core/util/token-bucket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

loadDotEnvLocal(path.join(repoRoot, '.env.local'));

const args = parseArgs(process.argv.slice(2));
const entitiesDir = path.join(repoRoot, 'data/leads/entities');

let targetEntityKey = args['entity-key'] || '';
if (!targetEntityKey) {
  // Find the no_website roofing entity (Regan Brothers)
  for (const f of fs.readdirSync(entitiesDir)) {
    const e = JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8'));
    if (e.latest?.websiteStatus === 'no_website' && (e.latest?.category || '').includes('oof')) {
      targetEntityKey = e.entityKey;
      break;
    }
  }
}
if (!targetEntityKey) {
  console.error('No target entity found. Pass --entity-key explicitly.');
  process.exit(1);
}

const entityPath = path.join(entitiesDir, `${targetEntityKey}.json`);
if (!fs.existsSync(entityPath)) {
  console.error(`entity not found: ${entityPath}`);
  process.exit(1);
}
const entity = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

console.log(`Target: ${entity.latest.name}`);
console.log(`  websiteStatus: ${entity.latest.websiteStatus}`);
console.log(`  rating/reviews: ★${entity.latest.rating} (${entity.latest.review_count})`);
console.log(`  address: ${entity.latest.address}`);
console.log(`  phone: ${entity.latest.phone}`);
console.log('');

const tmpLedger = fs.mkdtempSync(path.join(os.tmpdir(), 'enrich-live-')) + '/ledger.jsonl';
const fixturesDir = path.join(repoRoot, 'data/v2/fixtures/enrichment');
fs.mkdirSync(fixturesDir, { recursive: true });

clearAllBuckets();
const start = Date.now();
const { profile, routes } = await enrichLead({
  entity,
  leadId: entity.entityKey,
  clientSlug: slugifyName(entity.latest.name),
  stage: 'queued_for_enrichment',
  location: 'AU',
  ledgerPath: tmpLedger,
});
const elapsed = Date.now() - start;

const events = readLedger(tmpLedger);

// Hard evidence assertions
assert.ok(profile.business_name, 'business_name set');
assert.ok(profile.enriched_at, 'enriched_at timestamp');
assert.ok(profile.enrichment_trace.queries_run >= 5, 'at least 5 search routes attempted');
assert.equal(profile.enrichment_trace.routes.length, profile.enrichment_trace.queries_run);
assert.ok(events.length >= profile.enrichment_trace.queries_run, 'each route writes ≥1 ledger event');

const leadSpend = summarizeLeadSpend(events, entity.entityKey);
assert.equal(leadSpend.totalCost, 0, 'enrichment is T0 (free)');

// Save fixture
const fixturePath = path.join(fixturesDir, `${targetEntityKey}.json`);
fs.writeFileSync(fixturePath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  entity_input: { entityKey: entity.entityKey, latest: entity.latest, identifiers: entity.identifiers },
  profile,
  routes_summary: routes.map((r) => ({
    purpose: r.purpose, ok: r.ok, provider: r.provider,
    result_count: r.results?.length || 0,
    top_3: (r.results || []).slice(0, 3).map((x) => ({ position: x.position, title: x.title, url: x.url })),
    error: r.error,
  })),
  ledger_summary: {
    eventCount: events.length,
    total_cost: leadSpend.totalCost,
    by_purpose: events.reduce((a, e) => ({ ...a, [e.purpose]: (a[e.purpose] || 0) + 1 }), {}),
  },
  total_elapsed_ms: elapsed,
}, null, 2) + '\n');

// Console output — what did we discover?
console.log(JSON.stringify({
  ok: true,
  target: { entityKey: entity.entityKey, name: entity.latest.name, websiteStatus: entity.latest.websiteStatus },
  enrichment_summary: {
    queries_run: profile.enrichment_trace.queries_run,
    queries_succeeded: profile.enrichment_trace.queries_succeeded,
    total_search_results: profile.enrichment_trace.total_results,
    elapsed_seconds: (elapsed / 1000).toFixed(1),
  },
  discovered: {
    website: profile.contact.website || '(none found)',
    socials: Object.fromEntries(Object.entries(profile.contact.social).map(([k, v]) => [k, v ? '✓ ' + v : '—'])),
    third_party_reviews: profile.third_party_reviews.map((r) => `${r.source}: ${r.url}`),
    decision_maker: profile.decision_maker || '(not yet — will require deeper search)',
    evidence_source_count: profile.evidence_sources.length,
  },
  ledger: {
    events: events.length,
    total_cost: leadSpend.totalCost,
    all_T0: events.every((e) => e.tier === 'T0'),
  },
  fixture: fixturePath,
  per_route: profile.enrichment_trace.routes,
}, null, 2));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      out[k] = v;
    }
  }
  return out;
}

function slugifyName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function loadDotEnvLocal(p) {
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
