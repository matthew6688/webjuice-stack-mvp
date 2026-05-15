/**
 * V3 cycle-27 (Matthew 2026-05-15) · Per-entity lead-thread stage messages · v2 typography
 *
 * Sister to `core/funnel/batch-thread-messages.js` (which handles batch thread).
 * This module formats Stage 1-9 messages posted to #website-leads /
 * #website-projects per-entity threads.
 *
 * Typography rules: see `core/contracts/audit-stage-content.js`.
 *   - 正文零 emoji · status only ✓/✗ sparingly
 *   - `## ` stage header · `__under__` subsection · `-# ` subtext
 *   - `*italic*` 普通话翻译 · `> blockquote` 客户影响
 *   - `` `inline code` `` 值 · `———` major divider · bullet list for fields
 *   - 没数据 `—` 占位 · 不删行
 *
 * 9-stage pipeline · all builders receive null-safe args:
 *   Stage 1 · 入库          (stage0Message · batch-level summary)
 *   Stage 2 · 排除筛选      (cheapAuditPredictMessage · per-entity)
 *   Stage 3 · 网站审计      (stage1Message · per-entity)
 *   Stage 4 · 视觉审计      (stage2Message · per-entity)
 *   Stage 5 · 打分定级      (stage3Message · per-entity)
 *   Stage 6 · 内部审计报告  (stage4Message · per-entity)
 *   Stage 7 · 资格复核      (stage5Message · per-entity)
 *   Stage 8 · 建 demo       (stage6Message · per-entity)
 *   Stage 9 · 发布上线      (stage7Message · per-entity)
 *
 * Called from scripts/leads/run-audit-pipeline.js postStage(),
 *  scripts/cli/pl-check-qualification.js, pl-build-from-reference.js, pl-publish-demo.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import { STAGE_LABELS, PIPELINE_INTRO } from '../contracts/discord-messages.js';
import {
  fmtStageHeader, fmtSubHeader, fmtRow, fmtRows, fmtCode, fmtTranslation,
  fmtBlockquote, fmtSubtext, fmtLink, fmtCriticalIssue, joinSections,
  safeTruncate, PLACEHOLDER, MAX_MESSAGE_LENGTH,
} from '../contracts/audit-stage-content.js';

// ─── disk helpers (unchanged from v1 · used by stage4Message) ────────────
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
function listScreenshots(slug) {
  if (!slug) return [];
  try {
    const d = path.join('clients', slug, 'v2/screenshots');
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => /\.(png|jpg)$/i.test(f));
  } catch { return []; }
}
function listVideos(slug) {
  if (!slug) return [];
  try {
    const d = path.join('clients', slug, 'v2/video');
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => /\.(webm|mp4)$/i.test(f));
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────
// Pipeline start
// ─────────────────────────────────────────────────────────
export function pipelineStartMessage() {
  return PIPELINE_INTRO;
}

// ─────────────────────────────────────────────────────────
// Stage 1 · 入库 (batch-level summary · posted to #website-tasks task thread)
// ─────────────────────────────────────────────────────────
export function stage0Message({ leadCount = 0, durationSec = null, leadNames = [] } = {}) {
  const lines = [];
  lines.push(fmtStageHeader(1, durationSec ? `${durationSec}s` : null));
  lines.push('');
  lines.push('');
  lines.push(`**${leadCount} 个商家入库**`);
  lines.push('');
  if (leadNames.length === 0) {
    lines.push(`- ${PLACEHOLDER}`);
  } else {
    for (const n of leadNames.slice(0, 10)) lines.push(`- ${n}`);
    if (leadNames.length > 10) lines.push(`- ${fmtSubtext(`… 还有 ${leadNames.length - 10} 个 · 见 batch thread`)}`);
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage 2 · 排除筛选 (per-entity)
// ─────────────────────────────────────────────────────────
export function cheapAuditPredictMessage({ entity, exclusion = null, cheapAudit = null } = {}) {
  const latest = entity?.latest || {};
  const niche_rel = entity?.niche_relevance || {};

  // suffix shows verdict (keep / archive / enrich)
  let verdictSuffix;
  if (exclusion?.excluded) verdictSuffix = `archive · L${exclusion.layer}`;
  else if (exclusion?.needs_enrichment) verdictSuffix = 'enrich first';
  else verdictSuffix = exclusion ? 'keep' : null;

  const lines = [];
  lines.push(fmtStageHeader(2, verdictSuffix));
  lines.push('');
  lines.push('');

  // 3-layer judgement
  lines.push(fmtSubHeader('3 层判断'));
  lines.push('');
  lines.push(fmtRow('Niche 相关性', niche_rel.relevant != null
    ? `${niche_rel.relevant ? 'pass' : 'fail'}${niche_rel.confidence != null ? ` · conf ${niche_rel.confidence}` : ''}`
    : null));
  if (exclusion) {
    const v = exclusion.excluded
      ? `✗ Layer ${exclusion.layer} — ${exclusion.reason}`
      : exclusion.needs_enrichment
        ? '⏳ 缺 contact · enrich 后重判'
        : '✓ 通过 3 层';
    lines.push(fmtRow('排除规则', v));
  } else {
    lines.push(fmtRow('排除规则', null));
  }
  lines.push(fmtRow('LLM niche-judge',
    niche_rel.reason ? `pass · ${niche_rel.reason.slice(0, 80)}` : (exclusion?.excluded ? 'skip (已 hard exclude)' : null)));

  // GBP snapshot
  const ws = latest.websiteStatus;
  const wsLabel = ws === 'independent_https_site' ? '独立 HTTPS' :
                  ws === 'independent_http_site' ? '独立 HTTP' :
                  ws === 'no_website' ? '无网站' :
                  ws === 'social_or_third_party_only' ? '社媒/三方' : (ws || null);

  const sections = [lines.join('\n')];

  const gbpLines = [
    fmtSubHeader('GBP 速览'),
    '',
    fmtRows([
      ['评分', latest.rating],
      ['评论数', latest.review_count],
      ['类别', latest.category || (latest.categories?.[0] ?? null)],
      ['网站状态', wsLabel],
      ['触发的红灯', (cheapAudit?.fired_triggers || []).join(' · ') || null],
    ]),
  ];

  // 普通话翻译 / 客户影响
  let plainTake = null;
  if (exclusion?.excluded) {
    plainTake = `${exclusion.reason} · 不在产品包内 · 不浪费 audit 成本`;
  } else if (exclusion?.needs_enrichment) {
    plainTake = '缺联系方式 · enrich 完才能判这家是否值得审';
  } else if (cheapAudit?.action === 'manual_review') {
    plainTake = 'GBP 资料 marginal · 网站本身能用但可能漏水多';
  }
  if (plainTake) {
    gbpLines.push('');
    gbpLines.push('');
    gbpLines.push(fmtBlockquote(plainTake));
  }
  sections.push(gbpLines.join('\n'));

  // 下一步
  const nextLines = ['**下一步**'];
  if (exclusion?.excluded) nextLines.push('- archive · 不深审 (grade=D · phase=archived)');
  else if (exclusion?.needs_enrichment) nextLines.push('- pl:run-enrichment-batch 自动触发 · 完成后回流 cheap-audit');
  else nextLines.push('- 进 Stage 3 网站审计 (Playwright 抓首页 + DOM 12 维)');
  sections.push(nextLines.join('\n'));

  return safeTruncate(joinSections(sections));
}

// cycle-26 alias · clearer name
export const exclusionFilterMessage = cheapAuditPredictMessage;

// ─────────────────────────────────────────────────────────
// Stage 3 · 网站审计 (per-entity)
// ─────────────────────────────────────────────────────────
export function stage1Message({ entity, audit, fetchPayload, contact, durationSec }) {
  const sections = [];

  // ── Header + 结论 ──
  const headerLines = [];
  headerLines.push(fmtStageHeader(3, durationSec ? `${durationSec}s` : null));
  headerLines.push('');
  headerLines.push('');
  headerLines.push(fmtSubHeader('结论'));
  headerLines.push('');
  const issuesObj = audit?.issues || {};
  const cCount = (issuesObj.critical || []).length;
  const mCount = (issuesObj.major || []).length;
  const nCount = (issuesObj.minor || []).length;
  headerLines.push(fmtRow('总分', audit?.audit_score != null ? `${audit.audit_score}/100 → ${audit.decision || PLACEHOLDER}` : null));
  headerLines.push(fmtRow('问题计数', `critical ${cCount} · major ${mCount} · minor ${nCount}`));
  const triggers = audit?.hard_triggers || [];
  headerLines.push(fmtRow('Hard triggers', triggers.length ? triggers.join(' · ') : 'passed (无触发)'));
  sections.push(headerLines.join('\n'));

  // ── Top critical issues (max 3) ──
  const flatCrit = (issuesObj.critical || []).slice(0, 3);
  if (flatCrit.length > 0) {
    const critLines = ['### Critical · Top ' + flatCrit.length];
    critLines.push('');
    flatCrit.forEach((i, idx) => {
      const title = i.id || i.title || `issue ${idx + 1}`;
      const plain = i.plain_language || i.rationale || null;
      const impact = i.customer_impact || null;
      critLines.push(fmtCriticalIssue(idx + 1, { title, plain, impact, evidence: null }));
      critLines.push('');
    });
    sections.push(critLines.join('\n').trim());
  }

  // ── 技术基建速览 ──
  const techLines = [];
  techLines.push(fmtSubHeader('技术基建'));
  techLines.push('');
  const tech = fetchPayload?.tech_stack;
  const cms = tech?.cms?.name || (typeof tech?.cms === 'string' ? tech.cms : null);
  const analytics = Array.isArray(tech?.analytics) ? tech.analytics.slice(0, 2).map((a) => a?.name || a).filter(Boolean).join(' · ') : null;
  const pixels = Array.isArray(tech?.pixels) ? tech.pixels.slice(0, 2).map((p) => p?.name || p).filter(Boolean).join(' · ') : null;
  techLines.push(fmtRow('CMS', cms ? fmtCode(cms) : null));
  techLines.push(fmtRow('Analytics', analytics ? fmtCode(analytics) : null));
  techLines.push(fmtRow('Marketing pixels', pixels));

  // sitemap
  const sm = fetchPayload?.sitemap_analysis;
  if (sm) {
    if (sm.has_sitemap === false) {
      techLines.push(fmtRow('Sitemap', '没找到 (standard paths 无 sitemap.xml)'));
    } else {
      techLines.push(fmtRow('Sitemap', sm.total_urls != null ? `${sm.total_urls} pages · ${sm.migration_complexity || PLACEHOLDER} migration` : null));
    }
  } else {
    techLines.push(fmtRow('Sitemap', null));
  }

  // speed
  const mob = fetchPayload?.pagespeed?.results?.mobile;
  const mobMetrics = mob?.lab_metrics;
  const mobScores = mob?.scores;
  if (mobMetrics || mobScores) {
    const parts = [];
    if (mobScores?.performance != null) parts.push(`perf ${mobScores.performance}/100`);
    if (mobMetrics?.lcp_ms != null) parts.push(`LCP ${(mobMetrics.lcp_ms / 1000).toFixed(1)}s`);
    if (mobMetrics?.fcp_ms != null) parts.push(`FCP ${(mobMetrics.fcp_ms / 1000).toFixed(1)}s`);
    if (mobMetrics?.cls != null) parts.push(`CLS ${mobMetrics.cls.toFixed(2)}`);
    techLines.push(fmtRow('速度 (mobile)', parts.join(' · ')));
  } else {
    techLines.push(fmtRow('速度 (mobile)', null));
  }
  sections.push(techLines.join('\n'));

  // ── 联系信息 ──
  const contactLines = [];
  contactLines.push(fmtSubHeader('联系信息'));
  contactLines.push('');
  contactLines.push(fmtRow('email', contact?.emails?.[0] || null));
  contactLines.push(fmtRow('phone', entity?.latest?.phone || null));
  const social = contact?.social_links || {};
  const socialEntries = Object.entries(social).filter(([, v]) => v);
  contactLines.push(fmtRow('social', socialEntries.length
    ? socialEntries.map(([k, v]) => fmtLink(k, v)).join(' · ')
    : null));
  sections.push(contactLines.join('\n'));

  return safeTruncate(joinSections(sections));
}

// ─────────────────────────────────────────────────────────
// Stage 4 · 视觉审计 (per-entity)
// ─────────────────────────────────────────────────────────
export function stage2Message({ visual, provider, model, latencyMs, costUsd }) {
  const parsed = visual?.parsedJson || {};
  const dur = latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : null;
  const sections = [];

  // Header + 三维打分
  const headerLines = [];
  headerLines.push(fmtStageHeader(4, [provider, dur].filter(Boolean).join(' · ') || null));
  headerLines.push('');
  headerLines.push('');
  headerLines.push(fmtSubHeader('三维打分'));
  headerLines.push('');
  headerLines.push(fmtRows([
    ['新鲜度', parsed.visual_freshness != null ? `${parsed.visual_freshness}/10` : null],
    ['信任度', parsed.visual_trust != null ? `${parsed.visual_trust}/10` : null],
    ['转化准备度', parsed.visual_conversion != null ? `${parsed.visual_conversion}/10` : null],
    ['设计年代', parsed.visual_age || null],
  ]));
  if (parsed.summary) {
    headerLines.push('');
    headerLines.push('');
    headerLines.push(fmtBlockquote(parsed.summary));
  }
  sections.push(headerLines.join('\n'));

  // Top 3 issues
  const issues = parsed.issues || [];
  if (issues.length > 0) {
    const top = issues.slice(0, 3);
    const issueLines = [`### 视觉痛点 · top ${top.length}`];
    issueLines.push('');
    top.forEach((i, idx) => {
      const title = i.title || i.id || `issue ${idx + 1}`;
      const plain = i.plain_language || i.rationale || null;
      const impact = i.recommendation || i.fix || null;
      issueLines.push(fmtCriticalIssue(idx + 1, {
        title, plain, impact,
        evidence: null, evidenceLabel: '修法',
      }));
      issueLines.push('');
    });
    sections.push(issueLines.join('\n').trim());
  }

  // Provider metadata
  const metaParts = [];
  if (provider) metaParts.push(`provider \`${provider}\``);
  if (model) metaParts.push(`model \`${model}\``);
  if (costUsd != null) metaParts.push(`~$${costUsd.toFixed(4)}`);
  if (metaParts.length) {
    sections.push(fmtSubtext(metaParts.join(' · ')));
  }

  return safeTruncate(joinSections(sections));
}

// ─────────────────────────────────────────────────────────
// Stage 5 · 打分定级 (per-entity)
// ─────────────────────────────────────────────────────────
export function stage3Message({ leadGrade, audit, entity }) {
  const grade = leadGrade?.investment_level || null;
  const tier = leadGrade?.product_tier || null;
  const sections = [];

  // Header
  const suffix = [grade, tier].filter(Boolean).join(' · ') || null;
  const headerLines = [];
  headerLines.push(fmtStageHeader(5, suffix));
  headerLines.push('');
  headerLines.push('');
  headerLines.push(fmtSubHeader('等级判定'));
  headerLines.push('');
  const pricing = leadGrade?.recommended_pricing?.one_time || (
    tier === 'T1' ? '$399 一次性 + 3 修' :
    tier === 'T2' ? '$399 + $299/年 maintenance' :
    tier === 'T3' ? 'custom · 月度 retainer' : null
  );
  headerLines.push(fmtRows([
    ['Grade', grade ? fmtCode(grade) : null],
    ['Tier', tier ? fmtCode(tier) : null],
    ['Pricing', pricing],
  ]));
  // 原因
  const factors = (leadGrade?.investment_factors || leadGrade?.factors || []).slice(0, 3);
  if (factors.length > 0) {
    headerLines.push(fmtRow('原因', factors.join(' · ')));
  } else if (leadGrade?.investment_reason) {
    headerLines.push(fmtRow('原因', leadGrade.investment_reason.slice(0, 200)));
  } else {
    headerLines.push(fmtRow('原因', null));
  }
  // skip reasons (D-grade)
  if (grade === 'D' && Array.isArray(leadGrade?.skip_reasons) && leadGrade.skip_reasons.length) {
    headerLines.push(fmtRow('skip 原因', leadGrade.skip_reasons.map((r) => r.id || r).join(' · ')));
  }
  sections.push(headerLines.join('\n'));

  // Phase + thread
  const phase = entity?.phase || (grade === 'D' ? 'archived' : 'audit-ready');
  const hasProjectThread = !!entity?.project_thread_id;
  const channelInfo = hasProjectThread
    ? '#website-projects 已开'
    : grade === 'D'
      ? '不开 thread (archived)'
      : '即将 open #website-leads (后续 publish 后自动 graduate)';
  sections.push([
    fmtSubHeader('Phase + Channel'),
    '',
    fmtRow('phase', phase),
    fmtRow('thread', channelInfo),
  ].join('\n'));

  // 下一步
  if (leadGrade?.next_action) {
    sections.push(['**下一步**', `- ${leadGrade.next_action.slice(0, 200)}`].join('\n'));
  }

  return safeTruncate(joinSections(sections));
}

// ─────────────────────────────────────────────────────────
// Stage 6 · 内部审计报告 (per-entity)
// ─────────────────────────────────────────────────────────
export function stage4Message({ entity, slug, htmlSize }) {
  const evidence = listEvidence(slug);
  const screenshots = listScreenshots(slug);
  const videos = listVideos(slug);
  const sections = [];

  // Header + 产物
  sections.push([
    fmtStageHeader(6, '本地生成'),
    '',
    '',
    fmtSubHeader('生成产物'),
    '',
    fmtRows([
      ['内部 audit HTML', htmlSize ? `${(htmlSize / 1024).toFixed(1)} KB · 本地` : '本地'],
      ['master.md', '本地'],
      ['截图', screenshots.length],
      ['录屏', videos.length],
      ['evidence PNG', evidence.length],
    ]),
  ].join('\n'));

  // 下一步
  sections.push([
    '**下一步**',
    '- 资格复核 · 通过后 chain build + publish',
    '',
    fmtSubtext('Stage 9 publish 后 · 本消息将自动 retro-edit 加入 live URL'),
  ].join('\n'));

  return joinSections(sections);
}

// ─────────────────────────────────────────────────────────
// Stage 7 · 资格复核 (per-entity)
// ─────────────────────────────────────────────────────────
export function stage5Message({ entity, verdict, crawl, briefResult }) {
  const sections = [];
  const sc = verdict?.scorecard || null;
  const dur = crawl?.duration_ms ? `${(crawl.duration_ms / 1000).toFixed(1)}s` : null;

  // Header + Verdict
  const verdictLine = verdict.verdict === 'ready-to-build'
    ? `**ready-to-build** · 总分 ${sc?.total ?? PLACEHOLDER}/${sc?.threshold ?? '60'} ✓`
    : verdict.verdict === 'qa-pending'
      ? `**qa-pending** · 总分 ${sc?.total ?? PLACEHOLDER}/${sc?.threshold ?? '60'} ✗`
      : `**archived** · ${verdict.archive_reason || PLACEHOLDER}`;

  const headerLines = [];
  headerLines.push(fmtStageHeader(7, dur));
  headerLines.push('');
  headerLines.push('');
  headerLines.push(fmtSubHeader('Verdict'));
  headerLines.push('');
  headerLines.push(`- 结论: ${verdictLine}`);
  if (verdict.verdict === 'ready-to-build') {
    headerLines.push('- 下一步: 自动 chain build + publish');
  } else if (verdict.verdict === 'qa-pending') {
    headerLines.push(`- 下一步: 看 scorecard 弱项 · 补字段 · 跑 \`npm run pl:check-qualification -- --entity-key ${entity.entityKey}\` 重评`);
  }
  sections.push(headerLines.join('\n'));

  // Hard Gates
  const allGates = verdict.hard_gates || [];
  if (allGates.length > 0) {
    const passed = allGates.filter((g) => g.passed);
    const failed = allGates.filter((g) => !g.passed);
    const gateLines = [fmtSubHeader('Hard Gates', `${passed.length}/${allGates.length} passed`)];
    gateLines.push('');
    for (const g of passed) gateLines.push(`- ✓ ${g.id}`);
    for (const g of failed) gateLines.push(`- ✗ ${g.id}: ${g.reason}`);
    sections.push(gateLines.join('\n'));
  }

  // Scorecard
  if (sc) {
    const scLines = [fmtSubHeader('Scorecard · 5 维')];
    scLines.push('');
    scLines.push(`- A · 核心信息: \`${sc.A_core_info.score}/${sc.A_core_info.max}\` · ${(sc.A_core_info.items || []).join(' · ')}`);
    scLines.push(`- B · 品牌素材: \`${sc.B_brand.score}/${sc.B_brand.max}\` · ${(sc.B_brand.items || []).join(' · ')}`);
    scLines.push(`- C · 范围可行: \`${sc.C_scope.score}/${sc.C_scope.max}\` · ${(sc.C_scope.items || []).join(' · ')}`);
    scLines.push(`- D · 技术风险: \`${sc.D_tech.score}/${sc.D_tech.max}\` · ${(sc.D_tech.items || []).join(' · ')}`);
    scLines.push(`- E · 解决性: \`${sc.E_solvability.score}/${sc.E_solvability.max}\` · ${(sc.E_solvability.items || []).join(' · ')}`);
    scLines.push('');
    scLines.push(`**总分: ${sc.total}/100** · 阈值 \`${sc.threshold}\``);
    sections.push(scLines.join('\n'));
  }

  // 数据采集
  if (crawl) {
    const dataLines = [fmtSubHeader('数据采集')];
    dataLines.push('');
    dataLines.push(fmtRows([
      ['Multi-page crawl', `${crawl.pages_crawled || 0} 页 · sitemap=${crawl.sitemap_source || PLACEHOLDER}`],
      ['Firecrawl / Direct', `${crawl.pages_via_firecrawl || 0} / ${crawl.pages_via_direct || 0}`],
      ['Crawl cost', `~$${(crawl.cost_estimate || 0).toFixed(3)}`],
      ['AI 分析', briefResult ? `${briefResult.provider} · ${((briefResult.duration_ms || 0) / 1000).toFixed(1)}s · ~$${briefResult.cost_estimate || 0}` : null],
    ]));
    sections.push(dataLines.join('\n'));
  }

  return safeTruncate(joinSections(sections));
}

// ─────────────────────────────────────────────────────────
// Stage 8 · 建 demo (per-entity)
// ─────────────────────────────────────────────────────────
export function stage6Message({ slug, indexHtmlPath, sizeBytes }) {
  const sections = [];
  sections.push([
    fmtStageHeader(8),
    '',
    '',
    fmtSubHeader('Build output'),
    '',
    fmtRows([
      ['Slug', slug ? fmtCode(slug) : null],
      ['index.html', indexHtmlPath || null],
      ['Size', sizeBytes ? `${(sizeBytes / 1024).toFixed(1)} KB` : null],
    ]),
  ].join('\n'));

  sections.push([
    '**下一步**',
    '- 自动触发 Stage 9 · 发布到 CF Pages',
    '',
    fmtSubtext('Stage 9 publish 后 · 本消息将自动 retro-edit 加入 live URL'),
  ].join('\n'));

  return joinSections(sections);
}

// ─────────────────────────────────────────────────────────
// Stage 9 · 发布上线 (per-entity)
// ─────────────────────────────────────────────────────────
export function stage7Message({ slug, deployUrl, deployedAt }) {
  const sections = [];
  sections.push([
    fmtStageHeader(9),
    '',
    '',
    fmtSubHeader('Demo live'),
    '',
    fmtRows([
      ['URL', deployUrl ? fmtLink(deployUrl, deployUrl) : null],
      ['发布于', deployedAt ? String(deployedAt).slice(0, 10) : null],
    ]),
  ].join('\n'));

  if (deployUrl) {
    sections.push([
      fmtSubHeader('完整交付包'),
      '',
      `- demo (主推): ${fmtLink(deployUrl, deployUrl)}`,
      `- 客户面 audit (English): ${fmtLink('customer-facing-audit.html', `${deployUrl}/customer-facing-audit.html`)}`,
      `- 内部 audit (中文): ${fmtLink('internal-audit-report.html', `${deployUrl}/internal-audit-report.html`)}`,
      `- master.md: ${fmtLink('master.md', `${deployUrl}/master.md`)}`,
      `- master.report: ${fmtLink('master.report.html', `${deployUrl}/master.report.html`)}`,
    ].join('\n'));
  }

  sections.push([
    '**下一步**',
    '- 自动 graduate 到 #website-projects · 旧 #website-leads thread archive',
    '- entity phase → `outreach-active`',
  ].join('\n'));

  return joinSections(sections);
}

// ─────────────────────────────────────────────────────────
// Stage failure (any stage)
// ─────────────────────────────────────────────────────────
export function stageFailMessage({ stage, reason, retryHint }) {
  const lines = [];
  lines.push(fmtStageHeader(stage, '失败'));
  lines.push('');
  lines.push('');
  lines.push(fmtRow('reason', reason));
  lines.push(fmtRow('retry', retryHint || null));
  lines.push('');
  lines.push('');
  lines.push(fmtBlockquote('audit 终止'));
  return lines.join('\n');
}
