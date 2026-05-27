#!/usr/bin/env node
/**
 * pl:llm-page-copywriter · Given a page that was pre-architected, write the
 * copy for each block. The block list is already decided; the writer's only
 * job is to fill in the words.
 *
 * Inputs:
 *   - clients/<slug>/v2/customer-brief.md       (canonical facts + voice)
 *   - clients/<slug>/v2/site-architecture.json  (per-page block plan)
 *   - --page <name>                              (which page to write)
 *
 * Output: clients/<slug>/v2/wireframes/wireframe-<page>-<backend>.json
 *
 * Usage:
 *   npm run pl:llm-page-copywriter -- --slug vicwest-roofing --page roof-replacements
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getSegment, defaultPrimary, defaultSecondaries, SEGMENT_IDS } from '../../core/audit/personas/index.js';

const args = {};
const BOOL_FLAGS = new Set(['dryrun', 'dry-run', 'help', 'verbose']);
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    const k = process.argv[i].slice(2);
    if (BOOL_FLAGS.has(k) || !process.argv[i + 1] || process.argv[i + 1].startsWith('--')) {
      args[k] = true;
    } else {
      args[k] = process.argv[++i];
    }
  }
}
const slug = args.slug;
const page = args.page;
if (!slug || !page) { console.error('Usage: --slug <slug> --page <page-id> [--llm codex|claude|ollama]'); process.exit(1); }
const llm = args.llm || 'codex';
const family = args.family || 'industrial-trade-credible';

const REPO = process.cwd();
const v2 = path.join(REPO, 'clients', slug, 'v2');
const wfDir = path.join(v2, 'wireframes');
fs.mkdirSync(wfDir, { recursive: true });

function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

const brief = readText(path.join(v2, 'customer-brief.md'));
const arch = readJson(path.join(v2, 'site-architecture.json'));
if (!brief) { console.error('No customer-brief.md'); process.exit(1); }
if (!arch) { console.error('No site-architecture.json · run pl:llm-site-architect first'); process.exit(1); }

const pagePlan = (arch.pages || []).find(p => p.id === page);
if (!pagePlan) { console.error(`Page "${page}" not found in site-architecture.json · available: ${(arch.pages||[]).map(p=>p.id).join(', ')}`); process.exit(1); }

const otherPages = (arch.pages || []).filter(p => p.id !== page).map(p => ({
  id: p.id,
  role: p.role,
  content_focus: p.content_focus,
  block_types: (p.blocks || []).map(b => b.type),
}));

const coreExtract = readJson(path.join(v2, 'core-extract.json'));
const realFacts = coreExtract?.brief?.real_facts || {};
const contentAssets = coreExtract?.brief?.content_assets || {};
const entity = (() => {
  const id = (brief.match(/business_id:\s*"?([^"\n]+)/) || [])[1];
  return id ? readJson(path.join(REPO, 'data/leads/entities', `${id}.json`)) : null;
})();
const reviewsFixture = (() => {
  const id = entity?.entity_key || (brief.match(/business_id:\s*"?([^"\n]+)/) || [])[1];
  return id ? readJson(path.join(REPO, 'data/v2/fixtures/reviews', `${id}.json`)) : null;
})();
const verbatimReviews = (reviewsFixture?.fetched?.reviews || []).map(r => ({ author: r.author_name, rating: r.rating, text: r.text }));

const bestPractices = readText(path.join(REPO, 'templates/roofing/families', family, 'BEST-PRACTICES.md'));

// ─── Persona overlay + base voice merge (Phase A.1 Step 5 · codex R21 Q-DD-4) ──
// Read brief YAML for primary_segment (fall back to default planned-upgrade).
// Load segment's voice_modifiers + signal priorities. Load base voice constants
// from pl-au-trade-voice.json. Codex Q-DD-5: secondary segments contribute
// content cues only, NOT voice merge (single voice owner per page).
function loadBriefSegment() {
  const briefYamlPath = path.join(v2, 'single-page-brief.yaml');
  let primary = defaultPrimary();
  let secondaries = defaultSecondaries();
  try {
    const yaml = fs.readFileSync(briefYamlPath, 'utf8');
    const pMatch = yaml.match(/^primary_segment:\s*([a-z-]+)/m);
    const sMatch = yaml.match(/^secondary_segments:\s*\[([^\]]*)\]/m);
    if (pMatch) primary = pMatch[1].trim();
    if (sMatch) secondaries = sMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(s => SEGMENT_IDS.includes(s));
  } catch { /* fall back to defaults */ }
  return { primary, secondaries };
}
const { primary: PRIMARY_SEGMENT, secondaries: SECONDARY_SEGMENTS } = loadBriefSegment();
let primarySegment, voiceJson;
try { primarySegment = getSegment(PRIMARY_SEGMENT); } catch { primarySegment = getSegment(defaultPrimary()); }
try { voiceJson = readJson(path.join(REPO, 'skills/pl-au-trade-voice/pl-au-trade-voice.json')); } catch { voiceJson = null; }

