/**
 * V3 cycle-26 P8 · Build-assets extractor.
 *
 * Per Matthew: "准备做网站的时候 · 把 scrape 的内容/logo/素材都放到一个 folder
 * 为后续网站做准备".
 *
 * Input: entity + Stage 6 multi-page-crawl/crawl-result.json
 * Output: clients/<slug>/v2/build-assets/
 *
 *   build-assets/
 *   ├── logo/                · candidate logo URL (manifest.logo_url · we don't fetch · let builder pick)
 *   ├── content/<slug>.md    · cleaned text per page (raw HTML → readable markdown)
 *   ├── brand-colors.json    · color palette { primary, accent, neutral } (heuristic)
 *   ├── voice-samples.md     · sample sentences from page text (for LLM voice mimicry)
 *   └── manifest.json        · summary: pages_processed · images_found · image_urls[] · logo_url
 *
 * Pure JS · no external deps. Heuristic logo detection from HTML class patterns:
 *   wp-custom-logo · site-logo · logo-img · brand-logo
 *
 * Color extraction: scan inline style/CSS for hex/rgb · pick most-common as primary.
 */
import fs from 'node:fs';
import path from 'node:path';

// ─── HTML cleaning · strip tags · normalize whitespace ────────────────────
function htmlToReadable(html, baseUrl) {
  if (!html) return '';
  // Drop script/style content entirely
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  // Drop HTML comments
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // Convert <br> / <p> / <h*> to newlines
  s = s.replace(/<\s*br\s*\/?>/gi, '\n');
  s = s.replace(/<\s*\/?(p|h[1-6]|div|li|section|article|header|footer|nav)\s*[^>]*>/gi, '\n');
  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, ' ');
  // HTML entities
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
  // Collapse whitespace
  s = s.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// ─── Image URL extraction (absolute · prefer non-data URIs) ──────────────
function extractImageUrls(html, baseUrl) {
  if (!html) return [];
  const urls = new Set();
  // <img src="..." />
  for (const m of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    urls.add(m[1]);
  }
  // CSS background-image:url("...")
  for (const m of html.matchAll(/background-image\s*:\s*url\(["']?([^"')\s]+)["']?\)/gi)) {
    urls.add(m[1]);
  }
  // Filter to absolute http(s) URLs · resolve relative if base provided
  const result = [];
  for (const u of urls) {
    if (u.startsWith('data:')) continue;
    if (/^https?:\/\//i.test(u)) {
      result.push(u);
    } else if (baseUrl) {
      try { result.push(new URL(u, baseUrl).href); } catch { /* skip malformed */ }
    }
  }
  return result;
}

