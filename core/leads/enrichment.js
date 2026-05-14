/**
 * Lead enrichment router.
 *
 * Runs 5 parallel search routes against a Maps-scrape entity to fill gaps
 * the scraper can't see: official URL, social handles (FB/IG/LinkedIn),
 * decision-maker name, third-party review aggregators.
 *
 * Used in two contexts:
 *  1. Stage 0.5 — leads with thin contact data go through enrichment BEFORE
 *     the scoring engine decides skip. (forced via cheap-audit-v2 returning
 *     queued_for_enrichment.)
 *  2. Pre-audit — any audit_candidate or starter_candidate runs enrichment
 *     before detailed audit so business_profile.json is filled.
 *
 * All search calls go through `tinyfishSearch` (T0, free, structured JSON),
 * with full V2 ledger trace (leadId/stage/purpose/requestHash). On Tinyfish
 * fail, falls back to `ddgSearch` (also T0).
 */

import { tinyfishSearch, TinyFishRateLimitedError } from '../extractors/tinyfish.js';
import { ddgSearch } from '../scrape/ddg.js';

const SOCIAL_HOST_PATTERNS = {
  facebook: /(?:^|\.)facebook\.com$/i,
  instagram: /(?:^|\.)instagram\.com$/i,
  linkedin: /(?:^|\.)linkedin\.com$/i,
  youtube: /(?:^|\.)youtube\.com$/i,
  twitter: /(?:^|\.)(twitter|x)\.com$/i,
  tiktok: /(?:^|\.)tiktok\.com$/i,
  threads: /(?:^|\.)threads\.net$/i,
};

const THIRD_PARTY_REVIEW_HOSTS = {
  hipages: /(?:^|\.)hipages\.com\.au$/i,
  yelp: /(?:^|\.)yelp\.com(?:\.au)?$/i,
  productreview: /(?:^|\.)productreview\.com\.au$/i,
  truelocal: /(?:^|\.)truelocal\.com\.au$/i,
  houzz: /(?:^|\.)houzz\.com$/i,
  yellowpages: /(?:^|\.)yellowpages\.com\.au$/i,
};

function extractHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function classifySocial(url) {
  const host = extractHost(url);
  for (const [platform, pattern] of Object.entries(SOCIAL_HOST_PATTERNS)) {
    if (pattern.test(host)) return platform;
  }
  return null;
}

/**
 * Score how "profile-like" a social URL is — higher = more canonical.
 * Lets us prefer facebook.com/brand over facebook.com/brand/videos/...
 */
function profileScore(url, platform) {
  let pathname;
  try { pathname = new URL(url).pathname; } catch { return 0; }
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 0;

  // Deep-link patterns to avoid
  const deepLinkPatterns = {
    facebook: /^(videos|posts|events|photo|p|story|reel|watch)$/i,
    instagram: /^(p|reel|tv|stories|explore)$/i,
    linkedin: /^(posts|pulse|jobs|feed)$/i,
    youtube: /^(watch|shorts|playlist)$/i,
    twitter: /^(status|hashtag|search)$/i,
    tiktok: /^(video|tag)$/i,
    threads: /^(post)$/i,
  };

  for (const seg of segments) {
    if (deepLinkPatterns[platform]?.test(seg)) return 1; // deep link, low score
  }

  // 1 segment = bare profile (best). 2 segments = profile/about. 3+ = deeper.
  if (segments.length === 1) return 10;
  if (segments.length === 2) return 5;
  return 2;
}

function classifyReviewSite(url) {
  const host = extractHost(url);
  for (const [source, pattern] of Object.entries(THIRD_PARTY_REVIEW_HOSTS)) {
    if (pattern.test(host)) return source;
  }
  return null;
}

/**
 * Run a single search route, fail-soft to DDGS if Tinyfish fails.
 */
async function runSearchRoute({ query, leadId, clientSlug, stage, purpose, ledgerPath, location }) {
  try {
    const r = await tinyfishSearch({
      query, location, language: 'en',
      ledgerPath, leadId, clientSlug, stage, purpose,
    });
    return { ok: true, provider: 'tinyfish', query, purpose, results: r.results || [] };
  } catch (err) {
    if (err instanceof TinyFishRateLimitedError || err.name === 'TinyFishRateLimitedError') {
      // Fall back to DDGS
      try {
        const r = await ddgSearch({
          query, region: location ? `${location.toLowerCase()}-en` : 'wt-wt', maxResults: 10,
          ledgerPath, leadId, clientSlug, stage, purpose: `${purpose}_via_ddgs`,
        });
        return { ok: true, provider: 'ddgs', query, purpose, results: r.results || [] };
      } catch (e2) {
        return { ok: false, provider: 'ddgs', query, purpose, error: e2.message };
      }
    }
    return { ok: false, provider: 'tinyfish', query, purpose, error: err.message };
  }
}

