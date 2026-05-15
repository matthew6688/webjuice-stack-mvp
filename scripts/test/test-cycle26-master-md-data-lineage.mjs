/**
 * cycle-26 · TDD test 10/10 · master.md data lineage integrity.
 *
 * SOP: docs/v3/SOP-MASTER-MD-DATA-LINEAGE.md (frontmatter + 22 sections · data source per field).
 *
 * 3 fixtures · graded by completeness:
 *   A · Full audit (all Stage 1-4 data present) → full report
 *   B · Partial (Stage 3 some sub-modules null) → graceful skip
 *   C · Minimal (entity only) → minimal report · no crash
 *
 * Invariants (every build):
 *   - frontmatter: business_id + business_name + generated_at always present
 *   - no literal "undefined" / "NaN" in output (data flow bugs)
 *   - no deprecated terms
 *   - sectionCount matches actual `## ` heading count
 */
import assert from 'node:assert/strict';
import { buildMasterMdDetailed } from '../../core/reports/master-md-builder.js';
import { DEPRECATED_TERMS } from '../../core/contracts/discord-messages.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 10/10 · master.md data lineage\n');

// ─── Fixtures ───────────────────────────────────────────────────────────────
const FIXTURE_A_ENTITY = {
  entityKey: 'fx_a_full',
  firstSeenAt: '2026-05-15T00:00:00Z',
  latest: {
    name: 'Acme Roofing Co',
    niche: 'roofer',
    category: 'roofing contractor',
    city: 'sydney',
    rating: 4.7,
    review_count: 42,
    website: 'https://acme.example',
    websiteStatus: 'independent_https_site',
    phone: '0411222333',
    address: '1 Test St, Sydney NSW 2000',
    sourceType: 'maps_scraper',
    sourceQuery: 'roofer in sydney',
    discovery_rank: 3,
  },
};

const FIXTURE_A_DETAILED = {
  audit_score: 65,
  decision: 'moderate_candidate',
  audit_version: 'v2',
  cheap_config_version: 'v2',
  hard_triggers: ['mobile_broken'],
  qualification_reason: 'Mobile UX has 3 critical issues',
  issues: {
    critical: [{ id: 'mobile_broken', title: '手机端不可用', rationale: 'No mobile viewport meta', plain_language: '手机看你网站会很差', customer_impact: '60% 流量直接流失' }],
    major: [{ id: 'no_phone_above_fold', title: '电话不在首屏', rationale: 'No tel: link in header' }],
    minor: [],
  },
};

const FIXTURE_A_VISUAL = {
  freshness_score: 6,
  trust_score: 7,
  conversion_score: 5,
  design_age_estimate: 'slightly_outdated',
  summary: '整体设计偏 2015 年风格 · 信任元素分散 · 首屏 hero 偏暗',
  positive_observations: ['品牌色统一', '电话在 header 露出'],
  // SOP §1 row 5: visual issues populated at TOP-LEVEL `visual.issues` (not parsedJson)
  issues: [
    { id: 'hero_dark', title: 'Hero image too dark', severity: 'major', what_observed: 'Dark photo without overlay text', plain_language: '首屏图太黑看不清', customer_impact: '客户感觉不专业' },
    { id: 'header_distract', title: 'Header shape distracts', severity: 'minor' },
  ],
  provider: 'codex_cli',
  model: 'gpt-5',
  latency_ms: 62000,
  parsedJson: {
    visual_freshness: 6,
    visual_trust: 7,
    visual_conversion: 5,
    visual_age: 'slightly_outdated',
  },
};

const FIXTURE_B_ENTITY = { ...FIXTURE_A_ENTITY, entityKey: 'fx_b_partial' };
const FIXTURE_B_DETAILED = { ...FIXTURE_A_DETAILED, pagespeed: null, domain_history: null };
const FIXTURE_B_VISUAL = FIXTURE_A_VISUAL;

const FIXTURE_C_ENTITY = {
  entityKey: 'fx_c_min',
  latest: { name: 'Min Co', niche: 'roofer', city: 'brisbane' },
};

