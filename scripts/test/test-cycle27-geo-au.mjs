/**
 * cycle-27 · TDD test · core/geo/au.js + core/geo/index.js
 *
 * Why: Places intake had a hardcoded city list missing toowoomba and most
 * QLD/VIC regional centers. Matthew (2026-05-15): "add support for all
 * australia cities · we will expand to other countries as well in the future."
 *
 * Contract:
 *   - All 8 capital cities supported (sydney/melbourne/brisbane/perth/
 *     adelaide/hobart/canberra/darwin)
 *   - Multi-word cities match greedy (longest substring first)
 *   - State assigned correctly
 *   - Multi-country router (index.js) defaults to scan all registered countries
 *   - Test entity used in cairns E2E (toowoomba · cairns · gold coast · etc) all match
 */
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · geo AU + multi-country router\n');

const au = await import('../../core/geo/au.js');
const router = await import('../../core/geo/index.js');

// ─── T1 · all 8 capital cities exist ─────────────────────────────────
t('AU module covers all 8 capital cities', () => {
  for (const cap of ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'hobart', 'canberra', 'darwin']) {
    assert.ok(au.CITIES.includes(cap), `missing capital: ${cap}`);
  }
});

// ─── T2 · regional centers (Matthew's gap list) ──────────────────────
t('AU module covers QLD regional centers (toowoomba/cairns/townsville/etc)', () => {
  for (const c of ['toowoomba', 'cairns', 'townsville', 'mackay', 'rockhampton',
                   'bundaberg', 'ipswich', 'logan', 'gold coast', 'sunshine coast']) {
    assert.ok(au.CITIES.includes(c), `missing QLD city: ${c}`);
  }
});

t('AU module covers VIC regional centers', () => {
  for (const c of ['geelong', 'ballarat', 'bendigo', 'shepparton', 'mildura']) {
    assert.ok(au.CITIES.includes(c), `missing VIC city: ${c}`);
  }
});

t('AU module covers NSW regional centers', () => {
  for (const c of ['newcastle', 'wollongong', 'central coast', 'tweed heads',
                   'wagga wagga', 'port macquarie', 'coffs harbour']) {
    assert.ok(au.CITIES.includes(c), `missing NSW city: ${c}`);
  }
});

t('AU module covers WA / SA / TAS / NT', () => {
  for (const c of ['mandurah', 'bunbury', 'geraldton',           // WA
                   'mount gambier', 'whyalla',                    // SA
                   'launceston', 'devonport',                     // TAS
                   'alice springs', 'palmerston']) {              // NT
    assert.ok(au.CITIES.includes(c), `missing: ${c}`);
  }
});

// ─── T3 · greedy multi-word match ────────────────────────────────────
t('parseCityFromQuery returns "gold coast" not "coast" for "roofer in gold coast"', () => {
  const r = au.parseCityFromQuery('roofer in gold coast');
  assert.equal(r?.city, 'gold coast');
  assert.equal(r?.state, 'QLD');
});

t('parseCityFromQuery returns "central coast" for NSW central coast query', () => {
  const r = au.parseCityFromQuery('plumber in central coast');
  assert.equal(r?.city, 'central coast');
  assert.equal(r?.state, 'NSW');
});

t('parseCityFromQuery returns "wagga wagga" multi-word', () => {
  const r = au.parseCityFromQuery('electrician in wagga wagga nsw');
  assert.equal(r?.city, 'wagga wagga');
  assert.equal(r?.state, 'NSW');
});

// ─── T4 · word-boundary · no false-positive substring match ─────────
t('parseCityFromQuery does NOT match city inside a word', () => {
  // "adelaide" should not match in "missadelaides" (synthetic test)
  const r = au.parseCityFromQuery('plumberinadelaidersomething');
  // "adelaide" inside the word should NOT match
  assert.equal(r, null, `false positive: ${JSON.stringify(r)}`);
});

// ─── T5 · stateForCity lookup ────────────────────────────────────────
t('stateForCity returns correct state for cities (incl. regionals)', () => {
  assert.equal(au.stateForCity('toowoomba'), 'QLD');
  assert.equal(au.stateForCity('geelong'), 'VIC');
  assert.equal(au.stateForCity('mount gambier'), 'SA');
  assert.equal(au.stateForCity('alice springs'), 'NT');
  assert.equal(au.stateForCity('Hobart'), 'TAS');         // case-insensitive
  assert.equal(au.stateForCity('not-a-city'), null);
});

// ─── T6 · multi-country router (index.js) ─────────────────────────────
t('index.parseCityFromQuery routes to AU by default', () => {
  const r = router.parseCityFromQuery('dentist in cairns');
  assert.equal(r?.city, 'cairns');
  assert.equal(r?.country, 'AU');
  assert.equal(r?.country_name, 'Australia');
});

t('index.parseCityFromQuery respects opts.country filter', () => {
  // Pinning to AU should still find toowoomba
  const r = router.parseCityFromQuery('electrician in toowoomba', { country: 'AU' });
  assert.equal(r?.city, 'toowoomba');
  // Pinning to US (no module yet) should miss AU city
  const r2 = router.parseCityFromQuery('electrician in toowoomba', { country: 'US' });
  assert.equal(r2, null);
});

t('index.listCities returns all when no country given', () => {
  const all = router.listCities();
  assert.ok(all.length >= 80, `expected ≥80 cities · got ${all.length}`);
});

t('index.supportedCountries lists AU registered', () => {
  const list = router.supportedCountries();
  const au_entry = list.find((c) => c.code === 'AU');
  assert.ok(au_entry, 'AU not registered');
  assert.ok(au_entry.city_count > 0);
});

// ─── T7 · contract for future country modules ─────────────────────────
t('AU module exports the required shape (contract for future countries)', () => {
  for (const sym of ['COUNTRY', 'COUNTRY_NAME', 'CITIES', 'CITIES_BY_STATE',
                     'parseCityFromQuery', 'stateForCity']) {
    assert.ok(sym in au, `AU missing export: ${sym}`);
  }
  assert.equal(au.COUNTRY, 'AU');
  assert.equal(au.COUNTRY_NAME, 'Australia');
  assert.ok(Array.isArray(au.CITIES));
  assert.ok(typeof au.CITIES_BY_STATE === 'object');
  assert.ok(typeof au.parseCityFromQuery === 'function');
  assert.ok(typeof au.stateForCity === 'function');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
