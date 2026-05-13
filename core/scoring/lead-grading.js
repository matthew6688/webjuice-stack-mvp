/**
 * Lead grading — turns the rich audit data into two independent decisions:
 *
 *   1. Investment Level (A/B/C/D)  — how much OUR effort the lead deserves
 *   2. Product Tier (T1/T2/T3)     — what to sell them when we engage
 *
 * Pipeline order: investment level first (decides whether to engage at all);
 * product tier only meaningful for A and B leads.
 *
 * Inputs: the full set of fixtures from one lead (entity + detailed_audit +
 * tech_stack + sitemap_analysis + activity + ai_geo + domain_history +
 * review bundle).
 *
 * Output:
 *   {
 *     investment_level: 'A' | 'B' | 'C' | 'D',
 *     investment_reason: '...',
 *     investment_factors: [...],          // signals that drove the decision
 *     product_tier: 'T1' | 'T2' | 'T3' | null,
 *     product_tier_reason: '...',
 *     product_tier_factors: [...],
 *     recommended_pricing: { one_time: '...', monthly: null|'...' },
 *     next_action: '...',                  // concrete next step for operator
 *     skip_reasons: [...],                 // populated for D
 *   }
 */

// ─── Investment Level rules (cascade — first match wins) ─────────────────

const HARD_SKIP_RULES = [
  {
    id: 'niche_mismatch',
    test: (ctx) => (ctx.detailedAudit?.hard_triggers || []).includes('niche_mismatch')
      || (ctx.cheapAudit?.fired_triggers || []).includes('niche_mismatch'),
    reason: '行业不匹配 — 这个 lead 不属于我们目标 niche',
  },
  {
    id: 'recent_redesign',
    test: (ctx) => Boolean(ctx.domainHistory?.recent_redesign_signal),
    reason: '近 12 个月内 Wayback 显示客户刚 redesign 过 — 短期不会再投资重做',
  },
  {
    id: 'enterprise_size',
    test: (ctx) => ctx.businessSizeSignal?.tier === 'enterprise',
    reason: '业务规模过大（enterprise tier）— 不符合我们 small / batch / 快上的产品定位',
  },
  {
    id: 'too_many_pages',
    test: (ctx) => (ctx.sitemapAnalysis?.total_urls || 0) > 200,
    reason: '现有网站超过 200 页 — 迁移成本失控',
  },
  {
    id: 'too_many_categories',
    test: (ctx) => (ctx.entity?.latest?.categories?.length || 0) >= 5,
    reason: 'GBP 多元业务分类 ≥ 5 个 — 需求复杂度超出标准产品包',
  },
  {
    id: 'relevance_fail',
    test: (ctx) => ctx.cheapAudit?.relevance_pass === false,
    reason: 'GBP 类目与搜索 niche 不匹配',
  },
  {
    id: 'fully_managed',
    test: (ctx) => {
      const activeBlog = ctx.activity?.days_since_newest_blog != null && ctx.activity.days_since_newest_blog <= 30;
      const activeSocials = Object.keys(ctx.activity?.social_links || {}).length >= 3;
      const hasAds = Boolean(ctx.techStack?.has_paid_ads_evidence);
      const hasAnalytics = Boolean(ctx.techStack?.has_measurement);
      const matureScore = (ctx.techStack?.sophistication_score || 0) >= 4;
      return activeBlog && activeSocials && hasAds && hasAnalytics && matureScore;
    },
    reason: '客户已经在自己 / 通过 agency 全面运营（活跃 blog + 多社交 + 投广告 + 装分析）— 不会再签外包',
  },
  {
    id: 'not_qualified_decision',
    test: (ctx) => ctx.detailedAudit?.decision === 'not_qualified',
    reason: 'detailed_audit 决策为 not_qualified',
  },
];

function isHardSkip(ctx) {
  const fired = [];
  for (const rule of HARD_SKIP_RULES) {
    if (rule.test(ctx)) fired.push({ id: rule.id, reason: rule.reason });
  }
  return fired;
}

// ─── Investment level for non-skipped leads ──────────────────────────────

