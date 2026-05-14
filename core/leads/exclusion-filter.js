/**
 * V3 D43 cycle-23 (Matthew 2026-05-15) · 排除式筛选 (3 layer · LEAD-FILTERING-DESIGN.md)
 *
 * 取代 predict-grade.js 硬阈值。逻辑：先排除明显不是客户的 · 剩下的进 audit。
 *
 * Layer 1 · 数据质量
 *   - phone + email + website 全 NULL · enrich 后仍 NULL → exclude
 *   - business_status != OPERATIONAL → exclude
 *   - name 含 test/demo/测试 → exclude
 *
 * Layer 2 · 业务类型不对
 *   - review_count > NICHE_MAX (niche-aware) → exclude
 *   - category 含 government/school/church/charity → exclude
 *   - category 含 web design/SEO/digital marketing → exclude
 *   - LLM niche_judge relevant=false → exclude
 *
 * Layer 3 · 时机不对
 *   - review_count < NICHE_MIN → archive (cold storage)
 *   - rating < 3.0 AND review_count >= 5 → archive
 *
 * Layer 4 · 区域竞争 (Matthew #5 砍掉 · 未实施)
 *
 * Returns: {
 *   excluded: bool,
 *   layer: 1|2|3|null,
 *   reason: '...',
 *   archive_reason: 'excluded_layer_X_xxx',  // 写到 entity.archive_reason
 *   exclusions: [{ layer, id, reason }],     // 全部命中的规则 (诊断用)
 *   needs_enrichment: bool,                  // Layer 1 触发: 还没 enrich 过
 * }
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NICHE_CONFIG_PATH = path.join(__dirname, 'niche-config.json');

let _nicheConfigCache = null;
export function loadNicheConfig() {
  if (_nicheConfigCache) return _nicheConfigCache;
  _nicheConfigCache = JSON.parse(fs.readFileSync(NICHE_CONFIG_PATH, 'utf8'));
  return _nicheConfigCache;
}

function nicheThresholds(niche) {
  const cfg = loadNicheConfig();
  const key = String(niche || '').toLowerCase().trim();
  if (cfg.niches[key]) return cfg.niches[key];
  // Substring fallback (e.g. "roofing contractor" → roofing)
  for (const k of Object.keys(cfg.niches)) {
    if (k !== 'default' && key.includes(k)) return cfg.niches[k];
  }
  return cfg.niches.default;
}

const GOV_NONPROFIT_KEYWORDS = /(government|gov|school|university|church|charity|non[- ]?profit|council)/i;
const COMPETITOR_KEYWORDS = /(web design|web develop|seo|digital marketing|marketing agency|software develop)/i;
const TEST_NAME = /\b(test|demo|测试|sample|placeholder|example)\b/i;

/**
 * Run 3-layer exclusion filter on entity.
 *
 * @param {object} ctx
 * @param {object} ctx.entity · full entity object
 * @param {object} [ctx.cheapAudit] · cheap-audit-v2 result (action / fired_triggers)
 * @param {object} [ctx.nicheVerdict] · LLM niche judge result ({ relevant, confidence, reason })
 * @returns Exclusion result
 */
