#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const args = parseArgs(process.argv.slice(2));
const niche = normalizeId(args.niche || 'roofing');
const family = normalizeId(args.family || '');
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const scope = args.scope || 'multi-page';
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');

if (!family) {
  console.error('Usage: npm run template-lab:run-open-design -- --niche roofing --family classic-premium-roftix [--dry-run]');
  process.exit(1);
}

const familyDir = path.resolve('templates', niche, 'families', family);
const manifestPath = path.join(familyDir, 'template-manifest.json');
const promptPath = path.join(familyDir, 'open-design-prompt.md');
const designPath = path.join(familyDir, 'design-language.md');
const designMdPath = path.join(familyDir, 'DESIGN.md');
const designSignalsPath = path.join(familyDir, 'design-signals.json');
const sectionPath = path.join(familyDir, 'section-patterns.json');
const qaPath = path.join(familyDir, 'qa-rubric.json');
const outDir = path.join(familyDir, 'open-design');

for (const requiredPath of [manifestPath, promptPath, designPath, sectionPath, qaPath]) {
  if (!fs.existsSync(requiredPath)) throw new Error(`Missing required template file: ${requiredPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const selectedImages = buildSelectedImagesSection(manifest);
const brandKit = buildBrandKitSection(manifest, familyDir);
const prompt = [
  fs.readFileSync(promptPath, 'utf8').trim(),
  '',
  brandKit,
  brandKit ? '' : '',
  selectedImages,
  selectedImages ? '' : '',
  '## Design Language',
  fs.readFileSync(designPath, 'utf8').trim(),
  '',
  fs.existsSync(designMdPath) ? '## Machine-Readable DESIGN.md Contract' : '',
  fs.existsSync(designMdPath) ? fs.readFileSync(designMdPath, 'utf8').trim() : '',
  fs.existsSync(designMdPath) ? '' : '',
  fs.existsSync(designSignalsPath) ? '## Extracted Reference Design Signals' : '',
  fs.existsSync(designSignalsPath) ? fs.readFileSync(designSignalsPath, 'utf8').trim() : '',
  fs.existsSync(designSignalsPath) ? '' : '',
  '## Section Contract',
  fs.readFileSync(sectionPath, 'utf8').trim(),
  '',
  '## QA Rubric',
  fs.readFileSync(qaPath, 'utf8').trim(),
  '',
  '## Template Library Requirements',
  '- Build an original ProfitsLocal-owned template, not a clone.',
  '- Use realistic local-business copy and rich demo-safe content where allowed.',
  '- Include visible niche imagery or generated assets; do not ship a text-only page.',
  '- If reviewed local images are listed, copy them into the generated project assets directory and use them as real <img> assets.',
  '- If a brand kit is listed, use the selected default logo direction and do not generate multiple customer-choice logos.',
  '- Do not expose internal words like audit, mockup, lead-ops, Open Design, or template-lab in customer-facing pages.',
  '- Produce a result strong enough to be listed in the ProfitsLocal public template library after QA.',
].join('\n');

const clientSlug = `template-${niche}-${family}`;
const projectId = normalizeId(args['project-id'] || args.projectId || `${clientSlug}-${runStamp}`);
const command = [
  process.execPath,
  'scripts/open-design/run-concept.js',
  '--client',
  clientSlug,
  '--project-id',
  projectId,
  '--name',
  `${manifest.displayName || family} template`,
  '--business-type',
  `${niche} website template family`,
  '--scope',
  scope,
  '--out',
  outDir,
  '--prompt',
  prompt,
];

if (dryRun) command.push('--dry-run');

const result = spawnSync(command[0], command.slice(1), {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: 'pipe',
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

if (!dryRun) {
  const conceptManifestPath = path.join(outDir, 'concept-manifest.json');
  const conceptManifest = fs.existsSync(conceptManifestPath)
    ? JSON.parse(fs.readFileSync(conceptManifestPath, 'utf8'))
    : {};
  manifest.openDesign = {
    ...(manifest.openDesign || {}),
    clientSlug,
    projectId: conceptManifest.projectId || clientSlug,
    runIds: [
      ...new Set([
        ...((manifest.openDesign || {}).runIds || []),
        conceptManifest.runId,
        conceptManifest.lastRunId,
      ].filter(Boolean)),
    ],
    conceptDir: path.relative(process.cwd(), outDir),
    lastValidatedAt: null,
  };
  manifest.status = 'open-design-generated';
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

process.stdout.write(result.stdout);

function normalizeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function buildSelectedImagesSection(manifest) {
  const selected = manifest.selectedImages || {};
  const entries = Object.entries(selected)
    .filter(([, imagePath]) => imagePath && fs.existsSync(path.resolve(imagePath)));
  if (!entries.length) return '';
  return [
    '## Reviewed Local Image Assets',
    'Use these reviewed images as the primary visual source for this template. Copy them into `assets/` before referencing them from HTML.',
    'Do not substitute these approved images with SVG-only art, weak placeholders, or unrelated generic stock imagery.',
    '',
    ...entries.map(([slot, imagePath]) => `- ${slot}: ${imagePath}`),
  ].join('\n');
}

function buildBrandKitSection(manifest, familyDir) {
  const brandKitPath = manifest.brandKit?.path;
  const resolvedPath = brandKitPath ? path.resolve(brandKitPath) : path.join(familyDir, 'brand-kit.json');
  if (!fs.existsSync(resolvedPath)) return '';
  const brandKit = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const selectedLogo = (brandKit.logo?.options || []).find((option) => option.selected) || brandKit.logo?.options?.[0];
  return [
    '## Brand Kit / Logo Policy',
    `Business name: ${brandKit.businessName || manifest.displayName || 'Template business'}`,
    `Logo policy: ${brandKit.logo?.policy || 'single-default-demo-logo'}`,
    'If the client has no logo, use exactly one default demo logo direction. Do not ask the client to choose and do not create multiple logo options.',
    selectedLogo ? `Selected logo direction: ${selectedLogo.direction || selectedLogo.text || selectedLogo.mark || 'simple wordmark with roof/service mark'}` : '',
    selectedLogo?.svgConcept ? `Selected SVG concept: ${selectedLogo.svgConcept}` : '',
  ].filter(Boolean).join('\n');
}