function classifyInvestment(ctx) {
  const decision = ctx.detailedAudit?.decision;
  const reviewCount = Number(ctx.entity?.latest?.review_count || 0);
  const rating = Number(ctx.entity?.latest?.rating || 0);
  const sophistication = ctx.techStack?.sophistication_score || 0;
  const auditScore = Number(ctx.detailedAudit?.audit_score || 0);
  const trustStrong = ctx.reviewAnalysis?.trust_signal_strength === 'strong';

  const factors = [];

  // ── A 全攻 ──
  // strong_redesign + 中型规模 + 一定口碑底子 + 不是全管型客户
  if (decision === 'strong_redesign') {
    if (reviewCount >= 30 && rating >= 3.5) {
      factors.push(`strong_redesign + ${reviewCount} 评论 + ${rating}★`);
      if (sophistication >= 3) factors.push(`数字成熟度 ${sophistication}/6（懂数字营销）`);
      if (trustStrong) factors.push('评论 trust signal 强');
      return { level: 'A', factors };
    }
    // strong_redesign 但口碑底子薄 → 降为 B 预览试探
    factors.push(`strong_redesign 但口碑底子薄（${reviewCount} 评论）`);
    return { level: 'B', factors };
  }

  // ── starter_candidate （no_website or third_party）──
  // 都没正经网站 = 强切入点，但客户成熟度未知，进 B 档先试探
  if (decision === 'starter_candidate' || ctx.cheapAudit?.action === 'starter_candidate') {
    factors.push('现状无独立网站（no_website 或 third_party_landing_page）');
    if (reviewCount >= 30) {
      factors.push(`${reviewCount} 评论 = 有客户基础`);
      return { level: 'B', factors };
    }
    factors.push('口碑数据薄');
    return { level: 'C', factors };
  }

  // ── moderate_candidate ──
  if (decision === 'moderate_candidate') {
    if (reviewCount >= 30 && auditScore < 75) {
      factors.push(`moderate_candidate + ${reviewCount} 评论 + audit ${auditScore}（仍有改进空间）`);
      return { level: 'B', factors };
    }
    factors.push(`moderate_candidate 但口碑/差距不明显`);
    return { level: 'C', factors };
  }

  // ── low_priority ──
  if (decision === 'low_priority') {
    factors.push(`low_priority audit decision (score ${auditScore})`);
    return { level: 'C', factors };
  }

  // Default fallback · audit 还没跑 / decision 为空时
  if (decision == null || decision === '' || decision === 'undefined') {
    factors.push('audit 未运行 · 默认 C 等待 audit 后重新分级');
  } else {
    factors.push(`未明确决策类型: ${decision}`);
  }
  return { level: 'C', factors };
}

// ─── Product Tier rules ──────────────────────────────────────────────────

