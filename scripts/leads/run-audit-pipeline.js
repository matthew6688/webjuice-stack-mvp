#!/usr/bin/env node
/**
 * Block G — End-to-end audit pipeline for one or more leads.
 *
 * Runs in sequence:
 *   1. Block D: detailed audit (Playwright full fetch + 6-dim 39-rule scoring)
 *   2. Block E: visual audit (Ollama vision on desktop screenshot)
 *   3. (optional, --with-reviews) Block D iter 6: Google Places + Ollama review analysis
 *   4. Block F: build internal HTML audit report
 *
 * Each stage caches its fixture so re-runs are cheap. Use --refetch to
 * force a fresh Playwright run; by default existing fixtures are reused.
 *
 * Usage:
 *   npm run leads:run-pipeline -- --entity-key place_xxx
 *   npm run leads:run-pipeline -- --entity-key place_xxx --with-reviews --refetch
 *   npm run leads:run-pipeline -- --all-audit-candidates
 *
 * Cost: T0 (Playwright + Ollama) by default; --with-reviews adds T2
 * Google Places (~$0.017 per lead).
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { detailedAudit, reloadConfig } from '../../core/scoring/detailed-audit.js';
import { siteFetchFull } from '../../core/audit/site-fetch-full.js';
import { runVision } from '../../core/llm/vision-adapter.js';
import { buildVisualAuditPrompt } from '../../core/llm/visual-audit-prompt.js';
import { gradeLead, persistLeadGrade } from '../../core/scoring/lead-grading.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
loadDotEnvLocal(path.join(repoRoot, '.env.local'));
reloadConfig();

const args = parseArgs(process.argv.slice(2));
const entitiesDir = path.join(repoRoot, 'data/leads/entities');
const detailedDir = path.join(repoRoot, 'data/v2/fixtures/detailed-audit');
const visualDir = path.join(repoRoot, 'data/v2/fixtures/visual-autoresearch');
const screenshotsRoot = path.join(detailedDir, 'screenshots');
fs.mkdirSync(detailedDir, { recursive: true });

const VISION_MODEL = process.env.VISION_OLLAMA_MODEL || 'qwen3.6:27b';
const VISION_CAND_ID = 'ollama-qwen3.6-27b-nothink';
const refetch = args.refetch === true;
const withReviews = args['with-reviews'] === true;
const uploadCloudinary = args['upload-cloudinary'] === true;

// Profile controls how aggressively we parallelize. GPU stage (vision)
// remains serial (Mac mini has 1 GPU); only non-GPU stages parallelize.
//   light  — 1 lead at a time, no cross-lead concurrency (work hours)
//   normal — 1 lead at a time, full within-lead parallel (default)
//   max    — 2 leads concurrent for non-GPU stages, GPU serialized via queue
const PROFILE = (args.profile || process.env.PIPELINE_PROFILE || 'normal').toLowerCase();
const CONCURRENT_LEADS = { light: 1, normal: 1, max: 2 }[PROFILE] || 1;

let targets = [];
if (args.all || args['all-audit-candidates']) {
  targets = listAuditCandidateEntityKeys();
} else if (args['entity-key']) {
  targets = [args['entity-key']];
} else {
  console.error('Usage: --entity-key <key> | --all-audit-candidates  [--with-reviews] [--refetch]');
  process.exit(1);
}

console.log(`[run-pipeline] targets=${targets.length}  refetch=${refetch}  reviews=${withReviews}  cloudinary=${uploadCloudinary}  profile=${PROFILE} (concurrent_leads=${CONCURRENT_LEADS})`);

async function processLead(entityKey) {
  console.log(`\n══════════ ${entityKey} ══════════`);
  const entityPath = path.join(entitiesDir, `${entityKey}.json`);
  if (!fs.existsSync(entityPath)) {
    console.warn(`  ✗ no entity file`);
    return { entityKey, ok: false, reason: 'no entity' };
  }
  const entity = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
  const url = entity.latest?.website;
  const slug = slugifyName(entity.latest?.name || entityKey);

  // ── Stage 1: detailed audit (Playwright fetch + scoring) ─────────────
  const detailedPath = path.join(detailedDir, `${entityKey}.json`);
  let detailedFixture = null;
  if (!refetch && fs.existsSync(detailedPath)) {
    console.log(`  [stage 1/4] detailed audit — reuse cached fixture`);
    try { detailedFixture = JSON.parse(fs.readFileSync(detailedPath, 'utf8')); } catch {}
  }
  if (!detailedFixture && url) {
    console.log(`  [stage 1/4] detailed audit — fetching ${url}`);
    const screenshotDir = path.join(screenshotsRoot, entityKey);
    const ledgerPath = path.join(detailedDir, `ledger-${stamp()}.jsonl`);
    let fetchPayload = null;
    try {
      fetchPayload = await siteFetchFull({
        url, screenshotDir,
        niche: entity.latest?.niche,
        ledgerPath, leadId: entityKey, clientSlug: slug,
        stage: 'detailed_audit', purpose: 'pipeline_full_fetch',
      });
    } catch (err) {
      console.warn(`     ⚠ fetch failed: ${err.message}`);
    }
    const audit = detailedAudit({ entity, fetchPayload, businessProfile: null });
    detailedFixture = {
      generatedAt: new Date().toISOString(),
      entity_input: { entityKey, latest: entity.latest, identifiers: entity.identifiers },
      fetch_summary: fetchPayload ? { url: fetchPayload.finalUrl || url, markdown_length: fetchPayload.markdown?.length || 0 } : null,
      tech_stack: fetchPayload?.tech_stack || null,
      sitemap_analysis: fetchPayload?.sitemap_analysis || null,
      activity: fetchPayload?.activity || null,
      ai_geo: fetchPayload?.ai_geo || null,
      pagespeed: fetchPayload?.pagespeed || null,
      form_audit: fetchPayload?.form_audit || null,
      domain_history: fetchPayload?.domain_history || null,
      image_optimization: fetchPayload?.image_optimization || null,
      trust_signals: fetchPayload?.trust_signals || null,
      third_party_weight: fetchPayload?.third_party_weight || null,
      detailed_audit: audit,
    };
    fs.writeFileSync(detailedPath, JSON.stringify(detailedFixture, null, 2) + '\n');
    console.log(`     → audit_score=${audit.audit_score}/100 decision=${audit.decision}`);

    // Matthew 2026-05-13: audit 完自动 refresh master.md · 把审计字段填进 frontmatter + 报告段
    // fire-and-forget · 去重 + 失败兜底在 enqueueMasterMdRefresh
    if (process.env.SOP1_DISABLE_MASTER_MD_AUTOREFRESH !== '1') {
      import('../../core/leads/master-md-refresh.js')
        .then((m) => m.enqueueMasterMdRefresh(entityKey, { reason: 'audit' }))
        .catch((err) => console.error(`[audit] master-md enqueue err: ${err.message}`));
    }
  } else if (!detailedFixture) {
    console.warn(`  ✗ no website URL on entity, can't run detailed audit`);
    return { entityKey, ok: false, reason: 'no website' };
  }

  // ── Stage 2: visual audit (Ollama vision on desktop screenshot) ──────
  const desktopShot = path.join(screenshotsRoot, entityKey, 'desktop.png');
  const visualRunDir = path.join(visualDir, 'pipeline', VISION_CAND_ID);
  const visualPath = path.join(visualRunDir, `${entityKey}.json`);
  let visualFixture = null;
  if (!refetch && fs.existsSync(visualPath)) {
    console.log(`  [stage 2/4] visual audit — reuse cached fixture`);
    try { visualFixture = JSON.parse(fs.readFileSync(visualPath, 'utf8')); } catch {}
  }
  if (!visualFixture && fs.existsSync(desktopShot)) {
    const forcedProvider = process.env.VISION_PROVIDER || 'auto (claude_cli → codex_cli → ollama)';
    console.log(`  [stage 2/4] visual audit — provider: ${forcedProvider}`);
    fs.mkdirSync(visualRunDir, { recursive: true });
    const prompt = buildVisualAuditPrompt({
      businessName: entity.latest?.name,
      niche: entity.latest?.niche,
      city: entity.latest?.city,
    });
    try {
      const out = await runVision({
        prompt,
        imagePaths: [desktopShot],
        leadId: entityKey,
        clientSlug: slug,
        stage: 'visual_audit',
        purpose: 'pipeline_visual_audit',
      });
      visualFixture = {
        provider: out.provider,
        model: out.model || null,
        candidateId: VISION_CAND_ID,
        latencyMs: out.latencyMs,
        parsedJson: out.parsedJson,
        rawText: out.parsedJson ? null : out.rawText?.slice(0, 2000),
        attempts: out.attempts || null,
        tokensIn: out.tokensIn || null,
        tokensOut: out.tokensOut || null,
        theoreticalCostUsd: out.theoreticalCostUsd || null,
      };
      fs.writeFileSync(visualPath, JSON.stringify(visualFixture, null, 2));
      const issues = out.parsedJson?.issues?.length || 0;
      console.log(`     → ${issues} visual issues via ${out.provider}, latency=${(out.latencyMs / 1000).toFixed(1)}s${out.tokensIn ? ` (in=${out.tokensIn} out=${out.tokensOut} ~$${(out.theoreticalCostUsd||0).toFixed(4)})` : ''}`);
    } catch (err) {
      console.warn(`     ⚠ vision failed: ${err.message}`);
    }
  } else if (!visualFixture) {
    console.warn(`  ! visual audit skipped (no desktop.png)`);
  }

  // ── Stage 3a: Lead Grading + persist to entity ────────────────────────
  // Side effect: writes entity.grade + transitions status. If D-grade,
  // auto-archives (no manual review per scale-first policy).
  let leadGrade = null;
  try {
    leadGrade = gradeLead({
      entity,
      detailedAudit: detailedFixture.detailed_audit,
      cheapAudit: null,
      techStack: detailedFixture.tech_stack,
      sitemapAnalysis: detailedFixture.sitemap_analysis,
      activity: detailedFixture.activity,
      domainHistory: detailedFixture.domain_history,
      reviewAnalysis: null,
      businessSizeSignal: null,
    });
    const persistResult = persistLeadGrade({ entityKey, grade: leadGrade });
    console.log(`  [stage 3a/4] graded: ${leadGrade.investment_level}${leadGrade.product_tier ? '/' + leadGrade.product_tier : ''} ${persistResult.ok ? '✓ persisted' : '⚠ ' + persistResult.reason}`);
  } catch (err) {
    console.warn(`     ⚠ grading failed: ${err.message}`);
  }

  // ── Stage 3b (optional): review mining ────────────────────────────────
  // Delegate to build-internal-report --with-reviews; cached fixture.

  // ── Stage 4: HTML report build (delegates to existing CLI) ───────────
  console.log(`  [stage ${withReviews ? '3-4' : '4'}/4] build HTML report${withReviews ? ' (+ reviews)' : ''}`);
  const buildArgs = ['scripts/leads/build-internal-report.js', '--entity-key', entityKey];
  if (withReviews) buildArgs.push('--with-reviews');
  if (uploadCloudinary) buildArgs.push('--upload-cloudinary');
  const r = spawnSync('node', ['--env-file=.env.local', ...buildArgs], {
    cwd: repoRoot, stdio: 'inherit',
  });
  if (r.status !== 0) {
    return { entityKey, ok: false, reason: `build-report exit ${r.status}` };
  }

  return {
    entityKey,
    name: entity.latest?.name,
    ok: true,
    audit_score: detailedFixture.detailed_audit?.audit_score,
    decision: detailedFixture.detailed_audit?.decision,
    visual_issues: visualFixture?.parsedJson?.issues?.length || 0,
    grade: leadGrade ? `${leadGrade.investment_level}${leadGrade.product_tier ? '/' + leadGrade.product_tier : ''}` : null,
    report_url: `/audit-reports/${entityKey}/internal-audit-report.html`,
  };
}

// ─── Dispatcher: concurrency-pooled execution ───────────────────────
async function runWithPool(items, concurrency, fn) {
  const out = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

const summary = await runWithPool(targets, CONCURRENT_LEADS, processLead);

console.log('\n══════════ Pipeline summary ══════════');
console.table(summary);
console.log(JSON.stringify({ ok: summary.every((s) => s.ok), targets: summary.length, summary }, null, 2));

// V3 D35 hook · refresh Discord thread + post summary message for each entity
// Fire-and-forget · 不阻塞 process exit
(async () => {
  try {
    const { refreshThreadAndPost } = await import('../../core/funnel/lead-thread-sync.js');
    for (const s of summary) {
      if (!s.entityKey) continue;
      const auditScore = s.audit_score ?? s.score ?? null;
      const visualScore = s.visual_freshness ?? null;
      const decision = s.decision || '';
      const ok = s.ok;
      const msg = `${ok ? '✅' : '⚠️'} **Audit pipeline ${ok ? '完成' : '失败'}**${
        auditScore != null ? ` · 总分 ${auditScore}` : ''
      }${visualScore != null ? ` · 视觉 ${visualScore}/10` : ''}${decision ? ` · ${decision}` : ''}`;
      await refreshThreadAndPost(s.entityKey, msg);
    }
  } catch { /* non-blocking */ }
})();

function listAuditCandidateEntityKeys() {
  const rescoreDir = path.join(repoRoot, 'data/v2/fixtures/rescore');
  if (!fs.existsSync(rescoreDir)) return [];
  const latest = fs.readdirSync(rescoreDir).filter((f) => f.endsWith('.json')).sort().reverse()[0];
  if (!latest) return [];
  const r = JSON.parse(fs.readFileSync(path.join(rescoreDir, latest), 'utf8'));
  return (r.rows || [])
    .filter((row) => row.v2?.action === 'audit_candidate' && row.website)
    .map((row) => row.entityKey);
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

function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }
function slugifyName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function loadDotEnvLocal(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
