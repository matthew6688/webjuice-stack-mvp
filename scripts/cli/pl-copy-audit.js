#!/usr/bin/env node
/**
 * pl-copy-audit · ProfitsLocal copy-quality auditor (codex R93/R94)
 *
 * Matthew constraint #1: the auditor must PROVE it catches the problems the human
 * eye sees BEFORE it is trusted to gate copy generation. So this ships with a
 * `--validate` mode that runs against skills/website-copy-audit/references/gold-set.json
 * and checks the pass criteria. No copywriter is wired into the compose loop until
 * `--validate` passes (and rejects the current vicwest copy).
 *
 * Constraint #2 (mandatory): every LLM call routes through core/llm/text-adapter
 * (tier T1 = claude_cli → codex_cli → ollama). FAIL-CLOSED: if the judge falls back
 * to a local model, it may flag/reject but may NOT issue a clean "approve".
 *
 * Usage:
 *   npm run pl:copy-audit -- --validate              # gold-set calibration (build the standard)
 *   npm run pl:copy-audit -- --slug <slug>           # audit clients/<slug>/v2/editorial-output/index.html
 *   npm run pl:copy-audit -- --html <file>           # audit any rendered HTML
 *   [--tier T1|T0]  [--json <out>]  [--verbose]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runText } from '../../core/llm/text-adapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const RUBRIC = path.join(REPO, 'skills/website-copy-audit/references/copy-audit-rubric.json');
const GOLD = path.join(REPO, 'skills/website-copy-audit/references/gold-set.json');

// ── args ──
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--validate') args.validate = true;
  else if (a === '--verbose') args.verbose = true;
  else if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1]; i++; }
}
const TIER = args.tier || 'T1';

const rubric = JSON.parse(fs.readFileSync(RUBRIC, 'utf8'));
const HARD_FAILS = rubric.hardFails;

// ── density budgets (deterministic · no LLM · owner=layout_density) ──
const BUDGETS = {
  hero_subhead_words: [10, 25],
  service_body_words: [0, 22],
  about_total_words: [0, 320],     // whole about section word ceiling
  about_paragraph_words: [0, 90],  // any single paragraph ceiling
};

// ── passage judge prompt (the core capability the gold set validates) ──
function judgePrompt(text, context) {
  return `You are a senior local-business website COPYWRITING auditor. You catch weak, generic, bloated, or dishonest copy that hurts conversion or trust. You are strict — a real roofer's prospect will judge this in seconds.

Evaluate ONE passage of website copy${context ? ` (section: ${context})` : ''}.

Flag these problems (use these exact label ids):
- generic_any_industry_copy  → could be any business ("quality workmanship you can trust", "your trusted partner")
- generic                    → vague, no concrete specifics (no service area, material, number, named problem)
- too_long                   → padded, expository, more words than a scanning visitor will read
- cluttered                  → multiple ideas crammed without hierarchy
- unsupported_claim          → a claim with no stated source/evidence
- fake_verified_claim        → invents a verifiable-sounding stat/fact as if real (e.g. "likely completed over 500 roofs", invented founding year, made-up review counts). THIS IS A HARD FAIL.
- missing_specificity        → should name city/material/warranty/number but doesn't
- internal_workflow_terms    → leaks internal/AI/workflow language

Owner classification for each finding:
- rewrite_copy   → fixable by rewording the text
- layout_density → the text is structurally too long/dense; needs trimming or splitting, not just rewording

Return STRICT JSON only:
{"verdict":"approve|revise|reject","severity":"none|low|high|critical","labels":["..."],"owner":"rewrite_copy|layout_density|null","hardFail":"<one of ${JSON.stringify(HARD_FAILS)} or null>","reason":"<=200 chars","fix":"<one concrete rewrite/trim instruction>"}

Rules:
- fake_verified_claim or generic_any_industry_copy ⇒ verdict "reject", and set hardFail.
- A clean, specific, honest passage ⇒ verdict "approve", severity "none", labels [].
- Do not approve a passage that contains any unsupported/fake claim.
- Do NOT penalise a single passage for not naming the city / service area — service-area coverage
  is judged at PAGE level, not per isolated passage. Judge only whether THIS passage is
  generic / padded / dishonest / cluttered.

PASSAGE:
"""${text}"""`;
}

async function judgePassage(text, context) {
  const llm = await runText({ prompt: judgePrompt(text, context), tier: TIER, temperature: 0 });
  if (!llm.ok || !llm.parsedJson) {
    return { verdict: 'error', severity: 'unknown', labels: [], owner: null, hardFail: null,
             reason: `judge failed: ${llm.reason || 'no JSON'}`, provider: llm.provider || null, fell_back_local: true };
  }
  const j = llm.parsedJson;
  const fellBackLocal = llm.provider === 'ollama';
  // FAIL-CLOSED: a local-model fallback may flag/reject but may NOT issue a clean approve.
  let verdict = j.verdict;
  if (fellBackLocal && verdict === 'approve') verdict = 'needs_human_review';
  return {
    verdict,
    severity: j.severity || 'unknown',
    labels: Array.isArray(j.labels) ? j.labels : [],
    owner: j.owner === 'null' ? null : (j.owner || null),
    hardFail: j.hardFail === 'null' ? null : (j.hardFail || null),
    reason: j.reason || '',
    fix: j.fix || '',
    provider: llm.provider,
    fell_back_local: fellBackLocal,
  };
}

// ── deterministic density findings ──
function wc(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
function densityFindings(sections) {
  const out = [];
  if (sections.heroSubhead) {
    const n = wc(sections.heroSubhead), [lo, hi] = BUDGETS.hero_subhead_words;
    if (n < lo || n > hi) out.push({ section: 'hero.subhead', owner: 'layout_density', severity: n > hi ? 'high' : 'low',
      label: n > hi ? 'too_long' : 'missing_specificity', detail: `hero subhead ${n} words (budget ${lo}-${hi})` });
  }
  for (const s of sections.serviceBodies || []) {
    const n = wc(s.body), hi = BUDGETS.service_body_words[1];
    if (n > hi) out.push({ section: `service.${s.title}`, owner: 'layout_density', severity: 'low', label: 'too_long',
      detail: `service body ${n} words (budget ≤${hi})` });
  }
  const aboutTotal = (sections.aboutParagraphs || []).reduce((a, p) => a + wc(p), 0);
  if (aboutTotal > BUDGETS.about_total_words[1]) out.push({ section: 'about', owner: 'layout_density', severity: 'high', label: 'too_long',
    detail: `about section ${aboutTotal} words across ${sections.aboutParagraphs.length} paragraphs (budget ≤${BUDGETS.about_total_words[1]}) — text wall` });
  (sections.aboutParagraphs || []).forEach((p, i) => {
    const n = wc(p); if (n > BUDGETS.about_paragraph_words[1]) out.push({ section: `about.p${i + 1}`, owner: 'layout_density', severity: 'low',
      label: 'too_long', detail: `about paragraph ${i + 1} is ${n} words (budget ≤${BUDGETS.about_paragraph_words[1]})` });
  });
  return out;
}

// ── extract copy from a rendered page ──
function unescapeStrip(t) {
  return String(t).replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function extractSections(html) {
  const grab = (re) => { const m = html.match(re); return m ? unescapeStrip(m[1]) : null; };
  const heroSubhead = grab(/<p class="lead">([\s\S]*?)<\/p>/);
  const serviceBodies = [];
  for (const m of html.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)) {
    const title = unescapeStrip(m[1]), body = unescapeStrip(m[2]);
    if (title && body) serviceBodies.push({ title, body });
  }
  const aboutParagraphs = [];
  const am = html.match(/id="about-h"[\s\S]*?<\/header>([\s\S]*?)<\/section>/);
  if (am) for (const p of am[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const s = unescapeStrip(p[1]); if (wc(s) > 5) aboutParagraphs.push(s);
  }
  return { heroSubhead, serviceBodies, aboutParagraphs };
}

// ── VALIDATE mode: prove the auditor is capable against the gold set ──
async function validate() {
  const gold = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
  const pc = gold.passCriteria;
  console.log(`[copy-audit] VALIDATE · ${gold.passages.length} gold passages · tier=${TIER}\n`);
  const results = [];
  for (const p of gold.passages) {
    const r = await judgePassage(p.text, p.source);
    const approved = r.verdict === 'approve';
    const caughtFake = (p.must_trigger_hardfail === 'fake_verified_claim')
      ? (r.hardFail === 'fake_verified_claim' || r.labels.includes('fake_verified_claim')) : null;
    const flaggedBad = p.verdict === 'bad' ? (r.verdict === 'reject' || r.verdict === 'revise' || r.severity === 'high' || r.severity === 'critical') : null;
    results.push({ p, r, approved, caughtFake, flaggedBad });
    const tag = p.verdict === 'bad' ? (flaggedBad ? '✓ caught' : '✗ MISSED') : (approved ? '✓ passed' : '~ over-flag');
    console.log(`  [${tag}] ${p.id} (${p.verdict}/${p.severity}) → judge: ${r.verdict}/${r.severity} ${r.hardFail ? '· hardFail=' + r.hardFail : ''} ${r.fell_back_local ? '· LOCAL-FALLBACK' : ''}`);
    if (args.verbose) console.log(`       labels=${JSON.stringify(r.labels)} owner=${r.owner} · ${r.reason}`);
  }
  // metrics
  const fakeSet = results.filter(x => x.p.must_trigger_hardfail === 'fake_verified_claim');
  const fakeRecall = fakeSet.length ? fakeSet.filter(x => x.caughtFake).length / fakeSet.length : 1;
  const highBad = results.filter(x => x.p.verdict === 'bad' && (x.p.severity === 'high' || x.p.severity === 'critical'));
  const highRecall = highBad.length ? highBad.filter(x => x.flaggedBad).length / highBad.length : 1;
  const knownBadApproved = results.filter(x => x.p.verdict === 'bad' && x.approved).length;
  const acceptable = results.filter(x => x.p.verdict === 'acceptable');
  const acceptableOk = acceptable.filter(x => x.approved).length;
  const acceptableRate = acceptable.length ? acceptableOk / acceptable.length : 1;
  // codex R95: every page-mode finding carries span+owner by construction — assert it structurally
  // here so the gold-set _structuralGuarantees claim can't silently rot.
  const ownerValues = ['rewrite_copy', 'layout_density', null];
  const ownerContractOk = results.every(x => ownerValues.includes(x.r.owner));

  const pass = fakeRecall >= pc.fake_claim_recall
    && highRecall >= pc.high_severity_recall
    && knownBadApproved <= pc.known_bad_approved
    && acceptableRate >= (pc.acceptable_pass_min ?? 0)
    && ownerContractOk;

  console.log(`\n[copy-audit] CALIBRATION RESULT`);
  console.log(`  fake_claim_recall:    ${fakeRecall.toFixed(2)} (need ${pc.fake_claim_recall})`);
  console.log(`  high_severity_recall: ${highRecall.toFixed(2)} (need ${pc.high_severity_recall})`);
  console.log(`  known_bad_approved:   ${knownBadApproved} (need ≤${pc.known_bad_approved})`);
  console.log(`  acceptable_passed:    ${acceptableOk}/${acceptable.length} = ${acceptableRate.toFixed(2)} (need ≥${pc.acceptable_pass_min ?? 0})`);
  console.log(`  owner_contract:       ${ownerContractOk ? 'ok' : 'VIOLATED'} (every finding owner ∈ {rewrite_copy,layout_density,null})`);
  console.log(`\n  ${pass ? '✅ AUDITOR CALIBRATED — capable of gating generation' : '❌ NOT CALIBRATED — strengthen rubric/prompt before trusting it'}`);
  process.exit(pass ? 0 : 1);
}

// ── PAGE audit mode ──
async function auditPage(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const sections = extractSections(html);
  const findings = [];
  const dens = densityFindings(sections);
  findings.push(...dens.map(d => ({ ...d, kind: 'density' })));

  const passages = [];
  if (sections.heroSubhead) passages.push({ section: 'hero.subhead', text: sections.heroSubhead });
  for (const s of sections.serviceBodies) passages.push({ section: `service.${s.title}`, text: s.body });
  sections.aboutParagraphs.forEach((p, i) => passages.push({ section: `about.p${i + 1}`, text: p }));

  let anyLocalFallback = false;
  for (const ps of passages) {
    const r = await judgePassage(ps.text, ps.section);
    if (r.fell_back_local) anyLocalFallback = true;
    if (r.verdict === 'reject' || r.verdict === 'revise' || r.severity === 'high' || r.severity === 'critical' || r.hardFail) {
      findings.push({ section: ps.section, kind: 'copy', owner: r.owner, severity: r.severity,
        labels: r.labels, hardFail: r.hardFail, reason: r.reason, fix: r.fix, span: ps.text.slice(0, 160) });
    }
  }
  const hardFails = findings.filter(f => f.hardFail).map(f => f.hardFail);
  let verdict = hardFails.length ? 'reject'
    : findings.some(f => f.severity === 'high' || f.severity === 'critical') ? 'revise'
    : 'approve';
  if (anyLocalFallback && verdict === 'approve') verdict = 'needs_human_review'; // fail-closed
  const report = {
    schemaVersion: 1, file: path.relative(REPO, htmlPath), tier: TIER,
    verdict, hardFails: [...new Set(hardFails)],
    counts: { total: findings.length, rewrite_copy: findings.filter(f => f.owner === 'rewrite_copy').length,
              layout_density: findings.filter(f => f.owner === 'layout_density').length },
    findings,
  };
  console.log(`[copy-audit] ${report.file} · verdict=${verdict.toUpperCase()} · ${findings.length} findings (rewrite=${report.counts.rewrite_copy} density=${report.counts.layout_density})${hardFails.length ? ' · HARD FAILS: ' + report.hardFails.join(',') : ''}`);
  for (const f of findings) console.log(`  · [${f.owner || f.kind}/${f.severity}] ${f.section}: ${f.hardFail ? 'HARDFAIL ' + f.hardFail + ' · ' : ''}${f.reason || f.detail || (f.labels || []).join(',')}`);
  if (args.json) { fs.writeFileSync(args.json, JSON.stringify(report, null, 2)); console.log(`  → ${args.json}`); }
  process.exit(0);
}

// ── dispatch ──
(async () => {
  if (args.validate) return validate();
  let htmlPath = args.html;
  if (!htmlPath && args.slug) htmlPath = path.join(REPO, 'clients', args.slug, 'v2/editorial-output/index.html');
  if (!htmlPath || !fs.existsSync(htmlPath)) {
    console.error('Usage: --validate | --slug <slug> | --html <file>');
    if (htmlPath) console.error(`  not found: ${htmlPath}`);
    process.exit(2);
  }
  return auditPage(htmlPath);
})();
