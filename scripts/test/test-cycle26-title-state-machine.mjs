/**
 * cycle-26 · TDD test 6/9 · Thread-title state machine (buildThreadTitle).
 *
 * Covers every phase + grade combination · ensures cycle-26 title format:
 *   awaiting / audit-ready          → [审中]
 *   ready-to-build                  → [待建]
 *   qa-pending                      → [待补]
 *   outreach-active                 → [待发]
 *   replied / proposal-sent / paid  → [已发]
 *   archived                        → no state tag (uses [D] grade tag)
 *
 * Grade tag from entity.grade.grade or grade.investment_level · no more 预X.
 */
import assert from 'node:assert/strict';
import { buildThreadTitle } from '../../core/funnel/display-vocab.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 6/9 · title state machine\n');

function ent(overrides = {}) {
  return {
    entityKey: 'fixture_x',
    latest: { name: 'Acme', niche: 'roofer' },
    ...overrides,
  };
}

// ─── awaiting (Stage 0-3 · no grade yet) ────────────────────────────────────
t('awaiting · no grade → [审中]',
  () => assert.equal(buildThreadTitle(ent({ phase: 'awaiting' }), 'leads'), '[屋顶] [审中] Acme'));

t('awaiting · with predict_grade=C (legacy) → still [审中] · no grade tag',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'awaiting', predict_grade: { grade: 'C' } }), 'leads'),
    '[屋顶] [审中] Acme'));

// ─── audit-ready (Stage 4 done · grade landed · still under review) ─────────
t('audit-ready · grade.grade=C → [审中] [C]',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'audit-ready', grade: { grade: 'C' } }), 'leads'),
    '[屋顶] [审中] [C] Acme'));

t('audit-ready · grade.investment_level=A → [审中] [A]',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'audit-ready', grade: { investment_level: 'A' } }), 'leads'),
    '[屋顶] [审中] [A] Acme'));

t('audit-ready · grade.grade=B → [审中] [B]',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'audit-ready', grade: { grade: 'B' } }), 'leads'),
    '[屋顶] [审中] [B] Acme'));

// ─── ready-to-build (Stage 7 pass) ──────────────────────────────────────────
t('ready-to-build · grade=C → [待建] [C]',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'ready-to-build', grade: { grade: 'C' } }), 'leads'),
    '[屋顶] [待建] [C] Acme'));

// ─── qa-pending (Stage 7 fail) ──────────────────────────────────────────────
t('qa-pending · grade=C → [待补] [C]',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'qa-pending', grade: { grade: 'C' } }), 'leads'),
    '[屋顶] [待补] [C] Acme'));

// ─── outreach-active (Stage 9 publish done · graduated) ────────────────────
t('outreach-active · grade=C → [待发] [C]',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'outreach-active', grade: { grade: 'C' } }), 'projects'),
    '[屋顶] [待发] [C] Acme'));

// ─── replied / paid (later sales stages) ────────────────────────────────────
t('replied · grade=C → [已发] [C]',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'replied', grade: { grade: 'C' } }), 'projects'),
    '[屋顶] [已发] [C] Acme'));

t('paid · grade=B → [已发] [B]',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'paid', grade: { grade: 'B' } }), 'projects'),
    '[屋顶] [已发] [B] Acme'));

// ─── archived (D-grade or terminal) ─────────────────────────────────────────
t('archived · grade.grade=D → [D] · no state tag',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'archived', grade: { grade: 'D' } }), 'leads'),
    '[屋顶] [D] Acme'));

// ─── ensure no [预A]/[预B]/[预C] EVER appear ─────────────────────────────────
t('predict_grade=C without real grade does NOT produce [预C]',
  () => {
    const t = buildThreadTitle(ent({ phase: 'awaiting', predict_grade: { grade: 'C' } }), 'leads');
    assert.ok(!t.includes('[预C]'), `title contains banned [预C]: ${t}`);
    assert.ok(!t.includes('[预B]') && !t.includes('[预A]'), 'banned predict tag present');
  });

// ─── niche fallback ────────────────────────────────────────────────────────
t('unknown niche → [其他]',
  () => assert.equal(
    buildThreadTitle(ent({ phase: 'awaiting', latest: { name: 'X', niche: 'unicycle-repair' } }), 'leads'),
    '[其他] [审中] X'));

// ─── attention emoji suffix ─────────────────────────────────────────────────
t('urgent flag → emoji suffix 🔥',
  () => {
    const r = buildThreadTitle(ent({ phase: 'audit-ready', grade: { grade: 'C' }, urgent: true }), 'leads');
    assert.ok(r.endsWith(' 🔥'), `expected 🔥 suffix · got "${r}"`);
  });

// ─── title length cap ───────────────────────────────────────────────────────
t('title > 100 chars truncated to 100 with …',
  () => {
    const long = 'A'.repeat(120);
    const r = buildThreadTitle(ent({ phase: 'awaiting', latest: { name: long, niche: 'roofer' } }), 'leads');
    assert.ok(r.length <= 100, `title ${r.length} chars > 100`);
    assert.ok(r.endsWith('…'), `expected truncation marker`);
  });

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
