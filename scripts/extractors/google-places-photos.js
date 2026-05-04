#!/usr/bin/env node

import { loadLocalEnv } from '../../core/env/load-local-env.js';
import {
  downloadGooglePlacesPhotosForClient,
  GooglePlacesPhotoExtractor,
} from '../../core/extractors/google-places-photos.js';

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
const clientSlug = args.client;

if (!clientSlug) {
  console.error('Usage: node scripts/extractors/google-places-photos.js --client slug [--photo-reference ref1,ref2] [--limit 6] [--dry-run] [--write-evidence]');
  process.exit(1);
}

const extractor = new GooglePlacesPhotoExtractor({
  dryRun: Boolean(args.dryRun || args['dry-run']),
  campaignId: args.campaign,
  ledgerPath: args.ledger,
});

const photoReferences = args['photo-reference']
  ? String(args['photo-reference']).split(',').map((ref) => ref.trim()).filter(Boolean)
  : null;

const manifest = await downloadGooglePlacesPhotosForClient({
  clientSlug,
  evidencePath: args.evidence,
  outputDir: args.outputDir || args['output-dir'],
  manifestPath: args.manifest,
  photoReferences,
  writeEvidence: Boolean(args.writeEvidence || args['write-evidence']),
  limit: Number(args.limit || 6),
  maxWidth: Number(args.maxWidth || args['max-width'] || 1600),
  extractor,
});

console.log(`Google Places photos written: ${manifest.outputDir}`);
console.log(`Photos: ${manifest.photos.length}`);
for (const photo of manifest.photos) {
  console.log(`- ${photo.filePath} (${photo.bytes} bytes)`);
}
