#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || process.cwd());
const niche = normalizeId(args.niche || '');
const family = normalizeId(args.family || '');
const force = booleanArg(args, 'force');

if (!niche || !family) {
  console.error('Usage: node scripts/template-lab/init-family.js --niche roofing --family classic-premium-roftix [--root path] [--force true]');
  process.exit(1);
}

const familyDir = path.join(root, 'templates', niche, 'families', family);
if (fs.existsSync(familyDir) && !force) {
  console.error(`Template family already exists: ${familyDir}. Use --force true to overwrite generated scaffold files.`);
  process.exit(1);
}

fs.mkdirSync(path.join(familyDir, 'references'), { recursive: true });
fs.mkdirSync(path.join(familyDir, 'screenshots'), { recursive: true });
fs.mkdirSync(path.join(familyDir, 'open-design'), { recursive: true });
fs.mkdirSync(path.join(root, 'templates', niche, 'shared'), { recursive: true });

writeJson(path.join(familyDir, 'template-manifest.json'), buildManifest({ niche, family }));
writeText(path.join(familyDir, 'design-language.md'), renderDesignLanguage({ niche, family }));
writeJson(path.join(familyDir, 'section-patterns.json'), buildSectionPatterns({ niche, family }));
writeText(path.join(familyDir, 'open-design-prompt.md'), renderOpenDesignPrompt({ niche, family }));
writeJson(path.join(familyDir, 'qa-rubric.json'), buildQaRubric());

writeJsonIfMissing(path.join(root, 'templates', niche, 'shared', 'image-keywords.json'), {
  schemaVersion: 1,
  niche,
  hero: [],
  services: [],
  projects: [],
  team: [],
  materials: [],
});
writeJsonIfMissing(path.join(root, 'templates', niche, 'shared', 'service-taxonomy.json'), {
  schemaVersion: 1,
  niche,
  services: [],
  subNiches: [],
});
writeJsonIfMissing(path.join(root, 'templates', niche, 'shared', 'trust-signals.json'), {
  schemaVersion: 1,
  niche,
  verifiedOnly: ['reviews', 'licenses', 'certifications', 'years in business', 'warranties'],
  demoSafe: ['process explanation', 'FAQ', 'service descriptions', 'project teaser structure'],
});

console.log(JSON.stringify({
  ok: true,
  niche,
  family,
  familyDir,
  files: [
    'template-manifest.json',
    'design-language.md',
    'section-patterns.json',
    'open-design-prompt.md',
    'qa-rubric.json',
  ],
}, null, 2));

