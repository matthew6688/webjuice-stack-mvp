#!/usr/bin/env node
/**
 * Side-by-side comparison: Tinyfish search vs DDGS lib vs Doko Search,
 * same query, hard metrics. Output goes to:
 *   data/v2/fixtures/search-comparison/<timestamp>.json
 *   docs/v2/autoresearch-results/search-providers.md (regenerated)
 *
 * Each provider runs independently; failure of one does not block others.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { tinyfishSearch } from '../../core/extractors/tinyfish.js';
import { ddgSearch } from '../../core/scrape/ddg.js';
import { dokoSearch } from '../../core/scrape/dokobot.js';
import { readLedger } from '../../core/finance/ledger.js';
import { clearAllBuckets } from '../../core/util/token-bucket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

loadDotEnvLocal(path.join(repoRoot, '.env.local'));

const QUERY = process.argv[2] || 'roofing brisbane';
const REGION_TINYFISH = 'AU';
const REGION_DDGS = 'au-en';
const fixturesDir = path.join(repoRoot, 'data/v2/fixtures/search-comparison');
fs.mkdirSync(fixturesDir, { recursive: true });

const tmpLedger = fs.mkdtempSync(path.join(os.tmpdir(), 'search-compare-')) + '/ledger.jsonl';
clearAllBuckets();

const leadId = 'ld_test_search_compare';
const clientSlug = 'roo-roofing-brisbane';
const stage = 'enriched';

const results = {};

// ─── 1. Tinyfish search ────────────────────────────────────────────────────
results.tinyfish = await runProvider('tinyfish', () => tinyfishSearch({
  query: QUERY, location: REGION_TINYFISH, language: 'en',
  ledgerPath: tmpLedger, leadId, clientSlug, stage, purpose: 'compare_search',
}));

// ─── 2. DDGS lib ───────────────────────────────────────────────────────────
results.ddgs = await runProvider('ddgs', () => ddgSearch({
  query: QUERY, region: REGION_DDGS, maxResults: 10,
  ledgerPath: tmpLedger, leadId, clientSlug, stage, purpose: 'compare_search',
}));

// ─── 3. Doko Search via Google ─────────────────────────────────────────────
results.dokoSearch = await runProvider('dokoSearch', () => dokoSearch({
  query: QUERY, engine: 'google', timeout: 60,
  ledgerPath: tmpLedger, leadId, clientSlug, stage, purpose: 'compare_search',
}));

// ─── Build comparison report ──────────────────────────────────────────────
const events = readLedger(tmpLedger);

const summary = {
  generatedAt: new Date().toISOString(),
  query: QUERY,
  providers: {
    tinyfish: summarizeProvider(results.tinyfish, (r) => ({
      structured: true,
      resultCount: r?.results?.length || 0,
      topResult: r?.results?.[0] && {
        position: r.results[0].position,
        title: r.results[0].title,
        url: r.results[0].url,
      },
      schemaFields: r?.results?.[0] ? Object.keys(r.results[0]) : [],
    })),
    ddgs: summarizeProvider(results.ddgs, (r) => ({
      structured: true,
      resultCount: r?.results?.length || 0,
      topResult: r?.results?.[0] && {
        position: r.results[0].position,
        title: r.results[0].title,
        url: r.results[0].url,
      },
      schemaFields: r?.results?.[0] ? Object.keys(r.results[0]) : [],
    })),
    dokoSearch: summarizeProvider(results.dokoSearch, (r) => ({
      structured: false,
      rawTextLength: r?.rawText?.length || 0,
      parsedResultCount: r?.results?.length || 0,
      topResult: r?.results?.[0] && {
        position: r.results[0].position,
        title: r.results[0].title?.slice(0, 80),
        url: r.results[0].url,
      },
    })),
  },
  ledgerEvents: events.length,
};

const fixturePath = path.join(fixturesDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(fixturePath, JSON.stringify({
  summary,
  raw: {
    tinyfish: results.tinyfish.value && { results: results.tinyfish.value.results },
    ddgs: results.ddgs.value && { results: results.ddgs.value.results },
    dokoSearch: results.dokoSearch.value && {
      engine: results.dokoSearch.value.engine,
      serpUrl: results.dokoSearch.value.serpUrl,
      rawTextPreview: results.dokoSearch.value.rawText?.slice(0, 2000),
      parsedResults: results.dokoSearch.value.results?.slice(0, 10),
    },
  },
}, null, 2) + '\n');

// ─── Markdown report ──────────────────────────────────────────────────────
const reportPath = path.join(repoRoot, 'docs/v2/autoresearch-results/search-providers.md');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, renderMarkdown(summary));

console.log(JSON.stringify({
  ok: true,
  query: QUERY,
  providers: Object.fromEntries(
    Object.entries(summary.providers).map(([k, v]) => [k, {
      ok: v.ok, latencyMs: v.latencyMs,
      resultCount: v.resultCount ?? v.parsedResultCount ?? 0,
    }]),
  ),
  fixture: fixturePath,
  report: reportPath,
}, null, 2));

// ─── helpers ──────────────────────────────────────────────────────────────

async function runProvider(name, fn) {
  const start = Date.now();
  try {
    const value = await fn();
    return { ok: true, value, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: { name: err.name, message: err.message, reason: err.reason }, latencyMs: Date.now() - start };
  }
}

function summarizeProvider(slot, extract) {
  if (!slot.ok) return { ok: false, error: slot.error, latencyMs: slot.latencyMs };
  return { ok: true, latencyMs: slot.latencyMs, ...extract(slot.value) };
}

function renderMarkdown(summary) {
  const lines = [];
  lines.push('# Search Providers — Live Comparison');
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Query: \`${summary.query}\``);
  lines.push('');
  lines.push('## Side-by-side');
  lines.push('');
  lines.push('| Provider | OK | Latency | Results | Structured | Notes |');
  lines.push('|---|---|---|---|---|---|');
  for (const [name, p] of Object.entries(summary.providers)) {
    const ok = p.ok ? '✅' : '❌';
    const latency = `${p.latencyMs}ms`;
    const count = p.resultCount ?? p.parsedResultCount ?? 0;
    const structured = p.structured === true ? 'JSON' : (p.structured === false ? `raw ${p.rawTextLength}c` : '—');
    const notes = p.ok ? `top: ${p.topResult?.title?.slice(0, 50) || '—'}` : (p.error?.message || '').slice(0, 80);
    lines.push(`| **${name}** | ${ok} | ${latency} | ${count} | ${structured} | ${notes} |`);
  }
  lines.push('');
  lines.push('## Top result per provider');
  lines.push('');
  for (const [name, p] of Object.entries(summary.providers)) {
    if (!p.ok || !p.topResult) continue;
    lines.push(`### ${name}`);
    lines.push(`- position: ${p.topResult.position}`);
    lines.push(`- title: ${p.topResult.title}`);
    lines.push(`- url: ${p.topResult.url}`);
    lines.push('');
  }
  lines.push('## Recommendation');
  lines.push('');
  lines.push('Default routing (search chain):');
  lines.push('');
  const tinyfish = summary.providers.tinyfish;
  const ddgs = summary.providers.ddgs;
  const doko = summary.providers.dokoSearch;
  if (tinyfish.ok) lines.push(`1. **Tinyfish search** — ${tinyfish.latencyMs}ms, structured JSON, free. Primary.`);
  else lines.push(`1. ~~Tinyfish search~~ — failed (${tinyfish.error?.message || 'unknown'})`);
  if (ddgs.ok) lines.push(`2. **DDGS Python lib** — ${ddgs.latencyMs}ms, structured JSON, free. First fallback.`);
  else lines.push(`2. ~~DDGS Python lib~~ — failed (${ddgs.error?.message || 'unknown'})`);
  if (doko.ok) lines.push(`3. **Doko Search** — ${doko.latencyMs}ms, raw rendered SERP, unblockable. Last-resort retrieval before paid Perplexity.`);
  else lines.push(`3. ~~Doko Search~~ — failed (${doko.error?.message || 'unknown'})`);
  lines.push('');
  lines.push('Doko Search is slowest but uses the user\'s real Chrome session — anti-bot detection effectively neutralized. Prefer it over paid Perplexity for raw retrieval when Tinyfish + DDGS both fail.');
  lines.push('');
  lines.push('To regenerate this report: `npm run scrape:test-search-compare`.');
  return lines.join('\n') + '\n';
}

function loadDotEnvLocal(p) {
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
