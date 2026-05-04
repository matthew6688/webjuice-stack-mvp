#!/usr/bin/env node

import path from 'path';
import { FirecrawlExtractor } from '../../core/extractors/firecrawl.js';

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

if (!args.url) {
  console.error('Usage: node scripts/extractors/firecrawl.js --url https://example.com [--client slug] [--niche restaurant] [--raw artifact.json] [--evidence evidence.json] [--campaign id] [--ledger path] [--dry-run]');
  process.exit(1);
}

const extractor = new FirecrawlExtractor({
  campaignId: args.campaign,
  ledgerPath: args.ledger,
  dryRun,
});

const scrape = await extractor.scrape({ url: args.url });

if (args.raw) {
  extractor.writeRawArtifact(scrape, args.raw);
  console.log(`Raw artifact written: ${args.raw}`);
}

if (args.client) {
  const pack = extractor.writeEvidenceFromScrape(scrape, {
    clientSlug: args.client,
    niche: args.niche || 'restaurant',
    businessName: args.name,
    sourceUrl: args.url,
    outputPath: args.evidence,
  });
  console.log(`Evidence written: ${args.evidence || path.join('clients', args.client, 'evidence', 'evidence.json')}`);
  console.log(`Items: ${pack.items.length}`);
} else {
  console.log(JSON.stringify(scrape, null, 2));
}
