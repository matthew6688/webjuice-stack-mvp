#!/usr/bin/env node

import fs from 'fs';
import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../../core/finance/ledger.js';
import { normalizeTallySubmission, tallyRevenueLedgerInput } from '../../core/funnel/tally.js';

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

if (!args.input) {
  console.error('Usage: node scripts/funnel/record-tally-event.js --input tally-webhook.json [--ledger path] [--campaign id]');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
const order = normalizeTallySubmission(payload, {
  ...process.env,
  DEFAULT_CAMPAIGN_ID: args.campaign || process.env.DEFAULT_CAMPAIGN_ID,
});
const event = appendLedgerEvent(tallyRevenueLedgerInput(order), args.ledger || DEFAULT_LEDGER_PATH);

console.log(JSON.stringify({ order, event }, null, 2));