const vc = voiceJson?.constants || {};
const baseBannedPhrases = (vc.banned_phrases || []).slice(0, 20);
const baseUsSpelling = (vc.us_spelling_violations_per_au || []).slice(0, 10);
const baseForbiddenNiche = (vc.forbidden_niche_claims_roofing || []).slice(0, 6);
const pvm = primarySegment.voice_modifiers || {};
const segmentExtraForbidden = pvm.forbidden_phrases_extra || [];

// Secondary segments → content cues only (proof signals to optionally surface).
// NOT voice merge. Single voice owner per page (codex Q-DD-5).
const secondaryContentCues = SECONDARY_SEGMENTS.map(id => {
  try {
    const s = getSegment(id);
    return { segment: id, trust_levers_top_3: (s.trust_levers_top_3 || []).slice(0, 3), fold_chip: s.secondary_representation?.fold_chip };
  } catch { return null; }
}).filter(Boolean);

const personaOverlayBlock = `
═══════════════════════════════════════════════════════════
PRIMARY SEGMENT · ${primarySegment.display_name} (${primarySegment.id})
═══════════════════════════════════════════════════════════

Who they are: ${primarySegment.job_to_be_done}
Information state: ${primarySegment.information_state?.description || ''}
Comparison set: ${primarySegment.comparison_set_size || '?'} · Time to decide: ${primarySegment.time_to_decide || '?'}

Voice tone (LEAD with this): ${pvm.tone || ''}

What to LEAD WITH (trust levers · top 3):
${(primarySegment.trust_levers_top_3 || []).map((t, i) => `  ${i + 1}. ${t}`).join('\n')}

Critical 5-second signals (must surface above-fold):
${(primarySegment.critical_signals_5_second || []).map(s => `  - [${s.id}] ${s.deterministic_check}`).join('\n')}

Decision triggers (use these as CTA anchors):
${(primarySegment.decision_triggers || []).map(d => `  - ${d}`).join('\n')}

BOUNCE TRIGGERS (avoid all of these):
${(primarySegment.bounce_triggers || []).map(b => `  - ${b}`).join('\n')}

FORBIDDEN SIGNALS for this segment (never write copy that implies these):
${(primarySegment.forbidden_signals || []).map(f => `  - ${f}`).join('\n')}

═══════════════════════════════════════════════════════════
AU TRADE VOICE · BASE LAYER (universal · always applies)
═══════════════════════════════════════════════════════════

AU spelling required. NEVER use US variants: ${baseUsSpelling.join(' · ')}

BANNED generic phrases (audit will FAIL if any appear in copy):
${baseBannedPhrases.map(p => `  - "${p}"`).join('\n')}

BANNED for this primary segment specifically (overlay):
${segmentExtraForbidden.map(p => `  - "${p}"`).join('\n')}

FORBIDDEN niche-specific claims (legal · ACCC):
${baseForbiddenNiche.map(p => `  - "${p}"`).join('\n')}

═══════════════════════════════════════════════════════════
SECONDARY SEGMENT CONTENT CUES (content only · NOT voice merge)
═══════════════════════════════════════════════════════════

The page voice STAYS in the primary segment register. Secondary segments
contribute CONTENT cues only — proof signals or chips that surface their
job-to-be-done. Single voice owner per page (codex R21 Q-DD-5).

${JSON.stringify(secondaryContentCues, null, 2)}
`;


