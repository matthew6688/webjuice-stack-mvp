#!/usr/bin/env node
/**
 * pl:places-search-intake · SOP-0 v1.5
 *
 * Official Google Places API textsearch → upsert N entities per query.
 * Each query creates its own batch thread in #lead-discovery-runs.
 * Multi-query supported via repeated --query args (one task → N batches).
 *
 * Usage:
 *   npm run pl:places-search-intake -- \
 *     --query "roofer in brisbane" \
 *     [--query "roofer in gold coast" ...]   # repeat for multi
 *     [--limit 20]            # default 20 per query (Places max per call)
 *     [--with-details]        # also call places details (adds phone/hours/website; default ON)
 *     [--niche roofer]        # optional, parsed from query if absent
 *     [--city brisbane]       # optional, parsed from query if absent
 *     [--dry-run]
 *
 * Cost: textsearch + details = ~$0.017 per lead. 20 leads × N queries.
 * Free tier 10K/month per SKU.
 */

import { parseArgs, die, emit } from './_pl-shared.js';
import { GooglePlacesExtractor } from '../../core/extractors/google-places.js';
import { PlacesQuotaGuard, PlacesQuotaCapExceeded } from '../../core/extractors/places-quota-guard.js';
import { upsertDiscoveryRun, defaultDiscoveryStoreRoot, discoveryEntityKey } from '../../core/leads/discovery-store.js';
import { startBatchThread, finalizeBatch, postStageUpdate } from '../../core/funnel/pipeline-batch-thread.js';
import path from 'node:path';

// parseArgs returns last value for repeated --key — need raw argv for multi-query.
// Also accept bare positional args as queries (LLM router doesn't always add --query prefix).
const argv = process.argv.slice(2);
const queries = [];
const FLAGS_WITH_VALUE = new Set(['--query', '--limit', '--niche', '--city', '--with-details']);
const FLAGS_BOOLEAN = new Set(['--dry-run']);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--query' && argv[i + 1]) { queries.push(argv[i + 1]); i += 1; }
  else if (FLAGS_WITH_VALUE.has(arg)) { i += 1; /* skip value */ }
  else if (FLAGS_BOOLEAN.has(arg)) { /* skip flag */ }
  else if (!arg.startsWith('--') && arg.length >= 3) {
    queries.push(arg);  // bare positional = query
  }
}
const flat = parseArgs(argv);
const LIMIT = Math.min(parseInt(flat.limit, 10) || 20, 20);
const DRY_RUN = !!flat['dry-run'];
const NICHE_HINT = flat.niche || '';
const CITY_HINT = flat.city || '';
const WITH_DETAILS = flat['with-details'] !== 'false' && flat['with-details'] !== false;  // default ON

if (queries.length === 0) die('Need at least one --query "search terms"');

const t0 = Date.now();
console.log(`[pl:places-search-intake] queries=${queries.length} · limit=${LIMIT}/q · with_details=${WITH_DETAILS} · dry=${DRY_RUN}`);

const ledgerPath = path.join(process.cwd(), 'data/finance/ledger.jsonl');

// PROCESS each query → own batch thread
const results = [];
let totalLeads = 0;

