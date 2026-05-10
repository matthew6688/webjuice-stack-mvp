#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  buildMapsScraperDiscoveryRun,
  readMapsScraperJsonl,
  writeMapsScraperDiscoveryRun,
} from '../../core/leads/maps-scraper-discovery.js';
import {
  buildDiscoveryQueues,
  buildDiscoveryReport,
  upsertDiscoveryRun,
} from '../../core/leads/discovery-store.js';

const args = parseArgs(process.argv.slice(2));

if (!args.query && !args.input) {
  console.error('Usage: npm run leads:maps-scrape -- --query "restaurants in West End Brisbane" --niche restaurant --city Brisbane');
  console.error('   or: npm run leads:maps-scrape -- --input data/maps-scraper/runs/<run>/results.maps.json --query "..."');
  console.error('Defaults: no Google Places API, no email extraction, no extra reviews, review/email payloads stripped before analysis storage.');
  process.exit(1);
}

const runId = String(args['run-id'] || args.runId || timestampSlug()).trim();
const runDir = path.resolve(args.output || args['run-dir'] || path.join('data', 'maps-scraper', 'runs', runId));
const rawPath = path.join(runDir, 'results.maps.json');
const query = String(args.query || '').trim();
const queriesPath = path.join(runDir, 'queries.txt');
const dockerImage = String(args.image || 'gosom/google-maps-scraper:latest');
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const updateStore = args['update-store'] !== 'false' && args.updateStore !== 'false';
const storeRoot = path.resolve(args['store-root'] || args.storeRoot || path.join('data', 'leads'));

fs.mkdirSync(runDir, { recursive: true });

let inputPath = args.input ? path.resolve(String(args.input)) : rawPath;
let dockerResult = null;

if (!args.input) {
  fs.writeFileSync(queriesPath, `${query}\n`);
  dockerResult = runDockerScrape({
    dockerImage,
    runDir,
    queriesPath,
    rawPath,
    depth: Number(args.depth || 1),
    concurrency: Number(args.c || args.concurrency || 1),
    lang: String(args.lang || 'en'),
    exitOnInactivity: String(args['exit-on-inactivity'] || args.exitOnInactivity || '3m'),
    proxies: String(args.proxies || process.env.MAPS_SCRAPER_PROXIES || '').trim(),
    dryRun,
  });
  inputPath = rawPath;
}

if (!fs.existsSync(inputPath)) {
  console.error(`Missing scraper output: ${inputPath}`);
  process.exit(1);
}

