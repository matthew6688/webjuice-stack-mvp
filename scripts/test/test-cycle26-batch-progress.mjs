/**
 * cycle-26 · TDD test 7/9 · Batch-thread progress line rendering.
 *
 * Verifies lineFor() output for 8 event types · ensures:
 *   - correct emoji per event
 *   - thread URL hyperlink when discord_thread_id exists
 *   - plain bold name when no thread_id
 *   - phase fallback "awaiting" when from/to null (B5 fix)
 *   - score and reason interpolated correctly
 */
import assert from 'node:assert/strict';
import { lineFor } from '../../core/funnel/batch-progress.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 7/9 · batch progress line rendering\n');

const E_WITH_THREAD = {
  entityKey: 'fixture_x',
  latest: { name: 'Acme Roofing' },
  discord_thread_id: '1504670000000000000',
};
const E_NO_THREAD = {
  entityKey: 'fixture_y',
  latest: { name: 'Beta Plumbing' },
};

// ─── thread_opened ──────────────────────────────────────────────────────────
t('thread_opened · emoji 🆕 + name link',
  () => {
    const l = lineFor(E_WITH_THREAD, 'thread_opened');
    assert.ok(l.startsWith('🆕'), `start: ${l.slice(0, 5)}`);
    assert.ok(l.includes('Acme Roofing'));
    assert.ok(l.includes('https://discord.com/channels/'));
    assert.ok(l.includes('#website-leads thread opened'));
  });

// ─── phase_change · fallback awaiting (B5 fix) ──────────────────────────────
t('phase_change · null from → fallback "awaiting"',
  () => {
    const l = lineFor(E_WITH_THREAD, 'phase_change', { from: null, to: 'audit-ready' });
    assert.ok(l.includes('`awaiting`'), `expected fallback "awaiting" · got: ${l}`);
    assert.ok(l.includes('`audit-ready`'));
    assert.ok(!l.includes('`?`'), 'banned "?" fallback');
  });

t('phase_change · undefined from → fallback "awaiting"',
  () => {
    const l = lineFor(E_WITH_THREAD, 'phase_change', { from: undefined, to: 'ready-to-build' });
    assert.ok(l.includes('`awaiting`'));
  });

t('phase_change · valid from + to → both shown',
  () => {
    const l = lineFor(E_WITH_THREAD, 'phase_change', { from: 'audit-ready', to: 'ready-to-build' });
    assert.ok(l.includes('`audit-ready`'));
    assert.ok(l.includes('`ready-to-build`'));
  });

// ─── graded ─────────────────────────────────────────────────────────────────
t('graded · grade C + score 57 → emoji 🎯 + audit 57/100',
  () => {
    const l = lineFor(E_WITH_THREAD, 'graded', { grade: 'C', score: 57 });
    assert.ok(l.startsWith('🎯'));
    assert.ok(l.includes('grade: **C**'));
    assert.ok(l.includes('audit 57/100'));
  });

// ─── qualification ──────────────────────────────────────────────────────────
t('qualification_pass · ✅ + score',
  () => {
    const l = lineFor(E_WITH_THREAD, 'qualification_pass', { score: 72 });
    assert.ok(l.includes('✅') && l.includes('72/100'));
    assert.ok(l.includes('ready-to-build'));
  });

t('qualification_fail · ⚠️ + score',
  () => {
    const l = lineFor(E_WITH_THREAD, 'qualification_fail', { score: 57 });
    assert.ok(l.includes('⚠️') && l.includes('57/100'));
    assert.ok(l.includes('qa-pending'));
  });

// ─── built / published ──────────────────────────────────────────────────────
t('built · 🛠️ Stage 8',
  () => {
    const l = lineFor(E_WITH_THREAD, 'built');
    assert.ok(l.startsWith('🛠️'));
    assert.ok(l.includes('Stage 8'));
  });

t('published · 🚀 + deployUrl',
  () => {
    const l = lineFor(E_WITH_THREAD, 'published', { deployUrl: 'https://acme-roofing-dev.pages.dev' });
    assert.ok(l.startsWith('🚀'));
    assert.ok(l.includes('acme-roofing-dev.pages.dev'));
  });

// ─── archived ───────────────────────────────────────────────────────────────
t('archived · 🗄️ + reason',
  () => {
    const l = lineFor(E_WITH_THREAD, 'archived', { reason: 'stage2_sitemap_too_large' });
    assert.ok(l.startsWith('🗄️'));
    assert.ok(l.includes('stage2_sitemap_too_large'));
  });

// ─── no thread_id fallback ──────────────────────────────────────────────────
t('no discord_thread_id → bold name (no link)',
  () => {
    const l = lineFor(E_NO_THREAD, 'phase_change', { from: 'awaiting', to: 'archived' });
    assert.ok(l.includes('**Beta Plumbing**'), `expected bold name · got: ${l}`);
    assert.ok(!l.includes('https://discord.com/channels/'));
  });

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
