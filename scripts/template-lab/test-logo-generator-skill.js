#!/usr/bin/env node

import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-skill-smoke-'));
const variantsDir = path.join(outRoot, 'variants');
fs.mkdirSync(variantsDir, { recursive: true });

const variants = [
  {
    id: 'roofline-wordmark',
    rationale: 'Simple roofline over compact initials. Best for small local roofing brands.',
    svg: svgRoofline('RR'),
  },
  {
    id: 'standing-seam-mark',
    rationale: 'Vertical seam geometry references metal roofing without looking like a fake badge.',
    svg: svgSeam('RR'),
  },
  {
    id: 'shield-roof',
    rationale: 'Protection cue for roofing, but still restrained and demo-safe.',
    svg: svgShield('RR'),
  },
  {
    id: 'monoline-house',
    rationale: 'Friendly residential cue for low-info outreach leads.',
    svg: svgHouse('RR'),
  },
  {
    id: 'tile-stack',
    rationale: 'Layered roof material cue for restoration and replacement.',
    svg: svgStack('RR'),
  },
  {
    id: 'angle-arrow',
    rationale: 'Dynamic roof pitch and upward motion for bolder commercial templates.',
    svg: svgAngle('RR'),
  },
];

for (const variant of variants) {
  fs.writeFileSync(path.join(variantsDir, `${variant.id}.svg`), variant.svg);
}

const selected = variants[0];
const review = {
  schemaVersion: 1,
  status: 'ready',
  sourceSkill: 'logo-generator',
  installedSkillPath: '/Users/matthew/.codex/skills/logo-generator/SKILL.md',
  note: 'Smoke test follows the skill pattern of generating multiple SVG variants, but ProfitsLocal policy auto-selects exactly one default demo logo for customer-facing use.',
  generatedVariantCount: variants.length,
  customerVisibleLogoCount: 1,
  selected: {
    id: selected.id,
    rationale: selected.rationale,
    file: path.join(variantsDir, `${selected.id}.svg`),
  },
  variants: variants.map((variant) => ({
    id: variant.id,
    rationale: variant.rationale,
    file: path.join(variantsDir, `${variant.id}.svg`),
  })),
};

fs.writeFileSync(path.join(outRoot, 'logo-skill-smoke.json'), `${JSON.stringify(review, null, 2)}\n`);

assert.equal(variants.length, 6);
assert.equal(review.customerVisibleLogoCount, 1);
assert.ok(fs.existsSync(review.selected.file));

console.log(JSON.stringify({
  ok: true,
  outRoot,
  generatedVariantCount: review.generatedVariantCount,
  customerVisibleLogoCount: review.customerVisibleLogoCount,
  selected: review.selected.id,
}, null, 2));

function baseSvg(content) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="demo roofing logo">${content}</svg>\n`;
}

function text(mark) {
  return `<text x="50" y="62" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="currentColor">${mark}</text>`;
}

function svgRoofline(mark) {
  return baseSvg(`<path d="M18 52 50 25l32 27" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 52h42v22H29z" fill="none" stroke="currentColor" stroke-width="5"/>${text(mark)}`);
}

function svgSeam(mark) {
  return baseSvg(`<path d="M24 25h52v50H24z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M38 25v50M52 25v50M66 25v50" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="50" r="21" fill="white"/>${text(mark)}`);
}

function svgShield(mark) {
  return baseSvg(`<path d="M50 16 78 28v21c0 19-11 31-28 38-17-7-28-19-28-38V28z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M31 47 50 31l19 16" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>${text(mark)}`);
}

function svgHouse(mark) {
  return baseSvg(`<path d="M20 48 50 22l30 26" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M28 45v32h44V45" fill="none" stroke="currentColor" stroke-width="5"/><path d="M39 77V57h22v20" fill="none" stroke="currentColor" stroke-width="4"/>${text(mark)}`);
}

function svgStack(mark) {
  return baseSvg(`<path d="M20 34h60l-9 13H29zM24 49h52l-8 12H32zM30 64h40l-6 9H36z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>${text(mark)}`);
}

function svgAngle(mark) {
  return baseSvg(`<path d="M18 70 48 24l34 46" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 66h28M50 54h14" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>${text(mark)}`);
}