/**
 * Aggregate raw search results into the V2 business_profile shape.
 */
function buildBusinessProfile(entity, searchRoutes) {
  const latest = entity.latest || {};
  const profile = {
    leadId: null, // filled by caller
    business_name: latest.name || '',
    niche: latest.niche || '',
    enriched_at: new Date().toISOString(),
    contact: {
      phone: latest.phone || '',
      website: latest.website || '',
      address: latest.address || '',
      city: latest.city || '',
      social: {},
    },
    identifiers: {
      place_id: entity.identifiers?.place_id || '',
      cid: entity.identifiers?.cid || '',
      website_domain: entity.identifiers?.websiteDomain || '',
    },
    decision_maker: null,
    third_party_reviews: [],
    evidence_sources: [],
    enrichment_trace: {
      queries_run: searchRoutes.length,
      queries_succeeded: searchRoutes.filter((r) => r.ok).length,
      queries_failed: searchRoutes.filter((r) => !r.ok).length,
      total_results: searchRoutes.reduce((a, r) => a + (r.results?.length || 0), 0),
      routes: searchRoutes.map((r) => ({ purpose: r.purpose, ok: r.ok, provider: r.provider, result_count: r.results?.length || 0, error: r.error })),
    },
  };

  // Walk all results twice:
  //   pass 1 — collect best-scoring social URL per platform (prefer profile pages over deep links)
  //   pass 2 — third-party reviews + dedupe
  const seenUrls = new Set();
  const socialCandidates = {};   // platform → { url, title, score, route, provider }

  for (const route of searchRoutes) {
    if (!route.ok) continue;
    for (const r of route.results || []) {
      const url = r.url || '';
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);

      const social = classifySocial(url);
      if (social) {
        const score = profileScore(url, social);
        const current = socialCandidates[social];
        if (!current || score > current.score) {
          socialCandidates[social] = { url, title: r.title, score, route: route.purpose, provider: route.provider };
        }
      }
    }
  }
  for (const [platform, cand] of Object.entries(socialCandidates)) {
    profile.contact.social[platform] = cand.url;
    profile.evidence_sources.push({
      field: `social.${platform}`, source: cand.provider, route: cand.route, url: cand.url, title: cand.title,
      profile_score: cand.score,
    });
  }

  const knownThirdParty = new Set();
  for (const route of searchRoutes) {
    if (!route.ok) continue;
    for (const r of route.results || []) {
      const url = r.url;
      if (!url) continue;
      const reviewSource = classifyReviewSite(url);
      if (reviewSource && !knownThirdParty.has(reviewSource)) {
        knownThirdParty.add(reviewSource);
        profile.third_party_reviews.push({ source: reviewSource, url, title: r.title });
        profile.evidence_sources.push({
          field: 'third_party_reviews', source: route.provider, route: route.purpose, url, title: r.title,
        });
      }
    }
  }

  // If maps payload didn't have a website and search found one, use it
  if (!profile.contact.website) {
    for (const route of searchRoutes) {
      if (!route.ok || route.purpose !== 'discover_official') continue;
      for (const r of route.results || []) {
        const url = r.url;
        const host = extractHost(url);
        if (!host) continue;
        // Skip social, review aggregator, and search-engine hosts
        if (classifySocial(url) || classifyReviewSite(url)) continue;
        if (/google|bing|duckduckgo/.test(host)) continue;
        profile.contact.website = url;
        profile.identifiers.website_domain = host;
        profile.evidence_sources.push({
          field: 'contact.website', source: route.provider, route: route.purpose, url, title: r.title,
        });
        break;
      }
      if (profile.contact.website) break;
    }
  }

  return profile;
}