// ─── INVARIANT helpers ──────────────────────────────────────────────────────
function shouldHaveFrontmatter(md, must) {
  assert.ok(md.startsWith('---\n'), 'master.md must start with --- frontmatter');
  const end = md.indexOf('\n---\n', 4);
  assert.ok(end > 4, 'frontmatter must close with ---');
  const fmText = md.slice(4, end);
  for (const k of must) {
    assert.ok(fmText.includes(`${k}:`), `frontmatter missing required field: ${k}`);
  }
}

function shouldHaveNoLiteralUndefined(md) {
  // Catches data-flow bugs where ${x} interpolates undefined / NaN
  const undefHit = md.match(/:\s*undefined\b/) || md.match(/\bundefined\s*$/m);
  assert.ok(!undefHit, `output contains literal "undefined" (data-flow bug): ${undefHit?.[0]}`);
  const nanHit = md.match(/:\s*NaN\b/) || md.match(/\bNaN\s*$/m);
  assert.ok(!nanHit, `output contains literal "NaN" (data-flow bug): ${nanHit?.[0]}`);
}

function shouldHaveNoDeprecated(md) {
  for (const term of DEPRECATED_TERMS) {
    assert.ok(!md.includes(term), `master.md contains deprecated term "${term}"`);
  }
}

