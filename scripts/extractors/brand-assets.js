#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  extractBrandAssetsFromHtml,
  fetchHtml,
  writeBrandAssetManifest,
  writeBrandEvidence,
} from '../../core/extractors/brand-assets.js';

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

if (!args.html && !args.url) {
  console.error('Usage: node scripts/extractors/brand-assets.js --html page.html --url https://example.com [--client slug] [--evidence evidence.json] [--manifest brand-assets.json] [--write-evidence]');
  console.error('   or: node scripts/extractors/brand-assets.js --url https://example.com [--client slug] [--write-evidence]');
  process.exit(1);
}

const sourceUrl = args.url || 'https://example.com/';
const html = args.html
  ? fs.readFileSync(args.html, 'utf8')
  : await fetchHtml(sourceUrl);
const assets = extractBrandAssetsFromHtml(html, { sourceUrl });
const manifestPath = args.manifest || (args.client
  ? path.join('clients', args.client, 'evidence', 'brand-assets.json')
  : null);

if (manifestPath) {
  writeBrandAssetManifest(assets, manifestPath);
  console.log(`Brand asset manifest written: ${manifestPath}`);
}

if (args.client && (args.writeEvidence || args['write-evidence'])) {
  const pack = writeBrandEvidence(assets, {
    clientSlug: args.client,
    niche: args.niche || 'restaurant',
    businessName: args.name,
    evidencePath: args.evidence,
  });
  console.log(`Evidence written: ${args.evidence || path.join('clients', args.client, 'evidence', 'evidence.json')}`);
  console.log(`Items: ${pack.items.length}`);
}

console.log(`Logos: ${assets.logoCandidates.length}`);
if (assets.logoCandidates[0]) console.log(`Best logo: ${assets.logoCandidates[0].url}`);
console.log(`Images: ${assets.imageCandidates.length}`);
if (assets.imageCandidates[0]) console.log(`Best image: ${assets.imageCandidates[0].url}`);
console.log(`Colors: ${assets.colors.join(', ') || 'none'}`);
console.log(`Fonts: ${assets.fonts.join(', ') || 'none'}`);
