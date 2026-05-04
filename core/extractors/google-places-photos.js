import fs from 'fs';
import path from 'path';
import { appendLedgerEvent } from '../finance/ledger.js';
import {
  addEvidenceItem,
  defaultEvidencePath,
  loadEvidencePack,
  saveEvidencePack,
} from '../evidence/evidence.js';
import { googlePlacesUnitCostsFromEnv, writeJson } from './google-places.js';

const DRY_RUN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

export class GooglePlacesPhotoExtractor {
  constructor({
    apiKey = process.env.GOOGLE_PLACES_API_KEY,
    fetchImpl = globalThis.fetch,
    ledgerPath,
    campaignId,
    dryRun = false,
    unitCosts = googlePlacesUnitCostsFromEnv(),
  } = {}) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.ledgerPath = ledgerPath;
    this.campaignId = campaignId || null;
    this.dryRun = dryRun;
    this.unitCosts = unitCosts;
  }

  async downloadPhotos({
    clientSlug,
    photoReferences,
    outputDir = path.join('clients', clientSlug, 'evidence', 'media', 'google-places'),
    maxWidth = 1600,
    limit = 6,
  }) {
    if (!clientSlug) throw new Error('clientSlug is required');
    const refs = [...new Set((photoReferences || []).filter(Boolean))].slice(0, Number(limit));
    if (!refs.length) throw new Error('At least one Google Places photo reference is required');

    fs.mkdirSync(outputDir, { recursive: true });
    const photos = [];

    for (const [index, photoReference] of refs.entries()) {
      const fileName = `photo-${String(index + 1).padStart(2, '0')}.${this.dryRun ? 'png' : 'jpg'}`;
      const filePath = path.join(outputDir, fileName);
      const result = this.dryRun
        ? writeDryRunPhoto(filePath, photoReference)
        : await this.fetchPhoto({ photoReference, filePath, maxWidth });
      this.logCost('photo', this.unitCosts.photo, { clientSlug, photoReference, dryRun: this.dryRun });
      photos.push({
        index: index + 1,
        photoReference,
        filePath,
        sourceUrl: result.sourceUrl,
        contentType: result.contentType,
        bytes: result.bytes,
      });
    }

    return {
      clientSlug,
      generatedAt: new Date().toISOString(),
      outputDir,
      photos,
    };
  }

  appendEvidence(pack, manifest) {
    const scrapedAt = manifest.generatedAt || new Date().toISOString();
    addEvidenceItem(pack, {
      key: 'media.photos',
      value: manifest.photos.map((photo) => ({
        filePath: photo.filePath,
        sourceUrl: photo.sourceUrl,
        sourceType: 'google_places',
      })),
      sourceType: 'google_places',
      sourceUrl: manifest.photos[0]?.sourceUrl || null,
      confidence: this.dryRun ? 0.55 : 0.85,
      scrapedAt,
      extractor: 'google_places_photo',
      metadata: {
        count: manifest.photos.length,
        dryRun: this.dryRun,
      },
    });
    return pack;
  }

  async fetchPhoto({ photoReference, filePath, maxWidth }) {
    this.requireApiKey();
    const url = new URL('https://maps.googleapis.com/maps/api/place/photo');
    url.searchParams.set('maxwidth', String(maxWidth));
    url.searchParams.set('photo_reference', photoReference);
    url.searchParams.set('key', this.apiKey);

    const response = await this.fetchImpl(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Places Photo failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, bytes);
    return {
      sourceUrl: stripKey(response.url),
      contentType: response.headers.get('content-type') || 'image/jpeg',
      bytes: bytes.length,
    };
  }

  logCost(sku, amount, metadata = {}) {
    if (!this.ledgerPath && !this.campaignId) return null;
    return appendLedgerEvent({
      type: 'cost',
      category: 'google_places',
      amount,
      units: 1,
      unitCost: amount,
      currency: process.env.ROI_CURRENCY || 'USD',
      provider: 'google',
      campaignId: this.campaignId,
      metadata: { sku, ...metadata },
    }, this.ledgerPath);
  }

  requireApiKey() {
    if (!this.apiKey) throw new Error('GOOGLE_PLACES_API_KEY is required unless --dry-run is used');
  }
}

export function photoReferencesFromEvidence(pack) {
  const refs = [];
  for (const item of pack.items || []) {
    if (item.key === 'google.photoReference' && item.value) refs.push(item.value);
    if (item.key === 'google.photoReferences' && Array.isArray(item.value)) refs.push(...item.value);
  }
  return [...new Set(refs.filter(Boolean))];
}

export async function downloadGooglePlacesPhotosForClient({
  clientSlug,
  evidencePath = defaultEvidencePath(clientSlug),
  outputDir,
  manifestPath = path.join('clients', clientSlug, 'evidence', 'media', 'google-places', 'manifest.json'),
  photoReferences,
  writeEvidence = false,
  extractor,
  ...options
}) {
  const pack = loadEvidencePack(evidencePath);
  const refs = photoReferences?.length ? photoReferences : photoReferencesFromEvidence(pack);
  const manifest = await extractor.downloadPhotos({
    clientSlug,
    photoReferences: refs,
    outputDir,
    ...options,
  });
  writeJson(manifestPath, manifest);
  if (writeEvidence) saveEvidencePack(extractor.appendEvidence(pack, manifest), evidencePath);
  return manifest;
}

function writeDryRunPhoto(filePath, photoReference) {
  fs.writeFileSync(filePath, DRY_RUN_PNG);
  return {
    sourceUrl: `google-place-photo:${photoReference}`,
    contentType: 'image/png',
    bytes: DRY_RUN_PNG.length,
  };
}

function stripKey(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.delete('key');
  return url.toString();
}
