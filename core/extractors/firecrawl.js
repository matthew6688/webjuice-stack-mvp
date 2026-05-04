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

export class FirecrawlExtractor {
  constructor({
    apiKey = process.env.FIRECRAWL_API_KEY,
    fetchImpl = globalThis.fetch,
    ledgerPath,
    campaignId,
    dryRun = false,
    unitCost = Number(process.env.FIRECRAWL_SCRAPE_UNIT_COST || 0),
  } = {}) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.ledgerPath = ledgerPath;
    this.campaignId = campaignId || null;
    this.dryRun = dryRun;
    this.unitCost = unitCost;
  }

  async scrape({ url, formats = ['markdown', 'html', 'links'], onlyMainContent = true }) {
    if (!url) throw new Error('url is required');
    if (this.dryRun) {
      this.logCost({ url, formats, dryRun: true });
      return dryRunScrape(url);
    }
    this.requireApiKey();

    const res = await this.fetchImpl('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats, onlyMainContent }),
    });
    const payload = await res.json();
    this.logCost({ url, formats, status: res.status, success: payload.success });
    if (!res.ok || !payload.success) {
      throw new Error(`Firecrawl scrape failed: HTTP ${res.status} ${JSON.stringify(payload.error || payload)}`);
    }
    return payload.data;
  }

  writeEvidenceFromScrape(scrape, { clientSlug, niche = 'restaurant', businessName, sourceUrl, outputPath } = {}) {
    if (!clientSlug) throw new Error('clientSlug is required to write evidence');
    const evidencePath = outputPath || defaultEvidencePath(clientSlug);
    const pack = fs.existsSync(evidencePath)
      ? loadEvidencePack(evidencePath)
      : createEvidencePack({ clientSlug, niche, businessName });

    const metadata = scrape.metadata || {};
    const scrapedAt = new Date().toISOString();
    const extractor = 'firecrawl_scrape';
    const url = sourceUrl || metadata.sourceURL || metadata.url;
    const add = (key, value, confidence = 0.75) => {
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return;
      addEvidenceItem(pack, {
        key,
        value,
        sourceType: 'official_site',
        sourceUrl: url,
        confidence,
        scrapedAt,
        extractor,
      });
    };

    add('website.homepage', url, 0.85);
    add('website.title', metadata.title, 0.8);
    add('website.description', metadata.description, 0.75);
    add('brand.ogImage', metadata.ogImage, 0.65);

    const text = [scrape.markdown, scrape.html].filter(Boolean).join('\n');
    add('contact.email', firstEmail(text), 0.75);
    add('contact.phoneFromWebsite', firstPhone(text), 0.6);

    const links = normalizeLinks(scrape.links || [], url);
    const menuLinks = links.filter(isMenuLink);
    const reservationLinks = links.filter(isReservationLink);
    const pdfLinks = links.filter((link) => link.toLowerCase().includes('.pdf'));
    add('links.menuCandidates', menuLinks, 0.7);
    add('links.reservationCandidates', reservationLinks, 0.7);
    add('links.pdfCandidates', pdfLinks, 0.7);
    if (menuLinks[0]) add('menu.source', menuLinks[0], 0.75);
    if (reservationLinks[0]) add('cta.reserve', reservationLinks[0], 0.75);

    return saveEvidencePack(pack, evidencePath);
  }

  writeRawArtifact(scrape, artifactPath) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, `${JSON.stringify(scrape, null, 2)}\n`);
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
      metadata,
    }, this.ledgerPath);
  }

  requireApiKey() {
    if (!this.apiKey) throw new Error('FIRECRAWL_API_KEY is required unless --dry-run is used');
  }
}

function normalizeLinks(links, sourceUrl) {
  const base = sourceUrl ? new URL(sourceUrl) : null;
  return [...new Set(links
    .map((link) => {
      try {
        return base ? new URL(link, base).toString() : link;
      } catch {
        return null;
      }
    })
    .filter(Boolean))];
}

function isMenuLink(link) {
  return /menu|food|drink|wine|dining|pdf/i.test(link);
}

function isReservationLink(link) {
  return /reserve|reservation|booking|book-now|opentable|resy|tock|sevenrooms|nowbookit/i.test(link);
}

function firstEmail(text) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
}

function firstPhone(text) {
  return text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}/)?.[0] || null;
}

function dryRunScrape(url) {
  return {
    markdown: [
      '# Demo Restaurant',
      'Modern dining in Brisbane.',
      'Email hello@example.com or call +61 7 3000 0000.',
      '[Menu](/menu.pdf)',
      '[Reserve](https://www.opentable.com/demo-restaurant)',
    ].join('\n\n'),
    html: '<html><head><title>Demo Restaurant</title><meta name="description" content="Modern dining in Brisbane."></head><body></body></html>',
    links: ['/menu.pdf', 'https://www.opentable.com/demo-restaurant', '/contact'],
    metadata: {
      title: 'Demo Restaurant',
      description: 'Modern dining in Brisbane.',
      ogImage: `${url.replace(/\/$/, '')}/og.jpg`,
      sourceURL: url,
      statusCode: 200,
      contentType: 'text/html',
    },
  };
}
