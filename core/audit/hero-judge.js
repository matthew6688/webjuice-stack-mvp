/**
 * core/audit/hero-judge.js · Hero-fold LLM aesthetic judge (codex R62/R64).
 *
 * The deterministic hero rubric (pl-audit-v4 runHeroRubric + runVisualGeometry)
 * decides FACTS (H1 words, CTA above fold, tap size, tel link, specific number).
 * This module judges the AESTHETIC layer the deterministic checks cannot:
 *   - image_relevance   (real trade photo vs stock vs logo · on-brand)
 *   - visual_hierarchy  (does the primary CTA / message dominate)
 *   - ai_slop           (gradient / rounded-card / purple-blue cliché)
 *   - five_second_test  (can the primary persona grasp business + next action)
 *
 * Hard rule (codex R64 D4): deterministic facts are authoritative. The LLM is
 * told the facts and forbidden to audit them; any LLM problem that contradicts a
 * fact is downgraded to a false_positive_fact_conflict and excluded.
 *
 * Cascade: runTask('eval_hero_quality') = claude sonnet → haiku → ollama gemma3.
 * full/premium tier only; LLM unavailable → { status: 'skipped' }.
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractJson, runTask } from '../autoresearch/llm-cascade.js';
import personas from './personas/index.js';

const FOLD_DESKTOP = 900;

function loadPersona(ctx) {
  const seg = ctx?.primary_segment || 'planned-upgrade';
  const p = personas[seg] || personas['planned-upgrade'];
  return p && (p.segment || p.default || p) || { display_name: 'a local homeowner', job_to_be_done: 'get the roof done properly', signal_weights: {} };
}

async function renderHeroShots(htmlFile, outDir) {
  let playwright;
  try { playwright = await import('playwright'); } catch { return null; }
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: true });
  const out = {};
  try {
    const url = 'file://' + path.resolve(htmlFile);
    const d = await browser.newContext({ viewport: { width: 1280, height: FOLD_DESKTOP } });
    const dp = await d.newPage(); await dp.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    out.desktop = path.join(outDir, 'hero-desktop-fold.png'); await dp.screenshot({ path: out.desktop });
    const m = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true });
    const mp = await m.newPage(); await mp.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    out.mobile = path.join(outDir, 'hero-mobile-fold.png'); await mp.screenshot({ path: out.mobile });
  } finally { await browser.close().catch(() => {}); }
  return out;
}

function buildHeroPrompt(facts, persona, viewport) {
  const sw = Object.entries(persona.signal_weights || {}).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(', ');
  return `You are judging ONLY the hero / first-viewport (above the fold) of a local Australian roofing business website, on a ${viewport} screen.

You are evaluating it as: ${persona.display_name} — job-to-be-done: "${persona.job_to_be_done}". You see this fold for 5 seconds.

DETERMINISTIC FACTS (already measured · TRUE · you must NOT re-audit or contradict these):
${JSON.stringify(facts, null, 0)}
Do NOT report problems about footer presence, CTA existence/position, H1 word count, tel link, or specific-number presence — those are decided by the facts above. Judge ONLY aesthetics/perception.

Score each 0-10 (10 = excellent):
- image_relevance: hero image is a real roofing/trade photo relevant to THIS business (10) vs generic stock / lifestyle / logo-as-hero / no image (0).
- visual_hierarchy: does the primary message + CTA visually dominate; clear focal order (10) vs flat / competing / wall-of-text (0).
- ai_slop: free of AI-default clichés — soft gradients, rounded glass cards, purple/blue generic palette, "your trusted partner" vibe (10 = no slop, 0 = heavy slop).
- five_second_test: in 5s can ${persona.display_name} tell what the business does + what to do next, weighted by [${sw}] (10 = instantly, 0 = confused).

Return STRICT JSON only:
{"image_relevance":{"score":N,"note":"..."},"visual_hierarchy":{"score":N,"note":"..."},"ai_slop":{"score":N,"note":"..."},"five_second_test":{"score":N,"note":"..."},"evidence":["short observation", "..."],"problems":["aesthetic problem phrased as cause -> effect -> fix", "..."]}`;
}

// codex R64 D4: facts authoritative — drop LLM problems that deny a fact.
const FACT_CONFLICT = [
  { fact: 'footer_exists', when: true, re: /missing footer|no footer|footer (?:is )?(?:missing|absent)/i },
  { fact: 'hero_cta_above_fold', when: true, re: /no (?:visible )?cta|missing cta|cta (?:is )?(?:missing|absent|below)/i },
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

const DIMS = ['image_relevance', 'visual_hierarchy', 'ai_slop', 'five_second_test'];

function providerLabel(res) {
  if (res?.provider) return res.provider;
  if (res?.tool) return res.tool;
  if (res?._source) return String(res._source).replace(/^ai-completed:/, '');
  return undefined;
}

async function judgeViewport(imagePath, facts, persona, viewport) {
  const prompt = buildHeroPrompt(facts, persona, viewport);
  let res;
  const validate = (output) => {
    const parsed = extractJson(output);
    return parsed ? { ok: true, parsed } : { ok: false, error: 'no JSON parsed' };
  };
  try { res = await runTask('eval_hero_quality', { prompt, imagePath, timeoutMs: 120000, validate }); }
  catch (e) { return { ok: false, reason: e.message.slice(0, 80) }; }
  if (!res?.ok) return { ok: false, reason: res?.reason || 'llm unavailable', provider: providerLabel(res), fallback_chain: res?.fallback_chain };
  const parsed = res.parsed || extractJson(res.output || '');
  if (!parsed) return { ok: false, reason: 'no JSON parsed', provider: providerLabel(res) };
  const r = reconcile(parsed.problems, facts);
  const scores = {}; for (const d of DIMS) scores[d] = Number(parsed[d]?.score ?? parsed[d]) || 0;
  return { ok: true, viewport, scores, notes: Object.fromEntries(DIMS.map(d => [d, parsed[d]?.note || ''])), evidence: parsed.evidence || [], problems: r.kept, conflicts: r.conflicts, provider: providerLabel(res), model: res?.model };
}

export async function runHeroJudge(htmlFiles, ctx, geometryFacts = null) {
  if (!htmlFiles?.length) return { status: 'skipped', reason: 'no html files' };
  const persona = loadPersona(ctx);
  const f = htmlFiles[0]; // hero judge = home page
  const base = path.basename(f);
  const facts = (geometryFacts && geometryFacts[base]) || {};
  const shots = await renderHeroShots(f, path.join(ctx.outputDir || path.dirname(f), '_hero-shots'));
  if (!shots) return { status: 'skipped', reason: 'playwright unavailable' };

  const viewports = {};
  const allConflicts = []; const allProblems = [];
  for (const [vp, imgPath] of Object.entries(shots)) {
    const j = await judgeViewport(imgPath, facts, persona, vp);
    viewports[vp] = j;
    if (j.ok) { allConflicts.push(...j.conflicts); allProblems.push(...j.problems.map(p => ({ viewport: vp, problem: p }))); }
  }
  const okVps = Object.values(viewports).filter(v => v.ok);
  if (okVps.length === 0) return { status: 'skipped', reason: Object.values(viewports).map(v => v.reason).join(' · '), viewports };

  // hero_visual_score = mean of 4 dims across ok viewports · scaled 0-100
  let sum = 0, n = 0;
  for (const v of okVps) for (const d of DIMS) { sum += v.scores[d]; n++; }
  const hero_visual_score = n ? Math.round((sum / n) * 10) : null;

  // findings for issues.json (aesthetic · P1 if a dim ≤4, else P2)
  const findings = [];
  for (const v of okVps) for (const d of DIMS) {
    if (v.scores[d] <= 4) {
      const severity = d === 'image_relevance' && v.viewport === 'mobile' ? 'P2' : (v.scores[d] <= 2 ? 'P1' : 'P2');
      findings.push({ severity, dim: `vis-hero.${d}`, page: base, where: `hero (${v.viewport})`, what: `${d} weak (${v.scores[d]}/10): ${v.notes[d] || ''}`.slice(0, 160), why: 'Hero aesthetic below bar (LLM judge · pl-local-trade-page-spec vis-H)', fix: (allProblems.find(p => p.viewport === v.viewport)?.problem) || `Improve ${d} in the hero` });
    }
  }

  return { status: 'wired', dim: 'vis_hero_llm', hero_visual_score, viewports, facts, findings, false_positive_fact_conflicts: allConflicts, persona: persona.display_name, model: okVps[0]?.model, provider: okVps[0]?.provider };
}

export { reconcile as _reconcileHeroFacts, buildHeroPrompt as _buildHeroPrompt };
