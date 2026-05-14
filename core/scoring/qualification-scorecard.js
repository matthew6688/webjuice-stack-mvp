/**
 * V3 D39 (2026-05-14) · Qualification Scorecard · M2 → M3 gate
 *
 * Per SOP-READY-TO-BUILD.md:
 *   - 7 Hard Gates (任一不过 → archive)
 *   - 5 维 Scorecard 100 分 (A 30 · B 15 · C 25 · D 15 · E 15 · F 0 砍)
 *   - threshold 60 (per Matthew)
 *   - 全过 + score ≥ 60 → ready-to-build
 *   - 全过 + score < 60 → qa-pending (operator review)
 *   - 任一 gate 不过 → archived
 *
 * Inputs:
 *   - entity (latest fields · social_links · address · phone · email · etc.)
 *   - audit (detailed_audit · visual · sitemap · tech_stack)
 *   - brief (redesign brief from AI 分析)
 */

/* ──────────────────────────────────────────────────────────────────
 * HARD GATES · 任一 fail → archived (per Matthew · 砍 2 from 9)
 * ──────────────────────────────────────────────────────────────── */

const HARD_GATES = [
  {
    id: 'too_many_pages',
    test: (ctx) => (ctx.sitemap?.total_urls || 0) > 50,
    reason: '页面 > 50 · 迁移成本失控',
  },
  {
    id: 'multi_business',
    test: (ctx) => (ctx.entity?.latest?.categories || []).length >= 4
      || (ctx.brief?.qualification_flags?.scope_pages_estimate || 0) >= 5
        && (ctx.brief?.core_info?.service_list || []).length >= 8,
    reason: '多业务复杂 (GBP ≥ 4 类目 OR 跨 niche 服务页 ≥ 5)',
  },
  {
    id: 'ecommerce',
    test: (ctx) => {
      const techCms = ctx.audit?.tech_stack?.cms?.name?.toLowerCase() || '';
      if (/shopify|woocommerce|magento|bigcommerce/.test(techCms)) return true;
      return !!ctx.brief?.qualification_flags?.ecommerce_detected;
    },
    reason: '现网是 e-commerce (Shopify/WooCommerce/Magento) · 不在 V3 产品包',
  },
  {
    id: 'member_portal',
    test: (ctx) => !!ctx.brief?.qualification_flags?.member_portal_detected,
    reason: '现网含会员/portal (login/account/dashboard) · 不在产品包',
  },
  {
    id: 'active_blog_heavy',
    test: (ctx) => {
      const blogActive = ctx.brief?.qualification_flags?.blog_active;
      const blogPosts = ctx.sitemap?.urls_by_pattern?.blog_post || 0;
      return blogActive && blogPosts > 50;
    },
    reason: '活跃 blog > 50 posts · 我们不迁内容',
  },
  {
    id: 'third_party_booking',
    test: (ctx) => {
      const html = (ctx.audit?.fetch_summary?.url || '') + ' ' + JSON.stringify(ctx.audit?.tech_stack || {});
      return /mindbody|calendly|acuity|square|booker|tidycal/i.test(html);
    },
    reason: '现网内嵌 booking (Mindbody/Calendly/Square 等) · 客户深度依赖 · 重建破坏',
  },
  {
    id: 'too_many_pixels',
    test: (ctx) => (ctx.audit?.tech_stack?.pixels || []).length >= 5,
    reason: '第三方 pixel ≥ 5 · 客户重投广告归因 · 重建破坏 attribution',
  },
];

/* ──────────────────────────────────────────────────────────────────
 * SCORECARD · 5 维 100 分 (per Matthew · F 砍)
 * ──────────────────────────────────────────────────────────────── */

function scoreA_CoreInfo(ctx) {
  const latest = ctx.entity?.latest || {};
  const core = ctx.brief?.core_info || {};
  let score = 0;
  const items = [];
  if (latest.name || core.business_name) { score += 4; items.push('name'); }
  if (latest.phone || (core.phone && core.phone.length)) { score += 5; items.push('phone'); }
  if (latest.email || core.email) { score += 5; items.push('email'); }
  if (latest.address || core.address) { score += 4; items.push('address'); }
  if ((latest.places_enrichment?.opening_hours_verified?.weekday_text || []).length >= 5) { score += 3; items.push('hours'); }
  if ((core.service_list || []).length >= 1) { score += 3; items.push('services'); }
  if (core.license_numbers?.length) { score += 3; items.push('licenses'); }
  if (core.founded_year) { score += 3; items.push('founded'); }
  return { score, max: 30, items };
}

function scoreB_Brand(ctx) {
  const brand = ctx.brief?.brand_assets || {};
  const flags = ctx.brief?.qualification_flags || {};
  let score = 0;
  const items = [];
  // Logo: 有 OR 可创建 (D39 不强制)
  if (brand.logo_url || flags.logo_quality === 'have-svg' || flags.logo_quality === 'have-png-high') { score += 3; items.push('logo'); }
  else { items.push('logo-via-create-logo-skill'); }
  if (brand.primary_color) { score += 3; items.push('color'); }
  if (brand.font_family) { score += 1; items.push('font'); }
  const photosCount = (ctx.entity?.latest?.places_enrichment?.photo_references || []).length;
  if (photosCount >= 3) { score += 4; items.push(`photos-${photosCount}`); }
  const reviewsTotal = ctx.entity?.latest?.review_count || 0;
  if (reviewsTotal >= 3) { score += 2; items.push(`${reviewsTotal}-reviews`); }
  if (brand.voice_tone) { score += 2; items.push('voice'); }
  return { score, max: 15, items };
}

