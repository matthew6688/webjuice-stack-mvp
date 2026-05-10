#!/usr/bin/env node
/**
 * Live DDG SERP smoke test — runs Playwright against html.duckduckgo.com,
 * verifies SERP parses + V2 ledger writes.
 *
 * DDG can anti-bot the scraper. If we hit a block (DdgBlockedError), exit
 * with code 2 (skipped) rather than fail — DDG is a fallback, not primary.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import { ddgSearch, DdgBlockedError } from '../../core/scrape/ddg.js';
import { readLedger, summarizeLeadSpend } from '../../core/finance/ledger.js';
import { clearAllBuckets } from '../../core/util/token-bucket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const fixturesDir = path.join(repoRoot, 'data/v2/fixtures/ddg');
fs.mkdirSync(fixturesDir, { recursive: true });
const tmpLedger = fs.mkdtempSync(path.join(os.tmpdir(), 'ddg-smoke-')) + '/ledger.jsonl';

clearAllBuckets();

const query = 'roofing brisbane';
const leadId = 'ld_test_ddg_smoke';
const clientSlug = 'roo-roofing-brisbane';
const stage = 'enriched';

let payload;
try {
  payload = await ddgSearch({
    query,
    maxResults: 10,
    ledgerPath: tmpLedger,
    leadId, clientSlug, stage,
    purpose: 'lead_enrichment_search',
  });
} catch (err) {
  if (err instanceof DdgBlockedError) {
    // Verify the failure path still wrote a provider_unavailable ledger event
    const events = readLedger(tmpLedger);
    const blockedEvent = events.find((e) => e.category === 'provider_unavailable' && e.provider === 'ddg');
    assert.ok(blockedEvent, 'blocked DDG attempt should write provider_unavailable ledger event');
    assert.equal(blockedEvent.tier, 'T0');
    assert.equal(blockedEvent.leadId, leadId);
    assert.equal(blockedEvent.metadata.reason, err.reason);
    console.log(JSON.stringify({
      ok: false, skipped: true, reason: 'DDG anti-bot blocked', detail: err.reason,
      ledgerEventLoggedOnFailure: true,
      blockedEventReason: blockedEvent.metadata.reason,
    }));
    process.exit(2);
  }
  throw err;
}

assert.ok(Array.isArray(payload.results));
assert.ok(payload.results.length >= 5, `expected ≥5 results, got ${payload.results.length}`);
const r0 = payload.results[0];
assert.ok(r0.url && r0.title, 'first result has url + title');
assert.equal(r0.position, 1);

const events = readLedger(tmpLedger);
assert.equal(events.length, 1);
const event = events[0];
assert.equal(event.category, 'ddg_local');
assert.equal(event.tier, 'T0');
assert.equal(event.amount, 0);
assert.equal(event.leadId, leadId);
assert.equal(event.clientSlug, clientSlug);
assert.equal(event.metadata.endpoint, 'search');
assert.equal(event.metadata.query, query);
assert.equal(event.metadata.results_count, payload.results.length);
assert.ok(event.requestHash && event.requestHash.length === 64);

const leadSpend = summarizeLeadSpend(events, leadId);
assert.equal(leadSpend.totalCost, 0);

const fixturePath = path.join(fixturesDir, 'search-roofing-brisbane.json');
fs.writeFileSync(fixturePath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  request: { query, maxResults: 10 },
  response: payload,
}, null, 2) + '\n');

console.log(JSON.stringify({
  ok: true,
  liveSearch: {
    query,
    resultCount: payload.results.length,
    topResult: { position: r0.position, title: r0.title, url: r0.url },
    latencyMs: event.metadata.latency_ms,
  },
  ledger: {
    eventCount: events.length,
    category: event.category,
    tier: event.tier,
    amount: event.amount,
    requestHash: event.requestHash.slice(0, 12) + '...',
    leadSpendTotal: leadSpend.totalCost,
  },
  fixture: fixturePath,
  assertions: {
    serpReturnsResults: true,
    firstResultParsed: true,
    v2LedgerFieldsCorrect: true,
    requestHashSha256: true,
    leadSpendRollup: true,
  },
}, null, 2));
