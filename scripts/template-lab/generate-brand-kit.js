#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const niche = normalizeId(args.niche || 'roofing');
const family = normalizeId(args.family || '');
const root = path.resolve(args.root || process.cwd());
const provider = args.provider || 'local';
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const businessName = String(args.business || args.name || '').trim();

if (!family) {
  console.error('Usage: node scripts/template-lab/generate-brand-kit.js --niche roofing --family classic-premium-roftix [--business "RidgeLine Roofing"] [--provider local|gemini] [--dry-run]');
  process.exit(1);
}

const familyDir = path.join(root, 'templates', niche, 'families', family);
const manifestPath = path.join(familyDir, 'template-manifest.json');
const designPath = path.join(familyDir, 'DESIGN.md');
const signalsPath = path.join(familyDir, 'design-signals.json');
if (!fs.existsSync(manifestPath)) throw new Error(`Missing manifest: ${manifestPath}`);

const manifest = readJson(manifestPath);
const signals = readJsonIfExists(signalsPath);
const designMd = readTextIfExists(designPath);
const generatedAt = new Date().toISOString();
const brandName = businessName || defaultBrandName(manifest, family);
const brandKit = dryRun
  ? buildLocalBrandKit({ manifest, signals, designMd, brandName, generatedAt, dryRun: true })
  : await buildBrandKit({ provider, manifest, signals, designMd, brandName, generatedAt });

const outPath = path.join(familyDir, 'brand-kit.json');
fs.writeFileSync(outPath, `${JSON.stringify(brandKit, null, 2)}\n`);

manifest.brandKit = {
  path: path.relative(root, outPath),
  provider: brandKit.provider,
  generatedAt,
  logoPolicy: brandKit.logo.policy,
  logoOptionCount: brandKit.logo.options.length,
  status: brandKit.status,
};
manifest.updatedAt = generatedAt;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  status: brandKit.status,
  provider: brandKit.provider,
  path: outPath,
  logoOptionCount: brandKit.logo.options.length,
  policy: brandKit.logo.policy,
}, null, 2));

async function buildBrandKit({ provider: selectedProvider, manifest, signals, designMd, brandName, generatedAt }) {
  if (selectedProvider === 'local') {
    return buildLocalBrandKit({ manifest, signals, designMd, brandName, generatedAt });
  }
  if (selectedProvider === 'gemini') {
    return buildGeminiBrandKit({ manifest, signals, designMd, brandName, generatedAt });
  }
  throw new Error(`Unsupported brand-kit provider: ${selectedProvider}`);
}

function buildLocalBrandKit({ manifest, signals, designMd, brandName, generatedAt, dryRun = false }) {
  const palette = normalizePalette(signals?.palette, designMd);
  const accent = palette.find((item) => item.role === 'accent')?.hex || palette[1]?.hex || '#ff6f3c';
  const primary = palette.find((item) => item.role === 'primary')?.hex || palette[0]?.hex || '#0b3767';
  const neutral = palette.find((item) => item.role === 'neutral')?.hex || '#111827';
  const markLetters = initials(brandName);
  const displayName = manifest.displayName || titleize(manifest.family || brandName);
  return {
    schemaVersion: 1,
    status: dryRun ? 'dry_run' : 'ready',
    provider: 'local',
    generatedAt,
    family: manifest.templateId || manifest.family,
    businessName: brandName,
    positioning: {
      shortLine: `${brandName} presents as a capable ${manifest.niche || 'local service'} business with a clear quote path.`,
      voice: 'plain, competent, local, practical',
      proofBoundary: 'Use demo-safe claims only. Do not invent licences, awards, reviews, years in business, exact prices, or real addresses.',
    },
    logo: {
      policy: 'single-default-demo-logo',
      reason: 'If the client has no logo, choose one sensible demo mark automatically. Do not ask the client to pick and do not generate multiple paid options.',
      options: [
        {
          id: 'default',
          type: 'wordmark-with-simple-mark',
          selected: true,
          text: brandName,
          mark: markLetters,
          direction: `${displayName} style: simple geometric roof/service mark plus readable wordmark. No fake badges, no copied reference logo.`,
          svgConcept: buildSvgConcept({ markLetters, primary, accent, neutral }),
        },
      ],
    },
    tokens: {
      colors: {
        primary,
        accent,
        neutral,
        background: palette.find((item) => item.role === 'background')?.hex || '#f8f5ee',
      },
      typography: {
        display: signals?.typography?.display || 'reference-aligned display face',
        body: signals?.typography?.body || 'clean sans-serif body face',
      },
    },
    imageDirection: signals?.imageDirection || {
      hero: 'photo-quality local-business hero image with useful negative space',
      service: 'realistic service work details',
      proof: 'before/after or project-style images when available',
    },
  };
}

