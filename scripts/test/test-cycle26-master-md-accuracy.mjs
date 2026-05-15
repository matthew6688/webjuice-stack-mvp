/**
 * cycle-26 · TDD test 14/14 · master.md frontmatter ↔ entity accuracy.
 *
 * 核心 invariant (Matthew):
 *   "report 里的内容都是准确的"
 *
 * 数据流: entity.json + detailed_audit.json + visual_audit.json
 *      → buildMasterMdDetailed → frontmatter YAML
 *
 * Tests:
 *   - frontmatter.audit_score === detailedAudit.audit_score
 *   - frontmatter.visual_freshness === visualAudit.freshness_score
 *   - frontmatter.business_name === entity.latest.name
 *   - frontmatter.rating === entity.latest.rating (exact match · including 0/null)
 *   - frontmatter.review_count === entity.latest.review_count
 *   - Numbers DO NOT silently drop precision (4.7 stays 4.7 not 4)
 *   - Arrays preserve order (fired_triggers)
 *   - Null fields remain null (not "null" string)
 */
import assert from 'node:assert/strict';
import { buildMasterMdDetailed } from '../../core/reports/master-md-builder.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 14/14 · master.md frontmatter accuracy\n');

// ─── Round-trip · build then parse · assert values match source ────────────
function buildAndParse(entityIn, detailedIn, visualIn) {
  const r = buildMasterMdDetailed({ entity: entityIn, detailedAudit: detailedIn, visualAudit: visualIn });
  return { fm: r.frontmatter, md: r.md };
}

// ─── F1 · business identity ────────────────────────────────────────────────
t('business_id === entity.entityKey', () => {
  const { fm } = buildAndParse({ entityKey: 'place_xyz123', latest: { name: 'X' } });
  assert.equal(fm.business_id, 'place_xyz123');
});

t('business_name === entity.latest.name (verbatim, with spaces/punctuation)', () => {
  const { fm } = buildAndParse({
    entityKey: 'k',
    latest: { name: "O'Brien & Co · Roofing Pty Ltd" },
  });
  assert.equal(fm.business_name, "O'Brien & Co · Roofing Pty Ltd");
});

// ─── F2 · rating / review_count fidelity ───────────────────────────────────
t('rating preserves decimal precision (4.7 NOT 4 or 4.70)', () => {
  const { fm } = buildAndParse({ entityKey: 'k', latest: { name: 'X', rating: 4.7 } });
  assert.equal(fm.rating, 4.7);
});

t('review_count = 0 (genuine zero) is NOT converted to null', () => {
  const { fm } = buildAndParse({ entityKey: 'k', latest: { name: 'X', review_count: 0 } });
  assert.equal(fm.review_count, 0);
});

t('rating null when entity.latest.rating undefined', () => {
  const { fm } = buildAndParse({ entityKey: 'k', latest: { name: 'X' } });
  assert.equal(fm.rating, null);
});

// ─── F3 · audit_score / decision (Stage 3 lineage) ────────────────────────
t('audit_score === detailedAudit.audit_score', () => {
  const { fm } = buildAndParse(
    { entityKey: 'k', latest: { name: 'X' } },
    { audit_score: 38, decision: 'strong_redesign' },
  );
  assert.equal(fm.audit_score, 38);
  assert.equal(fm.decision, 'strong_redesign');
});

t('audit_score 0 (impossible · but tested for fidelity)', () => {
  const { fm } = buildAndParse(
    { entityKey: 'k', latest: { name: 'X' } },
    { audit_score: 0, decision: 'critical' },
  );
  assert.equal(fm.audit_score, 0);
});

// ─── F4 · visual scores (Stage 4 lineage) ──────────────────────────────────
t('visual scores === visualAudit.{freshness,trust,conversion}_score', () => {
  const { fm } = buildAndParse(
    { entityKey: 'k', latest: { name: 'X' } },
    null,
    { freshness_score: 6, trust_score: 7, conversion_score: 5, design_age_estimate: 'outdated' },
  );
  assert.equal(fm.visual_freshness, 6);
  assert.equal(fm.visual_trust, 7);
  assert.equal(fm.visual_conversion, 5);
  assert.equal(fm.visual_age, 'outdated');
});

