/**
 * 城市 → lat/lng geocoder · 用 Google Geocoding API
 *
 * gosom Docker (新版) 要求 jobBody 带 lat/lon，不再自己 geocode。
 * 我们前置 1 次 Geocoding API call 把城市变坐标。
 *
 * 成本: $0.005/call · 缓存到 data/geocode-cache.json 同 city+country 永不重复调
 * Env:   GOOGLE_PLACES_API_KEY (Geocoding API 同 key)
 */

import fs from 'node:fs';
import path from 'node:path';

const CACHE_PATH = path.join(process.cwd(), 'data/geocode-cache.json');

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch { return {}; }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

/**
 * Geocode a city to { lat, lng, formatted_address }.
 * @param {string} city - "brisbane" / "Sydney NSW" / "Melbourne Australia"
 * @param {object} opts - { region: 'au' default, apiKey override }
 * @returns {Promise<{lat:number, lng:number, formatted_address:string, source:'cache'|'api'}>}
 */
export async function geocodeCity(city, opts = {}) {
  const region = opts.region || 'au';
  const apiKey = opts.apiKey || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY missing for geocoding');

  const cacheKey = `${region}::${city.toLowerCase().trim()}`;
  const cache = loadCache();
  if (cache[cacheKey]) {
    return { ...cache[cacheKey], source: 'cache' };
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&region=${region}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding API ${res.status}: ${await res.text()}`);
  const j = await res.json();
  if (j.status !== 'OK' || !j.results?.length) {
    throw new Error(`Geocoding failed for "${city}": ${j.status}${j.error_message ? ' · ' + j.error_message : ''}`);
  }
  const top = j.results[0];
  const result = {
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng,
    formatted_address: top.formatted_address,
  };
  cache[cacheKey] = result;
  saveCache(cache);
  return { ...result, source: 'api' };
}
