#!/usr/bin/env node
/**
 * pl-compose-loop.js · codex R50/R52/R70 · audit→feedback→fix→re-audit loop (GATE-B/C).
 *
 * THIN by design (codex R70-D3): only mutates upstream DATA writers + invokes existing
 * CLIs (pl-extract-site-ctx, pl-compose-editorial, pl-audit-v4). NEVER touches the
 * composer/template render logic, and NEVER writes the derived site-ctx.json directly
 * (resolveTrueWriter in compose-feedback.js already routes feedback to the true writer).
 *
 * Per-round: backup → apply actionable feedback → (re-extract if facts) → recompose →
 * re-audit (fast tier · deterministic · $0) → resolution + regression check → rollback
 * on regression. Stops at max rounds / convergence (0 actionable) / regression.
 *
 * Safety: --dry-run is the DEFAULT (shows the plan, writes nothing). --write applies.
 * checkpoint verdict=RED is refused (same gate as ship). Backups in _loop-backup/round-N/.
 *
 * Usage:
 *   node scripts/cli/pl-compose-loop.js --slug vicwest-roofing            # dry-run
 *   node scripts/cli/pl-compose-loop.js --slug vicwest-roofing --write    # apply
 *   node scripts/cli/pl-compose-loop.js --slug vicwest-roofing --write --max 3
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runTask, extractJson } from '../../core/autoresearch/llm-cascade.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(REPO);

// ---- args ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const getArg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const slug = getArg('slug');
const WRITE = argv.includes('--write');
const MAX = parseInt(getArg('max', '3'), 10);
if (isMain && !slug) { console.error('--slug required'); process.exit(1); }

const V2 = `clients/${slug}/v2`;
const log = (...a) => console.log(...a);
const readJson = (p) => JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
const runCli = (script, extra = []) => execFileSync('node', ['--env-file-if-exists=.env.local', `scripts/cli/${script}`, '--slug', slug, ...extra], { cwd: REPO, stdio: 'pipe' });

// ---- gates ----
function checkpointVerdict() { try { return readJson(`${V2}/checkpoint.json`).verdict || 'UNKNOWN'; } catch { return 'UNKNOWN'; } }

function auditSnapshot() {
  runCli('pl-audit-v4.js', ['--tier', 'fast']);
  const issues = readJson(`${V2}/editorial-output/audit-v4-issues.json`).issues || [];
  const summary = readJson(`${V2}/editorial-output/audit-v4-summary.json`);
  const p0 = issues.filter((i) => i.severity === 'P0').map((i) => i.rule || i.dim);
  const p1 = issues.filter((i) => i.severity === 'P1').map((i) => i.rule || i.dim);
  return { issues, composite: summary.composite, p0, p1 };
}

// ---- appliers ----
function backup(round, relPath) {
  const src = path.resolve(`${V2}/${relPath}`);
  if (!fs.existsSync(src)) return;
  const dst = path.resolve(`${V2}/_loop-backup/round-${round}/${relPath}`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
function restore(round, relPath) {
  const bak = path.resolve(`${V2}/_loop-backup/round-${round}/${relPath}`);
  if (fs.existsSync(bak)) fs.copyFileSync(bak, path.resolve(`${V2}/${relPath}`));
}

// adjust_token = deterministic replace (no LLM). ABN: swap rendered bad value → verified.
function applyAdjustToken(cf, evidence) {
  const rel = (cf.target_path || '').split(`/v2/`)[1];
  if (!rel) return { applied: false, reason: 'no target_path' };
  const m = /Rendered ABN (\d[\d ]{8,16}\d).*verified ABN (\d[\d ]{8,16}\d)/i.exec(evidence || '');
  if (m && /brief|core-extract/.test(rel)) {
    const bad = m[1].trim(), good = m[2].trim();
    const p = path.resolve(`${V2}/${rel}`);
    let txt = fs.readFileSync(p, 'utf8');
    if (!txt.includes(bad)) return { applied: false, reason: `bad value "${bad}" not found in ${rel}` };
    txt = txt.split(bad).join(good);
    fs.writeFileSync(p, txt);
    return { applied: true, detail: `ABN ${bad} → ${good} in ${rel}` };
  }
  return { applied: false, reason: 'adjust_token pattern not deterministically handled (only ABN swap defined)' };
}

// codex R71: deterministic fact-guard. Any protected claim (number / ®brand / geo /
// licence / warranty / cert) in the NEW copy must resolve to the allowed corpus
// (old copy + proof_chips + single-page-brief.yaml + core-extract + master.md).
// This is Matthew's P0 red line — core info 100% correct. Unverified claim → reject.
const CLAIM_LEXICON = /\b(regional|region|greater|metro|metropolitan|statewide|state-wide|nationwide|wide|victoria|vic|nsw|qld|tas|sa|wa|act|melbourne|sydney|brisbane|adelaide|perth|geelong|bendigo|ballarat|delacombe|warrant(?:y|ies)|guarantee[ds]?|licen[sc]ed?|certified|accredited|insured|award|vba|qbcc|abn)\b/gi;
function buildCorpus(cand) {
  const parts = [cand.headline || '', cand.subheadline || '', (cand.proof_chips || []).join(' ')];
  for (const f of ['single-page-brief.yaml', 'core-extract.json', 'master.md']) {
    try { parts.push(fs.readFileSync(path.resolve(`${V2}/${f}`), 'utf8')); } catch { /* optional */ }
  }
  return parts.join(' \n ').toLowerCase();
}
export function factGuard(neo, corpus) {
  const text = `${neo.headline} ${neo.subheadline}`;
  const v = [];
  for (const num of text.match(/\d+/g) || []) if (!corpus.includes(num)) v.push(`number "${num}"`);
  for (const b of text.match(/[A-Za-z][A-Za-z0-9-]*®/g) || []) if (!corpus.includes(b.replace('®', '').toLowerCase())) v.push(`brand "${b}"`);
  for (const tok of new Set((text.match(CLAIM_LEXICON) || []).map((t) => t.toLowerCase()))) if (!corpus.includes(tok)) v.push(`claim "${tok}"`);
  return v;
}

