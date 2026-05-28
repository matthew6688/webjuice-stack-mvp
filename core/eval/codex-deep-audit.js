/**
 * core/eval/codex-deep-audit · per-page LLM content audit · config-driven dimensions.
 *
 * Default 5 dims (D1-D5) but caller can pass custom dims if audit angle changes.
 * Output: per-page { scores, strengths, weaknesses, hallucinations, leakQuotes }.
 *
 * Used by pl:iterate-site to produce FIX-INSTRUCTIONS feedback to OD.
 * Memory: feedback_od_hard_rules_data_threshold.md (audit dims may evolve · keep config-driven)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const DEFAULT_DIMS = [
  { key: 'D1_facts_accuracy',  prompt: 'Factual accuracy — does copy match the supplied business facts? Are claims invented?' },
  { key: 'D2_voice_authentic', prompt: 'Voice authenticity — does it read like an Australian tradesman website, or an AI consultant proposal?' },
  { key: 'D3_specificity',     prompt: 'Specificity — concrete suburbs / materials / dates / people, or generic "trusted local partner" filler?' },
  { key: 'D4_conversion',      prompt: 'Conversion clarity — phone visible · form / CTA visible · clear next step?' },
  { key: 'D5_leak_free',       prompt: 'Leak-free — any "this concept", "the redesign", "supplied facts", "preview build", "AI-generated", "the brief calls for", meta-commentary, or builder-instruction language?' },
  // D6 per SOP-AUDIT-STANDARD-V2 §9 + codex R30 Q-KK-1 (B) · positive prose quality (NOT absence)
  { key: 'D6_engagement_persuasion', prompt: 'Engagement & persuasion — score 0-10. Hook strength (does H1 + lead make a homeowner want to read more vs feel like generic SaaS), benefit-vs-feature (copy leads with what HOMEOWNER GETS, not what business does), objection-preempt (preempts cost / timeline / warranty / disruption / trust worries), CTA persuasion ("Request written quote" beats "Submit" / phone CTA beats "Learn more"), proof density (specific years · suburbs · materials · license # · cited reviews vs vague claims). 10/10 = a homeowner reading this is genuinely closer to calling · 0/10 = wallpaper. Penalize: passive voice · hedges ("typically") · jargon-as-authority. Reward: tradesman directness · numbered specifics · acknowledging what can go wrong.' },
];

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function runCodex(prompt, timeoutMs = 4 * 60 * 1000) {
  return new Promise(resolve => {
    const p = spawn('codex', ['exec'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch {}; resolve({ out, err: 'timeout' }); }, timeoutMs);
    p.stdout.on('data', c => out += c.toString());
    p.stderr.on('data', c => err += c.toString());
    p.on('exit', () => { clearTimeout(t); resolve({ out, err }); });
    p.stdin.write(prompt); p.stdin.end();
  });
}

/**
 * Audit a single HTML page.
 * @param {object} opts
 * @param {string} opts.pageFile        — file name (for output JSON)
 * @param {string} opts.html            — raw HTML to audit
 * @param {object} opts.facts           — facts.json content (full)
 * @param {string} [opts.brief]         — customer-brief.md text (provides narrative fact reference)
 * @param {Array}  [opts.dims]          — dimension list (default DEFAULT_DIMS)
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<object>}
 */
export async function auditPage({ pageFile, html, facts, brief = '', dims = DEFAULT_DIMS, timeoutMs }) {
  const text = stripHtml(html).slice(0, 8000);
  if (text.length < 200) return { page: pageFile, skipped: true, reason: 'too thin' };

  // Full structured facts (everything we know · verbatim values)
  const factsJson = JSON.stringify(facts, null, 2).slice(0, 6000);
  // Customer brief narrative — contains rich facts not always in real_facts (founding year, partnerships, named projects, etc.)
  const briefExcerpt = brief.slice(0, 6000);

  const dimText = dims.map((d, i) => `${d.key} · ${d.prompt}`).join('\n');
  const prompt = `You audit content quality on a real Australian roofing-business website page.

You have TWO sources of TRUE facts about this business — both are authoritative reference material:

═══════ STRUCTURED FACTS (facts.json) ═══════
${factsJson}

═══════ NARRATIVE FACTS (customer-brief.md excerpts) ═══════
${briefExcerpt}

CRITICAL RULE: A claim is ONLY a hallucination if it directly CONTRADICTS the structured facts OR the narrative facts above. Do NOT flag a claim as hallucination merely because it is not explicitly listed in the structured facts — it may be in the narrative facts (founding year, partnerships, project counts, materials, supplier relationships, named suburbs, etc.). When in doubt, trust the brief.

═══════ DIMENSIONS to score (0-10 each · 10 = excellent) ═══════
${dimText}

═══════ OUTPUT ═══════
- TOP 2 strengths (one short sentence each)
- TOP 2 weaknesses (one short sentence each · prefer verbatim quote where possible)
- HALLUCINATIONS — claims that CONTRADICT the two fact sources above (verbatim quote + what the source actually says). NOT claims merely absent from structured facts but consistent with narrative.
- LEAK_QUOTES — verbatim quotes (≤30 words each) of meta-commentary / builder-instruction language found in the HTML (e.g. "this concept", "the brief calls for", "pending client confirmation", "without inventing", "supplied facts", "what the site needs to prove")

Output JSON ONLY:
{
  "page": "${pageFile}",
  "scores": { ${dims.map(d => `"${d.key}": 0`).join(', ')}, "total": 0 },
  "strengths": ["..."],
  "weaknesses": ["..."],
  "hallucinations": ["quote · contradicts: source X says Y"],
  "leak_quotes": ["verbatim quote"]
}

═══════ PAGE TEXT to audit ═══════
"""
${text}
"""

Return ONLY the JSON. Default to NOT flagging — only flag when you can identify a specific contradiction.`;

  const r = await runCodex(prompt, timeoutMs);
  const m = (r.out || '').match(/\{[\s\S]*\}/);
  if (!m) return { page: pageFile, parsed: null, error: 'no JSON in response', raw_excerpt: (r.out || '').slice(0, 300) };
  try {
    const j = JSON.parse(m[0]);
    // Compute total if missing
    if (j.scores && !j.scores.total) {
      j.scores.total = Object.entries(j.scores).filter(([k]) => k !== 'total').reduce((a, [, v]) => a + (Number(v) || 0), 0);
    }
    return { page: pageFile, parsed: j };
  } catch (e) {
    return { page: pageFile, parsed: null, error: 'parse failed: ' + e.message, raw_excerpt: m[0].slice(0, 300) };
  }
}

