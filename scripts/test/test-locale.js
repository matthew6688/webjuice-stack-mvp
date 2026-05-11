#!/usr/bin/env node
/**
 * Block 1.3 hard evidence — locale resolver.
 *
 * Verifies DISCORD_OUTREACH_PRD.md §6.1: deriveLocale produces correct timezone
 * for 4 major AU cities + state fallback + default fallback.
 */

import assert from 'assert/strict';
import { deriveLocale, nowInLocale } from '../../core/leads/locale.js';

const cases = [
  // City exact match
  {
    name: 'Brisbane city exact',
    entity: { latest: { city: 'Brisbane', address: '70 Charlotte St, Brisbane City, QLD 4000' } },
    expect: { timezone: 'Australia/Brisbane', state: 'QLD', country: 'AU' },
  },
  {
    name: 'Sydney city exact',
    entity: { latest: { city: 'Sydney' } },
    expect: { timezone: 'Australia/Sydney', state: 'NSW' },
  },
  {
    name: 'Melbourne city exact',
    entity: { latest: { city: 'Melbourne' } },
    expect: { timezone: 'Australia/Melbourne', state: 'VIC' },
  },
  {
    name: 'Perth city exact',
    entity: { latest: { city: 'Perth' } },
    expect: { timezone: 'Australia/Perth', state: 'WA' },
  },
  // Multi-word city
  {
    name: 'Gold Coast multi-word',
    entity: { latest: { city: 'Gold Coast' } },
    expect: { timezone: 'Australia/Brisbane', state: 'QLD' },
  },
  // Address-only resolution
  {
    name: 'Address-only resolution (Brisbane in address)',
    entity: { latest: { address: '12 George St, Brisbane City, QLD 4000' } },
    expect: { timezone: 'Australia/Brisbane', state: 'QLD' },
  },
  // State code fallback when city not in table
  {
    name: 'Unknown city, NSW state fallback',
    entity: { latest: { city: 'Wagga Wagga', address: '1 Main St, Wagga Wagga NSW 2650' } },
    expect: { timezone: 'Australia/Sydney', state: 'NSW' },
  },
  // Default fallback
  {
    name: 'No city no state -> default Brisbane',
    entity: { latest: { name: 'Mystery Business' } },
    expect: { timezone: 'Australia/Brisbane', state: null },
  },
  // Darwin (different tz)
  {
    name: 'Darwin NT',
    entity: { latest: { city: 'Darwin' } },
    expect: { timezone: 'Australia/Darwin', state: 'NT' },
  },
  // Canberra (uses Sydney tz)
  {
    name: 'Canberra uses Sydney tz',
    entity: { latest: { city: 'Canberra' } },
    expect: { timezone: 'Australia/Sydney', state: 'ACT' },
  },
];

let passed = 0;
const failures = [];
for (const c of cases) {
  const locale = deriveLocale(c.entity);
  try {
    for (const [k, v] of Object.entries(c.expect)) {
      assert.equal(locale[k], v, `${c.name}: ${k} expected ${v} got ${locale[k]}`);
    }
    passed += 1;
  } catch (e) {
    failures.push({ name: c.name, locale, error: e.message });
  }
}

// nowInLocale smoke check — must produce a non-empty string with HH:mm
const sampleNow = nowInLocale({ timezone: 'Australia/Brisbane' }, new Date('2026-05-11T04:00:00.000Z'));
assert.match(sampleNow, /\d{2}:\d{2}/, 'nowInLocale produces HH:mm format');
assert.ok(sampleNow.length > 0);

const summary = {
  ok: failures.length === 0,
  cases_total: cases.length,
  cases_passed: passed,
  sample_now_in_brisbane: sampleNow,
  failures,
};

if (failures.length) {
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(summary, null, 2));
