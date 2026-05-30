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
  },
  enrichment: { abn: { abn: '69 622 718 361' } },
};
const anchors = buildAnchors(entity);

// 1 · ABN exact → verified (definitive · 即使电话不同也认, ABN 是唯一键)
ok(matchIdentity(anchors, { abn: '69622718361', phone: '0399999999' }).status === 'verified', 'abn exact → verified');
ok(matchIdentity(anchors, { abn: '69622718361' }).reason === 'abn_exact', 'abn exact reason');

// 2 · 域名精确 → verified
ok(matchIdentity(anchors, { domain: 'www.vicwestroofing.com.au' }).status === 'verified', 'domain exact → verified');

// 3 · 电话匹配(+61 归一) → verified
ok(matchIdentity(anchors, { phone: '+61 403 554 592' }).status === 'verified', 'phone (+61) → verified');

// 4 · postcode+州 + 名字佐证 → verified
ok(matchIdentity(anchors, { name: 'Vicwest Roofing', address: '12 Other St, Ballarat VIC 3356', state: 'VIC' }).status === 'verified', 'postcode+state+name → verified');

// 4b · codex R118: postcode+州 但**没有名字佐证** → 不够(同区同名才该信) → discarded
const geoNoName = matchIdentity(anchors, { address: '99 Random St, Ballarat VIC 3356', state: 'VIC' });
ok(geoNoName.status === 'discarded_uncertain' && geoNoName.reason === 'geo_without_name', 'postcode+state without name → discarded');

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

// 8 · ABR 相似分 < 75 → discarded
ok(matchIdentity(anchors, { name: 'Vicwest Roofing', score: 60 }).reason === 'abr_score_below_75', 'low ABR score → discarded');
ok(matchIdentity(anchors, { phone: '+61 403 554 592', score: 60 }).status === 'verified', 'phone match overrides low score');

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

console.log(`identity-match: ${passed} passed, 0 failed`);
