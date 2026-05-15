/**
 * V3 cycle-26 (2026-05-15) · Audit pipeline per-stage Discord message builders
 *
 * Stage labels are imported from core/contracts/discord-messages.js
 * (DO NOT hardcode "Stage X/Y" strings · linter will reject).
 *
 * 9-stage pipeline (Stage 0-8):
 *   0 抓客户 · 1 排除筛选 · 2 网站审计 · 3 视觉审计 · 4 打分定级
 *   5 内部审计报告 · 6 资格复核 · 7 建 demo · 8 发布上线
 *
 * Called from scripts/leads/run-audit-pipeline.js postStage().
 */

import fs from 'node:fs';
import path from 'node:path';
import { STAGE_LABELS, PIPELINE_INTRO } from '../contracts/discord-messages.js';

function readDeploy(slug) {
  if (!slug) return null;
  try {
    const p = path.join('clients', slug, 'v2/concept/reference-adapter/cf-pages-deploy.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return null; }
}

function listEvidence(slug) {
  if (!slug) return [];
  try {
    const d = path.join('clients', slug, 'v2/evidence');
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => /\.png$/i.test(f));
  } catch { return []; }
}

/** V3 D41: list screenshots (desktop / mobile) · for 现状证据 */
function listScreenshots(slug) {
  if (!slug) return [];
  try {
    const d = path.join('clients', slug, 'v2/screenshots');
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => /\.(png|jpg)$/i.test(f));
  } catch { return []; }
}

/** V3 D41: list videos (mobile throttled walkthrough) · for 现状证据 */
function listVideos(slug) {
  if (!slug) return [];
  try {
    const d = path.join('clients', slug, 'v2/video');
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => /\.(webm|mp4)$/i.test(f));
  } catch { return []; }
}

/** Detect if local evidence files are newer than last CF deploy.
 *  Returns true 时 hyperlinks 会 404 · 需 republish 才 live。 */
function isEvidenceStale(slug, deploy) {
  if (!slug || !deploy?.deployed_at) return false;
  try {
    const deployTs = new Date(deploy.deployed_at).getTime();
    const evidenceDir = path.join('clients', slug, 'v2/evidence');
    if (!fs.existsSync(evidenceDir)) return false;
    for (const f of fs.readdirSync(evidenceDir)) {
      if (!/\.png$/i.test(f)) continue;
      const mtime = fs.statSync(path.join(evidenceDir, f)).mtimeMs;
      if (mtime > deployTs) return true;
    }
    return false;
  } catch { return false; }
}