// rewrite_copy = LLM gen_copy_fix · field-scoped · NO new facts. Hero candidates[idx].
async function applyRewriteCopy(cf, evidence) {
  const rel = (cf.target_path || '').split(`/v2/`)[1];
  const idxM = /candidates\[(\d+)\]/.exec(cf.target_field || '');
  if (!rel.endsWith('hero-copy.json') || !idxM) return { applied: false, reason: 'rewrite_copy only wired for hero-copy.json candidates[idx]' };
  const idx = parseInt(idxM[1], 10);
  const p = path.resolve(`${V2}/${rel}`);
  const data = readJson(`${V2}/${rel}`);
  const cand = (data.candidates || [])[idx];
  if (!cand) return { applied: false, reason: `candidate ${idx} missing` };

  const wc = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  const corpus = buildCorpus(cand);
  // codex R72: surface the traceable proof numbers the model is ALLOWED to use (so
  // C-H-7 "needs a number" is satisfiable without inventing — e.g. "since 1996").
  const proofFacts = [];
  try {
    const rf = readJson(`${V2}/core-extract.json`).brief?.real_facts || {};
    for (const f of ['founded_year', 'years_in_business', 'google_rating', 'rating', 'review_count', 'guarantee', 'warranty']) {
      if (rf[f] !== undefined && /\d/.test(JSON.stringify(rf[f]))) proofFacts.push(`${f}: ${typeof rf[f] === 'object' ? JSON.stringify(rf[f]) : rf[f]}`);
    }
  } catch { /* optional */ }
  const validate = (raw) => {
    const j = extractJson(raw);
    return j && j.headline && j.subheadline ? { ok: true, parsed: j } : { ok: false, error: 'no JSON / missing fields' };
  };
  const basePrompt = (extra) => `You are tightening an existing roofing-website hero. Rewrite ONLY the headline and subheadline.
HARD RULES: invent NO new facts. You may ONLY use facts that appear in the CURRENT copy, the proof chips, or the verified proof facts below — no new numbers, suburbs, regions, warranties, licences, brands or names. If unsure, keep the existing wording.
- headline: ≤ 10 words, specific, no generic filler.
- subheadline: 14-25 words, concrete.
ISSUE TO FIX: ${evidence}
CURRENT headline: ${cand.headline}
CURRENT subheadline: ${cand.subheadline}
Allowed proof chips: ${JSON.stringify(cand.proof_chips || [])}
Verified proof facts you MAY surface (use the exact numbers, e.g. "since 1996"): ${proofFacts.length ? proofFacts.join(' · ') : '(none)'}${extra || ''}
Return STRICT JSON only: {"headline":"...","subheadline":"..."}`;

  // codex R71: try up to 3 times, feeding any fact-guard violation back so the local
  // model can self-correct. If it still can't produce fact-safe copy → reject (do not write).
  let lastReason = 'no attempt';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const extra = attempt > 1 && lastReason.startsWith('unverified') ? `\nPREVIOUS ATTEMPT REJECTED — these claims are NOT in the source facts and are FORBIDDEN: ${lastReason.replace('unverified: ', '')}. Use only Ballarat/VIC-level wording present in the current copy.` : '';
    const res = await runTask('gen_copy_fix', { prompt: basePrompt(extra), validate });
    if (!res.ok || !res.parsed) { lastReason = `LLM failed (${(res.fallback_chain || []).map((c) => `${c.model}:${c.reason || (c.validation_failed ? 'invalid' : 'ok')}`).join(' › ') || 'none'})`; continue; }
    const sw = wc(res.parsed.subheadline), hw = wc(res.parsed.headline);
    if (hw > 10 || sw < 12 || sw > 25) { lastReason = `out of bounds (headline ${hw}w, subhead ${sw}w)`; continue; }
    const violations = factGuard(res.parsed, corpus);
    if (violations.length) { lastReason = `unverified: ${violations.join(', ')}`; continue; }
    const before = { headline: cand.headline, subheadline: cand.subheadline };
    cand.headline = res.parsed.headline.trim();
    cand.subheadline = res.parsed.subheadline.trim();
    cand._loop_rewrite = { round_evidence: evidence, before, by: res.model || res.tool, attempts: attempt };
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    return { applied: true, detail: `hero candidates[${idx}] subhead ${wc(before.subheadline)}w → ${sw}w · fact-guard✓ (${res.model || res.tool}, try ${attempt})` };
  }
  return { applied: false, reason: `rewrite rejected after 3 tries — ${lastReason}` };
}

