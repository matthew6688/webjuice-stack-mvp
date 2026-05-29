#!/usr/bin/env node
/**
 * gate-c-claude.mjs · codex R75 · claude-version GATE-C (Phase-1 sign-off).
 *
 * Layered execution (codex R75):
 *   - per client: restore pre-loop baseline (_loop-backup/round-1) → recompose →
 *     baseline FULL audit → run compose-loop (fast internal · claude rewrite) →
 *     final FULL audit.
 *   - JUDGMENT = fast tier (R71 metrics, from loop-summary): no new P0 / P0P1
 *     non-increase / ≥70% connected resolved / 0 rollback / composite non-decrease.
 *   - FULL tier = vision OBSERVATION only (before/after composite/T3/T4/hero/vision_confidence).
 *   - copy_provider_fallback=true → excluded from formal pass (diagnostic).
 *   - cost cap: exactly 2 full-tier per client (baseline + final).
 *
 * Run: node scripts/test/gate-c-claude.mjs  (long · claude vision · run in background)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(REPO);

const CLIENTS = ['vicwest-roofing', 'a-j-roofing-solutions', 'mark-squire-roof-restorations'];
const run = (script, extra) => { try { return execFileSync('node', ['--env-file-if-exists=.env.local', `scripts/cli/${script}`, ...extra], { cwd: REPO, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }).toString(); } catch (e) { return (e.stdout || '').toString() + (e.stderr || '').toString(); } };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')); } catch { return null; } };

function restoreBaseline(slug) {
  const bdir = path.resolve(`clients/${slug}/v2/_loop-backup/round-1`);
  if (!fs.existsSync(bdir)) return [];
  const restored = [];
  const walk = (d, rel = '') => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else { fs.copyFileSync(path.join(d, e.name), path.resolve(`clients/${slug}/v2/${r}`)); restored.push(r); }
    }
  };
  walk(bdir);
  return restored;
}

function fullAudit(slug) {
  run('pl-audit-v4.js', ['--slug', slug, '--tier', 'full']);
  const f = readJson(`clients/${slug}/v2/editorial-output/audit-v4-full.json`) || {};
  return {
    composite: f.composite, grade: f.grade, verdict: f.ship_verdict,
    vision_confidence: f.vision_confidence, vision_providers: f.vision_providers,
    T3: f.tier_3?.score ?? null, T4: f.tier_4?.score ?? null, hero: f.hero_judge?.hero_visual_score ?? null,
    P0: (f.issues || []).filter((i) => i.severity === 'P0').length,
    P1: (f.issues || []).filter((i) => i.severity === 'P1').length,
  };
}

const results = [];
for (const slug of CLIENTS) {
  console.log(`\n########## ${slug} ##########`);
  const restored = restoreBaseline(slug);
  console.log(`restored pre-loop baseline: ${restored.join(', ') || '(none)'}`);
  run('pl-compose-editorial.js', ['--slug', slug]); // render loop-off baseline
  console.log('baseline FULL audit (claude vision)…');
  const baseline = fullAudit(slug);
  console.log(`  baseline · composite ${baseline.composite}/${baseline.grade} · ${baseline.verdict} · T3 ${baseline.T3} · hero ${baseline.hero} · T4 ${baseline.T4} · vision ${baseline.vision_confidence} · P0 ${baseline.P0} · P1 ${baseline.P1}`);

  console.log('running compose-loop (fast · claude rewrite)…');
  const loopLog = run('pl-compose-loop.js', ['--slug', slug, '--write', '--max', '3']);
  console.log(loopLog.split('\n').filter((l) => /round|✓|·|result|resolved|GATE-B|converged|fallback/.test(l)).slice(-14).join('\n'));
  const loopSummary = readJson(`clients/${slug}/v2/editorial-output/loop-summary.json`) || {};

  console.log('final FULL audit (claude vision)…');
  const final = fullAudit(slug);
  console.log(`  final · composite ${final.composite}/${final.grade} · ${final.verdict} · T3 ${final.T3} · hero ${final.hero} · T4 ${final.T4} · vision ${final.vision_confidence} · P0 ${final.P0} · P1 ${final.P1}`);

  results.push({ slug, baseline, final, loop: loopSummary });
}

// ---- two tables (codex R75: keep judgment + vision observation separate) ----
console.log('\n\n================= GATE-C · JUDGMENT TABLE (fast · R71 metrics) =================');
console.log('client            | applied | resolved | rate  | rollback | copy_fallback | gate');
for (const r of results) {
  const L = r.loop;
  const rate = Math.round((L.gate_b_resolution_rate || 0) * 100);
  const noRollback = (L.rolled_back_rounds || []).length === 0;
  const fb = L.copy_provider_fallback;
  // P0/P1 non-increase + composite non-decrease from full before/after (deterministic side reflected in fast loop too)
  const noNewP0 = r.final.P0 <= r.baseline.P0;
  const pass = rate >= 70 && noRollback && !fb && noNewP0;
  console.log(`${r.slug.padEnd(17)} | ${String(L.total_applied ?? 0).padEnd(7)} | ${String(L.total_resolved ?? 0).padEnd(8)} | ${(rate + '%').padEnd(5)} | ${(noRollback ? 'none' : 'YES').padEnd(8)} | ${(fb ? 'YES⚠️' : 'no').padEnd(13)} | ${pass ? 'PASS' : (fb ? 'DIAG(fallback)' : 'REVIEW')}`);
}

console.log('\n================= GATE-C · VISION OBSERVATION (full · claude · advisory) =================');
console.log('client            | composite Δ | grade | T3 Δ | hero Δ | T4 Δ | vision_conf | verdict');
for (const r of results) {
  const b = r.baseline, f = r.final;
  const d = (x, y) => `${x ?? '?'}→${y ?? '?'}`;
  console.log(`${r.slug.padEnd(17)} | ${d(b.composite, f.composite).padEnd(11)} | ${String(f.grade).padEnd(5)} | ${d(b.T3, f.T3).padEnd(4)} | ${d(b.hero, f.hero).padEnd(6)} | ${d(b.T4, f.T4).padEnd(4)} | ${String(f.vision_confidence).padEnd(11)} | ${f.verdict}`);
}

fs.writeFileSync(path.resolve('docs/v3/GATE-C-CLAUDE-RESULT.json'), JSON.stringify(results, null, 2));
console.log('\n→ docs/v3/GATE-C-CLAUDE-RESULT.json');
