/**
 * core/enrichment/identity-match.js · 身份锚点守门员 (codex Round 116/117/118 · 2026-05-30)
 *
 * 防"认错人": 按公司名查来的 enrichment 结果(牌照行 / ABR 匹配 / 外部提及)可能是同名的别家
 * (美国/加拿大同名, 或澳洲同名不同址)。本守门员在任何结果被当成 canonical/verified 之前, 用
 * 已知"锚点"(电话/ABN/地址/postcode+州/域名)交叉验证。
 *
 * 全自动 · 零人工: 只输出三态 — 不存在 needs_review。
 *   - 'verified'            命中可信锚点 且 无硬冲突 → 可写入 entity.enrichment / entity.license
 *   - 'discarded_uncertain' 锚点不够 / 有硬冲突 / 相似分过低 → 丢弃这条数据(不当 verified · 不挂人)
 *   - 'not_found'           候选本身没有可比对的身份字段(空结果)
 * 调用方据此让线索靠"剩余 verified 信号"自动定去留, 任何单条线索都不挂起等人。
 *
 * 锚点强度(codex R118):
 *   - 定值唯一键: 合法 ABN(校验位通过) / 自有域名(非目录/社媒) → 命中即 verified。
 *   - 强: phone 精确(电话基本唯一一家) → verified。
 *   - 非唯一(需名字佐证): postcode+州 / 真实街号+街名 —— 单独不够(同区同名才该信), 必须叠加
 *     名字佐证(名字归一相等 或 ABR 相似分≥75)才 verified。单独"州"/单独名字 → 太弱, 丢弃。
 *   - 硬冲突(present-both-differ)的原因码优先于分数原因码(可观测性)。
 *
 * 调用方契约(codex R118): adapter 只产出 normalized candidate, 不预先 promote;
 *   candidate = { source, name?, score?, abn?, phone?, address?, postcode?, state?, domain?, sourceUrl?, observedAt? }
 *   只有 verifyCandidate(...).status === 'verified' 才能影响 canonical / 牌照资格;
 *   'discarded_uncertain' 必须带 reason 落日志, 但 **绝不可当作对该实体的反向证据**。
 * 注意: anchors 取自 entity.latest(GBP 抓取) —— 调用方应保证锚点来自高可信字段, 不要拿"上一轮未守卫的
 *   enrichment"当锚点(否则会自我印证)。ABN 锚点应来自已核实 provenance。
 */

