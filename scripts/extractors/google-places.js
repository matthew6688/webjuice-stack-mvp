#!/usr/bin/env node

import {
  GooglePlacesExtractor,
  writeJson,
} from '../../core/extractors/google-places.js';

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
const placeId = args.placeId || args['place-id'];

if (!args.query && !placeId) {
  console.error('Usage: node scripts/extractors/google-places.js --query "restaurant in Brisbane" --niche restaurant --city Brisbane [--count 5] [--output leads.json] [--campaign id] [--ledger path] [--dry-run]');
  console.error('   or: node scripts/extractors/google-places.js --placeId <id> --client <slug> --niche restaurant [--evidence evidence.json]');
  process.exit(1);
}

const extractor = new GooglePlacesExtractor({
  campaignId: args.campaign,
  ledgerPath: args.ledger,
  dryRun,
});

if (placeId) {
  const lead = await extractor.details({
    placeId,
    niche: args.niche,
    city: args.city,
  });
  if (args.client) {
    const pack = extractor.writeEvidenceForLead(lead, {
      clientSlug: args.client,
      niche: args.niche || lead.niche,
      outputPath: args.evidence,
    });
    console.log(`Evidence written for ${lead.name}: ${args.evidence || `clients/${args.client}/evidence/evidence.json`}`);
    console.log(`Items: ${pack.items.length}`);
  } else {
    console.log(JSON.stringify(lead, null, 2));
  }
} else {
  const leads = await extractor.extractLeads({
    query: args.query,
    count: Number(args.count || 20),
    niche: args.niche,
    city: args.city,
  });
  if (args.output) {
    writeJson(args.output, leads);
    console.log(`Leads written: ${args.output}`);
  }
  console.log(`Extracted leads: ${leads.length}`);
  for (const lead of leads) {
    console.log(`- ${lead.name} | ${lead.phone || 'no phone'} | ${lead.website || 'no website'}`);
  }
}
