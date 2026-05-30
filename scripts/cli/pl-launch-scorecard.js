#!/usr/bin/env node
/**
 * pl-launch-scorecard · INTERNAL launch-readiness review (codex 2026-05-30 · R108 step 3).
 *
 * One operator gate across all artifacts — the "before we ship, here's the review" scorecard. Aggregates:
 *   HARD gates: fact-verify (identity) · density wall · mobile veto
 *   info/advisory: audit-v4 (composite/grade/P0-2) · persona-copy quality · performance
 *   + a "human eyes needed" list (stale/missing inputs · persona gaps · P1/P2 issues · LLM-confidence).
 *
 * Default = READ existing outputs only, mark stale/missing. `--refresh` runs the cheap DETERMINISTIC gates
 * (fact-verify is computed direct here; pl:audit-v4 --tier fast). `--include-llm` also runs pl:persona-copy-audit.
 *
 * Usage:
 *   npm run pl:launch-scorecard -- --slug vicwest-roofing [--refresh] [--include-llm]
 * Output: clients/<slug>/v2/editorial-output/launch-scorecard.{html,json}
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { load as cheerioLoad } from 'cheerio';
import { loadBriefFacts, identityFindings } from '../../core/audit/fact-verify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--slug') args.slug = process.argv[++i];
  else if (a === '--refresh') args.refresh = true;
  else if (a === '--include-llm') args.includeLlm = true;
}
if (!args.slug) { console.error('Usage: --slug <slug> [--refresh] [--include-llm]'); process.exit(2); }

const V2 = path.join(REPO, 'clients', args.slug, 'v2');
const OUT = path.join(V2, 'editorial-output');
const htmlPath = path.join(OUT, 'index.html');
const briefPath = path.join(V2, 'single-page-brief.yaml');
if (!fs.existsSync(htmlPath)) { console.error(`not found: ${htmlPath}`); process.exit(2); }

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
const htmlMtime = mtime(htmlPath);
const isStale = (p) => mtime(p) > 0 && mtime(p) < htmlMtime - 1000; // artifact older than the live page

// optional --refresh: run the cheap deterministic audit (fact-verify is computed directly below).
// codex Round 109: refresh failures must NOT be swallowed — a failed refresh that leaves stale/old
// artifacts in place could otherwise still emit a passing-looking verdict. Track + escalate.
const refreshFailures = [];
if (args.refresh) {
  try { execFileSync('node', ['scripts/cli/pl-audit-v4.js', '--slug', args.slug, '--tier', 'fast'], { cwd: REPO, stdio: 'ignore', timeout: 240000 }); }
  catch (e) { refreshFailures.push(`audit-v4 refresh failed (${e.code || e.message || 'error'}) — mobile/issues gates may be stale`); }
}
if (args.includeLlm) {
  try { execFileSync('node', ['scripts/cli/pl-persona-copy-audit.js', '--slug', args.slug, '--runs', '2', '--json', path.join(OUT, 'persona-copy.json')], { cwd: REPO, stdio: 'ignore', timeout: 300000 }); }
  catch (e) { refreshFailures.push(`persona-copy refresh failed (${e.code || e.message || 'error'}) — advisory only`); }
}

const html = fs.readFileSync(htmlPath, 'utf8');
const humanEyes = [];

// ── HARD GATE 1 · fact-verify (deterministic · computed fresh) ──
const briefFacts = loadBriefFacts(briefPath);
const fv = identityFindings(html, briefFacts);
const fvHard = [...new Set(fv.findings.filter(f => f.hardFail).map(f => f.hardFail))];
const factVerify = briefFacts
  ? { status: fvHard.length ? 'FAIL' : 'PASS', hard: true, findings: fv.findings.length, hardFails: fvHard }
  : { status: 'CANNOT_VERIFY', hard: true, note: 'no single-page-brief.yaml' };
if (factVerify.status !== 'PASS') humanEyes.push(`fact-verify: ${factVerify.status}${fvHard.length ? ' · ' + fvHard.join(',') : ''}`);

// ── HARD GATE 2 · density wall (deterministic · computed fresh) ──
// codex Round 109: the old check only inspected About and PASSed when #about-h was absent — it could
// not see a hero/services wall. Now check every prose block: about ≤320 total / any single block ≤90.
const $ = cheerioLoad(html);
const wc = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
let aboutTotal = 0, aboutMaxPara = 0, globalMaxBlock = 0;
const am = html.match(/id="about-h"[\s\S]*?<\/header>([\s\S]*?)<\/section>/);
const aboutFound = !!am;
if (am) for (const p of am[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
  const n = wc(p[1].replace(/<[^>]+>/g, ' ')); if (n > 5) { aboutTotal += n; aboutMaxPara = Math.max(aboutMaxPara, n); }
}
// hero subhead + service-card bodies — any single block >90 words is a wall
const heroSub = wc($('p.lead').first().text());
globalMaxBlock = Math.max(aboutMaxPara, heroSub);
$('h3').each((_, el) => { const body = wc($(el).nextAll('p').first().text()); globalMaxBlock = Math.max(globalMaxBlock, body); });
const densityPass = aboutTotal <= 320 && globalMaxBlock <= 90;
const density = { status: densityPass ? 'PASS' : 'FAIL', hard: true, about_total_words: aboutTotal, about_max_para_words: aboutMaxPara, max_block_words: globalMaxBlock, about_section_found: aboutFound, budget: '≤320 about total / ≤90 any block' };
if (!densityPass) humanEyes.push(`density: about ${aboutTotal}w / max block ${globalMaxBlock}w (wall)`);
if (!aboutFound) humanEyes.push('density: no About section detected (#about-h) — verify section rendered');

// ── HARD GATE 3 · mobile veto (from audit-v4-full) ──
const v4full = readJson(path.join(OUT, 'audit-v4-full.json'));
const v4summary = readJson(path.join(OUT, 'audit-v4-summary.json'));
const v4issues = readJson(path.join(OUT, 'audit-v4-issues.json'));
const v4stale = isStale(path.join(OUT, 'audit-v4-full.json'));
// codex Round 109: a launch gate cannot infer mobile PASS from absence. Require mobile_gate.pass === true;
// a missing audit-v4 OR a missing/indeterminate mobile_gate = CANNOT_VERIFY (hard) → HOLD, never PASS.
let mobile;
if (!v4full) { mobile = { status: 'MISSING', hard: true }; humanEyes.push('mobile: no audit-v4 output (run pl:audit-v4)'); }
else {
  const mg = v4full.mobile_gate;
  if (mg?.pass === true) mobile = { status: 'PASS', hard: true, stale: v4stale, vetos: mg?.vetos?.length || 0 };
  else if (mg?.pass === false) { mobile = { status: 'FAIL', hard: true, stale: v4stale, vetos: mg?.vetos?.length || 0 }; humanEyes.push(`mobile: ${mg?.vetos?.length || 0} veto(s)`); }
  else { mobile = { status: 'CANNOT_VERIFY', hard: true, stale: v4stale }; humanEyes.push('mobile: audit-v4 has no mobile_gate result — cannot verify'); }
  if (v4stale) humanEyes.push('mobile/audit-v4: STALE (older than the live page — re-run)');
}

// ── INFO · audit-v4 composite ──
// codex Round 109: missing summary/issues can hide P0/P1 review items — never merely informational.
const countSev = (sev) => (v4issues?.issues || []).filter(i => i.severity === sev).length;
const auditV4 = v4summary
  ? { composite: v4summary.composite, grade: v4summary.grade, ship_verdict: v4summary.ship_verdict, P0: countSev('P0'), P1: countSev('P1'), P2: countSev('P2'), issues_present: !!v4issues, stale: v4stale }
  : { status: 'MISSING' };
if (!v4summary || !v4issues) {
  const what = !v4summary && !v4issues ? 'summary+issues' : !v4summary ? 'summary' : 'issues';
  humanEyes.push(`audit-v4: missing ${what} JSON — cannot count P0/P1 (run pl:audit-v4)`);
  if (args.refresh) refreshFailures.push(`audit-v4 ${what} JSON not produced after --refresh`);
}
if (auditV4.P0 > 0) humanEyes.push(`audit-v4: ${auditV4.P0} P0 issue(s) — blocker-level, review`);
if (auditV4.P1 > 0) humanEyes.push(`audit-v4: ${auditV4.P1} P1 issue(s) to review`);

// ── ADVISORY · persona-copy quality ──
const personaJson = readJson(path.join(OUT, 'persona-copy.json'));
const persona = personaJson
  ? { status: 'present', score: personaJson.persona_fit_mean, would_contact: personaJson.would_contact, top_gaps: (personaJson.gaps || []).slice(0, 3), stale: isStale(path.join(OUT, 'persona-copy.json')) }
  : { status: 'MISSING', note: 'run with --include-llm' };
if (persona.status === 'MISSING') humanEyes.push('persona-copy: not run (advisory · --include-llm)');
else { for (const g of (persona.top_gaps || [])) humanEyes.push(`persona gap: ${g}`); }

// ── ADVISORY · performance (read if present) ──
const performance = (v4full && (v4full.performance || v4full.lighthouse))
  ? { status: 'present', data: v4full.performance || v4full.lighthouse }
  : { status: 'MISSING', note: 'no performance/Lighthouse field (not blocking this step)' };

// ── OVERALL VERDICT ──
// codex Round 109: SHIP renamed READY_FOR_SIGNOFF — it means "tooling found no blockers and no review
// items", NOT "deploy without Matthew". Human sign-off stays required for v1. A failed refresh of a
// hard-gate input = HOLD (we may be reading stale artifacts). Advisory persona gaps can force HUMAN_REVIEW.
const hardGates = [factVerify, density, mobile];
const anyHardFail = hardGates.some(g => g.status === 'FAIL' || g.status === 'CANNOT_VERIFY' || g.status === 'MISSING');
const anyStale = v4stale || persona.stale;
const hardRefreshFailure = refreshFailures.some(f => !/advisory/i.test(f));
for (const f of refreshFailures) humanEyes.push(`refresh: ${f}`);
let verdict;
if (anyHardFail || hardRefreshFailure) verdict = 'HOLD';
else if (humanEyes.length || anyStale) verdict = 'HUMAN_REVIEW';
else verdict = 'READY_FOR_SIGNOFF';

const report = {
  slug: args.slug, generated_for_html_mtime: new Date(htmlMtime).toISOString(),
  verdict, hard_gates: { fact_verify: factVerify, density, mobile }, audit_v4: auditV4,
  persona_copy: persona, performance, human_eyes_needed: humanEyes,
  inputs: { audit_v4_present: !!v4summary, audit_v4_issues_present: !!v4issues, audit_v4_stale: v4stale, persona_present: persona.status !== 'MISSING', refresh_failures: refreshFailures },
};
fs.writeFileSync(path.join(OUT, 'launch-scorecard.json'), JSON.stringify(report, null, 2));

// ── HTML ──
const badge = (s) => `<span class="b ${/(PASS|present)/.test(s) ? 'ok' : /(HUMAN_REVIEW)/.test(s) ? 'warn' : /(MISSING|CANNOT_VERIFY)/.test(s) ? 'miss' : 'bad'}">${s}</span>`;
const vColor = verdict === 'READY_FOR_SIGNOFF' ? 'ok' : verdict === 'HUMAN_REVIEW' ? 'warn' : 'bad';
const htmlOut = `<!doctype html><meta charset="utf-8"><title>Launch scorecard · ${args.slug}</title>
<style>body{font:15px/1.5 -apple-system,system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 20px;color:#1a1a1a}
h1{font-size:22px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin:24px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
.verdict{font-size:28px;font-weight:800;padding:12px 18px;border-radius:8px;display:inline-block;margin:8px 0}
.ok{background:#e6f4ea;color:#1e7d34}.warn{background:#fff4e0;color:#9a6400}.bad{background:#fde8e8;color:#b3261e}.miss{background:#eee;color:#666}
.b{font-size:12px;font-weight:700;padding:2px 8px;border-radius:10px}table{border-collapse:collapse;width:100%}td{padding:6px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top}td:first-child{font-weight:600;width:170px}
ul{margin:4px 0;padding-left:20px}li{margin:3px 0}.muted{color:#888;font-size:13px}</style>
<h1>Launch scorecard · ${args.slug}</h1>
<div class="verdict ${vColor}">${verdict}</div>
<p class="muted">Generated for page rendered ${new Date(htmlMtime).toLocaleString()} · ${args.refresh ? 'refreshed deterministic gates' : 'read existing outputs'}${args.includeLlm ? ' + LLM' : ''}.</p>
<h2>Hard gates (must pass to ship)</h2><table>
<tr><td>Fact verify (identity)</td><td>${badge(factVerify.status)} ${factVerify.findings ? `· ${factVerify.findings} finding(s)` : ''} ${factVerify.note || ''}</td></tr>
<tr><td>Density (no wall)</td><td>${badge(density.status)} · about ${density.about_total_words}w / max block ${density.max_block_words}w <span class="muted">(${density.budget})</span></td></tr>
<tr><td>Mobile veto</td><td>${badge(mobile.status)} ${mobile.vetos ? `· ${mobile.vetos} veto(s)` : ''} ${mobile.stale ? '· <b>STALE</b>' : ''}</td></tr>
</table>
<h2>Site quality (audit-v4)</h2><table>
<tr><td>Composite / grade</td><td>${auditV4.composite ?? '—'} · ${auditV4.grade ?? '—'} · ${auditV4.ship_verdict ?? '—'} ${auditV4.stale ? '· <b>STALE</b>' : ''}</td></tr>
<tr><td>Issues</td><td>P0: ${auditV4.P0 ?? '—'} · P1: ${auditV4.P1 ?? '—'} · P2: ${auditV4.P2 ?? '—'}</td></tr>
</table>
<h2>Advisory</h2><table>
<tr><td>Persona-copy quality</td><td>${persona.status === 'MISSING' ? badge('MISSING') + ' <span class="muted">(--include-llm)</span>' : `${persona.score}/100 · would-contact: ${persona.would_contact ? 'YES' : 'NO'}`}</td></tr>
<tr><td>Performance</td><td>${badge(performance.status)} <span class="muted">${performance.note || ''}</span></td></tr>
</table>
<h2>👁 Human eyes needed (${humanEyes.length})</h2>
${humanEyes.length ? '<ul>' + humanEyes.map(h => `<li>${h.replace(/</g, '&lt;')}</li>`).join('') : '<p class="muted">Nothing flagged.</p>'}
`;
fs.writeFileSync(path.join(OUT, 'launch-scorecard.html'), htmlOut);

console.log(`[launch-scorecard] ${args.slug} · VERDICT = ${verdict}`);
console.log(`  fact-verify: ${factVerify.status} · density: ${density.status} · mobile: ${mobile.status} · audit-v4: ${auditV4.composite ?? '—'}/${auditV4.grade ?? '—'} · persona: ${persona.score ?? 'n/a'}`);
console.log(`  human-eyes (${humanEyes.length}): ${humanEyes.slice(0, 4).join(' · ') || 'none'}`);
console.log(`  → editorial-output/launch-scorecard.{html,json}`);
process.exit(verdict === 'HOLD' ? 1 : 0);