/**
 * Run full enrichment on a Maps-scrape entity.
 *
 * @param {object} input
 * @param {object} input.entity — the discovery store entity
 * @param {string} input.leadId — stable id (can be entityKey)
 * @param {string?} input.clientSlug — V2 clientSlug if assigned
 * @param {string} input.stage — current stage (e.g. 'queued_for_enrichment')
 * @param {string?} input.location — search region hint (e.g. 'AU')
 * @param {string?} input.ledgerPath — override (defaults to repo ledger)
 * @returns {Promise<{ profile, routes }>}
 */
export async function enrichLead({
  entity,
  leadId,
  clientSlug,
  stage = 'queued_for_enrichment',
  location = 'AU',
  ledgerPath,
} = {}) {
  if (!entity) throw new Error('entity is required');
  if (!leadId) leadId = entity.entityKey || `lead_${Date.now()}`;
  const name = entity.latest?.name?.trim();
  if (!name) throw new Error('entity.latest.name is required for enrichment');

  const phone = entity.latest?.phone?.trim();
  const city = entity.latest?.city?.trim() || '';

  const queries = [
    { purpose: 'discover_official', q: `"${name}" ${city}` },
    { purpose: 'social_facebook',   q: `"${name}" ${city} facebook` },
    { purpose: 'social_instagram',  q: `"${name}" ${city} instagram` },
    { purpose: 'social_linkedin',   q: `"${name}" ${city} linkedin OR director OR owner` },
    { purpose: 'reviews_thirdparty', q: `"${name}" ${city} reviews` },
  ];
  if (phone) {
    queries.push({ purpose: 'reverse_phone', q: `"${phone}"` });
  }

  const routes = [];
  for (const q of queries) {
    const r = await runSearchRoute({
      query: q.q, purpose: `enrich_${q.purpose}`,
      leadId, clientSlug, stage, ledgerPath, location,
    });
    routes.push(r);
  }

  const profile = buildBusinessProfile(entity, routes);
  profile.leadId = leadId;
  if (clientSlug) profile.clientSlug = clientSlug;

  // V3 D43 Q3 · LLM judge each enriched URL against target business
  // (catches same-name false matches · generic directories · etc.)
  if (process.env.SKIP_ENRICH_JUDGE !== '1') {
    try {
      const candidates = [];
      // Add socials
      for (const [platform, url] of Object.entries(profile.contact.social || {})) {
        candidates.push({ type: `social_${platform}`, url, title: '' });
      }
      // Add 3rd-party reviews
      for (const tp of profile.third_party_reviews || []) {
        candidates.push({ type: `review_${tp.source}`, url: tp.url, title: tp.title || '' });
      }
      // Add discovered website if maps payload was empty
      if (!entity.latest?.website && profile.contact.website) {
        candidates.push({ type: 'website', url: profile.contact.website, title: '' });
      }
      if (candidates.length > 0) {
        const { judgeEnrichmentMatches } = await import('../llm/match-judge.js');
        const verdicts = await judgeEnrichmentMatches({
          entity: {
            name: entity.latest?.name,
            niche: entity.latest?.niche,
            city: entity.latest?.city,
            phone: entity.latest?.phone,
            address: entity.latest?.address,
          },
          candidates,
        });
        // Apply verdicts: drop 'no' candidates · move 'maybe' to maybe_* fields
        profile.enrichment_judge = {
          ran: true,
          verdicts,
          dropped: verdicts.filter((v) => v.matches === 'no').map((v) => v.url),
          maybe: verdicts.filter((v) => v.matches === 'maybe').map((v) => v.url),
        };
        const dropSet = new Set(profile.enrichment_judge.dropped);
        const maybeSet = new Set(profile.enrichment_judge.maybe);
        // Filter socials
        for (const [platform, url] of Object.entries(profile.contact.social || {})) {
          if (dropSet.has(url)) {
            delete profile.contact.social[platform];
          } else if (maybeSet.has(url)) {
            profile.contact.maybe_social = profile.contact.maybe_social || {};
            profile.contact.maybe_social[platform] = url;
            delete profile.contact.social[platform];
          }
        }
        // Filter third-party reviews
        profile.third_party_reviews = (profile.third_party_reviews || []).filter((tp) => !dropSet.has(tp.url));
        // Filter discovered website
        if (profile.contact.website && dropSet.has(profile.contact.website)) {
          profile.contact.website = '';
          profile.identifiers.website_domain = '';
        }
      }
    } catch (err) {
      profile.enrichment_judge = { ran: false, error: err.message };
    }
  }

  return { profile, routes };
}
