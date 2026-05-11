/**
 * Image optimization audit — parses rawHtml for <img> and <picture>
 * elements and assesses optimization posture.
 *
 * Checks per image:
 *   - Format (.webp / .avif vs .jpg/.png) — modern formats save 30-50% bytes
 *   - srcset present — responsive serving
 *   - loading="lazy" — defer offscreen images
 *   - alt text present (also AI/GEO + a11y signal)
 *   - explicit width/height (prevents CLS layout shift)
 *
 * Tier T0. Operates on already-fetched rawHtml.
 *
 * Output:
 *   {
 *     total_images, optimized_count, sample_unoptimized: [...],
 *     formats: { webp, avif, jpg, png, svg, gif, other },
 *     has_srcset_pct, lazy_load_pct, alt_present_pct, dimensions_pct,
 *     verdict: 'optimized' | 'partial' | 'unoptimized',
 *     issues: [{ severity, msg }]
 *   }
 */

const IMG_TAG_RE = /<img\s+[^>]*>/gi;
const ATTR_SRC_RE = /\bsrc\s*=\s*["']([^"']+)["']/i;
const ATTR_SRCSET_RE = /\bsrcset\s*=\s*["']/i;
const ATTR_LAZY_RE = /\bloading\s*=\s*["']lazy["']/i;
const ATTR_ALT_RE = /\balt\s*=\s*["']([^"']*)["']/i;
const ATTR_WIDTH_RE = /\bwidth\s*=\s*["']?(\d+)/i;
const ATTR_HEIGHT_RE = /\bheight\s*=\s*["']?(\d+)/i;
const PICTURE_RE = /<picture\b[\s\S]*?<\/picture>/gi;

function getFormat(src) {
  if (!src) return 'other';
  const lower = src.toLowerCase();
  if (lower.includes('.webp')) return 'webp';
  if (lower.includes('.avif')) return 'avif';
  if (lower.match(/\.(jpe?g)(?:\?|#|$)/)) return 'jpg';
  if (lower.match(/\.png(?:\?|#|$)/)) return 'png';
  if (lower.match(/\.svg(?:\?|#|$)/)) return 'svg';
  if (lower.match(/\.gif(?:\?|#|$)/)) return 'gif';
  // CDN URLs may omit extension; check for common image CDN paths
  if (/\/(images|img|uploads|media|wp-content\/uploads)\//.test(lower)) return 'other_image_path';
  return 'other';
}

export function auditImageOptimization({ rawHtml = '' } = {}) {
  if (!rawHtml) return { ok: false, reason: 'no rawHtml' };

  const imgs = rawHtml.match(IMG_TAG_RE) || [];
  const pictures = rawHtml.match(PICTURE_RE) || [];

  const formats = { webp: 0, avif: 0, jpg: 0, png: 0, svg: 0, gif: 0, other_image_path: 0, other: 0 };
  let withSrcset = 0;
  let withLazy = 0;
  let withAlt = 0;
  let withAltNonEmpty = 0;
  let withDimensions = 0;
  const unoptimizedSamples = [];

  for (const tag of imgs) {
    const src = (tag.match(ATTR_SRC_RE) || [])[1] || '';
    const fmt = getFormat(src);
    formats[fmt] = (formats[fmt] || 0) + 1;
    const hasSrcset = ATTR_SRCSET_RE.test(tag);
    const hasLazy = ATTR_LAZY_RE.test(tag);
    const altMatch = tag.match(ATTR_ALT_RE);
    const hasAlt = altMatch != null;
    const altText = altMatch ? altMatch[1].trim() : '';
    const w = ATTR_WIDTH_RE.test(tag);
    const h = ATTR_HEIGHT_RE.test(tag);

    if (hasSrcset) withSrcset += 1;
    if (hasLazy) withLazy += 1;
    if (hasAlt) withAlt += 1;
    if (hasAlt && altText.length > 0) withAltNonEmpty += 1;
    if (w && h) withDimensions += 1;

    // Sample unoptimized images for the report
    if (unoptimizedSamples.length < 6) {
      const issues = [];
      if (fmt === 'jpg' || fmt === 'png') issues.push('未用 WebP/AVIF');
      if (!hasSrcset) issues.push('无响应式 srcset');
      if (!hasLazy) issues.push('未 lazy load');
      if (!hasAlt || altText.length === 0) issues.push('无 alt');
      if (issues.length >= 2) {
        unoptimizedSamples.push({
          src: src.slice(0, 80),
          format: fmt,
          issues,
        });
      }
    }
  }

  const total = imgs.length;
  const pct = (n) => total ? Math.round((n / total) * 100) : 0;

  // Picture elements with WebP sources count as "optimized" implicitly
  const pictureSourceWebp = pictures.filter((p) => /<source[^>]+type="image\/webp"/i.test(p)).length;
  const optimizedCount = formats.webp + formats.avif + formats.svg + pictureSourceWebp;

  const optimizedPct = total ? Math.round((optimizedCount / total) * 100) : 0;
  let verdict;
  if (total === 0) verdict = 'no_images';
  else if (optimizedPct >= 70 && withSrcset / total >= 0.5 && withLazy / total >= 0.5) verdict = 'optimized';
  else if (optimizedPct >= 30 || withSrcset / total >= 0.3) verdict = 'partial';
  else verdict = 'unoptimized';

  const issues = [];
  if (verdict === 'unoptimized') {
    issues.push({ severity: 'major', msg: `${total} 张图几乎全是 JPG/PNG，未用 WebP/AVIF — 估算可节省 30-50% 图片下载量` });
  } else if (verdict === 'partial') {
    const jpgPng = formats.jpg + formats.png;
    if (jpgPng > 0) issues.push({ severity: 'minor', msg: `${jpgPng} 张图仍是 JPG/PNG，建议转 WebP` });
  }
  if (total > 0 && withSrcset / total < 0.3) issues.push({ severity: 'minor', msg: `${total - withSrcset}/${total} 张图无响应式 srcset — 移动端浪费带宽` });
  if (total > 5 && withLazy / total < 0.5) issues.push({ severity: 'minor', msg: `${total - withLazy}/${total} 张图未 lazy load — 首屏外的图阻塞主线程` });
  if (total > 0 && withAltNonEmpty / total < 0.7) issues.push({ severity: 'major', msg: `${total - withAltNonEmpty}/${total} 张图缺 alt 文字 — 影响 SEO + 可访问性 + AI 抓取` });
  if (total > 5 && withDimensions / total < 0.5) issues.push({ severity: 'minor', msg: `${total - withDimensions}/${total} 张图无显式 width/height — 加重 CLS 布局抖动` });

  return {
    ok: true,
    total_images: total,
    picture_elements: pictures.length,
    optimized_count: optimizedCount,
    optimized_pct: optimizedPct,
    formats,
    has_srcset_pct: pct(withSrcset),
    lazy_load_pct: pct(withLazy),
    alt_present_pct: pct(withAlt),
    alt_nonempty_pct: pct(withAltNonEmpty),
    dimensions_pct: pct(withDimensions),
    verdict,
    sample_unoptimized: unoptimizedSamples,
    issues,
  };
}
