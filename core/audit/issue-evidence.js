/**
 * Issue evidence capture — turns each audit issue into a "see it for yourself"
 * cropped screenshot.
 *
 * Strategy: per-issue heuristic mapping issue id → Playwright selector OR
 * region clip (top X px, full first viewport, etc). For LLM-emitted issues
 * that we don't have a hardcoded mapping for, fall back to:
 *   1. Try to find the most semantically matching element from a small
 *      keyword set (e.g. "form" → <form>, "hero" → first <section>/<header>)
 *   2. If nothing matches, use the desktop full-screenshot (already in the
 *      report) and mark evidence as "see full screenshot above" — not adding
 *      a duplicate file.
 *
 * Output: per issue, either { evidencePath: '<file>' } or null. Caller copies
 * files into the client v2 dir and embeds in the HTML report.
 */

import fs from 'fs';
import path from 'path';

// Hardcoded mapping for the V2 detailed-audit rule ids
const RULE_STRATEGY = {
  // Technical
  https_enabled:         { kind: 'address-bar', text: 'browser shows "Not Secure" in URL bar' },
  first_paint_under_3s:  { kind: 'video-ref',   refKey: 'mobileThrottled' },
  mobile_responsive:     { kind: 'mobile-full' },
  no_console_errors:     { kind: 'note', text: 'see DevTools console screenshot (deferred)' },
  favicon_and_meta:      { kind: 'head-html' },

  // UX / Conversion
  above_fold_cta_within_5s: { kind: 'desktop-region', clip: { y: 0, height: 800 } },
  phone_visible_above_fold: { kind: 'desktop-region', clip: { y: 0, height: 800 } },
  click_to_call_link:    { kind: 'mobile-full' },
  quote_or_booking_form: { kind: 'selector', selector: 'form' },
  has_gallery:           { kind: 'selector', selector: '[class*="gallery" i], [class*="portfolio" i], [id*="gallery" i]' },
  has_testimonials:      { kind: 'selector', selector: '[class*="testimonial" i], [class*="review" i], [id*="testimonial" i]' },

  // Content
  homepage_title_clear:  { kind: 'desktop-region', clip: { y: 0, height: 600 } },
  service_copy_specific: { kind: 'selector', selector: 'section, [class*="service" i]' },
  trust_signals_present: { kind: 'selector', selector: '[class*="trust" i], [class*="award" i], [class*="certif" i]' },
  localized_content:     { kind: 'desktop-full' },
  evidence_of_recent_update: { kind: 'footer' },
  non_ai_filler_copy:    { kind: 'desktop-full' },

  // SEO
  title_meta_present:    { kind: 'head-html' },
  h1_unique:             { kind: 'h1-list' },
  local_schema_markup:   { kind: 'jsonld-blocks' },
  image_alt_present:     { kind: 'note', text: 'image alt audit lives in raw HTML — see appendix' },
  sitemap_robots:        { kind: 'note', text: '/sitemap.xml + /robots.txt probe — see appendix' },

  // GBP
  has_website_link:        { kind: 'note', text: 'GBP-side issue, see business profile' },
  review_volume_vs_peers:  { kind: 'note', text: 'GBP-side issue, see business profile' },
  average_rating:          { kind: 'note', text: 'GBP-side issue' },
  has_hours:               { kind: 'note', text: 'GBP-side issue' },
  image_count:             { kind: 'note', text: 'GBP-side issue' },
  has_business_description:{ kind: 'note', text: 'GBP-side issue' },
  has_service_area:        { kind: 'note', text: 'GBP-side issue' },
  owner_replies_to_reviews:{ kind: 'note', text: 'GBP-side issue (review thread evidence on demand)' },
};

// Vision LLM uses different ids (snake_case but more arbitrary). Keyword
// fuzzy match.
function strategyForVisionIssueId(id, title = '') {
  const haystack = (id + ' ' + title).toLowerCase();
  // Mobile-related matches FIRST — "mobile cta", "mobile nav", etc need the mobile screenshot
  if (/mobile|hamburger|tap.?target|small.?screen|phone.?view/.test(haystack)) return { kind: 'mobile-full' };
  if (/cta|call.?to.?action|button.*hidden|hidden.*button/.test(haystack)) return { kind: 'desktop-region', clip: { y: 0, height: 800 } };
  if (/hero|banner|first.?screen|above.?fold/.test(haystack)) return { kind: 'desktop-region', clip: { y: 0, height: 700 } };
  if (/form|input|quote/.test(haystack)) return { kind: 'selector', selector: 'form' };
  if (/nav|menu/.test(haystack)) return { kind: 'selector', selector: 'header, nav' };
  if (/footer/.test(haystack)) return { kind: 'footer' };
  if (/contrast|color|legib|font/.test(haystack)) return { kind: 'desktop-region', clip: { y: 0, height: 700 } };
  if (/image|photo|stock|hero.?image|gradient/.test(haystack)) return { kind: 'desktop-region', clip: { y: 0, height: 700 } };
  if (/testimonial|review/.test(haystack)) return { kind: 'selector', selector: '[class*="testimonial" i], [class*="review" i]' };
  if (/gallery|portfolio/.test(haystack)) return { kind: 'selector', selector: '[class*="gallery" i], [class*="portfolio" i]' };
  return { kind: 'desktop-full' };
}

