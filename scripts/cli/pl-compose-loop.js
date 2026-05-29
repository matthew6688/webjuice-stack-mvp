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
const argv = process.argv.slice(2);
const getArg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const slug = getArg('slug');
const WRITE = argv.includes('--write');
const MAX = parseInt(getArg('max', '3'), 10);
if (!slug) { console.error('--slug required'); process.exit(1); }

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

  const prompt = `You are tightening an existing roofing-website hero. Rewrite ONLY the headline and subheadline.
HARD RULES: invent NO new facts (no new numbers, suburbs, warranties, names). Reuse only what's below.
- headline: ≤ 10 words, specific, no generic filler.
- subheadline: 14-25 words, concrete, ends without a period if it's a fragment.
ISSUE TO FIX: ${evidence}
CURRENT headline: ${cand.headline}
CURRENT subheadline: ${cand.subheadline}
Allowed proof chips (facts you may reference): ${JSON.stringify(cand.proof_chips || [])}
Return STRICT JSON only: {"headline":"...","subheadline":"..."}`;

  // runTask validate contract = {ok, parsed}. Require valid JSON with both fields;
  // word-count constraints are enforced as a write-gate below (claude is the only
  // tier that could retry on a soft constraint · local backup gets one shot).
  const wc = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  const validate = (raw) => {
    const j = extractJson(raw);
    return j && j.headline && j.subheadline ? { ok: true, parsed: j } : { ok: false, error: 'no JSON / missing fields' };
  };
  const res = await runTask('gen_copy_fix', { prompt, validate });
  if (!res.ok || !res.parsed) return { applied: false, reason: `LLM gen_copy_fix failed (${(res.fallback_chain || []).map((c) => `${c.model}:${c.reason || (c.validation_failed ? 'invalid' : 'ok')}`).join(' › ') || 'none'})` };
  const sw = wc(res.parsed.subheadline), hw = wc(res.parsed.headline);
  if (hw > 10 || sw < 12 || sw > 25) return { applied: false, reason: `LLM copy out of bounds (headline ${hw}w, subhead ${sw}w) — not written` };
  const before = { headline: cand.headline, subheadline: cand.subheadline };
  cand.headline = res.parsed.headline.trim();
  cand.subheadline = res.parsed.subheadline.trim();
  cand._loop_rewrite = { round_evidence: evidence, before, by: res.model || res.tool };
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  return { applied: true, detail: `hero candidates[${idx}] subhead ${before.subheadline.split(/\s+/).length}w → ${cand.subheadline.split(/\s+/).length}w (${res.model || res.tool})` };
}

// ---- loop ----
(async () => {
  log(`\n=== pl:compose-loop · ${slug} · ${WRITE ? 'WRITE' : 'DRY-RUN'} · max ${MAX} ===`);
  const verdict = checkpointVerdict();
  log(`checkpoint verdict: ${verdict}`);
  if (verdict === 'RED') { console.error('✗ checkpoint=RED → loop refused (same gate as ship). Fix data completeness first.'); process.exit(2); }

  const history = [];
  let before = auditSnapshot();
  log(`baseline · composite ${before.composite} · P0 ${before.p0.length} · P1 ${before.p1.length}`);

  for (let round = 1; round <= MAX; round++) {
    const actionable = before.issues.filter((i) => i.compose_feedback?.loop_action);
    if (!actionable.length) { log(`\nround ${round}: 0 actionable feedback → converged. Stop.`); break; }
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
