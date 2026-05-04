#!/usr/bin/env node

import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../../core/finance/ledger.js';

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

if (!args.type || !args.category || args.amount === undefined) {
  console.error('Usage: node scripts/finance/add-event.js --type cost|revenue --category <category> --amount <number> [--client slug] [--campaign id] [--provider name] [--currency USD]');
  process.exit(1);
}

const event = appendLedgerEvent({
  type: args.type,
  category: args.category,
  amount: Number(args.amount),
  units: args.units === undefined ? 1 : Number(args.units),
  unitCost: args.unitCost === undefined ? Number(args.amount) : Number(args.unitCost),
  currency: args.currency || 'USD',
  provider: args.provider || 'manual',
  clientSlug: args.client || null,
  campaignId: args.campaign || null,
  metadata: args.note ? { note: args.note } : {},
}, args.ledger || DEFAULT_LEDGER_PATH);

console.log(JSON.stringify(event, null, 2));
