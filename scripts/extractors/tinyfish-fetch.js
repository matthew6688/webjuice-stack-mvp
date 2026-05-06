#!/usr/bin/env node

import path from 'path';
import { TinyFishExtractor } from '../../core/extractors/tinyfish.js';
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
const dryRun = Boolean(args.dryRun || args['dry-run']);

if (!args.url && !args.urls) {
  console.error('Usage: node scripts/extractors/tinyfish-fetch.js --url https://example.com/menu [--raw artifact.json] [--text artifact.txt] [--client slug] [--niche restaurant] [--campaign id] [--ledger path] [--dry-run]');
  process.exit(1);
}

const urls = args.urls
  ? String(args.urls).split(',').map((url) => url.trim()).filter(Boolean)
  : [args.url];

const extractor = new TinyFishExtractor({
  campaignId: args.campaign,
  ledgerPath: args.ledger,
  dryRun,
});

const payload = await extractor.fetchPages({ urls });

if (args.raw) {
  extractor.writeRawArtifact(payload, args.raw);
  console.log(`Raw artifact written: ${args.raw}`);
}

if (args.text) {
  const text = extractor.writeTextArtifact(payload, args.text);
  console.log(`Text artifact written: ${args.text}`);
  console.log(`Text chars: ${text.length}`);
}

if (args.client) {
  const pack = extractor.writeEvidenceFromFetch(payload, {
    clientSlug: args.client,
    niche: args.niche || 'restaurant',
    businessName: args.name,
    outputPath: args.evidence,
  });
  console.log(`Evidence written: ${args.evidence || path.join('clients', args.client, 'evidence', 'evidence.json')}`);
  console.log(`Items: ${pack.items.length}`);
} else if (!args.raw && !args.text) {
  console.log(JSON.stringify(payload, null, 2));
}
