import fs from 'fs';
import path from 'path';
import {
  loadEvidencePack,
  resolveEvidence,
  validateEvidencePack,
} from '../../core/evidence/evidence.js';
import {
  RESTAURANT_FALLBACK_LEVELS,
  RESTAURANT_REQUIRED_KEYS,
  createEmptyRestaurantContent,
} from './schema.js';

export function buildRestaurantContentFromEvidence(pack, { sourceEvidencePath } = {}) {
  const evidenceResult = validateEvidencePack(pack, { niche: 'restaurant' });
  const resolved = evidenceResult.resolved || resolveEvidence(pack.items || []);
  const content = createEmptyRestaurantContent({
    clientSlug: pack.clientSlug,
    sourceEvidencePath: sourceEvidencePath || null,
  });

  const name = valueOf(resolved, 'identity.name') || pack.businessName || '';
  const types = valueOf(resolved, 'business.types') || [];
  const cuisine = inferCuisine(types, valueOf(resolved, 'business.niche'));
  const menuSections = normalizeMenuSections(valueOf(resolved, 'menu.sections'), valueOf(resolved, 'menu.source'));
  const menuSourceUrl = valueOf(resolved, 'menu.source') || firstValue(resolved, 'links.menuCandidates') || '';
  const reserveUrl = valueOf(resolved, 'cta.reserve') || firstValue(resolved, 'links.reservationCandidates') || '';
  const mapUrl = valueOf(resolved, 'cta.map') || googleMapsSearchUrl(valueOf(resolved, 'contact.address'));
  const phone = valueOf(resolved, 'contact.phone') || valueOf(resolved, 'contact.phoneFromWebsite') || '';

  content.fallbackLevel = inferFallbackLevel(resolved, menuSections);
  content.hero = {
    name,
    cuisine,
    rating: valueOf(resolved, 'reviews.rating') ?? null,
    reviewCount: valueOf(resolved, 'reviews.count') || 0,
    tagline: buildTagline(cuisine, valueOf(resolved, 'business.city')),
  };
  content.contact = {
    phone,
    email: valueOf(resolved, 'contact.email') || '',
    address: valueOf(resolved, 'contact.address') || '',
    website: valueOf(resolved, 'contact.website') || valueOf(resolved, 'website.homepage') || '',
    googleMapsUrl: mapUrl,
  };
  content.cta = {
    callUrl: valueOf(resolved, 'cta.call') || normalizeTel(phone),
    mapUrl,
    reserveUrl,
  };
  content.booking = reserveUrl ? {
    provider: inferBookingProvider(reserveUrl),
    url: reserveUrl,
  } : null;
  content.menu = {
    sourceUrl: menuSourceUrl,
    sections: menuSections,
    sourceChain: evidenceChain(pack.items || [], ['menu.source', 'menu.sections', 'links.menuCandidates']),
  };
  content.gallery = buildGallery(resolved);
  content.brand = {
    logo: valueOf(resolved, 'brand.logo') || '',
    colors: valueOf(resolved, 'brand.colors') || [],
    fonts: valueOf(resolved, 'brand.fonts') || [],
    ogImage: valueOf(resolved, 'brand.ogImage') || '',
  };
  content.evidenceSummary = summarizeEvidence(pack.items || []);

  const contentResult = validateRestaurantContent(content);
  return {
    content,
    evidenceValidation: evidenceResult,
    contentValidation: contentResult,
  };
}

