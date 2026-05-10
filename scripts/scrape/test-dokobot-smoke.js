#!/usr/bin/env node
/**
 * Live Dokobot smoke test — runs `dokobot read --local` against a real URL
 * via a connected local Chrome device and verifies V2 ledger writes.
 *
 * Skips with exit code 2 if CLI is missing or no device is connected
 * (those are environmental, not test failures).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import {
  dokobotCliVersion,
  listLocalDevices,
  dokobotRead,
  DokobotUnavailableError,
} from '../../core/scrape/dokobot.js';
import { readLedger, summarizeLeadSpend } from '../../core/finance/ledger.js';
import { clearAllBuckets } from '../../core/util/token-bucket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const cliVersion = dokobotCliVersion();
if (!cliVersion) {
  console.log(JSON.stringify({ ok: false, skipped: true, reason: 'dokobot CLI not installed' }));
  process.exit(2);
}

const devices = listLocalDevices();
if (!devices.length) {
  console.log(JSON.stringify({ ok: false, skipped: true, reason: 'no local Chrome device connected', cliVersion }));
  process.exit(2);
}

const fixturesDir = path.join(repoRoot, 'data/v2/fixtures/dokobot');
fs.mkdirSync(fixturesDir, { recursive: true });
const tmpLedger = fs.mkdtempSync(path.join(os.tmpdir(), 'dokobot-smoke-')) + '/ledger.jsonl';

clearAllBuckets();

const targetUrl = 'https://www.rooroofing.com.au/';
const leadId = 'ld_test_dokobot_smoke';
const clientSlug = 'roo-roofing-brisbane';
const stage = 'enriched';

const result = await dokobotRead({
  url: targetUrl,
  ledgerPath: tmpLedger,
  leadId, clientSlug, stage,
  purpose: 'lead_enrichment_fetch',
  screens: 1,
  timeout: 45,
});

assert.ok(result.text && result.text.length > 200, `expected substantial text, got ${result.text?.length || 0}`);
assert.ok(result.device, 'device id returned');
assert.ok(result.latencyMs > 0);
assert.ok(/^\d+\.\d+\.\d+$/.test(result.cliVersion), 'cliVersion semver');

const events = readLedger(tmpLedger);
assert.equal(events.length, 1, `expected 1 ledger event, got ${events.length}`);
const event = events[0];
assert.equal(event.category, 'dokobot');
assert.equal(event.tier, 'T0');
assert.equal(event.amount, 0);
assert.equal(event.leadId, leadId);
assert.equal(event.clientSlug, clientSlug);
assert.equal(event.stage, stage);
assert.equal(event.metadata.endpoint, 'read');
assert.equal(event.metadata.url, targetUrl);
assert.ok(event.metadata.text_length > 200);
assert.ok(event.requestHash && event.requestHash.length === 64);

const leadSpend = summarizeLeadSpend(events, leadId);
assert.equal(leadSpend.totalCost, 0);
assert.equal(leadSpend.byTier.T0, 0);

// Save fixture (truncated text for readability — full text is too large)
const fixturePath = path.join(fixturesDir, 'read-rooroofing.json');
fs.writeFileSync(fixturePath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  request: { url: targetUrl, screens: 1, timeout: 45 },
  response: {
    device: result.device,
    cliVersion: result.cliVersion,
    latencyMs: result.latencyMs,
    textLength: result.text.length,
    textPreview: result.text.split('\n').slice(0, 30).join('\n'),
  },
}, null, 2) + '\n');

console.log(JSON.stringify({
  ok: true,
  cliVersion,
  devicesConnected: devices.length,
  liveRead: {
    url: targetUrl,
    device: result.device,
    textLength: result.text.length,
    latencyMs: result.latencyMs,
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
    cliPresent: true,
    deviceConnected: true,
    readReturnsText: true,
    v2LedgerFieldsCorrect: true,
    requestHashSha256: true,
    leadSpendRollup: true,
  },
}, null, 2));