function countSections(md) {
  return (md.match(/^## /gm) || []).length;
}

// ─── Fixture A: Full audit ──────────────────────────────────────────────────
const A = buildMasterMdDetailed({
  entity: FIXTURE_A_ENTITY,
  detailedAudit: FIXTURE_A_DETAILED,
  visualAudit: FIXTURE_A_VISUAL,
});

t('A · build succeeds + returns {md, frontmatter, sectionCount}', () => {
  assert.ok(A && typeof A.md === 'string' && A.md.length > 500, 'md should be substantial');
  assert.ok(A.frontmatter && typeof A.frontmatter === 'object');
  assert.ok(typeof A.sectionCount === 'number' && A.sectionCount >= 4);
});

t('A · frontmatter has 3-必填 keys', () => {
  shouldHaveFrontmatter(A.md, ['business_id', 'business_name', 'generated_at']);
});

t('A · frontmatter populates audit_score + decision (from Stage 3)', () => {
  assert.equal(A.frontmatter.audit_score, 65);
  assert.equal(A.frontmatter.decision, 'moderate_candidate');
});

t('A · frontmatter populates visual scores (from Stage 4)', () => {
  assert.equal(A.frontmatter.visual_freshness, 6);
  assert.equal(A.frontmatter.visual_trust, 7);
  assert.equal(A.frontmatter.visual_conversion, 5);
});

t('A · frontmatter fired_triggers populated', () => {
  assert.deepEqual(A.frontmatter.fired_triggers, ['mobile_broken']);
});

t('A · 内部分级 section present (Stage 5 derived)', () => {
  assert.ok(A.md.includes('内部分级'), 'missing 内部分级 section');
  assert.ok(/投入分级.*[A-D]/.test(A.md), 'must have investment_level A/B/C/D');
});

t('A · 店家现状速览 lists phone/address/website', () => {
  assert.ok(A.md.includes('0411222333'));
  assert.ok(A.md.includes('1 Test St, Sydney NSW 2000'));
  assert.ok(A.md.includes('https://acme.example'));
});

t('A · 线索来源 section · sourceType + sourceQuery + rank', () => {
  assert.ok(A.md.includes('Google Maps (gosom 抓取)'));
  assert.ok(A.md.includes('roofer in sydney'));
  assert.ok(A.md.includes('第 3 位'));
});

t('A · 视觉审计 section · vision issues populated', () => {
  assert.ok(A.md.includes('视觉审计'));
  assert.ok(A.md.includes('Hero image too dark'));
});

t('A · critical issue 3-layer structure (技术事实/普通话/客户影响)', () => {
  assert.ok(A.md.includes('**技术事实**'), 'missing 技术事实 layer');
  assert.ok(A.md.includes('**普通话翻译**'), 'missing 普通话 layer');
  assert.ok(A.md.includes('**对客户的影响**'), 'missing 客户影响 layer');
  assert.ok(A.md.includes('60% 流量直接流失'), 'customer_impact text not interpolated');
});

t('A · 附录 数据出处 · provider + model attribution', () => {
  assert.ok(A.md.includes('附录 · 数据出处'));
  assert.ok(A.md.includes('codex_cli'), 'visual provider must be in attribution');
  assert.ok(A.md.includes('gpt-5'), 'visual model must be in attribution');
});

t('A · no literal "undefined" / "NaN"', () => shouldHaveNoLiteralUndefined(A.md));
t('A · no deprecated terms', () => shouldHaveNoDeprecated(A.md));
t('A · sectionCount matches actual ## heading count', () =>
  assert.equal(A.sectionCount, countSections(A.md)));

// ─── Fixture B: Partial (Stage 3 sub-modules null) ──────────────────────────
const B = buildMasterMdDetailed({
  entity: FIXTURE_B_ENTITY,
  detailedAudit: FIXTURE_B_DETAILED,
  visualAudit: FIXTURE_B_VISUAL,
});

t('B · partial fixture builds without crash', () => {
  assert.ok(B.md.length > 500);
});

t('B · PageSpeed section NOT rendered when pagespeed=null', () => {
  // SOP §1 row 11: PSI section conditional
  assert.ok(!B.md.includes('Google PageSpeed Insights'), 'PSI section should skip when null');
});

t('B · 域名历史 section NOT rendered when domain_history=null', () => {
  assert.ok(!B.md.includes('## 域名历史'), '域名历史 section should skip when null');
});

t('B · 内部分级 still renders (always-on)', () => {
  assert.ok(B.md.includes('内部分级'));
});

t('B · no literal "undefined" / "NaN"', () => shouldHaveNoLiteralUndefined(B.md));
t('B · no deprecated terms', () => shouldHaveNoDeprecated(B.md));

// ─── Fixture C: Minimal (entity only) ──────────────────────────────────────
const C = buildMasterMdDetailed({
  entity: FIXTURE_C_ENTITY,
});

t('C · minimal fixture builds without crash', () => {
  assert.ok(C.md.length > 200);
});

t('C · frontmatter has 3-必填 keys (no detailed_audit)', () => {
  shouldHaveFrontmatter(C.md, ['business_id', 'business_name', 'generated_at']);
});

t('C · audit_score = null (no Stage 3 data)', () => {
  assert.equal(C.frontmatter.audit_score, null);
});

t('C · visual scores = null (no Stage 4 data)', () => {
  assert.equal(C.frontmatter.visual_freshness, null);
  assert.equal(C.frontmatter.visual_trust, null);
});

t('C · minimum 3 sections (内部分级 + 速览 + 附录)', () => {
  assert.ok(C.sectionCount >= 3, `expected ≥3 sections, got ${C.sectionCount}`);
});

t('C · no literal "undefined" / "NaN"', () => shouldHaveNoLiteralUndefined(C.md));

// ─── Cross-fixture invariants ──────────────────────────────────────────────
t('all 3 fixtures · sectionCount === actual ## count', () => {
  assert.equal(A.sectionCount, countSections(A.md));
  assert.equal(B.sectionCount, countSections(B.md));
  assert.equal(C.sectionCount, countSections(C.md));
});

t('all 3 fixtures · valid YAML frontmatter (parseable line-by-line)', () => {
  for (const [name, r] of [['A', A], ['B', B], ['C', C]]) {
    const fmText = r.md.slice(4, r.md.indexOf('\n---\n', 4));
    // Each non-indented line must be `key: value` or `key:` (for nested)
    for (const line of fmText.split('\n')) {
      if (!line.trim() || line.startsWith('  ')) continue;
      assert.ok(/^[a-z_][a-z0-9_]*:/.test(line), `${name} · invalid frontmatter line: "${line}"`);
    }
  }
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
