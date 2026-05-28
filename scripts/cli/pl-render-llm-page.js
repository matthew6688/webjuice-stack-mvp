#!/usr/bin/env node
/**
 * pl:render-llm-page · Path C · LLM whole-page HTML render
 *
 * SOP-AUDIT-STANDARD-V2 §5 premium tier + 3-path A/B/C experiment (codex R28-R31).
 *
 * Variants:
 *   V3 · --no-template (pure prompt · LLM renders fresh from brief + brand + skills)
 *   V4 · --template-inspiration <family> (LLM reads template as quality reference · renders new)
 *
 * Inputs locked per codex R31 Q-LL-7 (variance attribution):
 *   - Model: codex CLI default (logged in artifact metadata)
 *   - Temperature/seed: not directly controlled by codex CLI · output variance is path signal
 *   - Render inputs: brief.yaml + brand-tokens.css + persona + voice + master.md + facts.json
 *   - All inputs hashed · embedded in output artifact metadata
 *
 * Output: clients/<slug>/v2/llm-render-output/<run-id>/index.html + metadata.json
 *
 * Usage:
 *   npm run pl:render-llm-page -- --slug vicwest-roofing --no-template
 *   npm run pl:render-llm-page -- --slug vicwest-roofing --template-inspiration editorial-newsletter
 *   npm run pl:render-llm-page -- --slug vicwest-roofing --no-template --run-id v3-run-1
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function parseArgs() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const n = argv[i + 1];
      if (!n || n.startsWith('--')) out[k] = true;
      else { out[k] = n; i++; }
    }
  }
  return out;
}

function die(msg, code = 1) { console.error(`[pl:render-llm-page] ${msg}`); process.exit(code); }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function md5(s) { return crypto.createHash('md5').update(s).digest('hex').slice(0, 12); }

function callCodex(prompt, timeoutMs = 5 * 60 * 1000) {
  return new Promise(resolve => {
    const p = spawn('codex', ['exec'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} resolve({ out, err: 'timeout' }); }, timeoutMs);
    p.stdout.on('data', c => { out += c.toString(); process.stderr.write('.'); });
    p.stderr.on('data', c => err += c.toString());
    p.on('exit', code => { clearTimeout(t); resolve({ out, err, exit_code: code }); });
    p.stdin.write(prompt); p.stdin.end();
  });
}

// Extract HTML from codex output · codex wraps in markdown sometimes
function extractHtml(raw) {
  // Try fenced code block first
  const fenced = raw.match(/```html\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Try generic fence
  const generic = raw.match(/```\s*([\s\S]*?)```/);
  if (generic && generic[1].includes('<!doctype') || generic && generic[1].includes('<html')) return generic[1].trim();
  // Find first <!doctype to end
  const docIdx = raw.toLowerCase().indexOf('<!doctype');
  if (docIdx !== -1) {
    const endIdx = raw.toLowerCase().lastIndexOf('</html>');
    if (endIdx !== -1) return raw.slice(docIdx, endIdx + '</html>'.length);
  }
  return null;
}

function validateHtml(html) {
  if (!html) return { valid: false, reason: 'no HTML extracted from LLM output' };
  if (!/<!doctype/i.test(html)) return { valid: false, reason: 'missing <!doctype>' };
  if (!/<html/i.test(html)) return { valid: false, reason: 'missing <html>' };
  if (!/<\/html>/i.test(html)) return { valid: false, reason: 'missing </html>' };
  if (!/<head/i.test(html) || !/<\/head>/i.test(html)) return { valid: false, reason: 'missing <head>' };
  if (!/<body/i.test(html) || !/<\/body>/i.test(html)) return { valid: false, reason: 'missing <body>' };
  if (html.length < 5000) return { valid: false, reason: `too short: ${html.length} bytes` };
  return { valid: true };
}

async function main() {
  const args = parseArgs();
  if (args.help || !args.slug) {
    console.log('Usage: pl:render-llm-page --slug <slug> [--no-template | --template-inspiration <family>] [--run-id <id>]');
    process.exit(args.help ? 0 : 1);
  }
  const slug = args.slug;
  const clientDir = path.join(REPO, 'clients', slug, 'v2');
  if (!fs.existsSync(clientDir)) die(`client dir not found: clients/${slug}/v2/`);

  const useTemplateRef = !args['no-template'];
  const templateFamily = args['template-inspiration'] || (useTemplateRef ? 'editorial-newsletter' : null);
  const variant = useTemplateRef ? 'V4-C-with-template-inspiration' : 'V3-C-pure-no-template';

  // ─── Lock inputs (codex R31 Q-LL-7) ──────────────────────────────────
  const inputs = {
    brief_yaml:      readText(path.join(clientDir, 'single-page-brief.yaml')),
    core_extract:    readJson(path.join(clientDir, 'core-extract.json')),
    facts_json:      readJson(path.join(clientDir, 'handoff/od-package/facts.json'))?.locked_facts || {},
    brand_tokens:    readText(path.join(clientDir, 'handoff/od-package/brand/brand-tokens.css')),
    master_md:       readText(path.join(clientDir, 'master.md')).slice(0, 6000),
    voice_json:      readJson(path.join(REPO, 'skills/pl-au-trade-voice/pl-au-trade-voice.json')),
    page_spec_json:  readJson(path.join(REPO, 'skills/pl-local-trade-page-spec/pl-local-trade-page-spec.json')),
    persona:         null,
    template_html:   null,
  };
  if (!inputs.brief_yaml) die('brief.yaml missing · run pl:validate-single-page-brief first', 2);

  // Derive primary segment · load persona
  const primaryMatch = inputs.brief_yaml.match(/^primary_segment:\s*([a-z-]+)/m);
  const primarySegment = primaryMatch ? primaryMatch[1] : 'planned-upgrade';
  try {
    const personaMod = await import(path.resolve(REPO, `core/audit/personas/${primarySegment}.js`));
    inputs.persona = personaMod.default || personaMod.segment;
  } catch (e) { console.error(`warn: persona load failed for ${primarySegment}: ${e.message}`); }

  // Template inspiration (only V4)
  if (templateFamily) {
    const tplPath = path.join(REPO, `templates/roofing/${templateFamily}/template.html`);
    inputs.template_html = readText(tplPath);
    if (!inputs.template_html) die(`template inspiration missing: ${tplPath}`, 3);
  }

  // ─── Hash inputs for variance attribution ────────────────────────────
  const inputHashes = {
    brief: md5(inputs.brief_yaml),
    brand_tokens: md5(inputs.brand_tokens),
    voice: md5(JSON.stringify(inputs.voice_json)),
    page_spec: md5(JSON.stringify(inputs.page_spec_json)),
    persona: md5(JSON.stringify(inputs.persona)),
    master_md: md5(inputs.master_md),
    template_html: inputs.template_html ? md5(inputs.template_html) : 'N/A',
  };

  // ─── Build prompt ────────────────────────────────────────────────────
  const persona = inputs.persona || {};
  const voice = inputs.voice_json?.constants || {};
  const realFacts = inputs.core_extract?.brief?.real_facts || {};
  const narrative = inputs.core_extract?.brief?.narrative || {};

  const promptParts = [];
  promptParts.push(`You are a senior copywriter + frontend dev rendering ONE single-page editorial-newsletter HTML page for a paying customer · Australian roofing trade business · target audience: homeowners in primary buyer-segment "${primarySegment}" (${persona.display_name || ''}).

═══ HARD RULES ═══
- Output complete valid HTML5 document · <!doctype html> through </html>
- Use the CLIENT BRAND TOKENS verbatim · inject <style> block at top · :root vars from brand-tokens.css below
- Real brand logo must appear in <header> (use <img src="brand/logo-horizontal.svg"> or logo-mark.svg from brand kit · NOT a placeholder)
- AU spelling (colour · centre · realise · NOT color/center/realize)
- Audience: ${persona.display_name || primarySegment} · job-to-be-done: ${persona.job_to_be_done || 'find a roofer they can trust'}
- License # (if present in brief) MUST appear in hero proof chips AND footer
- ABN (if present in brief) MUST appear in footer
- Phone + email MUST be wrapped in tel: / mailto: links · all instances clickable
- Mobile gate: above-fold sticky CTA · all critical taps ≥44x44px · no horizontal overflow at 390px
- R-BA-6 hard rule: before/after gallery must use draggable-slider DOM (.ba-slider · .ba-divider · .ba-handle · drag script inline)
- Local business JSON-LD: RoofingContractor @type · include aggregateRating · hasOfferCatalog
- 0 banned phrases (see VOICE RULES below)
- 0 fabrication · only facts from BRIEF + FACTS

═══ CLIENT BRAND TOKENS (inject verbatim in <style>) ═══
${inputs.brand_tokens}

═══ CLIENT BRIEF (canonical · use real values · do NOT invent) ═══
${inputs.brief_yaml.slice(0, 4000)}

═══ STRUCTURED FACTS ═══
${JSON.stringify(realFacts, null, 2).slice(0, 3000)}

═══ NARRATIVE CONTEXT (for tone reference · DO NOT copy verbatim · paraphrase + strip banned phrases) ═══
${JSON.stringify(narrative, null, 2).slice(0, 4000)}

═══ PRIMARY PERSONA ${persona.display_name || primarySegment} ═══
Tone: ${persona.voice_modifiers?.tone || 'confident · craft-focused · evidence-led · no hype'}
Trust levers (LEAD WITH): ${(persona.trust_levers_top_3 || []).join(' · ')}
Decision triggers: ${(persona.decision_triggers || []).slice(0,4).join(' · ')}
Bounce triggers (AVOID): ${(persona.bounce_triggers || []).join(' · ')}
Forbidden signals: ${(persona.forbidden_signals || []).join(' · ')}
Voice modifier banned: ${(persona.voice_modifiers?.forbidden_phrases_extra || []).join(' · ')}

═══ VOICE RULES (banned 100%) ═══
AU spelling required · NEVER use US: ${(voice.us_spelling_violations_per_au || []).join(' · ')}
BANNED phrases (audit FAIL if any appear): ${(voice.banned_phrases || []).join(' · ')}
FORBIDDEN niche claims (legal · ACCC): ${(voice.forbidden_niche_claims_roofing || []).join(' · ')}

═══ PAGE STRUCTURE (must include these sections) ═══
1. <header> masthead with real brand logo + nav + phone CTA
2. <main> with:
   - hero (eyebrow + serif H1 ≥8 words · 40+ word subhead with license # · ≥4 proof chips · ≥2 CTAs · real Colorbond/roof image)
   - strap (4 metric tiles · years · warranty · license auth · rating)
   - services (4-6 service cards with real materials + brief)
   - about (drop-cap paragraph · workshop photo · 2-3 specific paragraphs about real trade)
   - reviews (3 verbatim from brief if available · banner if placeholder)
   - gallery (3 before/after pairs with draggable-slider DOM)
   - coverage (suburbs from brief · ≥10 chips)
   - contact (form ≤3 visible inputs · address + map link · hours · license)
3. <footer> colophon with brand logo (mono-light variant) · NAP · ABN · license # · hours`);

  if (inputs.template_html) {
    promptParts.push(`\n═══ TEMPLATE INSPIRATION (V4 · use as STRUCTURE + STYLE reference · DO NOT just substitute · LLM renders fresh HTML with same editorial quality) ═══
${inputs.template_html.slice(0, 15000)}`);
  } else {
    promptParts.push(`\n═══ V3 PURE PROMPT MODE · no template provided · derive structure from PAGE STRUCTURE rules above · maintain editorial-newsletter quality bar (audit composite ≥89 target · Phase 3 baseline) ═══`);
  }

  promptParts.push(`\n═══ OUTPUT ═══
Output ONLY the complete HTML document. No prose. No markdown fences. Start with <!doctype html> · end with </html>.`);

  const prompt = promptParts.join('\n');
  console.log(`[pl:render-llm-page] slug=${slug} · variant=${variant} · prompt ${(prompt.length / 1024).toFixed(1)}KB`);
  console.log(`[pl:render-llm-page] inputs locked · brief md5=${inputHashes.brief} · brand md5=${inputHashes.brand_tokens} · persona md5=${inputHashes.persona}`);
  console.log(`[pl:render-llm-page] invoking codex CLI...`);

  const startTime = Date.now();
  const result = await callCodex(prompt);
  const durationS = Math.round((Date.now() - startTime) / 1000);
  process.stderr.write('\n');
  console.log(`[pl:render-llm-page] codex returned ${result.out.length} chars in ${durationS}s · exit=${result.exit_code}`);

  // Extract + validate HTML
  const html = extractHtml(result.out);
  const validation = validateHtml(html);
  if (!validation.valid) {
    console.error(`[pl:render-llm-page] HTML VALIDATION FAILED: ${validation.reason}`);
    console.error(`[pl:render-llm-page] raw codex output saved · debug`);
  }

  // ─── Write output ────────────────────────────────────────────────────
  const runId = args['run-id'] || `${useTemplateRef ? 'v4' : 'v3'}-${Date.now()}`;
  const outDir = path.join(clientDir, 'llm-render-output', runId);
  fs.mkdirSync(path.join(outDir, 'assets/brand'), { recursive: true });

  if (html) fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'codex-raw-output.txt'), result.out);

  // Copy brand assets so logo refs work
  const brandSrc = path.join(clientDir, 'handoff/od-package/brand');
  if (fs.existsSync(brandSrc)) {
    for (const f of fs.readdirSync(brandSrc)) {
      if (/\.(svg|css|png|jpg)$/.test(f)) fs.copyFileSync(path.join(brandSrc, f), path.join(outDir, 'assets/brand', f));
    }
  }

  // Metadata
  const metadata = {
    schema_version: 'llm-render-output/0.1',
    slug, variant, run_id: runId,
    use_template_inspiration: useTemplateRef,
    template_family: templateFamily,
    primary_segment: primarySegment,
    model: 'codex-cli-default',
    duration_s: durationS,
    prompt_kb: Math.round(prompt.length / 1024),
    raw_output_chars: result.out.length,
    html_extracted: !!html,
    html_bytes: html?.length || 0,
    html_validation: validation,
    input_hashes: inputHashes,
    generated_at: new Date().toISOString(),
    codex_exit_code: result.exit_code,
  };
  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  console.log(`[pl:render-llm-page] DONE · ${outDir}/index.html · ${(html?.length / 1024 || 0).toFixed(1)}KB · valid=${validation.valid}`);

  if (!validation.valid) process.exit(4);
  process.exit(0);
}

main().catch(e => { console.error('[pl:render-llm-page] FATAL:', e.message, e.stack); process.exit(1); });
