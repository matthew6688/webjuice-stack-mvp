import fs from 'fs';
import path from 'path';
import { appendLedgerEvent } from '../finance/ledger.js';
import {
  defaultEvidencePath,
  evidenceItemsFromLead,
  saveEvidencePack,
} from '../evidence/evidence.js';

const DEFAULT_FIELDS = [
  'name',
  'formatted_address',
  'formatted_phone_number',
  'international_phone_number',
  'website',
  'url',
  'rating',
  'user_ratings_total',
  'photos',
  'opening_hours',
  'types',
  'geometry',
].join(',');

export class GooglePlacesExtractor {
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

  async searchText({ query, count = 20, niche, city }) {
    if (!query) throw new Error('query is required');
    if (this.dryRun) {
      this.logCost('text_search', this.unitCosts.textSearch, { query, count, dryRun: true });
      return dryRunPlaces(query, count, niche, city);
    }
    this.requireApiKey();

    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', query);
    url.searchParams.set('key', this.apiKey);

    const data = await this.fetchJson(url);
    this.logCost('text_search', this.unitCosts.textSearch, { query, status: data.status });
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Places Text Search failed: ${data.status} ${data.error_message || ''}`.trim());
    }
    return (data.results || []).slice(0, Number(count)).map((place) => normalizeSearchResult(place, { niche, city }));
  }

  async details({ placeId, niche, city, fields = DEFAULT_FIELDS }) {
    if (!placeId) throw new Error('placeId is required');
    if (this.dryRun) {
      this.logCost('details', this.unitCosts.details, { placeId, dryRun: true });
      return dryRunPlaceDetails(placeId, niche, city);
    }
    this.requireApiKey();

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', fields);
    url.searchParams.set('key', this.apiKey);

    const data = await this.fetchJson(url);
    this.logCost('details', this.unitCosts.details, { placeId, fields, status: data.status });
    if (data.status !== 'OK') {
      throw new Error(`Places Details failed: ${data.status} ${data.error_message || ''}`.trim());
    }
    return normalizeDetailsResult({ place_id: placeId, ...data.result }, { niche, city });
  }

  async extractLeads({ query, count = 20, niche, city }) {
    const searchResults = await this.searchText({ query, count, niche, city });
    const leads = [];
    for (const result of searchResults) {
      try {
        leads.push(await this.details({ placeId: result.place_id, niche, city }));
      } catch (error) {
        leads.push({ ...result, extractor_error: error.message });
      }
    }
    return leads;
  }

  writeEvidenceForLead(lead, { clientSlug, niche = lead.niche, outputPath } = {}) {
    if (!clientSlug) throw new Error('clientSlug is required to write evidence');
    const pack = evidenceItemsFromLead(lead, { clientSlug, niche });
    const normalizedMapsUrl = normalizeGoogleMapsUrl(lead.google_maps_url, lead.address);
    if (normalizedMapsUrl) {
      pack.items.push({
        key: 'cta.map',
        value: normalizedMapsUrl,
        sourceType: 'google_places',
        sourceUrl: lead.google_maps_url || normalizedMapsUrl,
        confidence: 0.95,
        scrapedAt: lead.scraped_at || new Date().toISOString(),
        extractor: 'google_places_details',
        metadata: {},
      });
    }
    return saveEvidencePack(pack, outputPath || defaultEvidencePath(clientSlug));
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

  async fetchJson(url) {
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.origin}`);
    return res.json();
  }
}

export function googlePlacesUnitCostsFromEnv() {
  return {
    textSearch: Number(process.env.GOOGLE_PLACES_TEXT_SEARCH_UNIT_COST || 0),
    details: Number(process.env.GOOGLE_PLACES_DETAILS_UNIT_COST || 0),
    photo: Number(process.env.GOOGLE_PLACES_PHOTO_UNIT_COST || 0),
  };
}

export function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function normalizeSearchResult(place, { niche, city }) {
  return {
    place_id: place.place_id,
    name: place.name,
    address: place.formatted_address,
    rating: place.rating || null,
    review_count: place.user_ratings_total || 0,
    types: place.types || [],
    photo_reference: place.photos?.[0]?.photo_reference || null,
    niche,
    city,
    scraped_at: new Date().toISOString(),
  };
}

function normalizeDetailsResult(place, { niche, city }) {
  return {
    place_id: place.place_id,
    name: place.name,
    address: place.formatted_address,
    phone: place.formatted_phone_number || place.international_phone_number || null,
    website: place.website || null,
    google_maps_url: place.url || null,
    rating: place.rating || null,
    review_count: place.user_ratings_total || 0,
    types: place.types || [],
    hours: place.opening_hours?.weekday_text || null,
    photo_reference: place.photos?.[0]?.photo_reference || null,
    photo_references: (place.photos || []).map((photo) => photo.photo_reference).filter(Boolean),
    location: place.geometry?.location || null,
    niche,
    city,
    scraped_at: new Date().toISOString(),
  };
}

function dryRunPlaces(query, count, niche, city) {
  return Array.from({ length: Number(count) }, (_, index) => ({
    place_id: `dryrun_place_${index + 1}`,
    name: `${query} Demo ${index + 1}`,
    address: `1 Demo Street, ${city || 'Demo City'}`,
    rating: 4.6,
    review_count: 123,
    types: [niche || 'restaurant'],
    niche,
    city,
    scraped_at: new Date().toISOString(),
  }));
}

function dryRunPlaceDetails(placeId, niche, city) {
  return {
    place_id: placeId,
    name: `Demo Place ${placeId.replace(/^dryrun_place_/, '')}`,
    address: `1 Demo Street, ${city || 'Demo City'}`,
    phone: '+61 7 3000 0000',
    website: 'https://example.com',
    google_maps_url: 'https://www.google.com/maps/search/?api=1&query=Demo%20Place',
    rating: 4.6,
    review_count: 123,
    types: [niche || 'restaurant'],
    hours: ['Monday: 9:00 AM - 5:00 PM'],
    photo_reference: 'dryrun_photo_reference',
    photo_references: ['dryrun_photo_reference'],
    location: { lat: -27.4698, lng: 153.0251 },
    niche,
    city,
    scraped_at: new Date().toISOString(),
  };
}

function normalizeGoogleMapsUrl(rawUrl, address) {
  const fallback = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
  if (!rawUrl) return fallback;
  try {
    const url = new URL(rawUrl);
    if (url.hostname.includes('google.com') && url.pathname.includes('/maps')) return url.toString();
    if (url.hostname === 'maps.google.com') return fallback || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawUrl)}`;
    return fallback || rawUrl;
  } catch {
    return fallback || rawUrl;
  }
}
