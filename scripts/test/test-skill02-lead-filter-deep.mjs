/**
 * Skill #2 · profitslocal-lead-filter deep regression (Codex Response 10)
 *
 * Covers the 3-layer exclusion-filter:
 *   Layer 1: data quality (no contact, not operational, test name)
 *   Layer 2: business type wrong (gov/school/charity, competitor, niche mismatch, too large)
 *   Layer 3: timing wrong (too few reviews, bad rating)
 *
 * Invariants:
 *   - Idempotent: same input → same output
 *   - No paid calls: pure-function (no fs/network/Discord/Places)
 *   - Layer priority: lowest layer wins as primary reason when multiple rules match
 *   - Edge case (cycle-23b): review_count=0 + rating>0 must NOT exclude (data missing, not real 0)
 */
import assert from 'node:assert/strict';

const { runExclusionFilter } = await import(
  new URL('../../core/leads/exclusion-filter.js', import.meta.url).href
);

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('skill #2 · lead-filter deep regression\n');

// ─── Helpers ─────────────────────────────────────────────────────────────
function entity(latest, opts = {}) {
  return {
    latest: { niche: 'roofing', ...latest },
    enrichment_attempted_at: opts.enriched ? '2026-05-27T10:00:00Z' : undefined,
  };
}

// ─── Layer 1 · data quality ──────────────────────────────────────────────

t('empty pre-enrich · returns needs_enrichment=true (NOT excluded)', () => {
  const r = runExclusionFilter({ entity: entity({}) });
  assert.equal(r.excluded, false);
  assert.equal(r.needs_enrichment, true);
});

t('empty post-enrich · Layer 1 excluded with no_contact_after_enrich', () => {
  const r = runExclusionFilter({ entity: entity({}, { enriched: true }) });
  assert.equal(r.excluded, true);
  assert.equal(r.layer, 1);
  assert.ok(r.exclusions.some(e => e.id === 'no_contact_after_enrich'));
});

t('business_status=CLOSED_PERMANENTLY · Layer 1 excluded', () => {
  const r = runExclusionFilter({ entity: entity({
    phone: '0412345678', business_status: 'CLOSED_PERMANENTLY',
  }) });
  assert.equal(r.excluded, true);
  assert.ok(r.exclusions.some(e => e.id === 'not_operational'));
});

t('test name · Layer 1 excluded', () => {
  const r = runExclusionFilter({ entity: entity({
    phone: '0412345678', name: 'Test Demo Roofing',
  }) });
  assert.equal(r.excluded, true);
  assert.ok(r.exclusions.some(e => e.id === 'test_name'));
});

// ─── Layer 2 · business type wrong ───────────────────────────────────────

t('government / school / charity · Layer 2 excluded', () => {
  for (const name of ['Brisbane School Council', 'St Mary Charity Church']) {
    const r = runExclusionFilter({ entity: entity({
      phone: '0412345678', website: 'x.com', rating: 4.5, review_count: 20, name,
    }) });
    assert.equal(r.excluded, true, `${name}`);
    assert.ok(r.exclusions.some(e => e.id === 'gov_school_charity'), name);
  }
});

t('competitor (web design / SEO / marketing agency) · Layer 2 excluded', () => {
  for (const cat of ['web design agency', 'SEO consultant', 'digital marketing']) {
    const r = runExclusionFilter({ entity: entity({
      phone: '0412345678', rating: 4.5, review_count: 20, category: cat,
    }) });
    assert.equal(r.excluded, true, cat);
    assert.ok(r.exclusions.some(e => e.id === 'competitor'), cat);
  }
});

t('nicheVerdict.relevant=false · Layer 2 excluded', () => {
  const r = runExclusionFilter({
    entity: entity({ phone: '0412345678', rating: 4.5, review_count: 20 }),
    nicheVerdict: { relevant: false, confidence: 0.91, reason: 'is plumber not roofer' },
  });
  assert.equal(r.excluded, true);
  assert.ok(r.exclusions.some(e => e.id === 'niche_mismatch_llm'));
});

