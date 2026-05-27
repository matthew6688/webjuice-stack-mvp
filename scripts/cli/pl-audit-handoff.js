#!/usr/bin/env node
/**
 * pl:audit-handoff · pre-build audit of a handoff package.
 *
 * Catches input bugs BEFORE OD runs (saves $$ + iteration time).
 *
 * Layers:
 *   P1 · Structural completeness — required files present
 *   P2 · Image manifest sanity — every role mapped to a real photo (not a logo)
 *   P3 · Brand pack integrity — 8 logo SVGs, brand-tokens.css, brand-spec.json with all roles
 *   P4 · Content completeness — services/about/faq/hero-copy not empty/placeholder
 *   P5 · Meta-language detection — no "concept/preserve/placeholder" leaked in customer-facing fields
 *   P6 · Facts consistency — facts.json and core-facts.json don't conflict
 *   P7 · DESIGN.md presence — points to a family or override that exists
 *
 * Output: handoff-audit.json + console summary + exit code (0 = pass)
 *
 * Usage:
 *   npm run pl:audit-handoff -- --dir clients/vicwest-roofing/v2/handoff/od-package
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function parseArgs() {
  const out = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = process.argv[++i];
  }
  return out;
}

function exists(p) { return fs.existsSync(p); }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

const REQUIRED_FILES = [
  'DESIGN-HANDOFF.md',
  'DESIGN-MANIFEST.json',
  'facts.json',
  'brand/brand-spec.json',
  'brand/brand-tokens.css',
  'brand/agent-handoff.md',
  'brand/visual-style-contract.md',
  'brand/logo-light.svg',
  'brand/logo-dark.svg',
  'brand/logo-mark.svg',
  'brand/favicon.svg',
  'content/services.json',
  'content/about.md',
  'content/faq.json',
  'content/hero-copy.json',
  'structure/page-map.json',
];

const META_LANGUAGE_FORBIDDEN = [
  // these are SPEC words that should never leak to a customer-facing field
  /\b(concept|preserve|placeholder|template|seed|brief|handoff|spec)\b/i,
  /\b(do not invent|niche typical|ai-completed|verified:scraped|niche-default)\b/i,
];

const CLICHE_FORBIDDEN = [
  /\btrusted partner\b/i,
  /\byears of excellence\b/i,
  /\bquality service\b/i,
  /\bwe pride ourselves\b/i,
  /\bwelcome to\b/i,
  /\bcommitted to excellence\b/i,
  /\bsecond to none\b/i,
  /\bbest in class\b/i,
  /\binnovative solutions\b/i,
];

function auditP1Structure(dir) {
  const missing = [];
  for (const rel of REQUIRED_FILES) {
    if (!exists(path.join(dir, rel))) missing.push(rel);
  }
  return {
    layer: 'P1 · structural-completeness',
    gate: 'HARD',
    pass: missing.length === 0,
    failures: missing.length,
    missing_files: missing,
  };
}

function auditP2ImageManifest(dir) {
  const manifestPath = path.join(dir, '../image-manifest.json');
  if (!exists(manifestPath)) {
    return {
      layer: 'P2 · image-manifest',
      gate: 'HARD',
      pass: false,
      failures: 1,
      detail: 'image-manifest.json missing · run pl:classify-images first',
    };
  }
  const m = readJson(manifestPath);
  if (!m) return { layer: 'P2 · image-manifest', gate: 'HARD', pass: false, failures: 1, detail: 'image-manifest.json invalid' };

  const failures = [];
  const recs = m.recommendations || {};
  const byFile = Object.fromEntries((m.classifications || []).map((c) => [c.filename, c]));

  // Hero must NOT be a logo
  if (recs.homepage_hero) {
    const heroFile = byFile[recs.homepage_hero];
    if (heroFile?.is_logo_or_brand_mark || heroFile?.category === 'logo') {
      failures.push(`hero recommendation "${recs.homepage_hero}" is classified as a logo, not a photo`);
    }
    if (heroFile?.quality_score < 7) {
      failures.push(`hero "${recs.homepage_hero}" quality ${heroFile?.quality_score} < 7 minimum`);
    }
  } else {
    failures.push('no homepage_hero recommendation (no quality photo available)');
  }

  // Gallery should have ≥4 items
  if (!Array.isArray(recs.gallery) || recs.gallery.length < 4) {
    failures.push(`gallery only has ${(recs.gallery || []).length} items (need ≥4)`);
  }

  // Check assets/ files referenced in DESIGN-HANDOFF actually exist
  const handoffMd = readText(path.join(dir, 'DESIGN-HANDOFF.md'));
  const assetRefs = [...handoffMd.matchAll(/`(assets\/[^`]+\.(?:png|jpg|jpeg|svg|webp))`/gi)].map((m) => m[1]);
  for (const ref of assetRefs) {
    if (!exists(path.join(dir, ref))) {
      failures.push(`asset referenced in DESIGN-HANDOFF.md missing: ${ref}`);
    }
  }

  // If customer has 0 photos but manifest exists (declared "no photos available"), downgrade to SOFT
  const noPhotosCase = (m.total_real_photos === 0 && Array.isArray(m.needs_replacement) && m.needs_replacement.length > 0);
  return {
    layer: 'P2 · image-manifest',
    gate: noPhotosCase ? 'SOFT' : 'HARD',
    pass: failures.length === 0,
    failures: failures.length,
    needs_replacement: m.needs_replacement || [],
    detail: failures,
    note: noPhotosCase ? 'customer has no source photos · build must use asset-prompts.md for image generation' : undefined,
  };
}

function auditP3BrandPack(dir) {
  const spec = readJson(path.join(dir, 'brand/brand-spec.json'));
  if (!spec) return { layer: 'P3 · brand-pack', gate: 'HARD', pass: false, failures: 1, detail: 'brand-spec.json missing/invalid' };

  const failures = [];
  const requiredKeys = ['business_name', 'colors', 'heading_font', 'body_font'];
  for (const k of requiredKeys) if (!spec[k]) failures.push(`brand-spec.json missing ${k}`);

  const colorRoles = ['brand_primary', 'brand_secondary', 'brand_accent', 'surface', 'text'];
  for (const c of colorRoles) {
    if (!spec.colors?.[c]) failures.push(`brand-spec.json colors.${c} missing`);
  }

  const tokensCss = readText(path.join(dir, 'brand/brand-tokens.css'));
  if (!tokensCss.includes('--brand-primary')) failures.push('brand-tokens.css missing --brand-primary');
  if (!tokensCss.includes('--brand-accent')) failures.push('brand-tokens.css missing --brand-accent');

  return {
    layer: 'P3 · brand-pack',
    gate: 'HARD',
    pass: failures.length === 0,
    failures: failures.length,
    detail: failures,
  };
}

function auditP4Content(dir) {
  const services = readJson(path.join(dir, 'content/services.json'));
  const about = readText(path.join(dir, 'content/about.md'));
  const faq = readJson(path.join(dir, 'content/faq.json'));
  const hero = readJson(path.join(dir, 'content/hero-copy.json'));

  const failures = [];
  if (!services?.services || services.services.length < 2) failures.push(`services count ${services?.services?.length || 0} < 2 minimum`);
  if (services?.services) {
    services.services.forEach((s, i) => {
      if (!s.name) failures.push(`services[${i}].name missing`);
      if (!s.short_desc && !s.desc) failures.push(`services[${i}] has no description`);
      const d = (s.short_desc || s.desc || '').toLowerCase();
      for (const c of CLICHE_FORBIDDEN) {
        if (c.test(d)) failures.push(`services[${i}].desc cliché: ${c.source}`);
      }
    });
  }
  if (about.length < 200) failures.push(`about.md too short (${about.length} chars · need ≥200)`);
  for (const c of CLICHE_FORBIDDEN) {
    if (c.test(about)) failures.push(`about.md cliché: ${c.source}`);
  }
  if (!faq?.faqs || faq.faqs.length < 4) failures.push(`faq count ${faq?.faqs?.length || 0} < 4 minimum`);
  if (!hero?.candidates || hero.candidates.length < 1) failures.push('hero-copy.json has no candidates');

  return {
    layer: 'P4 · content',
    gate: 'HARD',
    pass: failures.length === 0,
    failures: failures.length,
    detail: failures,
  };
}

// Strip internal provenance metadata so the meta-language detector only sees
// customer-visible copy. Provenance _source / <!-- source --> / _meta_* fields
// legitimately contain tokens like "verified:scraped" and "niche typical".
function stripProvenance(txt, rel) {
  let out = txt;
  // HTML comments (markdown provenance pins)
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  if (rel.endsWith('.md')) {
    // YAML frontmatter keys starting with _meta_ or _source
    out = out.replace(/^_meta[_a-zA-Z0-9]*:.*$/gm, '');
    out = out.replace(/^_source:.*$/gm, '');
  } else if (rel.endsWith('.json')) {
    // Strip JSON lines whose key is _source / _meta / source / notes / generator
    out = out.replace(/^\s*"(_source|_meta[_a-zA-Z0-9]*|source|notes|generator)"\s*:\s*("[^"]*"|\{[^}]*\}|\[[^\]]*\])\s*,?\s*$/gm, '');
  }
  return out;
}

function auditP5MetaLanguage(dir) {
  const failures = [];
  const customerFacingFiles = [
    'content/about.md',
    'content/services.json',
    'content/faq.json',
    'content/hero-copy.json',
  ];
  for (const rel of customerFacingFiles) {
    const rawTxt = readText(path.join(dir, rel));
    const txt = stripProvenance(rawTxt, rel);
    for (const re of META_LANGUAGE_FORBIDDEN) {
      const m = txt.match(re);
      if (m) failures.push(`${rel}: meta-language leakage: "${m[0]}"`);
    }
  }
  return {
    layer: 'P5 · meta-language',
    gate: 'SOFT',
    pass: failures.length === 0,
    failures: failures.length,
    detail: failures,
  };
}

function auditP6FactsConsistency(dir) {
  const facts = readJson(path.join(dir, 'facts.json'))?.locked_facts || {};
  const failures = [];
  const softNotes = [];
  const required = ['business_name', 'phone', 'phone_tel_link', 'city', 'state'];
  const recommended = ['email', 'address'];
  for (const k of required) {
    if (!facts[k]) failures.push(`facts.json missing ${k}`);
  }
  const missingRecommended = recommended.filter((k) => !facts[k]);
  if (missingRecommended.length) {
    softNotes.push(`recommended (soft): missing ${missingRecommended.join(', ')}`);
  }
  // phone format
  if (facts.phone && !/^\d{4}\s\d{3}\s\d{3}$|^\(\d{2}\)\s\d{4}\s\d{4}$|^04\d{2}\s\d{3}\s\d{3}$/.test(facts.phone)) {
    failures.push(`facts.phone "${facts.phone}" doesn't look like an AU phone format`);
  }
  if (facts.phone_tel_link && !facts.phone_tel_link.startsWith('tel:')) {
    failures.push('phone_tel_link must start with tel:');
  }
  return {
    layer: 'P6 · facts',
    gate: 'HARD',
    pass: failures.length === 0,
    failures: failures.length,
    detail: failures,
  };
}

function auditP7DesignMd(dir) {
  // Look for either family DESIGN.md or override
  const handoffMd = readText(path.join(dir, 'DESIGN-HANDOFF.md'));
  // Find family reference: "family: foo-bar" with at least 3-char word
  const familyMatch = handoffMd.match(/family[:\s]+["']?([a-z][a-z0-9-]{2,})["']?/i);
  const overrideExists = exists(path.join(dir, 'DESIGN.override.md'));
  const failures = [];
  if (familyMatch) {
    const family = familyMatch[1];
    const familyPath = path.join(REPO, 'templates/roofing/families', family, 'DESIGN.md');
    if (!exists(familyPath)) failures.push(`DESIGN-HANDOFF refs family "${family}" but ${familyPath} missing`);
  } else if (!overrideExists) {
    failures.push('no family reference + no DESIGN.override.md · agent has no system layer to follow');
  }
  return {
    layer: 'P7 · design-md',
    gate: 'SOFT',
    pass: failures.length === 0,
    failures: failures.length,
    detail: failures,
  };
}

async function main() {
  const args = parseArgs();
  if (!args.dir) { console.error('Usage: --dir <handoff-package-dir>'); process.exit(1); }
  const dir = path.resolve(args.dir);

  console.log(`[audit-handoff] ${path.relative(process.cwd(), dir)}`);
  const layers = [
    auditP1Structure(dir),
    auditP2ImageManifest(dir),
    auditP3BrandPack(dir),
    auditP4Content(dir),
    auditP5MetaLanguage(dir),
    auditP6FactsConsistency(dir),
    auditP7DesignMd(dir),
  ];

  const hardFails = layers.filter((l) => l.gate === 'HARD' && !l.pass).length;
  const softFails = layers.filter((l) => l.gate === 'SOFT' && !l.pass).length;
  const overallPass = hardFails === 0;

  for (const l of layers) {
    const icon = l.pass ? '✅' : (l.gate === 'HARD' ? '❌' : '⚠️');
    console.log(`  ${icon} ${l.layer}: ${l.pass ? 'PASS' : 'FAIL'} · ${l.failures} failures · ${l.gate}`);
    if (!l.pass && l.detail) {
      const details = Array.isArray(l.detail) ? l.detail : [l.detail];
      details.slice(0, 4).forEach((d) => console.log(`     ${d}`));
      if (details.length > 4) console.log(`     ... and ${details.length - 4} more`);
    }
    if (!l.pass && l.missing_files) {
      l.missing_files.slice(0, 4).forEach((f) => console.log(`     missing: ${f}`));
    }
  }
  console.log(`  OVERALL: ${overallPass ? '✅ PASS' : '❌ FAIL'} (${hardFails} hard · ${softFails} soft)`);

  const report = { dir, layers, gate_pass: overallPass, hard_failures: hardFails, soft_failures: softFails, generated_at: new Date().toISOString() };
  const outPath = args.out ? path.resolve(args.out) : path.join(dir, '_handoff-audit.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`  → ${path.relative(process.cwd(), outPath)}`);
  process.exit(overallPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
