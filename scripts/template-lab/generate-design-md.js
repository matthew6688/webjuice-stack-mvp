#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const args = parseArgs(process.argv.slice(2));
const niche = normalizeId(args.niche || 'roofing');
const familyArg = normalizeId(args.family || '');
const all = Boolean(args.all);
const root = path.resolve(args.root || process.cwd());
const useGoogleLint = Boolean(args['google-lint'] || args.googleLint);

const families = all ? listFamilies(niche) : [familyArg].filter(Boolean);
if (!families.length) {
  console.error('Usage: node scripts/template-lab/generate-design-md.js --niche roofing --family classic-premium-roftix [--google-lint]');
  console.error('   or: node scripts/template-lab/generate-design-md.js --niche roofing --all');
  process.exit(1);
}

const results = [];
for (const family of families) {
  const familyDir = path.join(root, 'templates', niche, 'families', family);
  const manifestPath = path.join(familyDir, 'template-manifest.json');
  const designLanguagePath = path.join(familyDir, 'design-language.md');
  const outPath = path.join(familyDir, 'DESIGN.md');
  if (!fs.existsSync(manifestPath)) throw new Error(`Missing manifest: ${manifestPath}`);
  if (!fs.existsSync(designLanguagePath)) throw new Error(`Missing design language: ${designLanguagePath}`);

  const manifest = readJson(manifestPath);
  const designLanguage = fs.readFileSync(designLanguagePath, 'utf8');
  const designMd = renderDesignMd({ niche, family, manifest, designLanguage });
  fs.writeFileSync(outPath, designMd);

  const localLint = lintDesignMd(designMd);
  const googleLint = useGoogleLint ? runGoogleLint(outPath) : null;
  manifest.designContract = {
    path: path.relative(root, outPath),
    spec: 'google-labs-code/design.md-compatible',
    localLint,
    googleLint,
    generatedAt: new Date().toISOString(),
  };
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  results.push({ family, outPath, localLint, googleLint });
}

console.log(JSON.stringify({ ok: results.every((result) => result.localLint.ok && (result.googleLint?.ok ?? true)), results }, null, 2));

function listFamilies(nicheId) {
  const familyRoot = path.join(root, 'templates', nicheId, 'families');
  if (!fs.existsSync(familyRoot)) return [];
  return fs.readdirSync(familyRoot)
    .filter((name) => fs.existsSync(path.join(familyRoot, name, 'template-manifest.json')))
    .sort();
}

function renderDesignMd({ niche, family, manifest, designLanguage }) {
  const palette = paletteForFamily(family);
  const typography = typographyForFamily(family);
  const extracted = extractSections(designLanguage);
  return `---
version: alpha
name: ${yamlString(manifest.displayName || titleize(family))}
description: ${yamlString(`${manifest.displayName || titleize(family)} ${niche} template family design contract`)}
colors:
  primary: "${palette.primary}"
  secondary: "${palette.secondary}"
  tertiary: "${palette.tertiary}"
  neutral: "${palette.neutral}"
  surface: "${palette.surface}"
  on-primary: "${palette.onPrimary}"
  on-tertiary: "${palette.onTertiary}"
typography:
  h1:
    fontFamily: ${yamlString(typography.display)}
    fontSize: ${typography.h1}
    fontWeight: ${typography.h1Weight}
    lineHeight: ${typography.h1LineHeight}
    letterSpacing: ${typography.h1LetterSpacing}
  h2:
    fontFamily: ${yamlString(typography.display)}
    fontSize: ${typography.h2}
    fontWeight: ${typography.h2Weight}
    lineHeight: ${typography.h2LineHeight}
  body-md:
    fontFamily: ${yamlString(typography.body)}
    fontSize: 1rem
    fontWeight: "400"
    lineHeight: "1.6"
  label-caps:
    fontFamily: ${yamlString(typography.body)}
    fontSize: "0.75rem"
    fontWeight: "800"
    lineHeight: "1.2"
rounded:
  sm: 4px
  md: 8px
  lg: 16px
spacing:
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.md}"
    padding: 14px
  hero-surface:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
---

## Overview

${extracted['Visual Thesis'] || extracted['Reference Summary'] || `A ${niche} website template family with a specific visual contract for AI design agents.`}

## Colors

- **Primary (${palette.primary}):** ${palette.primaryUse}
- **Secondary (${palette.secondary}):** ${palette.secondaryUse}
- **Tertiary (${palette.tertiary}):** ${palette.tertiaryUse}
- **Neutral (${palette.neutral}):** ${palette.neutralUse}
- **Surface (${palette.surface}):** main content canvas.

## Typography

${extracted['Typography Direction'] || `Use ${typography.display} for display headings and ${typography.body} for body copy.`}

## Layout

${extracted['Layout Patterns'] || 'Use a strong first viewport, clear service sections, proof blocks, project/gallery evidence, FAQ, contact path, and complete footer.'}

## Elevation & Depth

Use depth only when it supports hierarchy. Photo-heavy families should rely on image composition, contrast, and section rhythm before decorative shadows.

## Shapes

Default to restrained corners. Use larger radii only for image containers and CTA panels when the reference style supports it.

## Components

- **Hero:** must clearly communicate the niche in the first viewport.
- **Primary CTA:** uses the tertiary token and must be visually obvious.
- **Service modules:** should match the family layout direction, not a generic card grid.
- **Footer:** must feel complete and credible, even when demo-safe content is used.

## Do's and Don'ts

${extractDoDont(designLanguage)}
`;
}

