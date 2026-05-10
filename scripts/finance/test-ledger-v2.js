#!/usr/bin/env node
/**
 * V2 ledger schema test — verifies new optional fields, rollups,
 * summarizeLeadSpend, hashRequest, and backward compatibility with
 * existing single-key callers.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import {
  appendLedgerEvent,
  createLedgerEvent,
  readLedger,
  summarizeLedger,
  summarizeLeadSpend,
  hashRequest,
  LEDGER_CATEGORIES,
  LEDGER_TIERS,
} from '../../core/finance/ledger.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'profitslocal-ledger-v2-'));
const ledgerPath = path.join(root, 'ledger.jsonl');

// ─── 1. Backward compat: old-shape event still validates and writes ────────
const legacy = appendLedgerEvent({
  type: 'cost',
  category: 'firecrawl',
  provider: 'firecrawl',
  amount: 0.0042,
  units: 1,
  unitCost: 0.0042,
  clientSlug: 'opa-bar-mezze-restaurant',
}, ledgerPath);

assert.equal(legacy.leadId, null, 'legacy event has null leadId');
assert.equal(legacy.tier, null, 'legacy event has null tier');
assert.equal(legacy.amount, 0.0042);

// ─── 2. V2 new categories accepted ─────────────────────────────────────────
for (const cat of ['perplexity', 'dokobot', 'tinyfish_search', 'tinyfish_fetch', 'ddg_local', 'kimi', 'anthropic']) {
  assert.ok(LEDGER_CATEGORIES.includes(cat), `category ${cat} should be in LEDGER_CATEGORIES`);
}

// ─── 3. V2 fields written and read back ────────────────────────────────────
const v2Event = appendLedgerEvent({
  type: 'cost',
  category: 'perplexity',
  provider: 'perplexity',
  tier: 'T2',
  leadId: 'ld_2026_05_10_test',
  clientSlug: 'roo-roofing-brisbane',
  stage: 'researching',
  purpose: 'lead_enrichment_background',
  keyId: 'pplx_1',
  requestHash: 'abc123def456',
  units: 1240,
  unitCost: 0.000005,
  amount: 0.0062,
  metadata: { model: 'sonar-medium-online', tokens_in: 1240, tokens_out: 380 },
}, ledgerPath);

assert.equal(v2Event.tier, 'T2');
assert.equal(v2Event.leadId, 'ld_2026_05_10_test');
assert.equal(v2Event.keyId, 'pplx_1');
assert.equal(v2Event.requestHash, 'abc123def456');

// ─── 4. T0 free event registers with amount=0 but still tracks units ──────
const freeEvent = appendLedgerEvent({
  type: 'cost',
  category: 'tinyfish_search',
  provider: 'tinyfish',
  tier: 'T0',
  leadId: 'ld_2026_05_10_test',
  clientSlug: 'roo-roofing-brisbane',
  stage: 'enriched',
  purpose: 'lead_enrichment_search',
  units: 1,
  unitCost: 0,
  amount: 0,
  metadata: { query: 'roofing brisbane', results: 10 },
}, ledgerPath);
assert.equal(freeEvent.amount, 0);
assert.equal(freeEvent.tier, 'T0');

// ─── 5. Tier validation rejects bogus values ───────────────────────────────
assert.throws(
  () => createLedgerEvent({
    type: 'cost', category: 'perplexity', provider: 'perplexity', tier: 'T9',
    units: 1, unitCost: 0.01, amount: 0.01,
  }),
  /tier must be one of/,
);

// ─── 6. Type checks on optional fields ─────────────────────────────────────
assert.throws(
  () => createLedgerEvent({
    type: 'cost', category: 'perplexity', provider: 'perplexity', leadId: 12345,
    units: 1, unitCost: 0.01, amount: 0.01,
  }),
  /leadId must be a string/,
);

// ─── 7. summarizeLedger byLead/byTier/byStage/byPurpose populated ─────────
const events = readLedger(ledgerPath);
const summary = summarizeLedger(events);
assert.equal(summary.eventCount, 3);
assert.equal(summary.byLead['ld_2026_05_10_test'], -0.0062, 'V2 lead bucket sums signed cost');
assert.equal(summary.byTier['T2'], -0.0062);
assert.equal(summary.byTier['T0'], 0);
assert.equal(summary.byStage['researching'], -0.0062);
assert.equal(summary.byPurpose['lead_enrichment_background'], -0.0062);
assert.equal(summary.byKeyId['pplx_1'], -0.0062);

// Legacy event has null leadId/tier/etc — should NOT appear in V2 buckets
assert.equal(summary.byLead['unassigned'], undefined, 'null leadId is skipped, not bucketed as "unassigned"');
assert.equal(summary.byTier['untracked'], undefined, 'null tier is skipped from byTier');

// ─── 8. summarizeLedger filters by leadId/stage/tier ──────────────────────
const filtered = summarizeLedger(events, { leadId: 'ld_2026_05_10_test' });
assert.equal(filtered.eventCount, 2, 'only the 2 V2 events match leadId');
const tierFiltered = summarizeLedger(events, { tier: 'T0' });
assert.equal(tierFiltered.eventCount, 1);
assert.equal(tierFiltered.cost, 0);

// ─── 9. summarizeLeadSpend gives per-lead cost rollup ─────────────────────
const leadSpend = summarizeLeadSpend(events, 'ld_2026_05_10_test');
assert.equal(leadSpend.eventCount, 2);
assert.equal(leadSpend.totalCost, 0.0062);
assert.equal(leadSpend.byTier.T0, 0);
assert.equal(leadSpend.byTier.T2, 0.0062);
assert.equal(leadSpend.byCategory['perplexity'], 0.0062);
assert.equal(leadSpend.byCategory['tinyfish_search'], 0);
assert.equal(leadSpend.byPurpose['lead_enrichment_background'], 0.0062);

// Lead with no events returns empty rollup
const empty = summarizeLeadSpend(events, 'ld_does_not_exist');
assert.equal(empty.eventCount, 0);
assert.equal(empty.totalCost, 0);

// ─── 10. hashRequest produces deterministic sha256 ────────────────────────
const h1 = await hashRequest({ url: 'https://example.com', formats: ['markdown'] });
const h2 = await hashRequest({ url: 'https://example.com', formats: ['markdown'] });
const h3 = await hashRequest({ url: 'https://example.com', formats: ['html'] });
assert.equal(h1, h2, 'identical input → identical hash');
assert.notEqual(h1, h3, 'different input → different hash');
assert.equal(h1.length, 64, 'sha256 hex is 64 chars');

// ─── 11. LEDGER_TIERS exported and contains all tiers ─────────────────────
assert.deepEqual(LEDGER_TIERS, ['T0', 'T1', 'T2', 'T3']);

console.log(JSON.stringify({
  ok: true,
  root,
  ledgerPath,
  eventsWritten: events.length,
  assertions: {
    backwardCompat: true,
    newCategoriesAccepted: true,
    v2FieldsRoundTrip: true,
    t0FreeEventLogged: true,
    tierValidationEnforced: true,
    optionalFieldTypeChecks: true,
    rollupsByLeadTierStagePurposeKey: true,
    filtersByLeadStageTier: true,
    summarizeLeadSpend: true,
    hashRequestDeterministic: true,
  },
}, null, 2));
