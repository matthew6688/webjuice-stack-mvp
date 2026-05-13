/**
 * M2-D2 · Reviews adapter — docker-first cascade with Places fallback.
 *
 * Normalizes review shapes from two sources to the master-md-builder compatible
 * form {author_name, rating, text}:
 *   - docker (gosom local scraper):  { Name, Rating, Description }
 *   - places  (Google Places API):    { author_name, rating, text }
 *
 * Cascade policy (only for A/B grades · C/D skip to save cost):
 *   1. docker (T0 free · target ≥ 8 reviews)
 *   2. Places API fallback (T2 paid · target ≥ 5 reviews)
 *
 * 5-minute timeout guard on the docker call (extra_reviews:true can hang).
 */

const FETCH_TIMEOUT_MS = 5 * 60_000; // 5-min timeout per spec

export function normalizeReviews(input, source) {
  if (!Array.isArray(input)) return [];
  if (source === 'docker') {
    return input.map((r) => ({
      author_name: r.Name || r.author_name || '',
      rating: Number(r.Rating ?? r.rating ?? 0),
      text: r.Description || r.text || '',
    }));
  }
  // places (already in target shape; pass-through safety)
  return input.map((r) => ({
    author_name: r.author_name || r.Name || '',
    rating: Number(r.rating ?? r.Rating ?? 0),
    text: r.text || r.Description || '',
  }));
}

/**
 * Fetch reviews for an entity with grade-aware cascade.
 *
 * @param {object} opts
 * @param {string} opts.grade           A/B/C/D — only A/B fetch
 * @param {string} opts.entityKey
 * @param {boolean} [opts.__mock]       test-mode short-circuit
 * @param {boolean} [opts.__forceDockerFail] test-mode force fallback
 * @returns {Promise<null | {source: 'docker'|'places', reviews: Array, count: number}>}
 */
export async function fetchReviewsForEntity({ grade, entityKey, __mock, __forceDockerFail } = {}) {
  if (!['A', 'B'].includes(String(grade || '').toUpperCase())) {
    return null; // C/D skip
  }

  if (__mock) {
    if (__forceDockerFail) {
      const reviews = normalizeReviews([
        { author_name: 'Mock User', rating: 5, text: 'mock places review' },
      ], 'places');
      return { source: 'places', reviews, count: reviews.length };
    }
    const reviews = normalizeReviews([
      { Name: 'Mock User', Rating: 5, Description: 'mock docker review' },
    ], 'docker');
    return { source: 'docker', reviews, count: reviews.length };
  }

  // Real cascade — best-effort dynamic imports so this module stays test-isolated.
  try {
    const dockerOut = await Promise.race([
      _tryDocker(entityKey),
      new Promise((_, rej) => setTimeout(() => rej(new Error('docker timeout')), FETCH_TIMEOUT_MS)),
    ]);
    if (dockerOut?.reviews?.length >= 5) return { source: 'docker', ...dockerOut };
  } catch (err) {
    // fallthrough to places
  }
  try {
    const placesOut = await _tryPlaces(entityKey);
    if (placesOut?.reviews?.length) return { source: 'places', ...placesOut };
  } catch (err) {}
  return null;
}

// V3 (2026-05-13): wire _tryDocker / _tryPlaces to real fetchers · was placeholder.
// Dynamic import so this module stays test-isolated (test contract uses __mock flag).
async function _tryDocker(entityKey) {
  const entity = await _loadEntity(entityKey);
  if (!entity) throw new Error(`entity ${entityKey} not found`);
  const { fetchLeadReviewsLocal, gmapsContainerAvailable } = await import('../reviews/fetch-reviews-local.js');
  if (!gmapsContainerAvailable()) throw new Error('gosom docker container not running');
  const out = await fetchLeadReviewsLocal({ entity });
  if (!out?.ok) throw new Error(out?.reason || 'docker fetch failed');
  return {
    reviews: out.reviews,
    count: out.reviews.length,
    rating_distribution: out.rating_distribution,
    review_count: out.review_count,
    placeId: out.placeId,
    fetched_at: out.fetched_at,
  };
}

async function _tryPlaces(entityKey) {
  const entity = await _loadEntity(entityKey);
  if (!entity) throw new Error(`entity ${entityKey} not found`);
  const { fetchLeadReviews } = await import('../reviews/fetch-reviews.js');
  const out = await fetchLeadReviews({ entity });
  if (!out?.ok) throw new Error(out?.reason || 'places fetch failed');
  return {
    reviews: out.reviews || [],
    count: (out.reviews || []).length,
    rating: out.rating,
    review_count: out.user_ratings_total,
    placeId: out.place_id,
    fetched_at: new Date().toISOString(),
  };
}

async function _loadEntity(entityKey) {
  const fsMod = await import('node:fs');
  const pathMod = await import('node:path');
  const fp = pathMod.default.join(process.cwd(), 'data/leads/entities', `${entityKey}.json`);
  if (!fsMod.default.existsSync(fp)) return null;
  try { return JSON.parse(fsMod.default.readFileSync(fp, 'utf8')); } catch { return null; }
}
