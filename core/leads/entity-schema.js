/**
 * core/leads/entity-schema.js · V3 D43 (2026-05-14)
 *
 * Pre-persistence validation for entity records.
 *
 * Catches the bug class found in E2E run #1:
 *   User said "Brisbane" → Places returned NSW address → entity persisted
 *   with city="Brisbane" (user input wins over address) → invalid data.
 *
 * Surface point: any code path that writes to data/leads/entities/ should
 * call validateEntity() FIRST. Returns { ok, errors[], warnings[] }.
 *
 * Not full Zod (avoid dep churn) · hand-rolled but typed enough for the
 * production fields we care about.
 */

const STATES_AU = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

// Common Australian capital → state map for fuzzy locality match
const CITY_STATE_MAP = {
  brisbane: 'QLD',
  'gold coast': 'QLD',
  'sunshine coast': 'QLD',
  cairns: 'QLD',
  townsville: 'QLD',
  sydney: 'NSW',
  newcastle: 'NSW',
  wollongong: 'NSW',
  canberra: 'ACT',
  melbourne: 'VIC',
  geelong: 'VIC',
  ballarat: 'VIC',
  perth: 'WA',
  adelaide: 'SA',
  hobart: 'TAS',
  darwin: 'NT',
};

function lower(s) { return String(s || '').toLowerCase().trim(); }

/** Levenshtein-ish ratio · 0..1 · simple substring/token-set match */
function fuzzyMatch(a, b) {
  const la = lower(a), lb = lower(b);
  if (!la || !lb) return 0;
  if (la === lb) return 1;
  if (la.includes(lb) || lb.includes(la)) return 0.85;
  // token-set overlap
  const sa = new Set(la.split(/\W+/).filter(Boolean));
  const sb = new Set(lb.split(/\W+/).filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / Math.max(sa.size, sb.size);
}

/**
 * Validate an entity object before persistence.
 * @param {object} entity · same shape as data/leads/entities/<key>.json `latest`
 * @returns {{ok, errors[], warnings[]}}
 */
export function validateEntity(entity) {
  const errors = [];
  const warnings = [];

  if (!entity || typeof entity !== 'object') {
    return { ok: false, errors: ['entity is not an object'], warnings: [] };
  }

  // 1. city vs address fuzzy match (P1 bug · Brisbane → Sydney)
  if (entity.city && entity.address) {
    const cityLower = lower(entity.city);
    const addrLower = lower(entity.address);
    // If address contains city literal, ok
    const inAddr = addrLower.includes(cityLower);
    // Also check state — if city is "brisbane" but address has "NSW", mismatch.
    const expectedState = CITY_STATE_MAP[cityLower];
    let stateMatch = true;
    if (expectedState) {
      const hasExpectedState = new RegExp(`\\b${expectedState}\\b`, 'i').test(addrLower);
      stateMatch = hasExpectedState;
    }
    if (!inAddr && !stateMatch) {
      errors.push(`city_address_mismatch: city="${entity.city}" but address="${entity.address}" (expected state ${expectedState || '?'})`);
    } else if (!inAddr && stateMatch) {
      warnings.push(`city not literally in address ("${entity.city}" vs "${entity.address}") · state matches`);
    }
  }

  // 2. Phantom business name (P1 image-extract bug · service description as name)
  if (entity.name) {
    const nameLower = lower(entity.name);
    const phantomPatterns = [
      /^(roofing|plumbing|electrical|painting)\s+(tile|metal|gas|solar|service)/,
      /^(tile|metal|gas|solar)\s*\/?\s*(roofing|plumbing|electrical)/,
      /^(restorations?|repairs?|gutters?)\b/,
    ];
    for (const p of phantomPatterns) {
      if (p.test(nameLower)) {
        warnings.push(`possible_phantom_name: "${entity.name}" looks like service description not a brand name`);
        break;
      }
    }
  }

  // 3. Phone format (AU · light check)
  if (entity.phone) {
    const phone = String(entity.phone).replace(/[\s()-]/g, '');
    const valid = /^(\+?61|0)\d{8,9}$/.test(phone);
    if (!valid) {
      warnings.push(`phone_format_unusual: "${entity.phone}" (expected AU format · 04xx... / 02 xxx... / +61...)`);
    }
  }

  // 4. Niche basic sanity
  if (entity.niche) {
    const niche = lower(entity.niche);
    if (niche.length < 3 || niche.length > 30) {
      warnings.push(`niche_length_odd: "${entity.niche}"`);
    }
  }

  // 5. Required min for usable entity
  const hasIdentifier = entity.place_id || entity.website || entity.phone;
  if (!hasIdentifier) {
    errors.push('no_identifier: needs at least one of place_id / website / phone');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Convenience · throws if invalid · use in code paths that should hard-fail */
export function assertValidEntity(entity) {
  const r = validateEntity(entity);
  if (!r.ok) throw new Error(`entity invalid: ${r.errors.join(' · ')}`);
  return r;
}
