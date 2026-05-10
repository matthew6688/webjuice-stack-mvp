#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createLeadIntake, saveLeadIntake } from '../../core/leads/intake.js';
import { buildLeadDiscoveryLogEntry } from '../../core/leads/maps-scraper-discovery.js';
import { discoveryEntityKey, updateDiscoveryEntityStatus } from '../../core/leads/discovery-store.js';

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input || args.run || '';
const clientsRoot = args['clients-root'] || args.clientsRoot || 'clients';
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const storeRoot = path.resolve(args['store-root'] || args.storeRoot || path.join('data', 'leads'));

if (!inputPath) {
  console.error('Usage: npm run leads:maps-promote -- --input data/maps-scraper/runs/<run>/discovery-run.json --place-id <id>');
  console.error('   or: npm run leads:maps-promote -- --input ... --top 3 --actions starter_candidate,audit_candidate');
  process.exit(1);
}

const run = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const selected = selectCandidates(run, args);
const promoted = [];

for (const lead of selected) {
  const clientSlug = args.client || args.clientSlug || slugify(lead.name);
  const clientDir = path.join(clientsRoot, clientSlug);
  const leadDir = path.join(clientDir, 'lead');
  const intakePath = path.join(leadDir, 'lead-intake.json');
  const discoveryLogPath = path.join(leadDir, 'discovery-log.jsonl');
  const intake = createLeadIntake({
    sourceType: 'maps_scraper',
    clientSlug,
    leadId: lead.place_id || lead.leadId,
    businessName: lead.name,
    industry: lead.category || lead.niche || run.niche,
    city: lead.city || run.city,
    websiteUrl: lead.website,
    googleMapsUrl: lead.google_maps_url,
    phone: lead.phone,
    address: lead.address,
    rating: lead.rating,
    reviewCount: lead.review_count,
    observations: [
      `Maps scraper status: ${lead.websiteStatus}; score ${lead.discoveryScore}; recommended ${lead.recommendedAction}.`,
      lead.website ? `Website listed on Maps: ${lead.website}` : 'No website listed on Maps.',
    ],
    services: lead.categories || [],
    rawInputs: {
      mapsScraperLead: lead,
      discoveryRun: path.relative(process.cwd(), inputPath),
    },
  });
  const logEntry = buildLeadDiscoveryLogEntry({
    lead,
    run,
    rawPath: run.toolLog?.rawPath || '',
    decision: lead.recommendedAction,
  });

  if (!dryRun) {
    fs.mkdirSync(leadDir, { recursive: true });
    saveLeadIntake(intake, intakePath);
    fs.appendFileSync(discoveryLogPath, `${JSON.stringify(logEntry)}\n`, 'utf8');
    updateDiscoveryEntityStatus({
      entityKey: discoveryEntityKey(lead),
      status: 'promoted',
      clientSlug,
      note: `Promoted from maps scraper run ${run.runId || inputPath}.`,
      storeRoot,
    });
  }

  promoted.push({
    entityKey: discoveryEntityKey(lead),
    clientSlug,
    businessName: lead.name,
    recommendedAction: lead.recommendedAction,
    discoveryScore: lead.discoveryScore,
    intakePath,
    discoveryLogPath,
  });
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  input: inputPath,
  selected: selected.length,
  promoted,
}, null, 2));

function selectCandidates(run, parsed) {
  const leads = Array.isArray(run.leads) ? run.leads : [];
  if (parsed['place-id'] || parsed.placeId) {
    const ids = String(parsed['place-id'] || parsed.placeId).split(',').map((item) => item.trim()).filter(Boolean);
    return leads.filter((lead) => ids.includes(lead.place_id));
  }
  const actions = new Set(String(parsed.actions || 'starter_candidate,audit_candidate').split(',').map((item) => item.trim()).filter(Boolean));
  const top = Number(parsed.top || 0);
  const candidates = leads.filter((lead) => actions.has(lead.recommendedAction));
  return top > 0 ? candidates.slice(0, top) : candidates;
}

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

function slugify(value) {
  return String(value || 'unknown-lead')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown-lead';
}
