#!/usr/bin/env node
/**
 * pl:check-qualification · D39 · M2 → M3 gate
 *
 * For 1 entity (or all with phase=design-ready):
 *   1. multi-page crawl (Firecrawl + fallback)
 *   2. AI 分析 raw JSON → redesign-brief.json
 *   3. qualification scorecard (7 hard gates + 5 dim)
 *   4. setEntityPhase: ready-to-build | qa-pending | archived
 *   5. Stage 5 Discord 通知
 *
 * Usage:
 *   npm run pl:check-qualification -- --entity-key place_xxx
 *   npm run pl:check-qualification -- --all-design-ready    (cron friendly · 跑所有 design-ready)
 *
 * Cost: ~$1-2 per entity (Firecrawl + AI)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
process.chdir(REPO);

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) { const k = a.slice(2); const next = arr[i + 1]; acc.push([k, next && !next.startsWith('--') ? next : true]); }
  return acc;
}, []));

const entityKey = args['entity-key'];
const allDesignReady = !!args['all-design-ready'];

if (!entityKey && !allDesignReady) {
  console.error('Usage: pl:check-qualification -- --entity-key <key> | --all-design-ready');
  process.exit(2);
}

async function loadEntity(key) {
  const p = path.join(REPO, 'data/leads/entities', `${key}.json`);
  if (!fs.existsSync(p)) throw new Error(`entity not found: ${key}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadDetailedAudit(key) {
  const p = path.join(REPO, 'data/v2/fixtures/detailed-audit', `${key}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function processEntity(key) {
  console.log(`\n══════════ ${key} ══════════`);
  const entity = await loadEntity(key);
  const slug = slugify(entity.latest?.name || key);
  const websiteUrl = entity.latest?.website;
  if (!websiteUrl) {
    console.warn(`  ✗ no website · skipping qualification (no-website lead · starter_candidate path)`);
    return { key, status: 'skip', reason: 'no_website' };
  }

  // 1. Multi-page crawl
  console.log(`  [1/5] multi-page crawl ${websiteUrl}...`);
  const { multiPageCrawl, saveCrawlResult } = await import(path.join(REPO, 'core/audit/multi-page-crawl.js'));
  const crawl = await multiPageCrawl(websiteUrl, { maxPages: 10 });
  saveCrawlResult(slug, crawl);
  console.log(`     → ${crawl.pages_crawled} pages · ${crawl.pages_via_firecrawl} Firecrawl + ${crawl.pages_via_direct} direct · sitemap=${crawl.sitemap_source} · ${(crawl.duration_ms / 1000).toFixed(1)}s · ~$${crawl.cost_estimate.toFixed(3)}`);

  // 2. AI 分析 raw JSON
  console.log(`  [2/5] AI 分析 raw JSON · cascade codex → claude → ollama...`);
  const { buildRedesignBrief, saveBrief } = await import(path.join(REPO, 'core/audit/redesign-brief-builder.js'));
  const briefResult = await buildRedesignBrief(crawl);
  if (briefResult.error || !briefResult.brief) {
    console.warn(`     ⚠ brief build failed: ${briefResult.error}`);
    return { key, status: 'fail', reason: `brief_failed: ${briefResult.error}` };
  }
  saveBrief(slug, briefResult);
  console.log(`     → provider=${briefResult.provider} · ${(briefResult.duration_ms / 1000).toFixed(1)}s · ~$${briefResult.cost_estimate}`);

  // 3. Qualification scorecard
  console.log(`  [3/5] qualification scorecard...`);
  const { qualifyEntity } = await import(path.join(REPO, 'core/scoring/qualification-scorecard.js'));
  const audit = loadDetailedAudit(key);
  const ctx = {
    entity,
    audit: audit ? { ...audit, detailed_audit: audit.detailed_audit, sitemap_analysis: audit.sitemap_analysis, tech_stack: audit.tech_stack, pagespeed: audit.pagespeed, form_audit: audit.form_audit } : null,
    brief: briefResult.brief,
    sitemap: audit?.sitemap_analysis || null,
  };
  const verdict = qualifyEntity(ctx);
  console.log(`     → gates: ${verdict.gates_passed ? 'PASSED' : `FAILED · ${verdict.archive_reason}`}`);
  if (verdict.scorecard) {
    console.log(`     → scorecard: ${verdict.scorecard.total}/100 (A${verdict.scorecard.A_core_info.score} B${verdict.scorecard.B_brand.score} C${verdict.scorecard.C_scope.score} D${verdict.scorecard.D_tech.score} E${verdict.scorecard.E_solvability.score})`);
    console.log(`     → verdict: ${verdict.verdict}`);
  }

  // 4. Persist · setEntityPhase + write qualification record
  console.log(`  [4/5] persist verdict...`);
  const { setEntityPhase, ENTITY_PHASE } = await import(path.join(REPO, 'core/leads/discovery-store.js'));
  if (verdict.verdict === 'archived') {
    setEntityPhase({ entityKey: key, phase: ENTITY_PHASE.ARCHIVED, archive_reason: verdict.archive_reason });
  } else if (verdict.verdict === 'qa-pending') {
    setEntityPhase({ entityKey: key, phase: ENTITY_PHASE.QA_PENDING });
  } else if (verdict.verdict === 'ready-to-build') {
    setEntityPhase({ entityKey: key, phase: ENTITY_PHASE.READY_TO_BUILD });
  }
  // Write qualification record on entity
  const entityPath = path.join(REPO, 'data/leads/entities', `${key}.json`);
  const fresh = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
  fresh.qualification = {
    computed_at: new Date().toISOString(),
    hard_gates: verdict.hard_gates,
    scorecard: verdict.scorecard,
    verdict: verdict.verdict,
    archive_reason: verdict.archive_reason || null,
    redesign_brief_path: `clients/${slug}/v2/redesign-brief.json`,
    crawl_summary: {
      pages_crawled: crawl.pages_crawled,
      sitemap_source: crawl.sitemap_source,
      cost: crawl.cost_estimate,
    },
    ai_provider: briefResult.provider,
  };
  fs.writeFileSync(entityPath, JSON.stringify(fresh, null, 2) + '\n');

  // 5. Discord Stage 5 通知
  console.log(`  [5/5] Discord Stage 5 通知...`);
  try {
    const { refreshThreadAndPost } = await import(path.join(REPO, 'core/funnel/lead-thread-sync.js'));
    const { stage5Message } = await import(path.join(REPO, 'core/funnel/audit-stage-messages.js'));
    const msg = stage5Message({ entity: fresh, verdict, crawl, briefResult });
    await refreshThreadAndPost(key, msg);
  } catch (err) {
    console.warn(`     ⚠ Discord post failed: ${err.message}`);
  }

  console.log(`✓ ${key} · ${verdict.verdict}`);
  return { key, status: 'ok', verdict: verdict.verdict, score: verdict.scorecard?.total };
}

(async () => {
  const targets = [];
  if (entityKey) {
    targets.push(entityKey);
  } else if (allDesignReady) {
    const dir = path.join(REPO, 'data/leads/entities');
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (e.phase === 'design-ready') targets.push(f.replace(/\.json$/, ''));
      } catch { /* skip */ }
    }
  }

  console.log(`[pl:check-qualification] targets: ${targets.length}`);
  const results = [];
  for (const t of targets) {
    try {
      const r = await processEntity(t);
      results.push(r);
    } catch (err) {
      console.error(`✗ ${t}: ${err.message}`);
      results.push({ key: t, status: 'error', reason: err.message });
    }
  }

  console.log('\n══════════ SUMMARY ══════════');
  const byVerdict = {};
  for (const r of results) {
    const k = r.verdict || r.status;
    byVerdict[k] = (byVerdict[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(byVerdict)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(JSON.stringify({ ok: true, total: results.length, results }, null, 2));
})().catch((err) => {
  console.error('FATAL:', err.stack || err.message);
  process.exit(1);
});
