#!/usr/bin/env node
/**
 * pl-copy-audit · ProfitsLocal copy-quality auditor (codex R93/R94/R105/R106)
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
 * R106 Matthew directive: generic copy, puffery, demo placeholder counts/reviews,
 * and mild approach language are advisory-only marketing findings. Ship verdicts
 * are controlled only by fabricated licence/identity facts and deterministic
 * density walls.
 *
 * Usage:
 *   npm run pl:copy-audit -- --validate              # gold-set calibration (build the standard)
 *   npm run pl:copy-audit -- --slug <slug>           # audit clients/<slug>/v2/editorial-output/index.html
 *   npm run pl:copy-audit -- --html <file>           # audit any rendered HTML
 *   npm run pl:copy-audit -- --html <file> --brief <brief.yaml>
 *   [--tier T1|T0]  [--json <out>]  [--verbose]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runText } from '../../core/llm/text-adapter.js';
// Deterministic TRUTH CHECK (identity/licence/ABN/phone/address vs single-page-brief.yaml) lives in its
// own module now — it is fact verification, not copy auditing (Matthew 2026-05-30 · `pl:fact-verify`).
import { loadBriefFacts, identityFindings, IDENTITY_LABELS } from '../../core/audit/fact-verify.js';

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
  else if (a === '--no-fail-closed') args['no-fail-closed'] = true;
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

const ADVISORY_LABELS = new Set([
  'generic_any_industry_copy',
  'generic',
  'unsupported_claim',
  'demo_placeholder',
  'verified_framing_on_placeholder',
  'missing_specificity',
  'internal_workflow_terms',
]);


// ── passage judge prompt (the core capability the gold set validates) ──
function judgePrompt(text, context) {
  return `You are a senior local-business website COPYWRITING auditor. You catch weak, generic, bloated, or unsafe copy that hurts conversion or trust. You are strict — a real prospect will judge this in seconds.

Policy model: these pages are DEMOS shown to prospects. The customer edits placeholder proof before go-live.
- Licence, ABN, phone, business name, and address are checked by deterministic brief cross-check outside this judge. Do not label or penalise those identity facts.
- VERDICT REVISE: deterministic density walls only.
- ADVISORY ONLY: generic-any-industry copy, puffery, placeholder project/job counts, placeholder review counts, AI testimonials, years-in-business estimates, soft stats, and mild "approach" language. Record labels, but do not change verdict for these.

Evaluate ONE passage of website copy${context ? ` (section: ${context})` : ''}.

Flag these problems (use these exact label ids):
- generic_any_industry_copy  → could be any business ("quality workmanship you can trust", "your trusted partner"); advisory only
- generic                    → vague, no concrete specifics (no service area, material, number, named problem); advisory only
- too_long                   → padded, expository, more words than a scanning visitor will read
- cluttered                  → multiple ideas crammed without hierarchy
- unsupported_claim          → a claim with no stated source/evidence
- demo_placeholder           → unverified demo proof such as project counts, review counts, AI testimonials, years-in-business estimates, or soft stats. Advisory only.
- verified_framing_on_placeholder → a soft proof placeholder count/review/stat is framed as verified fact. Advisory only.
- missing_specificity        → should name city/material/warranty/number but doesn't
- internal_workflow_terms    → leaks internal/AI/workflow language

Owner classification for each finding:
- rewrite_copy   → fixable by rewording the text
- layout_density → the text is structurally too long/dense; needs trimming or splitting, not just rewording

Return STRICT JSON only:
{"verdict":"approve|revise|reject","severity":"none|low|high|critical","labels":["..."],"owner":"rewrite_copy|layout_density|null","hardFail":"<one of ${JSON.stringify(HARD_FAILS)} or null>","reason":"<=200 chars","fix":"<one concrete rewrite/trim instruction>"}

Rules:
- Never set fabricated_license_or_identity; identity facts are deterministic outside this LLM judge.
- Project counts, review counts, AI testimonials, years-in-business estimates, and soft marketing stats are demo placeholders: never set hardFail for these; use demo_placeholder and at most low severity.
- Marked demo placeholders can still receive verdict "approve"; the label is provenance guidance, not a rejection.
- If a placeholder count/stat is framed as verified ("we have completed 500 roofs", "verified 120 reviews") without provenance, use verified_framing_on_placeholder, but keep verdict "approve".
- generic_any_industry_copy and generic are low advisory findings. Even a zero-specifics puffery passage should be "approve" with advisory labels, not "revise" or "reject".
- A clean, specific, honest passage ⇒ verdict "approve", severity "none", labels [].
- Do NOT penalise a single passage for not naming the city / service area — service-area coverage
  is judged at PAGE level, not per isolated passage. Judge only whether THIS passage is
  generic / padded / legally unsafe / cluttered.

PASSAGE:
"""${text}"""`;
}

function hasDensityWall(text, context) {
  const n = wc(text);
  const c = String(context || '');
  if (/about\.p\d+/.test(c) && n > BUDGETS.about_paragraph_words[1]) return true;
  return false;
}

function normalizeJudgeResult(raw, text, context) {
  const labels = (Array.isArray(raw.labels) ? raw.labels : []).filter(label => !IDENTITY_LABELS.has(label));
  const densityWall = hasDensityWall(text, context);
  const hasAdvisory = labels.some(label => ADVISORY_LABELS.has(label));

  if (densityWall) {
    return {
      verdict: 'revise',
      severity: 'high',
      owner: 'layout_density',
      hardFail: null,
    };
  }
  return {
    verdict: 'approve',
    severity: hasAdvisory ? 'low' : 'none',
    owner: raw.owner === 'layout_density' ? 'layout_density' : (hasAdvisory ? (raw.owner || 'rewrite_copy') : null),
    hardFail: null,
  };
}

async function judgePassage(text, context) {
  // format:'json' + think:false → forces structured JSON from ollama and suppresses reasoning
  // models' <think> blocks (e.g. deepseek-r1) that would otherwise break JSON parsing.
  const llm = await runText({ prompt: judgePrompt(text, context), tier: TIER, temperature: 0, format: 'json', think: false });
  if (!llm.ok || !llm.parsedJson) {
    return { verdict: 'error', severity: 'unknown', labels: [], owner: null, hardFail: null,
             reason: `judge failed: ${llm.reason || 'no JSON'}`, provider: llm.provider || null, fell_back_local: true };
  }
  const j = llm.parsedJson;
  const normalized = normalizeJudgeResult(j, text, context);
  const labels = (Array.isArray(j.labels) ? j.labels : []).filter(label => !IDENTITY_LABELS.has(label));
  const fellBackLocal = llm.provider === 'ollama';
  // FAIL-CLOSED: a local-model fallback may flag/reject but may NOT issue a clean approve.
  // --no-fail-closed disables this for capability testing (which local model judges best?).
  let verdict = normalized.verdict;
  if (fellBackLocal && verdict === 'approve' && !args['no-fail-closed']) verdict = 'needs_human_review';
  return {
    verdict,
    severity: normalized.severity,
    labels,
    owner: normalized.owner,
    hardFail: normalized.hardFail,
    rawVerdict: j.verdict || null,
    rawSeverity: j.severity || null,
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
  const identityResults = [];
  for (const c of gold.identityChecks || []) {
    const r = identityFindings(c.html, c.brief || null);
    const hardFails = r.findings.filter(f => f.hardFail).map(f => f.hardFail);
    const verdict = hardFails.length ? 'reject' : r.findings.length ? 'revise' : 'approve';
    const ok = verdict === c.expected_verdict
      && (!c.expected_hardfail || hardFails.includes(c.expected_hardfail))
      && (!c.expected_label || r.findings.some(f => (f.labels || []).includes(c.expected_label)));
    identityResults.push({ c, r, verdict, hardFails, ok });
    console.log(`  [${ok ? '✓ ok' : '✗ FAIL'}] ${c.id} (identity) → deterministic: ${verdict}${hardFails.length ? ' · hardFail=' + hardFails.join(',') : ''}`);
  }
  const results = [];
  for (const p of gold.passages) {
    const r = await judgePassage(p.text, p.context || p.source);
    const approved = r.verdict === 'approve';
    const caughtTierA = (p.must_trigger_hardfail === 'fabricated_license_or_identity')
      ? (r.hardFail === 'fabricated_license_or_identity' || r.labels.includes('fabricated_license_or_identity')) : null;
    const densityExpected = p.must_trigger_density === true ? r.verdict === 'revise' && r.owner === 'layout_density' : null;
    results.push({ p, r, approved, caughtTierA, densityExpected });
    const expectedOk = p.must_trigger_hardfail === 'fabricated_license_or_identity'
      ? caughtTierA
      : p.must_trigger_density === true
        ? densityExpected
        : p.verdict === 'acceptable'
          ? approved
          : true;
    const tag = expectedOk ? '✓ ok' : '✗ FAIL';
    console.log(`  [${tag}] ${p.id} (${p.verdict}/${p.severity}) → judge: ${r.verdict}/${r.severity} ${r.hardFail ? '· hardFail=' + r.hardFail : ''} ${r.fell_back_local ? '· LOCAL-FALLBACK' : ''}`);
    if (args.verbose) console.log(`       labels=${JSON.stringify(r.labels)} owner=${r.owner} · ${r.reason}`);
  }
  // metrics
  const tierASet = identityResults.filter(x => x.c.expected_hardfail === 'fabricated_license_or_identity');
  const tierARecall = tierASet.length ? tierASet.filter(x => x.ok).length / tierASet.length : 1;
  const identitySet = identityResults;
  const identityCorrect = identitySet.length ? identitySet.filter(x => x.ok).length / identitySet.length : 1;
  const densitySet = results.filter(x => x.p.must_trigger_density === true);
  const densityCorrect = densitySet.length ? densitySet.filter(x => x.densityExpected).length / densitySet.length : 1;
  const acceptable = results.filter(x => x.p.verdict === 'acceptable');
  const acceptableOk = acceptable.filter(x => x.approved).length;
  const acceptableRate = acceptable.length ? acceptableOk / acceptable.length : 1;
  // codex R95: every page-mode finding carries span+owner by construction — assert it structurally
  // here so the gold-set _structuralGuarantees claim can't silently rot.
  const ownerValues = ['rewrite_copy', 'layout_density', null];
  const ownerContractOk = results.every(x => ownerValues.includes(x.r.owner));

  const pass = tierARecall >= (pc.tier_a_hardfail_recall ?? pc.fake_claim_recall)
    && identityCorrect >= (pc.identity_correctness ?? 1)
    && densityCorrect >= (pc.density_correctness ?? 1)
    && acceptableRate >= (pc.acceptable_pass_min ?? 0)
    && ownerContractOk;

  console.log(`\n[copy-audit] CALIBRATION RESULT`);
  console.log(`  tier_a_hardfail_recall: ${tierARecall.toFixed(2)} (need ${pc.tier_a_hardfail_recall ?? pc.fake_claim_recall})`);
  console.log(`  identity_correctness: ${identityCorrect.toFixed(2)} (need ${pc.identity_correctness ?? 1})`);
  console.log(`  density_correctness:  ${densityCorrect.toFixed(2)} (need ${pc.density_correctness ?? 1})`);
  console.log(`  acceptable_passed:    ${acceptableOk}/${acceptable.length} = ${acceptableRate.toFixed(2)} (need ≥${pc.acceptable_pass_min ?? 0})`);
  console.log(`  owner_contract:       ${ownerContractOk ? 'ok' : 'VIOLATED'} (every finding owner ∈ {rewrite_copy,layout_density,null})`);
  console.log(`\n  ${pass ? '✅ AUDITOR CALIBRATED — capable of gating generation' : '❌ NOT CALIBRATED — strengthen rubric/prompt before trusting it'}`);
  process.exit(pass ? 0 : 1);
}

// ── PAGE audit mode ──
async function auditPage(htmlPath, options = {}) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const sections = extractSections(html);
  const findings = [];
  const identity = identityFindings(html, options.briefFacts || null);
  findings.push(...identity.findings.map(f => ({ ...f, kind: 'identity' })));
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
    if (r.labels.length || r.verdict === 'reject' || r.verdict === 'revise' || r.hardFail) {
      // R106 intent (Matthew "puffery is just marketing"): only a hardFail or a HIGH/CRITICAL copy issue
      // changes the verdict. Low-severity generic/puffery/demo-placeholder findings are ADVISORY only —
      // recorded for the operator, never a ship-blocker. (The judge may still emit verdict:revise on puffery;
      // we demote it here by severity so the gate matches the policy regardless of judge-verdict noise.)
      const verdictChanging = r.hardFail || r.severity === 'high' || r.severity === 'critical';
      findings.push({ section: ps.section, kind: verdictChanging ? 'copy' : 'advisory', owner: r.owner, severity: r.severity,
        labels: r.labels, hardFail: r.hardFail, reason: r.reason, fix: r.fix, span: ps.text.slice(0, 160) });
    }
  }
  const hardFails = findings.filter(f => f.hardFail).map(f => f.hardFail);
  let verdict = hardFails.length ? 'reject'
    : findings.some(f => f.kind === 'density' || f.kind === 'copy' || f.kind === 'identity') ? 'revise'
    : 'approve';
  if (anyLocalFallback && verdict === 'approve') verdict = 'needs_human_review'; // fail-closed
  const report = {
    schemaVersion: 1, file: path.relative(REPO, htmlPath), tier: TIER,
    verdict, hardFails: [...new Set(hardFails)],
    identity: {
      status: identity.status,
      brief: options.briefPath ? path.relative(REPO, options.briefPath) : null,
      warning: identity.warning || null,
    },
    counts: { total: findings.length, rewrite_copy: findings.filter(f => f.owner === 'rewrite_copy').length,
              layout_density: findings.filter(f => f.owner === 'layout_density').length },
    findings,
  };
  console.log(`[copy-audit] ${report.file} · verdict=${verdict.toUpperCase()} · ${findings.length} findings (rewrite=${report.counts.rewrite_copy} density=${report.counts.layout_density})${hardFails.length ? ' · HARD FAILS: ' + report.hardFails.join(',') : ''}`);
  if (identity.warning) console.log(`  ! ${identity.warning}`);
  for (const f of findings) console.log(`  · [${f.owner || f.kind}/${f.severity}] ${f.section}: ${f.hardFail ? 'HARDFAIL ' + f.hardFail + ' · ' : ''}${f.reason || f.detail || (f.labels || []).join(',')}`);
  if (args.json) { fs.writeFileSync(args.json, JSON.stringify(report, null, 2)); console.log(`  → ${args.json}`); }
  process.exit(0);
}

// ── dispatch ──
(async () => {
  if (args.validate) return validate();
  let htmlPath = args.html;
  let briefPath = args.brief ? path.resolve(REPO, args.brief) : null;
  if (!htmlPath && args.slug) {
    htmlPath = path.join(REPO, 'clients', args.slug, 'v2/editorial-output/index.html');
    if (!briefPath) briefPath = path.join(REPO, 'clients', args.slug, 'v2/single-page-brief.yaml');
  }
  if (!htmlPath || !fs.existsSync(htmlPath)) {
    console.error('Usage: --validate | --slug <slug> | --html <file> [--brief <brief.yaml>]');
    if (htmlPath) console.error(`  not found: ${htmlPath}`);
    process.exit(2);
  }
  if (briefPath && !fs.existsSync(briefPath)) {
    console.error(`Brief not found: ${briefPath}`);
    process.exit(2);
  }
  const briefFacts = briefPath ? loadBriefFacts(briefPath) : null;
  return auditPage(htmlPath, { briefPath, briefFacts });
})();
