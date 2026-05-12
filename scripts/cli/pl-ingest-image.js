#!/usr/bin/env node

// pl:ingest-image — V2 image-lead ingestion CLI.
// Accepts OCR-extracted fields via flags and writes a discovery entity.
//
// TODO(G-6.1): OCR/VLM auto-extract from --image. For now, caller supplies
// businessName/phone/address via flags. When G-6.1 lands, --image alone will
// be enough — extraction happens inside this CLI before runImageLeadToV2.

import path from 'path';
import fs from 'fs';
import { runImageLeadToV2 } from '../../core/leads/image-lead-discovery-v2.js';

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsageAndExit(0);
}

const imagePath = String(args.image || '').trim();
const niche = String(args.niche || '').trim();
const city = String(args.city || '').trim();
const businessName = String(args['business-name'] || args.businessName || '').trim();
const phone = String(args.phone || '').trim();
const address = String(args.address || '').trim();
const website = String(args.website || '').trim();
const category = String(args.category || '').trim();
const batchId = String(args['batch-id'] || args.batchId || '').trim();
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const storeRoot = path.resolve(args['store-root'] || args.storeRoot || path.join('data', 'leads'));

const missing = [];
if (!imagePath) missing.push('--image');
if (!niche) missing.push('--niche');
if (!city) missing.push('--city');
if (!businessName) missing.push('--business-name');
if (missing.length) {
  console.error(`Missing required flags: ${missing.join(', ')}`);
  printUsageAndExit(1);
}

if (!dryRun && imagePath && !fs.existsSync(imagePath)) {
  console.error(`Image file not found: ${imagePath} (use --dry-run to skip file check)`);
  process.exit(1);
}

const result = runImageLeadToV2({
  imagePath,
  ocrResult: {
    businessName,
    phone,
    address,
    website,
    category,
  },
  niche,
  city,
  batchId,
  storeRoot,
  dryRun,
});

console.log(JSON.stringify({
  ok: result.ok,
  dryRun: result.dryRun,
  entityKey: result.entityKey,
  action: result.action,
  entityPath: path.relative(process.cwd(), result.entityPath),
  runId: result.runId,
  indexed: result.indexed ?? null,
  uniqueEntities: result.uniqueEntities ?? null,
  queueCounts: result.queueCounts ?? null,
  lead: result.lead ?? null,
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

function printUsageAndExit(code) {
  console.error('Usage: npm run pl:ingest-image -- \\');
  console.error('  --image <path> --niche <string> --city <string> --business-name <string> \\');
  console.error('  [--phone <string>] [--address <string>] [--website <string>] [--category <string>] \\');
  console.error('  [--batch-id <string>] [--dry-run]');
  process.exit(code);
}
