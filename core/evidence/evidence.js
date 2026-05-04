import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

export const SOURCE_TYPES = [
  'google_places',
  'official_site',
  'pdf',
  'image_ocr',
  'firecrawl',
  'manual',
  'generated',
];

export const DEFAULT_MERGE_PRIORITY = [
  'official_site',
  'pdf',
  'google_places',
  'firecrawl',
  'image_ocr',
  'manual',
  'generated',
];

export const MERGE_RULES = {
  'contact.phone': ['google_places', 'official_site', 'manual', 'firecrawl', 'image_ocr', 'generated'],
  'contact.address': ['google_places', 'official_site', 'manual', 'firecrawl', 'image_ocr', 'generated'],
  'brand.logo': ['official_site', 'firecrawl', 'manual', 'google_places', 'generated'],
  'brand.colors': ['official_site', 'firecrawl', 'manual', 'generated'],
  'menu.source': ['official_site', 'pdf', 'firecrawl', 'image_ocr', 'manual', 'generated'],
  'menu.sections': ['official_site', 'pdf', 'firecrawl', 'image_ocr', 'manual', 'generated'],
};

export function defaultEvidencePath(clientSlug) {
  return path.join(repoRoot, 'clients', clientSlug, 'evidence', 'evidence.json');
}

export function createEvidencePack({ clientSlug, niche, businessName }) {
  return {
    schemaVersion: 1,
    clientSlug,
    niche,
    businessName: businessName || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [],
    resolved: {},
  };
}

export function createEvidenceItem(input) {
  const item = {
    key: input.key,
    value: input.value,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl || null,
    confidence: Number(input.confidence ?? 0.5),
    scrapedAt: input.scrapedAt || new Date().toISOString(),
    extractor: input.extractor || 'manual',
    metadata: input.metadata || {},
  };
  validateEvidenceItem(item);
  return item;
}

export function validateEvidenceItem(item) {
  const errors = [];
  if (!item.key || typeof item.key !== 'string') errors.push('key is required');
  if (item.value === undefined || item.value === null || item.value === '') errors.push('value is required');
  if (!SOURCE_TYPES.includes(item.sourceType)) {
    errors.push(`sourceType must be one of: ${SOURCE_TYPES.join(', ')}`);
  }
  if (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) {
    errors.push('confidence must be a number from 0 to 1');
  }
  if (!item.scrapedAt || Number.isNaN(Date.parse(item.scrapedAt))) {
    errors.push('scrapedAt must be an ISO date string');
  }
  if (!item.extractor) errors.push('extractor is required');
  if (item.sourceType === 'generated' && item.confidence > 0.6) {
    errors.push('generated evidence confidence must be <= 0.6');
  }
  if (errors.length) throw new Error(`Invalid evidence item "${item.key || 'unknown'}": ${errors.join('; ')}`);
}

export function addEvidenceItem(pack, input) {
  const item = createEvidenceItem(input);
  pack.items.push(item);
  pack.updatedAt = new Date().toISOString();
  pack.resolved = resolveEvidence(pack.items);
  return item;
}

export function resolveEvidence(items) {
  const grouped = new Map();
  for (const item of items) {
    validateEvidenceItem(item);
    if (!grouped.has(item.key)) grouped.set(item.key, []);
    grouped.get(item.key).push(item);
  }

  const resolved = {};
  for (const [key, candidates] of grouped.entries()) {
    const winner = chooseBestEvidence(key, candidates);
    setPath(resolved, key, {
      value: winner.value,
      sourceType: winner.sourceType,
      sourceUrl: winner.sourceUrl,
      confidence: winner.confidence,
      scrapedAt: winner.scrapedAt,
      extractor: winner.extractor,
    });
  }
  return resolved;
}

export function chooseBestEvidence(key, candidates) {
  const priority = MERGE_RULES[key] || DEFAULT_MERGE_PRIORITY;
  return [...candidates].sort((a, b) => {
    const priorityDelta = priorityScore(priority, b.sourceType) - priorityScore(priority, a.sourceType);
    if (priorityDelta !== 0) return priorityDelta;
    const confidenceDelta = b.confidence - a.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;
    return Date.parse(b.scrapedAt) - Date.parse(a.scrapedAt);
  })[0];
}

export function validateEvidencePack(pack, options = {}) {
  const errors = [];
  const warnings = [];

  if (!pack || typeof pack !== 'object') errors.push('pack must be an object');
  if (!pack.clientSlug) errors.push('clientSlug is required');
  if (!pack.niche) errors.push('niche is required');
  if (!Array.isArray(pack.items)) errors.push('items must be an array');
  if (errors.length) return { ok: false, errors, warnings };

  for (const [index, item] of pack.items.entries()) {
    try {
      validateEvidenceItem(item);
    } catch (error) {
      errors.push(`items[${index}]: ${error.message}`);
    }
  }

  const resolved = resolveEvidence(pack.items);
  const niche = options.niche || pack.niche;
  if (niche === 'restaurant') {
    validateRestaurantEvidence(resolved, pack.items, errors, warnings);
  }

  for (const item of pack.items) {
    if (item.confidence < 0.5) warnings.push(`${item.key} has low confidence (${item.confidence})`);
    if (item.sourceType === 'generated') warnings.push(`${item.key} is generated and must not be presented as scraped fact`);
  }

  return { ok: errors.length === 0, errors, warnings, resolved };
}

