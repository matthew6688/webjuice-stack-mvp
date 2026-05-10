#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'od-port-smoke-'));
const conceptDir = path.join(root, 'concept');
const repoDir = path.join(root, 'repo');
const sourceDir = path.join(root, 'source');
fs.mkdirSync(path.join(conceptDir, 'assets'), { recursive: true });
fs.mkdirSync(path.join(repoDir, 'src', 'styles'), { recursive: true });
fs.mkdirSync(path.join(repoDir, 'src', 'data'), { recursive: true });
fs.mkdirSync(path.join(repoDir, 'public'), { recursive: true });
fs.mkdirSync(sourceDir, { recursive: true });

fs.writeFileSync(path.join(repoDir, 'package.json'), '{"type":"module"}\n');
fs.writeFileSync(path.join(repoDir, 'src', 'styles', 'rich-rare-open-design.css'), '.rr-od { --rr-bg: black; }\n');
fs.writeFileSync(path.join(conceptDir, 'index.html'), '<!doctype html><html><body><h1>Smoke Concept</h1></body></html>\n');
fs.writeFileSync(path.join(conceptDir, 'assets', 'hero.webp'), 'fake-image');
fs.writeFileSync(path.join(sourceDir, 'content.restaurant.json'), `${JSON.stringify({
  hero: { name: 'Smoke Restaurant', tagline: 'Live fire and long lunches' },
  menu: { sections: [{ name: 'Starters', items: [{ name: 'Octopus', price: '$24' }] }] },
}, null, 2)}\n`);
fs.writeFileSync(path.join(sourceDir, 'design.restaurant.json'), `${JSON.stringify({
  tokens: { palette: { accent: '#d97706' } },
}, null, 2)}\n`);

const handoffPath = path.join(conceptDir, 'production-handoff.json');
fs.writeFileSync(handoffPath, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: '2026-05-07T00:00:00.000Z',
  clientSlug: 'smoke-client',
  purpose: 'open_design_concept_to_webjuice_astro_handoff',
  concept: {
    conceptDir,
    indexPath: path.join(conceptDir, 'index.html'),
    projectId: 'smoke-project',
    runId: 'smoke-run',
    files: {
      assets: ['assets/hero.webp'],
    },
  },
  sourceOfTruth: {
    evidencePath: 'clients/smoke/evidence/evidence.json',
    contentPath: path.join(sourceDir, 'content.restaurant.json'),
    designPath: path.join(sourceDir, 'design.restaurant.json'),
    surveyPath: 'clients/smoke/intake/website-survey.json',
    rule: 'Use verified source facts.',
  },
  target: {
    repo: repoDir,
    branch: 'dev',
  },
  extracted: {
    contentFacts: {
      businessName: 'Smoke Client',
      phone: '+61 7 3000 0000',
      address: '1 Smoke Street',
      reserveUrl: 'https://example.com/reserve',
      menuSourceUrl: 'https://example.com/menu',
    },
    conceptFacts: {
      title: 'Smoke Concept',
      headings: ['Smoke Concept'],
    },
    tokens: {
      '--bg': 'oklch(14% 0.018 60)',
      '--surface': 'oklch(19% 0.018 60)',
      '--fg': 'oklch(96% 0.008 75)',
      '--muted': 'oklch(72% 0.018 75)',
      '--border': 'oklch(32% 0.022 65)',
      '--accent': 'oklch(67% 0.105 72)',
    },
    pages: [
      { targetRoute: '/' },
      { targetRoute: '/menu' },
    ],
  },
  requiredPreservationChecks: ['business name', 'phone'],
  implementationPlan: ['Port tokens.'],
}, null, 2)}\n`);

const output = execFileSync('node', [
  'scripts/open-design/port-production-handoff.js',
  '--handoff',
  handoffPath,
  '--target-repo',
  repoDir,
  '--execute',
  'true',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
const result = JSON.parse(output);
assert.equal(result.ok, true);
assert.equal(result.dryRun, false);
assert.equal(result.preserved.businessName, 'Smoke Client');
assert.equal(result.routes.includes('/menu'), true);
assert.equal(fs.existsSync(path.join(repoDir, 'src', 'data', 'open-design.production-handoff.json')), true);
assert.equal(fs.existsSync(path.join(repoDir, 'src', 'data', 'content.restaurant.json')), true);
assert.equal(fs.existsSync(path.join(repoDir, 'src', 'data', 'design.restaurant.json')), true);
assert.equal(fs.existsSync(path.join(repoDir, 'src', 'styles', 'open-design-handoff.css')), true);
assert.equal(fs.existsSync(path.join(repoDir, 'public', 'open-design', 'smoke-client', 'hero.webp')), true);
const css = fs.readFileSync(path.join(repoDir, 'src', 'styles', 'rich-rare-open-design.css'), 'utf8');
assert.match(css, /BEGIN OPEN DESIGN HANDOFF BRIDGE/);
assert.match(css, /--rr-accent: oklch\(67% 0\.105 72\)/);
const importedContent = JSON.parse(fs.readFileSync(path.join(repoDir, 'src', 'data', 'content.restaurant.json'), 'utf8'));
const importedDesign = JSON.parse(fs.readFileSync(path.join(repoDir, 'src', 'data', 'design.restaurant.json'), 'utf8'));
assert.equal(importedContent.hero.name, 'Smoke Restaurant');
assert.equal(importedDesign.tokens.palette.accent, '#d97706');
assert.equal(fs.existsSync(path.join(repoDir, 'src', 'pages', 'index.html')), false);

console.log(JSON.stringify({
  ok: true,
  root,
  assertions: {
    writesStructuredData: true,
    copiesRestaurantArtifacts: true,
    copiesAssets: true,
    injectsCssBridge: true,
    doesNotCopyStandaloneHtmlIntoPages: true,
  },
}, null, 2));