/**
 * Audit a folder of HTML pages.
 * @param {object} opts
 * @param {string} opts.dir             — directory with *.html
 * @param {object} opts.facts           — facts.json
 * @param {string} [opts.brief]         — customer-brief.md text (rich narrative facts · prevents over-flagging)
 * @param {Array}  [opts.dims]
 * @param {RegExp} [opts.fileFilter]    — filter pages
 * @returns {Promise<Array>}
 */
export async function auditSite({ dir, facts, brief = '', dims, fileFilter }) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  const results = [];
  for (const f of files) {
    if (fileFilter && !fileFilter.test(f)) continue;
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const r = await auditPage({ pageFile: f, html, facts, brief, dims });
    results.push(r);
  }
  return results;
}

/**
 * Format audit results into a FIX-INSTRUCTIONS section.
 * Caller appends this to existing FIX-INSTRUCTIONS.md.
 * @param {Array} results — auditSite output
 * @param {object} opts
 * @returns {string}
 */
export function formatAuditFeedback(results, opts = {}) {
  const minScoreThreshold = opts.dimMinScore || 6;
  const lines = ['## Codex deep audit (per-page · 5-dim)', ''];

  // Per-page score table
  lines.push('| Page | D1 facts | D2 voice | D3 specific | D4 CTA | D5 leak | Total |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    if (!r.parsed) { lines.push(`| ${r.page} | — | — | — | — | — | parse-fail |`); continue; }
    const s = r.parsed.scores || {};
    lines.push(`| ${r.page} | ${s.D1_facts_accuracy ?? '?'} | ${s.D2_voice_authentic ?? '?'} | ${s.D3_specificity ?? '?'} | ${s.D4_conversion ?? '?'} | ${s.D5_leak_free ?? '?'} | ${s.total ?? '?'}/50 |`);
  }
  lines.push('');

  // Per-page weaknesses on low-scoring pages
  const lowPages = results.filter(r => r.parsed && r.parsed.scores && (r.parsed.scores.total || 0) < 5 * minScoreThreshold);
  if (lowPages.length) {
    lines.push(`## Pages scoring below ${minScoreThreshold * 5}/50 (must fix)`);
    for (const r of lowPages) {
      lines.push(`### ${r.page} (${r.parsed.scores.total}/50)`);
      (r.parsed.weaknesses || []).forEach(w => lines.push(`- ${w}`));
      lines.push('');
    }
  }

  // Hallucinations — definite must-fix
  const allHal = [];
  for (const r of results) {
    if (!r.parsed) continue;
    for (const h of r.parsed.hallucinations || []) allHal.push(`[${r.page}] ${h}`);
  }
  if (allHal.length) {
    lines.push('## Hallucinations (claims NOT in business facts · MUST REMOVE)');
    allHal.slice(0, 30).forEach(h => lines.push(`- ${h}`));
    lines.push('');
  }

  // Leak quotes — verbatim meta-language found
  const allLeaks = [];
  for (const r of results) {
    if (!r.parsed) continue;
    for (const q of r.parsed.leak_quotes || []) allLeaks.push(`[${r.page}] "${q}"`);
  }
  if (allLeaks.length) {
    lines.push('## Meta-language quotes to REMOVE from copy (verbatim hits)');
    allLeaks.slice(0, 30).forEach(q => lines.push(`- ${q}`));
    lines.push('');
  }

  return lines.join('\n');
}
