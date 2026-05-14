/**
 * core/leads/predict-grade.js · V3 D43 (2026-05-14)
 *
 * Per Matthew Q2 (2026-05-14):
 *   "AB audit 还有这么多? 那么我们就搜索我们的 AB 类客户的评定标准"
 *
 * 现在 detailedAudit (5-8 min/entity · Playwright + vision LLM) 每 entity 都跑
 * · 3500 query × ~10 商家 = 35K entities × 5 min = 2900 hours · 不现实。
 *
 * 用 cheap-audit + GBP 信号 **预判** grade · 只 audit 预判 A/B 的:
 *   predict-A · review_count ≥ 100 + rating ≥ 4.3 + has_website + niche-relevant
 *               · cheap.action ∈ {audit_candidate · starter_candidate}
 *   predict-B · review_count ≥ 30 + rating ≥ 4.0 + niche-relevant
 *               · cheap.action ∈ {audit_candidate · starter_candidate}
 *   predict-C · niche-relevant 但 reviews/rating 不够
 *   predict-D · cheap.action=skip (niche_mismatch) 或 hard-trigger 命中
 *
 * 预判后:
 *   A · 高优先 · 立刻 enqueue detailedAudit
 *   B · 中优先 · 排队 detailedAudit (overnight batch)
 *   C · 不立刻 audit · 进 cold-outreach-queue · 等销售触发或 M4 客户回复
 *   D · setEntityPhase('archived') · 不 audit
 *
 * 节省: ~70-90% 的 detailedAudit cost · 3500 query 7 月跑 → 1-2 周跑完
 */

const A_REVIEWS_MIN = 100;
const A_RATING_MIN = 4.3;
const B_REVIEWS_MIN = 30;
const B_RATING_MIN = 4.0;

/**
 * Predict A/B/C/D grade from cheap-audit + entity GBP signals · no detailedAudit needed.
 *
 * @param {object} input
 * @param {object} input.entity · entity (含 latest.review_count · rating · websiteStatus · etc)
 * @param {object} input.cheapAudit · cheap-audit-v2 result (含 action · gbp_quality · final_score · relevance_pass)
 * @returns {{
 *   predict_grade: 'A'|'B'|'C'|'D',
 *   priority: number (0-100 · 高=先 audit),
 *   audit_now: boolean (是否立刻 chain detailedAudit),
 *   reasons: string[],
 * }}
 */
export function predictGradePreaudit({ entity, cheapAudit }) {
  const reasons = [];
  const rc = Number(entity?.latest?.review_count || 0);
  const rating = Number(entity?.latest?.rating || 0);
  const ws = entity?.latest?.websiteStatus || '';
  const hasWebsite = /^independent_(http|https)_site$/.test(ws);
  const action = cheapAudit?.action || '';
  const gbpQ = cheapAudit?.gbp_quality || 0;

  // ── D: cheap-audit 已 skip 或 hard-trigger
  if (action === 'skip') {
    reasons.push(`cheap-audit skip · ${cheapAudit?.reason || 'no reason'}`);
    return { predict_grade: 'D', priority: 0, audit_now: false, reasons };
  }
  if (cheapAudit?.fired_triggers?.includes('niche_mismatch')) {
    reasons.push('niche_mismatch trigger');
    return { predict_grade: 'D', priority: 0, audit_now: false, reasons };
  }
  if (cheapAudit?.relevance_pass === false) {
    reasons.push('relevance_pass=false');
    return { predict_grade: 'D', priority: 0, audit_now: false, reasons };
  }

  // ── queued_for_enrichment: 不够数据预判 · 留待 enrichment 后重判
  if (action === 'queued_for_enrichment') {
    reasons.push('待 enrichment 补 phone/email 后重判');
    return { predict_grade: 'C', priority: 10, audit_now: false, reasons };
  }

  // ── A: 强口碑 + has website + audit/starter candidate
  if (hasWebsite && rc >= A_REVIEWS_MIN && rating >= A_RATING_MIN
      && (action === 'audit_candidate' || action === 'starter_candidate')) {
    reasons.push(`predict-A · ${rc} 评论≥${A_REVIEWS_MIN} · ${rating}★≥${A_RATING_MIN} · ${action} · has_website`);
    return { predict_grade: 'A', priority: 100, audit_now: true, reasons };
  }

  // ── B: 中等口碑 + audit/starter candidate
  if (rc >= B_REVIEWS_MIN && rating >= B_RATING_MIN
      && (action === 'audit_candidate' || action === 'starter_candidate')) {
    reasons.push(`predict-B · ${rc} 评论≥${B_REVIEWS_MIN} · ${rating}★≥${B_RATING_MIN} · ${action}`);
    return { predict_grade: 'B', priority: 75, audit_now: true, reasons };
  }

  // ── C: niche-relevant 但 GBP 信号薄 · cold queue 路径 · 不立刻 audit
  // V3 D43 cycle-8 (Matthew 2026-05-14): 具体说明 vs A/B 阈值哪条不及格 · 不要 vague
  const cActionOk = action === 'audit_candidate' || action === 'starter_candidate';
  const failedB = [];
  if (rc < B_REVIEWS_MIN) failedB.push(`reviews ${rc} < B 阈值 ${B_REVIEWS_MIN}`);
  if (rating < B_RATING_MIN) failedB.push(`rating ${rating}★ < B 阈值 ${B_RATING_MIN}★`);
  if (!cActionOk) failedB.push(`cheap action ${action} 不在 [audit_candidate, starter_candidate]`);
  const failedA = [];
  if (rc < A_REVIEWS_MIN) failedA.push(`reviews ${rc} < A 阈值 ${A_REVIEWS_MIN}`);
  if (rating < A_RATING_MIN) failedA.push(`rating ${rating}★ < A 阈值 ${A_RATING_MIN}★`);
  if (!hasWebsite) failedA.push(`无独立网站 (websiteStatus=${ws || '?'}) · A 必须有 website`);
  if (!cActionOk) failedA.push(`cheap action ${action} 不在 [audit_candidate, starter_candidate]`);
  reasons.push(`predict-C · 不达 B 标准:`);
  for (const r of failedB) reasons.push(`  ✗ ${r}`);
  reasons.push(`(同时不达 A 标准: ${failedA.length} 项)`);
  return {
    predict_grade: 'C',
    priority: Math.min(50, rc),
    audit_now: false,
    reasons,
    // V3 D43 cycle-8: structured threshold report for UI · machine-readable
    threshold_report: {
      actual: { reviews: rc, rating, has_website: hasWebsite, cheap_action: action },
      B_required: { reviews_min: B_REVIEWS_MIN, rating_min: B_RATING_MIN, cheap_action_in: ['audit_candidate', 'starter_candidate'] },
      A_required: { reviews_min: A_REVIEWS_MIN, rating_min: A_RATING_MIN, requires_has_website: true, cheap_action_in: ['audit_candidate', 'starter_candidate'] },
      failed_B_criteria: failedB,
      failed_A_criteria: failedA,
    },
  };
}

/**
 * Static thresholds export · for /admin/scoring transparency.
 */
export const PREDICT_THRESHOLDS = {
  A: { reviews_min: A_REVIEWS_MIN, rating_min: A_RATING_MIN, requires_has_website: true },
  B: { reviews_min: B_REVIEWS_MIN, rating_min: B_RATING_MIN, requires_has_website: false },
};
