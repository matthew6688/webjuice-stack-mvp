/**
 * core/leads/niche-cohort.js
 *
 * Logical niche-cohort partitioning (physical entity store stays flat).
 *
 * Writes / maintains: data/leads/niches/<niche>/<city>.entityKeys.json
 * Each shard file = array of entityKeys belonging to that niche-city cohort.
 *
 * Also maintains data/leads/niches/<niche>/profile.json with rolling stats
 * (entity count, grade distribution, cohort lifecycle state).
 *
 * Multi-niche businesses: entity.cohorts[] tracks all cohorts it belongs to.
 * One entity can appear in multiple shard files.
 *
 * SOP-1 §6 owner.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_STORE = path.resolve(process.cwd(), 'data/leads');

function slug(s) {
  return String(s || 'unknown').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Rebuild all niche shards from scratch by scanning entity store. */
export function rebuildAllNicheShards({ storeRoot = DEFAULT_STORE } = {}) {
  const entitiesDir = path.join(storeRoot, 'entities');
  const nichesDir = path.join(storeRoot, 'niches');
  if (!fs.existsSync(entitiesDir)) {
    return { ok: true, scanned: 0, shards: 0 };
  }

  fs.mkdirSync(nichesDir, { recursive: true });

  // Wipe existing shards (rebuild semantics)
  for (const sub of fs.readdirSync(nichesDir, { withFileTypes: true })) {
    if (sub.isDirectory()) {
      const dir = path.join(nichesDir, sub.name);
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.entityKeys.json') || f === 'profile.json') {
          fs.unlinkSync(path.join(dir, f));
        }
      }
    }
  }

  const files = fs.readdirSync(entitiesDir).filter((f) => f.endsWith('.json'));
  const cohorts = {};  // { niche: { city: [keys], _allKeys: [keys], _profile: { ... } } }

  let scanned = 0;
  for (const f of files) {
    let e;
    try { e = JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8')); } catch { continue; }
    if (e.status === 'merged') continue;
    scanned += 1;

    // Multi-niche if entity.cohorts[] set; else use latest.niche as single cohort.
    const niches = Array.isArray(e.cohorts) && e.cohorts.length > 0
      ? e.cohorts
      : (e.latest?.niche ? [e.latest.niche] : []);
    const city = slug(e.latest?.city || 'unknown');

    for (const n of niches) {
      const nicheSlug = slug(n);
      if (!cohorts[nicheSlug]) {
        cohorts[nicheSlug] = {
          _allKeys: new Set(),
          _grades: { A: 0, B: 0, C: 0, D: 0, ungraded: 0 },
          _phases: {},
          _firstSeenAt: e.firstSeenAt || '',
          _lastSeenAt: e.lastSeenAt || '',
          _displayName: n,
          cities: {},
        };
      }
      const c = cohorts[nicheSlug];
      c._allKeys.add(e.entityKey);
      if (!c.cities[city]) c.cities[city] = [];
      c.cities[city].push(e.entityKey);

      const grade = e.grade?.investment_level || 'ungraded';
      if (c._grades[grade] != null) c._grades[grade] += 1;
      else c._grades.ungraded += 1;

      const phase = e.phase || 'unset';
      c._phases[phase] = (c._phases[phase] || 0) + 1;

      if (e.firstSeenAt && (!c._firstSeenAt || e.firstSeenAt < c._firstSeenAt)) c._firstSeenAt = e.firstSeenAt;
      if (e.lastSeenAt && (!c._lastSeenAt || e.lastSeenAt > c._lastSeenAt)) c._lastSeenAt = e.lastSeenAt;
    }
  }

  let shardCount = 0;
  for (const [niche, data] of Object.entries(cohorts)) {
    const dir = path.join(nichesDir, niche);
    fs.mkdirSync(dir, { recursive: true });

    // Per-city shard files
    for (const [city, keys] of Object.entries(data.cities)) {
      const shardPath = path.join(dir, `${city}.entityKeys.json`);
      fs.writeFileSync(shardPath, JSON.stringify({
        schemaVersion: 1,
        niche: data._displayName,
        city,
        count: keys.length,
        entityKeys: keys,
        rebuiltAt: new Date().toISOString(),
      }, null, 2));
      shardCount += 1;
    }

    // Cohort profile
    const profilePath = path.join(dir, 'profile.json');
    fs.writeFileSync(profilePath, JSON.stringify({
      schemaVersion: 1,
      niche: data._displayName,
      slug: niche,
      totalEntities: data._allKeys.size,
      cities: Object.keys(data.cities).map((city) => ({ city, count: data.cities[city].length })),
      gradeDistribution: data._grades,
      phaseDistribution: data._phases,
      firstSeenAt: data._firstSeenAt,
      lastSeenAt: data._lastSeenAt,
      lifecycleState: 'active', // active | mature | dormant | archived (manual flip)
      rebuiltAt: new Date().toISOString(),
    }, null, 2));
  }

  return { ok: true, scanned, niches: Object.keys(cohorts).length, shards: shardCount };
}

/** List all niche cohorts (read-only). */
export function listCohorts({ storeRoot = DEFAULT_STORE } = {}) {
  const nichesDir = path.join(storeRoot, 'niches');
  if (!fs.existsSync(nichesDir)) return [];
  const cohorts = [];
  for (const sub of fs.readdirSync(nichesDir, { withFileTypes: true })) {
    if (!sub.isDirectory()) continue;
    const profilePath = path.join(nichesDir, sub.name, 'profile.json');
    if (!fs.existsSync(profilePath)) continue;
    try {
      cohorts.push(JSON.parse(fs.readFileSync(profilePath, 'utf8')));
    } catch {}
  }
  return cohorts;
}