function recommendProductTier(ctx) {
  const latest = ctx.entity?.latest || {};
  const reviewCount = Number(latest.review_count || 0);
  const rating = Number(latest.rating || 0);
  const websiteStatus = latest.websiteStatus || '';
  const categoriesN = (latest.categories || []).length;
  const sitemapPages = ctx.sitemapAnalysis?.total_urls || 0;
  const sophistication = ctx.techStack?.sophistication_score || 0;
  const hasAds = Boolean(ctx.techStack?.has_paid_ads_evidence);
  const trustStrong = ctx.reviewAnalysis?.trust_signal_strength === 'strong';
  const blogPresent = Boolean(ctx.activity?.blog_section_present);

  const factors = [];

  // ── T3 candidate: strong口碑底子 + 数字成熟度 + 月度运营机会 ──
  const t3Signals =
    (reviewCount >= 100 && rating >= 4.3 ? 1 : 0) +
    (hasAds || sophistication >= 4 ? 1 : 0) +
    (trustStrong ? 1 : 0) +
    (!blogPresent || ctx.activity?.days_since_newest_blog > 180 ? 1 : 0);

  if (t3Signals >= 3) {
    if (reviewCount >= 100 && rating >= 4.3) factors.push(`${reviewCount}★${rating} 强口碑底子`);
    if (hasAds) factors.push('已投放过广告（懂月度预算）');
    if (sophistication >= 4) factors.push(`数字成熟度 ${sophistication}/6`);
    if (trustStrong) factors.push('评论 trust strong');
    if (!blogPresent) factors.push('Blog 缺失（月度内容包机会）');
    else if (ctx.activity?.days_since_newest_blog > 180) factors.push(`Blog 停滞 ${ctx.activity.days_since_newest_blog} 天（重启月度内容包机会）`);
    return {
      tier: 'T3',
      tier_label: '多页 / 定制（quote separately）',
      factors,
      // V2 pricing (locked 2026-05-11 per SCALING_AND_PRICING.md +
      // profitslocal.com live): T3 is custom — no fixed productized price.
      // Quoted separately. Anchor "$1000+" from homepage FAQ.
      pricing: { one_time: '$1000+ 定制报价', monthly: null, annual: null, note: 'Multi-page / custom build — quote separately. Profitslocal.com FAQ anchor.' },
    };
  }

  // ── T1 倾向：业务简单 / 没真网站 / 单分类 ──
  const t1Signals =
    (reviewCount < 30 ? 1 : 0) +
    (websiteStatus === 'no_website' || websiteStatus === 'third_party_landing_page' ? 1 : 0) +
    (sitemapPages > 0 && sitemapPages < 15 ? 1 : 0) +
    (categoriesN === 1 ? 1 : 0) +
    (sophistication < 2 ? 1 : 0);

  if (t1Signals >= 3) {
    if (reviewCount < 30) factors.push(`评论少（${reviewCount} 条 → 业务简单或起步阶段）`);
    if (websiteStatus === 'no_website') factors.push('当前无独立网站');
    if (websiteStatus === 'third_party_landing_page') factors.push('当前用第三方平台 → 单页足以替代');
    if (sitemapPages > 0 && sitemapPages < 15) factors.push(`现有网站只有 ${sitemapPages} 页`);
    if (categoriesN === 1) factors.push('GBP 只 1 个业务分类');
    if (sophistication < 2) factors.push('数字成熟度低 → 简单为好');
    return {
      tier: 'T1',
      tier_label: '1-page (build-and-launch)',
      factors,
      // V2 productized pricing (profitslocal.com live + SCALING_AND_PRICING.md
      // locked 2026-05-11). T1 = $399 一次性 含 hosting 永久 + 3 次 revision.
      pricing: { one_time: '$399', monthly: null, annual: null, note: '1-page · 3 revisions · hosting included permanently' },
    };
  }

  // ── T2 默认 ──
  // V2 architecture: T2 is the same 1-page site as T1 but with annual maintenance
  // ($799/yr = monthly revisions + local SEO cleanup + maintenance). 触发信号是
  // 客户有"持续关系"appetite — 中等口碑 / 多业务分类 / sitemap 15+ / 数字成熟度中等。
  factors.push(`中等口碑 / 多业务分类 / 想要月度维护关系 — T2 annual maintenance 合适`);
  if (reviewCount >= 30 && reviewCount < 100) factors.push(`${reviewCount} 评论 = 中等规模运营`);
  if (sitemapPages >= 15) factors.push(`现有 ${sitemapPages} 页内容 → 客户预期 ongoing 内容更新`);
  if (categoriesN >= 2) factors.push(`${categoriesN} 个业务分类 = 多服务线 → 维护包合适`);
  return {
    tier: 'T2',
    tier_label: '1-page + annual maintenance',
    factors,
    pricing: { one_time: null, annual: '$799/年', monthly: null, note: '1-page · 12 revisions/yr · monthly maintenance · local SEO cleanup' },
  };
}

// ─── Concrete next action per level ──────────────────────────────────────

function nextActionFor(level, tier) {
  switch (level) {
    case 'A': return `跑完整 Open Design redesign brief + 个性化 cold email（突出 audit 中最强论据）+ 报告/视频外发 + 3 次跟进。报价主推 ${tier?.tier_label || '推荐档位'}。`;
    case 'B': return `用 ChatGPT Image / Gemini Imagen 生成 hero mockup 预览图 + master.md PDF + 1 封 personalized 邮件试探 + 1 次跟进。回应后升级到 A 档处理。`;
    case 'C': return `标准模板邮件 + master.md PDF 链接，无主动跟进。等客户回复触发后再投入。`;
    case 'D': return `不投入精力，归档原因。';`;
    default: return '未定义';
  }
}