function prettyEvidenceName(filename) {
  return filename
    .replace(/\.(png|jpg)$/i, '')
    .replace(/^issue-/, '')
    .replace(/-/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function slugifyName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ─────────────────────────────────────────────────────────
// Pipeline start (cycle-26 · 9 stages)
// ─────────────────────────────────────────────────────────
export function pipelineStartMessage() {
  return PIPELINE_INTRO;
}

// ─────────────────────────────────────────────────────────
// Stage 0 · 抓客户 done (scraper produced N entities)
// Posted to the #website-tasks task thread (not per-entity thread).
// ─────────────────────────────────────────────────────────
export function stage0Message({ leadCount = 0, durationSec = null, leadNames = [] } = {}) {
  const lines = [];
  lines.push(`**${STAGE_LABELS[1]}** done${durationSec ? ` · ${durationSec}s` : ''}`);
  lines.push('');
  lines.push(`抓到 ${leadCount} 个 entity${leadNames.length ? ':' : ''}`);
  for (const n of leadNames.slice(0, 10)) lines.push(`- ${n}`);
  lines.push('');
  lines.push('━━━');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage 1 · 排除筛选 done (cycle-26 · replaces cheap-audit + old grade table)
// Per-entity message posted right after exclusion-filter verdict.
// ─────────────────────────────────────────────────────────
export function cheapAuditPredictMessage({ entity, exclusion = null, cheapAudit = null } = {}) {
  const latest = entity?.latest || {};
  const rc = latest.review_count || 0;
  const rating = latest.rating || 0;
  const ws = latest.websiteStatus || '?';
  const wsLabel = ws === 'independent_https_site' ? '独立 HTTPS' :
                  ws === 'independent_http_site' ? '独立 HTTP' :
                  ws === 'no_website' ? '无网站' :
                  ws === 'social_or_third_party_only' ? '社媒/三方' : ws;

  const lines = [];
  lines.push(`**${STAGE_LABELS[2]}** done`);
  lines.push('');
  lines.push(`▸ GBP 信号: ${rating}★ · ${rc} 条 · 网站 ${wsLabel}`);

  // exclusion-filter verdict (cycle-23 排除式 · 替代旧硬阈值)
  if (exclusion) {
    if (exclusion.excluded) {
      lines.push(`▸ 排除筛: ❌ Layer ${exclusion.layer} · ${exclusion.reason}`);
      lines.push('');
      lines.push(`**下一步**: → archive · 不深审 (grade=D · phase=archived)`);
    } else if (exclusion.needs_enrichment) {
      lines.push(`▸ 排除筛: ⏳ 缺 contact · enrich 后重判`);
      lines.push('');
      lines.push(`**下一步**: → pl:run-enrichment-batch 自动触发 · 完成后回流 cheap-audit`);
    } else {
      lines.push(`▸ 排除筛: ✓ 通过 3 层 · 阈值 ${exclusion.thresholds?.min_reviews || '?'}-${exclusion.thresholds?.max_reviews || '?'} reviews`);
      lines.push('');
      lines.push(`**下一步**: → 立即进 detailedAudit (audit_now=true)`);
    }
  } else {
    lines.push(`▸ 排除筛: (无数据 · upstream 未调 exclusion-filter)`);
  }

  // qa-pending / D-grade still get a reaction guide (operator action needed)
  // Survivors auto-chain to audit · no reaction needed.
  const showReactionGuide = exclusion?.excluded === false && exclusion?.needs_enrichment;
  if (showReactionGuide) {
    lines.push('');
    lines.push('**手动操作 (对本帖加表情即可):**');
    lines.push('· 🚀 推进 (跳过 enrich · 直接 audit)');
    lines.push('· 💤 archive (不要这家)');
  }

  lines.push('');
  lines.push('━━━');
  return lines.join('\n');
}

// cycle-26 alias · clearer name (callers should migrate)
export const exclusionFilterMessage = cheapAuditPredictMessage;

// ─────────────────────────────────────────────────────────
// Stage 1 · 网站审计 · 12 dim + tech + sitemap + speed + contact
// ─────────────────────────────────────────────────────────
export function stage1Message({ entity, audit, fetchPayload, contact, durationSec }) {
  const lines = [];
  lines.push(`**${STAGE_LABELS[3]}** done${durationSec ? ` · ${durationSec}s` : ''}`);
  lines.push('');

  // 总分 + decision
  if (audit?.audit_score != null) {
    lines.push(`总分: ${audit.audit_score}/100 · ${audit.decision || ''}`);
  }

  // 12 维最弱 3 项 (issues 是 {critical, major, minor} 对象 · 不是 flat 数组)
  const issuesObj = audit?.issues || {};
  const flatIssues = [
    ...(issuesObj.critical || []).map((i) => ({ ...i, sev: 3 })),
    ...(issuesObj.major || []).map((i) => ({ ...i, sev: 2 })),
    ...(issuesObj.minor || []).map((i) => ({ ...i, sev: 1 })),
  ];
  if (flatIssues.length) {
    lines.push(`12 维最弱 ${Math.min(3, flatIssues.length)} 项:`);
    for (const i of flatIssues.slice(0, 3)) {
      const id = i.id || i.title || '?';
      const detail = i.plain_language || i.rationale || '';
      lines.push(`- ${id}${detail ? ` (${String(detail).slice(0, 80)})` : ''}`);
    }
  }

  // Tech stack · objects with .name not strings (cms / analytics / pixels)
  const tech = fetchPayload?.tech_stack;
  if (tech) {
    const parts = [];
    if (tech.cms?.name) parts.push(tech.cms.name);
    else if (typeof tech.cms === 'string') parts.push(tech.cms);
    if (Array.isArray(tech.analytics) && tech.analytics.length) {
      parts.push(...tech.analytics.slice(0, 2).map((a) => a?.name || a).filter(Boolean));
    }
    if (Array.isArray(tech.pixels) && tech.pixels.length) {
      parts.push(...tech.pixels.slice(0, 2).map((p) => p?.name || p).filter(Boolean));
    }
    if (parts.length) lines.push(`Tech: ${parts.join(' · ')}`);
  }

  // Sitemap · has_sitemap=false 时显示 "no sitemap"
  const sm = fetchPayload?.sitemap_analysis;
  if (sm) {
    if (sm.has_sitemap === false) {
      lines.push(`Sitemap: 没找到 (standard paths 无 sitemap.xml)`);
    } else if (sm.total_urls != null) {
      lines.push(`Sitemap: ${sm.total_urls} pages · ${sm.migration_complexity || '?'} migration`);
    }
  }

  // Speed · 用 pagespeed.results.mobile.lab_metrics (lcp_ms / fcp_ms / cls / tbt_ms)
  const mobMetrics = fetchPayload?.pagespeed?.results?.mobile?.lab_metrics;
  const mobScores = fetchPayload?.pagespeed?.results?.mobile?.scores;
  if (mobMetrics || mobScores) {
    const parts = [];
    if (mobScores?.performance != null) parts.push(`perf ${mobScores.performance}/100`);
    if (mobMetrics?.lcp_ms != null) parts.push(`LCP ${(mobMetrics.lcp_ms / 1000).toFixed(1)}s`);
    if (mobMetrics?.fcp_ms != null) parts.push(`FCP ${(mobMetrics.fcp_ms / 1000).toFixed(1)}s`);
    if (mobMetrics?.cls != null) parts.push(`CLS ${mobMetrics.cls.toFixed(2)}`);
    if (parts.length) lines.push(`Speed (mobile): ${parts.join(' · ')}`);
  }

  // Contact info
  if (contact) {
    lines.push('');
    lines.push('联系信息:');
    if (contact.emails?.length) {
      lines.push(`- email: ${contact.emails[0]}${contact.contact_us_url ? ` (from [/contact/](${contact.contact_us_url}))` : ''}`);
    } else if (contact.contact_us_url) {
      lines.push(`- email: — (已抓 [/contact/](${contact.contact_us_url}) · 网站未公开)`);
    } else {
      lines.push(`- email: —`);
    }
    if (entity?.latest?.phone) lines.push(`- phone: ${entity.latest.phone}`);
    const social = contact.social_links || {};
    const socialEntries = Object.entries(social).filter(([, v]) => v);
    if (socialEntries.length) {
      lines.push(`- social: ${socialEntries.map(([k, v]) => `[${k}](${v})`).join(' · ')}`);
    } else {
      lines.push(`- social: —`);
    }
  }

  // Hard triggers
  const triggers = audit?.hard_triggers || [];
  lines.push('');
  if (triggers.length) {
    lines.push(`Hard triggers: ${triggers.join(' · ')}`);
  } else {
    lines.push(`Hard triggers: passed (无触发)`);
  }

  lines.push('');
  lines.push('━━━');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage 2 · 视觉审计 · vision LLM
// ─────────────────────────────────────────────────────────
export function stage2Message({ visual, provider, model, latencyMs, costUsd }) {
  const lines = [];
  lines.push(`**${STAGE_LABELS[4]}** · ${provider || '?'} · ${latencyMs ? (latencyMs / 1000).toFixed(1) + 's' : '?'}`);
  lines.push('');

  // 3 visual scores
  const parsed = visual?.parsedJson || {};
  const fresh = parsed.visual_freshness;
  const trust = parsed.visual_trust;
  const conv = parsed.visual_conversion;
  const age = parsed.visual_age;
  if (fresh != null || trust != null || conv != null) {
    lines.push(`视觉评分:`);
    if (fresh != null) lines.push(`- 新鲜度 ${fresh}/10${age ? ` · 风格 ${age}` : ''}`);
    if (trust != null) lines.push(`- 信任 ${trust}/10`);
    if (conv != null) lines.push(`- 转化 ${conv}/10`);
  }

  // Top 3 issues
  const issues = parsed.issues || [];
  if (issues.length) {
    lines.push('');
    lines.push(`Top ${Math.min(3, issues.length)} 问题:`);
    issues.slice(0, 3).forEach((i, idx) => {
      const t = i.title || i.id || String(i).slice(0, 80);
      lines.push(`${idx + 1}. ${t}`);
    });
  }

  // Provider · model · cost
  if (model || costUsd != null) {
    lines.push('');
    const parts = [];
    if (provider) parts.push(`provider ${provider}`);
    if (model) parts.push(`model ${model}`);
    if (costUsd != null) parts.push(`~$${costUsd.toFixed(4)}`);
    lines.push(parts.join(' · '));
  }

  lines.push('');
  lines.push('━━━');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage 3 · grade router
// ─────────────────────────────────────────────────────────
export function stage3Message({ leadGrade, audit, entity }) {
  const lines = [];
  lines.push(`**${STAGE_LABELS[5]}** done`);
  lines.push('');

  const grade = leadGrade?.investment_level || '?';
  const tier = leadGrade?.product_tier || null;
  const pricing = leadGrade?.recommended_pricing?.one_time || (
    tier === 'T1' ? '$399 一次性 + 3 修' :
    tier === 'T2' ? '$399 + $299/年 maintenance' :
    tier === 'T3' ? 'custom · 月度 retainer' : null
  );
  lines.push(`Grade: ${grade}${tier ? ` / ${tier}` : ''}${pricing ? ` (${pricing})` : ''}`);

  // 原因 · 取 factors 前 3
  const factors = (leadGrade?.investment_factors || leadGrade?.factors || []).slice(0, 3);
  if (factors.length) {
    lines.push(`原因: ${factors.join(' · ')}`);
  } else if (leadGrade?.investment_reason) {
    lines.push(`原因: ${leadGrade.investment_reason.slice(0, 200)}`);
  }

  // Next action
  if (leadGrade?.next_action) {
    lines.push(`下一步: ${leadGrade.next_action.slice(0, 200)}`);
  }

  // Skip reasons (D-grade)
  if (grade === 'D' && Array.isArray(leadGrade?.skip_reasons) && leadGrade.skip_reasons.length) {
    lines.push(`skip 原因: ${leadGrade.skip_reasons.map((r) => r.id || r).join(' · ')}`);
  }

  // Phase + thread channel
  lines.push('');
  const phase = entity?.phase || (grade === 'D' ? 'archived' : 'audit-ready');
  const hasProjectThread = !!entity?.project_thread_id;
  const channelInfo = hasProjectThread
    ? '#website-projects 已开'
    : grade === 'D'
      ? '不开 thread (archived)'
      : '即将 open #website-leads (后续 publish 后自动 graduate)';
  lines.push(`phase: ${phase} (set) · thread: ${channelInfo}`);

  lines.push('');
  lines.push('━━━');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage 4 · 内部审计报告
// ─────────────────────────────────────────────────────────
export function stage4Message({ entity, slug, htmlSize }) {
  // cycle-26 · 内部审计报告 (本地) · 仅 LOCAL
  // 仅 LOCAL · 不 mention demo URL (Stage 9 publish 才有)
  const lines = [];
  lines.push(`**${STAGE_LABELS[6]}** done`);
  lines.push('');

  const evidence = listEvidence(slug);
  const screenshots = listScreenshots(slug);
  const videos = listVideos(slug);

  lines.push('━━━ 现状证据 (本地 · 等发布) ━━━');
  lines.push(`内部 audit HTML: 本地${htmlSize ? ` · ${(htmlSize / 1024).toFixed(1)} KB` : ''}`);
  lines.push(`master.md: 本地`);
  lines.push(`截图: ${screenshots.length} · 录屏: ${videos.length} · evidence PNG: ${evidence.length}`);
  lines.push('');
  lines.push(`下一步: 资格复核 · 通过后 chain build + publish`);
  lines.push('');
  lines.push('━━━');

  return lines.join('\n');
}

// cycle-26 · demo build done (STAGE_LABELS[8]) · 在 pl-build-from-reference 触发
export function stage6Message({ slug, indexHtmlPath, sizeBytes }) {
  const lines = [];
  lines.push(`**${STAGE_LABELS[8]}** done`);
  lines.push('');
  lines.push(`build output: ${indexHtmlPath} (${sizeBytes ? (sizeBytes / 1024).toFixed(1) + ' KB' : '?'})`);
  lines.push('');
  lines.push(`下一步: 发布到 CF Pages`);
  lines.push('');
  lines.push('━━━');
  return lines.join('\n');
}

// cycle-26 · publish to CF Pages (STAGE_LABELS[9]) · 在 pl-publish-demo 触发
export function stage7Message({ slug, deployUrl, deployedAt }) {
  const lines = [];
  lines.push(`**${STAGE_LABELS[9]}** done`);
  lines.push('');
  lines.push('━━━ 在线资源 ━━━');
  lines.push(`Demo: ${deployUrl}`);
  lines.push(`• [客户 audit](${deployUrl}/customer-facing-audit.html)`);
  lines.push(`• [内部 audit](${deployUrl}/internal-audit-report.html)`);
  lines.push(`• [master.md](${deployUrl}/master.md)`);
  lines.push(`• [master.report.html](${deployUrl}/master.report.html)`);
  if (deployedAt) lines.push(`发布于: ${String(deployedAt).slice(0, 10)}`);
  lines.push('');
  lines.push(`下一步: 自动 graduate 到 #website-projects · 旧 #website-leads thread archive`);
  lines.push('');
  lines.push('━━━');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage 5 · Qualification check (D39 · M2 → M3 gate)
// ─────────────────────────────────────────────────────────
export function stage5Message({ entity, verdict, crawl, briefResult }) {
  const lines = [];
  lines.push(`**${STAGE_LABELS[7]}** done${crawl?.duration_ms ? ` · ${(crawl.duration_ms / 1000).toFixed(1)}s` : ''}`);
  lines.push('');

  // cycle-26 reorder: VERDICT 在最前 · operator 一眼看结果 · 然后 Hard Gates per-gate · Scorecard · 数据采集 末尾
  // ━━━ Verdict (摘要) ━━━
  lines.push('━━━ Verdict ━━━');
  if (verdict.verdict === 'ready-to-build') {
    lines.push(`✅ **ready-to-build** · 总分 ${verdict.scorecard?.total ?? '?'}/100 ≥ 阈值 ${verdict.scorecard?.threshold ?? 60}`);
    lines.push(`下一步: 自动 chain pl:build-from-reference + pl:publish-demo`);
  } else if (verdict.verdict === 'qa-pending') {
    lines.push(`⚠️ **qa-pending** · 总分 ${verdict.scorecard?.total ?? '?'}/100 < 阈值 ${verdict.scorecard?.threshold ?? 60}`);
    lines.push(`下一步: operator 看 scorecard 弱项 · 补字段 · 跑 \`npm run pl:check-qualification -- --entity-key ${entity.entityKey}\` 重评`);
  } else if (verdict.verdict === 'archived') {
    lines.push(`❌ **archived** · ${verdict.archive_reason}`);
  }

  // ━━━ Hard Gates · 逐项 (logic 顺序 · 通过先列 · 失败后列) ━━━
  lines.push('');
  lines.push('━━━ Hard Gates ━━━');
  const allGates = verdict.hard_gates || [];
  const passed = allGates.filter((g) => g.passed);
  const failed = allGates.filter((g) => !g.passed);
  for (const g of passed) lines.push(`✓ ${g.id}`);
  for (const g of failed) lines.push(`❌ ${g.id}: ${g.reason}`);
  lines.push(`(${passed.length}/${allGates.length} passed)`);

  // ━━━ Scorecard · 5 维度 ━━━
  if (verdict.scorecard) {
    lines.push('');
    lines.push('━━━ Scorecard ━━━');
    const sc = verdict.scorecard;
    lines.push(`A 核心信息: ${sc.A_core_info.score}/${sc.A_core_info.max} (${(sc.A_core_info.items || []).join(', ')})`);
    lines.push(`B 品牌素材: ${sc.B_brand.score}/${sc.B_brand.max} (${(sc.B_brand.items || []).join(', ')})`);
    lines.push(`C 范围可行: ${sc.C_scope.score}/${sc.C_scope.max} (${(sc.C_scope.items || []).join(', ')})`);
    lines.push(`D 技术风险: ${sc.D_tech.score}/${sc.D_tech.max} (${(sc.D_tech.items || []).join(', ')})`);
    lines.push(`E 解决性: ${sc.E_solvability.score}/${sc.E_solvability.max} (${(sc.E_solvability.items || []).join(', ')})`);
    lines.push(`**总分: ${sc.total}/100** · 阈值 ${sc.threshold}`);
  }

  // ━━━ 数据采集 (末尾 · 透明度) ━━━
  if (crawl) {
    lines.push('');
    lines.push('━━━ 数据采集 ━━━');
    lines.push(`Multi-page crawl: ${crawl.pages_crawled || 0} 页 · sitemap=${crawl.sitemap_source || '?'}`);
    lines.push(`Firecrawl: ${crawl.pages_via_firecrawl || 0} · Direct fetch: ${crawl.pages_via_direct || 0} · ~$${(crawl.cost_estimate || 0).toFixed(3)}`);
    if (briefResult) {
      lines.push(`AI 分析: ${briefResult.provider} · ${(briefResult.duration_ms / 1000).toFixed(1)}s · ~$${briefResult.cost_estimate || 0}`);
    }
  }

  lines.push('');
  lines.push('━━━');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage failure (异常 · 唯一 emoji)
// ─────────────────────────────────────────────────────────
export function stageFailMessage({ stage, reason, retryHint }) {
  // cycle-26 · 9-stage · stage is 0-8
  const label = STAGE_LABELS[stage] || `Stage ${stage}/9`;
  return `❌ **${label} · 失败**\n\nreason: ${reason}${retryHint ? `\nretry: ${retryHint}` : ''}\n\naudit 终止`;
}
