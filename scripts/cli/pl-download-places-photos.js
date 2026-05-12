#!/usr/bin/env node
/**
 * pl:download-places-photos — download Place Photos for a given entity,
 * upload to Cloudinary, persist secure URLs in entity.latest.places_enrichment.photo_urls[].
 *
 * SOP-1 G-13 (2026-05-12).
 *
 * Prereq: entity must have latest.places_enrichment.photo_references[]
 *         (set by `pl:places-enrich` after Place Details API call).
 *
 * Cost: Place Photos API = $0.007/photo (within $200/mo free quota).
 *       For 1 entity × up to 6 photos = $0.042 max.
 *
 * Usage:
 *   npm run pl:download-places-photos -- --entity-key place_<id> [--limit 6] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { GooglePlacesPhotoExtractor } from '../../core/extractors/google-places-photos.js';
import { PlacesQuotaGuard, PlacesQuotaCapExceeded } from '../../core/extractors/places-quota-guard.js';
import { uploadAttachmentsToCloudinary, cloudinaryConfigured } from '../../core/cloudinary/attachments.js';
import { pushAlert } from '../../core/ops/alert-pusher.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, tok, i, arr) => {
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = arr[i + 1];
      acc.push([key, next && !next.startsWith('--') ? next : true]);
    }
    return acc;
  }, [])
);

const ENTITY_KEY = args['entity-key'] || args.k;
const LIMIT = parseInt(args.limit, 10) || 6;
const DRY_RUN = !!args['dry-run'];
const MAX_WIDTH = parseInt(args['max-width'], 10) || 1600;

if (!ENTITY_KEY) {
  console.error('Usage: pl:download-places-photos --entity-key place_<id> [--limit 6] [--max-width 1600] [--dry-run]');
  process.exit(2);
}

const REPO_ROOT = path.resolve(process.cwd());
const ENTITY_PATH = path.join(REPO_ROOT, `data/leads/entities/${ENTITY_KEY}.json`);
const PHOTOS_DIR = path.join(REPO_ROOT, `data/v2/fixtures/places-photos/${ENTITY_KEY}`);
const LEDGER_PATH = path.join(REPO_ROOT, 'data/finance/ledger.jsonl');

if (!fs.existsSync(ENTITY_PATH)) {
  console.error(`Entity not found: ${ENTITY_PATH}`);
  process.exit(2);
}
const entity = JSON.parse(fs.readFileSync(ENTITY_PATH, 'utf8'));
const photoRefs = (entity.latest?.places_enrichment?.photo_references || []).filter(Boolean);

if (photoRefs.length === 0) {
  console.error(`Entity has no photo_references. Run pl:places-enrich first.`);
  console.error(`  npm run pl:places-enrich -- --entity-key ${ENTITY_KEY}`);
  process.exit(2);
}

console.log(`Entity: ${entity.latest?.name || ENTITY_KEY}`);
console.log(`Photo references found: ${photoRefs.length} (will download up to ${LIMIT})`);

// Quota guard — Places Photo API is a separate SKU but counts against the same monthly $200
const guard = new PlacesQuotaGuard();
const refsToFetch = photoRefs.slice(0, LIMIT);

if (DRY_RUN) {
  console.log(JSON.stringify({
    ok: true,
    dry_run: true,
    entity_key: ENTITY_KEY,
    photo_refs_total: photoRefs.length,
    photos_to_download: refsToFetch.length,
    max_width: MAX_WIDTH,
    output_dir: path.relative(REPO_ROOT, PHOTOS_DIR),
    cloudinary_configured: cloudinaryConfigured(process.env),
  }, null, 2));
  process.exit(0);
}

if (!cloudinaryConfigured(process.env)) {
  console.error('Cloudinary not configured (CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET required)');
  process.exit(1);
}

// Reserve photo quota (one charge per photo we'll download)
let selectedKey;
try {
  selectedKey = guard.selectAvailableKey();
  for (let i = 0; i < refsToFetch.length; i += 1) {
    await guard.checkAndCharge(1, { skuLabel: 'photo', keyId: selectedKey.keyId });
  }
} catch (err) {
  if (err instanceof PlacesQuotaCapExceeded) {
    console.error(`HARD CAP: ${err.message}`);
    await pushAlert({
      title: 'Places Photo API capped',
      detail: `Cannot download photos for ${ENTITY_KEY}: ${err.message}`,
      severity: 'error',
      source: 'pl:download-places-photos',
    });
    process.exit(1);
  }
  throw err;
}

console.log(`Using key: ${selectedKey.keyId}`);

// Step 1: Download photos to disk (via existing extractor with custom outputDir)
const photoExtractor = new GooglePlacesPhotoExtractor({
  apiKey: selectedKey.apiKey,
  ledgerPath: LEDGER_PATH,
});
fs.mkdirSync(PHOTOS_DIR, { recursive: true });
let manifest;
try {
  manifest = await photoExtractor.downloadPhotos({
    clientSlug: ENTITY_KEY,         // ledger label only; we override outputDir
    photoReferences: refsToFetch,
    outputDir: PHOTOS_DIR,
    maxWidth: MAX_WIDTH,
    limit: LIMIT,
  });
} catch (err) {
  console.error(`Photo download failed: ${err.message}`);
  process.exit(1);
}

console.log(`Downloaded ${manifest.photos.length} photos → ${path.relative(REPO_ROOT, PHOTOS_DIR)}`);

// Step 2: Read files into Cloudinary attachments shape
const attachments = manifest.photos.map((photo) => {
  const buf = fs.readFileSync(photo.filePath);
  return {
    filename: path.basename(photo.filePath),
    content_type: photo.contentType || 'image/jpeg',
    content: buf.toString('base64'),
    size: buf.length,
  };
});

// Step 3: Upload to Cloudinary
const uploadRes = await uploadAttachmentsToCloudinary(process.env, attachments, {
  clientSlug: ENTITY_KEY.slice(0, 50),
  submissionType: 'places-photos',
  orderId: 'gmb',
});

if (!uploadRes.ok) {
  console.error(`Cloudinary upload failed: ${uploadRes.reason || uploadRes.error}`);
  process.exit(1);
}

console.log(`Uploaded ${uploadRes.assets.length} photos to Cloudinary`);

// Step 4: Persist secureUrls back to entity
const photoUrls = uploadRes.assets.map((asset, i) => ({
  url: asset.secureUrl,
  publicId: asset.publicId,
  bytes: asset.bytes,
  index: i + 1,
  photo_reference: refsToFetch[i] || null,
}));

entity.latest = entity.latest || {};
entity.latest.places_enrichment = entity.latest.places_enrichment || {};
entity.latest.places_enrichment.photo_urls = photoUrls;
entity.latest.places_enrichment.photos_downloaded_at = new Date().toISOString();
entity.history = [
  ...(entity.history || []),
  { at: new Date().toISOString(), event: 'places_photos_downloaded', count: photoUrls.length },
].slice(-100);

fs.writeFileSync(ENTITY_PATH, JSON.stringify(entity, null, 2));

console.log(JSON.stringify({
  ok: true,
  entity_key: ENTITY_KEY,
  photos_downloaded: manifest.photos.length,
  photos_uploaded: uploadRes.assets.length,
  total_bytes: uploadRes.assets.reduce((s, a) => s + (a.bytes || 0), 0),
  first_cloudinary_url: uploadRes.assets[0]?.secureUrl,
  entity_path: path.relative(REPO_ROOT, ENTITY_PATH),
  photos_dir: path.relative(REPO_ROOT, PHOTOS_DIR),
}, null, 2));
