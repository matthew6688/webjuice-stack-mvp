#!/usr/bin/env node
/**
 * pl:audit-vision · 10-dimension vision audit of a built website directory.
 *
 * Pipeline:
 *   1. Screenshot home + 2 sample inner pages at desktop (1440) + mobile (390)
 *   2. Send each screenshot to claude-sonnet-4-5 vision with 10-dim rubric
 *   3. Run cross-page header/footer DOM consistency check (no vision · pure HTML)
 *   4. Compute composite 0-100 score
 *
 * 10 dimensions (0-10 each, total /100):
 *   D1 · Core info accuracy (phone/business/state visible)
 *   D2 · Logo + brand consistency (right variant per surface, colors match)
 *   D3 · Copy quality (no clichés, specific numbers, no meta-language)
 *   D4 · Header consistency cross-page
 *   D5 · Footer consistency cross-page
 *   D6 · Hero quality (real photo, CTA visible, not logo)
 *   D7 · Page section modules (sensible order + clear boundaries)
 *   D8 · Design language coherence (typography + spacing + radii consistent)
 *   D9 · Image quality (no broken, no stock-feel, on-brand)
 *   D10 · Audit-fix integration (old-site issues solved · phone-above-fold etc.)
 *
 * Output: vision-audit.json with per-dim score + composite + per-page findings
 *
 * Usage:
 *   npm run pl:audit-vision -- --dir clients/vicwest-roofing/v2/od-output-a --facts <facts.json> --findings <findings.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runTask } from '../../core/autoresearch/llm-cascade.js';

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

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

function findHtmlFiles(dir) {
  const out = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'shared' || e.name === 'reference-site' || e.name === '_audit-screenshots' || e.name === 'brand') continue;
      const fp = path.join(d, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.isFile() && e.name.endsWith('.html')) out.push(fp);
    }
  }
  walk(dir);
  return out;
}

function pickSamplePages(htmlFiles, dir) {
  const home = htmlFiles.find((f) => path.basename(f) === 'index.html');
  const about = htmlFiles.find((f) => /about/i.test(path.basename(f)));
  const service = htmlFiles.find((f) => /service|roof-rep|gutter|storm/i.test(path.basename(f)) && path.basename(f) !== 'services.html') || htmlFiles.find((f) => /service/i.test(path.basename(f)));
  return [home, about, service].filter(Boolean).slice(0, 3);
}

// Lazy-load playwright (avoids cost when not needed)
let _chromium = null;
async function getChromium() {
  if (_chromium) return _chromium;
  const pw = await import('playwright');
  _chromium = pw.chromium;
  return _chromium;
}

let _browser = null;
async function getBrowser() {
  if (_browser) return _browser;
  const chromium = await getChromium();
  _browser = await chromium.launch();
  return _browser;
}

async function screenshotPage({ filePath, outDir, viewport, name }) {
  const browser = await getBrowser();
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  try {
    await page.goto('file://' + filePath, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(500); // settle
    // Above-fold screenshot (for hero/header scoring)
    await page.screenshot({ path: path.join(outDir, name + '-fold.png'), fullPage: false });
    // Full-page screenshot (reference archive — too tall for vision API on long pages)
    await page.screenshot({ path: path.join(outDir, name + '-full.png'), fullPage: true });
    // Page overview (capped at 3000px) — shows 2-3 sections; better for D7/D8 than full-page
    try {
      const fullH = await page.evaluate(() => document.body.scrollHeight);
      const overviewH = Math.min(fullH, 3000);
      await page.screenshot({ path: path.join(outDir, name + '-overview.png'), clip: { x: 0, y: 0, width: viewport.width, height: overviewH } });
    } catch (_e) { /* overview is best-effort */ }
    // Footer screenshot — scroll to bottom so vision AI can score D5 correctly
    // Desktop full-page screenshots are often 12,000px+ tall; footer compresses to invisible
    try {
      const footer = page.locator('footer, [role="contentinfo"]').first();
      if (await footer.count() > 0) {
        await footer.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(outDir, name + '-footer.png'), fullPage: false });
      }
    } catch (_e) { /* footer screenshot is best-effort */ }
  } catch (e) {
    console.error(`    screenshot fail ${name}: ${e.message}`);
  } finally {
    await ctx.close();
  }
}

