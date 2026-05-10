/**
 * PageSpeed Insights API client.
 *
 * Free tier with API key: 25,000 queries/day, 240/min — way more than
 * we need. Each lead audit fires 2 calls (mobile + desktop), so 1k leads
 * /day = 2k calls = 8% of free quota.
 *
 * What this gives us beyond our local Playwright + heuristic estimate:
 *   - Real Lighthouse 0-100 scores: performance / a11y / best-practices / SEO
 *   - Specific opportunities (defer JS, optimize images, etc) — actionable
 *     "redesign would save N ms / N MB" sales bullets
 *   - **CRUX field data** — actual real-user metrics from the last 28 days
 *     across all visitors to the site (LCP / FCP / CLS / INP / TTFB).
 *     This is the persuasive bit: not "we tested once", but "Google's
 *     real-user telemetry shows your visitors wait X seconds".
 *
 * Tier T2 (free with key) but ledgered as T0-cost since no $ involved.
 */

import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const TIMEOUT_MS = 60_000;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

function num(v) { return typeof v === 'number' ? v : null; }

async function fetchOnce(url, strategy, apiKey, fetchImpl) {
  const u = new URL(ENDPOINT);
  u.searchParams.set('url', url);
  u.searchParams.set('strategy', strategy);
  for (const cat of CATEGORIES) u.searchParams.append('category', cat);
  if (apiKey) u.searchParams.set('key', apiKey);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(u, { signal: ctrl.signal });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      return { ok: false, reason: msg };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally { clearTimeout(timer); }
}

function summarize(strategy, data) {
  if (!data) return null;
  const lh = data.lighthouseResult || {};
  const cats = lh.categories || {};
  const audits = lh.audits || {};
  const crux = data.loadingExperience || {};
  const cruxOrigin = data.originLoadingExperience || {};

  const cruxMetric = (key) => {
    const m = crux.metrics?.[key];
    if (!m) return null;
    return { p75: num(m.percentile), category: m.category };
  };

  const opportunities = Object.values(audits)
    .filter((a) => a.details?.type === 'opportunity' && (a.details?.overallSavingsMs > 50 || a.details?.overallSavingsBytes > 10000))
    .map((a) => ({
      id: a.id,
      title: a.title,
      savings_ms: num(a.details.overallSavingsMs),
      savings_bytes: num(a.details.overallSavingsBytes),
    }))
    .sort((a, b) => (b.savings_ms || 0) - (a.savings_ms || 0))
    .slice(0, 8);

  return {
    strategy,
    scores: {
      performance: Math.round((cats.performance?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      best_practices: Math.round((cats['best-practices']?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
    },
    lab_metrics: {
      lcp_ms: num(audits['largest-contentful-paint']?.numericValue),
      fcp_ms: num(audits['first-contentful-paint']?.numericValue),
      cls: num(audits['cumulative-layout-shift']?.numericValue),
      tbt_ms: num(audits['total-blocking-time']?.numericValue),
      tti_ms: num(audits['interactive']?.numericValue),
      speed_index_ms: num(audits['speed-index']?.numericValue),
      transfer_size_bytes: num(audits['total-byte-weight']?.numericValue),
    },
    crux_overall: crux.overall_category || null,
    crux_field_data: {
      lcp_p75_ms: cruxMetric('LARGEST_CONTENTFUL_PAINT_MS'),
      fcp_p75_ms: cruxMetric('FIRST_CONTENTFUL_PAINT_MS'),
      cls_p75: cruxMetric('CUMULATIVE_LAYOUT_SHIFT_SCORE'),
      inp_p75_ms: cruxMetric('INTERACTION_TO_NEXT_PAINT'),
      ttfb_p75_ms: cruxMetric('EXPERIMENTAL_TIME_TO_FIRST_BYTE'),
    },
    crux_origin_overall: cruxOrigin.overall_category || null,
    opportunities,
  };
}

export async function pagespeedAudit({
  url,
  apiKey = process.env.PAGESPEED_API_KEY,
  strategies = ['mobile', 'desktop'],
  fetchImpl = globalThis.fetch,
  ledgerPath,
  leadId,
  clientSlug,
  campaignId,
} = {}) {
  if (!url) return { ok: false, reason: 'url required' };
  if (!apiKey) return { ok: false, reason: 'PAGESPEED_API_KEY not set (audit will fall back to local Playwright lab data only)' };

  const results = {};
  const failures = [];
  const start = Date.now();

  for (const strategy of strategies) {
    const r = await fetchOnce(url, strategy, apiKey, fetchImpl);
    if (r.ok) {
      results[strategy] = summarize(strategy, r.data);
    } else {
      failures.push({ strategy, reason: r.reason });
    }
  }
  const latencyMs = Date.now() - start;

  if (ledgerPath || leadId) {
    const requestHash = await hashRequest({ provider: 'pagespeed_insights', endpoint: 'runPagespeed', url, strategies });
    appendLedgerEvent({
      type: 'cost',
      category: 'other',
      provider: 'google_pagespeed_insights',
      tier: 'T2',
      leadId,
      clientSlug,
      stage: 'detailed_audit',
      purpose: 'pagespeed_audit',
      requestHash,
      campaignId,
      units: strategies.length,
      // Free tier — book at $0
      unitCost: 0,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        url,
        strategies,
        succeeded: Object.keys(results).length,
        failed: failures.length,
        latency_ms: latencyMs,
      },
    }, ledgerPath);
  }

  return {
    ok: Object.keys(results).length > 0,
    results,
    failures,
    latency_ms: latencyMs,
  };
}
