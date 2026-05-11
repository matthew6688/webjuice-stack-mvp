#!/usr/bin/env node
/**
 * Read recent ledger events for vision calls and project monthly capacity.
 *
 * Usage:
 *   node scripts/finance/vision-cost-projection.js
 *   node scripts/finance/vision-cost-projection.js --leads-since-iso 2026-05-10T22:00:00Z
 *
 * Output: avg cost per lead + monthly projection by scale.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const ledgerPath = path.join(repoRoot, 'data/finance/ledger.jsonl');

const args = parseArgs(process.argv.slice(2));
const sinceMs = args['leads-since-iso'] ? new Date(args['leads-since-iso']).getTime() : null;

const events = [];
for (const line of fs.readFileSync(ledgerPath, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try {
    const e = JSON.parse(line);
    if (sinceMs && new Date(e.ts || e.timestamp || 0).getTime() < sinceMs) continue;
    if (e.purpose && /visual_audit|review_analysis/.test(e.purpose)) events.push(e);
  } catch {}
}

const byProvider = {};
for (const e of events) {
  const p = e.provider || 'unknown';
  if (!byProvider[p]) byProvider[p] = { count: 0, theoreticalCost: 0, actualCost: 0, totalLatencyMs: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCacheRead: 0, totalCacheCreate: 0 };
  const bag = byProvider[p];
  const md = e.metadata || {};
  bag.count += 1;
  bag.theoreticalCost += Number(md.theoretical_cost_usd || 0);
  bag.actualCost += Number(e.amount || 0);
  bag.totalLatencyMs += Number(md.duration_ms || md.latency_ms || 0);
  bag.totalInputTokens += Number(md.input_tokens || 0);
  bag.totalOutputTokens += Number(md.output_tokens || 0);
  bag.totalCacheRead += Number(md.cache_read_tokens || md.cached_input_tokens || 0);
  bag.totalCacheCreate += Number(md.cache_creation_tokens || 0);
}

console.log('\n=== Vision/Review LLM calls — provider breakdown ===\n');
console.log('Provider                       Calls  Avg latency  Avg theoretical $  Total theoretical $');
for (const [name, bag] of Object.entries(byProvider)) {
  if (!bag.count) continue;
  console.log(
    name.padEnd(30),
    String(bag.count).padStart(5),
    `${(bag.totalLatencyMs / bag.count / 1000).toFixed(1)}s`.padStart(12),
    `$${(bag.theoreticalCost / bag.count).toFixed(4)}`.padStart(18),
    `$${bag.theoreticalCost.toFixed(2)}`.padStart(20),
  );
}

console.log('\n=== Average per-lead vision cost (theoretical, sub-covered actual=$0) ===\n');
// Estimate "per lead" = one vision call (others optional)
const visionCalls = events.filter((e) => /visual_audit/.test(e.purpose));
const totalVisionCost = visionCalls.reduce((a, e) => a + Number(e.metadata?.theoretical_cost_usd || 0), 0);
const avgPerLead = visionCalls.length ? totalVisionCost / visionCalls.length : 0;
console.log(`Vision calls measured: ${visionCalls.length}`);
console.log(`Total theoretical: $${totalVisionCost.toFixed(2)}`);
console.log(`Average per lead: $${avgPerLead.toFixed(4)}`);

console.log('\n=== Monthly subscription capacity projection ===\n');
console.log('If we paid metered API rates instead of subscription, this is what we\'d burn.');
console.log('Subscription plans have rate limits (not pure $) but theoretical $ is a useful proxy.\n');

const scenarios = [
  { label: '50 leads / day', perDay: 50 },
  { label: '100 leads / day', perDay: 100 },
  { label: '500 leads / day', perDay: 500 },
  { label: '2000 leads / day (max scrape)', perDay: 2000 },
];

for (const s of scenarios) {
  const dailyCost = s.perDay * avgPerLead;
  const monthlyCost = dailyCost * 30;
  console.log(`${s.label.padEnd(35)} daily: $${dailyCost.toFixed(2).padStart(8)}  monthly: $${monthlyCost.toFixed(0).padStart(8)}`);
}

console.log('\n=== Subscription tier guide (rough) ===\n');
console.log('Claude Pro     ($20/mo)  → ~200 msg / 5h session → ~960 vision calls / day max');
console.log('Claude Max     ($100/mo) → ~5x Pro          → ~4800 vision calls / day');
console.log('Claude Max     ($200/mo) → ~10x Pro         → ~9600 vision calls / day');
console.log('\nRate limits are SESSION-based not $-based; if our vision calls fit within');
console.log('5h windows with breathing room, we don\'t hit the wall.');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    out[k] = v;
  }
  return out;
}
