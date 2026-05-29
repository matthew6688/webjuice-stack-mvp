/**
 * core/audit/designer-review.js · T4 site-level designer-craft review (codex R66).
 *
 * Beyond hero (hero-judge) and deterministic facts (pl-audit-v4 detectors), this
 * judges full-page DESIGN CRAFT the other layers don't:
 *   - visual_hierarchy          (page-wide focal order, not just hero)
 *   - imagery_quality           (real trade photos vs stock · consistent system)
 *   - spacing_rhythm            (vertical rhythm · section padding consistency)
 *   - cross_section_consistency (sections feel one designed system, not bolted-on)
 *   - mobile_craft              (mobile layout quality across the page)
 *   - ai_slop                   (AS-trade catalog · gradients/rounded-card/stock clichés)
 *
 * Hard rule (codex R66 D5): deterministic facts authoritative. LLM is told the
 * facts + known issue IDs and forbidden to re-audit them; contradictions are
 * downgraded to false_positive_fact_conflict, never blocking.
 *
 * Scope guard (codex R66 D2): T4 must NOT judge hero (hero-judge owns it) or
 * facts (detectors own them). full/premium only; LLM unavailable → skipped.
 * Cascade: eval_design_review = claude sonnet → haiku → ollama gemma3.
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractJson, runTask } from '../autoresearch/llm-cascade.js';

const OVERVIEW_CAP_PX = 3000; // codex R66 D4: cap overview height · never feed raw 11MB full-page PNGs

const AS_TRADE_SLOP = [
  'generic soft gradients / purple-blue SaaS palette',
  'rounded glass-card sameness',
  'fake lifestyle stock ("tradie with bucket" / staged smiling worker)',
  'bland identical trust cards / fake proof surfaces',
  'internal/generated/placeholder wording leaking into design',
  '"your trusted partner" / decorative-novelty vibe over credible local trade',
];

const DIMS = ['visual_hierarchy', 'imagery_quality', 'spacing_rhythm', 'cross_section_consistency', 'mobile_craft', 'ai_slop'];

// codex R67 · low-confidence / can't-assess language → dim is N/A, not a 0 penalty.
const CANT_ASSESS = /cannot assess|can'?t assess|can’t assess|unable to (?:assess|evaluate|judge|determine|see|read)|no (?:image|screenshot) (?:provided|available)|(?:image|screenshot) (?:not|isn'?t) (?:clear|legible|visible|provided)|too (?:small|blurr?ed|cropped|unclear|low.?res) to (?:assess|read|judge|evaluate)/i;

async function renderOverview(htmlFile, outDir) {
  let playwright;
  try { playwright = await import('playwright'); } catch { return null; }
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: true });
  const out = {};
  try {
    const url = 'file://' + path.resolve(htmlFile);
    // desktop overview · clip top OVERVIEW_CAP_PX (preserves section rhythm · vision-safe)
    const d = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
    const dp = await d.newPage(); await dp.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    const dh = await dp.evaluate(() => document.documentElement.scrollHeight);
    out.desktop = path.join(outDir, 't4-desktop-overview.png');
    await dp.screenshot({ path: out.desktop, clip: { x: 0, y: 0, width: 1280, height: Math.min(dh, OVERVIEW_CAP_PX) } });
    // mobile overview
    const m = await browser.newContext({ viewport: { width: 390, height: 1200 }, isMobile: true });
    const mp = await m.newPage(); await mp.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    const mh = await mp.evaluate(() => document.documentElement.scrollHeight);
    out.mobile = path.join(outDir, 't4-mobile-overview.png');
    await mp.screenshot({ path: out.mobile, clip: { x: 0, y: 0, width: 390, height: Math.min(mh, OVERVIEW_CAP_PX) } });
  } finally { await browser.close().catch(() => {}); }
  return out;
}

function buildPrompt(facts, knownIssueIds, viewport) {
  return `You are a senior web designer reviewing the CRAFT of a local Australian roofing website (top ${OVERVIEW_CAP_PX}px overview · ${viewport}). Judge the WHOLE-PAGE design system, NOT the hero alone and NOT factual content.

DETERMINISTIC FACTS (TRUE · do NOT re-audit / contradict):
${JSON.stringify(facts, null, 0)}
Known issues already detected (do NOT repeat): ${(knownIssueIds || []).join(', ') || 'none'}
Do NOT report hero CTA/headline, footer presence, ABN, reviews, services — those are owned by other checks. Judge ONLY design craft.

Score each 0-10 (10 = excellent, professional, credible local trade):
- visual_hierarchy: page-wide focal order; eye flows naturally section to section.
- imagery_quality: real roofing/trade photos, consistent treatment, on-brand (vs stock/lifestyle/missing).
- spacing_rhythm: consistent vertical rhythm + section padding; no cramped/wall-of-text or huge dead gaps.
- cross_section_consistency: sections feel like ONE designed system (type scale, color, card style consistent), not bolted-on.
- mobile_craft: mobile layout quality (stacking, tap spacing, no overflow/cramping) across the page.
- ai_slop: free of AI-default clichés. Penalize any of: ${AS_TRADE_SLOP.join('; ')}. (10 = none, 0 = heavy). Cite which you saw.

Return STRICT JSON only:
{"visual_hierarchy":{"score":N,"note":"..."},"imagery_quality":{"score":N,"note":"..."},"spacing_rhythm":{"score":N,"note":"..."},"cross_section_consistency":{"score":N,"note":"..."},"mobile_craft":{"score":N,"note":"..."},"ai_slop":{"score":N,"note":"..."},"evidence":["short observation with where"],"problems":["craft problem as cause -> effect -> fix"]}`;
}

const FACT_CONFLICT = [
  { fact: 'footer_exists', when: true, re: /missing footer|no footer|footer (?:is )?(?:missing|absent)/i },
  { fact: 'hero_cta_above_fold', when: true, re: /no (?:visible )?cta|missing cta/i },
];
function reconcile(problems, facts) {
  const kept = [], conflicts = [];
  for (const p of (problems || [])) {
    const hit = FACT_CONFLICT.find((r) => facts && facts[r.fact] === r.when && r.re.test(String(p)));
    if (hit) conflicts.push({ problem: String(p), conflicts_with: `${hit.fact}=${hit.when}` });
    else kept.push(p);
  }
  return { kept, conflicts };
}

function providerLabel(res) { return res?.provider || res?.tool || (res?._source && String(res._source).replace(/^ai-completed:/, '')) || undefined; }

async function judgeViewport(imagePath, facts, knownIssueIds, viewport) {
  const prompt = buildPrompt(facts, knownIssueIds, viewport);
  const validate = (output) => { const parsed = extractJson(output); return parsed ? { ok: true, parsed } : { ok: false, error: 'no JSON' }; };
  let res;
  try { res = await runTask('eval_design_review', { prompt, imagePath, timeoutMs: 120000, validate }); }
  catch (e) { return { ok: false, reason: e.message.slice(0, 80) }; }
  if (!res?.ok) return { ok: false, reason: res?.reason || 'llm unavailable', provider: providerLabel(res) };
  const parsed = res.parsed || extractJson(res.output || '');
  if (!parsed) return { ok: false, reason: 'no JSON parsed', provider: providerLabel(res) };
  const r = reconcile(parsed.problems, facts);
  // codex R67: model perception limits are NOT design defects. If a dim's note
  // says it couldn't assess, set the dim to null (N/A) — excluded from score +
  // findings — instead of coercing to a 0 penalty (same class as footer/CTA FP).
  const scores = {};
  for (const d of DIMS) {
    const note = parsed[d]?.note || '';
    if (CANT_ASSESS.test(note)) { scores[d] = null; continue; }
    const n = Number(parsed[d]?.score ?? parsed[d]);
    scores[d] = Number.isFinite(n) ? n : null;
  }
  return { ok: true, viewport, scores, notes: Object.fromEntries(DIMS.map(d => [d, parsed[d]?.note || ''])), evidence: parsed.evidence || [], problems: r.kept, conflicts: r.conflicts, provider: providerLabel(res), model: res?.model };
}

export async function runDesignerReview(htmlFiles, ctx, geometryFacts = null, knownIssueIds = []) {
  if (!htmlFiles?.length) return { status: 'skipped', score: null, reason: 'no html files' };
  const f = htmlFiles[0];
  const base = path.basename(f);
  const facts = (geometryFacts && geometryFacts[base]) || {};
  const shots = await renderOverview(f, path.join(ctx.outputDir || path.dirname(f), '_t4-shots'));
  if (!shots) return { status: 'skipped', score: null, reason: 'playwright unavailable' };

  const viewports = {}; const allConflicts = []; const allProblems = [];
  for (const [vp, img] of Object.entries(shots)) {
    const j = await judgeViewport(img, facts, knownIssueIds, vp);
    viewports[vp] = j;
    if (j.ok) { allConflicts.push(...j.conflicts); allProblems.push(...j.problems.map(p => ({ viewport: vp, problem: p }))); }
  }
  const okVps = Object.values(viewports).filter(v => v.ok);
  if (okVps.length === 0) return { status: 'skipped', score: null, reason: Object.values(viewports).map(v => v.reason).join(' · '), viewports };

  // N/A dims (codex R67) excluded from score denominator
  let sum = 0, n = 0, na = 0;
  for (const v of okVps) for (const d of DIMS) { if (v.scores[d] == null) { na++; continue; } sum += v.scores[d]; n++; }
  const score_100 = n ? Math.round((sum / n) * 10) : null;

  const findings = [];
  for (const v of okVps) for (const d of DIMS) {
    if (v.scores[d] != null && v.scores[d] <= 4) findings.push({ severity: v.scores[d] <= 2 ? 'P1' : 'P2', dim: `T4.${d}`, page: base, where: `${d} (${v.viewport})`, what: `${d} weak (${v.scores[d]}/10): ${v.notes[d] || ''}`.slice(0, 160), why: 'Site design craft below bar (T4 designer review · website-ui-audit)', fix: (allProblems.find(p => p.viewport === v.viewport)?.problem) || `Improve ${d}` });
  }

  return { status: 'wired', dim: 'T4_designer_review', score: score_100, na_dims: na, viewports, facts, findings, false_positive_fact_conflicts: allConflicts, model: okVps[0]?.model, provider: okVps[0]?.provider };
}

export { reconcile as _reconcileT4 };
