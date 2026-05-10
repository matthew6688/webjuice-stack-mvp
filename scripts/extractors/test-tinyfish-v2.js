#!/usr/bin/env node
/**
 * Live Tinyfish V2 test:
 *  - real api.search.tinyfish.ai call (search "roofing brisbane" AU)
 *  - real api.fetch.tinyfish.ai call (top result from above)
 *  - ledger writes verified with V2 fields (tier=T0, leadId, stage, purpose)
 *  - mocked rate-limit scenario verifies token bucket gating + ledger write
 *  - fixtures saved to data/v2/fixtures/tinyfish/ for downstream blocks
 *
 * Skips live calls if TINYFISH_API_KEY not in env. Loads .env.local manually.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import { tinyfishSearch, tinyfishFetchUrls, TinyFishRateLimitedError } from '../../core/extractors/tinyfish.js';
import { readLedger, summarizeLeadSpend } from '../../core/finance/ledger.js';
import { TokenBucket, clearAllBuckets } from '../../core/util/token-bucket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

// Load .env.local for the API key (existing pattern in the repo doesn't auto-load)
loadDotEnvLocal(path.join(repoRoot, '.env.local'));

if (!process.env.TINYFISH_API_KEY) {
  console.log(JSON.stringify({ ok: false, reason: 'TINYFISH_API_KEY not set, skipping live test' }));
  process.exit(2);
}

const fixturesDir = path.join(repoRoot, 'data/v2/fixtures/tinyfish');
fs.mkdirSync(fixturesDir, { recursive: true });

// Use a temp ledger so we don't pollute the real ledger
const tmpLedger = fs.mkdtempSync(path.join(os.tmpdir(), 'tinyfish-v2-')) + '/ledger.jsonl';

const leadId = 'ld_test_tinyfish_v2';
const clientSlug = 'roo-roofing-brisbane';
const stage = 'enriched';

clearAllBuckets();

// ─── 1. Live SEARCH ────────────────────────────────────────────────────────
const search = await tinyfishSearch({
  query: 'roofing brisbane',
  location: 'AU',
  language: 'en',
  ledgerPath: tmpLedger,
  leadId, clientSlug, stage,
  purpose: 'lead_enrichment_search',
});

assert.ok(Array.isArray(search.results), 'search returns results array');
assert.ok(search.results.length >= 5, `expected ≥5 results, got ${search.results.length}`);
const r0 = search.results[0];
assert.ok(r0.url && r0.title && r0.snippet, 'first result has url/title/snippet');
assert.ok(typeof r0.position === 'number');

const searchFixture = path.join(fixturesDir, 'search-roofing-brisbane.json');
fs.writeFileSync(searchFixture, JSON.stringify({
  generatedAt: new Date().toISOString(),
  request: { query: 'roofing brisbane', location: 'AU', language: 'en' },
  response: search,
}, null, 2) + '\n');

// ─── 2. Live FETCH on the #1 result ────────────────────────────────────────
const targetUrl = r0.url;
const fetchPayload = await tinyfishFetchUrls({
  urls: [targetUrl],
  format: 'markdown',
  ledgerPath: tmpLedger,
  leadId, clientSlug, stage,
  purpose: 'lead_enrichment_fetch',
});

assert.ok(Array.isArray(fetchPayload.results), 'fetch returns results array');
assert.equal(fetchPayload.results.length, 1, 'one URL in → one result out');
const f0 = fetchPayload.results[0];
assert.ok(f0.title && f0.title.length > 0, 'fetch result has title');
assert.ok(f0.text && f0.text.length > 100, `expected substantial text, got ${f0.text?.length || 0} chars`);
assert.equal(f0.format, 'markdown');

const fetchFixture = path.join(fixturesDir, 'fetch-top-result.json');
fs.writeFileSync(fetchFixture, JSON.stringify({
  generatedAt: new Date().toISOString(),
  request: { urls: [targetUrl], format: 'markdown' },
  response: fetchPayload,
}, null, 2) + '\n');

// ─── 3. Ledger writes — V2 fields ──────────────────────────────────────────
const events = readLedger(tmpLedger);
assert.equal(events.length, 2, `expected 2 ledger events (search + fetch), got ${events.length}`);

const searchEvent = events.find((e) => e.category === 'tinyfish_search');
const fetchEvent = events.find((e) => e.category === 'tinyfish_fetch');
assert.ok(searchEvent, 'tinyfish_search event written');
assert.ok(fetchEvent, 'tinyfish_fetch event written');

for (const e of [searchEvent, fetchEvent]) {
  assert.equal(e.tier, 'T0');
  assert.equal(e.amount, 0);
  assert.equal(e.leadId, leadId);
  assert.equal(e.clientSlug, clientSlug);
  assert.equal(e.stage, stage);
  assert.ok(e.requestHash && e.requestHash.length === 64, 'requestHash is sha256 hex');
  assert.equal(e.provider, 'tinyfish');
  assert.ok(e.metadata.latency_ms > 0);
  assert.equal(e.metadata.http_status, 200);
}
assert.equal(searchEvent.metadata.results_count, search.results.length);
assert.equal(fetchEvent.metadata.results_count, 1);

const leadSpend = summarizeLeadSpend(events, leadId);
assert.equal(leadSpend.totalCost, 0);
assert.equal(leadSpend.eventCount, 2);
assert.equal(leadSpend.byTier.T0, 0);

// ─── 4. Rate-limit gate (mocked, no live calls) ────────────────────────────
// Create an isolated tiny bucket and hit search() with a mock fetch
const tinyBucket = new TokenBucket({ ratePerMinute: 60, capacity: 2 });
const mockFetch = async () => ({ ok: true, status: 200, json: async () => ({ results: [], total_results: 0 }) });
const rlLedger = fs.mkdtempSync(path.join(os.tmpdir(), 'tinyfish-rl-')) + '/ledger.jsonl';

await tinyfishSearch({
  query: 'q1', fetchImpl: mockFetch, bucket: tinyBucket,
  ledgerPath: rlLedger, leadId: 'rl_test', clientSlug: 'rl', stage: 'enriched',
});
await tinyfishSearch({
  query: 'q2', fetchImpl: mockFetch, bucket: tinyBucket,
  ledgerPath: rlLedger, leadId: 'rl_test', clientSlug: 'rl', stage: 'enriched',
});

// 3rd call should be locally rate-limited
await assert.rejects(
  () => tinyfishSearch({
    query: 'q3', fetchImpl: mockFetch, bucket: tinyBucket,
    ledgerPath: rlLedger, leadId: 'rl_test', clientSlug: 'rl', stage: 'enriched',
  }),
  (err) => {
    assert.ok(err instanceof TinyFishRateLimitedError);
    assert.ok(err.retryAfterMs > 0);
    return true;
  },
);

const rlEvents = readLedger(rlLedger);
const rateLimitedEvent = rlEvents.find((e) => e.category === 'provider_rate_limited');
assert.ok(rateLimitedEvent, 'provider_rate_limited ledger event written on local-bucket exhaustion');
assert.equal(rateLimitedEvent.metadata.reason, 'local_token_bucket');
assert.equal(rateLimitedEvent.metadata.endpoint, 'search');

// ─── 5. Remote 429 → TinyFishRateLimitedError + ledger ─────────────────────
const remote429Bucket = new TokenBucket({ ratePerMinute: 60, capacity: 5 });
const fetch429 = async () => ({ ok: false, status: 429, json: async () => ({}) });
const r429Ledger = fs.mkdtempSync(path.join(os.tmpdir(), 'tinyfish-r429-')) + '/ledger.jsonl';

await assert.rejects(
  () => tinyfishSearch({
    query: 'q', fetchImpl: fetch429, bucket: remote429Bucket,
    ledgerPath: r429Ledger, leadId: 'r429', clientSlug: 'r429', stage: 'enriched',
  }),
  TinyFishRateLimitedError,
);
const r429Events = readLedger(r429Ledger);
const remote429 = r429Events.find((e) => e.category === 'provider_rate_limited' && e.metadata.reason === 'remote_429');
assert.ok(remote429, 'remote 429 also writes provider_rate_limited');

console.log(JSON.stringify({
  ok: true,
  liveSearch: {
    query: 'roofing brisbane',
    resultCount: search.results.length,
    topResult: { position: r0.position, title: r0.title, url: r0.url },
    latencyMs: searchEvent.metadata.latency_ms,
  },
  liveFetch: {
    url: targetUrl,
    title: f0.title,
    textLength: f0.text.length,
    latencyMs: fetchEvent.metadata.latency_ms,
  },
  ledger: {
    eventCount: events.length,
    tinyfishSearch: { tier: searchEvent.tier, amount: searchEvent.amount, requestHash: searchEvent.requestHash.slice(0, 12) + '...' },
    tinyfishFetch: { tier: fetchEvent.tier, amount: fetchEvent.amount, requestHash: fetchEvent.requestHash.slice(0, 12) + '...' },
    leadSpendTotal: leadSpend.totalCost,
  },
  rateLimit: {
    localBucketTriggers: true,
    remote429Triggers: true,
    bothWriteLedgerEvent: true,
  },
  fixtures: [searchFixture, fetchFixture],
  assertions: {
    searchReturnsResults: true,
    fetchReturnsMarkdown: true,
    v2LedgerFieldsCorrect: true,
    requestHashSha256: true,
    leadSpendRollup: true,
    localRateLimitGate: true,
    remote429Handled: true,
  },
}, null, 2));

function loadDotEnvLocal(p) {
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