const prompt = `You are a senior copywriter writing the COPY for one page of an Australian local-trade business website.

The page STRUCTURE (block list, block types, purpose per block) has ALREADY been decided by the site architect. Your job is to fill in the copy for each block — using real facts from the customer brief and verbatim customer reviews. Do NOT change the block list. Do NOT add blocks. Do NOT remove blocks.

═══════════════════════════════════════════════════════════
THE PAGE PLAN (decided by architect · do not modify)
═══════════════════════════════════════════════════════════

Page: ${page}
Role: ${pagePlan.role}
Visitor intent: ${pagePlan.primary_visitor_intent}
Content focus: ${pagePlan.content_focus}
Content NOT covered here (lives on other pages): ${pagePlan.content_NOT_covered_here}
Cross-links to: ${(pagePlan.cross_links_to || []).join(', ')}

Block plan (${(pagePlan.blocks || []).length} blocks):
\`\`\`json
${JSON.stringify(pagePlan.blocks, null, 2)}
\`\`\`

═══════════════════════════════════════════════════════════
WHAT'S ON THE OTHER PAGES (so you don't repeat their content)
═══════════════════════════════════════════════════════════

\`\`\`json
${JSON.stringify(otherPages, null, 2)}
\`\`\`

═══════════════════════════════════════════════════════════
CUSTOMER BRIEF (canonical · use specific facts + customer voice from here)
═══════════════════════════════════════════════════════════

${brief.slice(0, 40000)}

═══════════════════════════════════════════════════════════
VERBATIM CUSTOMER REVIEWS (use these word-for-word where the architect asks for testimonials)
═══════════════════════════════════════════════════════════

${JSON.stringify(verbatimReviews, null, 2)}

${personaOverlayBlock}
═══════════════════════════════════════════════════════════
BEST PRACTICES (AU local trade · for tone reference)
═══════════════════════════════════════════════════════════

${bestPractices.slice(0, 6000)}

═══════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════

R1 · You do NOT decide which blocks go on this page. The architect already decided. Just fill in copy for the blocks listed above, in order.

R2 · Use customer-specific copy. Pull real suburb names, real review quotes, the real phone (0403 554 592), the real owner (Hayden), the real ABN, the real warranty terms (10-year workmanship). No generic stock phrases.

R3 · Honour the architect's differentiation_note for each block — that note tells you what makes THIS block different from similar blocks on other pages.

R4 · Honour avoid-overlap: if the OTHER pages cover something (e.g. reviews live on /home), don't repeat that content here. The architect already handled this; if you feel like adding a block, you must not — instead add a 1-sentence cross-link in an existing block.

R5 · Canonical schema for each block's content (use exactly these field names — no h2-instead-of-headline drift):

  - hero: { eyebrow, headline, subhead, primary_cta_label, primary_cta_href, secondary_cta_label, secondary_cta_href, proof_chips[] }
  - trust-bar: { items[] (each: { label, sublabel, icon_ref }) }
  - services-grid: { headline, subhead, services[] (each: { name, short_desc, href }) }
  - why-us: { headline, items[] (each: { title, body, number }) }
  - process: { headline, subhead, items[] (each: { title, body }) }
  - reviews: { headline, subhead, items[] (each: { quote, author, location, rating }) }
  - stats-band: { items[] (each: { number, label }) }
  - gallery: { headline, subhead, items[] (each: { caption, ref }) }
  - service-areas: { headline, intro, areas[] (suburb strings) }
  - faq: { headline, items[] (each: { q, a }) }
  - cta-band: { headline, subhead, primary_cta_label, primary_cta_href, secondary_cta_label, secondary_cta_href }
  - product-spotlight: { headline, intro, specs[] (strings), why_choose }
  - about-body: { sections[] (each: { heading, body }) }
  - about-timeline: { headline, items[] (each: { year, title, body }) }
  - before-after: { headline, pairs[] (each: { before_caption, after_caption, ref_before, ref_after }) }
  - warranty-detail: { headline, intro, coverage_items[], exclusions[] }
  - case-study: { headline, projects[] (each: { project_name, location, scope, outcome, details }) }
  - comparison-table: { headline, columns[] (header strings), rows[] (each: { feature, values[] }) }
  - contact-form: { headline, intro, fields[] (each: { name, label, placeholder, helper, required }), submit_label, success_message }
  - map-embed: { address, phone, email, hours[] (each: { day, time }) }
  - financing-band: { headline, intro, options[] (each: { label, detail }), cta_label, cta_href }
  - legal-body: { sections[] (each: { heading, body }) }
  - lead-form: { headline, subhead, fields[], submit_label, trust_list[] }
  - team-grid: { headline, members[] (each: { name, role, bio, photo_ref }) }
  - safety-insurance: { headline, items[] (each: { title, body, icon_ref }) }
  - spec-callout: { headline, items[] (each: { spec, value }) }
  - proof-strip: { items[] (each: { metric, label }) }
  - emergency-callout: { headline, body, phone, hours_note }

R6 · Output schema for the whole page:

\`\`\`json
{
  "page": "${page}",
  "title": "browser tab title · 50-60 chars",
  "meta_description": "155-160 chars",
  "h1_anchor": "the H1 used by the hero block",
  "primary_keyword": "...",
  "page_summary_for_designer": "2-3 sentences",
  "blocks": [
    {
      "n": 1,
      "type": "...",
      "variant": "...",
      "purpose": "(echo from architect plan)",
      "wireframe_ascii": "6-15 lines ASCII sketch · use single quotes inside not double",
      "layout_intent": {
        "section_height": "...", "container": "...",
        "stack_order_desktop": [...], "stack_order_mobile": [...],
        "alignment": "...", "background_treatment": "..."
      },
      "content": { ... per the canonical schema above for this block type ... },
      "microcopy": { ... button labels, placeholders, aria, alt ... },
      "images": [{ "ref": "<filename or PLACEHOLDER>", "role": "...", "alt_text": "...", "treatment": "..." }],
      "source_refs": [{ "field": "...", "source": "GBP|reviews|website-crawl|...", "note": "..." }],
      "inference_flags": [{ "field": "...", "type": "verified|ai-completed|ai-inferred", "rationale": "..." }],
      "design_notes_for_handoff": "..."
    }
  ],
  "global_seo": {...},
  "qa_checklist": [...]
}
\`\`\`

R7 · Output ONLY the JSON. No fences, no preamble.

Write the copy now.
`;