export function runExclusionFilter({ entity, cheapAudit = null, nicheVerdict = null } = {}) {
  const exclusions = [];
  const latest = entity?.latest || {};
  const niche = latest.niche || latest.category || '';
  const cfg = loadNicheConfig();
  const thr = nicheThresholds(niche);

  const phone = (latest.phone || '').trim();
  const email = (latest.email || '').trim();
  const website = (latest.website || '').trim();
  const rating = Number(latest.rating || 0);
  const reviewCount = Number(latest.review_count || 0);
  const name = String(latest.name || '');
  const cats = [latest.category || '', ...(latest.categories || [])].join(' ');

  // ───── Layer 1 · 数据质量 ─────
  // V3 D43 cycle-23: phone+email+website 全 NULL → 先 enrich · enrich 后仍 NULL 才 exclude.
  const enrichmentAttempted = !!entity?.enrichment_attempted_at;
  if (!phone && !email && !website) {
    if (!enrichmentAttempted) {
      // 第一次见 · 触发 enrichment · 不 exclude
      return {
        excluded: false,
        needs_enrichment: true,
        layer: null,
        reason: '无 phone/email/website · 先 enrich 再判',
        archive_reason: null,
        exclusions: [],
      };
    }
    // enrich 跑过了 · 仍 NULL · 真排除
    exclusions.push({ layer: 1, id: 'no_contact_after_enrich', reason: '无 phone/email/website · enrich 后仍未找到' });
  }

  if (latest.business_status && latest.business_status !== 'OPERATIONAL' && latest.business_status !== 'BUSINESS_STATUS_UNSPECIFIED') {
    exclusions.push({ layer: 1, id: 'not_operational', reason: `business_status=${latest.business_status}` });
  }

  if (TEST_NAME.test(name)) {
    exclusions.push({ layer: 1, id: 'test_name', reason: `name 含测试关键词: "${name}"` });
  }

  // ───── Layer 2 · 业务类型不对 ─────
  if (reviewCount > thr.max_reviews) {
    exclusions.push({
      layer: 2,
      id: 'too_large',
      reason: `${reviewCount} reviews > ${niche} 阈值 ${thr.max_reviews} (大企业/连锁)`,
    });
  }

  if (GOV_NONPROFIT_KEYWORDS.test(cats) || GOV_NONPROFIT_KEYWORDS.test(name)) {
    exclusions.push({ layer: 2, id: 'gov_school_charity', reason: `category/name 含 government/school/charity 关键词` });
  }

  if (COMPETITOR_KEYWORDS.test(cats) || COMPETITOR_KEYWORDS.test(name)) {
    exclusions.push({ layer: 2, id: 'competitor', reason: `category/name 含 web design/SEO/marketing 关键词 (同行)` });
  }

  if (nicheVerdict && nicheVerdict.relevant === false) {
    exclusions.push({
      layer: 2,
      id: 'niche_mismatch_llm',
      reason: `LLM niche judge: ${nicheVerdict.reason || 'relevant=false'} (conf ${nicheVerdict.confidence ?? '?'})`,
    });
  }

  // ───── Layer 3 · 时机不对 ─────
  // V3 D43 cycle-23b (Matthew 2026-05-15 test feedback): review_count === 0 + rating > 0
  // 是 "未知/缺数据" 状态 · 不是 "真 0"。gosom scraper 经常漏抓 review_count ·
  // 但 rating 4.9★ 说明肯定有 reviews. 不可信任 → 让它过 audit · 后续 enrich/audit 重判.
  // 只在 review_count > 0 AND < min 才算 truly too_few.
  if (reviewCount > 0 && reviewCount < thr.min_reviews) {
    exclusions.push({
      layer: 3,
      id: 'too_few_reviews',
      reason: `${reviewCount} reviews < ${niche} 阈值 ${thr.min_reviews} (业务太小/刚开业)`,
    });
  }
  // review_count === 0 但 rating > 0 · 数据可疑 · 不 exclude · 但记 warning
  if (reviewCount === 0 && rating > 0) {
    // 让它通过 · 不进 exclusions[] · 但 audit 后 lead-grading 会再次判
  }

  if (rating > 0 && rating < cfg.rating_min && reviewCount >= cfg.rating_min_min_reviews) {
    exclusions.push({
      layer: 3,
      id: 'bad_rating',
      reason: `rating ${rating}★ < ${cfg.rating_min}★ AND ${reviewCount} reviews ≥ ${cfg.rating_min_min_reviews} · 口碑差 · 网站非主因`,
    });
  }

  if (exclusions.length === 0) {
    return {
      excluded: false,
      needs_enrichment: false,
      layer: null,
      reason: 'survived all 3 layers · proceed to audit',
      archive_reason: null,
      exclusions: [],
      thresholds_used: thr,
    };
  }

  // 排除 · 取第一条 layer 最低的 as primary reason
  const primary = exclusions.sort((a, b) => a.layer - b.layer)[0];
  return {
    excluded: true,
    needs_enrichment: false,
    layer: primary.layer,
    reason: primary.reason,
    archive_reason: `excluded_layer_${primary.layer}_${primary.id}: ${primary.reason}`,
    exclusions,
    thresholds_used: thr,
  };
}

/**
 * Human-readable description of exclusions for Discord post / operator log.
 */
export function formatExclusionReport(filter) {
  if (!filter.excluded && !filter.needs_enrichment) {
    return `✅ 通过 3 层排除筛 · 进 audit (review_count 阈值 ${filter.thresholds_used?.min_reviews}-${filter.thresholds_used?.max_reviews})`;
  }
  if (filter.needs_enrichment) {
    return `⏳ 需 enrich · 无 phone/email/website · 触发 enrichment task 后重判`;
  }
  const lines = [`❌ 排除 · Layer ${filter.layer}`];
  for (const ex of filter.exclusions) {
    lines.push(`  · L${ex.layer} ${ex.id}: ${ex.reason}`);
  }
  return lines.join('\n');
}