let rows = readMapsScraperJsonl(inputPath);
if (!args['keep-review-payloads'] && !args.keepReviewPayloads) {
  rows = rows.map(stripReviewPayloads);
  inputPath = rawPath;
  fs.writeFileSync(inputPath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}
const run = buildMapsScraperDiscoveryRun({
  rows,
  query,
  niche: args.niche || '',
  city: args.city || '',
  runId,
  toolLog: {
    tool: 'gosom/google-maps-scraper',
    toolVersion: `docker:${dockerImage}`,
    command: dockerResult?.command || '',
    rawPath: path.relative(process.cwd(), inputPath),
    proxy: args.proxies ? 'configured' : 'none',
    googlePlacesApi: 'not_used',
    emailExtraction: 'disabled',
    reviewBodyExtraction: 'disabled',
    reviewPayloadStorage: args['keep-review-payloads'] || args.keepReviewPayloads ? 'kept_by_explicit_override' : 'stripped_before_analysis',
    docker: dockerResult ? {
      status: dockerResult.status,
      signal: dockerResult.signal,
      skipped: dockerResult.skipped,
    } : null,
  },
});

const outputs = writeMapsScraperDiscoveryRun(run, runDir);
let store = null;
let queues = null;
let report = null;
if (updateStore) {
  store = upsertDiscoveryRun(run, {
    storeRoot,
    runPath: path.relative(process.cwd(), outputs.discoveryRun),
    generatedAt: run.generatedAt,
  });
  queues = buildDiscoveryQueues({ storeRoot });
  report = buildDiscoveryReport({ storeRoot });
}

console.log(JSON.stringify({
  ok: true,
  runId,
  query,
  runDir: path.relative(process.cwd(), runDir),
  totals: run.totals,
  outputs: Object.fromEntries(Object.entries(outputs).map(([key, value]) => [key, path.relative(process.cwd(), value)])),
  store: store ? {
    indexed: store.indexed,
    uniqueEntities: store.uniqueEntities,
    indexPath: path.relative(process.cwd(), store.indexPath),
    eventsPath: path.relative(process.cwd(), store.eventsPath),
    queuesPath: path.relative(process.cwd(), path.join(storeRoot, 'queues', 'queues.json')),
    reportPath: path.relative(process.cwd(), report.reportPath),
    queueCounts: queues ? {
      cheapSiteAudit: queues.cheapSiteAudit.length,
      enrichment: queues.enrichment.length,
      outreachBrief: queues.outreachBrief.length,
    } : null,
  } : null,
  topCandidates: run.leads.slice(0, Number(args['top'] || 8)).map((lead) => ({
    name: lead.name,
    websiteStatus: lead.websiteStatus,
    discoveryScore: lead.discoveryScore,
    recommendedAction: lead.recommendedAction,
    phone: lead.phone,
    website: lead.website,
    rating: lead.rating,
    reviewCount: lead.review_count,
  })),
}, null, 2));

function runDockerScrape({
  dockerImage,
  runDir,
  queriesPath,
  rawPath,
  depth,
  concurrency,
  lang,
  exitOnInactivity,
  proxies,
  dryRun,
}) {
  const argsList = [
    'run',
    '--rm',
    '-v',
    'gmaps-playwright-cache:/opt',
    '-v',
    `${queriesPath}:/queries.txt:ro`,
    '-v',
    `${runDir}:/out`,
    dockerImage,
    '-input',
    '/queries.txt',
    '-results',
    '/out/results.maps.json',
    '-json',
    '-depth',
    String(depth),
    '-c',
    String(concurrency),
    '-lang',
    lang,
    '-exit-on-inactivity',
    exitOnInactivity,
  ];
  if (proxies) argsList.push('-proxies', proxies);

  const command = `docker ${argsList.map(shellToken).join(' ')}`;
  fs.appendFileSync(path.join(runDir, 'tool-log.jsonl'), `${JSON.stringify({
    at: new Date().toISOString(),
    event: 'maps_scraper_discovery_started',
    command,
    costPolicy: {
      googlePlacesApi: 'not_used',
      emailExtraction: 'disabled',
      reviewBodyExtraction: 'disabled',
      reviewPayloadStorage: 'stripped_before_analysis',
      proxy: proxies ? 'configured' : 'none',
    },
  })}\n`);

  if (dryRun) {
    return { command, status: 0, signal: null, skipped: true };
  }

  const result = spawnSync('docker', argsList, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  fs.appendFileSync(path.join(runDir, 'tool-log.jsonl'), `${JSON.stringify({
    at: new Date().toISOString(),
    event: 'maps_scraper_discovery_finished',
    status: result.status,
    signal: result.signal,
    rawPath,
    payloadStorage: 'review_and_email_payloads_stripped_before_analysis',
  })}\n`);

  if (result.status !== 0) {
    throw new Error(`docker scraper failed with status ${result.status}`);
  }
  return { command, status: result.status, signal: result.signal, skipped: false };
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

function timestampSlug() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function shellToken(value) {
  const raw = String(value || '');
  if (/^[a-zA-Z0-9._:/@=-]+$/.test(raw)) return raw;
  return JSON.stringify(raw);
}

function stripReviewPayloads(row) {
  const {
    user_reviews: _userReviews,
    user_reviews_extended: _userReviewsExtended,
    emails: _emails,
    ...rest
  } = row;
  return {
    ...rest,
    discovery_payload_policy: {
      reviewBodies: 'stripped',
      emails: 'stripped',
    },
  };
}
