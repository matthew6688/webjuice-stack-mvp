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

// Australian roofing-relevant location keywords. When a URL slug contains
// one of these along with a service keyword, it likely is an area-targeted
// landing page (key for local SEO long-tail).
const AU_LOCATION_KEYWORDS = [
  'brisbane', 'sunshine-coast', 'sunshinecoast', 'gold-coast', 'goldcoast',
  'ipswich', 'logan', 'redland', 'caboolture', 'pine-rivers', 'morayfield',
  'redcliffe', 'caboolture', 'beenleigh', 'springwood', 'cleveland', 'wynnum',
  'sydney', 'melbourne', 'perth', 'adelaide', 'newcastle', 'hobart', 'canberra',
  // QLD suburbs (incomplete — add as needed)
  'new-farm', 'newfarm', 'paddington', 'toowong', 'indooroopilly', 'kenmore',
  'chermside', 'aspley', 'sandgate', 'kallangur', 'lawnton', 'strathpine',
  'capalaba', 'mansfield', 'mount-gravatt', 'mountgravatt', 'sherwood',
  'qld', 'queensland', 'nsw', 'vic', 'wa', 'sa', 'tas', 'act', 'nt',
];

// Roofing-specific service keywords. Service pages should target these.
const ROOFING_SERVICE_KEYWORDS = [
  'roof', 'roofing', 'tile', 'metal-roof', 'metal-roofing', 'colorbond',
  'tile-restoration', 'tile-replacement', 'tile-repair', 'tile-roof',
  'gutter', 'guttering', 'gutter-cleaning', 'gutter-repair',
  'skylight', 'skylights', 'velux',
  'leak', 'leak-repair', 'leak-detection',
  'attic', 'attic-conversion', 'roof-conversion', 'roof-space',
  'insulation', 'roof-restoration', 'roof-painting', 'roof-replacement',
  'storm-damage', 'storm-repair', 'emergency',
];

function classifyUrl(urlPath, opts = {}) {
  const p = urlPath.toLowerCase();
  if (p === '/' || p === '') return 'home';
  if (/\/(blog|news|article|post)/.test(p)) return 'blog_post';
  if (/\.(jpg|jpeg|png|gif|webp|pdf|svg)$/.test(p)) return 'asset';
  if (/\/(about|company|team|history|our-story)/.test(p)) return 'about';
  if (/\/(contact|quote|booking|enquiry|enquire|call)/.test(p)) return 'contact';
  if (/\/(gallery|portfolio|projects|work|case-stud)/.test(p)) return 'gallery';
  if (/\/(faq|help|support)/.test(p)) return 'faq';
  if (/\/(privacy|terms|policy|legal)/.test(p)) return 'legal';
  if (/\/(testimonial|review)/.test(p)) return 'testimonial';

  // Service + area combinations — strong SEO long-tail signal
  const niche = opts.niche || '';
  const serviceWords = niche.includes('roof') ? ROOFING_SERVICE_KEYWORDS : ROOFING_SERVICE_KEYWORDS;
  const matchedService = serviceWords.find((w) => p.includes(w));
  const matchedLocation = AU_LOCATION_KEYWORDS.find((w) => p.includes(w));

  if (matchedService && matchedLocation) return 'service_area_page';      // e.g. /metal-roofing-brisbane/
  if (matchedService) return 'service_page';                              // e.g. /metal-roofing/
  if (matchedLocation && p.includes('service')) return 'service_area_page';
  if (matchedLocation) return 'area_page';                                // e.g. /service-areas/brisbane/

  if (/\/(service|services)\//.test(p)) return 'service_page';
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

export async function analyzeSitemap({ baseUrl, niche, fetchImpl = globalThis.fetch } = {}) {
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
  const servicePages = [];
  const areaPages = [];
  const serviceAreaPages = [];
  for (const u of allUrls) {
    let path;
    try { path = new URL(u.loc).pathname; } catch { continue; }
    const kind = classifyUrl(path, { niche });
    urlsByPattern[kind] = (urlsByPattern[kind] || 0) + 1;
    if (kind === 'service_page') servicePages.push(path);
    else if (kind === 'area_page') areaPages.push(path);
    else if (kind === 'service_area_page') serviceAreaPages.push(path);
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

  // ── SEO long-tail structure assessment ──
  // For local services, "service × area" combos drive long-tail traffic.
  // E.g. /metal-roofing-brisbane/ ranks for "metal roofing brisbane" much
  // better than a generic /services/ page. Detect what they have + what's
  // missing for the next-page-built recommendation.
  const seoStructure = {
    service_page_count: servicePages.length,
    area_page_count: areaPages.length,
    service_area_page_count: serviceAreaPages.length,
    service_page_samples: servicePages.slice(0, 5),
    area_page_samples: areaPages.slice(0, 5),
    service_area_page_samples: serviceAreaPages.slice(0, 5),
    long_tail_coverage:
      serviceAreaPages.length >= 5 ? 'strong'
      : serviceAreaPages.length >= 2 ? 'moderate'
      : servicePages.length >= 3 ? 'service_only_no_area'
      : servicePages.length >= 1 ? 'minimal'
      : 'none',
  };

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
    seo_structure: seoStructure,
    robots_excerpt: hasRobots ? robotsTxt.slice(0, 500) : null,
  };
}
