#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { execFileSync } from 'child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'profitslocal-finance-report-'));
const ledgerPath = path.join(root, 'ledger.jsonl');
const outputPath = path.join(root, 'summary.json');

append([
  '--type', 'revenue',
  '--category', 'sale',
  '--amount', '399',
  '--client', 'opa-bar-mezze-restaurant',
  '--provider', 'stripe',
  '--ledger', ledgerPath,
]);

append([
  '--type', 'cost',
  '--category', 'firecrawl',
  '--amount', '3.5',
  '--client', 'opa-bar-mezze-restaurant',
  '--provider', 'firecrawl',
  '--ledger', ledgerPath,
]);

append([
  '--type', 'cost',
  '--category', 'resend',
  '--amount', '0.5',
  '--client', 'opa-bar-mezze-restaurant',
  '--provider', 'resend',
  '--ledger', ledgerPath,
]);

const jsonText = execFileSync('node', [
  'scripts/finance/report.js',
  '--ledger', ledgerPath,
  '--client', 'opa-bar-mezze-restaurant',
  '--json', 'true',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
const payload = JSON.parse(jsonText);

execFileSync('node', [
  'scripts/finance/report.js',
  '--ledger', ledgerPath,
  '--client', 'opa-bar-mezze-restaurant',
  '--output', outputPath,
], {
  cwd: process.cwd(),
  stdio: 'pipe',
});

const saved = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

assert.equal(payload.summary.revenue, 399);
assert.equal(payload.summary.cost, 4);
assert.equal(payload.summary.profit, 395);
assert.equal(payload.summary.revenueEventCount, 1);
assert.equal(payload.summary.costEventCount, 2);
assert.equal(payload.summary.byClient['opa-bar-mezze-restaurant'], 395);
assert.equal(saved.summary.profit, 395);

console.log(JSON.stringify({
  ok: true,
  root,
  ledgerPath,
  outputPath,
  assertions: {
    jsonSummaryWorks: true,
    outputFileWorks: true,
    byClientIncluded: true,
    eventCountsIncluded: true,
  },
}, null, 2));

function append(args) {
  execFileSync('node', ['scripts/finance/add-event.js', ...args], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });
}
