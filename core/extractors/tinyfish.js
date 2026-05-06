import fs from 'fs';
import path from 'path';
import { appendLedgerEvent } from '../finance/ledger.js';
import {
  addEvidenceItem,
  createEvidencePack,
  defaultEvidencePath,
  loadEvidencePack,
  saveEvidencePack,
} from '../evidence/evidence.js';

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
