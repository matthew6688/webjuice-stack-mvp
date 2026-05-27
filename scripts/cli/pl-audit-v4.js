#!/usr/bin/env node
/**
 * pl:audit-v4 · EXPERIMENTAL BRAND-CONTRACT AUDIT
 *
 * ⚠️  NOT A SHIP GATE (per codex audit 2026-05-28).
 * Composite scores from this CLI are misleading because T3/T4/T5 are
 * stubs (return null) and T1 is partial (4/13 ADR checks ported).
 * The composite renormalises around firing tiers, which means PASS labels
 * read as success when they only verify what's deterministic.
 *
 * Use this for:
 *   - brand contract compliance (T2 · is brand-tokens.css actually driving design)
 *   - quick deterministic smoke test before LLM tiers come online
 *
 * Do NOT use this for:
 *   - production ship/no-ship decisions (use docs/v3/SOP-AUDIT-STANDARD v3 + pl-audit-tier instead)
 *   - composite quality scoring (T3/T4/T5 still stubbed)
 *
 * Status: experimental · 2026-05-28
 * Tiers actually firing:
 *   T1 · Hard mechanical    (PASS/FAIL · deterministic · 0 LLM)        [PARTIAL 4/13]
 *   T2 · Brand contract     (0-100 · deterministic · 0 LLM)            [WIRED]
 *   T3 · Vision audit       (0-100 · LLM · ~$0.05/page)                [STUB]
 *   T4 · Designer review    (0-100 · LLM · ~$0.10/page)                [STUB]
 *   T5 · Creative-director  (0-100 · LLM · ~$0.15/page · premium-only) [STUB]
 *
 * Spec:  docs/v3/ADR-AUDIT-V4.md
 *
 * Usage:
 *   pl:audit-v4 --slug <slug>              # full T1-T4 (default tier=full)
 *   pl:audit-v4 --site <html-file>         # single HTML · no slug context
 *   pl:audit-v4 --tier T1   --slug <slug>  # only T1
 *   pl:audit-v4 --tier fast --slug <slug>  # T1+T2 (no LLM · $0)
 *   pl:audit-v4 --tier full                # T1-T4 (default · designer review on)
 *   pl:audit-v4 --tier premium             # T1-T5 (includes creative-director)
 *   pl:audit-v4 --json                     # stdout JSON · no file outputs
 *   pl:audit-v4 --report                   # write audit-v4-report.html
 *   pl:audit-v4 --help
 *
 * Deliberately does NOT modify pl-audit-tier.js. v4 is additive (ADR §8).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REPO = process.cwd();
const SCRIPT_VERSION = 'pl-audit-v4/0.1.0-skeleton';

// ─── Args ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { a.help = true; continue; }
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { a[key] = true; }
      else { a[key] = next; i++; }
    }
  }
  return a;
}
const args = parseArgs(process.argv);

if (args.help) {
  console.log(`pl:audit-v4 · EXPERIMENTAL brand-contract audit (ADR-AUDIT-V4.md)

⚠️  NOT A SHIP GATE · T3/T4/T5 stubbed · T1 partial (4/13 checks).
   For production ship/no-ship use pl:audit-tier (v3 · SOP-AUDIT-STANDARD).


Usage:
  pl:audit-v4 --slug <slug> [--tier fast|full|premium]
  pl:audit-v4 --site <html-file> [--tier T1|T2|fast|full|premium]
  pl:audit-v4 --json                  output JSON to stdout
  pl:audit-v4 --report                write audit-v4-report.html

Tiers:
  T1       Hard mechanical PASS/FAIL only (~50ms · $0)
  T2       Brand contract score only (~100ms · $0)
  fast     T1 + T2 only · no LLM       (~150ms · $0)
  full     T1 + T2 + T3 + T4           (~2min · ~$0.15/page) [default]
  premium  T1 + T2 + T3 + T4 + T5      (~3min · ~$0.30/page)

Status: skeleton (T1+T2 wired · T3/T4/T5 stubbed with TODO markers).
`);
  process.exit(0);
}

// ─── Inputs / outputs ────────────────────────────────────────────────────
const TIER = (args.tier || 'full').toLowerCase();
const VALID_TIERS = new Set(['t1', 't2', 'fast', 'full', 'premium']);
if (!VALID_TIERS.has(TIER)) {
  console.error(`Invalid --tier "${args.tier}" · expected one of: T1, T2, fast, full, premium`);
  process.exit(2);
}

function resolveInputs() {
  if (args.site) {
    const sitePath = path.resolve(args.site);
    if (!fs.existsSync(sitePath)) { console.error(`--site not found: ${sitePath}`); process.exit(2); }
    return { mode: 'site', htmlFiles: [sitePath], slug: null, facts: {}, outputDir: path.dirname(sitePath) };
  }
  if (!args.slug) { console.error(`Must supply --slug <slug> or --site <html-file>. Use --help.`); process.exit(2); }
  const slug = args.slug;
  // Try common output dirs in priority order
  const candidates = [
    args['output-dir'],
    `clients/${slug}/v2/od-output-c`,
    `clients/${slug}/v2/od-output`,
    `clients/${slug}/v2/output`,
    `templates/roofing/brand-grid-experiment/${slug}/editorial`,
  ].filter(Boolean);
  let outputDir = null;
  for (const c of candidates) {
    const abs = path.resolve(REPO, c);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) { outputDir = abs; break; }
  }
  if (!outputDir) { console.error(`No output dir found for slug "${slug}". Looked: ${candidates.join(' · ')}`); process.exit(2); }

  // facts.json (optional · brand-grid-experiment may lack it)
  const factsCandidates = [
    `clients/${slug}/concept/open-design-seed/facts.json`,
    `clients/${slug}/v2/facts.json`,
  ];
  let facts = {};
  for (const fp of factsCandidates) {
    const abs = path.resolve(REPO, fp);
    if (fs.existsSync(abs)) { facts = JSON.parse(fs.readFileSync(abs, 'utf8')); break; }
  }

  // brand-spec.json (optional)
  const brandCandidates = [
    `clients/${slug}/v2/brand/brand-spec.json`,
    `clients/${slug}/concept/open-design-seed/brand-spec.json`,
  ];
  let brandSpec = null;
  for (const fp of brandCandidates) {
    const abs = path.resolve(REPO, fp);
    if (fs.existsSync(abs)) { brandSpec = JSON.parse(fs.readFileSync(abs, 'utf8')); break; }
  }

  const htmlFiles = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.html') && !f.includes('preview-old'))
    .map(f => path.join(outputDir, f));
  return { mode: 'slug', htmlFiles, slug, facts, brandSpec, outputDir };
}

const ctx = resolveInputs();

// ─── Helpers ─────────────────────────────────────────────────────────────
function readHtml(file) { return fs.readFileSync(file, 'utf8'); }
function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}
function seedFor(html) { return crypto.createHash('sha256').update(html).digest('hex').slice(0, 16); }

// ─── T1 · Hard mechanical (WIRED · subset of v3 + new v4 checks) ────────
function runT1Hard(htmlFiles, facts, ctx) {
  const checks = {};
  const fails = [];

  // 1.1 business_name present on every page (only when facts available)
  if (facts.business_name) {
    const hits = htmlFiles.map(f => readHtml(f).includes(facts.business_name) ? 1 : 0);
    checks['1.1_business_name'] = { pass: hits.every(h => h === 1), pages_with: hits.filter(h => h).length, total: htmlFiles.length };
    if (!checks['1.1_business_name'].pass) fails.push(`business_name "${facts.business_name}" missing on ${hits.filter(h => !h).length} page(s)`);
  }

  // 1.2 phone ≥1 per page (skeleton uses ≥1 not ≥3 to keep --site mode useful)
  if (facts.phone) {
    const phoneRe = new RegExp(facts.phone.replace(/[()+\s\-]/g, '\\s?').replace(/\d/g, '\\d'), 'g');
    const counts = htmlFiles.map(f => (readHtml(f).match(phoneRe) || []).length);
    const minHits = counts.filter(c => c >= 1).length;
    checks['1.2_phone_present'] = { pass: minHits === htmlFiles.length, per_page: counts };
    if (minHits !== htmlFiles.length) fails.push(`phone "${facts.phone}" absent from ${htmlFiles.length - minHits} page(s)`);
  }

  // 1.11 logo refs resolve (v4 NEW · checks img src="logos/*" files exist)
  const brokenLogos = [];
  for (const f of htmlFiles) {
    const html = readHtml(f);
    const refs = [...html.matchAll(/<img[^>]+src=["']([^"']*logos?\/[^"']+)["']/gi)].map(m => m[1]);
    for (const ref of refs) {
      if (ref.startsWith('http')) continue;
      const abs = path.resolve(path.dirname(f), ref);
      if (!fs.existsSync(abs)) brokenLogos.push({ page: path.basename(f), ref });
    }
  }
  checks['1.11_logo_refs_resolve'] = { pass: brokenLogos.length === 0, broken: brokenLogos.slice(0, 10) };
  if (brokenLogos.length > 0) fails.push(`${brokenLogos.length} broken logo refs (e.g. ${brokenLogos[0].ref} on ${brokenLogos[0].page})`);

  // 1.13 JSON-LD validity (v4 NEW)
  let jsonLdErrors = 0;
  for (const f of htmlFiles) {
    const html = readHtml(f);
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
    for (const b of blocks) {
      try { JSON.parse(b); } catch { jsonLdErrors++; }
    }
  }
  checks['1.13_jsonld_valid'] = { pass: jsonLdErrors === 0, parse_errors: jsonLdErrors };
  if (jsonLdErrors > 0) fails.push(`${jsonLdErrors} invalid JSON-LD block(s)`);

  // TODO (ADR §2.1): 1.3 address, 1.4 ABN, 1.5 state authority, 1.7b hours, 1.8 stats, 1.9 license — port from pl-audit-tier.js
  // TODO (ADR §2.1): 1.10 cross-client leak (batch-mode only · needs --slugs sibling list)
  // TODO (ADR §2.1): 1.12 4xx/5xx outbound link cache

  const pass = fails.length === 0;
  return { pass, checks, fails, composite: pass ? 100 : 0 };
}

// ─── T2 · Brand contract (WIRED · 5 dims · deterministic) ───────────────
function runT2BrandContract(htmlFiles, brandSpec, ctx) {
  const dims = {};

  // D2.1 var(--brand-*) coverage % — proxy: count var(--brand-*) refs vs unique color/bg declarations
  let varHits = 0, colorDecls = 0;
  for (const f of htmlFiles) {
    const html = readHtml(f);
    const styleBlocks = (html.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
    varHits += (styleBlocks.match(/var\(--brand-[a-z0-9_-]+\)/gi) || []).length;
    colorDecls += (styleBlocks.match(/(?:^|[\s;{])(?:color|background(?:-color)?|border-color|fill|stroke)\s*:/gi) || []).length;
  }
  const coveragePct = colorDecls > 0 ? Math.round(100 * varHits / colorDecls) : 0;
  // Linear: 60%+ = 100 · 25% = 0 (per ADR §2.2)
  const d21 = Math.max(0, Math.min(100, Math.round((coveragePct - 25) / (60 - 25) * 100)));
  dims['D2.1_var_brand_coverage'] = { score: d21, weight: 0.30, coverage_pct: coveragePct, var_hits: varHits, color_decls: colorDecls };

  // D2.2 Hardcoded hex count (non-grayscale only)
  const uniqueHex = new Set();
  for (const f of htmlFiles) {
    const html = readHtml(f);
    const styleBlocks = (html.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
    const hex = (styleBlocks.match(/#[0-9a-f]{3,8}\b/gi) || []).map(h => h.toLowerCase());
    for (const h of hex) {
      // Skip grayscale (R==G==B)
      const norm = h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
      if (norm.length >= 7) {
        const r = norm.slice(1, 3), g = norm.slice(3, 5), b = norm.slice(5, 7);
        if (r === g && g === b) continue;
      }
      uniqueHex.add(norm);
    }
  }
  const hexCount = uniqueHex.size;
  // Linear: ≤8 = 100 · ≥30 = 0
  const d22 = Math.max(0, Math.min(100, Math.round((30 - hexCount) / (30 - 8) * 100)));
  dims['D2.2_hardcoded_hex_count'] = { score: d22, weight: 0.25, unique_non_gray_hex: hexCount, sample: [...uniqueHex].slice(0, 10) };

  // D2.3 brand-spec primary_font compliance — TODO (needs computed CSS · skeleton: presence check only)
  let d23 = null;
  if (brandSpec?.typography?.primary_font || brandSpec?.primary_font) {
    const font = brandSpec.typography?.primary_font || brandSpec.primary_font;
    const fontName = String(font).split(',')[0].replace(/["']/g, '').trim();
    let pagesWithFont = 0;
    for (const f of htmlFiles) {
      if (readHtml(f).includes(fontName)) pagesWithFont++;
    }
    d23 = htmlFiles.length ? Math.round(100 * pagesWithFont / htmlFiles.length) : 0;
  }
  dims['D2.3_type_rule_compliance'] = { score: d23, weight: 0.15, note: d23 == null ? 'brand-spec has no primary_font · skipped' : null };

  // D2.4 logo variant per surface — TODO (heuristic: look for logo-light on dark sections etc · skeleton: stub)
  dims['D2.4_logo_variant_per_surface'] = { score: null, weight: 0.15, todo: 'detect surface lightness around each <img logos/*>' };

  // D2.5 brand palette honored
  let d25 = null;
  if (brandSpec?.colors) {
    const brandHex = [brandSpec.colors.brand_primary, brandSpec.colors.brand_accent, brandSpec.colors.brand_secondary]
      .filter(Boolean).map(h => h.toLowerCase());
    const cssBlob = htmlFiles.map(f => (readHtml(f).match(/<style[\s\S]*?<\/style>/g) || []).join('\n')).join('\n').toLowerCase();
    const found = brandHex.filter(h => cssBlob.includes(h));
    d25 = brandHex.length ? Math.round(100 * found.length / brandHex.length) : null;
    dims['D2.5_brand_palette_honored'] = { score: d25, weight: 0.15, expected: brandHex, found };
  } else {
    dims['D2.5_brand_palette_honored'] = { score: null, weight: 0.15, note: 'no brand-spec · skipped' };
  }

  // Weighted composite (only dims with score != null)
  let score = 0, totalWeight = 0;
  for (const v of Object.values(dims)) {
    if (v.score != null) { score += v.score * v.weight; totalWeight += v.weight; }
  }
  const finalScore = totalWeight > 0 ? Math.round(score / totalWeight) : 0;
  return { score: finalScore, breakdown: dims, total_weight: totalWeight };
}

// ─── T3 · Vision audit (STUB · LLM · ADR §2.3) ──────────────────────────
async function runT3VisionAudit(htmlFiles, ctx) {
  // TODO: call pl-audit-vision (existing v3 wrapper) with temp 0 + seed pinned
  // TODO: merge codex-deep-audit dims (D3.6) into single composite
  // TODO: structured-output JSON schema enforcement
  // TODO: log to audit-v4-trace.md (model · temp · seed · tokens · cost)
  return {
    score: null,
    dims: {
      'D3.1_layout': null, 'D3.2_typography': null, 'D3.3_color_hierarchy': null,
      'D3.4_readability': null, 'D3.5_image_text_balance': null,
      'D3.6_copy_depth': null, 'D3.7_chrome_consistency': null, 'D3.8_module_diversity': null,
    },
    llm_call_id: null, cost_usd: 0, model: null,
    status: 'stub',
    todo: 'wire pl-audit-vision + codex-deep-audit · pin model + temp 0 + seed',
  };
}

// ─── T4 · Designer review (STUB · LLM · ADR §2.4) ───────────────────────
async function runT4DesignerReview(htmlFiles, ctx) {
  // TODO: load /tmp/open-design/skills/plan-design-review prompt + design-review prompt
  // TODO: structured-output JSON schema {D4.1..D4.5: 0-10, ai_slop_markers: [...], ai_slop_score: 0-100}
  // TODO: render screenshots (puppeteer or playwright) for vision LLM input
  return {
    score: null,
    dims: { 'D4.1_philosophy': null, 'D4.2_hierarchy': null, 'D4.3_detail': null, 'D4.4_innovation': null, 'D4.5_function': null },
    ai_slop_markers: [], ai_slop_score: null,
    llm_call_id: null, cost_usd: 0, model: null,
    status: 'stub',
    todo: 'adapt OD plan-design-review prompt · render screenshots · enforce JSON schema',
  };
}

// ─── T5 · Creative-director (STUB · LLM · ADR §2.5 · premium-only) ──────
async function runT5CreativeDirector(htmlFiles, ctx) {
  // TODO: adapt /tmp/open-design/skills/creative-director prompt
  // TODO: 3-axis Cannes-calibrated (Idea · Cultural relevance · Craft) · 0-10 each
  // TODO: gated on T4 score ≥ 60 (otherwise return skipped)
  return {
    score: null,
    three_axis: { idea_originality: null, cultural_relevance: null, craft: null },
    llm_call_id: null, cost_usd: 0, model: null,
    status: 'stub',
    todo: 'adapt creative-director prompt · gate on T4≥60',
  };
}

// ─── Composite (ADR §3) ──────────────────────────────────────────────────
function composeFinalScore(tiers, opts = {}) {
  const { T1, T2, T3, T4, T5 } = tiers;
  if (!T1.pass) {
    return {
      composite: 0,
      ship_verdict: 'BLOCKED · T1 hard fail',
      grade: 'F',
      issues: collectIssues(tiers),
    };
  }

  // Per ADR §3 · weighted sum + lowest-tier floor term
  const t2s = T2?.score ?? null;
  const t3s = T3?.score ?? null;
  const t4s = T4?.score ?? null;
  const t5s = T5?.score ?? null;

  const known = [t2s, t3s, t4s].filter(s => s != null);
  if (known.length === 0) {
    return { composite: null, ship_verdict: 'INDETERMINATE · only T1 available', grade: '?', issues: collectIssues(tiers) };
  }

  // Renormalize weights against tiers that actually returned a score
  const W = { T2: 0.15, T3: 0.30, T4: 0.20, T5: 0.10, floor: 0.25 };
  let weighted = 0, totalW = 0;
  if (t2s != null) { weighted += t2s * W.T2; totalW += W.T2; }
  if (t3s != null) { weighted += t3s * W.T3; totalW += W.T3; }
  if (t4s != null) { weighted += t4s * W.T4; totalW += W.T4; }
  if (opts.includePremium && t5s != null) { weighted += t5s * W.T5; totalW += W.T5; }
  if (known.length) {
    weighted += Math.min(...known) * W.floor;
    totalW += W.floor;
  }
  const composite = totalW > 0 ? Math.round(weighted / totalW * 100) / 100 | 0 : null;

  // ⚠️  EXPERIMENTAL: any tier stub (T3/T4/T5 returns null) means composite is
  // partial · do NOT use as ship gate (per codex audit 2026-05-28).
  const tierStatuses = ['T1', 'T2', 'T3', 'T4', 'T5'].map(k => ({
    tier: k, status: tiers[k]?.status || (tiers[k] ? 'wired' : 'skipped'),
  }));
  const anyStub = tierStatuses.some(t => t.status === 'stub');

  let verdict, grade;
  if (anyStub) {
    grade = 'EXPERIMENTAL';
    verdict = 'EXPERIMENTAL · do not use as ship gate · T3/T4/T5 stubbed';
  } else if (composite >= 85) { grade = 'A'; verdict = 'SHIP'; }
  else if (composite >= 73) { grade = 'B'; verdict = 'SHIP'; }
  else if (composite >= 60) { grade = 'C'; verdict = 'FIX_LOOP'; }
  else { grade = 'D'; verdict = 'REJECT'; }

  // Hard gates (ADR §3)
  if (!anyStub && t2s != null && t2s < 70) verdict = verdict === 'SHIP' ? 'FIX_LOOP · T2<70' : verdict;
  if (!anyStub && t3s != null && t3s < 60) verdict = verdict === 'SHIP' ? 'FIX_LOOP · T3<60' : verdict;
  if (T4?.ai_slop_score != null && T4.ai_slop_score < 60) verdict = 'FIX_LOOP · ai_slop<60';

  return { composite, ship_verdict: verdict, grade, issues: collectIssues(tiers), tier_statuses: tierStatuses, experimental: anyStub };
}

function collectIssues(tiers) {
  // ADR §4 schema · skeleton emits T1+T2 issues; T3/T4/T5 issues land when those tiers wire up.
  const issues = [];
  let idCounter = 1;
  const nextId = () => `I-${String(idCounter++).padStart(3, '0')}`;

  for (const f of (tiers.T1?.fails || [])) {
    issues.push({
      id: nextId(), tier: 'T1', severity: 'P0', dim: 't1_hard', page: '<sitewide>',
      what: f,
      why: 'T1 hard fail · ship blocker (contract violation per ADR §2.1)',
      fix: 'See pl-audit-tier.js docs / SOP-AUDIT-STANDARD.md §1 for per-check remediation',
    });
  }
  if (tiers.T2?.score != null && tiers.T2.score < 80) {
    for (const [k, v] of Object.entries(tiers.T2.breakdown || {})) {
      if (v.score != null && v.score < 70) {
        issues.push({
          id: nextId(), tier: 'T2', severity: v.score < 50 ? 'P1' : 'P2', dim: k, page: '<sitewide>',
          what: `${k} = ${v.score} (threshold 70)`,
          why: 'Brand-contract token discipline below batch-quality bar (ADR §2.2)',
          fix: k.includes('var_brand_coverage')
            ? 'Replace hardcoded hex in <style> with var(--brand-primary) / var(--brand-accent). Target ≥60% coverage.'
            : k.includes('hardcoded_hex')
              ? 'Consolidate the unique hex palette; route through brand-spec.json tokens. Target ≤8 unique non-grayscale hex.'
              : 'See ADR-AUDIT-V4.md §2.2 for per-dim remediation',
        });
      }
    }
  }
  return issues;
}

// ─── Trace (ADR §5.2) ────────────────────────────────────────────────────
function buildTrace(tiers, ctx) {
  const lines = [];
  lines.push(`# Audit Run · ${ctx.slug || path.basename(ctx.htmlFiles[0])} · ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`- Script: ${SCRIPT_VERSION}`);
  lines.push(`- Tier: ${TIER}`);
  lines.push(`- Pages: ${ctx.htmlFiles.length}`);
  lines.push(`- Seed (sha256 of HTML[0]): ${ctx.htmlFiles[0] ? seedFor(fs.readFileSync(ctx.htmlFiles[0], 'utf8')) : 'n/a'}`);
  lines.push(``);
  lines.push(`## LLM calls`);
  lines.push(``);
  lines.push(`| Tier | Status | Model | Temp | Cost (USD) |`);
  lines.push(`|---|---|---|---|---|`);
  for (const t of ['T3', 'T4', 'T5']) {
    const x = tiers[t];
    if (!x) continue;
    lines.push(`| ${t} | ${x.status || 'ok'} | ${x.model || '—'} | 0.0 | $${(x.cost_usd || 0).toFixed(4)} |`);
  }
  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────────────────────
async function main() {
  const tiers = {};
  const runT1 = TIER === 't1' || TIER === 't2' || TIER === 'fast' || TIER === 'full' || TIER === 'premium';
  const runT2 = TIER === 't2' || TIER === 'fast' || TIER === 'full' || TIER === 'premium';
  const runT3 = TIER === 'full' || TIER === 'premium';
  const runT4 = TIER === 'full' || TIER === 'premium';
  const runT5 = TIER === 'premium';

  if (runT1) tiers.T1 = runT1Hard(ctx.htmlFiles, ctx.facts || {}, ctx);
  if (runT2) tiers.T2 = runT2BrandContract(ctx.htmlFiles, ctx.brandSpec, ctx);
  if (runT3) tiers.T3 = await runT3VisionAudit(ctx.htmlFiles, ctx);
  if (runT4) tiers.T4 = await runT4DesignerReview(ctx.htmlFiles, ctx);
  if (runT5) tiers.T5 = await runT5CreativeDirector(ctx.htmlFiles, ctx);

  const final = composeFinalScore(tiers, { includePremium: TIER === 'premium' });

  const report = {
    schema_version: 'audit-v4/0.1',
    script_version: SCRIPT_VERSION,
    slug: ctx.slug,
    mode: ctx.mode,
    output_dir: ctx.outputDir,
    tier: TIER,
    pages_audited: ctx.htmlFiles.length,
    generated_at: new Date().toISOString(),
    tier_1: tiers.T1 || null,
    tier_2: tiers.T2 || null,
    tier_3: tiers.T3 || null,
    tier_4: tiers.T4 || null,
    tier_5: tiers.T5 || null,
    composite: final.composite,
    grade: final.grade,
    ship_verdict: final.ship_verdict,
    issues: final.issues,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Write file outputs (unless --site mode without --report)
  const outDir = ctx.outputDir;
  fs.writeFileSync(path.join(outDir, 'audit-v4-summary.json'), JSON.stringify({
    slug: report.slug, tier: TIER, composite: report.composite, grade: report.grade,
    ship_verdict: report.ship_verdict, generated_at: report.generated_at,
  }, null, 2));
  fs.writeFileSync(path.join(outDir, 'audit-v4-issues.json'), JSON.stringify({
    schema_version: 'audit-v4-issues/1', slug: report.slug, issues: report.issues,
    summary: {
      P0: report.issues.filter(i => i.severity === 'P0').length,
      P1: report.issues.filter(i => i.severity === 'P1').length,
      P2: report.issues.filter(i => i.severity === 'P2').length,
      total: report.issues.length,
    },
  }, null, 2));
  fs.writeFileSync(path.join(outDir, 'audit-v4-trace.md'), buildTrace(tiers, ctx));
  fs.writeFileSync(path.join(outDir, 'audit-v4-full.json'), JSON.stringify(report, null, 2));

  if (args.report) {
    // TODO (ADR §5.1): render OD-style customer-facing HTML
    fs.writeFileSync(path.join(outDir, 'audit-v4-report.html'),
      `<!doctype html><meta charset=utf-8><title>Audit v4 · ${report.slug || 'site'}</title>` +
      `<h1>Audit v4 · ${report.slug || 'site'}</h1>` +
      `<p>Composite: ${report.composite ?? 'n/a'} · Grade: ${report.grade} · ${report.ship_verdict}</p>` +
      `<pre>${JSON.stringify(report, null, 2)}</pre>`);
  }

  console.log(`\n[audit-v4] DONE · tier=${TIER} · pages=${ctx.htmlFiles.length}`);
  if (tiers.T1) console.log(`  T1: ${tiers.T1.pass ? 'PASS' : 'FAIL'} (${tiers.T1.fails.length} fails)`);
  if (tiers.T2) console.log(`  T2: ${tiers.T2.score}/100 (brand contract)`);
  if (tiers.T3) console.log(`  T3: ${tiers.T3.score ?? 'stub'}/100 (vision)`);
  if (tiers.T4) console.log(`  T4: ${tiers.T4.score ?? 'stub'}/100 (designer)`);
  if (tiers.T5) console.log(`  T5: ${tiers.T5.score ?? 'stub'}/100 (creative director)`);
  console.log(`  Composite: ${report.composite ?? 'n/a'} · Grade: ${report.grade} · Verdict: ${report.ship_verdict}`);
  console.log(`  → ${path.join(outDir, 'audit-v4-full.json')}`);
  console.log(`  → ${path.join(outDir, 'audit-v4-issues.json')}`);
}

main().catch(e => { console.error('[audit-v4] error:', e); process.exit(1); });
