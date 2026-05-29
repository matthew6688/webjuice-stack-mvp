#!/usr/bin/env node
/**
 * pl:geo-suburbs · codex R82 · derive service-area suburbs within a radius (OFFLINE).
 *
 * Given a business location, returns suburbs whose CENTROID is within N km — a
 * `geo_derived` provenance tier: more trustworthy than ai-inferred, but NOT a verified
 * service claim. Writes to brief.suburbs_candidates[] (NEVER suburbs_covered directly).
 *
 * Data: data/geo/au-localities.json (GeoNames via Elkfox · CC BY 3.0 · see data/geo/SOURCES.md).
 * Algorithm: centroid haversine. Same-state only. Sort by distance, then accuracy desc.
 *
 * Origin (codex R82 #5 · offline only · never secretly geocode online):
 *   1. explicit business lat/lng (entity geometry / brief)   — preferred
 *   2. postcode-centroid from the local gazetteer            — offline fallback (logged · ~suburb-level)
 *   3. else: fail with a clear message to geocode first
 *
 * Radius priority: --radius > brief.service_radius_km > 25 (codex R82 #3).
 * Copy rule (codex R82 #4): geo_derived may be phrased "within service radius / nearby
 * suburbs / areas near X" — NEVER "servicing X" unless a verified source exists.
 *
 * Usage: node scripts/cli/pl-geo-suburbs.js --slug <slug> [--radius N] [--max-results M] [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(REPO);

const argv = process.argv.slice(2);
const getArg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const slug = getArg('slug');
const JSON_OUT = argv.includes('--json');
const MAX = parseInt(getArg('max-results') || '40', 10);
if (!slug) { console.error('--slug required'); process.exit(1); }
const V2 = `clients/${slug}/v2`;

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')); } catch { return null; } };
const GAZ = readJson('data/geo/au-localities.json');
if (!GAZ) { console.error('✗ data/geo/au-localities.json missing — build the gazetteer first'); process.exit(2); }

const briefPath = `${V2}/single-page-brief.yaml`;
let brief = null;
try { brief = yaml.load(fs.readFileSync(path.resolve(briefPath), 'utf8')); } catch { /* none yet */ }

// ── resolve origin lat/lng (offline) ──
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
let origin = null, originSrc = null, state = (brief?.state || brief?.address?.state || '').toUpperCase();

// 1. explicit lat/lng from entity geometry
try {
  const md = fs.readFileSync(path.resolve(`${V2}/master.md`), 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const fm = md ? yaml.load(md[1]) : {};
  const ent = fm.business_id ? readJson(`data/leads/entities/${fm.business_id}.json`) : null;
  const geo = ent?.latest?.geometry?.location || ent?.geometry?.location || ent?.latest?.places_enrichment?.location;
  if (geo && geo.lat != null && geo.lng != null) { origin = { lat: +geo.lat, lng: +geo.lng }; originSrc = 'entity.geometry'; }
} catch { /* none */ }

// 2. postcode-centroid from gazetteer (offline fallback)
if (!origin && brief?.address?.postcode) {
  const pc = String(brief.address.postcode);
  const sub = norm(brief.address.suburb);
  const hit = GAZ.find((r) => r.postcode === pc && norm(r.suburb) === sub) || GAZ.find((r) => r.postcode === pc);
  if (hit) { origin = { lat: hit.lat, lng: hit.lng }; originSrc = `postcode-centroid(${pc}${hit.suburb ? ' ' + hit.suburb : ''})`; state = state || hit.state; }
}

if (!origin) {
  console.error(`✗ no business lat/lng and no resolvable postcode for ${slug}. Geocode the business first (offline-only CLI · will not call a network geocoder).`);
  process.exit(3);
}

// ── radius ──
const radiusKm = parseFloat(getArg('radius')) || (brief?.service_radius_km ? +brief.service_radius_km : 25);

// ── haversine (same-state only) ──
const R = 6371;
const toRad = (d) => d * Math.PI / 180;
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// drop postal-only localities that are NOT real suburbs (Delivery/Business/Mail Centres,
// PO-box ranges, plaza/shopping-centre postal names) — they read as fake coverage.
const POSTAL_NOISE = /\b(DC|BC|MC|LVR|MDC|DCN)$|po box|plaza|shopping|university|business centre|mail centre|delivery centre/i;
const within = GAZ
  .filter((r) => (!state || r.state === state))
  .filter((r) => !POSTAL_NOISE.test(r.suburb))
  .map((r) => ({ suburb: r.suburb, state: r.state, postcode: r.postcode, lat: r.lat, lng: r.lng, accuracy: r.accuracy, distance_km: +haversine(origin, r).toFixed(2) }))
  .filter((r) => r.distance_km <= radiusKm)
  // dedupe by suburb name (gazetteer can repeat a suburb across postcodes) · keep nearest
  .sort((a, b) => a.distance_km - b.distance_km || b.accuracy - a.accuracy);
const seen = new Set();
const deduped = within.filter((r) => { const k = norm(r.suburb); if (seen.has(k)) return false; seen.add(k); return true; });

const candidates = deduped.slice(0, MAX).map((r) => ({ ...r, source: 'geonames', provenance: `geo_derived(centroid_radius,r=${radiusKm}km)` }));

if (JSON_OUT) { console.log(JSON.stringify({ slug, origin, originSrc, radiusKm, total_within: deduped.length, returned: candidates.length, candidates }, null, 2)); process.exit(0); }

console.log(`\n=== pl:geo-suburbs · ${slug} ===`);
console.log(`origin: ${origin.lat},${origin.lng} (${originSrc}) · state ${state || '(any)'} · radius ${radiusKm}km`);
console.log(`within radius: ${deduped.length} suburbs (returning top ${candidates.length})`);
candidates.slice(0, 12).forEach((c) => console.log(`  · ${c.suburb} (${c.postcode}) ${c.distance_km}km · acc${c.accuracy}`));

if (!brief) { console.log(`\n(no single-page-brief.yaml · run pl:build-single-page-brief first to persist candidates)`); process.exit(0); }
// merge into brief.suburbs_candidates · keep any existing ai-inferred separate (don't clobber)
const existingAi = (brief.suburbs_candidates || []).filter((s) => /ai-inferred/.test(s.provenance || ''));
brief.suburbs_candidates = [...candidates, ...existingAi];
brief._geo_suburbs = { origin, originSrc, radius_km: radiusKm, total_within: deduped.length, generated_at_note: 'centroid_radius · geonames · CC BY 3.0' };
const header = fs.readFileSync(path.resolve(briefPath), 'utf8').split('\n').filter((l) => l.startsWith('#')).join('\n');
fs.writeFileSync(path.resolve(briefPath), header + '\n' + yaml.dump(brief, { lineWidth: 120, noRefs: true }));
console.log(`\n✓ wrote ${candidates.length} geo_derived candidates → ${path.relative(REPO, path.resolve(briefPath))} (suburbs_candidates)`);
console.log(`→ next: pl:validate-single-page-brief --slug ${slug} (publish gate: verified + geo_derived ≥ 8 · codex R82 #4)`);