function scoreC_Scope(ctx) {
  const flags = ctx.brief?.qualification_flags || {};
  const sitemap = ctx.audit?.sitemap_analysis || {};
  let score = 0;
  const items = [];
  const pages = sitemap.total_urls || flags.scope_pages_estimate || 5;
  if (pages <= 10) { score += 8; items.push(`${pages} pages OK`); }
  if (!flags.booking_required) { score += 5; items.push('no-booking'); }
  if (!flags.multilingual_required) { score += 3; items.push('single-lang'); }
  if (flags.complexity !== 'complex') { score += 4; items.push(`complexity-${flags.complexity || 'unknown'}`); }
  const forms = (ctx.audit?.form_audit?.forms || []);
  const simpleForm = forms.every((f) => (f.field_count || 0) <= 5);
  if (simpleForm) { score += 3; items.push('simple-forms'); }
  // 砍掉 layout 重度 (vision)
  if (flags.complexity !== 'complex') { score += 2; items.push('no-heavy-layout'); }
  return { score, max: 25, items };
}

function scoreD_Tech(ctx) {
  const sitemap = ctx.audit?.sitemap_analysis || {};
  const tech = ctx.audit?.tech_stack || {};
  let score = 0;
  const items = [];
  if (sitemap.has_sitemap !== false) { score += 4; items.push('sitemap-ok'); }
  // SEO impact: low traffic ≈ low risk · 暂取 pagespeed 低分推断
  const psScore = ctx.audit?.pagespeed?.results?.mobile?.scores?.performance || 0;
  if (psScore < 60) { score += 4; items.push('low-seo-risk'); }
  const url = ctx.entity?.latest?.website || '';
  if (url.startsWith('https://')) { score += 3; items.push('https'); }
  const pixelsCount = (tech.pixels || []).length;
  if (pixelsCount <= 3) { score += 4; items.push(`${pixelsCount}-pixels`); }
  else if (pixelsCount === 4) { score += 2; items.push('4-pixels-borderline'); }
  return { score, max: 15, items };
}

function scoreE_Solvability(ctx) {
  // 改 per Matthew · 所有 audit issues 中 design/UX 类占比 ≥ 70%
  const issuesObj = ctx.audit?.detailed_audit?.issues || {};
  const allIssues = [
    ...(issuesObj.critical || []),
    ...(issuesObj.major || []),
    ...(issuesObj.minor || []),
  ];
  const designUxIssues = allIssues.filter((i) => {
    const id = (i.id || '').toLowerCase();
    return /form|cta|hero|layout|typography|color|design|visual|conversion|trust|mobile|navigation/.test(id);
  });

  let score = 0;
  const items = [];
  if (allIssues.length > 0) {
    const designRatio = designUxIssues.length / allIssues.length;
    if (designRatio >= 0.7) { score += 7; items.push(`${(designRatio*100).toFixed(0)}% design/ux`); }
    else if (designRatio >= 0.5) { score += 4; items.push(`${(designRatio*100).toFixed(0)}% design/ux (mid)`); }
    else { items.push(`only ${(designRatio*100).toFixed(0)}% design/ux`); }
  }
  // Top 3 都是 design/UX
  const top3 = allIssues.slice(0, 3);
  if (top3.every((i) => /form|cta|hero|layout|typography|visual|mobile|trust/i.test(i.id || ''))) {
    score += 3;
    items.push('top-3-all-design');
  }
  // 没基础设施致命 issue
  const hasInfraIssue = allIssues.some((i) => /server|database|broken|expired|404|500/i.test(i.id || ''));
  if (!hasInfraIssue) { score += 3; items.push('no-infra-issues'); }
  // visual_freshness < 5 是主因
  const fresh = ctx.audit?.visualFixture?.parsedJson?.visual_freshness;
  if (fresh != null && fresh < 5) { score += 2; items.push(`visual-fresh-${fresh}-low`); }
  return { score, max: 15, items };
}

/* ──────────────────────────────────────────────────────────────────
 * Main entry
 * ──────────────────────────────────────────────────────────────── */

/**
 * Compute qualification verdict for an entity.
 *
 * @param {object} ctx · { entity, audit (detailedFixture), brief (redesign-brief), sitemap }
 * @returns {{
 *   hard_gates: { id, passed, reason }[],
 *   gates_passed: boolean,
 *   scorecard: { A, B, C, D, E, total, threshold },
 *   verdict: 'ready-to-build' | 'qa-pending' | 'archived',
 *   archive_reason?: string,
 * }}
 */
export function qualifyEntity(ctx) {
  // 1. Hard gates
  const hardGateResults = HARD_GATES.map((g) => ({
    id: g.id,
    passed: !g.test(ctx),
    reason: g.reason,
  }));
  const failedGate = hardGateResults.find((r) => !r.passed);
  if (failedGate) {
    return {
      hard_gates: hardGateResults,
      gates_passed: false,
      scorecard: null,
      verdict: 'archived',
      archive_reason: `gate_${failedGate.id}: ${failedGate.reason}`,
    };
  }

  // 2. Scorecard 5 dimensions
  const A = scoreA_CoreInfo(ctx);
  const B = scoreB_Brand(ctx);
  const C = scoreC_Scope(ctx);
  const D = scoreD_Tech(ctx);
  const E = scoreE_Solvability(ctx);
  const total = A.score + B.score + C.score + D.score + E.score;

  const THRESHOLD = 60;
  const verdict = total >= THRESHOLD ? 'ready-to-build' : 'qa-pending';

  return {
    hard_gates: hardGateResults,
    gates_passed: true,
    scorecard: {
      A_core_info:    A,
      B_brand:        B,
      C_scope:        C,
      D_tech:         D,
      E_solvability:  E,
      total,
      threshold: THRESHOLD,
    },
    verdict,
  };
}
