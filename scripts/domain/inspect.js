#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { inspectDns } from '../../core/domain/dns.js';

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
if (!args.domain || !args.project) {
  console.error('Usage: node scripts/domain/inspect.js --domain example.com --project pages-project [--output domain.json]');
  process.exit(1);
}

const result = inspectDns({ domain: args.domain, projectName: args.project });
if (args.output) {
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
}

console.log(`Domain: ${result.domain}`);
console.log(`Pages target: ${result.target}`);
console.log(`Ready for Pages attach: ${result.status.readyForPagesAttach ? 'yes' : 'no'}`);
console.log('Records');
for (const [type, values] of Object.entries(result.records)) {
  console.log(`- ${type}: ${values.length ? values.join(', ') : 'none'}`);
}
console.log('\nCustomer DNS instructions');
console.log(result.instructions.customerMessage);
