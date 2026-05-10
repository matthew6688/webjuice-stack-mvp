/**
 * DuckDuckGo SERP via the `ddgs` Python library (formerly duckduckgo-search).
 *
 * Bridges to scripts/scrape/ddgs-runner.py over stdin/stdout JSON. This
 * replaces the earlier Playwright html.duckduckgo.com scrape, which DDG
 * anti-botted (HTTP 202). The Python lib uses DDG's html / lite / bing
 * backends programmatically and is far more reliable.
 *
 * Requires a venv with `ddgs` installed at `.venv-ddgs` (gitignored).
 * Bootstrap: `python3 -m venv .venv-ddgs && .venv-ddgs/bin/pip install ddgs`.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';
import { getBucket } from '../util/token-bucket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const DEFAULT_RATE_PER_MIN = Number(process.env.DDG_RATE_PER_MIN || 12);
const RUNNER_PATH = path.join(repoRoot, 'scripts/scrape/ddgs-runner.py');
const VENV_PYTHON = path.join(repoRoot, '.venv-ddgs/bin/python');

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

export class DdgUnavailableError extends Error {
  constructor(message, { reason } = {}) {
    super(message);
    this.name = 'DdgUnavailableError';
    this.reason = reason;
  }
}

/** Backwards-compat alias kept so existing test imports keep working. */
export const DdgBlockedError = DdgUnavailableError;

function resolvePython() {
  if (process.env.DDGS_PYTHON) return process.env.DDGS_PYTHON;
  if (fs.existsSync(VENV_PYTHON)) return VENV_PYTHON;
  return null;
}

async function runDdgsRunner(payload, timeoutMs = 30_000) {
  const python = resolvePython();
  if (!python) {
    throw new DdgUnavailableError(
      'ddgs venv not found; run: python3 -m venv .venv-ddgs && .venv-ddgs/bin/pip install ddgs',
      { reason: 'venv_missing' },
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(python, [RUNNER_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new DdgUnavailableError('ddgs runner timed out', { reason: 'timeout' }));
    }, timeoutMs);

    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new DdgUnavailableError(`ddgs runner failed to spawn: ${e.message}`, { reason: 'spawn_error' }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(out);
        if (code !== 0 || parsed.error) {
          reject(new DdgUnavailableError(parsed.error || `ddgs runner exited ${code}`, {
            reason: parsed.error || `exit_${code}`,
          }));
          return;
        }
        resolve(parsed);
      } catch (e) {
        reject(new DdgUnavailableError(`ddgs runner returned non-JSON: ${out.slice(0, 200)} (stderr: ${err.slice(0, 200)})`, {
          reason: 'invalid_json',
        }));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

/**
 * Run a SERP query through the ddgs Python lib.
 * Returns { query, results: [{ position, title, snippet, url }] }.
 */
export async function ddgSearch({
  query,
  region = 'wt-wt',
  maxResults = 10,
  timelimit,
  backend = 'auto',
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

  const start = Date.now();
  let payload;
  try {
    payload = await runDdgsRunner({ query, region, max_results: maxResults, timelimit, backend });
  } catch (err) {
    if (err instanceof DdgUnavailableError) {
      appendUnavailableEvent({
        ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
        reason: err.reason || 'unknown', metadata: { query },
      });
    }
    throw err;
  }
  const latencyMs = Date.now() - start;

  if (!payload.results || !payload.results.length) {
    appendUnavailableEvent({
      ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
      reason: 'empty_results', metadata: { query, latency_ms: latencyMs },
    });
    throw new DdgUnavailableError('ddgs returned empty results', { reason: 'empty_results' });
  }

  const requestHash = await hashRequest({ provider: 'ddg', endpoint: 'search', query, region, maxResults, backend });

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
        endpoint: 'search', query, region, maxResults, backend,
        results_count: payload.results.length,
        latency_ms: latencyMs,
      },
    }, ledgerPath);
  }

  return { query, results: payload.results };
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
