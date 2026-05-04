import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  addEvidenceItem,
  createEvidencePack,
  defaultEvidencePath,
  loadEvidencePack,
  saveEvidencePack,
} from '../evidence/evidence.js';

const SECTION_HINTS = [
  'breakfast',
  'snack',
  'snacks',
  'lunch',
  'dinner',
  'entree',
  'entrees',
  'starter',
  'starters',
  'main',
  'mains',
  'dessert',
  'desserts',
  'drink',
  'drinks',
  'wine',
  'cocktail',
  'cocktails',
  'beer',
  'banquet',
  'banquets',
  'set menu',
  'special',
  'specials',
  'oyster',
  'oysters',
  'raw',
  'salata',
  'salad',
  'salads',
  'side',
  'sides',
  'mezze',
  'seafood',
  'land',
  'sweets',
  'sweet',
];

export function parseMenuText(text, { sourceUrl = '', sourceKey = 'menu.sections' } = {}) {
  const lines = normalizeText(text);
  const sections = [];
  let current = createSection('Menu');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isNavigationNoise(line)) continue;

    if (isLikelySectionHeading(line)) {
      if (current.items.length) sections.push(current);
      current = createSection(cleanHeading(line));
      continue;
    }

    const stackedItem = parseStackedPriceItem(lines, i, { sourceUrl, sourceKey });
    if (stackedItem) {
      current.items.push(stackedItem.item);
      i = stackedItem.nextIndex;
      continue;
    }

    const item = parseMenuItemLine(line, { sourceUrl, sourceKey });
    if (item) current.items.push(item);
  }

  if (current.items.length) sections.push(current);
  return mergeSmallSections(sections);
}

export function parseMenuItemLine(line, { sourceUrl = '', sourceKey = 'menu.sections' } = {}) {
  const normalized = line
    .replace(/\s{2,}/g, ' ')
    .replace(/[|]+/g, ' ')
    .trim();
  if (!normalized || normalized.length < 4) return null;
  if (/^(menu|food|drinks?|wine|price|item)$/i.test(normalized)) return null;

  const priceMatch = normalized.match(priceAtEndRegex());
  if (!priceMatch) return null;

  const price = priceMatch[0].trim();
  if (Number(normalizePrice(price)) <= 0) return null;
  const beforePrice = normalized.slice(0, normalized.length - price.length).replace(/[-.*\s]+$/g, '').trim();
  if (!beforePrice || beforePrice.length < 3) return null;
  if (beforePrice.length > 90) return null;
  if (/^\d/.test(beforePrice)) return null;
  if (/^(ph\.?|phone|tel\.?)\b/i.test(beforePrice)) return null;
  if (/\b[a-z]{2,}\s+q\s*\d+$/i.test(beforePrice)) return null;

  const { name, description } = splitNameDescription(beforePrice);
  return {
    name,
    description,
    price,
    sourceUrl,
    sourceKey,
  };
}

export function writeMenuEvidenceFromText(text, {
  clientSlug,
  niche = 'restaurant',
  businessName,
  sourceUrl,
  sourceType = 'official_site',
  outputPath,
  confidence = 0.78,
} = {}) {
  if (!clientSlug) throw new Error('clientSlug is required to write menu evidence');
  const evidencePath = outputPath || defaultEvidencePath(clientSlug);
  const pack = fs.existsSync(evidencePath)
    ? loadEvidencePack(evidencePath)
    : createEvidencePack({ clientSlug, niche, businessName });
  const sections = parseMenuText(text, { sourceUrl });

  if (!sections.length) {
    throw new Error('No menu items with prices were detected');
  }

  addEvidenceItem(pack, {
    key: 'menu.source',
    value: sourceUrl || evidencePath,
    sourceType,
    sourceUrl,
    confidence,
    extractor: 'menu_text_parser',
  });
  addEvidenceItem(pack, {
    key: 'menu.sections',
    value: sections,
    sourceType,
    sourceUrl,
    confidence,
    extractor: 'menu_text_parser',
  });
  return saveEvidencePack(pack, evidencePath);
}

export function readMenuTextFromFile(inputPath, { format } = {}) {
  const detected = format || path.extname(inputPath).slice(1).toLowerCase();
  if (detected === 'pdf') return readPdfText(inputPath);
  return fs.readFileSync(inputPath, 'utf8');
}