// ─── Main entry ──────────────────────────────────────────────────────────

export function gradeLead(ctx = {}) {
  const skipReasons = isHardSkip(ctx);
  if (skipReasons.length) {
    return {
      investment_level: 'D',
      investment_reason: skipReasons.map((r) => r.reason).join('; '),
      investment_factors: skipReasons.map((r) => `[hard skip · ${r.id}] ${r.reason}`),
      product_tier: null,
      product_tier_reason: null,
      product_tier_factors: [],
      recommended_pricing: null,
      next_action: nextActionFor('D'),
      skip_reasons: skipReasons,
    };
  }

  const inv = classifyInvestment(ctx);
  let tier = null;
  if (inv.level === 'A' || inv.level === 'B') {
    tier = recommendProductTier(ctx);
  }
  return {
    investment_level: inv.level,
    investment_reason: inv.factors.join('; '),
    investment_factors: inv.factors,
    product_tier: tier?.tier || null,
    product_tier_label: tier?.tier_label || null,
    product_tier_reason: tier?.factors?.join('; ') || null,
    product_tier_factors: tier?.factors || [],
    recommended_pricing: tier?.pricing || null,
    next_action: nextActionFor(inv.level, tier),
    skip_reasons: [],
  };
}

// ─── Surfaced for admin /admin/scoring/lead-grading page ─────────────────

// ─── Side-effect: persist grade to entity ─────────────────────────────────
// Called by the pipeline after a lead is graded. Writes the grade to the
// entity file and triggers the right status transition:
//   - grade=D → status='skipped' (auto-archive, no manual review)
//   - grade=A/B/C → status='graded' (ready for sales pipeline)

import { updateDiscoveryEntityStatus, defaultDiscoveryStoreRoot, setEntityPhase, ENTITY_PHASE } from '../leads/discovery-store.js';
import fs from 'fs';
import path from 'path';

export function persistLeadGrade({
  entityKey,
  grade,
  storeRoot = defaultDiscoveryStoreRoot(),
} = {}) {
  if (!entityKey) return { ok: false, reason: 'entityKey required' };
  if (!grade) return { ok: false, reason: 'grade required' };

  const entityPath = path.join(storeRoot, 'entities', `${entityKey}.json`);
  if (!fs.existsSync(entityPath)) return { ok: false, reason: 'entity not found' };

  const entity = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
  entity.grade = {
    investment_level: grade.investment_level,
    product_tier: grade.product_tier,
    recommended_pricing: grade.recommended_pricing,
    skip_reasons: grade.skip_reasons,
    graded_at: new Date().toISOString(),
  };
  fs.writeFileSync(entityPath, JSON.stringify(entity, null, 2) + '\n');

  // Trigger status transition: D → archived (skipped), A/B/C → graded
  const isD = grade.investment_level === 'D';
  const note = isD
    ? `Auto-archived: ${(grade.skip_reasons || []).map((r) => r.id).join(', ') || grade.investment_reason || 'D-grade hard skip'}`
    : `Graded ${grade.investment_level} / ${grade.product_tier || '-'}`;

  const statusResult = updateDiscoveryEntityStatus({
    entityKey,
    status: isD ? 'skipped' : 'graded',
    note,
    storeRoot,
  });

  // V2 phase hook — DISCORD_OUTREACH_PRD.md §9 + Block 4.4
  // D → archived (auto). A/B → awaiting (waits for first outreach).
  // C → no phase set (batch outreach handled separately, not via lead thread).
  let phaseResult = null;
  if (isD) {
    phaseResult = setEntityPhase({
      entityKey,
      phase: ENTITY_PHASE.ARCHIVED,
      archive_reason: (grade.skip_reasons || []).map((r) => r.id).join(',') || 'd_grade',
      storeRoot,
      note,
    });
  } else if (grade.investment_level === 'A' || grade.investment_level === 'B') {
    phaseResult = setEntityPhase({
      entityKey,
      phase: ENTITY_PHASE.AWAITING,
      storeRoot,
      note,
    });
  }

  // Async Discord thread open — fire-and-forget. Errors surface in lead-thread
  // log, but never block the grading pipeline. Skip in test/dry contexts via
  // SKIP_LEAD_THREAD_OPEN=true (used by unit tests that don't want network).
  if ((grade.investment_level === 'A' || grade.investment_level === 'B')
      && !process.env.SKIP_LEAD_THREAD_OPEN) {
    // Lazy-import to avoid circular dep with lead-thread-sync → profile-card → manifest
    import('../funnel/lead-thread-sync.js').then(async ({ openLeadThread }) => {
      try {
        const result = await openLeadThread(entityKey);
        if (!result.ok) console.warn(`[persistLeadGrade] openLeadThread failed: ${result.reason}`);
      } catch (err) {
        console.warn(`[persistLeadGrade] openLeadThread threw: ${err.message}`);
      }
    }).catch((err) => console.warn(`[persistLeadGrade] lead-thread-sync import failed: ${err.message}`));
  }

  return { ...statusResult, phaseResult };
}

