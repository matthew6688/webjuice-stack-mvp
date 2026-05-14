/**
 * V3 D35 (2026-05-14) · Discord display vocabulary · niche / stage / emoji.
 * Per SOP-DISCORD-DISPLAY.md.
 *
 * Used by:
 *   - lead-thread-sync.js#buildThreadName (title generation)
 *   - profile-card.js (rendering · indirectly via title)
 */

// 16 niche → 2 字中文
const NICHE_MAP = {
  // 屋顶
  roofer: '屋顶', roofing: '屋顶',
  // 水管
  plumber: '水管', plumbing: '水管',
  // 电工
  electrician: '电工', electrical: '电工',
  // 餐饮
  restaurant: '餐饮', cafe: '餐饮', food: '餐饮',
  // 牙医
  dentist: '牙医', dental: '牙医',
  // 美发
  hair: '美发', salon: '美发', barber: '美发',
  // 汽修
  auto: '汽修', panelbeater: '汽修', mechanic: '汽修', autoshop: '汽修',
  car_repair: '汽修', auto_repair: '汽修', smash_repair: '汽修',
  // 油漆
  painter: '油漆', painting: '油漆',
  // 暖通
  hvac: '暖通', heating: '暖通', cooling: '暖通',
  // 太阳
  solar: '太阳',
  // 医疗
  medical: '医疗', clinic: '医疗', gp: '医疗',
  // 美容
  beauty: '美容', spa: '美容', wellness: '美容',
  // 宠物
  pet: '宠物', vet: '宠物',
  // 园艺
  landscape: '园艺', garden: '园艺', gardener: '园艺',
  // 清洁
  cleaning: '清洁', cleaner: '清洁',
};

export function nicheLabel(niche) {
  if (!niche) return '其他';
  const k = String(niche).toLowerCase().trim();
  // Direct match
  if (NICHE_MAP[k]) return NICHE_MAP[k];
  // Underscore variant
  const usVariant = k.replace(/[\s-]+/g, '_');
  if (NICHE_MAP[usVariant]) return NICHE_MAP[usVariant];
  // First word match (e.g. "plumbing services" → "plumbing" → 水管)
  const firstWord = k.split(/[\s_-]/)[0];
  if (NICHE_MAP[firstWord]) return NICHE_MAP[firstWord];
  // Substring match (e.g. "general roofing contractor" → 屋顶)
  for (const [key, label] of Object.entries(NICHE_MAP)) {
    if (k.includes(key)) return label;
  }
  return '其他';
}

// Stage 2 字中文 · per-channel
const STAGE_LABELS = {
  // #website-projects · 8 stages
  'demo-ready': '待发',
  'outreach-sent': '已发',
  'client-reviewing': '在看',
  interested: '有意',
  'proposal-sent': '报价',
  'closed-won': '成交',
  'closed-lost': '流失',
  nurture: '养护',
  // #website-leads · 3 stages
  'build-pending': '待建',
  'sales-only': '仅销',
  archived: '已弃',
  // #paid-websites · 6 stages
  'paid-new': '新付',
  'in-revision': '改稿',
  live: '上线',
  maintenance: '维护',
  renewal: '续约',
  churned: '流失',
};

export function stageLabel(stage) {
  return STAGE_LABELS[String(stage || '').toLowerCase()] || stage || '?';
}

// Default stage per channel (when entity.sales_stage 未设)
export function defaultStageForChannel(channel) {
  if (channel === 'projects') return 'demo-ready';
  if (channel === 'leads') return 'build-pending';
  if (channel === 'paid') return 'paid-new';
  return '?';
}

/**
 * Compute attention emoji (single · priority order: 🔥 > 💬 > 👀 > ⏰).
 * Most threads return '' (no emoji).
 */
export function attentionEmoji(entity) {
  // 🔥 manual flag
  if (entity.urgent) return '🔥';
  // 💬 customer just replied (24h) · M4 待启动
  if (entity.last_customer_reply_at) {
    const ms = Date.now() - new Date(entity.last_customer_reply_at).getTime();
    if (ms < 24 * 60 * 60 * 1000) return '💬';
  }
  // 👀 customer just viewed demo (24h) · M4 待启动
  if (entity.last_demo_view_at) {
    const ms = Date.now() - new Date(entity.last_demo_view_at).getTime();
    if (ms < 24 * 60 * 60 * 1000) return '👀';
  }
  // ⏰ follow-up overdue · 系统 cron 设置 entity.followup_overdue=true
  if (entity.followup_overdue) return '⏰';
  return '';
}

/**
 * Build thread title per SOP-DISCORD-DISPLAY.md §1.1
 *   [niche] [stage] [grade] business-name [emoji?]
 *
 * @param {object} entity
 * @param {'leads'|'projects'|'paid'} channel
 * @returns {string} · max 100 chars (Discord limit)
 */
export function buildThreadTitle(entity, channel = 'projects') {
  const latest = entity.latest || {};
  const niche = nicheLabel(latest.niche || latest.category);
  const stage = stageLabel(entity.sales_stage || defaultStageForChannel(channel));
  const grade = entity.grade?.investment_level || entity.scoring?.grade || '?';
  const name = latest.name || entity.entityKey || '?';
  const emoji = attentionEmoji(entity);
  const emojiSuffix = emoji ? ` ${emoji}` : '';
  const title = `[${niche}] [${stage}] [${grade}] ${name}${emojiSuffix}`;
  return title.length <= 100 ? title : title.slice(0, 97) + '…';
}
