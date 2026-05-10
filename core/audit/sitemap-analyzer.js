/**
 * Sitemap.xml + robots.txt analyzer.
 *
 * Goal: give the customer a confident answer to "if you redesign, will I
 * lose my SEO?" — by enumerating their URLs, classifying them, and
 * sketching a 1:1 redirect plan.
 *
 * Tier T0 (just curl + XML parse). Falls back gracefully when sitemap is
 * absent or malformed.
 *
 * Output:
 *   {
 *     ok, has_sitemap, has_robots,
 *     sitemap_url, total_urls, urls_by_pattern,
 *     last_mod_summary: { newest, oldest, distribution_by_year },
 *     redirect_plan: [{ from, suggested_to, kind }],   // top 20-50 URLs
 *     migration_complexity: 'low' | 'medium' | 'high',
 *   }
 */

const FETCH_TIMEOUT_MS = 12_000;

async function fetchText(url, fetchImpl = globalThis.fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetchImpl(url, { redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
  finally { clearTimeout(timer); }
}

function parseSitemapXml(xml, base) {
  // Minimal XML parser — sitemap is a flat list, no need for full DOM.
  // Handles both urlset (regular sitemap) and sitemapindex (links to other sitemaps).
  const entries = [];
  const isIndex = /<sitemapindex/i.test(xml);
  const tag = isIndex ? 'sitemap' : 'url';
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const loc = (block.match(/<loc>([^<]+)<\/loc>/i) || [])[1]?.trim();
    const lastmod = (block.match(/<lastmod>([^<]+)<\/lastmod>/i) || [])[1]?.trim();
    if (loc) entries.push({ loc, lastmod: lastmod || null });
  }
  return { isIndex, entries };
}

function classifyUrl(urlPath) {
  const p = urlPath.toLowerCase();
  if (p === '/' || p === '') return 'home';
  if (/\/(blog|news|article|post)/.test(p)) return 'blog_post';
  if (/\/(service|services)\//.test(p)) return 'service_page';
  if (/\/(about|company|team|history)/.test(p)) return 'about';
  if (/\/(contact|quote|booking|enquiry|enquire|call)/.test(p)) return 'contact';
  if (/\/(gallery|portfolio|projects|work|case-stud)/.test(p)) return 'gallery';
  if (/\/(faq|help|support)/.test(p)) return 'faq';
  if (/\/(privacy|terms|policy|legal)/.test(p)) return 'legal';
  if (/\/(testimonial|review)/.test(p)) return 'testimonial';
  if (/\.(jpg|jpeg|png|gif|webp|pdf|svg)$/.test(p)) return 'asset';
  if (p.split('/').filter(Boolean).length === 1) return 'top_level_page';
  return 'inner_page';
}

function suggestNewUrl(oldUrl) {
  // Conservative 1:1 mapping — for a redesign on the same domain we keep
  // URL paths verbatim by default; sometimes they get normalised.
  // The actual redirect map gets refined per-customer; this is a sketch.
  try {
    const u = new URL(oldUrl);
    let p = u.pathname.replace(/\/+/g, '/').replace(/\/?$/, '/');
    if (p === '/') return p;
    return p.toLowerCase();
  } catch { return oldUrl; }
}

export async function analyzeSitemap({ baseUrl, fetchImpl = globalThis.fetch } = {}) {
  if (!baseUrl) return { ok: false, reason: 'baseUrl required' };
  let origin;
  try { origin = new URL(baseUrl).origin; }
  catch { return { ok: false, reason: 'invalid baseUrl' }; }

  // ── Probe robots.txt ──
  const robotsTxt = await fetchText(`${origin}/robots.txt`, fetchImpl);
  const hasRobots = Boolean(robotsTxt);
  const robotsSitemapHints = hasRobots
    ? [...robotsTxt.matchAll(/^\s*Sitemap:\s*(.+)$/gim)].map((m) => m[1].trim())
    : [];

  // ── Find sitemap candidates ──
  const candidates = [
    ...robotsSitemapHints,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
    `${origin}/sitemap1.xml`,
    `${origin}/wp-sitemap.xml`,
  ];

  let sitemapUrl = null;
  let sitemapText = null;
  for (const url of candidates) {
    const text = await fetchText(url, fetchImpl);
    if (text && /<urlset|<sitemapindex/i.test(text)) {
      sitemapUrl = url;
      sitemapText = text;
      break;
    }
  }

  if (!sitemapText) {
    return {
      ok: true,
      has_sitemap: false,
      has_robots: hasRobots,
      total_urls: 0,
      migration_complexity: 'unknown',
      reason: 'no sitemap found at standard paths',
    };
  }

  // ── Parse, expanding sitemapindex ──
  const allUrls = [];
  const queue = [{ text: sitemapText, sourceUrl: sitemapUrl }];
  const visited = new Set();
  while (queue.length && allUrls.length < 5000) {
    const { text } = queue.shift();
    const { isIndex, entries } = parseSitemapXml(text, origin);
    if (isIndex) {
      for (const e of entries.slice(0, 20)) {
        if (visited.has(e.loc)) continue;
        visited.add(e.loc);
        const sub = await fetchText(e.loc, fetchImpl);
        if (sub) queue.push({ text: sub, sourceUrl: e.loc });
      }
    } else {
      for (const e of entries) {
        if (allUrls.length >= 5000) break;
        allUrls.push(e);
      }
    }
  }

  const urlsByPattern = {};
  for (const u of allUrls) {
    let path;
    try { path = new URL(u.loc).pathname; } catch { continue; }
    const kind = classifyUrl(path);
    urlsByPattern[kind] = (urlsByPattern[kind] || 0) + 1;
  }

  // ── lastmod summary ──
  const dates = allUrls.map((u) => u.lastmod).filter(Boolean).map((d) => new Date(d)).filter((d) => !Number.isNaN(d.getTime()));
  dates.sort((a, b) => a - b);
  const yearDist = {};
  for (const d of dates) {
    const y = d.getUTCFullYear();
    yearDist[y] = (yearDist[y] || 0) + 1;
  }
  const lastModSummary = dates.length ? {
    newest: dates[dates.length - 1].toISOString().slice(0, 10),
    oldest: dates[0].toISOString().slice(0, 10),
    distribution_by_year: yearDist,
  } : null;

  // ── Redirect plan sketch ──
  const redirectPlan = allUrls.slice(0, 50).map((u) => {
    let path;
    try { path = new URL(u.loc).pathname; } catch { path = u.loc; }
    return { from: path, suggested_to: suggestNewUrl(u.loc), kind: classifyUrl(path) };
  });

  // ── Complexity estimate ──
  let complexity;
  if (allUrls.length <= 15) complexity = 'low';
  else if (allUrls.length <= 80) complexity = 'medium';
  else complexity = 'high';

  return {
    ok: true,
    has_sitemap: true,
    has_robots: hasRobots,
    sitemap_url: sitemapUrl,
    total_urls: allUrls.length,
    urls_by_pattern: urlsByPattern,
    last_mod_summary: lastModSummary,
    redirect_plan: redirectPlan,
    migration_complexity: complexity,
    robots_excerpt: hasRobots ? robotsTxt.slice(0, 500) : null,
  };
}