const RUBRIC_PROMPT = (facts, page) => `You are auditing a built website page for a local Australian roofing business. Score 10 dimensions, 0-10 each.

# Business facts (verbatim required)

- Business: ${facts.business_name}
- Phone: ${facts.phone} (tel: ${facts.phone_tel_link})
- Email: ${facts.email}
- City: ${facts.city}, ${facts.state}
- Licensing: ${facts.licensing_authority}

# Page context

- File: ${page.file}
- Viewport: ${page.viewport}

# Score each dimension 0-10

Return STRICT JSON ONLY (no markdown fence, no prose):

\`\`\`json
{
  "scores": {
    "D1_core_info_accuracy": <0-10>,
    "D2_logo_brand_consistency": <0-10>,
    "D3_copy_quality": <0-10>,
    "D4_header_quality": <0-10>,
    "D5_footer_quality": <0-10>,
    "D6_hero_quality": <0-10>,
    "D7_section_modules": <0-10>,
    "D8_design_language": <0-10>,
    "D9_image_quality": <0-10>,
    "D10_audit_fix_integration": <0-10>
  },
  "evidence": {
    "D1": "<one-sentence evidence cited from screenshot>",
    "D2": "...",
    "D3": "...",
    "D4": "...",
    "D5": "...",
    "D6": "...",
    "D7": "...",
    "D8": "...",
    "D9": "...",
    "D10": "..."
  },
  "biggest_problems": ["<problem 1>", "<problem 2>", "<problem 3>"],
  "fix_priorities": ["<one specific fix>", "<one specific fix>"]
}
\`\`\`

Scoring rules:
- D1: 10 if phone+business+city visible. 5 if only some. 0 if none visible.
- D2: 10 if logo correct variant + brand colors match expected. 0 if logo as hero or wrong colors as primary CTA.
- D3: 10 if specific (numbers, named warranties). 4 if generic ("trusted partner", "quality service"). 0 if meta-language ("concept", "preserve", "placeholder").
- D4/D5: 10 if header/footer present + complete. 5 if partial. 0 if absent.
- D6: 10 if real outdoor roof photo. 5 if generic. 0 if logo-as-hero or no image.
- D7: 10 if clear section progression. 5 if sections blur. 0 if no boundaries.
- D8: 10 if consistent typography/spacing/radii. 5 if drift. 0 if multiple competing styles.
- D9: 10 if all images sharp, on-brand, real. 5 if 1-2 problems. 0 if broken images, stock-feel, or off-brand.
- D10: 10 if above-fold phone CTA + clear conversion paths. 5 if some. 0 if buried.

A red "NOT PRODUCTION-READY" banner at the top is automated · ignore for scoring (it's not the design's fault).

Be critical. Average mean for production-ready is ≥85/100. Don't grade-inflate.

Output JSON ONLY.`;