export function buildRestaurantContentFile({ evidencePath, outputPath }) {
  const pack = loadEvidencePack(evidencePath);
  const result = buildRestaurantContentFromEvidence(pack, { sourceEvidencePath: evidencePath });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result.content, null, 2)}\n`);
  return result;
}

export function validateRestaurantContent(content) {
  const errors = [];
  const warnings = [];

  for (const key of RESTAURANT_REQUIRED_KEYS) {
    const value = getPath(content, key);
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) {
      errors.push(`${key} is required`);
    }
  }

  if (content.cta?.callUrl && !content.cta.callUrl.startsWith('tel:')) {
    errors.push('cta.callUrl must use a tel: URL');
  }
  if (content.cta?.mapUrl && !content.cta.mapUrl.includes('google.com/maps')) {
    errors.push('cta.mapUrl must be a Google Maps URL');
  }
  if (content.booking && !content.booking.url) {
    errors.push('booking.url is required when booking is present');
  }

  for (const [sectionIndex, section] of (content.menu?.sections || []).entries()) {
    if (!section.name) errors.push(`menu.sections[${sectionIndex}].name is required`);
    if (!Array.isArray(section.items) || !section.items.length) {
      errors.push(`menu.sections[${sectionIndex}].items must not be empty`);
      continue;
    }
    for (const [itemIndex, item] of section.items.entries()) {
      if (!item.name) errors.push(`menu.sections[${sectionIndex}].items[${itemIndex}].name is required`);
      if (!item.sourceUrl && !item.sourceKey) {
        errors.push(`menu.sections[${sectionIndex}].items[${itemIndex}] needs sourceUrl or sourceKey`);
      }
      if (item.generated === true) {
        warnings.push(`menu.sections[${sectionIndex}].items[${itemIndex}] is generated`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function inferFallbackLevel(resolved, menuSections = []) {
  const menuSourceMeta = metaOf(resolved, 'menu.source');
  const menuSectionsMeta = metaOf(resolved, 'menu.sections');
  const menuSourceType = menuSectionsMeta?.sourceType || menuSourceMeta?.sourceType;
  const hasOfficialMenu = menuSourceType === 'official_site' && menuSections.length > 0;
  const hasPdfMenu = menuSourceType === 'pdf' && menuSections.length > 0;
  const hasCandidates = Boolean(firstValue(resolved, 'links.menuCandidates') || valueOf(resolved, 'google.photoReference'));
  if (hasOfficialMenu) return RESTAURANT_FALLBACK_LEVELS.A;
  if (hasPdfMenu) return RESTAURANT_FALLBACK_LEVELS.B;
  if (hasCandidates) return RESTAURANT_FALLBACK_LEVELS.C;
  return RESTAURANT_FALLBACK_LEVELS.D;
}

function normalizeMenuSections(sections, sourceUrl) {
  if (!Array.isArray(sections)) return [];
  return sections.map((section) => ({
    name: section.name || 'Menu',
    description: section.description || '',
    items: (section.items || []).map((item) => ({
      name: item.name || '',
      description: item.description || '',
      price: item.price || '',
      sourceUrl: item.sourceUrl || sourceUrl || '',
      sourceKey: item.sourceKey || '',
      generated: item.generated === true,
    })),
  }));
}

function buildGallery(resolved) {
  const gallery = [];
  const ogImage = valueOf(resolved, 'brand.ogImage');
  const photoReference = valueOf(resolved, 'google.photoReference');
  const galleryImages = valueOf(resolved, 'gallery.images') || [];
  if (ogImage) gallery.push({ type: 'image', url: ogImage, source: 'official_site' });
  for (const image of galleryImages) {
    gallery.push({ type: 'image', url: image, source: 'legacy_restaurant_data' });
  }
  if (photoReference) gallery.push({ type: 'google_photo_reference', reference: photoReference, source: 'google_places' });
  return gallery;
}

function summarizeEvidence(items) {
  return items.map((item) => ({
    key: item.key,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl || '',
    confidence: item.confidence,
    extractor: item.extractor,
  }));
}

function evidenceChain(items, keys) {
  return items
    .filter((item) => keys.includes(item.key))
    .map((item) => ({
      key: item.key,
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl || '',
      confidence: item.confidence,
      extractor: item.extractor,
    }));
}

function inferCuisine(types = [], niche = '') {
  const readable = [...types, niche]
    .filter(Boolean)
    .map((type) => String(type).replace(/_/g, ' '))
    .filter((type) => !['point of interest', 'establishment', 'food'].includes(type));
  return readable[0] || 'restaurant';
}

function inferBookingProvider(url) {
  const host = safeHost(url);
  if (host.includes('opentable')) return 'OpenTable';
  if (host.includes('resy')) return 'Resy';
  if (host.includes('tock')) return 'Tock';
  if (host.includes('sevenrooms')) return 'SevenRooms';
  if (host.includes('nowbookit')) return 'NowBookIt';
  return host || 'official';
}

function buildTagline(cuisine, city) {
  return [titleCase(cuisine), city].filter(Boolean).join(' in ');
}

function titleCase(value) {
  return String(value || '').replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeTel(phone) {
  return phone ? `tel:${String(phone).replace(/[^+\d]/g, '')}` : '';
}

function googleMapsSearchUrl(address) {
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
}

function firstValue(target, key) {
  const value = valueOf(target, key);
  return Array.isArray(value) ? value[0] : value;
}

function valueOf(target, key) {
  return getPath(target, `${key}.value`);
}

function metaOf(target, key) {
  return getPath(target, key);
}

function getPath(target, key) {
  return key.split('.').reduce((cursor, part) => cursor?.[part], target);
}

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
