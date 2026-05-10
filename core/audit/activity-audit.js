/**
 * Activity / freshness audit — does this business actively maintain their
 * online presence? Inputs feed the "is this lead worth our effort + can
 * we depend on them executing post-redesign" filter.
 *
 * Tier T0 (HEAD requests + sitemap dates + Playwright optional for socials).
 *
 * Signals collected:
 *   - last_modified_header: from main URL HTTP response
 *   - newest_sitemap_lastmod: from sitemap.xml (if present, passed in)
 *   - blog_section_present: heuristic from sitemap classifications
 *   - blog_post_count + blog_newest_lastmod: from sitemap blog entries
 *   - social_links_in_html: extract FB/IG/LinkedIn/TikTok URLs from rawHtml
 *
 * What we DON'T do here (deferred): actually open social profiles via
 * Playwright to find newest post. That's a separate higher-cost step
 * that we trigger only for high-value leads.
 */

const SOCIAL_PATTERNS = {
  facebook: /https?:\/\/(?:www\.|m\.)?facebook\.com\/[A-Za-z0-9._-]+\/?/g,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+\/?/g,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9-]+\/?/g,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+\/?/g,
  twitter: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+\/?/g,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|user\/|c\/|@)[A-Za-z0-9_-]+\/?/g,
  pinterest: /https?:\/\/(?:www\.)?pinterest\.com\/[A-Za-z0-9_]+\/?/g,
};

function extractSocialLinks(rawHtml) {
  const found = {};
  for (const [platform, re] of Object.entries(SOCIAL_PATTERNS)) {
    const matches = [...rawHtml.matchAll(re)].map((m) => m[0]);
    const uniq = [...new Set(matches)];
    if (uniq.length) found[platform] = uniq.slice(0, 3);
  }
  return found;
}

function daysSince(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / 86_400_000);
}

function freshnessLabel(days) {
  if (days == null) return 'unknown';
  if (days <= 30) return 'active';
  if (days <= 90) return 'recent';
  if (days <= 365) return 'stale';
  return 'dormant';
}

export async function auditActivity({
  baseUrl,
  rawHtml,
  sitemapAnalysis,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!baseUrl) return { ok: false, reason: 'baseUrl required' };

  const result = {
    ok: true,
    base_url: baseUrl,
    last_modified_header: null,
    days_since_last_modified: null,
    newest_sitemap_lastmod: null,
    days_since_newest_sitemap: null,
    blog_section_present: false,
    blog_post_count: 0,
    blog_newest_lastmod: null,
    days_since_newest_blog: null,
    blog_freshness: 'unknown',
    social_links: {},
    overall_freshness: 'unknown',
  };

  // ── Last-Modified header ──
  try {
    const r = await fetchImpl(baseUrl, { method: 'HEAD', redirect: 'follow' });
    const lm = r.headers.get('last-modified');
    if (lm) {
      result.last_modified_header = lm;
      result.days_since_last_modified = daysSince(lm);
    }
  } catch {}

  // ── Sitemap-derived signals ──
  if (sitemapAnalysis?.ok && sitemapAnalysis.has_sitemap) {
    result.newest_sitemap_lastmod = sitemapAnalysis.last_mod_summary?.newest || null;
    result.days_since_newest_sitemap = daysSince(result.newest_sitemap_lastmod);
    const byPattern = sitemapAnalysis.urls_by_pattern || {};
    if (byPattern.blog_post && byPattern.blog_post > 0) {
      result.blog_section_present = true;
      result.blog_post_count = byPattern.blog_post;
    }
  }

  // ── Social link extraction from rawHtml ──
  if (rawHtml && typeof rawHtml === 'string') {
    result.social_links = extractSocialLinks(rawHtml);
  }

  // ── Overall freshness verdict ──
  // Pick the most recent signal we have (likely sitemap lastmod) and label.
  const candidates = [
    result.days_since_newest_blog,
    result.days_since_newest_sitemap,
    result.days_since_last_modified,
  ].filter((d) => d != null);
  const minDays = candidates.length ? Math.min(...candidates) : null;
  result.overall_freshness = freshnessLabel(minDays);
  result.days_since_any_update = minDays;

  return result;
}
