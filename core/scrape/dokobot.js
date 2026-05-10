/**
 * Dokobot local-Chrome read wrapper for V2 enrichment fetch chain.
 *
 * Wraps `dokobot read --local --device <id> <url>` which renders the page
 * through a connected local Chrome (extension v0.3.0+) and returns clean
 * text. No API key required — runs against the user's own Chrome session,
 * so it handles JS-rendered pages and auth-walled content that Tinyfish
 * fetch can't.
 *
 * Used as fallback in fetch chain when Tinyfish returns insufficient
 * content (e.g. JS-only SPA, login wall, anti-bot blocking simple HTTP).
 */

import { execFileSync } from 'child_process';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';
import { getBucket } from '../util/token-bucket.js';

const DEFAULT_RATE_PER_MIN = Number(process.env.DOKOBOT_RATE_PER_MIN || 30);

function dokobotBucket() {
  return getBucket('dokobot', { ratePerMinute: DEFAULT_RATE_PER_MIN });
}

export class DokobotUnavailableError extends Error {
  constructor(message, { reason } = {}) {
    super(message);
    this.name = 'DokobotUnavailableError';
    this.reason = reason;
  }
}

export class DokobotRateLimitedError extends Error {
  constructor(message, { retryAfterMs } = {}) {
    super(message);
    this.name = 'DokobotRateLimitedError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Detect Dokobot CLI presence and version. Returns null if not installed.
 */
export function dokobotCliVersion({ exec = execFileSync } = {}) {
  try {
    const out = exec('dokobot', ['--version'], { encoding: 'utf8', timeout: 5000 });
    return out.trim();
  } catch {
    return null;
  }
}

/**
 * List connected local Chrome devices via `dokobot doko list`.
 * Returns array of { id, pid, chromeVersion, extensionVersion }.
 */
export function listLocalDevices({ exec = execFileSync } = {}) {
  const out = exec('dokobot', ['doko', 'list'], { encoding: 'utf8', timeout: 10000 });
  const devices = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^\s+([a-f0-9-]{20,})\s+pid\s+(\d+),\s+Chrome\s+(\d+),\s+ext\s+(\S+)/);
    if (m) {
      devices.push({ id: m[1], pid: Number(m[2]), chromeVersion: m[3], extensionVersion: m[4] });
    }
  }
  return devices;
}

/**
 * Read a URL via local Chrome. Returns { text, device, latencyMs }.
 *
 * Throws DokobotUnavailableError if CLI missing / no device connected.
 * Throws DokobotRateLimitedError if local bucket exhausted.
 */
export async function dokobotRead({
  url,
  device,
  screens = 1,
  timeout = 30,
  exec = execFileSync,
  ledgerPath,
  leadId,
  clientSlug,
  stage,
  purpose = 'lead_enrichment_fetch',
  campaignId,
  bucket = dokobotBucket(),
} = {}) {
  if (!url) throw new Error('url is required');

  if (!bucket.tryAcquire()) {
    appendRateLimitedEvent({
      ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
      reason: 'local_token_bucket', metadata: { url },
    });
    throw new DokobotRateLimitedError('dokobot read rate limited (local bucket)', {
      retryAfterMs: bucket.msUntilNextToken(),
    });
  }

  const cliVersion = dokobotCliVersion({ exec });
  if (!cliVersion) {
    appendUnavailableEvent({
      ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
      reason: 'cli_not_installed', metadata: { url },
    });
    throw new DokobotUnavailableError('dokobot CLI not installed', { reason: 'cli_not_installed' });
  }

  const targetDevice = device || listLocalDevices({ exec })[0]?.id;
  if (!targetDevice) {
    appendUnavailableEvent({
      ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
      reason: 'no_device_connected', metadata: { url, cliVersion },
    });
    throw new DokobotUnavailableError('no local Chrome device connected to Dokobot', {
      reason: 'no_device_connected',
    });
  }

  const args = ['read', '--local', '--device', targetDevice, '--screens', String(screens), '--timeout', String(timeout), url];
  const start = Date.now();
  let text;
  try {
    text = exec('dokobot', args, { encoding: 'utf8', timeout: timeout * 1000 + 5000 });
  } catch (err) {
    appendUnavailableEvent({
      ledgerPath, leadId, clientSlug, stage, purpose, campaignId,
      reason: 'read_failed', metadata: { url, cliVersion, device: targetDevice, error: err.message },
    });
    throw err;
  }
  const latencyMs = Date.now() - start;
  const requestHash = await hashRequest({ provider: 'dokobot', endpoint: 'read', url });

  if (ledgerPath || leadId || clientSlug) {
    appendLedgerEvent({
      type: 'cost',
      category: 'dokobot',
      provider: 'dokobot',
      tier: 'T0',
      leadId, clientSlug, stage, purpose,
      requestHash,
      campaignId,
      units: 1,
      unitCost: 0,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'read', url, device: targetDevice, screens,
        text_length: text.length,
        latency_ms: latencyMs,
        cli_version: cliVersion,
      },
    }, ledgerPath);
  }

  return { text, device: targetDevice, latencyMs, cliVersion };
}

