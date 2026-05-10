/**
 * Site Quick Scan — V2 Stage 2 of cheap audit.
 *
 * Takes a fetched homepage payload (markdown text + optional raw HTML head) and
 * runs the 10 heuristics defined in cheap-audit-config.json#stage_2_site_quick_scan
 * to produce a redesign_need score 0-100 with per-rule breakdown.
 *
 * The fetch itself happens upstream (Tinyfish or Dokobot) so this module is
 * pure logic — testable without network, scoring is reproducible.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'cheap-audit-config.json');

let _config = null;
function loadConfig() {
  if (_config) return _config;
  _config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  return _config;
}

const CTA_KEYWORDS = ['quote', 'contact', 'book', 'call', 'get a', 'free quote', 'get quote', 'get in touch', 'request', 'enquir'];
const SKELETON_TOKENS = ['service', 'about', 'contact', 'review', 'testimonial', 'faq', 'gallery'];
const LOW_QUALITY_IMAGE_PATTERNS = [/\/(\d{2,3}x\d{2,3})\//i, /\/thumb/i, /\/sm\//i, /\/icon\//i];

/**
 * Run quick scan against a fetched page payload.
 *
 * @param {object} input
 * @param {string} input.url — the URL that was fetched
 * @param {string} input.markdown — Tinyfish/Dokobot markdown text
 * @param {string?} input.rawHtml — raw HTML if available (Tinyfish doesn't return it; Dokobot read does in some forms)
 * @param {string?} input.businessCity — for local-mention check
 * @param {string?} input.businessSuburb — alternative local mention
 * @param {string?} input.phoneDigits — for phone-above-fold check
 * @param {number?} input.currentYear — defaults to now
 * @returns {{ redesign_need: number, max: number, rules: Array<{id, earned, max, hit, rationale}>, evidence: object }}
 */
