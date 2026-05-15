/**
 * core/geo/index.js · Multi-country geo registry.
 *
 * Routes city/country parsing through registered country modules.
 * Default order: AU first (current focus). Add others as expansion needs:
 *
 *   import { parseCityFromQuery as parseUS } from './us.js';
 *   COUNTRIES.unshift({ code: 'US', module: ... });
 *
 * Each country module must export:
 *   - `COUNTRY` (ISO 2-letter code · e.g. 'AU')
 *   - `COUNTRY_NAME` (human-readable)
 *   - `CITIES` (array · multi-word entries first within state for greedy match)
 *   - `CITIES_BY_STATE` (Object · state → cities[])
 *   - `parseCityFromQuery(query)` (returns { city, state, country } | null)
 *   - `stateForCity(city)`
 *
 * Usage:
 *   import { parseCityFromQuery } from '../core/geo/index.js';
 *   const hit = parseCityFromQuery('roofer in toowoomba'); // → { city: 'toowoomba', state: 'QLD', country: 'AU' }
 *   const hit2 = parseCityFromQuery('plumber in austin', { country: 'US' });
 */

import * as AU from './au.js';

// Order matters · first match wins when country not pinned by caller
export const COUNTRIES = [AU];

// Build a country-code lookup
export const COUNTRY_MODULES = Object.freeze(
  Object.fromEntries(COUNTRIES.map((m) => [m.COUNTRY, m])),
);

/**
 * Parse `city` from a query string.
 *   - `opts.country` (optional ISO code) · restricts to that country's dictionary
 *   - Default: scans all registered countries · first hit wins
 * Returns { city, state, country, country_name } or null.
 */
export function parseCityFromQuery(query, opts = {}) {
  const lc = String(query || '').toLowerCase();
  if (!lc) return null;

  const modules = opts.country
    ? [COUNTRY_MODULES[String(opts.country).toUpperCase()]].filter(Boolean)
    : COUNTRIES;

  for (const mod of modules) {
    const hit = mod.parseCityFromQuery(query);
    if (hit) {
      return { ...hit, country_name: mod.COUNTRY_NAME };
    }
  }
  return null;
}

/**
 * List all cities for a country (or all if no country given).
 */
export function listCities({ country } = {}) {
  if (country) {
    const mod = COUNTRY_MODULES[String(country).toUpperCase()];
    return mod ? [...mod.CITIES] : [];
  }
  return COUNTRIES.flatMap((m) => m.CITIES);
}

/**
 * Look up state for a known city (across all registered countries).
 * Returns { state, country } or null.
 */
export function lookupCity(city) {
  if (!city) return null;
  const lc = String(city).toLowerCase();
  for (const mod of COUNTRIES) {
    const state = mod.stateForCity(lc);
    if (state) return { city: lc, state, country: mod.COUNTRY };
  }
  return null;
}

/**
 * List supported country codes.
 */
export function supportedCountries() {
  return COUNTRIES.map((m) => ({ code: m.COUNTRY, name: m.COUNTRY_NAME, city_count: m.CITIES.length }));
}
