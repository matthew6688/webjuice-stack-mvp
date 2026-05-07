#!/usr/bin/env node

import { dispatchDryRunHandoff } from '../../core/ops/dry-run-handoff.js';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || '';
const orderId = args.order || args.orderId || '';
const caseDir = args['case-dir'] || args.caseDir || '';
const send = boolArg(args, 'send', false);

if (!caseDir && (!clientSlug || !orderId)) {
  console.error('Usage: node scripts/ops/send-dry-run-handoff.js --client <slug> --order <runId> [--send true]');
  console.error('   or: node scripts/ops/send-dry-run-handoff.js --case-dir data/cases/<client>/<runId> [--send true]');
  process.exit(1);
}

const result = await dispatchDryRunHandoff({
  clientSlug,
  orderId,
  caseDir,
  send,
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function boolArg(values, key, defaultValue = false) {
  if (values[key] === undefined) return defaultValue;
  return values[key] === true || String(values[key]).toLowerCase() === 'true';
}
