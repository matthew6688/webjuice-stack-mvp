import fs from 'fs';
import path from 'path';
import { appendLedgerEvent } from '../finance/ledger.js';
import { writeMenuEvidenceFromText } from './menu.js';

export class FirecrawlParseExtractor {
  constructor({
    apiKey = process.env.FIRECRAWL_API_KEY,
    fetchImpl = globalThis.fetch,
    ledgerPath,
    campaignId,
    dryRun = false,
    unitCost = Number(process.env.FIRECRAWL_PARSE_UNIT_COST || process.env.FIRECRAWL_SCRAPE_UNIT_COST || 0),
  } = {}) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.ledgerPath = ledgerPath;
    this.campaignId = campaignId || null;
    this.dryRun = dryRun;
    this.unitCost = unitCost;
  }

  async parseFile({
    inputPath,
    formats = ['markdown'],
    parsers = ['pdf'],
    onlyMainContent = true,
    zeroDataRetention = false,
  }) {
    if (!inputPath) throw new Error('inputPath is required');
    if (this.dryRun) {
      this.logCost({ inputPath, formats, parsers, dryRun: true });
      return dryRunParse(inputPath);
    }
    this.requireApiKey();

    const bytes = fs.readFileSync(inputPath);
    const form = new FormData();
    form.set('file', new Blob([bytes]), path.basename(inputPath));
    form.set('options', JSON.stringify({
      formats,
      onlyMainContent,
      parsers,
      zeroDataRetention,
      removeBase64Images: true,
    }));

    const res = await this.fetchImpl('https://api.firecrawl.dev/v2/parse', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: form,
    });
    const payload = await res.json();
    this.logCost({ inputPath, formats, parsers, status: res.status, success: payload.success });
    if (!res.ok || !payload.success) {
      throw new Error(`Firecrawl parse failed: HTTP ${res.status} ${JSON.stringify(payload.error || payload)}`);
    }
    return payload.data;
  }

  writeMenuEvidence(parseData, {
    clientSlug,
    niche = 'restaurant',
    businessName,
    sourceUrl,
    sourceType = 'firecrawl',
    outputPath,
    confidence = 0.8,
  } = {}) {
    const text = [parseData.markdown, parseData.summary, parseData.html].filter(Boolean).join('\n');
    return writeMenuEvidenceFromText(text, {
      clientSlug,
      niche,
      businessName,
      sourceUrl,
      sourceType,
      outputPath,
      confidence,
    });
  }

  writeRawArtifact(parseData, artifactPath) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, `${JSON.stringify(parseData, null, 2)}\n`);
  }

  logCost(metadata = {}) {
    if (!this.ledgerPath && !this.campaignId) return null;
    return appendLedgerEvent({
      type: 'cost',
      category: 'firecrawl',
      amount: this.unitCost,
      units: 1,
      unitCost: this.unitCost,
      currency: process.env.ROI_CURRENCY || 'USD',
      provider: 'firecrawl',
      campaignId: this.campaignId,
      metadata: { endpoint: 'parse', ...metadata },
    }, this.ledgerPath);
  }

  requireApiKey() {
    if (!this.apiKey) throw new Error('FIRECRAWL_API_KEY is required unless --dry-run is used');
  }
}

function dryRunParse(inputPath) {
  return {
    markdown: [
      '# Demo Parsed Menu',
      'Starters',
      'Salt Pepper Calamari - chilli lime aioli 18',
      'Chicken Skewers 16',
      '',
      'Mains',
      'Barramundi - coconut curry sauce 34',
      'Vegetable Laksa 24',
    ].join('\n'),
    metadata: {
      sourceURL: inputPath,
      contentType: inputPath.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain',
    },
  };
}
