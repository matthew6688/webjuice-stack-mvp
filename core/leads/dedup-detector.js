/**
 * core/leads/dedup-detector.js
 *
 * Scan entity store for suspected duplicates via 3 unique-ish keys:
 *   1. place_id        (Google unique — auto-merge upstream in mergeLeadIntoEntity)
 *   2. phoneDigits     (E.164-normalized phone)
 *   3. websiteDomain   (root domain, no www.)
 *
 * SOP-X-Dedup owner. v1 = exact-match only (no fuzzy name matching).
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_STORE = path.resolve(process.cwd(), 'data/leads');

function readDecisions(storeRoot) {
  const p = path.join(storeRoot, 'dedup-decisions.json');
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).decisions || [];
  } catch {
    return [];
  }
}

/** "Pair" key = sorted-2-entityKey canonical id, for "different" dedup. */
function pairKey(k1, k2) {
  return [k1, k2].sort().join('::');
}

/**
 * Read all entities, build 3 hash buckets, return suspect groups.
 * Excludes entities that are already merged loser (status === 'merged').
 *
 * @returns {Object} { scanned, suspectGroups, summary }
 */
export function detectDuplicates({ storeRoot = DEFAULT_STORE } = {}) {
  const entitiesDir = path.join(storeRoot, 'entities');
  if (!fs.existsSync(entitiesDir)) {
    return { scanned: 0, suspectGroups: [], summary: { place_id: 0, phone: 0, domain: 0 } };
  }

  const files = fs.readdirSync(entitiesDir).filter((f) => f.endsWith('.json'));
  const buckets = { place_id: new Map(), phone: new Map(), domain: new Map() };
  let scanned = 0;

  for (const f of files) {
    let e;
    try {
      e = JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8'));
    } catch {
      continue;
    }
    if (e.status === 'merged') continue; // skip already-merged losers
    if (e.merged_into) continue;
    scanned += 1;
    const key = e.entityKey;
    const ids = e.identifiers || {};
    const placeId = (ids.place_id || '').trim();
    const phone = (ids.phoneDigits || '').trim();
    const domain = (ids.websiteDomain || '').trim().toLowerCase().replace(/^www\./, '');

    if (placeId) {
      if (!buckets.place_id.has(placeId)) buckets.place_id.set(placeId, []);
      buckets.place_id.get(placeId).push(key);
    }
    if (phone && phone.length >= 8) {
      // last 10 digits as canonical (handles +61 vs 0 prefix variations)
      const canon = phone.slice(-10);
      if (!buckets.phone.has(canon)) buckets.phone.set(canon, []);
      buckets.phone.get(canon).push(key);
    }
    if (domain && domain.length >= 4 && !domain.includes('localhost')) {
      if (!buckets.domain.has(domain)) buckets.domain.set(domain, []);
      buckets.domain.get(domain).push(key);
    }
  }

  const decisions = readDecisions(storeRoot);
  const skippedPairs = new Set(
    decisions
      .filter((d) => d.decision === 'different')
      .map((d) => pairKey(d.k1, d.k2))
  );

  // Build name preview cache
  const nameCache = {};
  function preview(k) {
    if (nameCache[k]) return nameCache[k];
    try {
      const e = JSON.parse(fs.readFileSync(path.join(entitiesDir, `${k}.json`), 'utf8'));
      nameCache[k] = {
        name: e.latest?.name || '(no name)',
        phone: e.latest?.phone || '',
        website: e.latest?.website || '',
        city: e.latest?.city || '',
        niche: e.latest?.niche || '',
        firstSeenAt: e.firstSeenAt || '',
        sourceType: e.latest?.sourceType || '',
        hasPlaceId: !!e.identifiers?.place_id,
      };
    } catch {
      nameCache[k] = { name: '(read error)', phone: '', website: '', city: '', niche: '', firstSeenAt: '', sourceType: '', hasPlaceId: false };
    }
    return nameCache[k];
  }

  const suspectGroups = [];
  const summary = { place_id: 0, phone: 0, domain: 0 };

  for (const [matchKey, bucket] of Object.entries(buckets)) {
    for (const [matchValue, entityKeys] of bucket.entries()) {
      if (entityKeys.length < 2) continue;

      // Filter: any pair within this group already decided 'different'?
      const uniqueKeys = Array.from(new Set(entityKeys));
      if (uniqueKeys.length < 2) continue;

      // Build a fresh group; if any pair in group is decided 'different', we
      // could be more nuanced, but for v1: skip whole group only if every
      // pair is decided different.
      let allDecided = true;
      for (let i = 0; i < uniqueKeys.length && allDecided; i += 1) {
        for (let j = i + 1; j < uniqueKeys.length && allDecided; j += 1) {
          if (!skippedPairs.has(pairKey(uniqueKeys[i], uniqueKeys[j]))) {
            allDecided = false;
          }
        }
      }
      if (allDecided) continue;

      summary[matchKey] += 1;
      const previews = uniqueKeys.map((k) => ({ entityKey: k, ...preview(k) }));

      suspectGroups.push({
        id: `${matchKey}:${matchValue}`,
        matchKey,
        matchValue,
        entityKeys: uniqueKeys,
        previews,
      });
    }
  }

  // For place_id groups: these should NEVER appear in v1 because
  // mergeLeadIntoEntity already auto-merges by place_id. If they do, it's a
  // data anomaly (manual edit, broken import, etc.) → still surface to operator.

  return { scanned, suspectGroups, summary };
}

/** Write detector output to dedup-review-queue.json */
export function writeReviewQueue(result, { storeRoot = DEFAULT_STORE } = {}) {
  const p = path.join(storeRoot, 'dedup-review-queue.json');
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scanned: result.scanned,
    totalSuspects: result.suspectGroups.length,
    summary: result.summary,
    suspects: result.suspectGroups,
  };
  fs.writeFileSync(p, JSON.stringify(payload, null, 2));
  return p;
}
