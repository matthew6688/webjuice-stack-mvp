/**
 * Tinyfish enrichment summary · light wrappers around existing tinyfish client.
 *
 * Two functions:
 *   1. tinyfishSearchSummary  · name+city+niche → external mentions list (AU-filtered)
 *   2. tinyfishHomepageSummary · website URL → markdown + extracted signals
 *
 * Doesn't run LLM here — that's the customer-summary CLI · this is just raw data
 * collection. extracted_signals 是纯 regex on markdown.
 */
import { tinyfishSearch, tinyfishFetchUrls } from '../extractors/tinyfish.js';

const AU_DOMAIN_HINT = /\.com\.au\b|\.net\.au\b|\.org\.au\b|\.au\b/i;
const AU_TEXT_HINT = /australia|brisbane|sydney|melbourne|perth|adelaide|cairns|gold coast|sunshine coast|hobart|darwin|canberra|tasmania|queensland|victoria|nsw|qld|wa|sa|nt|act/i;

/**
 * Lightweight AU filter on Tinyfish search results.
 * Keeps results that look AU-related: AU TLD · AU text · or Australia location string.
 */
function filterAu(results) {
  if (!Array.isArray(results)) return [];
  return results.filter((r) => {
    if (!r.url) return false;
    if (AU_DOMAIN_HINT.test(r.url)) return true;
    const text = `${r.title || ''} ${r.description || ''}`;
    if (AU_TEXT_HINT.test(text)) return true;
    return false;
  });
}

/**
 * Search by name+city+niche · return top mentions (AU-filtered).
 */
export async function tinyfishSearchSummary({ name, city, niche, leadId, clientSlug, fetchImpl }) {
  if (!name) return null;
  const query = [name, city, niche].filter(Boolean).join(' ').trim();
  const location = city ? `${city}, Australia` : 'Australia';

  const start = Date.now();
  let payload;
  try {
    payload = await tinyfishSearch({
      query, location, language: 'en',
      purpose: 'enrichment_search',
      leadId, clientSlug,
      fetchImpl,
    });
  } catch (err) {
    return { ok: false, reason: `tinyfish_search: ${err.message}`, latency_ms: Date.now() - start };
  }
  const latency_ms = Date.now() - start;
  const results = payload.results || [];
  const auFiltered = filterAu(results);

  return {
    ok: true,
    query, location,
    results_total: results.length,
    results_au_filtered: auFiltered.length,
    external_mentions: auFiltered.slice(0, 10).map((r) => ({
      title: r.title,
      url: r.url,
      domain: safeHost(r.url),
      description: (r.description || '').slice(0, 200),
    })),
    latency_ms,
    probed_at: new Date().toISOString(),
  };
}

/**
 * Fetch homepage · return markdown + extracted signals (regex · no LLM).
 */
export async function tinyfishHomepageSummary({ url, city, leadId, clientSlug, fetchImpl }) {
  if (!url) return null;
  const start = Date.now();
  let payload;
  try {
    payload = await tinyfishFetchUrls({
      urls: [url], format: 'markdown',
      purpose: 'enrichment_fetch',
      leadId, clientSlug,
      fetchImpl,
    });
  } catch (err) {
    return { ok: false, reason: `tinyfish_fetch: ${err.message}`, latency_ms: Date.now() - start };
  }
  const latency_ms = Date.now() - start;
  const res = payload.results?.[0];
  if (!res) return { ok: false, reason: 'no fetch result', latency_ms };
  const md = res.text || '';

  // Regex signals
  const signals = extractSignals(md, { city });

  return {
    ok: true,
    url: res.final_url || url,
    title: res.title || null,
    description: res.description || null,
    markdown_bytes: md.length,
    extracted_signals: signals,
    latency_ms,
    probed_at: new Date().toISOString(),
  };
}

function extractSignals(md, { city } = {}) {
  if (!md) return null;
  const first1500 = md.slice(0, 1500);

  const phoneRegex = /(?:\+?61[\s-]?|\(0\d\)[\s-]?|0\d[\s-]?)\d[\d\s-]{6,}/;
  const phone_present_above_fold = phoneRegex.test(first1500);

  const cityMentions = city ? (md.match(new RegExp(escapeRegex(city), 'gi')) || []).length : 0;

  const SERVICE_WORDS = ['roofing', 'roof', 'gutter', 'plumbing', 'electrical', 'painting', 'concrete', 'tiling', 'landscaping', 'carpentry'];
  const serviceKeywords = SERVICE_WORDS.filter((w) => new RegExp(`\\b${w}\\w*\\b`, 'i').test(md));

  const TRUST_WORDS = ['QBCC', 'license', 'licensed', 'insured', 'ABN', 'warranty', 'guarantee', 'years experience', 'certified', 'accredited'];
  const trustKeywords = TRUST_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(md));

  const yearMatches = [...md.matchAll(/\b(19[89]\d|20[0-2]\d)\b/g)].map((m) => parseInt(m[1], 10));
  const oldest_year = yearMatches.length ? Math.min(...yearMatches) : null;
  const newest_year = yearMatches.length ? Math.max(...yearMatches) : null;

  const ctaKeywords = ['quote', 'contact', 'call', 'book', 'get', 'free'];
  const cta_present_above_fold = ctaKeywords.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(first1500));

  return {
    phone_present_above_fold,
    cta_present_above_fold,
    city_mentioned_count: cityMentions,
    service_keywords_found: serviceKeywords,
    trust_keywords_found: trustKeywords,
    oldest_year_mentioned: oldest_year,
    newest_year_mentioned: newest_year,
    text_length: md.length,
    text_thin: md.length < 300,
  };
}

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function safeHost(url) { try { return new URL(url).host; } catch { return null; } }
