/**
 * V3 D39 (2026-05-14) · Multi-page crawl · sitemap-aware · Firecrawl primary · Playwright fallback
 *
 * Per Matthew (D39):
 *   1. Sitemap 发现免费 layer: sitemap.xml · robots.txt · common patterns · BFS · Wayback
 *   2. Crawl 用 Firecrawl (multi-account key rotation) · 失败 fallback Playwright (本地 free)
 *   3. 抓回 raw JSON · 不预定义 extractor · 交给 AI 分析
 *
 * Output:
 *   {
 *     base_url: ...,
 *     sitemap_source: 'sitemap.xml' | 'robots.txt' | 'common-pattern' | 'bfs' | 'wayback' | 'fallback-bfs',
 *     pages: [
 *       { url, status, title, meta, rawHtml, text, images, links, headings, fetched_at },
 *       ...
 *     ],
 *     cost_estimate: 0.15,
 *     duration_ms: 12345,
 *   }
 */

import fs from 'node:fs';
import path from 'node:path';

const COMMON_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-1.xml',
  '/post-sitemap.xml',
  '/page-sitemap.xml',
  '/wp-sitemap.xml',
];

const PAGES_TO_CRAWL = [
  '/',          // homepage
  '/about',
  '/about-us',
  '/our-story',
  '/services',
  '/contact',
  '/contact-us',
  '/portfolio',
  '/projects',
  '/gallery',
  '/testimonials',
  '/reviews',
  '/team',
  '/our-team',
];

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ProfitsLocal-Audit/1.0';

