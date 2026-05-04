#!/usr/bin/env node

import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../../core/finance/ledger.js';
import { imageGenerationLedgerInput } from '../../core/finance/service-costs.js';

const args = parseArgs();
if (!args.provider || !args['unit-cost']) {
  console.error('Usage: node scripts/finance/add-image-generation.js --provider openai-image --unit-cost 0.04 [--images 1] [--model image-2] [--client slug]');
  process.exit(1);
}

const event = appendLedgerEvent(imageGenerationLedgerInput({
  clientSlug: args.client || args.clientSlug || null,
  campaignId: args.campaign || args.campaignId || null,
  provider: args.provider,
  model: args.model || '',
  images: Number(args.images || 1),
  unitCost: Number(args['unit-cost'] || args.unitCost || 0),
  metadata: {
    source: args.source || 'manual',
    note: args.note || '',
  },
}), args.ledger || DEFAULT_LEDGER_PATH);

console.log(JSON.stringify({ event }, null, 2));

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
