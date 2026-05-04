#!/usr/bin/env node

import { appendLedgerEvent, DEFAULT_LEDGER_PATH } from '../../core/finance/ledger.js';
import { agentRuntimeLedgerInput } from '../../core/finance/service-costs.js';

const args = parseArgs();
if (!args.task || !args['cost-per-minute']) {
  console.error('Usage: node scripts/finance/add-agent-runtime.js --task task_id --started-at ISO --finished-at ISO --cost-per-minute 0.25 [--client slug]');
  process.exit(1);
}

const event = appendLedgerEvent(agentRuntimeLedgerInput({
  clientSlug: args.client || args.clientSlug || null,
  campaignId: args.campaign || args.campaignId || null,
  taskId: args.task,
  mode: args.mode || '',
  startedAt: args['started-at'] || args.startedAt || new Date().toISOString(),
  finishedAt: args['finished-at'] || args.finishedAt || new Date().toISOString(),
  costPerMinute: Number(args['cost-per-minute'] || args.costPerMinute || 0),
  provider: args.provider || 'agent-runtime',
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
