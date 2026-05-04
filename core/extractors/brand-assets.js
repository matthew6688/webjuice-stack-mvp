import fs from 'fs';
import path from 'path';
import {
  addEvidenceItem,
  createEvidencePack,
  defaultEvidencePath,
  loadEvidencePack,
  saveEvidencePack,
} from '../evidence/evidence.js';

export function extractBrandAssetsFromHtml(html, { sourceUrl = '' } = {}) {
  if (!html) throw new Error('html is required');
  const baseUrl = sourceUrl || 'https://example.com/';
  const styles = extractStyleText(html);
  const images = extractImages(html, baseUrl);
  const logoCandidates = rankLogoCandidates([
    ...extractStructuredLogos(html, baseUrl),
    ...images.filter((image) => image.isLogo),
    ...extractIcons(html, baseUrl),
  ]);
  const imageCandidates = rankImageCandidates([
    ...extractMetaImages(html, baseUrl),
    ...images.filter((image) => !image.isLogo),
  ]);
  const colors = extractColors(`${html}\n${styles}`);
  const fonts = extractFonts(`${html}\n${styles}`);

  return {
    sourceUrl,
    extractedAt: new Date().toISOString(),
    logoCandidates,
    imageCandidates,
    colors,
    fonts,
  };
}

export function writeBrandEvidence(assets, {
  clientSlug,
  niche = 'restaurant',
  businessName,
  evidencePath = defaultEvidencePath(clientSlug),
} = {}) {
  if (!clientSlug) throw new Error('clientSlug is required');
  const pack = fs.existsSync(evidencePath)
    ? loadEvidencePack(evidencePath)
    : createEvidencePack({ clientSlug, niche, businessName });
  const scrapedAt = assets.extractedAt || new Date().toISOString();
  const sourceUrl = assets.sourceUrl || null;
  const extractor = 'brand_asset_extractor';
  const add = (key, value, confidence, metadata = {}) => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return;
    addEvidenceItem(pack, {
      key,
      value,
      sourceType: 'official_site',
      sourceUrl,
      confidence,
      scrapedAt,
      extractor,
      metadata,
    });
  };

  const logo = assets.logoCandidates?.[0];
  const images = (assets.imageCandidates || []).map((image) => image.url).filter(Boolean);
  add('brand.logo', logo?.url, 0.82, { candidates: assets.logoCandidates?.slice(0, 5) || [] });
  add('brand.colors', assets.colors?.slice(0, 8) || [], 0.72);
  add('brand.fonts', assets.fonts?.slice(0, 8) || [], 0.65);
  add('brand.ogImage', images[0], 0.72);
  add('gallery.images', images.slice(0, 12), 0.72, { candidates: assets.imageCandidates?.slice(0, 12) || [] });

  return saveEvidencePack(pack, evidencePath);
}

export function writeBrandAssetManifest(assets, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(assets, null, 2)}\n`);
}

export async function fetchHtml(url, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Failed to fetch brand source: HTTP ${response.status}`);
  return response.text();
}

function extractStructuredLogos(html, baseUrl) {
  const logos = [];
  for (const json of extractJsonLd(html)) {
    const logo = json?.logo || json?.publisher?.logo || json?.organization?.logo;
    const url = typeof logo === 'string' ? logo : logo?.url;
    if (url) logos.push(candidate(url, baseUrl, 'json_ld_logo', 95));
  }
  return logos;
}

function extractIcons(html, baseUrl) {
  const icons = [];
  const relRegex = /<link\b[^>]*rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/gi;
  for (const tag of html.match(relRegex) || []) {
    const href = attr(tag, 'href');
    if (href) icons.push(candidate(href, baseUrl, 'site_icon', 45));
  }
  return icons;
}

function extractMetaImages(html, baseUrl) {
  const metas = [];
  const metaRegex = /<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*>/gi;
  for (const tag of html.match(metaRegex) || []) {
    const content = attr(tag, 'content');
    if (content) metas.push(candidate(content, baseUrl, 'meta_image', 90));
  }
  return metas;
}

