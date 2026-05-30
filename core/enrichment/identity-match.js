/**
 * core/enrichment/identity-match.js · 身份锚点守门员 (codex Round 116/117 · 2026-05-30)
 *
 * 防"认错人": 按公司名查来的 enrichment 结果(牌照行 / ABR 匹配 / 外部提及)可能是同名的别家
 * (美国/加拿大同名, 或澳洲同名不同址)。本守门员在任何结果被当成 canonical/verified 之前, 用
 * 已知"锚点"(电话/ABN/地址/postcode+州/域名)交叉验证。
 *
 * 全自动 · 零人工: 只输出三态 — 不存在 needs_review。
 *   - 'verified'            至少命中一个硬锚点 且 无硬冲突 → 可写入 entity.enrichment / entity.license
 *   - 'discarded_uncertain' 锚点不够 / 有硬冲突 / 相似分过低 → 丢弃这条数据(不当 verified · 不挂人)
 *   - 'not_found'           候选本身没有可比对的身份字段(空结果)
 * 调用方据此让线索靠"剩余 verified 信号"自动定去留, 任何单条线索都不挂起等人。
 *
 * 硬锚点(codex): phone · ABN · 完整地址 · postcode+州 · 精确域名。单独"州"太弱 → 仅辅助。
 * 定值锚点(唯一键): ABN 精确 / 域名精确 → 命中即 verified(覆盖其它字段冲突, 因为 ABN/域名是唯一标识)。
 */