function extractHeader(html) {
  // Try <header>, then <nav> at top, then anything with class header/topnav/site-header
  let m = html.match(/<header[\s\S]*?<\/header>/i);
  if (!m) m = html.match(/<(nav|div)[^>]*(class|id)=["'][^"']*(header|topnav|site-header)[^"']*["'][\s\S]{0,8000}?<\/\1>/i);
  return m ? m[0] : null;
}
function extractFooter(html) {
  let m = html.match(/<footer[\s\S]*?<\/footer>/i);
  if (!m) m = html.match(/<(div|section)[^>]*(class|id)=["'][^"']*(footer|site-footer|pagefoot)[^"']*["'][\s\S]{0,8000}?<\/\1>/i);
  return m ? m[0] : null;
}

function normalizeForCompare(s) {
  // Strip depth-relative path prefixes so /index and /sub/page headers compare equal
  // Also strip per-page state attrs/classes (active link · aria-current) that are
  // intentionally different per page and SHOULDN'T count as chrome inconsistency.
  return s
    .replace(/data-od-id="[^"]*"/g, '')
    .replace(/(\.\.\/)+(brand|assets|shared)\//g, '$2/')
    .replace(/\bclass="([^"]*?)\b(active|current|is-current|on|selected)\b\s*([^"]*?)"/g, 'class="$1$3"')
    .replace(/\baria-current=["'][^"']*["']/g, '')
    .replace(/\bdata-active(=["'][^"']*["'])?/g, '')
    .replace(/<a\b([^>]*)\bclass=""\s*/g, '<a$1')  // clean empty class after stripping
    .replace(/\s+/g, ' ')
    .trim();
}

function checkCrossPageConsistency(htmlFiles) {
  const headers = htmlFiles.map((f) => {
    const html = fs.readFileSync(f, 'utf8');
    const h = extractHeader(html);
    if (!h) return { file: f, header: null };
    const norm = normalizeForCompare(h);
    return { file: f, header: norm, hash: hashStr(norm) };
  });
  const footers = htmlFiles.map((f) => {
    const html = fs.readFileSync(f, 'utf8');
    const fo = extractFooter(html);
    if (!fo) return { file: f, footer: null };
    const norm = normalizeForCompare(fo);
    return { file: f, footer: norm, hash: hashStr(norm) };
  });
  const headerHashes = new Set(headers.filter((h) => h.hash).map((h) => h.hash));
  const footerHashes = new Set(footers.filter((f) => f.hash).map((f) => f.hash));
  return {
    pages_count: htmlFiles.length,
    header_unique_count: headerHashes.size,
    footer_unique_count: footerHashes.size,
    header_consistent: headerHashes.size <= 1,
    footer_consistent: footerHashes.size <= 1,
    pages_missing_header: headers.filter((h) => !h.header).length,
    pages_missing_footer: footers.filter((f) => !f.footer).length,
  };
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return h.toString(16);
}

async function visionScore({ screenshotPath, facts, pageMeta }) {
  const prompt = RUBRIC_PROMPT(facts, pageMeta);
  const res = await runTask('eval_screenshot_visual', {
    prompt,
    imagePath: screenshotPath,
    timeoutMs: 90_000,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  let parsed = null;
  try {
    const cleaned = res.output.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, reason: 'invalid JSON', raw: res.output?.slice(0, 300) };
  }
  return { ok: true, ...parsed };
}

async function main() {
  const args = parseArgs();
  if (!args.dir || !args.facts) {
    console.error('Usage: --dir <html-dir> --facts <facts.json> [--findings <findings.json>] [--out <report.json>]');
    process.exit(1);
  }
  const dir = path.resolve(args.dir);
  const facts = readJson(path.resolve(args.facts))?.locked_facts || readJson(path.resolve(args.facts)) || {};
  const findings = args.findings ? (readJson(path.resolve(args.findings))?.findings || []) : [];

  const htmlFiles = findHtmlFiles(dir);
  if (htmlFiles.length === 0) {
    console.error(`No HTML files in ${dir}`);
    process.exit(1);
  }
  console.log(`[audit-vision] ${path.relative(process.cwd(), dir)} · ${htmlFiles.length} pages`);

  // 1. Cross-page consistency check (cheap · no vision)
  const consistency = checkCrossPageConsistency(htmlFiles);
  console.log(`  cross-page: header ${consistency.header_consistent ? 'CONSISTENT' : 'INCONSISTENT'} (${consistency.header_unique_count} variants across ${consistency.pages_count} pages)`);
  console.log(`  cross-page: footer ${consistency.footer_consistent ? 'CONSISTENT' : 'INCONSISTENT'} (${consistency.footer_unique_count} variants)`);

  // 2. Screenshot sample pages × desktop + mobile
  const samples = pickSamplePages(htmlFiles, dir);
  const ssDir = path.join(dir, '_audit-screenshots');
  fs.mkdirSync(ssDir, { recursive: true });

  console.log(`  screenshotting ${samples.length} sample pages × 2 viewports...`);
  const shots = [];
  for (const fp of samples) {
    const base = path.basename(fp, '.html');
    await screenshotPage({ filePath: fp, outDir: ssDir, viewport: { width: 1440, height: 900 }, name: `${base}-desktop` });
    await screenshotPage({ filePath: fp, outDir: ssDir, viewport: { width: 390, height: 844 }, name: `${base}-mobile` });
    shots.push({
      file: path.relative(dir, fp),
      desktop_fold: `_audit-screenshots/${base}-desktop-fold.png`,
      desktop_overview: `_audit-screenshots/${base}-desktop-overview.png`,
      desktop_full: `_audit-screenshots/${base}-desktop-full.png`,
      desktop_footer: `_audit-screenshots/${base}-desktop-footer.png`,
      mobile_fold: `_audit-screenshots/${base}-mobile-fold.png`,
      mobile_full: `_audit-screenshots/${base}-mobile-full.png`,
    });
  }
  console.log(`  saved ${shots.length * 2} screenshots to _audit-screenshots/`);

  // 3. Vision score: home-overview (content+design), home-footer (D5/D4), home-mobile, about-fold
  // Strategy: overview (3000px) shows 2-3 sections → accurate D7/D8; footer target for D5/D4;
  //   mobile-fold for responsive quality. Full-page is kept on disk but not sent to vision API.
  console.log(`  running vision rubric on home-overview + home-footer + home-mobile + about-fold...`);
  const targets = [
    shots[0]?.desktop_overview ? { file: shots[0].file, viewport: 'desktop-overview', path: path.join(dir, shots[0].desktop_overview) } : { file: shots[0]?.file, viewport: 'desktop-fold', path: path.join(dir, shots[0]?.desktop_fold || '') },
    shots[0]?.desktop_footer ? { file: shots[0].file, viewport: 'desktop-footer', path: path.join(dir, shots[0].desktop_footer) } : null,
    { file: shots[0]?.file, viewport: 'mobile-fold', path: path.join(dir, shots[0]?.mobile_fold || '') },
    shots[1] ? { file: shots[1].file, viewport: 'desktop-fold', path: path.join(dir, shots[1].desktop_fold) } : null,
  ].filter(Boolean).filter((t) => fs.existsSync(t.path));

  const visionResults = [];
  for (const t of targets) {
    process.stdout.write(`    ${t.file} @ ${t.viewport}...`);
    const r = await visionScore({ screenshotPath: t.path, facts, pageMeta: t });
    if (r.ok) {
      const mean = (Object.values(r.scores).reduce((a, b) => a + b, 0) / 10).toFixed(1);
      console.log(` mean ${mean}/10`);
      visionResults.push({ ...t, ...r });
    } else {
      console.log(` ERR ${r.reason}`);
      visionResults.push({ ...t, ok: false, reason: r.reason });
    }
  }

  // 4. Composite score — smart per-dim aggregation
  const okResults = visionResults.filter((v) => v.scores);
  const dimMeans = {};
  if (okResults.length > 0) {
    const dims = Object.keys(okResults[0].scores);
    // D4/D5 are "presence" checks — use max so fold views (where footer/header are off-screen)
    // don't drag down the score. Footer target provides the definitive answer for D5.
    const PRESENCE_DIMS = new Set(['D4_header_quality', 'D5_footer_quality']);
    // Footer-only targets contribute noise to content/design dims (D3/D7/D8) since those
    // dims can't be assessed from a footer-only view. Exclude them for non-presence dims.
    const FOOTER_VIEWPORTS = new Set(['desktop-footer', 'mobile-footer']);
    for (const d of dims) {
      const allVals = okResults.map((v) => ({ score: v.scores[d], viewport: v.viewport }));
      if (PRESENCE_DIMS.has(d)) {
        const vals = allVals.map((v) => v.score).filter((x) => typeof x === 'number');
        dimMeans[d] = vals.length ? Math.max(...vals) : 0;
      } else {
        const contentVals = allVals
          .filter((v) => !FOOTER_VIEWPORTS.has(v.viewport))
          .map((v) => v.score)
          .filter((x) => typeof x === 'number');
        const vals = contentVals.length ? contentVals : allVals.map((v) => v.score).filter((x) => typeof x === 'number');
        dimMeans[d] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      }
    }
  }
  // Apply cross-page penalty
  let visionMean = Object.values(dimMeans).reduce((a, b) => a + b, 0);
  let crossPenalty = 0;
  if (!consistency.header_consistent) crossPenalty += 10;
  if (!consistency.footer_consistent) crossPenalty += 10;
  if (consistency.pages_missing_header > 0) crossPenalty += 5;
  if (consistency.pages_missing_footer > 0) crossPenalty += 5;
  const composite = Math.max(0, visionMean - crossPenalty);

  const allFindings = visionResults.flatMap((v) => v.biggest_problems || []);
  const allFixes = visionResults.flatMap((v) => v.fix_priorities || []);

  const report = {
    dir: path.relative(process.cwd(), dir),
    pages: htmlFiles.length,
    consistency,
    vision_results: visionResults,
    dim_means: dimMeans,
    vision_mean_raw: visionMean.toFixed(1),
    cross_page_penalty: crossPenalty,
    composite_score: composite.toFixed(1),
    all_problems: allFindings,
    all_fix_priorities: allFixes,
    pass_90: composite >= 90,
    generated_at: new Date().toISOString(),
  };

  const outPath = args.out ? path.resolve(args.out) : path.join(dir, '_vision-audit.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`\n[audit-vision] composite: ${composite.toFixed(1)}/100 ${composite >= 90 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  dim means: ${Object.entries(dimMeans).map(([k, v]) => `${k.replace(/^D\d+_/, '')}=${v.toFixed(1)}`).join(' · ')}`);
  console.log(`  cross-page penalty: ${crossPenalty}`);
  if (allFindings.length) {
    console.log(`  top problems:`);
    [...new Set(allFindings)].slice(0, 6).forEach((p) => console.log(`    · ${p}`));
  }
  console.log(`  → ${path.relative(process.cwd(), outPath)}`);
  if (_browser) await _browser.close();
  process.exit(composite >= 90 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
