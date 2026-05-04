#!/usr/bin/env node

import { FirecrawlParseExtractor } from '../../core/extractors/firecrawl-parse.js';

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

if (!args.input) {
  console.error('Usage: node scripts/extractors/firecrawl-parse.js --input menu.pdf [--client slug] [--evidence evidence.json] [--raw parse.json] [--source-url url] [--campaign id] [--ledger path] [--dry-run]');
  process.exit(1);
}

const extractor = new FirecrawlParseExtractor({
  campaignId: args.campaign,
  ledgerPath: args.ledger,
  dryRun,
});

const parseData = await extractor.parseFile({
  inputPath: args.input,
  formats: String(args.formats || 'markdown').split(',').map((item) => item.trim()).filter(Boolean),
  parsers: String(args.parsers || 'pdf').split(',').map((item) => item.trim()).filter(Boolean),
  zeroDataRetention: args.zeroDataRetention === true || args['zero-data-retention'] === true,
});

if (args.raw) {
  extractor.writeRawArtifact(parseData, args.raw);
  console.log(`Raw parse artifact written: ${args.raw}`);
}

if (args.client) {
  const pack = extractor.writeMenuEvidence(parseData, {
    clientSlug: args.client,
    niche: args.niche || 'restaurant',
    businessName: args.name,
    sourceUrl: args['source-url'] || args.sourceUrl || args.input,
    sourceType: args['source-type'] || args.sourceType || inferSourceType(args['source-url'] || args.sourceUrl || args.input),
    outputPath: args.evidence,
  });
  const sections = pack.resolved?.menu?.sections?.value || [];
  const itemCount = sections.reduce((sum, section) => sum + (section.items?.length || 0), 0);
  console.log(`Menu evidence written: ${args.evidence || `clients/${args.client}/evidence/evidence.json`}`);
  console.log(`Sections: ${sections.length}`);
  console.log(`Items: ${itemCount}`);
} else {
  console.log(JSON.stringify(parseData, null, 2));
}

function inferSourceType(source) {
  return String(source || '').toLowerCase().includes('.pdf') ? 'pdf' : 'firecrawl';
}