console.log(`[copywriter] slug=${slug} · page=${page} · llm=${llm} · prompt ${(prompt.length/1024).toFixed(1)}KB · primary_segment=${PRIMARY_SEGMENT} · secondaries=[${SECONDARY_SEGMENTS.join(',')}]`);

// Dry-run: print the prompt to stdout and exit · no LLM cost · verifies persona overlay landed
if (args.dryrun || args['dry-run']) {
  const personaSection = prompt.includes(`PRIMARY SEGMENT · ${primarySegment.display_name}`);
  const voiceBase = prompt.includes('AU TRADE VOICE · BASE LAYER');
  console.log(`[copywriter] DRY-RUN · persona_block_present=${personaSection} · voice_base_present=${voiceBase}`);
  console.log(`[copywriter] DRY-RUN · banned_phrases_in_prompt=${baseBannedPhrases.length} · segment_extra_forbidden=${segmentExtraForbidden.length}`);
  if (args.print) console.log(prompt);
  process.exit(0);
}

const start = Date.now();
let buf = '';
let modelUsed = args.model;

if (llm === 'codex') {
  const codexArgs = ['exec'];
  if (modelUsed) codexArgs.push('--model', modelUsed);
  console.log(`  invoking codex CLI${modelUsed ? ' (' + modelUsed + ')' : ' (default)'}...`);
  const proc = spawn('codex', codexArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
  proc.stdin.write(prompt); proc.stdin.end();
  proc.stdout.on('data', c => { buf += c.toString(); process.stderr.write('.'); });
  proc.stderr.on('data', () => {});
  await new Promise(r => proc.on('exit', r));
  process.stderr.write('\n');
  modelUsed = modelUsed || 'codex-default';
} else if (llm === 'claude') {
  modelUsed = modelUsed || 'claude-sonnet-4-5';
  const proc = spawn('claude', ['-p', prompt, '--model', modelUsed], { stdio: ['ignore', 'pipe', 'inherit'] });
  proc.stdout.on('data', c => { buf += c.toString(); process.stderr.write('.'); });
  await new Promise(r => proc.on('exit', r));
  process.stderr.write('\n');
} else if (llm === 'ollama') {
  modelUsed = modelUsed || 'qwen3.5:9b';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 900_000);
  try {
    const res = await fetch((process.env.OLLAMA_URL || 'http://localhost:11434') + '/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelUsed, prompt, stream: false, think: false, options: { temperature: 0.2, num_ctx: 32768 } }),
      signal: ctrl.signal,
    });
    const j = await res.json(); buf = j?.response || '';
  } finally { clearTimeout(t); }
}

