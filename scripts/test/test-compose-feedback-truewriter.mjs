#!/usr/bin/env node
/**
 * test-compose-feedback-truewriter.mjs · codex R70 acceptance fixtures.
 * Verifies resolveTrueWriter() never targets the derived site-ctx.json, that the
 * hero index matches the composer's readPreparedHero() precedence, and that
 * footer.abn is blocked when no canonical single-page-brief.yaml exists.
 *
 * Run: node scripts/test/test-compose-feedback-truewriter.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _resolveTrueWriter as resolveTrueWriter, toComposeFeedback } from '../../core/audit/compose-feedback.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(REPO);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log(`  ✓ ${msg}`); } else { fail++; console.log(`  ✗ ${msg}`); } };

// Re-implement composer's hero-index precedence to assert parity.
function composerHeroIndex(slug) {
  const cdir = `clients/${slug}/v2/handoff/od-package/content`;
  let idx = 0;
  try { idx = JSON.parse(fs.readFileSync(path.resolve(`${cdir}/hero-copy.json`), 'utf8')).recommended_index ?? 0; } catch {}
  try {
    const sp = path.resolve(`${cdir}/content-selection.json`);
    if (fs.existsSync(sp)) { const sel = JSON.parse(fs.readFileSync(sp, 'utf8')); if (sel.hero_approved && sel.hero_index != null) idx = sel.hero_index; }
  } catch {}
  return idx;
}

const CLIENTS = ['vicwest-roofing', 'a-j-roofing-solutions', 'mark-squire-roof-restorations'];

console.log('== T1 · live audit issues: zero site-ctx targets + hero index parity ==');
for (const slug of CLIENTS) {
  const p = `clients/${slug}/v2/editorial-output/audit-v4-issues.json`;
  if (!fs.existsSync(path.resolve(p))) { console.log(`  (skip ${slug} · no audit-v4-issues.json · run pl-audit-v4 --tier fast first)`); continue; }
  const issues = JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')).issues || [];
  const actionable = issues.map((i) => i.compose_feedback).filter((cf) => cf?.loop_action);
  const siteCtx = actionable.filter((cf) => (cf.target_path || '').includes('site-ctx'));
  ok(siteCtx.length === 0, `${slug}: 0 site-ctx write targets (got ${siteCtx.length})`);
  const heroFb = actionable.filter((cf) => (cf.target_path || '').includes('hero-copy.json'));
  const expectIdx = composerHeroIndex(slug);
  const idxMatch = heroFb.every((cf) => (cf.target_field || '').includes(`candidates[${expectIdx}]`));
  ok(heroFb.length === 0 || idxMatch, `${slug}: hero feedback index == composer index (${expectIdx})`);
}

console.log('== T2 · synthetic: footer.abn blocked when no single-page-brief.yaml ==');
const abnIssue = { rule: 'D2.13_trust_field_presence', severity: 'P1', what: 'footer omits ABN' };
// slug with brief.yaml → adjust_token @ brief.yaml
{
  const cf = resolveTrueWriter(toComposeFeedback(abnIssue, { slug: 'vicwest-roofing' }), 'vicwest-roofing');
  ok(cf.loop_action === 'adjust_token' && (cf.target_path || '').endsWith('single-page-brief.yaml'), `vicwest (has brief.yaml): abn → adjust_token @ single-page-brief.yaml`);
}
// slug without brief.yaml → blocked
for (const slug of ['a-j-roofing-solutions', 'mark-squire-roof-restorations']) {
  const hasBrief = fs.existsSync(path.resolve(`clients/${slug}/v2/single-page-brief.yaml`));
  const cf = resolveTrueWriter(toComposeFeedback(abnIssue, { slug }), slug);
  if (hasBrief) { ok((cf.target_path || '').endsWith('single-page-brief.yaml'), `${slug} (has brief): abn → brief.yaml`); }
  else { ok(cf.loop_action === null && /missing canonical render brief/.test(cf.blocking_reason || ''), `${slug} (no brief): abn → BLOCKED (missing canonical render brief)`); }
}

console.log('== T3 · synthetic: unknown site-ctx field → blocked (no silent write) ==');
{
  // force a site-ctx target with an unmappable field via toComposeFeedback then resolve
  const cf = resolveTrueWriter({ loop_action: 'rewrite_copy', target_artifact: 'site-ctx', target_field: 'mystery.section', evidence: 'x', source_dim: 'X', severity: 'P2' }, 'vicwest-roofing');
  ok(cf.loop_action === null && /derived/.test(cf.blocking_reason || ''), `unknown site-ctx field → blocked (derived-file guard)`);
}

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} · ${pass} passed · ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
