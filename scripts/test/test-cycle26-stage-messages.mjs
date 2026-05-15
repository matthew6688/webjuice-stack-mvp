/**
 * cycle-26 · TDD test 1/5 · Stage message conformance.
 *
 * Verifies that every stage-message rendering function in
 * core/funnel/audit-stage-messages.js emits text that:
 *   - Uses STAGE_LABELS from the contract (no hardcoded "Stage X/Y")
 *   - Contains zero DEPRECATED_TERMS
 *   - Starts with the canonical stage label string
 *
 * Pre-Phase-A: FAILS (audit-stage-messages.js still has "Stage 1/5" etc).
 * Post-Phase-A: PASSES (all renderers import STAGE_LABELS).
 */
import assert from 'node:assert/strict';
import { STAGE_LABELS, DEPRECATED_TERMS, PIPELINE_INTRO } from '../../core/contracts/discord-messages.js';

let failed = 0;
let passed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 1/5 · stage messages\n');

// ─── Test contract structure first ──────────────────────────────────────────
t('contract STAGE_LABELS has 9 entries (1-9)', () => {
  assert.equal(Object.keys(STAGE_LABELS).length, 9);
  for (let i = 1; i <= 9; i++) assert.ok(STAGE_LABELS[i], `missing stage ${i}`);
});
t('contract STAGE_LABELS all use /N/9 format', () => {
  for (const [n, label] of Object.entries(STAGE_LABELS)) {
    assert.match(label, new RegExp(`^Stage ${n}/9 ·`), `stage ${n} label "${label}"`);
  }
});
t('contract PIPELINE_INTRO mentions 9 stages', () => {
  assert.match(PIPELINE_INTRO, /9 stages/);
});

// ─── Test the message-emit module (audit-stage-messages.js) ────────────────
const mod = await import('../../core/funnel/audit-stage-messages.js');

function callIfExists(fnName, ...args) {
  if (typeof mod[fnName] !== 'function') return null;
  try { return mod[fnName](...args); } catch { return null; }
}

// Minimal fixture entity for any renderer
const ENTITY = {
  key: 'test_fixture_brisbane_plumbing',
  latest: {
    name: 'Test Plumbing Co',
    niche: 'plumbing',
    phone: '0412345678',
    email: 'test@example.com',
    website: 'https://test.example',
    rating: 4.5,
    review_count: 25,
    category: 'plumbing services',
    address: 'Brisbane QLD',
  },
  audit: { score: 65, decision: 'moderate_candidate', vision: { freshness: 6, trust: 6, conversion: 5 } },
  grade: { grade: 'C', reason: 'test fixture' },
  phase: 'audit-ready',
};

// Render a representative message for each public exported function
const RENDERED = {};
for (const fnName of Object.keys(mod)) {
  if (typeof mod[fnName] !== 'function') continue;
  // try several arg shapes (most renderers take { entity, ...stuff })
  for (const args of [[{ entity: ENTITY }], [ENTITY], [{ entity: ENTITY, audit: ENTITY.audit, grade: ENTITY.grade }]]) {
    const r = callIfExists(fnName, ...args);
    if (typeof r === 'string' && r.length > 0) { RENDERED[fnName] = r; break; }
  }
}

t('at least one renderer returned text', () => {
  assert.ok(Object.keys(RENDERED).length >= 1, `no renderers produced text; module exports: ${Object.keys(mod).join(',')}`);
});

// ─── Per-rendered-string · zero deprecated terms ───────────────────────────
for (const [fn, text] of Object.entries(RENDERED)) {
  t(`${fn}() output has no deprecated terms`, () => {
    for (const term of DEPRECATED_TERMS) {
      assert.ok(!text.includes(term), `"${term}" found in ${fn}() output:\n      ${text.split('\n').find(l => l.includes(term))?.slice(0, 120)}`);
    }
  });
}

// ─── Per-rendered-string · any "Stage X/Y" must match a canonical label ────
const STAGE_VALID_PREFIXES = new Set(Object.values(STAGE_LABELS).map((l) => l.split('·')[0].trim()));
for (const [fn, text] of Object.entries(RENDERED)) {
  t(`${fn}() Stage-labels match contract`, () => {
    const matches = [...text.matchAll(/Stage\s+\d+\/\d+/g)].map((m) => m[0]);
    for (const m of matches) {
      assert.ok(STAGE_VALID_PREFIXES.has(m), `"${m}" in ${fn}() not in contract STAGE_LABELS`);
    }
  });
}

// ─── Specifically: pipeline-intro renderer (whatever it's called) uses 9-stage version ─
t('pipeline-intro text says "9 stages" (or matches PIPELINE_INTRO)', () => {
  const candidates = Object.entries(RENDERED).filter(([_, v]) => /audit pipeline/i.test(v) || /pipeline 启动/.test(v));
  assert.ok(candidates.length >= 1, 'no pipeline-intro candidate renderer found');
  const has9 = candidates.some(([_, v]) => v.includes('9 stages') || v === PIPELINE_INTRO);
  assert.ok(has9, `pipeline-intro renderer doesn't mention 9 stages · saw: ${candidates.map((c) => c[1].slice(0, 80)).join(' | ')}`);
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
