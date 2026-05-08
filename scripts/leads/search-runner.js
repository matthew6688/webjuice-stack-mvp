#!/usr/bin/env node

import fs from 'fs';
import { GooglePlacesExtractor, writeJson } from '../../core/extractors/google-places.js';
import {
  buildLeadSearchRun,
  defaultLeadSearchRunPath,
  writeLeadSearchRun,
} from '../../core/leads/search-runner.js';

const args = parseArgs();
const dryRun = Boolean(args.dryRun || args['dry-run']);

if (!args.input && !args.query) {
  console.error('Usage: npm run leads:search-runner -- --query "restaurants in Brisbane" --niche restaurant --city Brisbane [--count 20] [--output data/lead-runs/...json] [--dry-run]');
  console.error('   or: npm run leads:search-runner -- --input leads.json [--output run.json]');
  process.exit(1);
}

try {
  const leads = args.input
    ? JSON.parse(fs.readFileSync(args.input, 'utf8'))
    : await fetchPlacesLeads(args);
  const run = buildLeadSearchRun({
    leads,
    query: args.query || '',
    niche: args.niche || 'restaurant',
    city: args.city || '',
    minQualification: args['min-qualification'] || args.minQualification || 'B',
    maxSelected: args['max-selected'] || args.maxSelected || null,
    websiteScansByPlaceId: readWebsiteScans(args['website-scans'] || args.websiteScans),
  });
  const outputPath = args.output || defaultLeadSearchRunPath({
    niche: args.niche || 'restaurant',
    city: args.city || '',
    slug: args.slug || args.query || 'search',
  });
  writeLeadSearchRun(run, outputPath);
  if (args['leads-output'] || args.leadsOutput) writeJson(args['leads-output'] || args.leadsOutput, leads);
  console.log(JSON.stringify({
    ok: true,
    output: outputPath,
    totals: run.totals,
    selected: run.collectionQueue.map((item) => ({
      clientSlug: item.clientSlug,
      businessName: item.businessName,
      qualification: item.qualification,
      recommendedAction: item.recommendedAction,
      collectCommand: item.collectCommand,
    })),
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function fetchPlacesLeads(parsed) {
  const extractor = new GooglePlacesExtractor({
    campaignId: parsed.campaign,
    ledgerPath: parsed.ledger,
    dryRun,
  });
  return extractor.extractLeads({
    query: parsed.query,
    count: Number(parsed.count || 20),
    niche: parsed.niche || 'restaurant',
    city: parsed.city || '',
  });
}

function readWebsiteScans(filePath) {
  if (!filePath) return {};
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(data)) {
    return Object.fromEntries(data.filter((item) => item.place_id).map((item) => [item.place_id, item.scan || item.websiteScan || item]));
  }
  return data;
}

function parseArgs() {
  const parsed = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
