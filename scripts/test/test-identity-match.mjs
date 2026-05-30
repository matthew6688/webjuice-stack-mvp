/**
 * test-identity-match.mjs · 身份锚点守门员 (codex Round 116/117)
 * 验证: 认对(verified) · 认错/同名(discarded) · 空(not_found) · 全自动无 needs_review。
 */
import assert from 'node:assert';
import { buildAnchors, matchIdentity, verifyCandidate } from '../../core/enrichment/identity-match.js';

let passed = 0;
const ok = (c, m) => { assert.ok(c, m); passed++; };

const entity = {
  latest: {
    business_name: 'Vicwest Roofing',
    phone: '0403 554 592',
    address: 'Shed 3/31 Icon Dr, Delacombe VIC 3356',
    state: 'VIC',
    website: 'https://vicwestroofing.com.au',
    abn: '69 622 718 361', // trusted/observed ABN anchor (codex R119: enrichment ABN not an anchor unless verified)
  },
};
const anchors = buildAnchors(entity);

// 1 · ABN exact → verified (definitive · 即使电话不同也认, ABN 是唯一键)
ok(matchIdentity(anchors, { abn: '69622718361', phone: '0399999999' }).status === 'verified', 'abn exact → verified');
ok(matchIdentity(anchors, { abn: '69622718361' }).reason === 'abn_exact', 'abn exact reason');

// 2 · 域名精确 → verified
ok(matchIdentity(anchors, { domain: 'www.vicwestroofing.com.au' }).status === 'verified', 'domain exact → verified');

// 3 · 电话匹配 + 名字佐证 → verified (+61 归一)
ok(matchIdentity(anchors, { name: 'Vicwest Roofing', phone: '+61 403 554 592' }).status === 'verified', 'phone + name → verified');
// 3b · codex R119: 电话单独(无名字佐证)不再 verify(回收/共用手机/呼叫追踪号风险)
ok(matchIdentity(anchors, { phone: '+61 403 554 592' }).status !== 'verified', 'phone alone (no name) → not verified');

// 4 · postcode+州 + 名字佐证 → verified
ok(matchIdentity(anchors, { name: 'Vicwest Roofing', address: '12 Other St, Ballarat VIC 3356', state: 'VIC' }).status === 'verified', 'postcode+state+name → verified');

// 4b · codex R118: postcode+州 但**没有名字佐证** → 不够(同区同名才该信) → discarded
const geoNoName = matchIdentity(anchors, { address: '99 Random St, Ballarat VIC 3356', state: 'VIC' });
ok(geoNoName.status === 'discarded_uncertain' && geoNoName.reason === 'anchor_without_name', 'postcode+state without name → discarded');

// 4c · codex R118: 目录/社媒域名(facebook)不算"自有域名"定值锚点 → 不 verified
const dirDomain = matchIdentity(anchors, { name: 'Vicwest Roofing', domain: 'facebook.com/vicwest' });
ok(dirDomain.status !== 'verified', 'directory/social domain → NOT definitive verify');

// 5 · 同名的美国公司: 没有 ABN/电话/postcode 命中, 州不同 → discarded
const usNamesake = matchIdentity(anchors, { name: 'Vicwest Roofing', phone: '+1 212 555 0100', state: 'TX', postcode: '7500X' });
ok(usNamesake.status === 'discarded_uncertain', 'US namesake → discarded_uncertain');

// 6 · 同名不同 ABN(澳洲两家同名) → discarded conflict:abn
const abnConflict = matchIdentity(anchors, { name: 'Vicwest Roofing', abn: '11 111 111 111' });
ok(abnConflict.status === 'discarded_uncertain' && abnConflict.reason === 'conflict:abn', 'abn conflict → discarded');

// 7 · 只有州(弱信号) → discarded (state_only_too_weak)
const stateOnly = matchIdentity(anchors, { state: 'VIC' });
ok(stateOnly.status === 'discarded_uncertain' && stateOnly.reason === 'state_only_too_weak', 'state alone → discarded');

// 8 · ABR 相似分 < 75 → discarded (codex R119: abrScore-specific 字段)
ok(matchIdentity(anchors, { name: 'Vicwest Roofing', abrScore: 60 }).reason === 'abr_score_below_75', 'low ABR score → discarded');
// 8b · 通用 score(非 abrScore)不能当名字佐证 → postcode+state+score:90 不 verify
ok(matchIdentity(anchors, { address: 'X VIC 3356', state: 'VIC', score: 90 }).status !== 'verified', 'generic score is NOT name corroboration');
// 8c · postcode+state + 高 abrScore → verified
ok(matchIdentity(anchors, { address: '9 X St VIC 3356', state: 'VIC', abrScore: 90 }).status === 'verified', 'postcode+state + high abrScore → verified');

