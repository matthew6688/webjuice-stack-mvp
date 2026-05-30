/**
 * core/audit/persona-copy-judge.js · Persona-POV COPY-QUALITY judge (Matthew 2026-05-30).
 *
 * The deterministic copy gate (pl-copy-audit + pl-audit-v4 T1/density/voice) decides HONESTY,
 * DENSITY, VOICE-RULES, STRUCTURE — the things rules can verify. It cannot decide whether the
 * copy actually PERSUADES the target buyer. This module does that, the way hero-judge.js judges
 * the hero aesthetic: it reads the page's COPY (text) and scores it FROM THE PRIMARY PERSONA'S
 * perspective, against a rubric derived from that persona's OWN spec (job-to-be-done, decision
 * triggers, risk concerns/objections, trust levers, bounce triggers, literacy, voice).
 *
 * Standard (the rubric), grounded in core/audit/personas/<segment>.js:
 *   1. job_fit            — does the copy serve this buyer's job-to-be-done?
 *   2. decision_enablement— does it give what they need to decide (decision_triggers)?
 *   3. objection_handling — does it answer their risk_concerns / hesitations?
 *   4. trust_levers       — does it deploy their top trust levers?
 *   5. bounce_avoidance   — does it AVOID their bounce_triggers / forbidden_signals?
 *   6. information_level   — pitched to their literacy (knows / does_not_know)?
 *   7. voice_fit          — matches the persona voice (e.g. confident · evidence-led · no hype)?
 *   8. clarity_next_step  — clear, scannable, obvious next action for THIS buyer?
 *
 * Honesty guard (mirrors hero-judge R64): deterministic facts are authoritative. The judge is told
 * the facts and forbidden to re-audit them or to reward fabrication. A LOW score must cite a concrete
 * persona gap, not "add a fake stat".
 *
 * Cascade: runTask('eval_persona_copy') (claude sonnet → codex → ollama qwen3.6). Premium/full tier;
 * subjective → ADVISORY + N-run averaged (vision-noise lesson). Does NOT gate batch on its own.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { extractJson, runTask } from '../autoresearch/llm-cascade.js';
import personas from './personas/index.js';

function loadPersona(ctx) {
  const seg = ctx?.primary_segment || ctx?.brief?.primary_segment || 'planned-upgrade';
  const p = personas[seg] || personas['planned-upgrade'];
  const s = (p && (p.segment || p.default || p)) || {};
  return { id: s.id || seg, ...s };
}

function unescapeStrip(t) {
  return String(t || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Pull the page's COPY (text only) section by section. */