function readPdfText(inputPath) {
  const pdftotext = findBinary('pdftotext');
  if (!pdftotext) {
    throw new Error('PDF parsing requires pdftotext. Install poppler or pass an already extracted .txt/.md menu file.');
  }
  return execFileSync(pdftotext, ['-layout', inputPath, '-'], { encoding: 'utf8' });
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[#*_`]/g, '').trim())
    .filter(Boolean);
}

function parseStackedPriceItem(lines, index, { sourceUrl = '', sourceKey = 'menu.sections' } = {}) {
  const price = parsePriceOnly(lines[index]);
  if (!price) return null;
  if (previousMeaningfulLine(lines, index) === '/') return null;

  const nameIndex = findNextMeaningfulLine(lines, index + 1);
  if (nameIndex < 0) return null;
  if (/^\s*[-*]\s+/.test(String(lines[nameIndex] || ''))) return null;
  const name = cleanMenuText(lines[nameIndex]);
  if (!isLikelyItemName(name)) return null;
  if (isLikelySectionHeading(name)) return null;

  const descriptionIndex = findNextMeaningfulLine(lines, nameIndex + 1);
  let description = '';
  let nextIndex = nameIndex;
  if (descriptionIndex >= 0) {
    const maybeDescription = cleanMenuText(lines[descriptionIndex]);
    const repeatedPrice = parsePriceOnly(maybeDescription);
    const afterDescriptionIndex = findNextMeaningfulLine(lines, descriptionIndex + 1);
    const nextAfterDescriptionIsPrice = afterDescriptionIndex >= 0 && parsePriceOnly(lines[afterDescriptionIndex]);
    const looksLikeNextBareItem = isLikelyItemName(maybeDescription) && !/[,.]/.test(maybeDescription);
    if (
      !repeatedPrice
      && !isLikelySectionHeading(maybeDescription)
      && !(looksLikeNextBareItem && nextAfterDescriptionIsPrice)
    ) {
      description = maybeDescription;
      nextIndex = descriptionIndex;
    }
  }

  const duplicatePriceIndex = findNextMeaningfulLine(lines, nextIndex + 1);
  if (duplicatePriceIndex >= 0 && normalizePrice(parsePriceOnly(lines[duplicatePriceIndex])) === normalizePrice(price)) {
    nextIndex = duplicatePriceIndex;
  }

  return {
    nextIndex,
    item: {
      name,
      description,
      price,
      sourceUrl,
      sourceKey,
    },
  };
}

function parsePriceOnly(line) {
  const normalized = String(line || '').replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^A?\$?\s*(\d{1,3}(?:\.\d{1,2})?)(?:\s*(?:ea|pp|per person))?$/i);
  if (!match) return '';
  return Number(normalizePrice(normalized)) > 0 ? normalized : '';
}

function normalizePrice(price) {
  return String(price || '').replace(/[^0-9.]/g, '');
}

function findNextMeaningfulLine(lines, start) {
  for (let i = start; i < lines.length; i += 1) {
    if (!isNavigationNoise(lines[i])) return i;
  }
  return -1;
}

function previousMeaningfulLine(lines, start) {
  for (let i = start - 1; i >= 0; i -= 1) {
    if (!isNavigationNoise(lines[i])) return cleanMenuText(lines[i]);
  }
  return '';
}

function cleanMenuText(line) {
  return String(line || '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '$1')
    .replace(/^[-\s]+|[-\s]+$/g, '')
    .trim();
}

function isLikelyItemName(line) {
  const cleaned = cleanMenuText(line);
  if (cleaned.length < 3 || cleaned.length > 80) return false;
  if (parsePriceOnly(cleaned)) return false;
  if (isNavigationNoise(cleaned)) return false;
  if (/^(open menu|close menu|book now|skip to content|contact|gallery|careers|functions)$/i.test(cleaned)) return false;
  if (/^https?:\/\//i.test(cleaned)) return false;
  if (/[.!?]$/.test(cleaned)) return false;
  return /[A-Za-z]/.test(cleaned);
}

function isNavigationNoise(line) {
  const cleaned = cleanMenuText(line).toLowerCase();
  if (!cleaned) return true;
  if (/^\[\d+\]/.test(cleaned)) return true;
  if (cleaned === 'book now' || cleaned === 'open menu' || cleaned === 'close menu') return true;
  if (cleaned === 'skip to content' || cleaned === 'back' || cleaned.startsWith('folder:')) return true;
  return false;
}

function priceAtEndRegex() {
  return /(?:A?\$?\s*)?(\d{1,3}(?:\.\d{1,2})?)(?:\s*(?:ea|pp|per person))?(?:\s*(?:\/|\|)\s*(?:A?\$?\s*)?\d{1,3}(?:\.\d{1,2})?(?:\s*(?:ea|pp|per person))?)*\s*$/i;
}

function isLikelySectionHeading(line) {
  if (/^\s*[-*]\s+/.test(String(line || ''))) return false;
  const cleaned = cleanHeading(line).toLowerCase();
  if (cleaned.length > 40) return false;
  if (cleaned.includes(',') || /[.!?]$/.test(cleaned)) return false;
  if (/^\[.+\]\(.+\)$/.test(String(line || '').trim())) return false;
  if (parseMenuItemLine(line)) return false;
  return SECTION_HINTS.some((hint) => {
    if (cleaned === hint) return true;
    if (cleaned.endsWith(` ${hint}`)) return true;
    if (cleaned.startsWith(`${hint} `)) return true;
    return false;
  });
}

function cleanHeading(line) {
  return cleanMenuText(line).replace(/^[-\s]+|[-\s]+$/g, '').trim();
}

function createSection(name) {
  return { name, items: [] };
}

function splitNameDescription(text) {
  const separators = [' - ', ': '];
  for (const separator of separators) {
    if (!text.includes(separator)) continue;
    const [name, ...rest] = text.split(separator);
    if (name.trim().length >= 3 && rest.join(separator).trim().length >= 3) {
      return { name: name.trim(), description: rest.join(separator).trim() };
    }
  }
  return { name: text.trim(), description: '' };
}

function mergeSmallSections(sections) {
  if (sections.length <= 1) return sections;
  const merged = [];
  for (const section of sections) {
    if (section.items.length > 0) merged.push(section);
  }
  return merged;
}

function findBinary(name) {
  const paths = (process.env.PATH || '').split(path.delimiter);
  for (const dir of paths) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
