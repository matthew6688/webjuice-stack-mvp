/**
 * core/handoff/merge-inferred.js · Shared YELLOW back-fill merge logic.
 *
 * Reads `clients/<slug>/v2/inferred-data.json` (written by pl:llm-infer-thin-data)
 * and merges its fields into real-source data with provenance tags. Used by
 * both the deprecated OD path (pl-build-od-seed) and the canonical V1 path
 * (pl-compose-editorial).
 *
 * Pattern ported from pl-build-od-seed.js:299-321 (2026-05-29 recovery,
 * codex Round 37 Q-RR-3 b · DRY shared helper).
 *
 * SSOT writer-check: this module READS inferred-data.json. The only WRITER
 * is `pl-llm-infer-thin-data.js`. Do NOT mutate core-extract.json or facts.json
 * to inject inferred data — merge at compose-time only.
 *
 * Each merged value carries provenance:
 *   - 'verified'       · came from real_facts (crawl/GBP/ABN)
 *   - 'ai-completed'   · inferred services
 *   - 'ai-fabricated'  · inferred testimonials (clearly marked as placeholder)
 *   - 'radius-inferred'· inferred suburbs (geocoded ~25km)
 *   - 'ai-inferred'    · inferred owner name / experience
 *
 * Anti-gaming guarantee (CANONICAL.md §3 GATE 1 · codex R35 Q-PP-5):
 *   `hadInference()` returns true if ANY field was back-filled · callers MUST
 *   surface the PREVIEW banner downstream. Inferred values do NOT count toward
 *   checkpoint `real_business_signal` (those semantics live in pl-data-checkpoint).
 */
import fs from 'node:fs';
import path from 'node:path';

const META_PREFIXES = [
  /^The (Google Business Profile|master audit|GBP|business)/i,
  /^Core business category/i,
  /^The verified service scope/i,
  /categorise[sd] as a (roofing|trade)/i,
];
function isMetaBrief(s) {
  const t = String(s || '').trim();
  return t.length < 50 || META_PREFIXES.some(re => re.test(t));
}

/** Load inferred-data.json or return null if absent. */
export function loadInferred(slug, repoRoot = process.cwd()) {
  try {
    return JSON.parse(fs.readFileSync(
      path.join(repoRoot, 'clients', slug, 'v2/inferred-data.json'),
      'utf8',
    ));
  } catch { return null; }
}

/**
 * Merge services with real-source priority + inferred back-fill.
 *
 * @param {Array} realServices · from coreExtract.brief.real_facts.service_list
 * @param {object|null} inferredData · output of loadInferred()
 * @param {number} minReal · below this · pull from inferred (default 5)
 * @param {number} cap · max items returned (default 6)
 * @returns {Array<{name, brief, provenance}>}
 */
export function mergeServices(realServices = [], inferredData = null, { minReal = 5, cap = 6 } = {}) {
  const real = realServices
    .map(s => typeof s === 'string' ? { name: s, brief: '' } : { name: s.name || s.title, brief: s.brief || s.description || '' })
    .filter(s => !isMetaBrief(s.brief))
    .map(s => ({ ...s, provenance: 'verified' }));
  if (real.length >= minReal) return real.slice(0, cap);
  const inf = inferredData?.fields?.service_list?.value || [];
  return [...real, ...inf.map(s => ({ ...s, provenance: 'ai-completed' }))].slice(0, cap);
}

/**
 * Merge suburbs · de-dupe · cap.
 *
 * @param {Array<string>} realSuburbs · from brief.suburbs_covered or real_facts.suburbs_served
 * @param {object|null} inferredData
 * @param {number} minReal · below this · pull from inferred (default 10)
 * @param {number} cap · default 18
 * @returns {Array<string>}
 */
export function mergeSuburbs(realSuburbs = [], inferredData = null, { minReal = 10, cap = 18 } = {}) {
  const real = Array.isArray(realSuburbs) ? realSuburbs : [];
  if (real.length >= minReal) return real.slice(0, cap);
  const inf = inferredData?.fields?.suburbs_served?.value || [];
  return Array.from(new Set([...real, ...inf])).slice(0, cap);
}

/**
 * Merge testimonials with provenance tags.
 *
 * @param {Array} realReviews · array of {quote, author, location} or strings
 * @param {object|null} inferredData
 * @param {number} minReal · default 3
 * @param {number} cap · default 4
 * @returns {Array<{quote, author, location, provenance}>}
 */
export function mergeTestimonials(realReviews = [], inferredData = null, { minReal = 3, cap = 4 } = {}) {
  const real = (realReviews || []).slice(0, cap).map(t => {
    if (typeof t === 'string') return { quote: t, provenance: 'verified' };
    return {
      quote: t.quote || t.text || '',
      author: t.author || t.name || '',
      location: t.location || '',
      provenance: 'verified',
    };
  });
  if (real.length >= minReal) return real.slice(0, cap);
  const inf = inferredData?.fields?.testimonials?.value || [];
  return [...real, ...inf.map(t => ({ ...t, provenance: 'ai-fabricated' }))].slice(0, cap);
}

/**
 * Owner name fallback · real first · then inferred.
 * @returns {string|null}
 */
export function mergeOwnerName(realOwner, inferredData = null) {
  if (realOwner) return realOwner;
  return inferredData?.fields?.owner_name?.label || null;
}

/**
 * Experience claim fallback.
 * @returns {string|null}
 */
export function mergeExperience(realExperience, inferredData = null) {
  if (realExperience) return realExperience;
  return inferredData?.fields?.experience?.value || null;
}

/**
 * Returns true if any field in inferredData was successfully back-filled.
 * Callers MUST use this to gate the PREVIEW banner display.
 */
export function hadInference(inferredData) {
  if (!inferredData?.fields) return false;
  return Object.values(inferredData.fields).some(f => f?.provenance && f.provenance !== 'failed');
}

/**
 * Returns the list of inferred field names · for telemetry / banner text.
 */
export function inferredFieldNames(inferredData) {
  if (!inferredData?.fields) return [];
  return Object.keys(inferredData.fields).filter(k => {
    const f = inferredData.fields[k];
    return f?.provenance && f.provenance !== 'failed';
  });
}
