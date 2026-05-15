/**
 * core/geo/au.js · Australia geographic dictionary
 *
 * Cities + suburbs that appear in Google Maps searches. Used to parse
 * `--query` strings like "roofer in toowoomba" into structured city + state.
 *
 * Coverage criteria:
 *   - All capital cities (8) · every state/territory
 *   - Major regional centers (population > 25k or LGA seat of regional area)
 *   - Common search-term spellings (incl. multi-word: "gold coast", "sunshine coast")
 *
 * Multi-word cities listed FIRST in arrays so substring match wins over
 * single-word collision (e.g. "gold coast" should match before "coast").
 *
 * Future: when expanding to other countries, mirror this file:
 *   core/geo/us.js · core/geo/nz.js · core/geo/uk.js · core/geo/ca.js
 * Register in core/geo/index.js.
 */

export const COUNTRY = 'AU';
export const COUNTRY_NAME = 'Australia';

// state → cities (multi-word first per state)
export const CITIES_BY_STATE = Object.freeze({
  NSW: [
    // multi-word first
    'central coast', 'tweed heads', 'wagga wagga', 'port macquarie',
    'coffs harbour', 'broken hill', 'byron bay',
    // single-word
    'sydney', 'newcastle', 'wollongong', 'maitland', 'albury', 'tamworth',
    'orange', 'dubbo', 'bathurst', 'lismore', 'nowra', 'goulburn',
    'queanbeyan', 'armidale', 'griffith', 'cessnock', 'parramatta',
    'penrith', 'liverpool', 'campbelltown', 'blacktown', 'bankstown',
    'hornsby', 'manly', 'bondi', 'chatswood',
  ],
  VIC: [
    'mornington peninsula',
    'melbourne', 'geelong', 'ballarat', 'bendigo', 'shepparton', 'mildura',
    'warrnambool', 'wodonga', 'traralgon', 'sale', 'horsham',
    'frankston', 'dandenong', 'ringwood', 'box hill', 'footscray',
    'st kilda', 'richmond', 'fitzroy', 'brunswick', 'preston',
  ],
  QLD: [
    'gold coast', 'sunshine coast', 'hervey bay', 'mount isa',
    'brisbane', 'townsville', 'cairns', 'toowoomba', 'mackay',
    'rockhampton', 'bundaberg', 'gladstone', 'ipswich', 'logan',
    'redland', 'caboolture', 'maroochydore', 'noosa', 'mooloolaba',
    'fortitude valley', 'south brisbane', 'paddington', 'new farm',
    'indooroopilly', 'chermside', 'mount gravatt', 'cleveland',
  ],
  WA: [
    'port hedland',
    'perth', 'mandurah', 'bunbury', 'geraldton', 'kalgoorlie', 'albany',
    'broome', 'karratha', 'busselton', 'fremantle', 'joondalup',
    'rockingham', 'midland', 'subiaco', 'cottesloe', 'scarborough',
  ],
  SA: [
    'mount gambier', 'murray bridge', 'port lincoln', 'port augusta',
    'adelaide', 'whyalla', 'gawler', 'glenelg', 'mawson lakes',
    'unley', 'norwood', 'prospect',
  ],
  TAS: [
    'hobart', 'launceston', 'devonport', 'burnie', 'kingston',
    'glenorchy', 'sandy bay', 'battery point',
  ],
  ACT: [
    'canberra', 'belconnen', 'tuggeranong', 'woden', 'gungahlin',
    'queanbeyan', // shares with NSW but commonly Canberra metro
  ],
  NT: [
    'alice springs',
    'darwin', 'palmerston', 'katherine', 'tennant creek', 'nhulunbuy',
  ],
});

// Flat list, multi-word entries first within each state (for greedy match)
export const CITIES = Object.freeze(
  Object.values(CITIES_BY_STATE).flat(),
);

// Reverse map for state lookup
const CITY_TO_STATE = (() => {
  const m = new Map();
  for (const [state, cities] of Object.entries(CITIES_BY_STATE)) {
    for (const c of cities) {
      // First-wins · so VIC.frankston (also exists in places·) stays VIC.
      if (!m.has(c)) m.set(c, state);
    }
  }
  return m;
})();

export function stateForCity(city) {
  return CITY_TO_STATE.get(String(city || '').toLowerCase()) || null;
}

/**
 * Greedy match · longest-substring first.
 * Returns { city, state, country } or null.
 */
export function parseCityFromQuery(query) {
  const lc = String(query || '').toLowerCase();
  // Sort cities by length DESC so "gold coast" matches before "coast"
  const sorted = [...CITIES].sort((a, b) => b.length - a.length);
  for (const c of sorted) {
    // word-boundary-ish · avoid "ad-elaide" matching inside other word
    const idx = lc.indexOf(c);
    if (idx < 0) continue;
    const before = idx === 0 ? ' ' : lc[idx - 1];
    const after = lc[idx + c.length] || ' ';
    if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
    return { city: c, state: stateForCity(c), country: COUNTRY };
  }
  return null;
}
