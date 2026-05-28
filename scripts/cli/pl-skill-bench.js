#!/usr/bin/env node
/**
 * pl:skill-bench — LLM copy-quality benchmark
 *
 * Tests pl-au-trade-voice + pl-local-trade-page-spec skills across multiple LLMs.
 * Generates Hero + Services + About + FAQ copy from vicwest site-ctx.json,
 * then scores each output against T4d voice rules.
 *
 * Usage:
 *   node scripts/cli/pl-skill-bench.js [--slug vicwest-roofing] [--sections hero,services,about,faq]
 *
 * LLMs tested (in order):
 *   claude_cli   — Claude Sonnet via Claude Code CLI (T1 subscription)
 *   codex_cli    — Codex via Codex CLI (T1 subscription)
 *   qwen3.6:27b  — Local Ollama (T0 free)
 *   deepseek-r1  — Local Ollama (T0 free)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const slug = args[args.indexOf('--slug') + 1] || 'vicwest-roofing';
const sectionsArg = args[args.indexOf('--sections') + 1] || 'hero,services,about,faq';
const sections = sectionsArg.split(',').map(s => s.trim());
const skipProviders = (args[args.indexOf('--skip') + 1] || '').split(',').filter(Boolean);

console.log(`\n=== pl:skill-bench · ${slug} · sections: ${sections.join(', ')} ===\n`);

// ─── Load data ───────────────────────────────────────────────────────────────
const ctxPath = join(ROOT, 'clients', slug, 'v2', 'site-ctx.json');
if (!existsSync(ctxPath)) {
  console.error(`ERROR: site-ctx.json not found at ${ctxPath}`);
  console.error(`Run: npm run pl:extract-site-ctx-full -- --slug ${slug}`);
  process.exit(1);
}
const ctx = JSON.parse(readFileSync(ctxPath, 'utf8'));
const voiceSkill = JSON.parse(readFileSync(join(ROOT, 'skills/pl-au-trade-voice/pl-au-trade-voice.json'), 'utf8'));
const pageSpec = JSON.parse(readFileSync(join(ROOT, 'skills/pl-local-trade-page-spec/pl-local-trade-page-spec.json'), 'utf8'));

// ─── Build benchmark prompt ──────────────────────────────────────────────────
function buildPrompt(sectionList) {
  const biz = ctx.business;
  const banned = (voiceSkill.constants?.banned_phrases || []).join(' | ');
  const forbidden = (voiceSkill.constants?.forbidden_niche_claims_roofing || []).join(' | ');
  const services = ctx.services.map(s => `• ${s.name}: ${s.brief || ''}`).join('\n');
  const suburbs = ctx.suburbs.slice(0, 12).map(s => typeof s === 'string' ? s : s.suburb).join(', ');
  const reviews = (ctx.reviews || []).slice(0, 3).map(r =>
    `"${r.quote}" — ${r.author}, ${r.location} (${r.stars}★)`
  ).join('\n');
  const trustSignals = (ctx.trust_signals || []).join(' · ');
  const psCons = pageSpec.constants || {};

  const sectionInstructions = sectionList.map(s => {
    if (s === 'hero') return `
## Section 1: HERO
Rules:
- H1 headline: ≤${psCons.hero_h1_max_words || 10} words. NEVER generic. Must name city + specific service or outcome.
- Subheadline: ${psCons.hero_subhead_min_words || 14}–${psCons.hero_subhead_max_words || 25} words. Concrete outcome + proof (license/warranty/material).
- Primary CTA: phone call button. Max ${psCons.cta_max_words || 5} words.
- 3 proof chips (trust bar inline): e.g. "VBA Licensed" / "10-yr warranty" / "Colorbond® only"
- Target audience: urgent-repair (homeowner with leaking or damaged roof, needs fast response)
- Word budget: 60–100 words total hero copy

Output JSON:
{
  "hero_h1": "...",
  "hero_subhead": "...",
  "hero_cta_primary": "...",
  "hero_proof_chips": ["...", "...", "..."]
}`;

    if (s === 'services') return `
## Section 3: SERVICES LIST
Rules:
- List exactly 6 services (match the provided service list below)
- Each service: name (≤5 words) + short description (≤15 words, concrete not vague)
- NO banned phrases in descriptions
- Use specific roofing vocabulary (Colorbond®, ridge cap, sarking, valley, tile, metal)

Output JSON:
{
  "services": [
    {"name": "...", "desc": "..."},
    ...
  ]
}`;

    if (s === 'about') return `
## Section 4: ABOUT STORY
Rules:
- 90–150 words
- MUST include: founding year (${biz.year_founded || 'unknown'}), owner name (${biz.owner_name || 'owner'}), city (${biz.city})
- Personal accountability tone — owner takes responsibility
- NO stock phrases: no "passionate", "family-owned and operated", "no job too big or small"
- End with specific local commitment (suburb name or local detail)

Output JSON:
{
  "about_headline": "...",
  "about_body": "..."
}`;

    if (s === 'faq') return `
## Section 9: FAQ
Rules:
- 5–8 questions
- Questions should be what a Ballarat homeowner actually Googles before hiring a roofer
- Answers: 2–3 sentences max. Concrete. Include license/warranty/cost signal where natural.
- NO marketing speak in answers

Output JSON:
{
  "faqs": [
    {"q": "...", "a": "..."},
    ...
  ]
}`;

    return '';
  }).join('\n\n');

  return `You are writing copy for a local roofing company website. Output ONLY valid JSON as specified. No markdown, no explanation.

## CLIENT DATA
Business: ${biz.name}
City: ${biz.city}, ${biz.state}
Phone: ${biz.phone_display}
License: ${biz.license_authority} — ${biz.license_number} (${biz.license_status || 'active'})
ABN: ${biz.abn}
Google Rating: ${biz.rating}★ (${biz.review_count} reviews)
Founded: ${biz.year_founded}
Owner: ${biz.owner_name || 'not provided'}
Trust signals: ${trustSignals}

Services offered:
${services}

Service area (sample suburbs):
${suburbs}

Real customer reviews:
${reviews}

## VOICE RULES (HARD — violations = automatic fail)
NEVER use these phrases (any form, partial match counts):
${banned}

NEVER make these claims in roofing copy:
${forbidden}

AU spelling required: use "colour" not "color", "centre" not "center", "realise" not "realize", "licence" not "license" (noun), "labour" not "labor"

## PAGE SPEC RULES
${sectionInstructions}

## OUTPUT
Respond with a single JSON object containing keys for each section you write.
Example structure: { "hero_h1": "...", "hero_subhead": "...", "services": [...], "about_headline": "...", "about_body": "...", "faqs": [...] }`;
}

// ─── T4d voice scorer ────────────────────────────────────────────────────────
function scoreVoice(text) {
  if (!text) return { score: 0, violations: ['no output'], details: {} };
  const lower = text.toLowerCase();

  const banned = voiceSkill.constants?.banned_phrases || [];
  const forbidden = voiceSkill.constants?.forbidden_niche_claims_roofing || [];
  const usSpelling = [
    ['color', 'colour'], ['center', 'centre'], ['realize', 'realise'],
    ['organize', 'organise'], ['license', 'licence'], ['labor', 'labour'],
    ['favor', 'favour'], ['fiber', 'fibre'],
  ];

  const bannedHits = banned.filter(p => lower.includes(p.toLowerCase()));
  const forbiddenHits = forbidden.filter(p => lower.includes(p.toLowerCase()));
  const spellingHits = usSpelling.filter(([us]) => {
    const re = new RegExp(`\\b${us}\\b`, 'i');
    return re.test(text);
  }).map(([us, au]) => `"${us}" → should be "${au}"`);

  // Score: start 100, deduct per violation tier
  let score = 100;
  score -= bannedHits.length * 20;   // P1 banned = -20 each
  score -= forbiddenHits.length * 30; // P0 forbidden = -30 each
  score -= spellingHits.length * 5;   // spelling = -5 each
  score = Math.max(0, score);

  const violations = [
    ...bannedHits.map(p => `[BANNED] "${p}"`),
    ...forbiddenHits.map(p => `[FORBIDDEN] "${p}"`),
    ...spellingHits.map(s => `[SPELLING] ${s}`),
  ];

  return { score, violations, details: { bannedHits, forbiddenHits, spellingHits } };
}

// ─── Rule conformance checker ─────────────────────────────────────────────────
function checkRules(parsed, sectionList) {
  const checks = [];

  if (sectionList.includes('hero') && parsed) {
    const h1 = parsed.hero_h1 || '';
    const subhead = parsed.hero_subhead || '';
    const h1Words = h1.split(/\s+/).filter(Boolean).length;
    const subWords = subhead.split(/\s+/).filter(Boolean).length;

    checks.push({ rule: 'H1 ≤10 words', pass: h1Words <= 10, detail: `${h1Words} words: "${h1}"` });
    checks.push({ rule: 'Subhead 14-25 words', pass: subWords >= 14 && subWords <= 25, detail: `${subWords} words` });
    checks.push({ rule: 'City in H1 or subhead', pass: (h1 + subhead).toLowerCase().includes('ballarat'), detail: 'Ballarat present' });
  }

  if (sectionList.includes('services') && parsed?.services) {
    const services = parsed.services || [];
    checks.push({ rule: 'Exactly 6 services', pass: services.length === 6, detail: `${services.length} services` });
    const longDescs = services.filter(s => (s.desc || '').split(/\s+/).length > 15);
    checks.push({ rule: 'Service desc ≤15 words', pass: longDescs.length === 0, detail: longDescs.length > 0 ? `${longDescs.length} too long` : 'OK' });
  }

  if (sectionList.includes('about') && parsed) {
    const body = parsed.about_body || '';
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    checks.push({ rule: 'About 90-150 words', pass: wordCount >= 90 && wordCount <= 150, detail: `${wordCount} words` });
    checks.push({ rule: 'City mentioned in about', pass: body.toLowerCase().includes('ballarat'), detail: 'Ballarat present' });
  }

  if (sectionList.includes('faq') && parsed?.faqs) {
    const faqs = parsed.faqs || [];
    checks.push({ rule: 'FAQ 5-8 questions', pass: faqs.length >= 5 && faqs.length <= 8, detail: `${faqs.length} questions` });
  }

  return checks;
}

// ─── LLM runners ────────────────────────────────────────────────────────────
async function runClaudeCli(prompt, timeoutMs = 120_000) {
  const start = Date.now();
  // Note: omit --no-session-persistence so CLI uses active browser session auth
  const r = spawnSync('claude', [
    '--print',
    '--output-format', 'json',
    '--model', 'claude-sonnet-4-5',
    '--permission-mode', 'bypassPermissions',
    '--disable-slash-commands',
    '--mcp-config', '{"mcpServers":{}}',
    '--setting-sources', '',
  ], { input: prompt, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
  const ms = Date.now() - start;
  if (r.status !== 0) return { ok: false, text: '', ms, error: r.stderr?.slice(0, 200) };
  try {
    const parsed = JSON.parse(r.stdout);
    // is_error can still be true even with status 0 (auth failure etc)
    if (parsed.is_error) return { ok: false, text: '', ms, error: (parsed.result || '').slice(0, 200) };
    return { ok: true, text: parsed.result || '', ms };
  } catch {
    return { ok: false, text: '', ms, error: 'JSON parse failed' };
  }
}

async function runCodexCli(prompt, timeoutMs = 120_000) {
  const start = Date.now();
  const r = spawnSync('codex', [
    'exec',
    '--skip-git-repo-check',
    '--sandbox', 'workspace-write',
    '--ignore-user-config',
    '--json',
    prompt,
  ], { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
  const ms = Date.now() - start;
  if (r.status !== 0 && !r.stdout) return { ok: false, text: '', ms, error: r.stderr?.slice(0, 200) };

  let text = '';
  for (const line of r.stdout.split('\n')) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line);
      // Format: {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
      if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') {
        text += ev.item.text || '';
      }
      // Also handle older assistant message format just in case
      if (ev.type === 'message' && ev.role === 'assistant') {
        text += (ev.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
      }
    } catch { /* ignore */ }
  }
  return { ok: !!text, text, ms };
}

