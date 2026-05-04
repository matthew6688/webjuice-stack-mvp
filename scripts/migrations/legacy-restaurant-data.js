#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  createEvidencePack,
  addEvidenceItem,
  saveEvidencePack,
} from '../../core/evidence/evidence.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

const args = parseArgs();

if (!args.repoDir && !args.all) {
  console.error('Usage: node scripts/migrations/legacy-restaurant-data.js --repo-dir /path/client-repo [--client slug] [--output evidence.json]');
  console.error('   or: node scripts/migrations/legacy-restaurant-data.js --all /tmp/repos --out-root clients');
  process.exit(1);
}

if (args.all) {
  const root = args.all === true ? '/tmp/profitslocal-repos' : args.all;
  const outRoot = args['out-root'] || args.outRoot || 'clients';
  const repoDirs = fs.readdirSync(root)
    .map((name) => path.join(root, name))
    .filter((dir) => fs.existsSync(path.join(dir, 'src/data/restaurant.ts')));
  for (const repoDir of repoDirs) {
    const clientSlug = path.basename(repoDir);
    const outputPath = path.join(outRoot, clientSlug, 'evidence', 'evidence.json');
    const pack = migrateRepo({ repoDir, clientSlug, outputPath });
    console.log(`${clientSlug}: ${pack.items.length} evidence items -> ${outputPath}`);
  }
} else {
  const repoDir = args.repoDir;
  const clientSlug = args.client || path.basename(repoDir);
  const outputPath = args.output || path.join('clients', clientSlug, 'evidence', 'evidence.json');
  const pack = migrateRepo({ repoDir, clientSlug, outputPath });
  console.log(`${clientSlug}: ${pack.items.length} evidence items -> ${outputPath}`);
}

function migrateRepo({ repoDir, clientSlug, outputPath }) {
  const data = readRestaurantData(path.join(repoDir, 'src/data/restaurant.ts'));
  const pack = createEvidencePack({
    clientSlug,
    niche: 'restaurant',
    businessName: data.name,
  });
  const scrapedAt = new Date().toISOString();
  const sourceUrl = data.website || data.menuSourceUrl || '';
  const add = (key, value, sourceType = 'manual', confidence = 0.85, metadata = {}) => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return;
    addEvidenceItem(pack, {
      key,
      value,
      sourceType,
      sourceUrl,
      confidence,
      scrapedAt,
      extractor: 'legacy_restaurant_data_migration',
      metadata: {
        sourceRepo: path.basename(repoDir),
        ...metadata,
      },
    });
  };

  add('identity.name', data.name, 'google_places', 0.95);
  add('business.niche', 'restaurant', 'manual', 0.9);
  add('business.city', 'Brisbane', 'manual', 0.85);
  add('business.types', ['restaurant'], 'google_places', 0.75);
  add('contact.address', data.address, 'google_places', 0.95);
  add('contact.phone', data.internationalPhone || data.phone, 'google_places', 0.95);
  add('contact.email', data.email, 'official_site', 0.8);
  add('contact.website', data.website, 'official_site', 0.9);
  add('cta.call', normalizeTel(data.internationalPhone || data.phone), 'google_places', 0.95);
  add('cta.map', data.googleMapsUrl, 'google_places', 0.95);
  add('cta.reserve', data.bookingUrl, 'official_site', 0.85);
  add('reviews.rating', data.rating, 'google_places', 0.9);
  add('reviews.count', data.reviewCount, 'google_places', 0.9);
  add('hours.weekdayText', data.hours, 'google_places', 0.85);
  add('menu.source', data.menuSourceUrl, inferMenuSourceType(data.menuSourceUrl), 0.9);
  add('menu.sections', normalizeSections(data.sections, data.menuSourceUrl), inferMenuSourceType(data.menuSourceUrl), 0.9);
  add('brand.logo', data.logoImage, 'official_site', 0.85);
  add('brand.colors', colorsFromBrand(data.brand), 'official_site', 0.75);
  add('brand.ogImage', data.heroImage, 'official_site', 0.8);
  add('gallery.images', [data.heroImage, ...(data.galleryImages || [])].filter(Boolean), 'official_site', 0.8);
  add('legacy.sourceRepo', path.basename(repoDir), 'manual', 1);

  return saveEvidencePack(pack, outputPath);
}

function readRestaurantData(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
    .replace(/^export const restaurantData = /, '')
    .replace(/;\s*$/, '');
  return JSON.parse(raw);
}

function normalizeSections(sections = [], sourceUrl) {
  return sections.map((section) => ({
    name: section.title || section.name || 'Menu',
    description: section.note || section.description || '',
    items: (section.items || []).map((item) => ({
      name: item.name,
      description: item.description || '',
      price: item.price || '',
      sourceUrl,
      sourceKey: 'menu.sections',
    })),
  }));
}

function colorsFromBrand(brand = {}) {
  return [brand.bg, brand.paper, brand.ink, brand.accent, brand.accent2, brand.muted].filter(Boolean);
}

function normalizeTel(phone) {
  return phone ? `tel:${String(phone).replace(/[^+\d]/g, '')}` : '';
}

function inferMenuSourceType(url = '') {
  return url.toLowerCase().includes('.pdf') ? 'pdf' : 'official_site';
}