const STATE_RE = /\b(VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\b/i;
const ABR_SCORE_MIN = 75;
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
// 目录/社媒/平台域名 —— 不能当"自有域名"定值锚点(很多商家共用)
const NON_OWNED_DOMAIN = /(^|\.)(facebook|instagram|linktr\.ee|google\.com|google\.com\.au|yelp|yellowpages|truelocal|hotfrog|gumtree|wixsite|wordpress\.com|blogspot|business\.site|wix\.com)/i;

const digitsOnly = (v) => String(v || '').replace(/\D/g, '');
function normPhone(v) {
  const d = digitsOnly(v);
  if (!d) return '';
  if (d.startsWith('61')) return `0${d.slice(2)}`;
  return d;
}
function normDomain(v) {
  if (!v) return '';
  try {
    const h = new URL(/^https?:\/\//i.test(v) ? v : `http://${v}`).hostname;
    return h.replace(/^www\./i, '').toLowerCase();
  } catch { return String(v).replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase().trim(); }
}
function normState(v) { const m = String(v || '').match(STATE_RE); return m ? m[1].toUpperCase() : ''; }
function postcodes(v) {
  return [...String(v || '').matchAll(/\b(\d{4})\b/g)].map((m) => m[1]).filter((p) => +p >= 200 && +p <= 7999);
}
function normName(v) {
  return String(v || '').toLowerCase()
    .replace(/\bpty\s*\.?\s*ltd\.?\b/g, '').replace(/\b(limited|inc|corp|company|co)\.?\b/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function validAbn(v) {
  const d = digitsOnly(v);
  if (d.length !== 11) return false;
  const ds = d.split('').map(Number);
  ds[0] -= 1;
  return ds.reduce((s, n, i) => s + n * ABN_WEIGHTS[i], 0) % 89 === 0;
}
function ownedDomain(v) { const d = normDomain(v); return d && !NON_OWNED_DOMAIN.test(d) ? d : ''; }
function streetNumbers(addr, pcSet) {
  // real street numbers: 1-4 digit tokens that are NOT postcodes (handles "3/31" → 3 and 31)
  return [...String(addr || '').matchAll(/\b(\d{1,4})\b/g)].map((m) => m[1]).filter((n) => !pcSet.has(n));
}
function streetWords(addr) {
  return new Set(String(addr || '').toLowerCase().replace(/[^a-z ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 3 && !STATE_RE.test(t)));
}

/** Build trusted anchors from an entity (the facts we already hold · high-trust GBP fields). */
export function buildAnchors(entity = {}) {
  const L = entity.latest || entity || {};
  const addr = L.address || '';
  return {
    phone: L.phone || null,
    abn: entity.enrichment?.abn?.abn || L.abn || null,
    address: addr || null,
    postcode: postcodes(addr)[0] || L.postcode || null,
    state: L.state || normState(addr) || null,
    domain: L.website || null,
    name: L.business_name || L.name || null,
  };
}

/**
 * Compare a normalized candidate against anchors. Fully automated · 3 states · no needs_review.
 * @returns {{ status, matched: string[], conflicts: object[], reason, definitive, name_corroborated }}
 */
export function matchIdentity(anchors = {}, candidate = {}, opts = {}) {
  const scoreMin = opts.scoreMin ?? ABR_SCORE_MIN;
  const matched = [];
  const conflicts = [];

  const compare = (field, normFn) => {
    const a = anchors[field], c = candidate[field];
    if (a == null || a === '' || c == null || c === '') return;
    const an = normFn(a), cn = normFn(c);
    if (!an || !cn) return;
    if (an === cn) matched.push(field);
    else conflicts.push({ field, anchor: an, candidate: cn });
  };
  compare('phone', normPhone);
  compare('abn', digitsOnly);
  compare('domain', normDomain);
  compare('state', normState);

  // postcode set intersection
  const aPC = new Set([...(anchors.postcode ? [String(anchors.postcode)] : []), ...postcodes(anchors.address)]);
  const cPC = new Set([...(candidate.postcode ? [String(candidate.postcode)] : []), ...postcodes(candidate.address)]);
  if (aPC.size && cPC.size) {
    if ([...aPC].some((p) => cPC.has(p))) matched.push('postcode');
    else conflicts.push({ field: 'postcode', anchor: [...aPC].join(','), candidate: [...cPC].join(',') });
  }

  // real street-address overlap: shared street NUMBER (not postcode) + shared street WORD
  let addrMatch = false;
  if (anchors.address && candidate.address) {
    const aNums = new Set(streetNumbers(anchors.address, aPC));
    const cNums = streetNumbers(candidate.address, cPC);
    const sharedNum = cNums.some((n) => aNums.has(n));
    const aW = streetWords(anchors.address), cW = streetWords(candidate.address);
    const sharedWord = [...aW].some((w) => cW.has(w));
    if (sharedNum && sharedWord) { addrMatch = true; matched.push('address'); }
  }

  const has = (f) => matched.includes(f);
  const hardConflict = (f) => conflicts.some((c) => c.field === f);

  // name corroboration (NEVER a verifier on its own — namesakes share names — only corroborates a geo anchor)
  const nA = normName(anchors.name), nC = normName(candidate.name);
  const nameExact = !!nA && !!nC && nA === nC;
  const scoreOk = candidate.score != null && Number(candidate.score) >= scoreMin;
  const nameCorroborated = nameExact || scoreOk;

  // 1 · truly empty candidate (no identity field — score is NOT an identity field) → not_found
  const ID_FIELDS = ['phone', 'abn', 'address', 'postcode', 'state', 'domain', 'name'];
  if (!ID_FIELDS.some((f) => candidate[f] != null && candidate[f] !== '')) {
    return { status: 'not_found', matched, conflicts, reason: 'no_comparable_identity_fields', definitive: false, name_corroborated: false };
  }
  const out = (status, reason, definitive = false) => ({ status, matched, conflicts, reason, definitive, name_corroborated: nameCorroborated });

  // 2 · definitive unique-key match → verified (only when the key is valid/owned)
  if (has('abn') && validAbn(candidate.abn)) return out('verified', 'abn_exact', true);
  if (has('domain') && ownedDomain(candidate.domain)) return out('verified', 'domain_exact', true);

  // 3 · unique-key CONFLICT (different ABN/owned-domain) → different business → discard
  if (hardConflict('abn')) return out('discarded_uncertain', 'conflict:abn');
  if (hardConflict('domain') && ownedDomain(candidate.domain)) return out('discarded_uncertain', 'conflict:domain');

  // 4 · phone is strong + ~unique → verified on match; conflict → discard (rather miss)
  if (has('phone')) return out('verified', 'phone');
  if (hardConflict('phone')) return out('discarded_uncertain', 'conflict:phone');

  // 5 · non-unique geo anchors REQUIRE name corroboration (else a same-area namesake would verify)
  const geoOk = has('postcode') && has('state');
  if ((geoOk || addrMatch) && nameCorroborated) {
    return out('verified', geoOk ? 'postcode+state+name' : 'address+name');
  }

  // 6 · hard conflicts beat score for the reason code (observability)
  if (conflicts.length) return out('discarded_uncertain', `conflict:${conflicts[0].field}`);

  // 7 · weak name match with low/absent ABR score → discard
  if (candidate.score != null && Number(candidate.score) < scoreMin) {
    return out('discarded_uncertain', `abr_score_below_${scoreMin}`);
  }

  // 8 · only state / only name / geo-without-name → too weak to trust
  const reason = (geoOk || addrMatch) ? 'geo_without_name' : has('state') ? 'state_only_too_weak' : 'no_hard_anchor';
  return out('discarded_uncertain', reason);
}

/**
 * Convenience: verify a candidate against an entity. Adds anchors + reason code for observability.
 * Only `status === 'verified'` may promote a candidate to canonical / affect licence eligibility.
 * `discarded_uncertain` must be logged but NEVER used as negative proof against the entity.
 */
export function verifyCandidate(entity, candidate, opts = {}) {
  const anchors = buildAnchors(entity);
  const r = matchIdentity(anchors, candidate, opts);
  return { ...r, anchors };
}

export default { buildAnchors, matchIdentity, verifyCandidate, ABR_SCORE_MIN };