async function runOpenAI(prompt, timeoutMs = 120_000) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, text: '', ms: 0, error: 'OPENAI_API_KEY not set' };
  const start = Date.now();
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ms = Date.now() - start;
    if (!resp.ok) return { ok: false, text: '', ms, error: `HTTP ${resp.status}` };
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { ok: !!text, text, ms };
  } catch (e) {
    return { ok: false, text: '', ms: Date.now() - start, error: e.message };
  }
}

async function runOllama(model, prompt, timeoutMs = 180_000) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const start = Date.now();
  try {
    const resp = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, think: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ms = Date.now() - start;
    if (!resp.ok) return { ok: false, text: '', ms, error: `HTTP ${resp.status}` };
    const data = await resp.json();
    return { ok: true, text: data.response || '', ms };
  } catch (e) {
    return { ok: false, text: '', ms: Date.now() - start, error: e.message };
  }
}

// ─── Extract JSON from LLM text output ───────────────────────────────────────
function extractJson(text) {
  if (!text) return null;
  // Try direct parse first
  try { return JSON.parse(text.trim()); } catch {}
  // Try JSON code block
  const m = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (m) try { return JSON.parse(m[1].trim()); } catch {}
  // Try first { ... } block
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  return null;
}

// ─── Main benchmark ──────────────────────────────────────────────────────────
const providers = [
  { id: 'claude_cli',       label: 'Claude Sonnet (CLI)',     run: (p) => runClaudeCli(p) },
  { id: 'codex_cli',        label: 'Codex (CLI)',              run: (p) => runCodexCli(p) },
  { id: 'openai_gpt4o',     label: 'GPT-4o (API)',            run: (p) => runOpenAI(p) },
  { id: 'qwen3.6:27b',      label: 'Qwen3.6 27B (local)',     run: (p) => runOllama('qwen3.6:27b', p) },
  { id: 'deepseek-r1:14b',  label: 'DeepSeek-R1 14B (local)', run: (p) => runOllama('deepseek-r1:14b', p) },
].filter(p => !skipProviders.includes(p.id));