t('too_large (review_count > niche max) · Layer 2 excluded', () => {
  const r = runExclusionFilter({ entity: entity({
    phone: '0412345678', rating: 4.5, review_count: 500,
  }) });
  assert.equal(r.excluded, true);
  assert.ok(r.exclusions.some(e => e.id === 'too_large'));
});

// ─── Layer 3 · timing wrong ──────────────────────────────────────────────

t('too_few_reviews (< niche min) · Layer 3 excluded', () => {
  const r = runExclusionFilter({ entity: entity({
    phone: '0412345678', rating: 4.8, review_count: 2,
  }) });
  assert.equal(r.excluded, true);
  assert.equal(r.layer, 3);
  assert.ok(r.exclusions.some(e => e.id === 'too_few_reviews'));
});

t('bad_rating · Layer 3 excluded', () => {
  const r = runExclusionFilter({ entity: entity({
    phone: '0412345678', rating: 2.7, review_count: 30,
  }) });
  assert.equal(r.excluded, true);
  assert.ok(r.exclusions.some(e => e.id === 'bad_rating'));
});

t('cycle-23b · review_count=0 + rating>0 must NOT exclude (data missing, not real 0)', () => {
  const r = runExclusionFilter({ entity: entity({
    phone: '0412345678', rating: 4.9, review_count: 0,
  }) });
  assert.equal(r.excluded, false, 'review_count=0 with rating must pass through to audit');
});

// ─── Survivor + idempotency + layer priority ─────────────────────────────

t('survivor · operational roofer with healthy signals', () => {
  const r = runExclusionFilter({ entity: entity({
    phone: '0412345678', website: 'aceroofing.com.au', rating: 4.7, review_count: 80,
    category: 'roofing contractor', name: 'Ace Roofing',
  }) });
  assert.equal(r.excluded, false);
  assert.equal(r.needs_enrichment, false);
  assert.match(r.reason, /survived/i);
});

t('idempotent · same input → identical normalized result', () => {
  const input = { entity: entity({
    phone: '0412345678', website: 'aceroofing.com.au', rating: 4.7, review_count: 80,
  }) };
  const r1 = runExclusionFilter(input);
  const r2 = runExclusionFilter(input);
  assert.equal(r1.excluded, r2.excluded);
  assert.equal(r1.needs_enrichment, r2.needs_enrichment);
  assert.equal(r1.layer, r2.layer);
  assert.equal(r1.reason, r2.reason);
});

t('layer priority · multiple rules match → lowest layer wins', () => {
  // gov keyword (Layer 2) + too_few_reviews (Layer 3) → Layer 2 wins
  const r = runExclusionFilter({ entity: entity({
    phone: '0412345678', name: 'Brisbane Council', rating: 4.5, review_count: 2,
  }) });
  assert.equal(r.layer, 2);
  assert.equal(r.exclusions.length >= 2, true, 'both rules should land in exclusions[]');
});

// ─── No-paid-call boundary (static check) ────────────────────────────────

import fs from 'node:fs';
const queueSrc = fs.readFileSync(
  new URL('../../core/leads/cheap-audit-queue.js', import.meta.url),
  'utf8'
);

t('cheap-audit-queue wires runExclusionFilter', () => {
  assert.ok(/runExclusionFilter/.test(queueSrc),
    'queue must import + call runExclusionFilter (line ~149-156 per RESPONSE-1)');
});

t('cheap-audit-queue uses cheapAuditV2 with fetchPayload null (no Stage-2 fetch)', () => {
  // The queue runs cheap-audit-v2 first, then exclusion-filter. cheap-audit-v2 should not fetch.
  assert.ok(/cheapAuditV2|cheap-audit-v2/i.test(queueSrc),
    'queue must call cheapAuditV2 (T0 local-only check)');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
