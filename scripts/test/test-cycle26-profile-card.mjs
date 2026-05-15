/**
 * cycle-26 · TDD test 2/5 · Profile card section conformance.
 *
 * Verifies renderProfileCard()'s embed description for 5 entity phases
 * uses only canonical PROFILE_SECTIONS and zero DEPRECATED_TERMS.
 *
 * Pre-Phase-A: FAILS (profile-card.js uses "本地资产" for pre-publish).
 * Post-Phase-A: PASSES (renamed to "现状证据").
 */
import assert from 'node:assert/strict';
import { PROFILE_SECTIONS, DEPRECATED_TERMS } from '../../core/contracts/discord-messages.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 2/5 · profile card sections\n');

const { renderProfileCard } = await import('../../core/funnel/profile-card.js');

function baseEntity(overrides = {}) {
  return {
    key: 'test_fixture',
    latest: {
      name: 'Test Plumbing',
      niche: 'plumbing',
      phone: '0412345678',
      email: 't@example.com',
      website: 'https://t.example',
      rating: 4.5,
      review_count: 25,
      category: 'plumber',
      address: '1 Test St, Brisbane QLD',
      timezone: 'Australia/Brisbane',
    },
    audit: { score: 65, decision: 'moderate_candidate', vision: { freshness: 6, trust: 6, conversion: 5, style: 'slightly_outdated' } },
    discovery_query: 'plumber in brisbane',
    ...overrides,
  };
}

const FIXTURES = [
  { name: 'awaiting (Stage 0-3 · 审中 · 无 grade)',     entity: baseEntity({ phase: 'awaiting' }) },
  { name: 'audit-ready (Stage 4 done · grade=C · 审中)', entity: baseEntity({ phase: 'audit-ready', grade: { grade: 'C', reason: 'test' } }) },
  { name: 'qa-pending (Stage 6 fail · 待补)',           entity: baseEntity({ phase: 'qa-pending',  grade: { grade: 'C' }, qualification: { scorecard: { total: 57 } } }) },
  { name: 'ready-to-build (Stage 6 pass · 待建)',       entity: baseEntity({ phase: 'ready-to-build', grade: { grade: 'C' }, qualification: { scorecard: { total: 72 } } }) },
  { name: 'archived (Stage 1 排除 / Stage 4 D)',        entity: baseEntity({ phase: 'archived', grade: { grade: 'D' }, archive_reason: 'excluded_layer_2_too_large' }) },
];

const RENDERED = [];
for (const f of FIXTURES) {
  let r;
  try { r = renderProfileCard(f.entity); } catch (e) { r = { __err: e.message }; }
  RENDERED.push({ ...f, rendered: r });
}

t('renderProfileCard() returns embed for all 5 fixtures', () => {
  for (const r of RENDERED) {
    assert.ok(!r.rendered.__err, `${r.name} crashed: ${r.rendered.__err}`);
    assert.ok(r.rendered && typeof r.rendered === 'object', `${r.name} did not return an object`);
  }
});

for (const r of RENDERED) {
  t(`${r.name} · description present`, () => {
    const desc = r.rendered.description || r.rendered.embeds?.[0]?.description || '';
    assert.ok(desc.length > 0, `empty description`);
    r.desc = desc;
  });
}

// Re-extract desc for all
for (const r of RENDERED) {
  r.desc = r.rendered.description || r.rendered.embeds?.[0]?.description || '';
}

// All section headers in description must be from PROFILE_SECTIONS
const SECTION_RE = /━━━\s+([^━]+?)\s+━━━/g;
for (const r of RENDERED) {
  t(`${r.name} · section headers all from contract`, () => {
    const sections = [...r.desc.matchAll(SECTION_RE)].map((m) => m[1].trim().split('(')[0].trim());
    for (const s of sections) {
      assert.ok(PROFILE_SECTIONS.includes(s), `section "${s}" not in PROFILE_SECTIONS: [${PROFILE_SECTIONS.join(', ')}]`);
    }
  });
}

// No deprecated terms in any description
for (const r of RENDERED) {
  t(`${r.name} · no deprecated terms`, () => {
    for (const term of DEPRECATED_TERMS) {
      assert.ok(!r.desc.includes(term), `"${term}" in ${r.name} description`);
    }
  });
}

// Pre-publish entity (ready-to-build, audit-ready) MUST show 现状证据 section (not 本地资产)
t('ready-to-build entity description contains "现状证据" section', () => {
  const r = RENDERED.find((x) => x.entity.phase === 'ready-to-build');
  assert.ok(r.desc.includes('━━━ 现状证据'), `expected "现状证据" section in ready-to-build entity, saw:\n${r.desc.slice(0, 600)}`);
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
