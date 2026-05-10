#!/usr/bin/env node

import path from 'path';
import { buildDiscoveryQueues, buildDiscoveryReport, rebuildDiscoveryIndex } from '../../core/leads/discovery-store.js';

const args = parseArgs(process.argv.slice(2));
const storeRoot = path.resolve(args['store-root'] || args.storeRoot || path.join('data', 'leads'));
const index = rebuildDiscoveryIndex({ storeRoot });
const queues = buildDiscoveryQueues({ storeRoot, limit: Number(args.limit || 50) });
const { report, reportPath } = buildDiscoveryReport({ storeRoot });

console.log(JSON.stringify({
  ok: true,
  storeRoot: path.relative(process.cwd(), storeRoot),
  indexPath: path.relative(process.cwd(), path.join(storeRoot, 'discovery-index.json')),
  reportPath: path.relative(process.cwd(), reportPath),
  totals: index.totals,
  statusCounts: index.statusCounts,
  actionCounts: index.actionCounts,
  queueCounts: {
    cheapSiteAudit: queues.cheapSiteAudit.length,
    enrichment: queues.enrichment.length,
    outreachBrief: queues.outreachBrief.length,
  },
  topCandidates: report.topCandidates.slice(0, Number(args.top || 8)),
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
