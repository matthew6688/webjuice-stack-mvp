#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GooglePlacesExtractor } from '../../core/extractors/google-places.js';
import { extractBrandAssetsFromHtml } from '../../core/extractors/brand-assets.js';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extractor-normalization-'));
const evidencePath = path.join(tempRoot, 'evidence.json');

const extractor = new GooglePlacesExtractor({ dryRun: true });
const pack = extractor.writeEvidenceForLead({
  place_id: 'place_123',
  name: 'Demo Venue',
  address: '123 Demo Street, Brisbane QLD 4000',
  phone: '(07) 3000 0000',
  website: 'https://example.com',
  google_maps_url: 'https://maps.google.com/?cid=123456',
  rating: 4.8,
  review_count: 120,
  niche: 'restaurant',
  city: 'Brisbane',
  scraped_at: new Date().toISOString(),
}, {
  clientSlug: 'demo-venue',
  niche: 'restaurant',
  outputPath: evidencePath,
});

const normalizedMap = pack.resolved?.cta?.map?.value || '';
assert.ok(normalizedMap.includes('google.com/maps/search'), 'Google Places map CTA should normalize to google.com/maps/search');

const assets = extractBrandAssetsFromHtml(`
  <html>
    <head>
      <meta property="og:image" content="http://static1.squarespace.com/example.jpg" />
    </head>
    <body>
      <img src="http://static1.squarespace.com/logo.png" alt="Demo logo" />
    </body>
  </html>
`, { sourceUrl: 'https://example.com/' });

assert.equal(assets.logoCandidates[0]?.url.startsWith('https://'), true, 'Brand asset logo URLs should upgrade to https');
assert.equal(assets.imageCandidates[0]?.url.startsWith('https://'), true, 'Brand asset image URLs should upgrade to https');

console.log(JSON.stringify({
  ok: true,
  assertions: {
    normalizedMap,
    logoUrl: assets.logoCandidates[0]?.url || '',
    imageUrl: assets.imageCandidates[0]?.url || '',
  },
}, null, 2));