// ── codex R124: deterministic over-discard fixes ──
// 8d · name-EXACT + state verifies EVEN when registered-office postcode ≠ shopfront (the 115 false-discards)
const qld = matchIdentity(
  { name: 'Queensland Roofing Pty Ltd', state: 'QLD', address: '19/10 Eagle St, Brisbane City QLD 4000' },
  { name: 'QUEENSLAND ROOFING PTY LTD', state: 'QLD', address: 'Reg Office QLD 4509' });
ok(qld.status === 'verified' && qld.reason === 'name_exact+state', 'name-exact+state verifies despite registered-office postcode conflict');
// 8e · L.J./LJ punctuation/spacing variant → name-exact verified
const lj = matchIdentity({ name: 'L.J. Ellery Roofing Pty Ltd', state: 'NSW' }, { name: 'LJ Ellery Roofing Pty Ltd', state: 'NSW' });
ok(lj.status === 'verified', 'L.J./LJ punctuation variant → name-exact verified');
// 8f · GUARD: name-exact but DIFFERENT state → NOT auto-verified (state conflict)
ok(matchIdentity({ name: 'Acme Roofing', state: 'VIC' }, { name: 'Acme Roofing', state: 'QLD' }).status !== 'verified', 'name-exact + different state → not verified');
// 8g · GUARD: name SUBSET (not exact) → NOT auto-verified (goes to LLM judge later)
ok(matchIdentity({ name: 'Weatherite', state: 'VIC', address: 'X VIC 3000' }, { name: 'Weatherite Enterprises Pty Ltd', state: 'VIC', address: 'Y VIC 9999' }).status !== 'verified', 'name subset → NOT name-exact, not auto-verified');

// 9 · 空候选 → not_found
ok(matchIdentity(anchors, {}).status === 'not_found', 'empty candidate → not_found');

// 10 · 电话冲突 + geo 匹配 → discarded (rather miss)
const phoneConflict = matchIdentity(anchors, { phone: '0388887777', address: 'X VIC 3356', state: 'VIC' });
ok(phoneConflict.status === 'discarded_uncertain' && phoneConflict.reason === 'conflict:phone', 'phone conflict + geo → discarded');

// 11 · 永不输出 needs_review (全自动)
const allStatuses = ['verified', 'discarded_uncertain', 'not_found'];
for (const c of [{}, { abn: '69622718361' }, { state: 'VIC' }, { name: 'x', score: 10 }]) {
  ok(allStatuses.includes(matchIdentity(anchors, c).status), 'status ∈ {verified,discarded,not_found} · no needs_review');
}

// 12 · verifyCandidate 带 anchors 输出 (可观测性)
const v = verifyCandidate(entity, { abn: '69622718361' });
ok(v.status === 'verified' && v.anchors.phone, 'verifyCandidate returns anchors for observability');

// 13 · codex R119: 未核实的 enrichment ABN 不能当锚点(防自我印证)
const leakEntity = { latest: { business_name: 'X', state: 'VIC' }, enrichment: { abn: { abn: '12345678901' } } };
ok(buildAnchors(leakEntity).abn === null, 'unverified enrichment ABN NOT used as anchor');
const okEntity = { latest: { business_name: 'X' }, enrichment: { abn: { abn: '69622718361', identity_verified: true } } };
ok(buildAnchors(okEntity).abn === '69622718361', 'identity_verified enrichment ABN allowed as anchor');

// 14 · codex R120: 实体官网是 facebook 页 → 不当 domain 锚点 → 不会误判真域名为 conflict
const fbEntity = { latest: { business_name: 'Acme Roofing', website: 'https://facebook.com/acme', state: 'NSW' } };
ok(buildAnchors(fbEntity).domain === null, 'social/directory website NOT an owned-domain anchor');
const fbAnchors = buildAnchors(fbEntity);
ok(matchIdentity(fbAnchors, { name: 'Acme Roofing', domain: 'acmeroofing.com.au' }).reason !== 'conflict:domain', 'facebook anchor does not false-conflict a real domain');

console.log(`identity-match: ${passed} passed, 0 failed`);
