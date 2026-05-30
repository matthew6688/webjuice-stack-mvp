#!/usr/bin/env node
/**
 * pl-compare-persona · R108 step 7 (codex Round 112 spec).
 *
 * Baseline (PERSONA_CONTEXT off) vs persona-aware (PERSONA_CONTEXT=1) generation, compared on the RENDERED
 * page — not on intermediates. For each client + variant:
 *   1. regenerate B1/B2/B3 into the live handoff/content (backed up + restored — live client is never left mutated)
 *   2. re-compose the full page (pl:compose-editorial --skip-checkpoint)
 *   3. snapshot the rendered index.html (+ intermediates for debug) into _persona-compare/<variant>/
 *   4. audit the SNAPSHOT: fact-verify (identity) · density wall · rendered word counts by section ·
 *      identity fields detected · persona-copy quality (pl:persona-copy-audit --html · advisory)
 * Then synthesise ONE scorecard with the persona delta + a promotion decision.
 *
 * DEFAULT-ON BAR (codex R112 · all must hold for `candidate`): fact-verify PASS · density PASS · no
 * fabricated identity · no per-section contract violation · persona score improves MEANINGFULLY (≥ +3,
 * not noise). codex R112: do NOT promote default-on from a flaky-cloud run — require a reproducible pass on
 * the real intended tier path, not only the local fallback. This harness produces the evidence; promotion is
 * still a human/codex decision.
 *
 * Usage:
 *   npm run pl:compare-persona -- --slug vicwest-roofing [--runs 1] [--keep]
 *   npm run pl:compare-persona -- --slugs vicwest-roofing,a-j-roofing-solutions,mark-squire-roof-restorations
 * Output: clients/<slug>/v2/_persona-compare/compare-scorecard.{md,json}
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { load as cheerioLoad } from 'cheerio';
import { loadBriefFacts, identityFindings, verifyFacts } from '../../core/audit/fact-verify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const DEFAULT_SLUGS = ['vicwest-roofing', 'a-j-roofing-solutions', 'mark-squire-roof-restorations'];
const PERSONA_DELTA_MIN = 3; // "meaningful" improvement, not noise (advisory threshold)
// Generic clichés the generator contracts forbid — a rendered-page contract check (deterministic).
const BANNED_PHRASES = [
  'quality workmanship', 'trusted partner', 'we pride ourselves', 'tailored solutions', 'tailored to your needs',
  'best in class', 'innovative solutions', 'welcome to', 'your trusted', 'superior service', 'superior responsiveness',
  'one of the largest', 'industry-leading', 'industry leading',
];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--slug') args.slugs = [process.argv[++i]];
  else if (a === '--slugs') args.slugs = process.argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
  else if (a === '--runs') args.runs = parseInt(process.argv[++i], 10) || 1;
  else if (a === '--keep') args.keep = true;
}
const slugs = args.slugs && args.slugs.length ? args.slugs : DEFAULT_SLUGS;
const personaRuns = args.runs || 1;

const wc = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

function sectionWordCounts(html) {
  const $ = cheerioLoad(html);
  const hero = wc($('p.lead').first().text());
  let services = 0, serviceMaxBlock = 0;
  $('h3').each((_, el) => { const b = wc($(el).nextAll('p').first().text()); services += b; serviceMaxBlock = Math.max(serviceMaxBlock, b); });
  let about = 0, aboutMaxPara = 0;
  const am = html.match(/id="about-h"[\s\S]*?<\/header>([\s\S]*?)<\/section>/);
  if (am) for (const p of am[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const n = wc(p[1].replace(/<[^>]+>/g, ' ')); if (n > 5) { about += n; aboutMaxPara = Math.max(aboutMaxPara, n); }
  }
  const maxBlock = Math.max(hero, serviceMaxBlock, aboutMaxPara);
  return { hero, services, about, maxBlock, aboutMaxPara, about_section_found: !!am };
}

function densityVerdict(words) {
  // same budget as pl:launch-scorecard: about ≤320 total · any single block ≤90
  const pass = words.about <= 320 && words.maxBlock <= 90;
  return { status: pass ? 'PASS' : 'FAIL', about_total: words.about, max_block: words.maxBlock, budget: '≤320 about / ≤90 any block' };
}

function identityFieldsDetected(html, briefFacts) {
  const r = identityFindings(html, briefFacts);
  const c = r.claims || {};
  const present = (briefFacts && briefFacts.business_name && (r.claims?.text || '').includes(briefFacts.business_name));
  return {
    business_name: !!present,
    address: (c.address || []).length > 0,
    phone: (c.phone || []).length > 0,
    abn: (c.abn || []).length > 0,
    license: (c.license_number || []).length > 0 || (c.license_authority || []).length > 0,
  };
}

function contractViolations(html, words) {
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const violations = [];
  for (const p of BANNED_PHRASES) if (text.includes(p)) violations.push({ section: 'page', rule: 'banned_phrase', detail: p });
  // About no-process-paragraph rule (the conflict that broke step 6): flag an explicit process/approach blurb in About.
  const am = html.match(/id="about-h"[\s\S]*?<\/header>([\s\S]*?)<\/section>/);
  if (am) {
    const aboutText = am[1].replace(/<[^>]+>/g, ' ').toLowerCase();
    if (/(our|the) (process|approach)\b|step\s*1\b|how it works/.test(aboutText)) {
      violations.push({ section: 'about', rule: 'process_paragraph_in_about', detail: 'About contains a process/approach blurb (belongs in services)' });
    }
  }
  if (words.about > 320) violations.push({ section: 'about', rule: 'density_wall', detail: `about ${words.about}w > 320` });
  if (words.maxBlock > 90) violations.push({ section: 'page', rule: 'block_wall', detail: `max block ${words.maxBlock}w > 90` });
  return violations;
}

function runStep(label, file, argv, env) {
  try {
    execFileSync('node', [file, ...argv], { cwd: REPO, stdio: 'pipe', timeout: 600000, env });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `${label} failed: ${e.code || (e.stderr ? String(e.stderr).slice(-200) : e.message)}` };
  }
}

function auditVariant(slug, snapDir, briefPath) {
  const htmlPath = path.join(snapDir, 'index.html');
  if (!fs.existsSync(htmlPath)) return { failed: true, reason: 'no rendered index.html (compose failed)' };
  const html = fs.readFileSync(htmlPath, 'utf8');
  const briefFacts = loadBriefFacts(briefPath);
  const fv = verifyFacts(html, briefPath);
  const words = sectionWordCounts(html);
  const density = densityVerdict(words);
  const identity = identityFieldsDetected(html, briefFacts);
  const violations = contractViolations(html, words);

  // persona-copy-audit on the SNAPSHOT (advisory · LLM)
  let persona = { score: null, would_contact: null, gaps: [], error: null };
  const pj = path.join(snapDir, 'persona-copy.json');
  const r = runStep('persona-copy-audit', 'scripts/cli/pl-persona-copy-audit.js',
    ['--html', htmlPath, '--runs', String(personaRuns), '--json', pj], process.env);
  if (r.ok && fs.existsSync(pj)) {
    const j = JSON.parse(fs.readFileSync(pj, 'utf8'));
    persona = { score: j.persona_fit_mean ?? null, would_contact: !!j.would_contact, gaps: (j.gaps || []).slice(0, 4), error: null };
  } else persona.error = r.error || 'persona-copy-audit produced no json';

  return {
    fact_verify: { status: fv.status === 'checked' ? (fv.pass ? 'PASS' : 'FAIL') : fv.status, pass: fv.pass, hardFails: fv.hardFails },
    density, section_words: words, identity_fields_detected: identity,
    contract_violations: violations, persona,
  };
}

function promotionDecision(baseline, persona) {
  // block if the persona variant is unsafe or failed; candidate only if it clears the high bar AND improves.
  if (!persona || persona.failed) return { decision: 'block', reasons: ['persona variant failed to render/audit'] };
  const reasons = [];
  if (persona.fact_verify.status !== 'PASS') reasons.push(`fact-verify ${persona.fact_verify.status}`);
  if (persona.density.status !== 'PASS') reasons.push(`density ${persona.density.status}`);
  if ((persona.fact_verify.hardFails || []).length) reasons.push('fabricated identity');
  if (persona.contract_violations.length) reasons.push(`${persona.contract_violations.length} contract violation(s)`);
  if (reasons.length) return { decision: 'block', reasons };

  const bScore = baseline?.persona?.score, pScore = persona?.persona?.score;
  const delta = (typeof bScore === 'number' && typeof pScore === 'number') ? +(pScore - bScore).toFixed(1) : null;
  if (delta === null) return { decision: 'needs_review', reasons: ['persona score missing on one variant — re-run with stable tiers'] };
  if (delta >= PERSONA_DELTA_MIN) return { decision: 'candidate', reasons: [`persona +${delta} (≥${PERSONA_DELTA_MIN}) · all hard gates pass`], delta };
  return { decision: 'needs_review', reasons: [`persona delta ${delta >= 0 ? '+' : ''}${delta} below the +${PERSONA_DELTA_MIN} meaningful bar`], delta };
}

function compareSlug(slug) {
  const v2 = path.join(REPO, 'clients', slug, 'v2');
  const contentDir = path.join(v2, 'handoff', 'content');
  const indexPath = path.join(v2, 'editorial-output', 'index.html');
  const briefPath = path.join(v2, 'single-page-brief.yaml');
  if (!fs.existsSync(briefPath)) return { slug, error: 'no single-page-brief.yaml (cannot fact-verify)' };

  const cmpRoot = path.join(v2, '_persona-compare');
  const backupDir = path.join(cmpRoot, '_backup');
  fs.mkdirSync(backupDir, { recursive: true });
  // back up live content/ + rendered index.html so the live client is never left mutated
  if (fs.existsSync(contentDir)) fs.cpSync(contentDir, path.join(backupDir, 'content'), { recursive: true });
  if (fs.existsSync(indexPath)) fs.cpSync(indexPath, path.join(backupDir, 'index.html'));

  const variants = [
    { name: 'baseline', persona: false },
    { name: 'persona', persona: true },
  ];
  const results = {};
  try {
    for (const v of variants) {
      const env = { ...process.env };
      if (v.persona) env.PERSONA_CONTEXT = '1'; else delete env.PERSONA_CONTEXT;
      const gen = runStep(`enrich-handoff(${v.name})`, 'scripts/cli/pl-enrich-handoff.js', ['--slug', slug, '--only', 'B1,B2,B3'], env);
      const comp = gen.ok ? runStep(`compose(${v.name})`, 'scripts/cli/pl-compose-editorial.js', ['--slug', slug, '--skip-checkpoint'], env) : { ok: false, error: gen.error };
      const snapDir = path.join(cmpRoot, v.name);
      fs.rmSync(snapDir, { recursive: true, force: true });
      fs.mkdirSync(snapDir, { recursive: true });
      if (fs.existsSync(indexPath)) fs.cpSync(indexPath, path.join(snapDir, 'index.html'));
      if (fs.existsSync(contentDir)) fs.cpSync(contentDir, path.join(snapDir, 'content'), { recursive: true });
      if (!gen.ok || !comp.ok) { results[v.name] = { failed: true, reason: gen.error || comp.error }; continue; }
      results[v.name] = auditVariant(slug, snapDir, briefPath);
    }
  } finally {
    // ALWAYS restore the live client
    if (fs.existsSync(path.join(backupDir, 'content'))) { fs.rmSync(contentDir, { recursive: true, force: true }); fs.cpSync(path.join(backupDir, 'content'), contentDir, { recursive: true }); }
    if (fs.existsSync(path.join(backupDir, 'index.html'))) fs.cpSync(path.join(backupDir, 'index.html'), indexPath);
    // re-compose once more from the restored content so editorial-output matches the restored live state
    runStep('restore-compose', 'scripts/cli/pl-compose-editorial.js', ['--slug', slug, '--skip-checkpoint'], process.env);
  }

  const promo = promotionDecision(results.baseline, results.persona);
  const scorecard = { slug, generated_at_note: 'timestamp stamped by caller', persona_runs: personaRuns, variants: results, promotion: promo, default_on_candidate: promo.decision === 'candidate' };
  fs.writeFileSync(path.join(cmpRoot, 'compare-scorecard.json'), JSON.stringify(scorecard, null, 2));
  fs.writeFileSync(path.join(cmpRoot, 'compare-scorecard.md'), renderMd(scorecard));
  if (!args.keep) { for (const v of variants) { /* keep snapshots; only drop the _backup */ } fs.rmSync(backupDir, { recursive: true, force: true }); }
  return scorecard;
}