function buildManifest({ niche, family }) {
  return {
    schemaVersion: 1,
    templateId: `${niche}/${family}`,
    status: 'draft',
    niche,
    family,
    displayName: titleize(family),
    sourceInputs: {
      screenshots: [],
      urls: [],
      notes: [],
    },
    fit: {
      subNiches: [],
      bestFor: [],
      notFor: [],
      priceTiers: ['one-page', 'standard', 'premium'],
    },
    factsPolicy: {
      requiredVerifiedFacts: ['businessName', 'phone', 'services'],
      optionalVerifiedFacts: ['email', 'address', 'website', 'reviews', 'projects', 'socialProfiles'],
      dummyAllowed: ['FAQ', 'process', 'service descriptions', 'project teaser structure', 'blog titles'],
      mustNotInvent: ['exact address', 'email', 'phone', 'reviews', 'licenses', 'certifications', 'years in business', 'awards', 'prices'],
    },
    visualAssetPlan: {
      required: ['hero image', 'service image or icon set', 'project/gallery imagery'],
      preferredSources: ['provided screenshot references', 'official site/social images', 'Unsplash/Freepik when licensed', 'AI-generated only when needed'],
      forbidden: ['text-only hero', 'SVG-only primary visual for photo-heavy niches unless intentionally approved'],
    },
    openDesign: {
      clientSlug: null,
      projectId: null,
      runIds: [],
      conceptDir: null,
      lastValidatedAt: null,
    },
    qa: {
      approved: false,
      score: null,
      screenshotPaths: [],
      notes: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

function renderDesignLanguage({ niche, family }) {
  return `# ${titleize(family)} Design Language

Niche: ${niche}

## Reference Summary

Add the screenshots/links that define this family. Describe what should be imitated at the pattern level, not copied literally.

## Visual Thesis

Write one sentence that names the mood, material, and energy.

## Typography Direction

- Display:
- Body:
- Navigation / labels:

## Color System

- Dominant:
- Accent:
- CTA:
- Background:
- Footer:

## Imagery

Name exact image needs:

- hero:
- services:
- project/gallery:
- team/trust:
- CTA:

## Layout Patterns

- hero:
- services:
- proof:
- projects:
- FAQ/contact:
- footer:

## Do

- Use original ProfitsLocal-generated layout and assets.
- Keep verified facts separate from demo content.
- Make the first viewport unmistakably ${niche}.

## Do Not

- Copy the reference brand, logo, exact copy, code, or paid assets.
- Average incompatible references into a generic page.
- Expose internal workflow language to customers.
`;
}

function buildSectionPatterns({ niche, family }) {
  return {
    schemaVersion: 1,
    niche,
    family,
    pageTypes: {
      onePage: {
        requiredSections: ['hero', 'services', 'proof', 'projectsTeaser', 'process', 'faq', 'contact', 'footer'],
        optionalSections: ['about', 'serviceArea', 'materials', 'blogTeaser'],
      },
      multiPage: {
        pages: ['home', 'about', 'services', 'serviceDetail', 'projects', 'projectDetail', 'faq', 'blog', 'blogDetail', 'appointment'],
      },
    },
    sections: [],
  };
}

function renderOpenDesignPrompt({ niche, family }) {
  return `Build an original ${niche} website template family inspired by the reference brief in this folder.

Template family: ${family}

Do not copy the reference brand, logo, exact text, code, or paid assets. Recreate the design language and section patterns as an original ProfitsLocal template.

Required outputs:
- index.html for the primary template
- local assets under assets/
- style-guide.md if brand/design tokens are clear

Rules:
- Customer-facing copy only.
- No internal workflow terms.
- Use rich demo content where allowed by template-manifest.json.
- Do not invent verified facts listed in factsPolicy.mustNotInvent.
- Use photo-quality niche imagery when the reference style depends on photography.
- Ask no question form unless generation is technically impossible.
`;
}

function buildQaRubric() {
  return {
    schemaVersion: 1,
    passScore: 85,
    criteria: [
      { id: 'referenceFidelity', label: 'Reference fidelity without copying', weight: 15 },
      { id: 'firstViewportImpact', label: 'First viewport impact', weight: 15 },
      { id: 'imageDensity', label: 'Image density and niche relevance', weight: 12 },
      { id: 'nicheFit', label: 'Niche and sub-niche fit', weight: 12 },
      { id: 'pageCompleteness', label: 'Page/system completeness', weight: 12 },
      { id: 'ctaHierarchy', label: 'CTA hierarchy and conversion path', weight: 10 },
      { id: 'trustProof', label: 'Trust/proof richness', weight: 8 },
      { id: 'mobilePolish', label: 'Mobile polish', weight: 8 },
      { id: 'copyCleanliness', label: 'Customer-facing copy cleanliness', weight: 8 },
    ],
    hardFails: [
      'customer-visible internal workflow terms',
      'missing primary visual asset in a photo-heavy family',
      'fake verified facts such as reviews, licenses, address, years, awards, or prices',
      'no visible phone/form/contact path in lead-generation templates',
    ],
  };
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonIfMissing(filePath, value) {
  if (fs.existsSync(filePath)) return;
  writeJson(filePath, value);
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleize(value) {
  return String(value || '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function booleanArg(argsObject, key) {
  return argsObject[key] === true || argsObject[key] === 'true' || argsObject[key] === '1';
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