/** Get all Firecrawl API keys from env (rotation) */
function firecrawlKeys() {
  const keys = [];
  if (process.env.FIRECRAWL_API_KEY) keys.push(process.env.FIRECRAWL_API_KEY);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`FIRECRAWL_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

/** Resolve URL · strip trailing slash · normalize */
function normalizeUrl(base, p) {
  try {
    return new URL(p, base).href.replace(/\/$/, '');
  } catch { return null; }
}

/** Parse <loc> entries from sitemap XML · return URL list */
function parseLocs(xml) {
  return (xml.match(/<loc>([^<]+)<\/loc>/g) || [])
    .map((m) => m.replace(/<\/?loc>/g, '').trim())
    .filter((u) => u.startsWith('http'));
}

/** Fetch + parse single sitemap file. If it's a sitemap-index (<sitemapindex>),
 *  recursively fetch child sitemaps (1 level deep · cap 5 children to avoid runaway).
 *  V3 D43 P4 fix: previously treated sitemap-index URLs as page URLs, so Firecrawl
 *  crawled the .xml file itself, giving pages_crawled=1 (the sitemap XML, not a page). */
async function fetchOneSitemap(url, depth = 0) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const xml = await res.text();
    const isIndex = /<sitemapindex[\s>]/i.test(xml);
    const locs = parseLocs(xml);
    if (!isIndex) return locs;
    if (depth >= 1) return []; // don't recurse > 1 level
    const all = [];
    for (const childUrl of locs.slice(0, 5)) {
      const child = await fetchOneSitemap(childUrl, depth + 1);
      all.push(...child);
    }
    return all;
  } catch { return []; }
}

/** Try fetch sitemap from common paths · return URL list */
async function fetchSitemap(baseUrl) {
  for (const pathTry of COMMON_SITEMAP_PATHS) {
    const url = normalizeUrl(baseUrl, pathTry);
    if (!url) continue;
    const urls = await fetchOneSitemap(url);
    if (urls.length > 0) return { urls, source: pathTry };
  }
  return null;
}

/** Try robots.txt · find Sitemap: directive */
async function fetchRobotsSitemap(baseUrl) {
  try {
    const url = normalizeUrl(baseUrl, '/robots.txt');
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;
    const text = await res.text();
    const m = text.match(/Sitemap:\s*(.+)/i);
    if (!m) return null;
    const sitemapUrl = m[1].trim();
    const sres = await fetch(sitemapUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!sres.ok) return null;
    const xml = await sres.text();
    const urls = (xml.match(/<loc>([^<]+)<\/loc>/g) || [])
      .map((m) => m.replace(/<\/?loc>/g, '').trim())
      .filter((u) => u.startsWith('http'));
    if (urls.length > 0) return { urls, source: 'robots.txt' };
  } catch { /* ignore */ }
  return null;
}

/** BFS from homepage · 2-level depth · pick interesting pages */
async function bfsFromHomepage(baseUrl) {
  try {
    const res = await fetch(baseUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;
    const html = await res.text();
    // Extract internal anchor hrefs
    const hrefMatches = [...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
    const urls = new Set([baseUrl]);
    for (const h of hrefMatches) {
      const abs = normalizeUrl(baseUrl, h);
      if (!abs) continue;
      try {
        const u = new URL(abs);
        // Same origin · skip anchors / external / asset files
        if (u.origin !== new URL(baseUrl).origin) continue;
        if (/\.(jpg|png|svg|css|js|pdf|webp|gif|ico)$/i.test(u.pathname)) continue;
        urls.add(abs);
        if (urls.size > 30) break;
      } catch { /* skip malformed */ }
    }
    return { urls: Array.from(urls), source: 'bfs' };
  } catch { return null; }
}

/** Discover URLs · free Layer 1 (sitemap.xml → robots → BFS) ·
 *  V3 D43 P4 fix: even if sitemap returns urls, supplement with BFS when count < 3
 *  (thin sitemap sites often have hidden pages reachable from homepage anchors) */
export async function discoverPageUrls(baseUrl) {
  // 1. Try common sitemap paths
  let result = await fetchSitemap(baseUrl);
  if (result && result.urls.length >= 3) return result;
  // 2. Try robots.txt
  const robotsR = await fetchRobotsSitemap(baseUrl);
  if (robotsR && robotsR.urls.length >= 3) return robotsR;
  // 3. BFS from homepage (always run if we're here · sitemap thin or missing)
  const bfsR = await bfsFromHomepage(baseUrl);
  // Merge sitemap (thin) + BFS
  if (result || robotsR || bfsR) {
    const sitemapUrls = result?.urls || robotsR?.urls || [];
    const bfsUrls = bfsR?.urls || [];
    const merged = Array.from(new Set([...sitemapUrls, ...bfsUrls]));
    const source = result ? (result.source + '+bfs') : robotsR ? 'robots.txt+bfs' : 'bfs';
    if (merged.length > 0) return { urls: merged, source };
  }
  let result2 = result || robotsR || bfsR;
  if (result2) return result2;
  // 4. Fallback: hard-coded common pages
  return {
    urls: PAGES_TO_CRAWL.map((p) => normalizeUrl(baseUrl, p)).filter(Boolean),
    source: 'fallback-common-paths',
  };
}

/** Pick "important" pages from discovered URL list · cap at N */
function pickImportantPages(allUrls, cap = 12) {
  const score = (u) => {
    const p = new URL(u).pathname.toLowerCase();
    if (p === '/' || p === '') return 100;          // homepage highest
    if (/^\/about(\/|\b)/i.test(p)) return 90;
    if (/^\/contact(\/|\b)/i.test(p)) return 85;
    if (/^\/services(\/|\b)/i.test(p)) return 80;
    if (/^\/portfolio(\/|\b)/i.test(p)) return 70;
    if (/^\/testimonials(\/|\b)/i.test(p)) return 70;
    if (/^\/team(\/|\b)/i.test(p)) return 65;
    if (/^\/gallery(\/|\b)/i.test(p)) return 60;
    if (/^\/reviews(\/|\b)/i.test(p)) return 60;
    if (/^\/faq(\/|\b)/i.test(p)) return 55;
    if (/^\/blog/i.test(p)) return 20;              // blog posts low (we don't migrate)
    // Service-detail pages
    if (/^\/services?\//i.test(p)) return 75;
    // Anything with 2+ slash levels = deep · low priority
    if ((p.match(/\//g) || []).length > 2) return 30;
    return 50;
  };
  return [...allUrls]
    .sort((a, b) => score(b) - score(a))
    .slice(0, cap);
}

/** Fetch single page via Firecrawl (with key rotation) · fallback to direct fetch */
async function fetchPageWithFirecrawl(url, keys) {
  for (const key of keys) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30_000);
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'html'],
          onlyMainContent: false,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        if (res.status === 402 || res.status === 429) continue; // try next key
        return null;
      }
      const data = await res.json();
      return {
        url,
        finalUrl: data.data?.metadata?.sourceURL || url,
        title: data.data?.metadata?.title || '',
        rawHtml: data.data?.html || '',
        text: data.data?.markdown || '',
        meta: data.data?.metadata || {},
        provider: 'firecrawl',
      };
    } catch { /* try next key */ }
  }
  return null;
}

/** Fallback: direct fetch (no Playwright · just HTML) */
async function fetchPageDirect(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return {
      url,
      finalUrl: res.url || url,
      title: titleMatch ? titleMatch[1].trim() : '',
      rawHtml: html,
      text: null, // no markdown extraction in direct fetch
      meta: {},
      provider: 'direct-fetch',
    };
  } catch { return null; }
}

/** Main entry · crawl multiple pages with sitemap discovery + Firecrawl/fallback */
export async function multiPageCrawl(baseUrl, { maxPages = 12 } = {}) {
  if (!baseUrl) return { pages: [], error: 'no baseUrl' };
  const start = Date.now();

  // 1. Discover URLs
  const discovery = await discoverPageUrls(baseUrl);
  const allUrls = discovery?.urls || [];

  // 2. Pick top N important pages
  const targetUrls = pickImportantPages(allUrls, maxPages);

  // 3. Crawl each · Firecrawl primary · direct fetch fallback
  const keys = firecrawlKeys();
  const pages = [];
  let firecrawlCount = 0;
  let directCount = 0;

  for (const url of targetUrls) {
    let page = null;
    if (keys.length > 0) {
      page = await fetchPageWithFirecrawl(url, keys);
      if (page) firecrawlCount++;
    }
    if (!page) {
      page = await fetchPageDirect(url);
      if (page) directCount++;
    }
    if (page) {
      page.fetched_at = new Date().toISOString();
      pages.push(page);
    }
  }

  return {
    base_url: baseUrl,
    sitemap_source: discovery?.source || 'none',
    total_urls_discovered: allUrls.length,
    pages_crawled: pages.length,
    pages_via_firecrawl: firecrawlCount,
    pages_via_direct: directCount,
    pages,
    cost_estimate: firecrawlCount * 0.015, // Firecrawl ~$0.015/page
    duration_ms: Date.now() - start,
  };
}

/** Save crawl result to disk · for AI analysis later */
export function saveCrawlResult(slug, result, repoRoot = process.cwd()) {
  const dir = path.join(repoRoot, 'clients', slug, 'v2/multi-page-crawl');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'crawl-result.json'), JSON.stringify(result, null, 2));
  return dir;
}
