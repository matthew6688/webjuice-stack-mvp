#!/usr/bin/env node

import { readLedger, summarizeLedger, formatMoney, DEFAULT_LEDGER_PATH } from '../../core/finance/ledger.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

const args = parseArgs();
const ledgerPath = args.ledger || DEFAULT_LEDGER_PATH;
const events = readLedger(ledgerPath);
const filters = {
  clientSlug: args.client,
  campaignId: args.campaign,
  currency: args.currency,
};
const summary = summarizeLedger(events, filters);
const currency = args.currency || events.find((event) => event.currency)?.currency || 'USD';

console.log('Profits Local ROI Report');
console.log('========================');
console.log(`Ledger: ${ledgerPath}`);
if (filters.clientSlug) console.log(`Client: ${filters.clientSlug}`);
if (filters.campaignId) console.log(`Campaign: ${filters.campaignId}`);
console.log(`Events: ${summary.eventCount}`);
console.log('');
console.log(`Revenue: ${formatMoney(summary.revenue, currency)}`);
console.log(`Cost:    ${formatMoney(summary.cost, currency)}`);
console.log(`Profit:  ${formatMoney(summary.profit, currency)}`);
console.log(`ROI:     ${summary.roi === null ? 'n/a' : `${(summary.roi * 100).toFixed(2)}%`}`);

console.log('\nBy Category');
for (const [category, amount] of Object.entries(summary.byCategory).sort()) {
  console.log(`- ${category}: ${formatMoney(amount, currency)}`);
}

console.log('\nBy Provider');
for (const [provider, amount] of Object.entries(summary.byProvider).sort()) {
  console.log(`- ${provider}: ${formatMoney(amount, currency)}`);
}