for (const query of queries) {
  const qLog = `  · query="${query.slice(0, 50)}"`;
  console.log(qLog);
  // niche/city guessed from query if not given
  const niche = NICHE_HINT || guessFromQuery(query, 'niche');
  const city  = CITY_HINT  || guessFromQuery(query, 'city');

  const slug = slugify(query).slice(0, 30);
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
  const batchId = `places-${slug}-${stamp}`;
  const title = `[Places Pipeline] ${query} — ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

  if (DRY_RUN) {
    console.log(`    [dry-run] would open batch thread "${title}" + Places textsearch`);
    results.push({ query, batch_id: batchId, dry_run: true });
    continue;
  }

  // 1. Open batch thread in #lead-discovery-runs
  let thread;
  try {
    thread = await startBatchThread({
      batchId, title,
      summary: `Source: Google Places API (textsearch · official) · query="${query}"`,
      niche, city, count: LIMIT,
      runFlags: { source: 'places_search', query, with_details: WITH_DETAILS },
    });
  } catch (err) {
    console.error(`    ✗ thread open failed: ${err.message}`);
    results.push({ query, error: 'thread_open_failed: ' + err.message });
    continue;
  }
  console.log(`    ✓ batch thread: ${thread.thread_url}`);

  // 2. Places textSearch (quota-guarded)
  let candidates;
  try {
    const guard = new PlacesQuotaGuard();
    const { apiKey, keyId } = guard.selectAvailableKey();
    const extractor = new GooglePlacesExtractor({ apiKey, ledgerPath, leadId: batchId });
    candidates = await extractor.searchText({ query, count: LIMIT, niche, city });
    await guard.checkAndCharge(1, { skuLabel: 'text_search', keyId }).catch(() => {});

    if (!candidates || candidates.length === 0) {
      await postStageUpdate({ batchId, stage: '🔎 搜索', status: 'fail',
        summary: `没找到 · 查询: \`${query}\``, swapTag: 'completed' });
      results.push({ query, batch_id: batchId, thread_id: thread.thread_id, thread_url: thread.thread_url, lead_count: 0 });
      continue;
    }
    console.log(`    ✓ Places returned ${candidates.length} candidates`);
    await postStageUpdate({ batchId, stage: '🔎 搜索', status: 'ok',
      summary: `查询 \`${query}\` · 找到 **${candidates.length}** 个商家${WITH_DETAILS ? ' · 正在拉详细信息' : ''}` });

    // 3. Optionally enrich with details
    const leads = [];
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i];
      let lead = {
        place_id: c.place_id,
        sourceType: 'places_search',
        name: c.name,
        address: c.address,
        rating: c.rating,
        review_count: c.review_count,
        categories: c.types,
        niche,
        city,
        sourceQuery: query,
        discovery_rank: i + 1,   // Q4 · rank in result list
        google_places_provider: 'official_api',
        recommendedAction: 'audit_candidate',
      };
      if (WITH_DETAILS) {
        try {
          const d = await extractor.details({ placeId: c.place_id, niche, city });
          await guard.checkAndCharge(1, { skuLabel: 'details_basic', keyId }).catch(() => {});
          lead = {
            ...lead,
            name:            d.name || lead.name,
            address:         d.address || lead.address,
            phone:           d.phone,
            website:         d.website,
            category:        d.category,
            categories:      d.categories || lead.categories,
            google_maps_url: d.google_maps_url,
          };
        } catch (err) {
          console.error(`    ✗ details ${c.place_id}: ${err.message}`);
        }
      }
      leads.push(lead);
    }

    // 4. Upsert all leads in one run
    const run = {
      runId: 'places-search-' + batchId,
      query, niche, city,
      leads,
      totals: { rawRows: leads.length },
      batchId,
      costPolicy: { tier: 'T2', estimate_usd: leads.length * (WITH_DETAILS ? 0.017 : 0.005) },
    };
    const storeRoot = defaultDiscoveryStoreRoot();
    upsertDiscoveryRun(run, { storeRoot });
    const leadKeys = leads.map(discoveryEntityKey);
    totalLeads += leads.length;
    console.log(`    ✓ upserted ${leads.length} entities`);

    // V3 D43 · 人话版 · 显商家名字 (前 3) · 不显 place_id 哈希
    const top3Names = leads.slice(0, 3).map((l) => l.name).filter(Boolean);
    await postStageUpdate({ batchId, stage: '📥 写入实体', status: 'ok',
      summary: `**${leads.length}** 个商家入库${top3Names.length ? ' · 前 3: ' + top3Names.map((n) => `**${n}**`).join(' · ') : ''}` });

    const top5Names = leads.slice(0, 5).map((l) => l.name).filter(Boolean);
    await finalizeBatch({ batchId, terminalTag: 'completed',
      summary: `查询 \`${query}\` · ${leads.length} 个商家入库${top5Names.length ? '\n前 5: ' + top5Names.map((n) => `**${n}**`).join(' · ') + (leadKeys.length > 5 ? ' …' : '') : ''}` });

    results.push({
      query, batch_id: batchId, thread_id: thread.thread_id, thread_url: thread.thread_url,
      lead_count: leads.length, lead_keys: leadKeys,
    });
  } catch (err) {
    if (err instanceof PlacesQuotaCapExceeded) {
      console.error(`    ✗ Places quota cap: ${err.message}`);
      results.push({ query, batch_id: batchId, thread_id: thread.thread_id, thread_url: thread.thread_url, error: 'places_quota_exceeded' });
    } else {
      console.error(`    ✗ ${err.message}`);
      results.push({ query, batch_id: batchId, thread_id: thread.thread_id, thread_url: thread.thread_url, error: err.message });
    }
  }
}

// emit final JSON for dispatcher xref
const totalQueries = results.length;
const totalThreads = results.filter((r) => r.thread_id).length;
const firstBatch = results[0] || {};
emit({
  ok: true,
  query_count: totalQueries,
  batch_count: totalThreads,
  total_leads: totalLeads,
  // Top-level fields dispatcher recognizes for xref:
  batch_id: firstBatch.batch_id || null,
  thread_id: firstBatch.thread_id || null,
  thread_url: firstBatch.thread_url || null,
  // Full per-query breakdown:
  batches: results,
  duration_ms: Date.now() - t0,
});

/* ─── helpers ─────────────────────────────────────────────────────── */

function pad(n) { return String(n).padStart(2, '0'); }
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function guessFromQuery(q, field) {
  const lc = q.toLowerCase();
  if (field === 'niche') {
    const nichesPat = /(restaurant|cafe|plumber|roofer|roofing|electrician|dentist|hairdresser|lawyer|law firm|photographer|gym|hvac)/;
    const m = lc.match(nichesPat);
    return m ? (m[0] === 'roofing' ? 'roofer' : m[0].split(' ')[0]) : null;
  }
  if (field === 'city') {
    const cities = ['brisbane', 'sydney', 'melbourne', 'perth', 'adelaide', 'gold coast', 'newcastle', 'wollongong', 'canberra', 'darwin', 'hobart', 'redland'];
    const c = cities.find((x) => lc.includes(x));
    return c ? c.replace(' ', '-') : null;
  }
  return null;
}