// ─── Logo candidate (heuristic · scan class/id patterns) ─────────────────
function findLogoCandidate(html, imageUrls) {
  if (!html) return null;
  // Look for img tags within logo-class containers
  const logoMatch = html.match(/class\s*=\s*["'][^"']*(?:wp-custom-logo|site-logo|logo-img|brand-logo|theme-site-logo|elementor-widget-theme-site-logo|navbar-brand)[^"']*["'][\s\S]{0,800}?<img\s[^>]*src\s*=\s*["']([^"']+)["']/i);
  if (logoMatch && logoMatch[1] && !logoMatch[1].startsWith('data:')) {
    return logoMatch[1].startsWith('http') ? logoMatch[1] : null;
  }
  // Fallback: first image with "logo" in URL
  for (const u of imageUrls) {
    if (/logo/i.test(u)) return u;
  }
  return null;
}

// ─── Color extraction (top hex/rgb values from inline CSS) ──────────────
function extractColors(html) {
  if (!html) return {};
  const colorCounts = new Map();
  // Hex 3-or-6 digit
  for (const m of html.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    const c = '#' + m[1].toLowerCase();
    colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
  }
  // rgb()
  for (const m of html.matchAll(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) {
    const c = `#${Number(m[1]).toString(16).padStart(2, '0')}${Number(m[2]).toString(16).padStart(2, '0')}${Number(m[3]).toString(16).padStart(2, '0')}`;
    colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
  }
  // Drop near-grayscale (common chrome / borders)
  function isNonNeutral(hex) {
    if (hex.length !== 7) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return (max - min) > 30 && max > 40 && max < 240;
  }
  const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const palette = sorted.filter(([c]) => isNonNeutral(c)).slice(0, 3).map(([c, n]) => ({ color: c, count: n }));
  return {
    primary: palette[0]?.color || null,
    accent: palette[1]?.color || null,
    neutral: palette[2]?.color || null,
    palette,
    extracted_count: colorCounts.size,
  };
}

// ─── Voice samples (curate 1-2 sentences per page · short + impactful) ──
function buildVoiceSamples(pages) {
  const samples = [];
  for (const p of pages) {
    const text = htmlToReadable(p.rawHtml || '', p.url);
    if (!text) continue;
    // Pick first 2 sentences > 30 chars + < 200 chars
    const sentences = text.split(/(?<=[\.\!\?。！？])\s+/).filter(
      (s) => s.length > 30 && s.length < 200 && /[a-zA-Z一-龥]/.test(s),
    );
    for (const s of sentences.slice(0, 2)) {
      samples.push(`- (from ${p.url}) "${s.trim()}"`);
    }
    if (samples.length >= 10) break;
  }
  return samples;
}

function slugFromUrl(u) {
  try {
    const p = new URL(u).pathname.replace(/\/$/, '') || 'index';
    return p.replace(/^\//, '').replace(/[^a-z0-9-_]/gi, '-').toLowerCase() || 'index';
  } catch { return 'page'; }
}

/**
 * Main extractor.
 * @param {{entityKey: string, slug: string, clientV2Dir: string, crawlResult: object}} ctx
 * @returns {Promise<{ok: boolean, manifest: object, outputDir: string}>}
 */
export async function extractBuildAssets({ entityKey, slug, clientV2Dir, crawlResult } = {}) {
  if (!crawlResult?.pages?.length) {
    return { ok: false, reason: 'no_crawl_pages' };
  }

  const outputDir = path.join(clientV2Dir, 'build-assets');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'content'), { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'logo'), { recursive: true });

  const allImageUrls = new Set();
  let logoCandidate = null;
  const colorAccum = new Map();

  for (const page of crawlResult.pages) {
    // Content per page
    const pageSlug = slugFromUrl(page.finalUrl || page.url);
    const md = [`# ${page.title || page.url}`, '', `> source: ${page.url}`, '', htmlToReadable(page.rawHtml || '', page.url)].join('\n');
    fs.writeFileSync(path.join(outputDir, 'content', `${pageSlug}.md`), md);

    // Image URLs
    const imgs = extractImageUrls(page.rawHtml || '', page.url);
    for (const u of imgs) allImageUrls.add(u);

    // Logo
    if (!logoCandidate) {
      const cand = findLogoCandidate(page.rawHtml || '', imgs);
      if (cand) logoCandidate = cand;
    }

    // Colors aggregated
    const c = extractColors(page.rawHtml || '');
    for (const item of c.palette || []) {
      colorAccum.set(item.color, (colorAccum.get(item.color) || 0) + item.count);
    }
  }

  // Color palette (aggregated across all pages)
  const sortedColors = [...colorAccum.entries()].sort((a, b) => b[1] - a[1]);
  const brandColors = {
    primary: sortedColors[0]?.[0] || null,
    accent: sortedColors[1]?.[0] || null,
    neutral: sortedColors[2]?.[0] || null,
    palette: sortedColors.slice(0, 6).map(([color, count]) => ({ color, count })),
    note: sortedColors.length === 0 ? 'no non-neutral colors detected · check raw HTML' : null,
  };
  fs.writeFileSync(path.join(outputDir, 'brand-colors.json'), JSON.stringify(brandColors, null, 2));

  // Voice samples
  const samples = buildVoiceSamples(crawlResult.pages);
  const voiceMd = `# Voice samples · ${entityKey}\n\nCurated phrasing samples for LLM voice mimicry during redesign.\n\n${samples.join('\n')}\n`;
  fs.writeFileSync(path.join(outputDir, 'voice-samples.md'), voiceMd);

  // Logo manifest (don't download · let builder decide)
  if (logoCandidate) {
    fs.writeFileSync(path.join(outputDir, 'logo', 'README.md'),
      `# Logo candidate\n\nDetected logo URL: ${logoCandidate}\n\nDownload manually or via builder integration.\n`);
  }

  // Final manifest
  const manifest = {
    entityKey,
    slug,
    pages_processed: crawlResult.pages.length,
    images_found: allImageUrls.size,
    image_urls: [...allImageUrls].slice(0, 50), // cap noise
    logo_url: logoCandidate || null,
    logo_candidate: logoCandidate || null,
    colors: brandColors,
    voice_sample_count: samples.length,
    base_url: crawlResult.base_url || null,
    generated_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return { ok: true, manifest, outputDir };
}
