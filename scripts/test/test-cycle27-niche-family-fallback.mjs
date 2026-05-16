/**
 * cycle-27 · TDD · niche → reference family fallback
 *
 * Matthew (2026-05-16): Bug C · electrician audit reached ready-to-build · auto-chained
 * build · resolveReferenceSite threw "No reference family registered for niche=electrician"
 * → 5 leads stuck in ready-to-build forever (build never completes · publish never fires).
 *
 * Contract: resolveReferenceSite must NEVER hard-throw for service-trade niches.
 * Registered trade niches map directly · unknown niches log warning + fallback to
 * TRADES_DEFAULT_FAMILY (currently classic-premium-roftix).
 */
import assert from 'node:assert/strict';
import { resolveReferenceSite } from '../../core/leads/reference-adapter-handoff.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · niche → family fallback\n');

t('roofing → classic-premium-roftix (existing)', () => {
  const r = resolveReferenceSite({ niche: 'roofing' });
  assert.equal(r.family, 'classic-premium-roftix');
});

t('electrician → classic-premium-roftix (Bug C fix)', () => {
  const r = resolveReferenceSite({ niche: 'electrician' });
  assert.equal(r.family, 'classic-premium-roftix');
});

t('plumber → classic-premium-roftix (Bug C fix)', () => {
  const r = resolveReferenceSite({ niche: 'plumber' });
  assert.equal(r.family, 'classic-premium-roftix');
});

t('concreter → classic-premium-roftix', () => {
  const r = resolveReferenceSite({ niche: 'concreter' });
  assert.equal(r.family, 'classic-premium-roftix');
});

t('Electrical Contractor → substring match → roftix', () => {
  const r = resolveReferenceSite({ niche: 'Electrical Contractor' });
  assert.equal(r.family, 'classic-premium-roftix');
});

t('Roof Restoration Services → substring match → roftix', () => {
  const r = resolveReferenceSite({ niche: 'Roof Restoration Services' });
  assert.equal(r.family, 'classic-premium-roftix');
});

t('totally unknown niche · falls back · does NOT throw', () => {
  const r = resolveReferenceSite({ niche: 'astrologer-and-tarot' });
  assert.equal(r.family, 'classic-premium-roftix');
});

t('empty niche · falls back · does NOT throw', () => {
  const r = resolveReferenceSite({ niche: '' });
  assert.equal(r.family, 'classic-premium-roftix');
});

t('explicit family override always wins', () => {
  const r = resolveReferenceSite({ niche: 'roofing', family: 'classic-premium-roftix' });
  assert.equal(r.family, 'classic-premium-roftix');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