export function siteQuickScan({
  url,
  markdown = '',
  rawHtml = '',
  businessCity = '',
  businessSuburb = '',
  phoneDigits = '',
  currentYear = new Date().getFullYear(),
} = {}) {
  if (!url) throw new Error('url is required');
  const config = loadConfig();
  const rules = config.stages.stage_2_site_quick_scan.rules;

  const md = String(markdown || '');
  const mdLower = md.toLowerCase();
  const aboveFold = md.slice(0, 1500);
  const aboveFoldLower = aboveFold.toLowerCase();
  const html = String(rawHtml || '');
  const htmlLower = html.toLowerCase();

  const results = [];
  const earnMap = new Map(rules.map((r) => [r.id, 0]));

  // 1. missing_https
  {
    const isHttp = /^http:\/\//i.test(url);
    const earned = isHttp ? 18 : 0;
    earnMap.set('missing_https', earned);
    results.push({
      id: 'missing_https', earned, max: 18, hit: isHttp,
      rationale: isHttp ? 'URL uses http:// — no TLS' : 'HTTPS present',
    });
  }

  // 2. homepage_text_thin
  {
    const len = md.length;
    let earned;
    if (len < 300) earned = 8;
    else if (len < 800) earned = 4;
    else earned = 0;
    earnMap.set('homepage_text_thin', earned);
    results.push({
      id: 'homepage_text_thin', earned, max: 8, hit: earned > 0,
      rationale: `homepage text length = ${len} chars`,
    });
  }

  // 3. no_local_mention
  {
    const cityNorm = businessCity.toLowerCase().trim();
    const suburbNorm = businessSuburb.toLowerCase().trim();
    const hasCity = cityNorm && mdLower.includes(cityNorm);
    const hasSuburb = suburbNorm && mdLower.includes(suburbNorm);
    const missing = !hasCity && !hasSuburb;
    const earned = missing ? 10 : 0;
    earnMap.set('no_local_mention', earned);
    results.push({
      id: 'no_local_mention', earned, max: 10, hit: missing,
      rationale: missing
        ? `homepage does not mention "${businessCity || '(unknown city)'}" or "${businessSuburb || '(unknown suburb)'}"`
        : `local mention found: ${hasCity ? businessCity : ''}${hasSuburb ? ' / ' + businessSuburb : ''}`.trim(),
    });
  }

  // 4. no_phone_above_fold
  {
    let missing = true;
    if (phoneDigits && phoneDigits.length >= 6) {
      // strip non-digit and check digits substring
      const aboveFoldDigits = aboveFold.replace(/\D+/g, '');
      missing = !aboveFoldDigits.includes(phoneDigits.slice(-6));
    }
    const earned = missing ? 12 : 0;
    earnMap.set('no_phone_above_fold', earned);
    results.push({
      id: 'no_phone_above_fold', earned, max: 12, hit: missing,
      rationale: missing
        ? 'phone digits not in first 1500 chars of homepage'
        : 'phone present above fold',
    });
  }

  // 5. no_cta_keywords
  {
    const hasCta = CTA_KEYWORDS.some((kw) => aboveFoldLower.includes(kw));
    const earned = hasCta ? 0 : 10;
    earnMap.set('no_cta_keywords', earned);
    results.push({
      id: 'no_cta_keywords', earned, max: 10, hit: !hasCta,
      rationale: hasCta ? 'CTA keyword found above fold' : 'no CTA keyword in first 1500 chars',
    });
  }

  // 6. stale_year_marker
  {
    // Scan for "©" or "copyright" followed by a 4-digit year, OR a bare 4-digit year in the last 500 chars (footer-ish)
    const tail = md.slice(-1000);
    const yearMatches = [...md.matchAll(/(?:©|copyright|\(c\))\s*(?:19|20)\d{2}/gi)];
    let footerYear = null;
    for (const m of yearMatches) {
      const yMatch = m[0].match(/(19|20)\d{2}/);
      if (yMatch) {
        const y = Number(yMatch[0]);
        if (!footerYear || y > footerYear) footerYear = y;
      }
    }
    if (!footerYear) {
      const tailYearMatches = [...tail.matchAll(/(19|20)\d{2}/g)].map((m) => Number(m[0]));
      if (tailYearMatches.length) footerYear = Math.max(...tailYearMatches);
    }
    const stale = footerYear !== null && footerYear < currentYear - 2;
    const earned = stale ? 8 : 0;
    earnMap.set('stale_year_marker', earned);
    results.push({
      id: 'stale_year_marker', earned, max: 8, hit: stale,
      rationale: footerYear === null
        ? 'no copyright year detected'
        : stale
          ? `footer year ${footerYear} (≥${currentYear - 2} would be fresh)`
          : `footer year ${footerYear} is fresh`,
    });
  }

  // 7. missing_skeleton
  {
    const present = SKELETON_TOKENS.filter((t) => mdLower.includes(t));
    const missing = present.length < 2;
    const earned = missing ? 10 : 0;
    earnMap.set('missing_skeleton', earned);
    results.push({
      id: 'missing_skeleton', earned, max: 10, hit: missing,
      rationale: missing
        ? `only ${present.length} skeleton sections present (need 2+)`
        : `${present.length} sections found: ${present.join(', ')}`,
    });
  }

  // 8. no_mobile_viewport
  {
    // Tinyfish doesn't return raw HTML; only flag if rawHtml is provided AND missing viewport
    let earned = 0;
    let rationale;
    let hit = false;
    if (html) {
      const has = /<meta[^>]+name=["']viewport["']/i.test(html);
      hit = !has;
      earned = hit ? 12 : 0;
      rationale = hit ? 'no <meta name="viewport"> in HTML head' : 'viewport meta present';
    } else {
      rationale = 'rawHtml not available — cannot check viewport (skipped)';
    }
    earnMap.set('no_mobile_viewport', earned);
    results.push({
      id: 'no_mobile_viewport', earned, max: 12, hit, rationale,
      not_evaluated: !html,
    });
  }

  // 9. table_layout_smell
  {
    let earned = 0;
    let hit = false;
    let rationale;
    if (html) {
      const tableMatches = htmlLower.match(/<table\b/g) || [];
      const presentationMatches = htmlLower.match(/<table[^>]+role=["']presentation["']/g) || [];
      const layoutTables = tableMatches.length - presentationMatches.length;
      hit = layoutTables >= 5;
      earned = hit ? 6 : 0;
      rationale = `${layoutTables} non-presentation <table> tags`;
    } else {
      rationale = 'rawHtml not available — cannot check tables (skipped)';
    }
    earnMap.set('table_layout_smell', earned);
    results.push({
      id: 'table_layout_smell', earned, max: 6, hit, rationale,
      not_evaluated: !html,
    });
  }

  // 10. image_quality_smell
  {
    // Look for image refs in markdown ![alt](url) or HTML <img src=...>
    const mdImages = [...md.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map((m) => ({ alt: m[1], url: m[2] }));
    const htmlImages = html
      ? [...html.matchAll(/<img\b[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["']?/gi)]
        .map((m) => ({ alt: m[2] || '', url: m[1] }))
      : [];
    const imgs = [...mdImages, ...htmlImages];
    let lowQualityCount = 0;
    let missingAltCount = 0;
    for (const img of imgs) {
      if (!img.alt.trim()) missingAltCount += 1;
      if (LOW_QUALITY_IMAGE_PATTERNS.some((p) => p.test(img.url))) lowQualityCount += 1;
    }
    const hit = imgs.length > 0 && (lowQualityCount > 0 || missingAltCount >= 3);
    const earned = hit ? 6 : 0;
    earnMap.set('image_quality_smell', earned);
    results.push({
      id: 'image_quality_smell', earned, max: 6, hit,
      rationale: imgs.length === 0
        ? 'no image references detected in markdown'
        : `${imgs.length} images, ${lowQualityCount} low-quality URL patterns, ${missingAltCount} missing alt`,
    });
  }

  const evaluated = results.filter((r) => !r.not_evaluated);
  const earnedTotal = evaluated.reduce((a, r) => a + r.earned, 0);
  const maxTotal = evaluated.reduce((a, r) => a + r.max, 0);
  const redesign_need = maxTotal === 0 ? 0 : Math.round((earnedTotal / maxTotal) * 100);

  return {
    redesign_need,
    earned_total: earnedTotal,
    max_total: maxTotal,
    rules: results,
    evidence: {
      url,
      markdown_length: md.length,
      raw_html_available: Boolean(html),
      rules_evaluated: evaluated.length,
      rules_skipped: results.length - evaluated.length,
    },
  };
}
