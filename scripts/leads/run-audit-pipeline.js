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

// V3 D37 (2026-05-14) · per-stage Discord update helper
// V3 D38 (2026-05-14) · upgraded to use richer message builders
// Fire-and-forget · errors logged but never throw · 不阻塞 pipeline
async function postStage(entityKey, message) {
  try {
    const mod = await import('../../core/funnel/lead-thread-sync.js');
    await mod.refreshThreadAndPost(entityKey, message, { skipCard: false });
  } catch (err) {
    console.warn(`  [discord-hook] ${err.message}`);
  }
}

// V3 D38 · stage message builders (centralized · per SOP-AUDIT-STAGE-NOTIFICATIONS.md)
async function loadStageMessages() {
  return await import('../../core/funnel/audit-stage-messages.js');
}

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

  // V3 D38 · audit start (使用 message builder)
  const stageMsgs = await loadStageMessages();
  await postStage(entityKey, stageMsgs.pipelineStartMessage());
  const stage1StartTs = Date.now();

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

    // V3 D37 · Contact info extraction · 从 fetchPayload.rawHtml 抽 email + contact_us_url + social_links
    // V3 D38 · 加 2 页 crawl · 抓 /contact/ 页提升 email/social 覆盖率
    let contactInfo = { emails: [], contact_us_url: null, social_links: {} };
    if (fetchPayload?.rawHtml) {
      try {
        const { extractContactInfo } = await import('../../core/audit/contact-extraction.js');
        contactInfo = extractContactInfo(fetchPayload);

        // D38 · 2-page crawl: if /contact/ URL found · fetch + re-extract · merge
        if (contactInfo.contact_us_url) {
          try {
            const { fetchContactPage } = await import('../../core/audit/contact-page-fetch.js');
            const contactPagePayload = await fetchContactPage(contactInfo.contact_us_url);
            if (contactPagePayload?.rawHtml) {
              const contactPageInfo = extractContactInfo(contactPagePayload);
              // Merge: dedupe emails · prefer richer social
              for (const e of contactPageInfo.emails) {
                if (!contactInfo.emails.includes(e)) contactInfo.emails.push(e);
              }
              contactInfo.social_links = { ...contactInfo.social_links, ...contactPageInfo.social_links };
              console.log(`     → contact-page crawl ok · +${contactPageInfo.emails.length} emails · +${Object.keys(contactPageInfo.social_links).length} social`);
            }
          } catch (err) {
            console.warn(`     ⚠ contact-page crawl failed (non-blocking): ${err.message}`);
          }
        }

        // Write back to entity (read-merge-write to preserve other writers)
        const fresh = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
        fresh.latest = fresh.latest || {};
        if (contactInfo.emails.length && !fresh.latest.email) fresh.latest.email = contactInfo.emails[0];
        if (contactInfo.emails.length > 1 && !fresh.latest.backup_email) fresh.latest.backup_email = contactInfo.emails[1];
        if (contactInfo.contact_us_url && !fresh.latest.contact_us_url) fresh.latest.contact_us_url = contactInfo.contact_us_url;
        if (Object.keys(contactInfo.social_links).length) {
          fresh.latest.social_links = { ...(fresh.latest.social_links || {}), ...contactInfo.social_links };
        }
        fs.writeFileSync(entityPath, JSON.stringify(fresh, null, 2) + '\n');
        console.log(`     → contact: emails=${contactInfo.emails.length} · contact_url=${contactInfo.contact_us_url ? 'yes' : 'no'} · social=${Object.keys(contactInfo.social_links).join(',') || 'none'}`);
      } catch (err) {
        console.warn(`     ⚠ contact extraction failed: ${err.message}`);
      }
    }

    // V3 D38 · Stage 1 done hook (rich message)
    const stage1Sec = Math.round((Date.now() - stage1StartTs) / 1000);
    const entityFresh = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
    await postStage(entityKey, stageMsgs.stage1Message({
      entity: entityFresh,
      audit,
      fetchPayload,
      contact: contactInfo,
      durationSec: stage1Sec,
    }));

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
      // V3 D38 · Stage 2 done hook (rich message)
      await postStage(entityKey, stageMsgs.stage2Message({
        visual: visualFixture,
        provider: out.provider,
        model: out.model,
        latencyMs: out.latencyMs,
        costUsd: out.theoreticalCostUsd,
      }));
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
    // V3 D38 · Stage 3 done hook (rich message)
    const entityForStage3 = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
    await postStage(entityKey, stageMsgs.stage3Message({
      leadGrade,
      audit: detailedFixture.detailed_audit,
      entity: entityForStage3,
    }));
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
    // V3 D38 · Stage 4 fail
    await postStage(entityKey, stageMsgs.stageFailMessage({
      stage: 4,
      reason: `build-internal-report exit ${r.status}`,
      retryHint: '检查 internal-audit-report.html 生成日志',
    }));
    return { entityKey, ok: false, reason: `build-report exit ${r.status}` };
  }
  // V3 D38 · Stage 4 done hook (rich message · evidence hyperlinks)
  const reportPath = path.join('clients', slug, 'v2', 'internal-audit-report.html');
  let htmlSize = null;
  try { htmlSize = fs.statSync(reportPath).size; } catch {}
  await postStage(entityKey, stageMsgs.stage4Message({
    entity: JSON.parse(fs.readFileSync(entityPath, 'utf8')),
    slug,
    htmlSize,
  }));

  // V3 D39 · Stage 5 · Qualification check (M2 → M3 gate)
  // 仅 grade A/B/C 跑 qualification (D 直接 archived)
  if (leadGrade && ['A', 'B', 'C'].includes(leadGrade.investment_level)) {
    try {
      console.log(`  [stage 5/5] qualification check...`);
      const qRes = spawnSync('node', ['--env-file-if-exists=.env.local', 'scripts/cli/pl-check-qualification.js', '--entity-key', entityKey], {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 600_000,
        stdio: 'inherit',
      });
      if (qRes.status !== 0) {
        console.warn(`  [stage 5/5] qualification exit ${qRes.status}`);
      }
    } catch (err) {
      console.warn(`  [stage 5/5] qualification err: ${err.message}`);
    }
  }

  // V3 D38 bug fix · auto-republish to CF Pages if entity was previously published.
  // 否则 Stage 4 message 的 evidence hyperlinks 会 404 (CF 还停在旧文件名)
  // pl:publish-demo 仅 wrangler deploy · ~30s · $0 · 不调 LLM
  try {
    const deployPath = path.join('clients', slug, 'v2/concept/reference-adapter/cf-pages-deploy.json');
    if (fs.existsSync(deployPath)) {
      console.log(`  [auto-republish] entity previously published · re-deploying to CF Pages...`);
      const rep = spawnSync('npm', ['run', 'pl:publish-demo', '--', '--slug', slug], {
        cwd: repoRoot,
        stdio: 'inherit',
        timeout: 120_000,
      });
      if (rep.status !== 0) {
        console.warn(`  [auto-republish] failed exit=${rep.status} · evidence links 可能 stale`);
      }
    }
  } catch (err) {
    console.warn(`  [auto-republish] err: ${err.message}`);
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

// V3 D37 · per-stage hook 替代 D35 end-of-pipeline 整体 summary
// 每个 entity 已通过 postStage() 在 4 个 stage 节点发了消息 · 不再 batch summary 重复

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