function extractImages(html, baseUrl) {
  const images = [];
  const imgRegex = /<img\b[^>]*>/gi;
  for (const tag of html.match(imgRegex) || []) {
    const src = attr(tag, 'src') || firstSrcsetUrl(attr(tag, 'srcset')) || attr(tag, 'data-src') || attr(tag, 'data-lazy-src');
    if (!src) continue;
    const alt = attr(tag, 'alt');
    const className = attr(tag, 'class');
    const id = attr(tag, 'id');
    const text = `${src} ${alt} ${className} ${id}`;
    const isLogo = /logo|brand|mark/i.test(text);
    const score = isLogo ? 85 : imageScore(text);
    images.push({
      ...candidate(src, baseUrl, isLogo ? 'img_logo' : 'img', score),
      alt,
      className,
      id,
      isLogo,
    });
  }
  return images;
}

function rankLogoCandidates(candidates) {
  return uniqueByUrl(candidates)
    .filter((item) => !isBadAssetUrl(item.url))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function rankImageCandidates(candidates) {
  return uniqueByUrl(candidates)
    .filter((item) => !isBadAssetUrl(item.url) && item.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}

function candidate(rawUrl, baseUrl, kind, score) {
  return { url: absolutize(rawUrl, baseUrl), kind, score };
}

function absolutize(rawUrl, baseUrl) {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

function uniqueByUrl(items) {
  const byUrl = new Map();
  for (const item of items.filter((entry) => entry?.url)) {
    const existing = byUrl.get(item.url);
    if (!existing || item.score > existing.score) byUrl.set(item.url, item);
  }
  return [...byUrl.values()];
}

function isBadAssetUrl(url) {
  return !url || /^data:/i.test(url) || /\.(svg)(?:\?|$)/i.test(url) || /tracking|pixel|spacer|blank/i.test(url);
}

function imageScore(text) {
  let score = 40;
  if (/hero|food|dish|menu|venue|restaurant|gallery|interior/i.test(text)) score += 25;
  if (/instagram|facebook|tripadvisor|avatar|icon|sprite/i.test(text)) score -= 25;
  return score;
}

function extractColors(text) {
  const colors = [];
  const hexRegex = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi;
  for (const match of text.match(hexRegex) || []) colors.push(normalizeHex(match));
  const rgbRegex = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)/gi;
  let rgb;
  while ((rgb = rgbRegex.exec(text))) colors.push(rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3])));
  return uniqueColors(colors).filter(isUsefulColor).slice(0, 12);
}

function extractFonts(text) {
  const fonts = [];
  const familyRegex = /font-family\s*:\s*([^;}]+)/gi;
  let match;
  while ((match = familyRegex.exec(text))) {
    fonts.push(...match[1].split(',').map(cleanFont).filter(Boolean));
  }
  const googleFontRegex = /[?&]family=([^"'&]+)/gi;
  while ((match = googleFontRegex.exec(text))) fonts.push(decodeURIComponent(match[1]).split(':')[0].replace(/\+/g, ' '));
  return [...new Set(fonts)].filter((font) => !/^(serif|sans-serif|monospace|inherit|system-ui)$/i.test(font)).slice(0, 12);
}

function extractStyleText(html) {
  const styles = [];
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleRegex.exec(html))) styles.push(match[1]);
  return styles.join('\n');
}

function extractJsonLd(html) {
  const blocks = [];
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      blocks.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      // Ignore malformed third-party JSON-LD.
    }
  }
  return blocks;
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'));
  return match?.[1] || '';
}

function firstSrcsetUrl(srcset = '') {
  return srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
}

function normalizeHex(value) {
  const hex = value.toLowerCase();
  if (hex.length === 4) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  return hex;
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((part) => Math.max(0, Math.min(255, part)).toString(16).padStart(2, '0')).join('')}`;
}

function uniqueColors(colors) {
  return [...new Set(colors)];
}

function isUsefulColor(color) {
  return !['#ffffff', '#000000', '#fff', '#000', '#eeeeee', '#f5f5f5'].includes(color);
}

function cleanFont(font) {
  return font.trim().replace(/^['"]|['"]$/g, '').replace(/\\+/g, ' ');
}
