/**
 * DuckDuckGo SERP scrape via local Playwright.
 *
 * V2 fail-soft fallback for the search chain when Tinyfish search is
 * unavailable / insufficient. Costs nothing (T0), but DDG can rate-limit
 * or anti-bot the scraper, so this is positioned as a backup.
 */

import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';
import { getBucket } from '../util/token-bucket.js';

const DEFAULT_RATE_PER_MIN = Number(process.env.DDG_RATE_PER_MIN || 12);
const SERP_URL = 'https://duckduckgo.com/html/';

function ddgBucket() {
  return getBucket('ddg', { ratePerMinute: DEFAULT_RATE_PER_MIN });
}

export class DdgRateLimitedError extends Error {
  constructor(message, { retryAfterMs } = {}) {
    super(message);
    this.name = 'DdgRateLimitedError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class DdgBlockedError extends Error {
  constructor(message, { reason } = {}) {
    super(message);
    this.name = 'DdgBlockedError';
    this.reason = reason;
  }
}

/**
 * Run a SERP query against DDG's html.duckduckgo.com endpoint.
 * Returns { query, results: [{ position, title, snippet, url, site_name }] }.
 *
 * Uses Playwright Chromium headless. Caller passes browser if they want to
 * reuse one across queries; otherwise we spawn + close.
 */
export async function ddgSearch({
  query,
  maxResults = 10,
  browser: providedBrowser,
  ledgerPath,
  leadId,
  clientSlug,
  stage,
  purpose = 'lead_enrichment_search',
  campaignId,
  bucket = ddgBucket(),
} = {}) {
  if (!query) throw new Error('query is required');

  if (!bucket.tryAcquire()) {
    appendRateLimitedEvent({
      ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
      reason: 'local_token_bucket', metadata: { query },
    });
    throw new DdgRateLimitedError('ddg search rate limited (local bucket)', {
      retryAfterMs: bucket.msUntilNextToken(),
    });
  }

  // Lazy-import playwright so the module can load even if Playwright isn't installed
  const { chromium } = await import('playwright');
  const browser = providedBrowser || await chromium.launch({ headless: true });
  const ownsBrowser = !providedBrowser;

  const start = Date.now();
  let results;
  let httpStatus = 0;
  try {
    const page = await browser.newPage();
    const url = new URL(SERP_URL);
    url.searchParams.set('q', query);
    const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20_000 });
    httpStatus = response?.status() || 0;

    if (httpStatus !== 200) {
      appendUnavailableEvent({
        ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
        reason: `http_${httpStatus}`, metadata: { query, http_status: httpStatus },
      });
      throw new DdgBlockedError(`ddg returned HTTP ${httpStatus}`, { reason: `http_${httpStatus}` });
    }

    // DDG html SERP — each result is a div.result with .result__a (title link), .result__snippet, .result__url
    results = await page.$$eval('.result', (nodes, max) => {
      const out = [];
      for (const node of nodes) {
        if (out.length >= max) break;
        const titleEl = node.querySelector('.result__a');
        const snippetEl = node.querySelector('.result__snippet');
        const urlEl = node.querySelector('.result__url');
        if (!titleEl) continue;
        const href = titleEl.href || '';
        const url = href || (urlEl?.textContent || '').trim();
        out.push({
          position: out.length + 1,
          title: (titleEl.textContent || '').trim(),
          snippet: (snippetEl?.textContent || '').trim(),
          url,
          site_name: (urlEl?.textContent || '').trim(),
        });
      }
      return out;
    }, maxResults);

    if (!results.length) {
      // DDG sometimes returns a captcha / "anomalous traffic" page
      appendUnavailableEvent({
        ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
        reason: 'empty_serp', metadata: { query, http_status: httpStatus },
      });
      throw new DdgBlockedError('ddg returned empty SERP (likely anti-bot)', { reason: 'empty_serp' });
    }

    await page.close();
  } finally {
    if (ownsBrowser) await browser.close();
  }
  const latencyMs = Date.now() - start;
  const requestHash = await hashRequest({ provider: 'ddg', endpoint: 'search', query, maxResults });

  if (ledgerPath || leadId || clientSlug) {
    appendLedgerEvent({
      type: 'cost',
      category: 'ddg_local',
      provider: 'ddg',
      tier: 'T0',
      leadId, clientSlug, stage, purpose,
      requestHash,
      campaignId,
      units: 1,
      unitCost: 0,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'search', query, maxResults,
        results_count: results.length,
        latency_ms: latencyMs,
        http_status: httpStatus,
      },
    }, ledgerPath);
  }

  return { query, results };
}

function appendRateLimitedEvent({ ledgerPath, leadId, clientSlug, stage, purpose, campaignId, reason, metadata }) {
  if (!ledgerPath && !leadId && !clientSlug) return;
  appendLedgerEvent({
    type: 'cost',
    category: 'provider_rate_limited',
    provider: 'ddg',
    tier: 'T0',
    leadId, clientSlug, stage, purpose, campaignId,
    units: 1, unitCost: 0, amount: 0,
    currency: process.env.ROI_CURRENCY || 'USD',
    metadata: { endpoint: 'search', reason, ...metadata },
  }, ledgerPath);
}

function appendUnavailableEvent({ ledgerPath, leadId, clientSlug, stage, purpose, campaignId, reason, metadata }) {
  if (!ledgerPath && !leadId && !clientSlug) return;
  appendLedgerEvent({
    type: 'cost',
    category: 'provider_unavailable',
    provider: 'ddg',
    tier: 'T0',
    leadId, clientSlug, stage, purpose, campaignId,
    units: 1, unitCost: 0, amount: 0,
    currency: process.env.ROI_CURRENCY || 'USD',
    metadata: { endpoint: 'search', reason, ...metadata },
  }, ledgerPath);
}