// ---- loop ----
if (isMain) (async () => {
  log(`\n=== pl:compose-loop · ${slug} · ${WRITE ? 'WRITE' : 'DRY-RUN'} · max ${MAX} ===`);
  const verdict = checkpointVerdict();
  log(`checkpoint verdict: ${verdict}`);
  if (verdict === 'RED') { console.error('✗ checkpoint=RED → loop refused (same gate as ship). Fix data completeness first.'); process.exit(2); }

  const history = [];
  const exhausted = new Set(); // dims applied in a prior round that did NOT resolve — stop re-trying (no churn)
  let before = auditSnapshot();
  log(`baseline · composite ${before.composite} · P0 ${before.p0.length} · P1 ${before.p1.length}`);

  for (let round = 1; round <= MAX; round++) {
    const actionable = before.issues.filter((i) => i.compose_feedback?.loop_action && !exhausted.has(i.rule || i.dim));
    if (!actionable.length) { log(`\nround ${round}: 0 fresh actionable feedback → converged. Stop.`); break; }
    log(`\n--- round ${round} · ${actionable.length} actionable ---`);

    if (!WRITE) {
      actionable.forEach((i) => log(`  [dry] ${i.compose_feedback.loop_action} · ${i.rule || i.dim} → ${(i.compose_feedback.target_path || '').split('/v2/')[1]} :: ${i.compose_feedback.target_field}`));
      log('  (dry-run · no writes · re-run with --write to apply)');
      break;
    }

    // backup every distinct target file
    const touched = [...new Set(actionable.map((i) => (i.compose_feedback.target_path || '').split('/v2/')[1]).filter(Boolean))];
    touched.forEach((rel) => backup(round, rel));

    const applied = [];
    for (const iss of actionable) {
      const cf = iss.compose_feedback;
      let r;
      if (cf.loop_action === 'adjust_token') r = applyAdjustToken(cf, iss.what);
      else if (cf.loop_action === 'rewrite_copy') r = await applyRewriteCopy(cf, iss.what);
      else r = { applied: false, reason: `${cf.loop_action} not implemented in thin loop` };
      log(`  ${r.applied ? '✓' : '·'} ${iss.rule || iss.dim}: ${r.detail || r.reason}`);
      applied.push({ source_dim: iss.rule || iss.dim, target_field: cf.target_field, action: cf.loop_action, ...r });
    }
    const appliedOk = applied.filter((a) => a.applied);
    if (!appliedOk.length) { log('  no feedback could be applied this round → stop.'); history.push({ round, applied, note: 'nothing applied' }); break; }

    // re-extract if any applied feedback touches a fact source feeding site-ctx
    const needsExtract = actionable.some((i) => i.compose_feedback.re_extract);
    if (needsExtract) { log('  re-extract site-ctx (facts changed)…'); try { runCli('pl-extract-site-ctx.js', ['--force']); } catch (e) { log('  ! re-extract failed:', String(e).slice(0, 120)); } }
    log('  recompose…'); runCli('pl-compose-editorial.js');

    const after = auditSnapshot();
    // resolution: applied source_dim no longer present
    const stillThere = new Set(after.issues.map((i) => i.rule || i.dim));
    const resolved = appliedOk.filter((a) => !stillThere.has(a.source_dim));
    const resolutionRate = resolved.length / appliedOk.length;
    // applied but NOT resolved → the edit can't satisfy this rule (e.g. C-H-7 wants a
    // concrete number but fact-guard forbids inventing one). Mark exhausted: don't burn
    // more LLM rounds re-rewriting the same field with no progress.
    const unresolved = appliedOk.filter((a) => stillThere.has(a.source_dim)).map((a) => a.source_dim);
    unresolved.forEach((d) => exhausted.add(d));
    if (unresolved.length) log(`  ⓘ applied but unresolved (won't retry): ${unresolved.join(', ')}`);
    // regression: NEW P0 rule / P1 count up / composite drop
    const newP0 = after.p0.filter((r) => !before.p0.includes(r));
    const regression = newP0.length > 0 || after.p1.length > before.p1.length || after.composite < before.composite;
    log(`  result · composite ${before.composite}→${after.composite} · P0 ${before.p0.length}→${after.p0.length} · P1 ${before.p1.length}→${after.p1.length} · resolved ${resolved.length}/${appliedOk.length} (${Math.round(resolutionRate * 100)}%)`);

    if (regression) {
      log(`  ✗ REGRESSION (newP0=${JSON.stringify(newP0)} · P1↑=${after.p1.length > before.p1.length} · composite↓=${after.composite < before.composite}) → ROLLBACK round ${round}`);
      touched.forEach((rel) => restore(round, rel));
      runCli('pl-compose-editorial.js');
      history.push({ round, applied, resolved: resolved.map((r) => r.source_dim), resolution_rate: resolutionRate, before: { composite: before.composite, p0: before.p0.length, p1: before.p1.length }, after: { composite: after.composite, p0: after.p0.length, p1: after.p1.length }, regression: true, rolled_back: true });
      break;
    }

    history.push({ round, applied, resolved: resolved.map((r) => r.source_dim), resolution_rate: resolutionRate, before: { composite: before.composite, p0: before.p0.length, p1: before.p1.length }, after: { composite: after.composite, p0: after.p0.length, p1: after.p1.length }, regression: false });
    before = after; // next round audits the improved state
  }

  // ---- write history + summary (GATE-E traceability) ----
  const scored = history.filter((h) => h.before && h.after);
  if (WRITE && scored.length) {
    const outDir = path.resolve(`${V2}/editorial-output`);
    fs.mkdirSync(outDir, { recursive: true });
    const totalApplied = history.reduce((s, h) => s + (h.applied || []).filter((a) => a.applied).length, 0);
    const totalResolved = history.reduce((s, h) => s + (h.resolved || []).length, 0);
    const summary = {
      slug, schema_version: 'compose-loop/1', rounds: history.length,
      gate_b_resolution_rate: totalApplied ? +(totalResolved / totalApplied).toFixed(2) : 0,
      total_applied: totalApplied, total_resolved: totalResolved,
      composite_start: scored[0].before.composite, composite_end: scored[scored.length - 1].after.composite,
      rolled_back_rounds: history.filter((h) => h.rolled_back).map((h) => h.round),
    };
    fs.writeFileSync(path.join(outDir, 'loop-history.json'), JSON.stringify(history, null, 2));
    fs.writeFileSync(path.join(outDir, 'loop-summary.json'), JSON.stringify(summary, null, 2));
    log(`\n=== loop-summary ===`);
    log(`  rounds ${summary.rounds} · applied ${summary.total_applied} · resolved ${summary.total_resolved} · GATE-B resolution ${Math.round(summary.gate_b_resolution_rate * 100)}% (target ≥70%)`);
    log(`  composite ${summary.composite_start} → ${summary.composite_end}${summary.rolled_back_rounds.length ? ` · rolled back: ${summary.rolled_back_rounds}` : ''}`);
    log(`  → ${path.relative(REPO, path.join(outDir, 'loop-summary.json'))}`);
  }
})();