const STATE_RE = /\b(VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\b/i;
const ABR_SCORE_MIN = 75; // ABR 相似分 < 75 → 不采信 (codex R116)

const digitsOnly = (v) => String(v || '').replace(/\D/g, '');
function normPhone(v) {
  const d = digitsOnly(v);
  if (!d) return '';
  if (d.startsWith('61')) return `0${d.slice(2)}`; // +61 → 0
  return d;
}
function normDomain(v) {
  if (!v) return '';
  try {
    const h = new URL(/^https?:\/\//i.test(v) ? v : `http://${v}`).hostname;
    return h.replace(/^www\./i, '').toLowerCase();
  } catch { return String(v).replace(/^www\./i, '').toLowerCase().trim(); }
}
function normState(v) { const m = String(v || '').match(STATE_RE); return m ? m[1].toUpperCase() : ''; }
function postcodes(v) {
  // AU postcodes are 4 digits 0200-7999 (rough). Return the set found in a string.
  return [...String(v || '').matchAll(/\b(\d{4})\b/g)].map((m) => m[1]).filter((p) => +p >= 200 && +p <= 7999);
}
function normName(v) {
  return String(v || '').toLowerCase()
    .replace(/\bpty\s*\.?\s*ltd\.?\b/g, '').replace(/\b(limited|inc|corp|company|co)\.?\b/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function addressTokens(v) {
  return new Set(String(v || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 3));
}

/** Build trusted anchors from an entity (the facts we already hold). */
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
 * Compare a normalized candidate against anchors.
 * @param {object} anchors  from buildAnchors()
 * @param {object} candidate { phone?, abn?, address?, postcode?, state?, domain?, name?, score? }
 * @param {object} [opts] { scoreMin = 75 }
 * @returns {{ status, matched: string[], conflicts: object[], reason: string, definitive: boolean }}
 */
export function matchIdentity(anchors = {}, candidate = {}, opts = {}) {
  const scoreMin = opts.scoreMin ?? ABR_SCORE_MIN;
  const matched = [];
  const conflicts = [];

  const compare = (field, normFn) => {
    const a = anchors[field], c = candidate[field];
    if (a == null || a === '' || c == null || c === '') return; // missing on either side → not comparable
    const an = normFn(a), cn = normFn(c);
    if (!an || !cn) return;
    if (an === cn) matched.push(field);
    else conflicts.push({ field, anchor: an, candidate: cn });
  };

  compare('phone', normPhone);
  compare('abn', digitsOnly);
  compare('domain', normDomain);
  compare('state', normState);

  // postcode: set intersection (handles "VIC 3356" style)
  const aPC = new Set([...(anchors.postcode ? [String(anchors.postcode)] : []), ...postcodes(anchors.address)]);
  const cPC = new Set([...(candidate.postcode ? [String(candidate.postcode)] : []), ...postcodes(candidate.address)]);
  if (aPC.size && cPC.size) {
    if ([...aPC].some((p) => cPC.has(p))) matched.push('postcode');
    else conflicts.push({ field: 'postcode', anchor: [...aPC].join(','), candidate: [...cPC].join(',') });
  }

  // address token overlap (supporting): shares street number + ≥1 street word
  if (anchors.address && candidate.address) {
    const at = addressTokens(anchors.address), ct = addressTokens(candidate.address);
    const overlap = [...at].filter((t) => ct.has(t));
    const sharesNumber = overlap.some((t) => /^\d/.test(t));
    if (sharesNumber && overlap.length >= 2) matched.push('address');
  }

  const has = (f) => matched.includes(f);
  const hardConflict = (f) => conflicts.some((c) => c.field === f);

  // 1 · truly empty candidate (no identity-ish field at all) → not_found
  const candidateHasField = ['phone', 'abn', 'address', 'postcode', 'state', 'domain', 'name', 'score']
    .some((f) => candidate[f] != null && candidate[f] !== '');
  if (!candidateHasField) {
    return { status: 'not_found', matched, conflicts, reason: 'no_comparable_identity_fields', definitive: false };
  }

  // 2 · definitive unique-key match → verified (ABN / domain uniquely identify one business)
  if (has('abn')) return { status: 'verified', matched, conflicts, reason: 'abn_exact', definitive: true };
  if (has('domain')) return { status: 'verified', matched, conflicts, reason: 'domain_exact', definitive: true };

  // 3 · hard conflict on a unique key but no definitive match → different business → discard
  if (hardConflict('abn')) return { status: 'discarded_uncertain', matched, conflicts, reason: 'conflict:abn', definitive: false };
  if (hardConflict('domain')) return { status: 'discarded_uncertain', matched, conflicts, reason: 'conflict:domain', definitive: false };

  // 4 · strong anchor (phone / postcode+state / address+state) → verified.
  //     Checked BEFORE the score gate: a real phone/geo match overrides a weak name-similarity score.
  const phoneOk = has('phone') && !hardConflict('phone');
  const geoOk = has('postcode') && has('state');
  const addrOk = has('address') && has('state');
  if (phoneOk || geoOk || addrOk) {
    // a phone conflict alongside a geo match is suspicious → discard (rather miss)
    if (hardConflict('phone') && !phoneOk) {
      return { status: 'discarded_uncertain', matched, conflicts, reason: 'conflict:phone', definitive: false };
    }
    return { status: 'verified', matched, conflicts, reason: phoneOk ? 'phone' : geoOk ? 'postcode+state' : 'address+state', definitive: false };
  }

  // 5 · no hard anchor: an ABR-style similarity score below threshold → discard (name match too weak)
  if (candidate.score != null && Number(candidate.score) < scoreMin) {
    return { status: 'discarded_uncertain', matched, conflicts, reason: `abr_score_below_${scoreMin}`, definitive: false };
  }

  // 6 · only weak signal (state alone / name-only) or contradictions → not enough to trust
  const reason = conflicts.length ? `conflict:${conflicts[0].field}` : (has('state') ? 'state_only_too_weak' : 'no_hard_anchor');
  return { status: 'discarded_uncertain', matched, conflicts, reason, definitive: false };
}

/**
 * Convenience: verify a candidate against an entity. Adds a stable reason code for observability.
 * @returns {{ status, matched, conflicts, reason, anchors }}
 */
export function verifyCandidate(entity, candidate, opts = {}) {
  const anchors = buildAnchors(entity);
  const r = matchIdentity(anchors, candidate, opts);
  return { ...r, anchors };
}

export default { buildAnchors, matchIdentity, verifyCandidate, ABR_SCORE_MIN };