export const HARD_SKIP_DEFINITIONS = HARD_SKIP_RULES.map((r) => ({ id: r.id, reason: r.reason }));

export const INVESTMENT_LEVEL_TABLE = [
  { level: 'A', label: '全攻', criteria: 'strong_redesign + reviews ≥ 30 + rating ≥ 3.5 + 非全管型', action: '完整 OD redesign + 个性化邮件 + 报告 + 3 次跟进' },
  { level: 'B', label: '预览试探', criteria: 'moderate_candidate + reviews ≥ 30 + audit < 75, 或 strong_redesign 但口碑薄, 或 starter_candidate 有口碑', action: 'ChatGPT Image 生成 hero 预览 + 1 封 personalized 邮件 + 1 次跟进' },
  { level: 'C', label: '批量轻触', criteria: 'low_priority, 或 moderate 但信号弱, 或 starter 无口碑', action: '标准模板邮件 + master.md PDF 链接，无跟进' },
  { level: 'D', label: '跳过', criteria: '命中任一 hard skip 条件', action: '不投入' },
];

// V2 productized pricing (2026-05-11 locked; see docs/v2/SCALING_AND_PRICING.md).
// Matches profitslocal.com homepage live pricing.
// T1 / T2 are the SAME 1-page deliverable — they differ on maintenance.
// T3 is bespoke (multi-page or custom) — no productized price; quoted.
export const PRODUCT_TIER_TABLE = [
  {
    tier: 'T1',
    label: '1-page (build-and-launch)',
    signals: '评论 < 30 / 无独立网站 / sitemap < 15 / 单业务分类 / 数字成熟度 < 2',
    pricing: '$399 一次性',
    includes: '1-page · 3 revisions · hosting permanently · subdomain or custom domain (CNAME)',
  },
  {
    tier: 'T2',
    label: '1-page + annual maintenance',
    signals: '中等口碑 30-150 / 多业务分类 / 数字成熟度中等 / 看到 ongoing 关系 appetite',
    pricing: '$799/年',
    includes: '1-page · 12 revisions/yr · monthly maintenance · local SEO cleanup · domain setup',
  },
  {
    tier: 'T3',
    label: '多页 / 定制 (quote separately)',
    signals: '强口碑 ≥ 100 ★ ≥ 4.3 + 投过广告 / GA4 / 数字成熟度 ≥ 4 + Blog 缺失或停滞 + 复杂业务',
    pricing: '$1000+ 定制报价',
    includes: 'Multi-page · custom build · 单独报价（profitslocal.com FAQ anchor）',
  },
];

// Add-on (across all tiers)
export const ADDON_TABLE = [
  { id: 'extra_revision', label: 'Extra revision', pricing: '$100 / revision', applies_to: 'T1 (after 3) · T2 (after 12/yr)' },
  { id: 'sender_domain_email', label: 'Custom sender domain email setup', pricing: '$150 一次性', applies_to: 'Any tier' },
];
