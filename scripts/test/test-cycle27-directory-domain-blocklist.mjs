/**
 * cycle-27 · TDD · directory-domain blocklist
 *
 * Matthew (2026-05-16): Dubbo Terrazzo bug · docker scraper used
 * websiteDomain=localsearch.com.au (a directory site) to generate
 * entityKey=domain_localsearch.com.au · multiple real businesses listing
 * on the same directory would clobber each other.
 *
 * Contract: discoveryEntityKey must NOT generate domain_<dir> when the
 * detected website domain is in DIRECTORY_DOMAINS. Should fall through to
 * data_id (preferred) or name+location.
 */
import assert from 'node:assert/strict';
import { discoveryEntityKey, isDirectoryDomain, DIRECTORY_DOMAINS }
  from '../../core/leads/discovery-store.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · directory-domain blocklist\n');

t('DIRECTORY_DOMAINS includes common AU directories', () => {
  for (const d of ['localsearch.com.au', 'yellowpages.com.au', 'truelocal.com.au',
                   'oneflare.com.au', 'hipages.com.au']) {
    assert.ok(DIRECTORY_DOMAINS.has(d), `missing ${d}`);
  }
});

t('isDirectoryDomain · localsearch.com.au → true', () => {
  assert.equal(isDirectoryDomain('localsearch.com.au'), true);
});

t('isDirectoryDomain · www.localsearch.com.au → true (strips www)', () => {
  assert.equal(isDirectoryDomain('www.localsearch.com.au'), true);
});

t('isDirectoryDomain · LOCALSEARCH.com.au → true (case-insensitive)', () => {
  assert.equal(isDirectoryDomain('LOCALSEARCH.com.au'), true);
});

t('isDirectoryDomain · real business domain → false', () => {
  assert.equal(isDirectoryDomain('aceroofing.com.au'), false);
  assert.equal(isDirectoryDomain('vipgroup.com.au'), false);
});

// ─── core regression · Dubbo Terrazzo scenario ──────────────────────
t('Dubbo Terrazzo · data_id wins over directory domain', () => {
  const key = discoveryEntityKey({
    sourceType: 'maps_scraper',
    name: 'Dubbo Terrazzo and Concrete Industries',
    website: 'https://www.localsearch.com.au/business/dubbo-terrazzo',
    data_id: '0x6b0f71db5835f7ef:0x1f978fc06239b475',
    city: 'Dubbo',
  });
  assert.ok(key.startsWith('dataid_'), `got ${key} · should start with dataid_`);
  assert.ok(!key.includes('localsearch'), `key must NOT contain localsearch · got ${key}`);
});

t('No data_id · directory domain → falls back to name+location', () => {
  const key = discoveryEntityKey({
    sourceType: 'web_scrape',
    name: 'Some Business',
    website: 'https://localsearch.com.au/listing/foo',
    city: 'Sydney',
  });
  assert.ok(!key.startsWith('domain_'), `should not be domain_* · got ${key}`);
  assert.ok(key.startsWith('name_'), `expected name_ · got ${key}`);
});

t('Real business domain · still maps to domain_*', () => {
  const key = discoveryEntityKey({
    sourceType: 'web_scrape',
    name: 'Ace Roofing',
    website: 'https://aceroofing.com.au',
  });
  assert.equal(key, 'domain_aceroofing.com.au');
});

t('place_id ALWAYS wins · directory domain irrelevant', () => {
  const key = discoveryEntityKey({
    place_id: 'ChIJabc123',
    website: 'https://localsearch.com.au/business/foo',
  });
  assert.equal(key.toLowerCase(), 'place_chijabc123');
});

t('cid wins over data_id (cid more canonical)', () => {
  const key = discoveryEntityKey({
    cid: '9999',
    data_id: '0xabc:0xdef',
    website: 'https://localsearch.com.au/foo',
  });
  assert.equal(key, 'cid_9999');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