/**
 * Given a set of issues + a Playwright page (already navigated to the lead
 * site), capture evidence for each issue. Returns array of { id, evidence }.
 */
export async function captureIssueEvidence({ page, issues, outputDir }) {
  if (!page || !issues?.length) return [];
  fs.mkdirSync(outputDir, { recursive: true });
  const results = [];

  for (const issue of issues) {
    const id = issue.id;
    const strat = RULE_STRATEGY[id] || strategyForVisionIssueId(id, issue.title || '');
    const fileBase = `issue-${sanitize(id)}`;
    const dst = path.join(outputDir, `${fileBase}.png`);

    try {
      switch (strat.kind) {
        case 'desktop-region': {
          const clip = { x: 0, y: strat.clip.y || 0, width: 1440, height: strat.clip.height || 800 };
          await page.screenshot({ path: dst, clip });
          results.push({ id, evidence: { type: 'cropped', path: dst, label: `Desktop ${clip.height}px region` } });
          break;
        }
        case 'desktop-full': {
          await page.screenshot({ path: dst });
          results.push({ id, evidence: { type: 'full', path: dst, label: 'Full desktop' } });
          break;
        }
        case 'mobile-full': {
          // caller's responsibility to pass mobile page; here we just note the existing one
          results.push({ id, evidence: { type: 'mobile-ref', label: 'See mobile.png in screenshots/' } });
          break;
        }
        case 'selector': {
          const loc = page.locator(strat.selector).first();
          const count = await loc.count().catch(() => 0);
          if (count > 0) {
            await loc.screenshot({ path: dst });
            results.push({ id, evidence: { type: 'element', selector: strat.selector, path: dst, label: `Element: ${strat.selector}` } });
          } else {
            results.push({ id, evidence: { type: 'note', label: `selector not found: ${strat.selector}` } });
          }
          break;
        }
        case 'footer': {
          const loc = page.locator('footer').first();
          if (await loc.count().catch(() => 0)) {
            await loc.screenshot({ path: dst });
            results.push({ id, evidence: { type: 'element', selector: 'footer', path: dst, label: 'Footer' } });
          } else {
            // Fallback: bottom 600px of viewport
            const dim = page.viewportSize();
            const clip = { x: 0, y: Math.max(0, (dim?.height || 900) - 600), width: dim?.width || 1440, height: 600 };
            await page.screenshot({ path: dst, clip });
            results.push({ id, evidence: { type: 'cropped', path: dst, label: 'Bottom region (footer fallback)' } });
          }
          break;
        }
        case 'head-html': {
          const headHtml = await page.evaluate(() => document.head.outerHTML.slice(0, 2000));
          results.push({ id, evidence: { type: 'html-snippet', text: headHtml, label: '<head> snippet' } });
          break;
        }
        case 'h1-list': {
          const h1s = await page.evaluate(() => Array.from(document.querySelectorAll('h1')).map((h) => h.outerHTML.slice(0, 200)));
          results.push({ id, evidence: { type: 'html-list', items: h1s, label: `${h1s.length} <h1> tag(s) found` } });
          break;
        }
        case 'jsonld-blocks': {
          const blocks = await page.evaluate(() =>
            Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent.slice(0, 1500))
          );
          results.push({ id, evidence: { type: 'jsonld-list', items: blocks, label: `${blocks.length} JSON-LD block(s) found` } });
          break;
        }
        case 'video-ref': {
          results.push({ id, evidence: { type: 'video-ref', refKey: strat.refKey, label: 'See mobile-throttled loading video' } });
          break;
        }
        case 'note':
        default:
          results.push({ id, evidence: { type: 'note', label: strat.text || 'no specific evidence captured' } });
      }
    } catch (err) {
      results.push({ id, evidence: { type: 'error', label: `capture failed: ${err.message?.slice(0, 80)}` } });
    }
  }
  return results;
}

function sanitize(s) {
  return String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