const duration = Math.round((Date.now() - start) / 1000);
console.log(`  ${llm} returned ${buf.length} chars in ${duration}s`);

const rawPath = path.join(wfDir, `wireframe-${page}.${llm}.raw.txt`);
fs.writeFileSync(rawPath, buf);

// Repair unescaped double quotes inside wireframe_ascii (same fix from earlier round)
function fixAsciiField(text) {
  const out = []; let i = 0; const needle = '"wireframe_ascii":';
  while (i < text.length) {
    const j = text.indexOf(needle, i);
    if (j < 0) { out.push(text.slice(i)); break; }
    out.push(text.slice(i, j + needle.length));
    let k = j + needle.length;
    while (k < text.length && /[\t ]/.test(text[k])) { out.push(text[k]); k++; }
    if (text[k] !== '"') { i = k; continue; }
    out.push('"'); k++;
    while (k < text.length) {
      const c = text[k];
      if (c === '\\' && k+1 < text.length) { out.push(c, text[k+1]); k += 2; continue; }
      if (c === '"') {
        let m = k + 1;
        while (m < text.length && /[ \t\r\n]/.test(text[m])) m++;
        if (m < text.length && /[,}\]]/.test(text[m])) break;
        out.push('\\"'); k++; continue;
      }
      out.push(c); k++;
    }
    if (k < text.length) { out.push('"'); k++; }
    i = k;
  }
  return out.join('');
}

let cleaned = buf.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
if (s >= 0) cleaned = cleaned.slice(s, e + 1);
cleaned = fixAsciiField(cleaned);

let parsed;
try { parsed = JSON.parse(cleaned); } catch (err) {
  console.error(`JSON parse failed: ${err.message}`);
  console.error(`  raw saved: ${path.relative(REPO, rawPath)}`);
  process.exit(1);
}
parsed._meta = {
  generated_at: new Date().toISOString(),
  page,
  llm_backend: llm,
  model: modelUsed,
  duration_seconds: duration,
  prompt_kb: Math.round(prompt.length / 1024),
  architect_plan_block_count: (pagePlan.blocks || []).length,
};

const outPath = path.join(wfDir, `wireframe-${page}-${llm}.json`);
fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2));

const blocks = parsed.blocks || [];
console.log(`[copywriter] DONE · ${blocks.length} blocks · ${duration}s`);
console.log(`  → ${path.relative(REPO, outPath)}`);
console.log('');
console.log('Block summary:');
blocks.forEach((b, i) => {
  const copy = b.content ? JSON.stringify(b.content).length : 0;
  const refs = (b.source_refs || []).length;
  console.log(`  [${String(i+1).padStart(2)}] ${(b.type||'?').padEnd(20)} · copy=${String(copy).padStart(5)}c · refs=${refs}`);
});