function paletteForFamily(family) {
  const palettes = {
    'classic-premium-roftix': {
      primary: '#0B2F57',
      secondary: '#51606F',
      tertiary: '#0E6B4F',
      neutral: '#F7F5F0',
      surface: '#FFFFFF',
      onPrimary: '#FFFFFF',
      onTertiary: '#FFFFFF',
      primaryUse: 'cinematic navy for hero overlays and premium roof photography.',
      secondaryUse: 'slate captions, borders, and restrained metadata.',
      tertiaryUse: 'forest-green contact and conversion actions.',
      neutralUse: 'warm editorial page background.',
    },
    'editorial-bold-commercial': {
      primary: '#050505',
      secondary: '#6D6D6D',
      tertiary: '#F25A1D',
      neutral: '#F7F7F4',
      surface: '#FFFFFF',
      onPrimary: '#FFFFFF',
      onTertiary: '#111111',
      primaryUse: 'black poster blocks and high-contrast commercial authority.',
      secondaryUse: 'industrial gray support text and rules.',
      tertiaryUse: 'construction-orange emphasis, actions, and stats.',
      neutralUse: 'white editorial space around bold typography.',
    },
    'productized-modern-roofing': {
      primary: '#111827',
      secondary: '#64748B',
      tertiary: '#2F6F5E',
      neutral: '#F3F4F6',
      surface: '#FFFFFF',
      onPrimary: '#FFFFFF',
      onTertiary: '#FFFFFF',
      primaryUse: 'clean charcoal for productized service clarity.',
      secondaryUse: 'muted UI labels, dividers, and secondary copy.',
      tertiaryUse: 'subtle green for quote and action paths.',
      neutralUse: 'airy gray bands and product comparison areas.',
    },
    'lead-capture-restoration': {
      primary: '#1D2328',
      secondary: '#6B6258',
      tertiary: '#C9472A',
      neutral: '#FAF3E8',
      surface: '#FFFDF8',
      onPrimary: '#FFFFFF',
      onTertiary: '#FFFFFF',
      primaryUse: 'dark trade contrast for footer and phone-first bands.',
      secondaryUse: 'warm gray local-business support copy.',
      tertiaryUse: 'roof-red/orange quote and phone actions.',
      neutralUse: 'warm flyer-like background without feeling cheap.',
    },
  };
  return palettes[family] || palettes['classic-premium-roftix'];
}

function typographyForFamily(family) {
  if (family === 'classic-premium-roftix') return { display: 'Playfair Display', body: 'Inter', h1: '4.75rem', h1Weight: '700', h1LineHeight: '0.95', h1LetterSpacing: '0', h2: '3rem', h2Weight: '700', h2LineHeight: '1.05' };
  if (family === 'editorial-bold-commercial') return { display: 'Inter', body: 'Inter', h1: '6rem', h1Weight: '900', h1LineHeight: '0.88', h1LetterSpacing: '0', h2: '3.4rem', h2Weight: '850', h2LineHeight: '0.96' };
  if (family === 'productized-modern-roofing') return { display: 'Inter', body: 'Inter', h1: '4rem', h1Weight: '750', h1LineHeight: '1', h1LetterSpacing: '0', h2: '2.5rem', h2Weight: '700', h2LineHeight: '1.08' };
  return { display: 'Inter', body: 'Inter', h1: '3.8rem', h1Weight: '850', h1LineHeight: '0.98', h1LetterSpacing: '0', h2: '2.4rem', h2Weight: '800', h2LineHeight: '1.05' };
}

function lintDesignMd(markdown) {
  const findings = [];
  if (!markdown.startsWith('---\n')) findings.push({ severity: 'error', message: 'Missing YAML front matter.' });
  for (const token of ['name:', 'colors:', 'typography:', 'components:', '## Overview', '## Colors', '## Typography', "## Do's and Don'ts"]) {
    if (!markdown.includes(token)) findings.push({ severity: 'error', message: `Missing required token/section: ${token}` });
  }
  for (const ref of markdown.matchAll(/\{([^}]+)\}/g)) {
    const value = ref[1];
    const top = value.split('.')[0];
    if (!['colors', 'typography', 'rounded', 'spacing', 'components'].includes(top)) findings.push({ severity: 'error', message: `Unknown token reference root: ${value}` });
  }
  return {
    ok: findings.every((finding) => finding.severity !== 'error'),
    findings,
    summary: {
      errors: findings.filter((finding) => finding.severity === 'error').length,
      warnings: findings.filter((finding) => finding.severity === 'warning').length,
    },
  };
}

function runGoogleLint(filePath) {
  const result = spawnSync('npx', ['--yes', '@google/design.md', 'lint', filePath], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = { stdout: result.stdout, stderr: result.stderr };
  }
  return {
    ok: result.status === 0,
    status: result.status,
    report: parsed,
  };
}

function extractSections(markdown) {
  const sections = {};
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  for (let i = 0; i < matches.length; i += 1) {
    const title = matches[i][1].trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
    sections[title] = markdown.slice(start, end).trim();
  }
  return sections;
}

function extractDoDont(markdown) {
  const sections = extractSections(markdown);
  return [
    sections.Do ? `### Do\n\n${sections.Do}` : '',
    sections['Do Not'] ? `### Don't\n\n${sections['Do Not']}` : '',
  ].filter(Boolean).join('\n\n') || '- Follow the design contract.\n- Do not copy protected reference assets.';
}

function yamlString(value) {
  return JSON.stringify(String(value || ''));
}

function normalizeId(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleize(value) {
  return String(value).split(/[-_\s]+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
