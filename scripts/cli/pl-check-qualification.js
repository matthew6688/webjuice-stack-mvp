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

  // V3 D43 cycle-6 (Matthew 2026-05-14): pre-gate check on cheap signals BEFORE
  // running ~$0.5 / 74s LLM brief. 5 of 7 hard gates can be checked without
  // brief (tech_stack + entity.categories + sitemap from audit). If any of
  // these fail, archive immediately and skip brief — saves ~$0.5 per archived entity.
  console.log(`  [2/5] pre-gate check (cheap signals · skip brief if obviously archived)...`);
  const { qualifyEntity } = await import(path.join(REPO, 'core/scoring/qualification-scorecard.js'));
  const auditPre = loadDetailedAudit(key);
  const preCtx = {
    entity,
    audit: auditPre ? { ...auditPre, detailed_audit: auditPre.detailed_audit, sitemap_analysis: auditPre.sitemap_analysis, tech_stack: auditPre.tech_stack } : null,
    brief: null, // 故意为空 · pre-gate 只 check 不依赖 brief 的 gates
    sitemap: auditPre?.sitemap_analysis || null,
  };
  const preVerdict = qualifyEntity(preCtx);
  if (!preVerdict.gates_passed && preVerdict.archive_reason) {
    // Only short-circuit if the failed gate is brief-independent. Member-portal
    // and active-blog-heavy gates need brief flags, so they'd false-fail here.
    const failedGateId = preVerdict.archive_reason.match(/^gate_(\w+):/)?.[1];
    const BRIEF_INDEPENDENT = new Set(['too_many_pages', 'ecommerce', 'third_party_booking', 'too_many_pixels']);
    // multi_business: partially brief-independent (entity.categories>=4 branch is)
    const multiBusinessByCategories = failedGateId === 'multi_business'
      && (entity.latest?.categories || []).length >= 4;
    if (BRIEF_INDEPENDENT.has(failedGateId) || multiBusinessByCategories) {
      console.log(`     ✗ PRE-GATE FAILED · ${preVerdict.archive_reason} · 跳过 brief LLM ($0.5/74s 省了)`);
      // Persist archive directly · skip brief + final qualifyEntity
      const { setEntityPhase, ENTITY_PHASE } = await import(path.join(REPO, 'core/leads/discovery-store.js'));
      setEntityPhase({ entityKey: key, phase: ENTITY_PHASE.ARCHIVED, archive_reason: preVerdict.archive_reason });
      const entityPath = path.join(REPO, 'data/leads/entities', `${key}.json`);
      const fresh = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
      fresh.qualification = {
        computed_at: new Date().toISOString(),
        hard_gates: preVerdict.hard_gates,
        scorecard: null,
        verdict: 'archived',
        archive_reason: preVerdict.archive_reason,
        brief_skipped: true,
        brief_skipped_reason: 'pre-gate failed on brief-independent signal',
        crawl_summary: { pages_crawled: crawl.pages_crawled, sitemap_source: crawl.sitemap_source },
      };
      fs.writeFileSync(entityPath, JSON.stringify(fresh, null, 2) + '\n');
      return { key, status: 'archived', verdict: 'archived', archive_reason: preVerdict.archive_reason, brief_skipped: true };
    }
    console.log(`     · pre-gate ${preVerdict.archive_reason} needs brief to confirm · running brief...`);
  } else {
    console.log(`     ✓ pre-gates passed · running brief...`);
  }

  // 3. AI 分析 raw JSON (only reached if pre-gate didn't short-circuit)
  console.log(`  [3/5] AI 分析 raw JSON · cascade codex → claude → ollama...`);
  const { buildRedesignBrief, saveBrief } = await import(path.join(REPO, 'core/audit/redesign-brief-builder.js'));
  const briefResult = await buildRedesignBrief(crawl);
  if (briefResult.error || !briefResult.brief) {
    console.warn(`     ⚠ brief build failed: ${briefResult.error}`);
    return { key, status: 'fail', reason: `brief_failed: ${briefResult.error}` };
  }
  saveBrief(slug, briefResult);
  console.log(`     → provider=${briefResult.provider} · ${(briefResult.duration_ms / 1000).toFixed(1)}s · ~$${briefResult.cost_estimate}`);

  // 4. Full qualification scorecard with brief
  console.log(`  [4/5] qualification scorecard (with brief)...`);
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

  // V3 D43 GR6 · LLM judge audit conclusion · 异常时不阻塞 · 把结果写进 entity 让 operator 看
  let judgeAudit = null;
  if (verdict.scorecard) {
    try {
      const { judgeAuditConclusion } = await import(path.join(REPO, 'core/llm/match-judge.js'));
      judgeAudit = await judgeAuditConclusion({
        entity,
        crawl_summary: { pages_crawled: crawl.pages_crawled, sitemap_source: crawl.sitemap_source },
        scorecard: verdict.scorecard,
        verdict: verdict.verdict,
        hard_gates: verdict.hard_gates,
      });
      console.log(`     → llm-judge audit · verdict=${judgeAudit.verdict} conf=${judgeAudit.confidence}${judgeAudit.anomalies?.length ? ' · anomalies: ' + judgeAudit.anomalies.slice(0, 2).join('; ') : ''}`);
    } catch (err) {
      console.warn(`     · llm-judge audit skipped: ${err.message}`);
    }
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
    llm_judge_audit: judgeAudit ? {
      verdict: judgeAudit.verdict,
      confidence: judgeAudit.confidence,
      reason: judgeAudit.reason,
      anomalies: judgeAudit.anomalies,
      provider: judgeAudit.provider,
    } : null,
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

  // V3 D43 cycle-18 (Matthew 2026-05-14): chain build only · pl-build-from-reference
  // self-chains publish at its DONE handler (serialized). Previously cycle-15 chained
  // build + publish in parallel → publish raced ahead and failed.
  // Also use kind='ops' (has Discord forum tag) instead of 'demo_build' (no tag yet).
  if (verdict.verdict === 'ready-to-build') {
    try {
      const { createTask } = await import(path.join(REPO, 'core/tasks/task-store.js'));
      const buildTask = createTask({
        kind: 'ops',
        source: { platform: 'internal', thread_id: entity.discord_thread_id || null, author: 'qualification auto-chain', message_id: null },
        input: { text: `auto: build demo for ${key} (verdict=ready-to-build · publish auto-chains)`, attachments: [] },
        target: {
          cli: 'pl:build-from-reference',
          args: ['--slug', slug, '--entity-key', key],
          timeout_ms: 600_000,
        },
      });
      console.log(`     → chained demo build task: ${buildTask.task_id} (publish will auto-chain on build done)`);
    } catch (err) {
      console.warn(`     ⚠ auto-chain build failed: ${err.message}`);
    }
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