export function loadEvidencePack(evidencePath) {
  return JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
}

export function saveEvidencePack(pack, evidencePath = defaultEvidencePath(pack.clientSlug)) {
  const nextPack = {
    ...pack,
    updatedAt: new Date().toISOString(),
    resolved: resolveEvidence(pack.items || []),
  };
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(nextPack, null, 2)}\n`);
  return nextPack;
}

export function evidenceItemsFromLead(lead, { clientSlug, niche }) {
  const extractor = 'legacy_google_places_lead';
  const scrapedAt = lead.scraped_at || new Date().toISOString();
  const items = [];
  const add = (key, value, confidence = 0.9, metadata = {}) => {
    if (value === undefined || value === null || value === '') return;
    items.push(createEvidenceItem({
      key,
      value,
      sourceType: 'google_places',
      confidence,
      scrapedAt,
      extractor,
      metadata,
    }));
  };

  add('identity.name', lead.name, 0.95);
  add('contact.address', lead.address, 0.95);
  add('contact.phone', lead.phone, 0.9);
  add('contact.website', lead.website, 0.8);
  add('reviews.rating', lead.rating, 0.9);
  add('reviews.count', lead.review_count, 0.9);
  add('hours.weekdayText', lead.hours, 0.85);
  add('google.placeId', lead.place_id, 0.95);
  add('google.photoReference', lead.photo_reference, 0.75);
  add('business.types', lead.types, 0.8);
  add('business.niche', niche || lead.niche, 0.8);
  add('business.city', lead.city, 0.8);

  if (lead.phone) add('cta.call', normalizeTel(lead.phone), 0.9);
  if (lead.address) add('cta.map', googleMapsSearchUrl(lead.address), 0.9);

  return {
    schemaVersion: 1,
    clientSlug,
    niche: niche || lead.niche || 'restaurant',
    businessName: lead.name || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
    resolved: resolveEvidence(items),
  };
}

function validateRestaurantEvidence(resolved, items, errors, warnings) {
  requireResolved(resolved, 'contact.address', 'Restaurant address is required', errors);
  requireResolved(resolved, 'contact.phone', 'Restaurant phone is required', errors);

  const hasCall = Boolean(getPath(resolved, 'cta.call.value'));
  const hasReserve = Boolean(getPath(resolved, 'cta.reserve.value'));
  const hasMap = Boolean(getPath(resolved, 'cta.map.value'));
  if (!hasCall && !hasReserve && !hasMap) {
    errors.push('At least one CTA is required: cta.call, cta.reserve, or cta.map');
  }
  if (hasCall && !String(getPath(resolved, 'cta.call.value')).startsWith('tel:')) {
    errors.push('cta.call must use a tel: URL');
  }
  if (hasMap && !String(getPath(resolved, 'cta.map.value')).includes('google.com/maps')) {
    errors.push('cta.map must be a Google Maps URL');
  }

  const menuSource = getPath(resolved, 'menu.source.value');
  const menuSections = getPath(resolved, 'menu.sections.value');
  if (!menuSource && !menuSections) {
    errors.push('Restaurant menu source is required before rendering a menu page');
  }
  if (Array.isArray(menuSections)) {
    for (const [sectionIndex, section] of menuSections.entries()) {
      for (const [itemIndex, item] of (section.items || []).entries()) {
        if (!item.sourceKey && !item.sourceUrl) {
          errors.push(`menu.sections[${sectionIndex}].items[${itemIndex}] needs sourceKey or sourceUrl`);
        }
      }
    }
  }

  const generatedMenu = items.find((item) => item.key.startsWith('menu.') && item.sourceType === 'generated');
  if (generatedMenu) {
    warnings.push('Generated menu evidence exists; renderer must label or omit generated menu claims');
  }
}

function requireResolved(resolved, key, message, errors) {
  if (!getPath(resolved, `${key}.value`)) errors.push(message);
}

function priorityScore(priority, sourceType) {
  const index = priority.indexOf(sourceType);
  return index === -1 ? -1 : priority.length - index;
}

function setPath(target, key, value) {
  const parts = key.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    cursor[part] ||= {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function getPath(target, key) {
  return key.split('.').reduce((cursor, part) => cursor?.[part], target);
}

function normalizeTel(phone) {
  return `tel:${String(phone).replace(/[^+\d]/g, '')}`;
}

function googleMapsSearchUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
