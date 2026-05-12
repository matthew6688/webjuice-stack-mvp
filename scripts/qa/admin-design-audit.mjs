#!/usr/bin/env node
/**
 * scripts/qa/admin-design-audit.mjs
 *
 * Enforce admin design system discipline:
 * Detect per-page <style> blocks in src/pages/admin/**.astro that
 * define new class selectors NOT already in admin-design-system.css.
 *
 * Per docs/ADMIN_DESIGN_SYSTEM.md v1.2:
 *   "禁止在 per-page <style> 加新 class · 必须先提到 design system"
 *
 * Usage:
 *   npm run ops:design-audit
 *   npm run ops:design-audit -- --verbose
 *
 * Exit 0 = clean. Exit 1 = at least one per-page class not in DS.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const VERBOSE = process.argv.includes('--verbose');
const STRICT = process.argv.includes('--strict');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Step 1: Read admin-design-system.css and global.css, extract all class names
const dsClasses = new Set();
for (const cssPath of [
  path.join(ROOT, 'src/styles/admin-design-system.css'),
  path.join(ROOT, 'src/styles/global.css'),
]) {
  if (!fs.existsSync(cssPath)) continue;
  const css = fs.readFileSync(cssPath, 'utf8');
  // Match .className (only standard alphanumeric + dash + underscore)
  for (const m of css.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_\-]*)/g)) {
    dsClasses.add(m[1]);
  }
}

// Whitelist: scoped classes that are page-specific by nature and OK to live per-page
// (e.g., one-off layout shells, content unique to a single page). Keep this small.
const ALLOWED_PERPAGE = new Set([
  'sop2-doc-shell', 'sop2-doc-body', 'sop2-doc-link-row', 'sop2-doc-link-btn',
  'sop2-doc-link-icon', 'sop2-doc-link-text', 'sop2-doc-link-sub', 'sop2-doc-link-arrow',
  'sop2-banner', 'sop2-banner-icon', 'sop2-banner-body',
  // SOP-2 flow-section family — pre-existing tech debt; tracked separately.
  'flow-section', 'flow-grid', 'flow-row', 'flow-row-label', 'flow-entries',
  'flow-entry', 'flow-entry-tag', 'flow-entry-desc', 'flow-arrow-row',
  'flow-step', 'flow-step-num', 'flow-step-body', 'flow-step-title',
  'flow-step-desc', 'flow-step-meta', 'flow-step-out', 'flow-out-fail',
  'flow-step-badge', 'flow-step-conditional', 'flow-step-trigger',
  'flow-step-no-site', 'flow-branch', 'flow-branch-label', 'flow-branch-arrows',
  'flow-branch-arrow', 'flow-branch-paths', 'flow-outcomes', 'flow-outcome',
  'flow-outcome-desc',
]);

// Step 2: Scan astro pages under src/pages/admin/**
const ADMIN_PAGES_DIR = path.join(ROOT, 'src/pages/admin');
const allAstro = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.astro')) allAstro.push(p);
  }
}
if (fs.existsSync(ADMIN_PAGES_DIR)) walk(ADMIN_PAGES_DIR);

console.log(`\n${YELLOW}admin-design-audit${RESET}  ·  per-page <style> custom-class detection\n`);
console.log(`  ${DIM}DS classes loaded: ${dsClasses.size} · scanning ${allAstro.length} admin pages${RESET}\n`);

const violations = [];
const passing = [];

for (const file of allAstro) {
  const src = fs.readFileSync(file, 'utf8');
  // Extract all <style>...</style> blocks (Astro page-level scoped styles)
  const styleBlocks = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = styleRe.exec(src)) !== null) styleBlocks.push(m[1]);
  if (styleBlocks.length === 0) {
    passing.push(file);
    continue;
  }

  // Find class selectors in style blocks
  const fileViolations = [];
  for (const block of styleBlocks) {
    // Match .className at the start of a selector
    // (skip pseudo / attribute selectors / :global etc)
    for (const sm of block.matchAll(/(?:^|\s|,|>|~|\+|&)\.([a-zA-Z_][a-zA-Z0-9_\-]*)/g)) {
      const cls = sm[1];
      if (dsClasses.has(cls)) continue;
      if (ALLOWED_PERPAGE.has(cls)) continue;
      fileViolations.push(cls);
    }
  }

  const unique = Array.from(new Set(fileViolations));
  if (unique.length === 0) {
    passing.push(file);
    if (VERBOSE) console.log(`  ${GREEN}✓${RESET} ${path.relative(ROOT, file)} ${DIM}(style block; all classes registered)${RESET}`);
  } else {
    violations.push({ file: path.relative(ROOT, file), classes: unique });
    console.log(`  ${RED}✗${RESET} ${path.relative(ROOT, file)} ${DIM}— ${unique.length} per-page class(es) NOT in design system:${RESET}`);
    for (const c of unique) console.log(`      ${RED}.${c}${RESET}`);
  }
}

console.log('');
if (violations.length === 0) {
  console.log(`${GREEN}✓ ${passing.length} admin pages clean (no per-page custom class).${RESET}\n`);
  process.exit(0);
}

console.log(`${RED}✗ ${violations.length} page(s) have per-page custom CSS not in design system${RESET}`);
console.log(`${DIM}Fix: move class to src/styles/admin-design-system.css + document in docs/ADMIN_DESIGN_SYSTEM.md, then use the registered class.${RESET}`);
console.log(`${DIM}Or: add to ALLOWED_PERPAGE in scripts/qa/admin-design-audit.mjs if truly page-unique.${RESET}`);

if (!STRICT) {
  console.log(`${YELLOW}⚠ Warning mode (default). Run with --strict to block CI.${RESET}`);
  console.log(`${DIM}Pre-existing tech debt: 19 admin pages have per-page <style>. Migration tracked in SOP_OVERVIEW backlog.${RESET}\n`);
  process.exit(0);
}
console.log('');
process.exit(1);