async function buildGeminiBrandKit({ manifest, signals, designMd, brandName, generatedAt }) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY');
  const prompt = [
    'Return only valid JSON for a local business demo brand kit.',
    'Rules: choose exactly one logo option; do not ask the customer to choose; do not invent verified facts.',
    `Business name: ${brandName}`,
    `Niche: ${manifest.niche || 'local business'}`,
    `Template family: ${manifest.displayName || manifest.family}`,
    `Design signals: ${JSON.stringify(signals || {}).slice(0, 6000)}`,
    `DESIGN.md excerpt: ${String(designMd || '').slice(0, 6000)}`,
    'Required JSON keys: schemaVersion,status,provider,generatedAt,family,businessName,positioning,logo,tokens,imageDirection.',
  ].join('\n');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.35,
      },
    }),
  });
  const bodyText = await response.text();
  if (!response.ok) throw new Error(`Gemini brand-kit generation failed: ${response.status} ${sanitizeSecret(bodyText)}`.trim());
  const body = JSON.parse(bodyText);
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  const parsed = JSON.parse(text || '{}');
  parsed.schemaVersion = 1;
  parsed.status = parsed.status || 'ready';
  parsed.provider = 'gemini';
  parsed.generatedAt = generatedAt;
  parsed.family = parsed.family || manifest.templateId || manifest.family;
  parsed.businessName = parsed.businessName || brandName;
  parsed.logo = enforceSingleLogo(parsed.logo, brandName);
  return parsed;
}

function enforceSingleLogo(logo, brandName) {
  const safeLogo = logo && typeof logo === 'object' ? logo : {};
  const first = Array.isArray(safeLogo.options) && safeLogo.options.length ? safeLogo.options[0] : {
    id: 'default',
    type: 'wordmark-with-simple-mark',
    selected: true,
    text: brandName,
  };
  first.selected = true;
  return {
    ...safeLogo,
    policy: 'single-default-demo-logo',
    reason: safeLogo.reason || 'Automatically choose one demo logo direction when the client has no logo.',
    options: [first],
  };
}

function normalizePalette(palette, designMd) {
  if (Array.isArray(palette) && palette.length) {
    return palette.map((item, index) => ({
      role: item.role || ['primary', 'accent', 'background', 'neutral'][index] || 'support',
      hex: item.hex || item.value || '',
    })).filter((item) => /^#[0-9a-f]{3,8}$/i.test(item.hex));
  }
  const matches = Array.from(String(designMd || '').matchAll(/#[0-9a-f]{6}/gi)).map((match) => match[0]);
  return matches.slice(0, 4).map((hex, index) => ({
    role: ['primary', 'accent', 'background', 'neutral'][index] || 'support',
    hex,
  }));
}

function buildSvgConcept({ markLetters, primary, accent, neutral }) {
  return `<svg viewBox="0 0 180 48" xmlns="http://www.w3.org/2000/svg" role="img"><path d="M8 27 30 9l22 18" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 27h24v14H20z" fill="${primary}"/><text x="66" y="32" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="${neutral}">${escapeXml(markLetters)}</text></svg>`;
}

function defaultBrandName(manifest, family) {
  const familyName = manifest.displayName || titleize(family);
  return familyName.replace(/\btemplate\b/gi, '').trim() || 'Local Service Co.';
}

function initials(value) {
  const parts = String(value).split(/[^A-Za-z0-9]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'L';
}

function titleize(value) {
  return String(value).split(/[-_\s]+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}

function normalizeId(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]);
}

function sanitizeSecret(value) {
  return String(value || '').replace(/AIza[0-9A-Za-z_-]+/g, 'AIza***redacted***').replace(/sk-[A-Za-z0-9_*.-]+/g, 'sk-***redacted***');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonIfExists(filePath) {
  return fs.existsSync(filePath) ? readJson(filePath) : null;
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
