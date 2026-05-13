#!/usr/bin/env node
/**
 * M2-D7 · OD invoke prep — derive OD 4-flag payload from master.md / entity store.
 *
 * Usage:
 *   npm run pl:od-invoke-prep -- --entity-key place_xxx
 *
 * Output JSON:
 *   {
 *     ok, entityKey,
 *     sourceUrl, businessType, tone, scope,
 *     command: "npm run open-design:run-concept -- ..."
 *   }
 *
 * Derivation:
 *   - sourceUrl     ← master.md frontmatter `website:` OR brand-spec.md scrape OR entity.latest.website
 *   - businessType  ← niche + category from frontmatter / entity store
 *   - tone          ← NICHE_TONE_MAP[niche]; image_lead → refined-professional default
 *   - scope         ← default "Full concept with 3-4 key pages"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const NICHE_TONE_MAP = {
  restaurant: 'Refined hospitality · warm with editorial polish',
  cafe: 'Warm · social · approachable',
  plumber: 'Trust · reliable · 24/7 dependable',
  roofer: 'Trust · weather-tough · compliant',
  dentist: 'Clean · professional · gentle',
  lawyer: 'Authoritative · precise · trustworthy',
  electrician: 'Trust · safe · 24/7 dependable',
};

const DEFAULT_TONE = 'refined-professional · clean modern small-business';
const DEFAULT_SCOPE = 'Full concept with 3-4 key pages';

function readFrontmatter(mdPath) {
  if (!fs.existsSync(mdPath)) return null;
  const body = fs.readFileSync(mdPath, 'utf8');
  const m = body.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w_]*):\s*(.*)$/);
    if (kv) {
      let v = kv[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      fm[kv[1]] = v;
    }
  }
  return fm;
}

function readEntityByKey(entityKey) {
  const file = path.join(REPO_ROOT, 'data', 'leads', 'entities', `${entityKey}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function inferNicheFromSlug(slug) {
  const s = String(slug || '').toLowerCase();
  const hits = ['restaurant', 'cafe', 'plumber', 'roofer', 'roofing', 'dentist', 'lawyer', 'electrician', 'bar'];
  for (const k of hits) {
    if (s.includes(k)) return k === 'roofing' ? 'roofer' : k;
  }
  return '';
}

function scrapeUrlFromText(text, slugHint) {
  if (!text) return null;
  const all = text.match(/https?:\/\/[^\s)"'<>]+/g) || [];
  // Prefer URLs whose host matches a token of the slug (e.g. 'richandrare' from 'rich-and-rare-restaurant').
  if (slugHint) {
    const tokens = slugHint.split('-').filter((t) => t.length >= 4);
    const compact = slugHint.replace(/-/g, '');
    const candidates = all.filter((u) => {
      try {
        const host = new URL(u).hostname.toLowerCase();
        if (host.includes(compact)) return true;
        return tokens.some((t) => host.includes(t));
      } catch { return false; }
    });
    if (candidates[0]) return candidates[0];
  }
  // Otherwise prefer non-CDN-looking URLs (not images.* / static.*).
  const nonCdn = all.find((u) => !/^https?:\/\/(images|static\d*|cdn|i)\./.test(u));
  return nonCdn || all[0] || null;
}

/**
 * Derive OD prep payload.
 * @param {object} opts
 * @param {string} opts.entityKey
 * @param {boolean} [opts.__dryRun]
 * @param {string} [opts.__mockSourceType]  e.g. 'image_lead'
 */
export async function deriveOdPrep({ entityKey, __dryRun, __mockSourceType } = {}) {
  if (!entityKey) throw new Error('entityKey required');

  // 1. Try master.md in clients/<slug>/v2/ or flat clients/<slug>/
  const clientDir = path.join(REPO_ROOT, 'clients', entityKey);
  const candidateMds = [
    path.join(clientDir, 'v2', 'master.md'),
    path.join(clientDir, 'master.md'),
  ];
  let fm = null;
  for (const p of candidateMds) {
    fm = readFrontmatter(p);
    if (fm) break;
  }

  // 2. Try entity store
  const entity = readEntityByKey(entityKey);

  // 3. Try brand-spec.md (older customers)
  let brandSpecUrl = null;
  const brandSpec = path.join(clientDir, 'brand-spec.md');
  if (fs.existsSync(brandSpec)) {
    brandSpecUrl = scrapeUrlFromText(fs.readFileSync(brandSpec, 'utf8'), entityKey);
  }

  const sourceType = __mockSourceType || entity?.latest?.sourceType || fm?.source_type || null;
  let niche = (fm?.niche || entity?.latest?.niche || entity?.latest?.category || '').toLowerCase();
  if (!niche) niche = inferNicheFromSlug(entityKey);
  const businessNiche = niche || 'small-business';

  const isImageLead = sourceType === 'image_lead';
  let sourceUrl = isImageLead
    ? null
    : (fm?.website || entity?.latest?.website || brandSpecUrl || null);

  // Tone: image_lead → default refined-professional. Otherwise niche map → default.
  const tone = isImageLead
    ? DEFAULT_TONE
    : (NICHE_TONE_MAP[businessNiche] || DEFAULT_TONE);

  const businessType = entity?.latest?.category
    ? `${businessNiche} · ${entity.latest.category}`
    : businessNiche;

  const payload = {
    ok: true,
    entityKey,
    sourceUrl,
    businessType,
    tone,
    scope: DEFAULT_SCOPE,
  };
  payload.command = [
    'npm run open-design:run-concept --',
    `--client ${entityKey}`,
    sourceUrl ? `--source-url ${sourceUrl}` : '--no-source-url',
    `--business-type "${businessType}"`,
    `--tone "${tone}"`,
    `--scope "${DEFAULT_SCOPE}"`,
  ].join(' ');

  if (!__dryRun) {
    console.log(JSON.stringify(payload, null, 2));
  }
  return payload;
}

// CLI entrypoint
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  let entityKey = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--entity-key') entityKey = args[++i];
  }
  if (!entityKey) {
    console.error('usage: pl-od-invoke-prep --entity-key <key>');
    process.exit(1);
  }
  deriveOdPrep({ entityKey }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
