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
// codex R125: name-exact+state may auto-verify ONLY for official-registry candidate sources.
const REGISTRY_SOURCES = new Set(['license', 'licence', 'abr', 'abn']);
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

/**
 * Build trusted anchors from an entity. ONLY high-trust, directly-observed fields (GBP/latest).
 * codex R119: an enrichment ABN is NOT used as an anchor unless it was itself already identity-verified
 * (`entity.enrichment.abn.identity_verified === true`) — otherwise an unguarded prior lookup could
 * self-confirm a later candidate. Anchors must never be seeded from unguarded prior enrichment.
 */
export function buildAnchors(entity = {}) {
  const L = entity.latest || entity || {};
  const addr = L.address || '';
  const verifiedEnrichAbn = entity.enrichment?.abn?.identity_verified === true ? entity.enrichment.abn.abn : null;
  return {
    phone: L.phone || null,
    abn: L.abn || verifiedEnrichAbn || null,
    address: addr || null,
    postcode: postcodes(addr)[0] || L.postcode || null,
    state: L.state || normState(addr) || null,
    // codex R120: only an OWNED domain is an identity anchor — a GBP website that is a directory/social
    // page (facebook.com/acme) must NOT become a definitive anchor or it would false-conflict real domains.
    domain: ownedDomain(L.website) || null,
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

  // name corroboration (NEVER a verifier on its own — namesakes share names — only corroborates an anchor).
  // codex R119: use the ABR-SPECIFIC score only (`abrScore`), so a non-ABR adapter's generic confidence
  // score can't accidentally satisfy name corroboration.
  const nA = normName(anchors.name), nC = normName(candidate.name);
  // codex R124: tolerate punctuation/spacing variants — "L.J. Ellery" (→"l j ellery") == "LJ Ellery" (→"lj ellery")
  // via a space-stripped compare. Still EXACT (no subset/fuzzy): "Weatherite" ≠ "Weatherite Enterprises".
  const compact = (s) => s.replace(/\s+/g, '');
  const nameExact = !!nA && !!nC && (nA === nC || compact(nA) === compact(nC));
  const abrScoreOk = candidate.abrScore != null && Number(candidate.abrScore) >= scoreMin;
  const nameCorroborated = nameExact || abrScoreOk;

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

  // 4 · phone CONFLICT is a strong negative → discard (rather miss)
  if (hardConflict('phone')) return out('discarded_uncertain', 'conflict:phone');

  // 4.5 · codex R124+R125: name-EXACT + same state verifies on its own — registry names are ~unique within a
  //       state, and a registered-office postcode ≠ the trading shopfront must NOT veto it. BUT (codex R125
  //       guardrail) this is ONLY safe for OFFICIAL REGISTRY sources (licence/ABR). For web/search/page
  //       candidates, state is weak/inferred and a trading name can coincidentally equal a different
  //       registered name → those must NOT be promoted by name+state alone (they go through tier1/tier2 LLM).
  if (nameExact && has('state') && REGISTRY_SOURCES.has(candidate.source)) {
    return out('verified', 'name_exact+state');
  }

  // 5 · non-unique anchors (phone / postcode+state / address) REQUIRE name corroboration.
  //     codex R119: phone alone is NOT a universal verifier (recycled/shared mobiles, call-tracking,
  //     directory numbers) — only ABN(valid) + owned-domain verify without a name.
  const geoOk = has('postcode') && has('state');
  const anchorHit = has('phone') || geoOk || addrMatch;
  if (anchorHit && nameCorroborated) {
    const reason = has('phone') ? 'phone+name' : geoOk ? 'postcode+state+name' : 'address+name';
    return out('verified', reason);
  }

  // 6 · hard conflicts beat score for the reason code (observability)
  if (conflicts.length) return out('discarded_uncertain', `conflict:${conflicts[0].field}`);

  // 7 · an anchor hit but no name corroboration, with a low/absent ABR score → discard
  if (candidate.abrScore != null && Number(candidate.abrScore) < scoreMin) {
    return out('discarded_uncertain', `abr_score_below_${scoreMin}`);
  }

  // 8 · anchor-without-name / only state / only name → too weak to trust
  const reason = anchorHit ? 'anchor_without_name' : has('state') ? 'state_only_too_weak' : 'no_hard_anchor';
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
