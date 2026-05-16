/**
 * Wayback Machine first-snapshot probe.
 *
 * Free public API: https://archive.org/wayback/available?url=X&timestamp=Y
 * No auth · liberal rate limit · we cap to 10s timeout.
 *
 * Returns first known snapshot date + URL. We probe twice:
 *   1. earliest (timestamp=1996) → first_snapshot
 *   2. latest (no timestamp) → last_snapshot
 *
 * Failure modes: 200 with `{ archived_snapshots: {} }` (no snapshot exists),
 * network timeout, parse error. All return null · caller treats as missing.
 */
const AVAILABLE_ENDPOINT = 'https://archive.org/wayback/available';
const CDX_ENDPOINT = 'https://web.archive.org/cdx/search/cdx';
const TIMEOUT_MS = 10_000;

// /wayback/available?url=X · returns closest snapshot to a timestamp.
// 用来取 latest snapshot (timestamp omit · 默认取最近一条).
async function probeAvailable(url, timestamp, fetchImpl) {
  const q = `${AVAILABLE_ENDPOINT}?url=${encodeURIComponent(url)}${timestamp ? `&timestamp=${timestamp}` : ''}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetchImpl(q, { signal: ctrl.signal });
    if (!r.ok) return null;
    const data = await r.json();
    const snap = data?.archived_snapshots?.closest;
    if (!snap || snap.status !== '200') return null;
    return { url: snap.url, timestamp: snap.timestamp, date: parseTimestamp(snap.timestamp) };
  } catch { return null; }
  finally { clearTimeout(timer); }
}

// Progressive fallback · /wayback/available with timestamp=1996 returns the closest
// snapshot to 1996 · effectively the earliest if domain exists. If 1996 returns
// nothing (rare · happens when /available indexes haven't propagated) · try 2000 · 2010.
// CDX API exists but is rate-limited and often times out (30s+).
async function probeEarliest(url, fetchImpl) {
  for (const ts of ['1996', '2005', '2015', '2020']) {
    const result = await probeAvailable(url, ts, fetchImpl);
    if (result) return result;
  }
  return null;
}

function parseTimestamp(ts) {
  // Wayback timestamp format: YYYYMMDDhhmmss
  if (!ts || ts.length < 8) return null;
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}

/**
 * Look up Wayback snapshots for a domain.
 *
 * @param {string} domain bare domain (e.g. "example.com.au") or full URL
 * @param {object} [opts]
 * @param {Function} [opts.fetchImpl=fetch]
 * @returns {Promise<null | {
 *   domain: string,
 *   first_snapshot_date: string,    // YYYY-MM-DD
 *   first_snapshot_url: string,     // archived URL
 *   last_snapshot_date: string,
 *   last_snapshot_url: string,
 *   years_archived: number,
 *   probed_at: string
 * }>}
 */
export async function waybackLookup(domain, { fetchImpl = globalThis.fetch } = {}) {
  if (!domain) return null;
  // Strip protocol if user passed full URL
  const clean = String(domain).replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!clean) return null;

  const [first, last] = await Promise.all([
    probeEarliest(clean, fetchImpl),          // progressive fallback 1996→2005→2015→2020
    probeAvailable(clean, undefined, fetchImpl), // latest (no timestamp = most recent)
  ]);

  if (!first && !last) return null;

  const years_archived = (first && last) ? Math.max(
    0,
    Math.floor((Date.parse(last.date) - Date.parse(first.date)) / (365.25 * 86400 * 1000))
  ) : null;

  return {
    domain: clean,
    first_snapshot_date: first?.date || null,
    first_snapshot_url: first?.url || null,
    last_snapshot_date: last?.date || null,
    last_snapshot_url: last?.url || null,
    years_archived,
    probed_at: new Date().toISOString(),
  };
}
