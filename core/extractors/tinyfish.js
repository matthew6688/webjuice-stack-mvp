import fs from 'fs';
import path from 'path';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';
import {
  addEvidenceItem,
  createEvidencePack,
  defaultEvidencePath,
  loadEvidencePack,
  saveEvidencePack,
} from '../evidence/evidence.js';
import { getBucket } from '../util/token-bucket.js';

const SEARCH_ENDPOINT = 'https://api.search.tinyfish.ai';
const FETCH_ENDPOINT = 'https://api.fetch.tinyfish.ai';
const DEFAULT_RATE_PER_MIN = Number(process.env.TINYFISH_RATE_PER_MIN || 30);

function tinyfishBucket() {
  return getBucket('tinyfish', { ratePerMinute: DEFAULT_RATE_PER_MIN });
}

export class TinyFishRateLimitedError extends Error {
  constructor(message, { provider, endpoint, retryAfterMs } = {}) {
    super(message);
    this.name = 'TinyFishRateLimitedError';
    this.provider = provider || 'tinyfish';
    this.endpoint = endpoint;
    this.retryAfterMs = retryAfterMs;
  }
}

export class TinyFishExtractor {
  constructor({
    apiKey = process.env.TINYFISH_API_KEY,
    fetchImpl = globalThis.fetch,
    ledgerPath,
    campaignId,
    dryRun = false,
    unitCost = Number(process.env.TINYFISH_FETCH_UNIT_COST || 0),
  } = {}) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.ledgerPath = ledgerPath;
    this.campaignId = campaignId || null;
    this.dryRun = dryRun;
    this.unitCost = unitCost;
  }

  async fetchPages({ urls }) {
    const list = Array.isArray(urls) ? urls.filter(Boolean) : [urls].filter(Boolean);
    if (!list.length) throw new Error('at least one url is required');
    if (this.dryRun) {
      this.logCost({ urls: list, dryRun: true });
      return dryRunFetch(list);
    }
    this.requireApiKey();

    const res = await this.fetchImpl('https://api.fetch.tinyfish.ai', {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls: list }),
    });
    const payload = await res.json();
    this.logCost({ urls: list, status: res.status, errors: payload.errors?.length || 0 });
    if (!res.ok) {
      throw new Error(`TinyFish fetch failed: HTTP ${res.status} ${JSON.stringify(payload)}`);
    }
    return payload;
  }

  writeEvidenceFromFetch(payload, { clientSlug, niche = 'restaurant', businessName, outputPath } = {}) {
    if (!clientSlug) throw new Error('clientSlug is required to write evidence');
    const evidencePath = outputPath || defaultEvidencePath(clientSlug);
    const pack = fs.existsSync(evidencePath)
      ? loadEvidencePack(evidencePath)
      : createEvidencePack({ clientSlug, niche, businessName });

    const fetchedAt = new Date().toISOString();
    for (const result of payload.results || []) {
      const sourceUrl = result.final_url || result.url;
      addEvidenceItem(pack, {
        key: 'website.pageText',
        value: {
          title: result.title || '',
          description: result.description || '',
          text: result.text || '',
          language: result.language || '',
        },
        sourceType: 'official_site',
        sourceUrl,
        confidence: 0.88,
        scrapedAt: fetchedAt,
        extractor: 'tinyfish_fetch',
      });
    }

    return saveEvidencePack(pack, evidencePath);
  }

  writeRawArtifact(payload, artifactPath) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, `${JSON.stringify(payload, null, 2)}\n`);
  }

  writeTextArtifact(payload, artifactPath) {
    const text = (payload.results || [])
      .map((result) => [
        `URL: ${result.final_url || result.url}`,
        `Title: ${result.title || ''}`,
        '',
        result.text || '',
      ].join('\n'))
      .join('\n\n---\n\n');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, text);
    return text;
  }

  logCost(metadata = {}) {
    if (!this.ledgerPath && !this.campaignId) return null;
    return appendLedgerEvent({
      type: 'cost',
      category: 'tinyfish',
      amount: this.unitCost,
      units: 1,
      unitCost: this.unitCost,
      currency: process.env.ROI_CURRENCY || 'USD',
      provider: 'tinyfish',
      campaignId: this.campaignId,
      metadata,
    }, this.ledgerPath);
  }

  requireApiKey() {
    if (!this.apiKey) throw new Error('TINYFISH_API_KEY is required unless --dry-run is used');
  }
}

/**
 * V2 search() — wraps api.search.tinyfish.ai with token bucket + V2 ledger.
 *
 * Returns { results: [{ position, title, snippet, url, site_name }], total_results, query }.
 *
 * Throws TinyFishRateLimitedError on local-bucket exhaustion or remote 429,
 * letting the upstream router escalate to the next provider.
 *
 * Pass leadId/clientSlug/stage/purpose to bind ledger events to the lead.
 */
