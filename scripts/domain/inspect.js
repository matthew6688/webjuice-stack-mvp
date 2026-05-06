#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { inspectDns } from '../../core/domain/dns.js';
import { listDnsRecordsByName } from '../../core/domain/cloudflare-dns.js';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

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
const zoneId = args.zone || process.env.CF_ZONE_ID || '';
if (zoneId && process.env.CF_API_TOKEN) {
  try {
    const cloudflareRecords = await listDnsRecordsByName({
      token: process.env.CF_API_TOKEN,
      zoneId,
      name: result.domain,
    });
    result.cloudflare = {
      zoneId,
      records: cloudflareRecords.map((record) => ({
        id: record.id,
        type: record.type,
        name: record.name,
        content: record.content,
        proxied: record.proxied,
      })),
    };
    result.status.cloudflareCnameMatchesPages = cloudflareRecords.some((record) => (
      record.type === 'CNAME' && record.content === result.target
    ));
    result.status.readyForPagesAttach = result.status.readyForPagesAttach
      || result.status.cloudflareCnameMatchesPages;
  } catch (error) {
    result.cloudflare = {
      zoneId,
      error: error.message,
    };
  }
}
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
if (result.cloudflare?.records) {
  console.log('Cloudflare DNS records');
  for (const record of result.cloudflare.records) {
    console.log(`- ${record.type} ${record.name} -> ${record.content} proxied=${record.proxied}`);
  }
}
console.log('\nCustomer DNS instructions');
console.log(result.instructions.customerMessage);