/**
 * Doko Search — pattern from the dokobot.ai "doko-search" skill:
 * search the web by reading a search engine's SERP through local Chrome.
 * No API key, no rate limits (uses the user's actual Chrome session).
 *
 * Returns { engine, query, serpUrl, rawText, latencyMs, device, results }
 * where `results` is a best-effort parsed list of { position, title, url };
 * `rawText` is the full rendered SERP text for downstream LLM consumption.
 *
 * Slow (~10-20s per search) but unblockable — useful as last-ditch fallback
 * when Tinyfish + DDGS are both unavailable.
 */
const SEARCH_ENGINE_URLS = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  baidu: 'https://www.baidu.com/s?wd=',
};

export async function dokoSearch({
  query,
  engine = 'google',
  device,
  screens = 1,
  timeout = 45,
  exec,
  ledgerPath,
  leadId,
  clientSlug,
  stage,
  purpose = 'lead_enrichment_search',
  campaignId,
} = {}) {
  if (!query) throw new Error('query is required');
  const base = SEARCH_ENGINE_URLS[engine];
  if (!base) throw new Error(`unknown engine: ${engine}; valid: ${Object.keys(SEARCH_ENGINE_URLS).join(', ')}`);

  const serpUrl = base + encodeURIComponent(query);
  const read = await dokobotRead({
    url: serpUrl, device, screens, timeout, exec,
    ledgerPath, leadId, clientSlug, stage,
    purpose: `${purpose}_via_${engine}`,
    campaignId,
  });

  return {
    engine,
    query,
    serpUrl,
    device: read.device,
    cliVersion: read.cliVersion,
    latencyMs: read.latencyMs,
    rawText: read.text,
    results: parseSerpText(read.text, engine),
  };
}

/**
 * Best-effort SERP parser. Search engine result pages rendered as text by
 * dokobot have predictable patterns but vary by engine. Returns position +
 * title + url where confidence is high; downstream code can fall back to
 * the raw text when this returns empty.
 */
function parseSerpText(text, engine) {
  const results = [];
  if (!text) return results;

  // Generic pattern: lines that contain http(s):// urls. Walk lines, treat
  // a non-empty line followed by a URL line as title→url.
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let position = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/(https?:\/\/[^\s)\]]+)/);
    if (!m) continue;
    const url = m[1];
    // Skip search-engine-internal URLs
    if (/google\.com|bing\.com|duckduckgo\.com|baidu\.com/.test(url)) continue;
    // Title heuristic: prior non-URL line
    let title = '';
    for (let j = i - 1; j >= Math.max(0, i - 3); j -= 1) {
      if (!/(https?:\/\/)/.test(lines[j])) { title = lines[j]; break; }
    }
    position += 1;
    results.push({ position, title, url, _engine: engine });
    if (results.length >= 20) break;
  }
  return results;
}

function appendRateLimitedEvent({ ledgerPath, leadId, clientSlug, stage, purpose, campaignId, reason, metadata }) {
  if (!ledgerPath && !leadId && !clientSlug) return;
  appendLedgerEvent({
    type: 'cost',
    category: 'provider_rate_limited',
    provider: 'dokobot',
    tier: 'T0',
    leadId, clientSlug, stage, purpose, campaignId,
    units: 1, unitCost: 0, amount: 0,
    currency: process.env.ROI_CURRENCY || 'USD',
    metadata: { endpoint: 'read', reason, ...metadata },
  }, ledgerPath);
}

function appendUnavailableEvent({ ledgerPath, leadId, clientSlug, stage, purpose, campaignId, reason, metadata }) {
  if (!ledgerPath && !leadId && !clientSlug) return;
  appendLedgerEvent({
    type: 'cost',
    category: 'provider_unavailable',
    provider: 'dokobot',
    tier: 'T0',
    leadId, clientSlug, stage, purpose, campaignId,
    units: 1, unitCost: 0, amount: 0,
    currency: process.env.ROI_CURRENCY || 'USD',
    metadata: { endpoint: 'read', reason, ...metadata },
  }, ledgerPath);
}