const prompt = buildPrompt(sections);
console.log(`Prompt length: ${prompt.length} chars\n`);

const results = [];

for (const provider of providers) {
  process.stdout.write(`Running ${provider.label}...`);
  const result = await provider.run(prompt);
  const parsed = result.ok ? extractJson(result.text) : null;
  const voiceScore = scoreVoice(result.text);
  const ruleChecks = parsed ? checkRules(parsed, sections) : [];

  const passingRules = ruleChecks.filter(c => c.pass).length;
  const totalRules = ruleChecks.length;

  results.push({
    provider: provider.label,
    ok: result.ok,
    ms: result.ms,
    text: result.text,
    parsed,
    voiceScore,
    ruleChecks,
    rulesPass: `${passingRules}/${totalRules}`,
    error: result.error,
  });

  const status = result.ok
    ? `✓ (${(result.ms/1000).toFixed(1)}s · voice: ${voiceScore.score}/100 · rules: ${passingRules}/${totalRules})`
    : `✗ (${result.error})`;
  console.log(` ${status}`);
}

// ─── Output comparison table ─────────────────────────────────────────────────
console.log('\n' + '═'.repeat(80));
console.log('BENCHMARK RESULTS');
console.log('═'.repeat(80));

// Summary table
console.log('\n### Summary\n');
const headers = ['Provider', 'OK', 'Time(s)', 'Voice Score', 'Rules Pass', 'Violations'];
const rows = results.map(r => [
  r.provider,
  r.ok ? '✓' : '✗',
  (r.ms / 1000).toFixed(1),
  r.ok ? `${r.voiceScore.score}/100` : 'N/A',
  r.ok ? r.rulesPass : 'N/A',
  r.ok ? (r.voiceScore.violations.length === 0 ? 'none' : r.voiceScore.violations.slice(0, 2).join(' | ')) : r.error || 'failed',
]);