export async function tinyfishSearch({
  query,
  location = '',
  language = 'en',
  apiKey = process.env.TINYFISH_API_KEY,
  fetchImpl = globalThis.fetch,
  ledgerPath,
  leadId,
  clientSlug,
  stage,
  purpose = 'lead_enrichment_search',
  campaignId,
  bucket = tinyfishBucket(),
} = {}) {
  if (!query) throw new Error('query is required');
  if (!apiKey) throw new Error('TINYFISH_API_KEY is required');

  // local rate limit gate
  if (!bucket.tryAcquire()) {
    appendRateLimitedEvent({
      ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
      provider: 'tinyfish', endpoint: 'search',
      reason: 'local_token_bucket', metadata: { query, location, language },
    });
    throw new TinyFishRateLimitedError('tinyfish search rate limited (local bucket)', {
      endpoint: SEARCH_ENDPOINT, retryAfterMs: bucket.msUntilNextToken(),
    });
  }

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('query', query);
  if (location) url.searchParams.set('location', location);
  if (language) url.searchParams.set('language', language);

  const start = Date.now();
  const res = await fetchImpl(url.toString(), { headers: { 'X-API-Key': apiKey } });
  const latencyMs = Date.now() - start;

  if (res.status === 429) {
    appendRateLimitedEvent({
      ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
      provider: 'tinyfish', endpoint: 'search',
      reason: 'remote_429', metadata: { query, status: res.status, latencyMs },
    });
    throw new TinyFishRateLimitedError('tinyfish search rate limited (remote 429)', {
      endpoint: SEARCH_ENDPOINT,
    });
  }
  if (!res.ok) {
    throw new Error(`tinyfish search failed: HTTP ${res.status}`);
  }

  const payload = await res.json();
  const requestHash = await hashRequest({ endpoint: 'search', query, location, language });

  if (ledgerPath || leadId || clientSlug) {
    appendLedgerEvent({
      type: 'cost',
      category: 'tinyfish_search',
      provider: 'tinyfish',
      tier: 'T0',
      leadId, clientSlug, stage, purpose,
      requestHash,
      campaignId,
      units: 1,
      unitCost: 0,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'search', query, location, language,
        results_count: (payload.results || []).length,
        total_results: payload.total_results,
        latency_ms: latencyMs,
        http_status: res.status,
      },
    }, ledgerPath);
  }

  return payload;
}

/**
 * V2 fetchUrls() — wraps api.fetch.tinyfish.ai with token bucket + V2 ledger.
 *
 * Returns { results: [{ url, final_url, title, description, language, text, latency_ms, format }], errors }.
 */
export async function tinyfishFetchUrls({
  urls,
  format = 'markdown',
  apiKey = process.env.TINYFISH_API_KEY,
  fetchImpl = globalThis.fetch,
  ledgerPath,
  leadId,
  clientSlug,
  stage,
  purpose = 'lead_enrichment_fetch',
  campaignId,
  bucket = tinyfishBucket(),
} = {}) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [urls].filter(Boolean);
  if (!list.length) throw new Error('at least one url is required');
  if (!apiKey) throw new Error('TINYFISH_API_KEY is required');

  if (!bucket.tryAcquire()) {
    appendRateLimitedEvent({
      ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
      provider: 'tinyfish', endpoint: 'fetch',
      reason: 'local_token_bucket', metadata: { urls: list, format },
    });
    throw new TinyFishRateLimitedError('tinyfish fetch rate limited (local bucket)', {
      endpoint: FETCH_ENDPOINT, retryAfterMs: bucket.msUntilNextToken(),
    });
  }

  const start = Date.now();
  const res = await fetchImpl(FETCH_ENDPOINT, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: list, format }),
  });
  const latencyMs = Date.now() - start;

  if (res.status === 429) {
    appendRateLimitedEvent({
      ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
      provider: 'tinyfish', endpoint: 'fetch',
      reason: 'remote_429', metadata: { urls: list, format, status: res.status, latencyMs },
    });
    throw new TinyFishRateLimitedError('tinyfish fetch rate limited (remote 429)', {
      endpoint: FETCH_ENDPOINT,
    });
  }
  if (!res.ok) {
    throw new Error(`tinyfish fetch failed: HTTP ${res.status}`);
  }

  const payload = await res.json();
  const requestHash = await hashRequest({ endpoint: 'fetch', urls: list, format });

  if (ledgerPath || leadId || clientSlug) {
    appendLedgerEvent({
      type: 'cost',
      category: 'tinyfish_fetch',
      provider: 'tinyfish',
      tier: 'T0',
      leadId, clientSlug, stage, purpose,
      requestHash,
      campaignId,
      units: list.length,
      unitCost: 0,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'fetch', urls: list, format,
        results_count: (payload.results || []).length,
        errors_count: (payload.errors || []).length,
        latency_ms: latencyMs,
        http_status: res.status,
      },
    }, ledgerPath);
  }

  return payload;
}

function appendRateLimitedEvent({
  ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
  provider, endpoint, reason, metadata,
}) {
  if (!ledgerPath && !leadId && !clientSlug) return;
  appendLedgerEvent({
    type: 'cost',
    category: 'provider_rate_limited',
    provider,
    tier: 'T0',
    leadId, clientSlug, stage, purpose,
    campaignId,
    units: 1,
    unitCost: 0,
    amount: 0,
    currency: process.env.ROI_CURRENCY || 'USD',
    metadata: { endpoint, reason, ...metadata },
  }, ledgerPath);
}

export function isCriticalContentPage({ url = '', niche = '', pageType = '' } = {}) {
  const value = `${url} ${pageType}`.toLowerCase();
  if (niche === 'restaurant' && /menu|menus|lunch|dinner|food|drink|wine|special|experience/.test(value)) return true;
  return /service|pricing|catalog|product|menu/.test(value);
}

function dryRunFetch(urls) {
  return {
    results: urls.map((url) => ({
      url,
      final_url: url,
      title: 'Demo Menu',
      description: '',
      language: 'en',
      text: [
        '# Demo Menu',
        '$12',
        'Artisan Sourdough',
        'Cultured butter',
        '$24',
        'Market Fish',
        'Seasonal preparation',
      ].join('\n\n'),
    })),
    errors: [],
  };
}
