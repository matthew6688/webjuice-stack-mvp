#!/usr/bin/env node
/**
 * V2 Rescore CLI — Block C-4 hard evidence.
 *
 * Loads every entity matching --niche (default: roofing) from the discovery
 * store, runs the full V2 cheap-audit pipeline on each:
 *   1. Stage 1 GBP triage (always)
 *   2. Stage 0.5 enrichment for queued_for_enrichment (loads cached fixture
 *      from data/v2/fixtures/enrichment/<entityKey>.json if present, else
 *      runs live)
 *   3. Stage 2 site quick-scan for has_website entities (Tinyfish fetch + 10
 *      heuristics; rate-limited via token bucket; failed fetches logged)
 * then writes a side-by-side V1 vs V2 comparison report:
 *   - data/v2/fixtures/rescore/<niche>-<ts>.json (full data)
 *   - docs/v2/autoresearch-results/scoring-v2-vs-v1.md (markdown report)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cheapAuditV2 } from '../../core/scoring/cheap-audit-v2.js';
import { tinyfishFetchUrls, TinyFishRateLimitedError } from '../../core/extractors/tinyfish.js';
import { enrichLead } from '../../core/leads/enrichment.js';
import { clearAllBuckets } from '../../core/util/token-bucket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

loadDotEnvLocal(path.join(repoRoot, '.env.local'));

const args = parseArgs(process.argv.slice(2));
const targetNiche = (args.niche || 'roofing').toLowerCase();
const fetchSites = args['no-fetch'] !== true;
const interFetchDelayMs = Number(args.delay || 2500); // 2.5s between Tinyfish fetches → ~24/min, under 30/min limit

const entitiesDir = path.join(repoRoot, 'data/leads/entities');
const fixturesEnrichDir = path.join(repoRoot, 'data/v2/fixtures/enrichment');
const fixturesRescoreDir = path.join(repoRoot, 'data/v2/fixtures/rescore');
const reportPath = path.join(repoRoot, 'docs/v2/autoresearch-results/scoring-v2-vs-v1.md');

fs.mkdirSync(fixturesRescoreDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const allEntities = fs.readdirSync(entitiesDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8')))
  .filter((e) => {
    const cat = (e.latest?.category || '').toLowerCase();
    const niche = (e.latest?.niche || '').toLowerCase();
    if (targetNiche === 'roofing') return cat.includes('oof') || niche.includes('oof');
    return cat.includes(targetNiche) || niche.includes(targetNiche);
  });

console.log(`[rescore] niche=${targetNiche} entities=${allEntities.length} fetchSites=${fetchSites}`);

clearAllBuckets();

const startedAt = new Date();
const tmpLedger = path.join(repoRoot, 'data/v2/fixtures/rescore', `ledger-${stamp(startedAt)}.jsonl`);

const rows = [];
let processed = 0;

for (const entity of allEntities) {
  processed += 1;
  const v1 = {
    score: entity.latest?.discoveryScore ?? null,
    action: entity.latest?.recommendedAction ?? null,
  };

  // Step 1: Stage 0.5 — load enrichment fixture if entity is queued_for_enrichment OR
  // has thin contact info. We DO NOT auto-rerun live enrichment in the CLI — it would
  // burn ~6 search calls per entity. Use cached fixture if present (Block C-2 generated
  // them for the no_website canary). Document this clearly in the row.
  const enrichmentFixturePath = path.join(fixturesEnrichDir, `${entity.entityKey}.json`);
  const enrichmentFixture = fs.existsSync(enrichmentFixturePath)
    ? JSON.parse(fs.readFileSync(enrichmentFixturePath, 'utf8'))
    : null;

  // Step 2: Stage 2 — fetch site if has_website + fetchSites flag is on
  let fetchPayload = null;
  let fetchErr = null;
  const ws = entity.latest?.websiteStatus || '';
  const hasSite = /independent_(http|https)_site/.test(ws);
  if (hasSite && fetchSites && entity.latest?.website) {
    process.stdout.write(`[${processed}/${allEntities.length}] fetch ${entity.latest.name.slice(0, 40)}... `);
    try {
      const t0 = Date.now();
      const r = await tinyfishFetchUrls({
        urls: [entity.latest.website],
        format: 'markdown',
        ledgerPath: tmpLedger,
        leadId: entity.entityKey,
        clientSlug: slugifyName(entity.latest.name),
        stage: 'rescore_v2',
        purpose: 'rescore_site_quick_scan',
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const result = (r.results || [])[0];
      if (result && result.text) {
        fetchPayload = { url: result.final_url || entity.latest.website, markdown: result.text };
        process.stdout.write(`ok (${result.text.length}c, ${elapsed}s)\n`);
      } else {
        fetchErr = 'empty_result';
        process.stdout.write(`empty (${elapsed}s)\n`);
      }
    } catch (err) {
      fetchErr = err.message || String(err);
      if (err instanceof TinyFishRateLimitedError) fetchErr = `rate_limited: ${err.retryAfterMs}ms`;
      process.stdout.write(`failed: ${fetchErr.slice(0, 60)}\n`);
    }
    // Pace inter-fetch
    await sleep(interFetchDelayMs);
  } else if (!hasSite) {
    process.stdout.write(`[${processed}/${allEntities.length}] ${entity.latest?.websiteStatus || 'no_status'} skip-fetch ${entity.latest?.name?.slice(0, 40)}\n`);
  }

  // Step 3: Run V2 cheap audit
  const v2 = cheapAuditV2({
    entity,
    fetchPayload,
    sourceQuery: entity.latest?.sourceQuery,
  });

  rows.push({
    entityKey: entity.entityKey,
    name: entity.latest?.name || '(unnamed)',
    rating: entity.latest?.rating,
    review_count: entity.latest?.review_count,
    websiteStatus: ws,
    website: entity.latest?.website || null,
    v1,
    v2: {
      final_score: v2.final_score,
      gbp_quality: v2.gbp_quality,
      redesign_need: v2.redesign_need,
      action: v2.action,
      reason: v2.reason,
      fired_triggers: v2.fired_triggers,
      stage_2_ran: Boolean(v2.stage_2),
      stage_2_skipped_reason: v2.stage_2 ? null : (hasSite ? (fetchErr || 'fetch_disabled') : 'no_website'),
    },
    enrichment_fixture_present: Boolean(enrichmentFixture),
  });
}

const finishedAt = new Date();
const durationSec = ((finishedAt - startedAt) / 1000).toFixed(1);

// Aggregate flips
const flippedSkipToCandidate = rows.filter((r) => r.v1.action === 'skip' && r.v2.action !== 'skip');
const stillSkip = rows.filter((r) => r.v2.action === 'skip');
const newAuditCandidates = rows.filter((r) => r.v2.action === 'audit_candidate');
const newStarterCandidates = rows.filter((r) => r.v2.action === 'starter_candidate');
const stage2Ran = rows.filter((r) => r.v2.stage_2_ran).length;

// Save full fixture
const fixturePath = path.join(fixturesRescoreDir, `${targetNiche}-${stamp(startedAt)}.json`);
fs.writeFileSync(fixturePath, JSON.stringify({
  niche: targetNiche,
  generatedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  duration_seconds: Number(durationSec),
  fetchSites,
  total_entities: rows.length,
  summary: {
    flipped_v1_skip_to_v2_not_skip: flippedSkipToCandidate.length,
    still_skip: stillSkip.length,
    audit_candidates_v2: newAuditCandidates.length,
    starter_candidates_v2: newStarterCandidates.length,
    stage_2_ran: stage2Ran,
  },
  rows,
}, null, 2) + '\n');

// Markdown report
fs.writeFileSync(reportPath, renderMarkdown({
  niche: targetNiche,
  startedAt,
  finishedAt,
  durationSec,
  fetchSites,
  rows,
  flippedSkipToCandidate,
  stillSkip,
  newAuditCandidates,
  newStarterCandidates,
  stage2Ran,
}));

console.log('');
console.log(JSON.stringify({
  ok: true,
  niche: targetNiche,
  total_entities: rows.length,
  duration_seconds: Number(durationSec),
  flipped_v1_skip_to_v2_not_skip: flippedSkipToCandidate.length,
  still_skip: stillSkip.length,
  audit_candidates_v2: newAuditCandidates.length,
  starter_candidates_v2: newStarterCandidates.length,
  stage_2_ran: stage2Ran,
  fixture: fixturePath,
  report: reportPath,
  ledger: tmpLedger,
}, null, 2));

// ─── helpers ──────────────────────────────────────────────────────────────

function renderMarkdown({ niche, startedAt, durationSec, fetchSites, rows, flippedSkipToCandidate, stillSkip, newAuditCandidates, newStarterCandidates, stage2Ran }) {
  const lines = [];
  lines.push(`# V2 vs V1 cheap-audit comparison — ${niche}`);
  lines.push('');
  lines.push(`Generated: ${startedAt.toISOString()}`);
  lines.push(`Duration: ${durationSec}s`);
  lines.push(`Site fetches: ${fetchSites ? 'yes (Stage 2 evaluated)' : 'no (Stage 1 only)'}`);
  lines.push(`Entities: ${rows.length}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **${flippedSkipToCandidate.length}** of ${rows.length} entities flipped from V1 \`skip\` to non-skip in V2`);
  lines.push(`- **${stillSkip.length}** still skip in V2`);
  lines.push(`- **${newAuditCandidates.length}** are now \`audit_candidate\` (V2 sales pipeline ready)`);
  lines.push(`- **${newStarterCandidates.length}** are \`starter_candidate\` (no-website easy wins)`);
  lines.push(`- **${stage2Ran}** had Stage 2 site-fetch run`);
  lines.push('');
  lines.push('## V1 vs V2 side-by-side');
  lines.push('');
  lines.push('| Business | ★ / reviews | website | V1 score / action | V2 final / action | redesign_need | fired triggers |');
  lines.push('|---|---|---|---|---|---|---|');
  // Sort by review count desc — high-traction leads first (these are the V2 fix targets)
  const sorted = [...rows].sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
  for (const r of sorted) {
    const name = (r.name || '').slice(0, 38);
    const ratingStr = `★${r.rating || '-'} (${r.review_count || 0})`;
    const wsShort = (r.websiteStatus || '').replace('_site', '').replace('independent_', '');
    const v1 = `${r.v1.score ?? '-'} ${r.v1.action || '-'}`;
    const v2 = `${r.v2.final_score} **${r.v2.action.replace(/_/g, ' ')}**`;
    const rn = r.v2.redesign_need == null ? '—' : r.v2.redesign_need;
    const trig = r.v2.fired_triggers.length ? r.v2.fired_triggers.join(', ') : '';
    lines.push(`| ${name} | ${ratingStr} | ${wsShort} | ${v1} | ${v2} | ${rn} | ${trig} |`);
  }
  lines.push('');
  lines.push('## Top flips (V1 skip → V2 candidate)');
  lines.push('');
  for (const r of flippedSkipToCandidate.slice(0, 10)) {
    const trig = r.v2.fired_triggers.length ? ` [${r.v2.fired_triggers.join(', ')}]` : '';
    lines.push(`- **${r.name}** — ★${r.rating}/${r.review_count} reviews — V1 ${r.v1.action} (${r.v1.score}) → V2 ${r.v2.action} (final ${r.v2.final_score}, gbp ${r.v2.gbp_quality}, redesign ${r.v2.redesign_need ?? '—'})${trig}`);
  }
  lines.push('');
  lines.push('## Stage 2 fetch failures');
  lines.push('');
  const fetchFailed = rows.filter((r) => r.v2.stage_2_skipped_reason && r.v2.stage_2_skipped_reason !== 'no_website' && r.v2.stage_2_skipped_reason !== 'fetch_disabled');
  if (fetchFailed.length) {
    for (const r of fetchFailed) {
      lines.push(`- ${r.name} — ${r.v2.stage_2_skipped_reason}`);
    }
  } else {
    lines.push('_None — all has-website entities fetched successfully._');
  }
  lines.push('');
  lines.push('## Regenerate');
  lines.push('');
  lines.push('```');
  lines.push(`npm run scoring:rescore-v2 -- --niche ${niche}`);
  lines.push('```');
  lines.push('');
  lines.push('Add `--no-fetch true` to skip Stage 2 (Stage 1 only, no Tinyfish calls).');
  lines.push('');
  return lines.join('\n');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    out[k] = v;
  }
  return out;
}

function slugifyName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function stamp(date) {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadDotEnvLocal(p) {
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
