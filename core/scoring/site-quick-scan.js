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
const CONFIG_PATH_CANDIDATES = [
  path.join(__dirname, 'cheap-audit-config.json'),
  path.join(process.cwd(), 'core/scoring/cheap-audit-config.json'),
];

let _config = null;
function loadConfig() {
  if (_config) return _config;
  for (const p of CONFIG_PATH_CANDIDATES) {
    if (fs.existsSync(p)) {
      _config = JSON.parse(fs.readFileSync(p, 'utf8'));
      return _config;
    }
  }
  throw new Error(`cheap-audit-config.json not found in any of: ${CONFIG_PATH_CANDIDATES.join(', ')}`);
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
  const ruleById = new Map(rules.map((r) => [r.id, r]));

  const md = String(markdown || '');
  const mdLower = md.toLowerCase();
  const aboveFold = md.slice(0, 1500);
  const aboveFoldLower = aboveFold.toLowerCase();
  const html = String(rawHtml || '');
  const htmlLower = html.toLowerCase();

  // Detection dispatch — config carries weight/max/severity; code carries only the test.
  // Each detector returns { hit: boolean, earned?: number, rationale: string, not_evaluated?: boolean }.
  // If `earned` is omitted, it defaults to rule.max when hit, else 0.
  const detectors = {
    missing_https: () => {
      const isHttp = /^http:\/\//i.test(url);
      return {
        hit: isHttp,
        rationale: isHttp ? 'URL uses http:// — no TLS' : 'HTTPS present',
      };
    },
    homepage_text_thin: () => {
      const len = md.length;
      const max = ruleById.get('homepage_text_thin').max;
      let earned;
      if (len < 300) earned = max;
      else if (len < 800) earned = Math.round(max / 2);
      else earned = 0;
      return {
        hit: earned > 0,
        earned,
        rationale: `homepage text length = ${len} chars`,
      };
    },
    no_local_mention: () => {
      const cityNorm = businessCity.toLowerCase().trim();
      const suburbNorm = businessSuburb.toLowerCase().trim();
      const hasCity = cityNorm && mdLower.includes(cityNorm);
      const hasSuburb = suburbNorm && mdLower.includes(suburbNorm);
      const missing = !hasCity && !hasSuburb;
      return {
        hit: missing,
        rationale: missing
          ? `homepage does not mention "${businessCity || '(unknown city)'}" or "${businessSuburb || '(unknown suburb)'}"`
          : `local mention found: ${hasCity ? businessCity : ''}${hasSuburb ? ' / ' + businessSuburb : ''}`.trim(),
      };
    },
    no_phone_above_fold: () => {
      let missing = true;
      if (phoneDigits && phoneDigits.length >= 6) {
        const aboveFoldDigits = aboveFold.replace(/\D+/g, '');
        missing = !aboveFoldDigits.includes(phoneDigits.slice(-6));
      }
      return {
        hit: missing,
        rationale: missing
          ? 'phone digits not in first 1500 chars of homepage'
          : 'phone present above fold',
      };
    },
    no_cta_keywords: () => {
      const hasCta = CTA_KEYWORDS.some((kw) => aboveFoldLower.includes(kw));
      return {
        hit: !hasCta,
        rationale: hasCta ? 'CTA keyword found above fold' : 'no CTA keyword in first 1500 chars',
      };
    },
    stale_year_marker: () => {
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
      return {
        hit: stale,
        rationale: footerYear === null
          ? 'no copyright year detected'
          : stale
            ? `footer year ${footerYear} (≥${currentYear - 2} would be fresh)`
            : `footer year ${footerYear} is fresh`,
      };
    },
    missing_skeleton: () => {
      const present = SKELETON_TOKENS.filter((t) => mdLower.includes(t));
      const missing = present.length < 2;
      return {
        hit: missing,
        rationale: missing
          ? `only ${present.length} skeleton sections present (need 2+)`
          : `${present.length} sections found: ${present.join(', ')}`,
      };
    },
    no_mobile_viewport: () => {
      if (!html) {
        return {
          hit: false,
          earned: 0,
          rationale: 'rawHtml not available — cannot check viewport (skipped)',
          not_evaluated: true,
        };
      }
      const has = /<meta[^>]+name=["']viewport["']/i.test(html);
      const hit = !has;
      return {
        hit,
        rationale: hit ? 'no <meta name="viewport"> in HTML head' : 'viewport meta present',
      };
    },
    table_layout_smell: () => {
      if (!html) {
        return {
          hit: false,
          earned: 0,
          rationale: 'rawHtml not available — cannot check tables (skipped)',
          not_evaluated: true,
        };
      }
      const tableMatches = htmlLower.match(/<table\b/g) || [];
      const presentationMatches = htmlLower.match(/<table[^>]+role=["']presentation["']/g) || [];
      const layoutTables = tableMatches.length - presentationMatches.length;
      const hit = layoutTables >= 5;
      return {
        hit,
        rationale: `${layoutTables} non-presentation <table> tags`,
      };
    },
    image_quality_smell: () => {
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
      return {
        hit,
        rationale: imgs.length === 0
          ? 'no image references detected in markdown'
          : `${imgs.length} images, ${lowQualityCount} low-quality URL patterns, ${missingAltCount} missing alt`,
      };
    },
  };

  // Iterate config-declared rules in their declared order; pull weight/max from config.
  const results = rules.map((rule) => {
    const detector = detectors[rule.id];
    if (!detector) {
      return {
        id: rule.id, earned: 0, max: rule.max, hit: false,
        rationale: `no detector implemented for ${rule.id} (skipped)`,
        not_evaluated: true,
      };
    }
    const out = detector();
    const earned = out.not_evaluated
      ? 0
      : (typeof out.earned === 'number' ? out.earned : (out.hit ? rule.max : 0));
    return {
      id: rule.id,
      earned,
      max: rule.max,
      hit: !!out.hit,
      rationale: out.rationale,
      ...(out.not_evaluated ? { not_evaluated: true } : {}),
    };
  });

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
