/**
 * Enrichment orchestrator · 4 路并发抓 + 写 entity.enrichment.*
 *
 * Sources (failures ignored · ok=false on each · pipeline 不阻塞):
 *   - whois     · domain → RDAP (registered_at · registrar · age)
 *   - wayback   · domain → archive.org first/last snapshot
 *   - abn       · business name → ABR (active · entity_type · trading names)
 *   - tinyfish_search   · name+city+niche → external mentions (AU filtered)
 *   - tinyfish_homepage · website URL → markdown + regex signals
 *
 * Usage:
 *   const enriched = await enrichEntity(entity, { abrGuid: process.env.ABR_GUID });
 *   writeEntity(enriched);  // 写回磁盘 · entity.enrichment.* 新加
 *
 * Schema: 见 docs/v3/V3-ENRICHMENT-PLAN.md § 3.3
 */
import { whoisLookup } from './whois-rdap.js';
import { waybackLookup } from './wayback.js';
import { abnLookupByName } from './abr-abn.js';
import { tinyfishSearchSummary, tinyfishHomepageSummary } from './tinyfish-summary.js';

function extractDomain(entity) {
  const latest = entity?.latest || {};
  const id = entity?.identifiers || {};
  const candidates = [
    id.websiteDomain,
    latest.website,
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      const host = c.includes('://') ? new URL(c).host : c;
      return host.replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
    } catch {}
  }
  return null;
}

/**
 * Enrich one entity · 4 路并发 · 各失败不影响其他.
 *
 * @param {object} entity                 entity from data/leads/entities/<key>.json
 * @param {object} [opts]
 * @param {string} [opts.abrGuid]         ABR_GUID env var (skip ABR if missing)
 * @param {Function} [opts.fetchImpl]
 * @param {number} [opts.timeoutMs=20000] global ceiling (each module has own 10s timeout)
 * @returns {Promise<object>}             entity with `.enrichment` field merged
 */
export async function enrichEntity(entity, opts = {}) {
  const {
    abrGuid = process.env.ABR_GUID,
    fetchImpl = globalThis.fetch,
    timeoutMs: _unused = 20_000,  // currently per-module · global ceiling later
  } = opts;

  const latest = entity?.latest || {};
  const name = latest.name || entity?.entityKey;
  const city = latest.city || null;
  const niche = latest.niche || latest.category || '';
  const website = latest.website || '';
  const domain = extractDomain(entity);

  const start = Date.now();
  const enrichment = {};
  const trace = [];

  // Parallel · failures captured per-source · don't throw out
  const tasks = [];

  if (domain) {
    tasks.push(safeRun('whois', () => whoisLookup(domain, { fetchImpl }), enrichment, trace));
    tasks.push(safeRun('wayback', () => waybackLookup(domain, { fetchImpl }), enrichment, trace));
  } else {
    trace.push({ source: 'whois',   skipped: true, reason: 'no domain' });
    trace.push({ source: 'wayback', skipped: true, reason: 'no domain' });
  }

  if (name && abrGuid) {
    tasks.push(safeRun('abn', () => abnLookupByName(name, { guid: abrGuid, fetchImpl, city }), enrichment, trace));
  } else {
    trace.push({
      source: 'abn',
      skipped: true,
      reason: !abrGuid ? 'ABR_GUID env missing' : 'no name',
    });
  }

  if (name) {
    tasks.push(safeRun('tinyfish_search', () => tinyfishSearchSummary({
      name, city, niche, fetchImpl,
      leadId: entity?.entityKey, clientSlug: entity?.promotedClientSlug,
    }), enrichment, trace));
  }

  if (website) {
    tasks.push(safeRun('tinyfish_homepage', () => tinyfishHomepageSummary({
      url: website, city, fetchImpl,
      leadId: entity?.entityKey, clientSlug: entity?.promotedClientSlug,
    }), enrichment, trace));
  } else {
    trace.push({ source: 'tinyfish_homepage', skipped: true, reason: 'no website' });
  }

  await Promise.all(tasks);

  enrichment._meta = {
    enriched_at: new Date().toISOString(),
    total_latency_ms: Date.now() - start,
    trace,
    sources_attempted: trace.filter((t) => !t.skipped).length + (Object.keys(enrichment).length - 0),
    sources_succeeded: Object.keys(enrichment).filter((k) => k !== '_meta').length,
  };

  return { ...entity, enrichment };
}

async function safeRun(name, fn, target, trace) {
  const start = Date.now();
  try {
    const result = await fn();
    const latency_ms = Date.now() - start;
    // Some modules return null (no data) vs { ok: false, reason } vs successful object
    if (result === null) {
      trace.push({ source: name, ok: false, reason: 'no_data', latency_ms });
      return;
    }
    if (result && result.ok === false) {
      trace.push({ source: name, ok: false, reason: result.reason, latency_ms });
      return;
    }
    target[name] = result;
    trace.push({ source: name, ok: true, latency_ms });
  } catch (err) {
    trace.push({ source: name, ok: false, reason: `exception: ${err.message}`, latency_ms: Date.now() - start });
  }
}
