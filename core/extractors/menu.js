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
  'set menu',
  'special',
  'specials',
];

export function parseMenuText(text, { sourceUrl = '', sourceKey = 'menu.sections' } = {}) {
  const lines = normalizeText(text);
  const sections = [];
  let current = createSection('Menu');

  for (const line of lines) {
    if (isLikelySectionHeading(line)) {
      if (current.items.length) sections.push(current);
      current = createSection(cleanHeading(line));
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

  const priceMatch = normalized.match(/(?:A?\$?\s*)?(\d{1,3}(?:\.\d{1,2})?)(?:\s*(?:\/|\|)\s*(?:A?\$?\s*)?\d{1,3}(?:\.\d{1,2})?)*\s*$/);
  if (!priceMatch) return null;

  const price = priceMatch[0].trim();
  const beforePrice = normalized.slice(0, normalized.length - price.length).replace(/[-.*\s]+$/g, '').trim();
  if (!beforePrice || beforePrice.length < 3) return null;
  if (/^\d/.test(beforePrice)) return null;

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

function isLikelySectionHeading(line) {
  const cleaned = cleanHeading(line).toLowerCase();
  if (cleaned.length > 40) return false;
  if (parseMenuItemLine(line)) return false;
  return SECTION_HINTS.some((hint) => cleaned === hint || cleaned.includes(hint));
}

function cleanHeading(line) {
  return line.replace(/^[-\s]+|[-\s]+$/g, '').trim();
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