function renderMd(s) {
  const v = s.variants;
  const row = (name, r) => r?.failed
    ? `| ${name} | ❌ ${r.reason} | — | — | — |`
    : `| ${name} | ${r.fact_verify.status} | ${r.density.status} | ${r.persona.score ?? '—'} / contact:${r.persona.would_contact ? 'Y' : 'N'} | ${r.contract_violations.length} |`;
  const words = (name, r) => r?.failed ? `- ${name}: failed` : `- ${name}: hero ${r.section_words.hero}w · services ${r.section_words.services}w · about ${r.section_words.about}w (max block ${r.section_words.maxBlock}w)`;
  const idf = (r) => r?.failed ? '' : Object.entries(r.identity_fields_detected).filter(([, x]) => x).map(([k]) => k).join(', ');
  const viol = (name, r) => r?.failed ? '' : (r.contract_violations.length ? `\n**${name} contract violations:**\n${r.contract_violations.map((x) => `- [${x.section}] ${x.rule}: ${x.detail}`).join('\n')}` : '');
  return [
    `# Persona comparison · ${s.slug}`,
    ``,
    `**Promotion decision: ${s.promotion.decision.toUpperCase()}** — ${s.promotion.reasons.join(' · ')}`,
    `default_on_candidate: ${s.default_on_candidate} · persona runs: ${s.persona_runs}`,
    ``,
    `| variant | fact-verify | density | persona | contract viol. |`,
    `|---|---|---|---|---|`,
    row('baseline', v.baseline),
    row('persona', v.persona),
    ``,
    `## Rendered word counts by section`,
    words('baseline', v.baseline),
    words('persona', v.persona),
    ``,
    `## Identity fields detected (rendered)`,
    `- baseline: ${idf(v.baseline) || '—'}`,
    `- persona: ${idf(v.persona) || '—'}`,
    viol('baseline', v.baseline),
    viol('persona', v.persona),
    ``,
    `## Persona-copy gaps (advisory · soft notes)`,
    ...(v.persona && !v.persona.failed ? (v.persona.persona.gaps || []).map((g) => `- ${g}`) : ['- (none / persona variant failed)']),
  ].join('\n');
}

// ── main ──
const all = [];
for (const slug of slugs) {
  console.log(`\n════════ compare-persona · ${slug} ════════`);
  const r = compareSlug(slug);
  all.push(r);
  if (r.error) { console.log(`  SKIP: ${r.error}`); continue; }
  console.log(`  promotion: ${r.promotion.decision.toUpperCase()} — ${r.promotion.reasons.join(' · ')}`);
  const b = r.variants.baseline, p = r.variants.persona;
  const ps = (x) => x?.failed ? `FAILED(${x.reason})` : `fv:${x.fact_verify.status} density:${x.density.status} persona:${x.persona.score ?? '—'} viol:${x.contract_violations.length}`;
  console.log(`  baseline · ${ps(b)}`);
  console.log(`  persona  · ${ps(p)}`);
  console.log(`  → clients/${slug}/v2/_persona-compare/compare-scorecard.{md,json}`);
}
const candidates = all.filter((r) => r.default_on_candidate).map((r) => r.slug);
console.log(`\n[compare-persona] ${slugs.length} client(s) · default_on candidates: ${candidates.length ? candidates.join(', ') : 'none'}`);