t('visual scores null when visualAudit absent', () => {
  const { fm } = buildAndParse({ entityKey: 'k', latest: { name: 'X' } });
  assert.equal(fm.visual_freshness, null);
  assert.equal(fm.visual_trust, null);
  assert.equal(fm.visual_conversion, null);
});

// ─── F5 · fired_triggers preserves order + content ─────────────────────────
t('fired_triggers preserves input order', () => {
  const { fm } = buildAndParse(
    { entityKey: 'k', latest: { name: 'X' } },
    { hard_triggers: ['mobile_broken', 'no_https', 'no_visible_cta_or_phone'] },
  );
  assert.deepEqual(fm.fired_triggers, ['mobile_broken', 'no_https', 'no_visible_cta_or_phone']);
});

t('fired_triggers empty array when no triggers fired', () => {
  const { fm } = buildAndParse({ entityKey: 'k', latest: { name: 'X' } });
  assert.deepEqual(fm.fired_triggers, []);
});

// ─── F6 · md body interpolations match frontmatter ─────────────────────────
t('md body shows same audit_score as frontmatter (no drift)', () => {
  const { fm, md } = buildAndParse(
    { entityKey: 'k', latest: { name: 'X', rating: 4.8, review_count: 25 } },
    { audit_score: 42, decision: 'strong_redesign' },
  );
  // Body has the score in the title-line bullet
  assert.ok(md.includes(`${fm.audit_score}/100`), `body must show audit_score · got fm.audit_score=${fm.audit_score}`);
  assert.ok(md.includes(`${fm.review_count} 条`));
});

// ─── F7 · YAML serialization · no JSON.stringify leaking ───────────────────
t('YAML serializes business_name as quoted string', () => {
  const { md } = buildAndParse(
    { entityKey: 'k', latest: { name: 'Has: Colon · Special' } },
  );
  // business_name has colon → MUST be JSON.stringify-quoted to escape
  const fmText = md.slice(4, md.indexOf('\n---\n', 4));
  const line = fmText.split('\n').find((l) => l.startsWith('business_name:'));
  assert.ok(line.includes('"'), `business_name with colon must be quoted: ${line}`);
});

t('YAML preserves null as null (not "null")', () => {
  const { md } = buildAndParse({ entityKey: 'k', latest: { name: 'X' } });
  const fmText = md.slice(4, md.indexOf('\n---\n', 4));
  // rating: null (not "null" string-quoted)
  assert.ok(fmText.includes('rating: null'), `null must be unquoted YAML null`);
  assert.ok(!fmText.includes('rating: "null"'));
});

// ─── F8 · no NaN / undefined in any interpolated value ─────────────────────
t('full audit · no literal "undefined" / "NaN" anywhere', () => {
  const { md } = buildAndParse(
    { entityKey: 'k', latest: { name: 'X', rating: 4.7, review_count: 100, niche: 'roofer', city: 'sydney' } },
    {
      audit_score: 65, decision: 'moderate_candidate', audit_version: 'v2',
      hard_triggers: ['mobile_broken'],
      issues: { critical: [{ id: 'c1', title: 'crit', rationale: 'r', plain_language: 'p', customer_impact: 'i' }], major: [], minor: [] },
    },
    { freshness_score: 6, trust_score: 7, conversion_score: 5, design_age_estimate: 'outdated', summary: 's', positive_observations: ['p1'], issues: [] },
  );
  assert.ok(!md.includes(': undefined') && !md.match(/\bundefined\b/),
    `body contains literal undefined`);
  assert.ok(!md.includes(': NaN') && !md.match(/\bNaN\b/),
    `body contains literal NaN`);
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