function extractPageCopy(html) {
  const $ = cheerio.load(html);
  const txt = (sel) => $(sel).map((_, e) => unescapeStrip($(e).text())).get().filter(Boolean);
  const hero = {
    h1: txt('h1')[0] || null,
    subhead: txt('.lead, .hero-grid p').slice(0, 1)[0] || null,
    chips: txt('.proof-chips *, .trust-chip, [class*="chip"]').slice(0, 8),
  };
  const services = [];
  $('.story-grid > article, #services article').each((_, el) => {
    const name = unescapeStrip($(el).find('h3').first().text());
    const desc = unescapeStrip($(el).find('p').first().text());
    if (name) services.push(desc ? `${name}: ${desc}` : name);
  });
  const about = [];
  const am = html.match(/id="about-h"[\s\S]*?<\/header>([\s\S]*?)<\/section>/);
  if (am) for (const p of am[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) { const s = unescapeStrip(p[1]); if (s.split(' ').length > 4) about.push(s); }
  const reviews = txt('.review blockquote, .reviews-grid blockquote').slice(0, 4);
  const strap = txt('.strap-grid *, .trust-bar *').slice(0, 10);
  return { hero, services, about, reviews, strap };
}

function fmtList(a, n = 8) { return (a || []).slice(0, n).map((x) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') || '(none)'; }

function buildPrompt(copy, persona, facts) {
  const know = persona.information_state?.knows || [];
  const dontKnow = persona.information_state?.does_not_know || [];
  const weights = Object.entries(persona.signal_weights || {}).map(([k, v]) => `${k}:${v}`).join(', ');
  return `You are a REAL prospective customer evaluating a local Australian roofing business's website COPY — not a marketer, not an SEO. Judge ONLY the words: do they convince YOU to make contact?

# WHO YOU ARE (the target buyer for this site)
- Segment: ${persona.display_name || persona.id}
- Your job-to-be-done: "${persona.job_to_be_done || 'get the roof sorted properly'}"
- What you already understand: ${know.join(', ') || '(general homeowner)'}
- What you do NOT understand (don't be talked over): ${dontKnow.join(', ') || '(technical roofing detail)'}
- What makes you DECIDE to contact them (decision triggers): ${fmtList(persona.decision_triggers)}
- Your worries / objections (risk concerns): ${fmtList(persona.risk_concerns)}
- What earns your trust most (top levers): ${fmtList(persona.trust_levers_top_3)}
- What makes you LEAVE (bounce triggers): ${fmtList(persona.bounce_triggers || persona.forbidden_signals)}
- Voice you respond to: ${persona.voice_modifiers?.tone || 'plain, honest, specific — no hype'}
- What you weight most (signal:weight): ${weights || '(balanced)'}

# DETERMINISTIC FACTS (already verified TRUE — do NOT re-audit these or reward inventing new stats)
${JSON.stringify(facts || {}, null, 0)}

# THE WEBSITE COPY (text only)
## Hero
H1: ${copy.hero.h1 || '(none)'}
Subhead: ${copy.hero.subhead || '(none)'}
Chips: ${(copy.hero.chips || []).join(' · ') || '(none)'}
## Services
${fmtList(copy.services, 8)}
## About
${(copy.about || []).join('\n') || '(none)'}
## Reviews
${fmtList(copy.reviews, 4)}
## At-a-glance / trust strip
${(copy.strap || []).join(' · ') || '(none)'}

# YOUR JUDGEMENT — score each 0-10 (10 = excellent FOR YOU), with a concrete reason
- job_fit: does the copy clearly serve YOUR job-to-be-done?
- decision_enablement: does it give you what you need to decide (your decision triggers above)?
- objection_handling: does it ease your specific worries/objections?
- trust_levers: does it deploy the things that earn YOUR trust?
- bounce_avoidance: does it AVOID the things that would make you leave? (10 = none present)
- information_level: pitched to what you know — not over-technical, not condescending?
- voice_fit: does the tone match what YOU respond to?
- clarity_next_step: in seconds, is it clear what they do and what to do next?

Rules:
- Judge the COPY, not the facts. A low score must name a CONCRETE persona gap (what's missing/weak FOR THIS BUYER), never "add a stat" or "make a stronger claim than the facts support".
- gaps = the 1-4 highest-impact copy changes that would make YOU more likely to contact them, each phrased as a concrete edit.

Return STRICT JSON only:
{"scores":{"job_fit":N,"decision_enablement":N,"objection_handling":N,"trust_levers":N,"bounce_avoidance":N,"information_level":N,"voice_fit":N,"clarity_next_step":N},"would_contact":true|false,"persona_fit":N,"gaps":["concrete edit 1","..."],"strengths":["..."]}`;
}

function validate(rawOutput) {
  const parsed = extractJson(rawOutput);
  if (!parsed || !parsed.scores) return { ok: false, error: 'no scores' };
  const vals = Object.values(parsed.scores).filter((v) => typeof v === 'number');
  if (vals.length < 6) return { ok: false, error: 'too few scored criteria' };
  return { ok: true, parsed };
}

const WEIGHTS = {
  job_fit: 0.18, decision_enablement: 0.18, objection_handling: 0.14, trust_levers: 0.14,
  bounce_avoidance: 0.12, information_level: 0.08, voice_fit: 0.08, clarity_next_step: 0.08,
};

// Normalise a single criterion to a 0-10 scale (codex review 2026-05-30): a model that returns 0-100
// on one field must not distort the weighted composite. >10 ⇒ treat as 0-100 and divide; then clamp 0-10.
function norm10(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  let x = v > 10 ? v / 10 : v;
  return Math.max(0, Math.min(10, x));
}

function composite(scores) {
  let sum = 0, w = 0;
  for (const [k, weight] of Object.entries(WEIGHTS)) {
    const v = norm10(scores[k]);
    if (v != null) { sum += v * weight; w += weight; }
  }
  return w ? Math.round((sum / w) * 10) : null; // 0-100
}

/**
 * @param {string[]} htmlFiles
 * @param {object} ctx { primary_segment?, brief?, facts? }
 * @returns {Promise<{status, dim, persona, score, scores, would_contact, gaps, strengths, findings}>}
 */
export async function runPersonaCopyJudge(htmlFiles, ctx = {}) {
  const persona = loadPersona(ctx);
  const file = (htmlFiles || []).find((f) => /index/.test(f)) || (htmlFiles || [])[0];
  if (!file) return { status: 'skipped', dim: 'persona_copy_quality', reason: 'no html' };
  let html; try { html = fs.readFileSync(file, 'utf8'); } catch { return { status: 'skipped', dim: 'persona_copy_quality', reason: 'read failed' }; }
  const copy = extractPageCopy(html);
  const prompt = buildPrompt(copy, persona, ctx.facts || {});
  let res;
  try { res = await runTask('eval_persona_copy', { prompt, timeoutMs: 120000, validate }); }
  catch (e) { return { status: 'skipped', dim: 'persona_copy_quality', reason: e.message, persona: persona.id }; }
  if (!res?.ok) return { status: 'skipped', dim: 'persona_copy_quality', reason: res?.reason || 'llm failed', persona: persona.id };
  const parsed = extractJson(res.output);
  if (!parsed?.scores) return { status: 'skipped', dim: 'persona_copy_quality', reason: 'unparseable', persona: persona.id };
  // Always derive the 0-100 score from the weighted per-criterion scores (the LLM's own persona_fit
  // field uses an ambiguous 0-10/0-100 scale — composite() is consistent).
  const score = composite(parsed.scores);
  // gaps with a sub-threshold criterion become advisory findings (audit issues)
  const findings = (parsed.gaps || []).slice(0, 4).map((g) => ({
    severity: 'P2', dim: 'persona_copy_quality', rule: 'persona_copy_gap', page: path.basename(file),
    what: `[${persona.display_name || persona.id}] ${g}`,
    why: `Copy gap from the target buyer's perspective (${persona.id}) — advisory; does not block ship`,
    fix: g,
  }));
  return {
    status: 'wired', dim: 'persona_copy_quality', persona: persona.id, persona_name: persona.display_name,
    score, scores: parsed.scores, would_contact: parsed.would_contact ?? null,
    gaps: parsed.gaps || [], strengths: parsed.strengths || [],
    model: res.model, tier_used: res.tier_used, findings,
  };
}
