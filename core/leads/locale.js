/**
 * Locale resolution for V2 entities. DISCORD_OUTREACH_PRD.md §6.1.
 *
 * Single function: deriveLocale(entity) → { country, timezone, language, state? }
 *
 * Resolution order (first hit wins):
 *   1. entity.latest.city exact match in cities table
 *   2. entity.latest.address text-search for any city name
 *   3. entity.latest.state (or detected from address) → stateFallback
 *   4. defaultTimezone (Australia/Brisbane)
 *
 * Internationalization later: swap au-city-tz.json for a country-keyed table.
 * For now everything assumes AU. International expansion adds country detection upstream.
 */

import fs from 'fs';
import path from 'path';

const TZ_TABLE_PATH = path.join('data', 'geo', 'au-city-tz.json');
let _table = null;

function table() {
  if (_table) return _table;
  _table = JSON.parse(fs.readFileSync(TZ_TABLE_PATH, 'utf8'));
  return _table;
}

function normalize(s) {
  return String(s || '').toLowerCase().trim();
}

// Find a city name embedded in a free-form string (address line, suburb, etc.)
// Returns the matched city key, or '' if none.
function findCityIn(text) {
  const lower = normalize(text);
  if (!lower) return '';
  const cities = Object.keys(table().cities);
  // Longest match first so "Gold Coast" wins over "Gold".
  cities.sort((a, b) => b.length - a.length);
  for (const city of cities) {
    if (lower.includes(city)) return city;
  }
  return '';
}

// Extract state code (QLD/NSW/VIC/WA/SA/TAS/ACT/NT) from an address string.
function findStateIn(text) {
  const stateMatch = String(text || '').match(/\b(QLD|NSW|VIC|WA|SA|TAS|ACT|NT)\b/);
  return stateMatch ? stateMatch[1] : '';
}

export function deriveLocale(entity = {}) {
  const t = table();
  const latest = entity.latest || {};
  const city = normalize(latest.city);
  const address = latest.address || latest.formatted_address || '';
  const stateHint = normalize(latest.state) || findStateIn(address);

  let matchedCity = '';
  if (city && t.cities[city]) matchedCity = city;
  if (!matchedCity) matchedCity = findCityIn(address);

  let tz = t.defaultTimezone;
  let state = '';
  if (matchedCity) {
    tz = t.cities[matchedCity].tz;
    state = t.cities[matchedCity].state;
  } else if (stateHint && t.stateFallback[stateHint.toUpperCase()]) {
    tz = t.stateFallback[stateHint.toUpperCase()];
    state = stateHint.toUpperCase();
  }

  return {
    country: t.country,
    timezone: tz,
    language: t.defaultLanguage,
    state: state || null,
    matched_city: matchedCity || null,
  };
}

// Render the current time in the locale's timezone — used by Profile card field
// "客户本地: 14:23 Brisbane (AEST, UTC+10)".
export function nowInLocale(locale, at = new Date()) {
  if (!locale?.timezone) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: locale.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
    return formatter.format(at);
  } catch {
    return '';
  }
}
