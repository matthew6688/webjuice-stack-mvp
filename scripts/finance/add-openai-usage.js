#!/usr/bin/env node

import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../../core/finance/ledger.js';
import {
  openAiUsageLedgerInput,
  parseOpenAiRates,
  ratesForModel,
} from '../../core/finance/openai-usage.js';

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
const model = args.model;

if (!model) {
  console.error('Usage: node scripts/finance/add-openai-usage.js --model gpt-5 --input-tokens 1000 --output-tokens 500 --input-cost-per-million 1.25 --output-cost-per-million 10');
  process.exit(1);
}

const rates = parseOpenAiRates(args.rates || process.env.OPENAI_PRICE_RATES_JSON);
const modelRates = ratesForModel(rates, model) || {};
const inputCostPerMillion = args['input-cost-per-million'] || args.inputCostPerMillion || modelRates.input;
const outputCostPerMillion = args['output-cost-per-million'] || args.outputCostPerMillion || modelRates.output;

if (!inputCostPerMillion || !outputCostPerMillion) {
  console.error('Missing OpenAI rates. Pass --input-cost-per-million and --output-cost-per-million, or set OPENAI_PRICE_RATES_JSON.');
  process.exit(1);
}

const ledgerInput = openAiUsageLedgerInput({
  clientSlug: args.client || args.clientSlug || null,
  campaignId: args.campaign || args.campaignId || null,
  model,
  inputTokens: Number(args['input-tokens'] || args.inputTokens || 0),
  outputTokens: Number(args['output-tokens'] || args.outputTokens || 0),
  inputCostPerMillion,
  outputCostPerMillion,
  metadata: {
    taskId: args.task || '',
    source: args.source || 'manual',
  },
});

const event = appendLedgerEvent(ledgerInput, args.ledger || DEFAULT_LEDGER_PATH);
console.log(JSON.stringify({ event }, null, 2));