const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
const fmt = (row) => row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(' | ');
console.log(fmt(headers));
console.log(colWidths.map(w => '-'.repeat(w)).join('-+-'));
rows.forEach(row => console.log(fmt(row)));

// Detailed per-section comparison
for (const section of sections) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`SECTION: ${section.toUpperCase()}`);
  console.log('─'.repeat(80));

  for (const r of results) {
    if (!r.ok || !r.parsed) { console.log(`\n[${r.provider}] — FAILED`); continue; }
    console.log(`\n[${r.provider}]`);

    if (section === 'hero') {
      console.log(`  H1:      ${r.parsed.hero_h1 || '(missing)'}`);
      console.log(`  Subhead: ${r.parsed.hero_subhead || '(missing)'}`);
      console.log(`  CTA:     ${r.parsed.hero_cta_primary || '(missing)'}`);
      console.log(`  Chips:   ${(r.parsed.hero_proof_chips || []).join(' | ')}`);
    }
    if (section === 'services' && r.parsed.services) {
      r.parsed.services.forEach(s => console.log(`  • ${s.name}: ${s.desc}`));
    }
    if (section === 'about') {
      console.log(`  Headline: ${r.parsed.about_headline || '(missing)'}`);
      console.log(`  Body:     ${(r.parsed.about_body || '(missing)').slice(0, 200)}...`);
    }
    if (section === 'faq' && r.parsed.faqs) {
      r.parsed.faqs.slice(0, 3).forEach((f, i) =>
        console.log(`  Q${i+1}: ${f.q}\n      ${f.a}`)
      );
      if (r.parsed.faqs.length > 3) console.log(`  ... +${r.parsed.faqs.length - 3} more`);
    }

    // Voice violations for this provider
    if (r.voiceScore.violations.length > 0) {
      console.log(`  ⚠ Voice violations: ${r.voiceScore.violations.join(' | ')}`);
    }
    // Rule failures
    const failures = r.ruleChecks.filter(c => !c.pass);
    if (failures.length > 0) {
      console.log(`  ✗ Rule failures: ${failures.map(f => `${f.rule} (${f.detail})`).join(' | ')}`);
    }
  }
}

// ─── Save raw results ────────────────────────────────────────────────────────
const outDir = join(ROOT, 'clients', slug, 'v2', 'editorial-output', 'bench');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `skill-bench-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
writeFileSync(outPath, JSON.stringify({
  slug, sections, generated_at: new Date().toISOString(),
  results: results.map(r => ({
    ...r,
    text: r.text?.slice(0, 2000), // truncate raw text
  })),
}, null, 2));
console.log(`\nRaw results saved: ${outPath}`);
console.log('\n=== DONE ===\n');
