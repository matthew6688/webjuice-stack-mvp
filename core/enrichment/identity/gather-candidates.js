/**
 * core/enrichment/identity/gather-candidates.js · multi-source candidate supply (codex R134 · step B).
 *
 * Given an entity (with at least a name), run multiple search providers (Tinyfish search + DuckDuckGo),
 * UNION + dedup by host → a candidate list to feed resolveIdentity (after fetching pages for promising ones).
 * Supply layer only — it does NOT judge identity or write anything. Search impls are injectable for tests.
 */
import { tinyfishSearch } from '../../extractors/tinyfish.js';
import { ddgSearch } from '../../scrape/ddg.js';

function hostOf(u) { try { return new URL(String(u)).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; } }

/**
 * @param {object} entity  with entity.latest.{business_name|name, city, niche}
 * @param {object} [opts]   { tinyfish, ddg } injectable async (query)=>({results:[{url,title,snippet}]}); maxPerSource
 * @returns {Promise<{ candidates, queries, sources }>}
 */
export async function gatherCandidates(entity, opts = {}) {
  const L = (entity && (entity.latest || entity)) || {};
  const name = L.business_name || L.name || '';
  if (!name) return { candidates: [], queries: [], sources: [] };
  const city = L.city || '';
  const niche = L.niche || '';
  const query = [name, city, niche].filter(Boolean).join(' ').trim();
  const maxPerSource = opts.maxPerSource || 10;

  const tinyfish = opts.tinyfish || ((q) => tinyfishSearch({ query: q, location: city ? `${city}, Australia` : 'Australia' }));
  const ddg = opts.ddg || ((q) => ddgSearch({ query: q, region: 'au-en', maxResults: maxPerSource }));

  const candidates = [];
  const seen = new Set();
  const sources = [];
  for (const [via, fn] of [['tinyfish', tinyfish], ['ddg', ddg]]) {
    let res;
    try { res = await fn(query); } catch (e) { sources.push({ via, ok: false, error: String(e.message).slice(0, 80) }); continue; }
    const results = (res && res.results) || [];
    sources.push({ via, ok: true, n: results.length });
    for (const r of results.slice(0, maxPerSource)) {
      const url = r.url || r.link;
      if (!url) continue;
      const host = hostOf(url);
      const key = host || String(url);
      if (seen.has(key)) continue; // union + dedup by host (first source wins)
      seen.add(key);
      candidates.push({ source: 'web', via, url, domain: host, title: r.title || '', snippet: r.snippet || '', name });
    }
  }
  return { candidates, queries: [query], sources };
}

export default { gatherCandidates };
