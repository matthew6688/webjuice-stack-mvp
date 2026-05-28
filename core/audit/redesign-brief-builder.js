/**
 * V3 D39 (2026-05-14) · Redesign Brief Builder · AI 分析 multi-page crawl raw JSON
 *
 * Per Matthew "不要预定义 extractor · 把 json 全抓回来 给 AI 分析"
 *
 * 输入: multi-page-crawl 结果 (10+ 页 rawHtml + text + meta)
 * 输出: 结构化 redesign brief JSON
 *   - core_info (REAL · 不可编 · 必客户原文)
 *   - brand_assets (logo · 颜色 · 字体 · 风格)
 *   - extensions (AI 优化拓展 · hero copy / service descriptions / etc.)
 *   - redesign_brief 一段总结
 *   - qualification_flags (scorecard 输入 · scope / logo quality / etc.)
 *
 * Cost: ~$1-2 per customer (claude_cli sonnet · 50KB in + 10KB out)
 * Cascade: codex_cli → claude_cli → ollama (per Matthew D39)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PROMPT_TEMPLATE = `You are analyzing a real local business website for a redesign project (ProfitsLocal AU).

Below is the raw scrape of N pages from the customer's current website. Extract structured info:

# REAL · 必须客户原文 (never invent)

\`\`\`
business_name: exact spelling
phone: all listed (verified format · AU mobile 04XX XXX XXX or landline 0X XXXX XXXX)
email: all listed
address: exact street + suburb + state + postcode
license_numbers: regex patterns (ABN/QBCC/license number)
founded_year: regex "since YYYY" / "established YYYY" / "X years"
owner_name: from About page
service_list: each service name + 1-sentence brief · only services they explicitly offer
testimonials: quote + author + location (real customer testimonials only)
team_members: name + role (if shown)
\`\`\`

# BRAND ASSETS · 可推断

\`\`\`
logo_url: highest-res image referenced (og:image · favicon · header logo)
primary_color: hex from CSS/Hero
accent_color: hex
font_family: from @font-face URLs
voice_tone: classify (formal/casual/expert/luxury/friendly/professional)
key_messaging: 3-5 phrases customer uses to describe themselves
\`\`\`

# EXTENSIONS · AI 优化 (标 source=ai)

\`\`\`
improved_hero_copy: 2-3 H1 + subhead options (more compelling · audit-aware)
improved_service_descriptions: rewrite each for clarity + benefit
meta_descriptions: SEO-optimized per page
cta_suggestions: action verbs · niche-typical
trust_signals_to_emphasize: from existing material
\`\`\`

# REDESIGN BRIEF · 1-paragraph synthesis

What we should keep · what we should improve · why this redesign matters.

# QUALIFICATION FLAGS · scorecard 输入

\`\`\`
scope_pages_estimate: N
complexity: simple|medium|complex
logo_quality: have-svg|have-png-high|have-png-low|missing
booking_required: true|false
multilingual_required: true|false
ecommerce_detected: true|false
member_portal_detected: true|false
blog_active: true|false (>= 5 posts in last 6 months)
third_party_pixels_count: N
ready_to_build_concerns: [...]
\`\`\`

# RAW SCRAPE (input)

Customer URL: {BASE_URL}
Pages crawled: {PAGE_COUNT}
Sitemap source: {SITEMAP_SOURCE}

{PAGES_JSON}

# OUTPUT FORMAT

STRICT JSON · no markdown fences · no commentary. Start with { · end with }.
Schema:
{
  "core_info": {...},
  "brand_assets": {...},
  "extensions": {...},
  "redesign_brief": "...",
  "qualification_flags": {...}
}
`;

/** Run a CLI subprocess · pipe prompt to stdin · capture stdout · timeout 5min */
function runCli(cmd, args, input, timeoutMs = 300_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => { proc.kill('SIGTERM'); reject(new Error(`timeout ${timeoutMs}ms`)); }, timeoutMs);
    proc.on('error', reject);
    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`exit ${code}: ${stderr.slice(0, 300)}`));
    });
    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    }
  });
}

/**
 * Run ONE specific backend (no fallback) · for A/B/C comparison runs.
 * Recovered 2026-05-29 from stash@{0} phaseA-step0 (originally implemented
 * 2026-05-18 alongside buildCoreExtract · stashed and lost). Restored because
 * scripts/cli/pl-llm-extract-core.js depends on buildCoreExtract which uses this.
 */
async function runAiSingle(prompt, backend, modelOverride) {
  if (backend === 'codex' || backend === 'codex_cli') {
    const r = await runCli('codex', ['exec'], prompt, 600_000);
    return { text: r.stdout, provider: 'codex_cli', model: modelOverride || 'codex-default' };
  }
  if (backend === 'claude' || backend === 'claude_cli') {
    const model = modelOverride || 'claude-sonnet-4-5';
    const r = await runCli('claude', ['-p', prompt, '--model', model], '', 900_000);
    return { text: r.stdout, provider: 'claude_cli', model };
  }
  if (backend === 'ollama') {
    // Direct fetch (bypass textOllama wrapper) so we can set num_ctx large enough
    // to hold the 70KB+ deep prompt (~25K tokens). qwen3.x supports 32K-128K context.
    const model = modelOverride || process.env.OLLAMA_TEXT_MODEL || 'qwen3.5:9b';
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1_500_000);  // 25 min
    try {
      const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          think: false,
          options: { temperature: 0.2, num_ctx: 32768 },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
      const payload = await res.json();
      return { text: payload?.response || '', provider: 'ollama', model };
    } finally { clearTimeout(timer); }
  }
  throw new Error(`unknown backend: ${backend}`);
}

/**
 * Try codex_cli first · then claude_cli · then ollama (per D39 cascade).
 * 2026-05-29 R37 recovery: delegates to runAiSingle so DEEP_PROMPT (70KB+) gets
 * 600s codex / 900s claude / 25min ollama timeouts. The old per-step 240s was
 * too short for the deep prompt and caused mark-squire extract to fail.
 */
async function runAiCascade(prompt) {
  const errs = [];
  for (const b of ['codex', 'claude', 'ollama']) {
    try {
      return await runAiSingle(prompt, b);
    } catch (err) { errs.push(`${b}: ${err.message}`); }
  }
  throw new Error(`All providers failed: ${errs.join(' · ')}`);
}

/** Extract JSON object from LLM output (handle prefixes/suffixes) */
function extractJson(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/**
 * Main · build redesign brief from multi-page crawl result.
 *
 * @param {object} crawlResult · output from multiPageCrawl()
 * @returns {{brief, raw_response, provider, cost_estimate, duration_ms}}
 */
export async function buildRedesignBrief(crawlResult) {
  if (!crawlResult?.pages?.length) {
    return { brief: null, error: 'no crawled pages' };
  }
  const start = Date.now();

  // Build pages JSON for prompt (truncate rawHtml to ~3KB/page to fit context)
  const pagesForPrompt = crawlResult.pages.map((p) => ({
    url: p.url,
    title: p.title,
    text_md: (p.text || '').slice(0, 5000),
    rawHtml_excerpt: (p.rawHtml || '').slice(0, 3000),
    meta: p.meta,
  }));

  const prompt = PROMPT_TEMPLATE
    .replace('{BASE_URL}', crawlResult.base_url || '?')
    .replace('{PAGE_COUNT}', String(crawlResult.pages.length))
    .replace('{SITEMAP_SOURCE}', crawlResult.sitemap_source || 'unknown')
    .replace('{PAGES_JSON}', JSON.stringify(pagesForPrompt, null, 2));

  // Run AI cascade
  let result;
  try {
    result = await runAiCascade(prompt);
  } catch (err) {
    return { brief: null, error: err.message, duration_ms: Date.now() - start };
  }

  const brief = extractJson(result.text);
  return {
    brief,
    raw_response: result.text.slice(0, 5000),
    provider: result.provider,
    cost_estimate: result.provider === 'ollama' ? 0 : result.provider === 'codex_cli' ? 0.5 : 1.5,
    duration_ms: Date.now() - start,
    prompt_length: prompt.length,
  };
}

/** Save brief to disk · for downstream scorecard + reference-adapter use */
export function saveBrief(slug, briefResult, repoRoot = process.cwd()) {
  const outPath = path.join(repoRoot, 'clients', slug, 'v2/redesign-brief.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(briefResult, null, 2));
  return outPath;
}

// ── RECOVERED 2026-05-29 from stash@{0} (Round 37) ──────────────────────
// DEEP MODE · originally implemented 2026-05-18 alongside vicwest core-extract.json
// Lost in phaseA-step0 stash. CLI pl-llm-extract-core.js depends on these exports.
// Surgical extract per codex Q-RR-1 (b).

const DEEP_PROMPT_TEMPLATE = `You are a senior content strategist building the canonical "customer brief" document for a website-redesign team working on an Australian local-trade business.

You are given the FULL raw corpus across multiple sources (GBP, owned website crawl with all 10 pages, verbatim Google reviews, tinyfish external mentions with raw markdown, image alt-texts, ABN, master.md). Your job is to fuse this into a comprehensive customer brief — rich enough that the design + copy team can build the ENTIRE multi-page website from this one document, with no further questions.

CRITICAL: Read EVERY source carefully. The reviews, the about-us page text, the tinyfish raw markdown all contain rich detail. Do not produce a thin or generic brief. Pull specific phrases, named projects, recurring customer language, owner quotes, suburb references — embed them into the narrative.

# REAL · 必须客户原文 (never invent · always cite the source)

For every value, include a parallel _sources field naming which input(s) it came from: GBP / website-crawl / abn / whois / wayback / tinyfish-mention / ai-inferred.

\`\`\`
business_name: exact spelling
phone: all listed (verified format · AU mobile 04XX XXX XXX or landline 0X XXXX XXXX)
email: all listed
address: exact street + suburb + state + postcode
hours: weekly schedule if findable
license_numbers: ABN / VBA / QBCC / state license patterns
founded_year: regex "since YYYY" / "established YYYY" / "X years"
owner_name: from About page or external mentions
service_list: every service name + 1-sentence brief · merge GBP categories + website + ABN trading names
suburbs_served: every named suburb/region across all sources
testimonials: quote + author + location (real customer testimonials only · verbatim)
team_members: name + role (if shown)
domain_age_years: from whois/wayback
abn: number + entity type + trading names
\`\`\`

# BRAND ASSETS · 可推断

\`\`\`
logo_url: highest-res image referenced (og:image · favicon · header logo)
primary_color: hex from CSS/Hero
accent_color: hex
font_family: from @font-face URLs
voice_tone: classify (formal/casual/expert/luxury/friendly/professional)
key_messaging: 3-5 phrases customer uses to describe themselves
taglines: any visible slogans
\`\`\`

# CONTENT ASSETS · 可用素材

\`\`\`
best_review_quotes: top 5 verbatim quotes with author + location · for hero/testimonial use
project_descriptions: real completed projects mentioned anywhere
external_mention_facts: useful facts pulled from tinyfish mentions (e.g. directory listings, news articles)
usable_image_urls: image URLs from owned-website crawl that look like real project/team/hero photos (skip icons/logos/stock)
\`\`\`

# AI EXTENSIONS · 标 source=ai-inferred · for wireframe consumption

\`\`\`
suggested_service_expansions: additional services likely offered but not explicitly named (e.g. "asbestos removal" if state requires it)
suggested_faqs: 5-8 niche-typical Q&As the website should answer
suggested_suburbs: nearby suburbs that should be added for SEO (within 50km of service area)
hero_copy_options: 3 H1 candidates (each must include a verified concrete number from real data)
\`\`\`

# DATA GAPS · 必须诚实

\`\`\`
missing_fields: list of fields we tried to extract but couldn't find (with source attempted)
unreachable_urls: URLs from tinyfish search that failed to fetch
recommended_next_steps: 3-5 concrete actions to fill gaps
\`\`\`

# NARRATIVE BRIEF · paragraphs · this is the deliverable for the design team

In addition to the structured facts above, write a comprehensive narrative brief. EACH narrative field should be 150-400 words of substantive prose grounded in concrete facts from the input. Do NOT write generic filler. Quote actual customer reviews, name actual suburbs, cite specific website pages, reference actual project descriptions.

\`\`\`
narrative.executive_summary           · 200-300 words · who they are, where, what they do, who they serve, what makes them distinct
narrative.company_background          · 400-500 words · weave ABN date, domain age, "X years" claims, founder/owner backstory, evolution
narrative.team_and_culture            · 250-350 words · the people, how they work (from reviews: "two teams", "arrived early", etc.)
narrative.service_scope_detailed      · 600-800 words · paragraph per service · pain point → process → output/warranty · cite source
narrative.service_area                · 250-350 words · narrative of geographic coverage + suburb list
narrative.customer_voice              · 400-500 words · review themes + 4 verbatim quotes + what customers consistently say
narrative.brand_voice_and_visual      · 300-400 words · colors, taglines, voice (formal/casual), 3-5 sample brand voice paragraphs
narrative.competitive_positioning     · 250-350 words · what makes them distinct in their region · mark ai-inferred parts
narrative.trust_signals_catalog       · 200-300 words · enumerate ABN + warranty + years + reviews + license · with sources
narrative.visitor_personas            · 400-500 words · homeowner / builder / commercial GC / insurance — intent + decisions
narrative.pricing_and_sales_cycle     · 250-350 words · pricing signals from reviews + job duration + decision factors
narrative.website_strategy            · 400-500 words · recommended page list with role + primary CTA per page
narrative.header_components           · 200-300 words · logo, nav, phone, primary CTA, mobile behavior
narrative.footer_components           · 300-400 words · ABN sentence, address with map link, hours, license, socials, footer nav
narrative.cta_strategy                · 300-400 words · primary + secondary CTA, where each appears, form fields if quote form
narrative.hero_copy_options           · 3 candidates · each: eyebrow + H1 (with concrete number) + subhead (30-50 words) + 3 proof chips
narrative.about_us_draft              · 400-500 words · ready-to-publish about page paragraphs
narrative.faq_topics_with_answers     · 10-12 Q&A pairs · each answer 80-150 words · grounded in real_facts
narrative.todo_for_human              · 5-10 items · ranked by impact · what the human teammate must verify/add before launch
\`\`\`

# OUTPUT FORMAT

STRICT JSON · no markdown fences · no commentary. Start with { · end with }.
Schema:
{
  "real_facts": { <field>: <value>, ... },
  "real_facts_sources": { <field>: ["GBP", "website-crawl", ...] },
  "brand_signals": {...},
  "content_assets": {...},
  "ai_extensions": {...},
  "data_gaps": {...},
  "narrative": {
    "executive_summary": "...",
    "company_background": "...",
    "team_and_culture": "...",
    "service_scope_detailed": "...",
    "service_area": "...",
    "customer_voice": "...",
    "brand_voice_and_visual": "...",
    "competitive_positioning": "...",
    "trust_signals_catalog": "...",
    "visitor_personas": "...",
    "pricing_and_sales_cycle": "...",
    "website_strategy": "...",
    "header_components": "...",
    "footer_components": "...",
    "cta_strategy": "...",
    "hero_copy_options": [{"eyebrow":"...","h1":"...","subhead":"...","proof_chips":["...","...","..."]}, ...],
    "about_us_draft": "...",
    "faq_topics_with_answers": [{"q":"...","a":"..."}, ...],
    "todo_for_human": ["...", "..."]
  }
}

# RAW SOURCES (full corpus · read carefully · cite specifically)

{INPUTS_JSON}
`;

/**
 * DEEP MODE · Fuse ALL raw sources (not just owned-website crawl) into a
 * single core-extract.json with per-field source citations and data-gaps.
 *
 * @param {object} inputs · { entity, crawlResult, mentions, dataCoverage, brandSpec }
 * @returns {{brief, raw_response, provider, cost_estimate, duration_ms, prompt_length}}
 */
export async function buildCoreExtract(inputs) {
  const start = Date.now();
  const { entity, crawlResult, mentions = [], dataCoverage, brandSpec, backend, model, reviewsFixture, imageManifest, masterMd } = inputs || {};
  const facts = entity?.latest || {};
  const places = facts.places_enrichment || {};
  const enrich = entity?.enrichment || {};

  // Pass FULL markdown of each crawled page (no truncation · most pages are <5KB)
  const pagesForPrompt = (crawlResult?.pages || []).map(p => ({
    url: p.url,
    title: p.title,
    text_md: p.text || '',
    images: (p.images || []).map(im => ({ src: im.src, alt: im.alt })),
    meta: p.meta,
  }));

  const inputsJson = {
    GBP: {
      name: facts.name,
      phone: facts.phone,
      email: facts.email,
      address: facts.address,
      city: facts.city,
      state: facts.state,
      website: facts.website,
      rating: facts.rating,
      review_count: facts.review_count,
      categories: facts.categories,
      gbp_types: places.types,
      hours: facts.hours,
      hours_verified: places.opening_hours_verified,
      photo_urls: (places.photo_urls || []),
      editorial_summary: places.editorial_summary,
      about: places.about,
    },
    ABN: enrich.abn || null,
    WHOIS: enrich.whois || null,
    Wayback: enrich.wayback || null,
    // FULL verbatim Google reviews · this is gold for testimonials + voice analysis
    'google-reviews-verbatim': (reviewsFixture?.fetched?.reviews || []).map(r => ({
      author: r.author_name,
      rating: r.rating,
      text: r.text,
      relative_time: r.relative_time_description,
      time: r.time,
    })),
    'reviews-analysis': reviewsFixture?.analysis || null,
    'website-crawl': pagesForPrompt,
    // FULL tinyfish mentions · including raw_markdown (newly preserved) + summary
    'tinyfish-mentions': (mentions || []).map(m => ({
      url: m.url,
      title: m.title,
      domain: m.domain,
      description: m.description,
      fetch_source: m.fetch_source,
      raw_markdown: m.raw_markdown || null,  // ← now populated by pl:summarize-external-mentions
      raw_chars: m.raw_chars,
      summary: m.extracted_summary?.summary,
      page_type: m.extracted_summary?.page_type,
      concrete_facts: m.extracted_summary?.concrete_facts,
      info_value: m.extracted_summary?.info_value,
    })),
    'owned-site-images': (imageManifest?.images || []).map(im => ({
      filename: im.filename,
      alt: im.alt,
      category: im.category,
      subcategory: im.subcategory,
      width: im.width,
      height: im.height,
    })),
    'master-md-aggregated': masterMd ? masterMd.slice(0, 30000) : null,
    brand_spec: brandSpec ? { colors: brandSpec.colors, fonts: brandSpec.fonts, personality: brandSpec.brand_personality } : null,
    data_coverage_notes: dataCoverage ? { ai_ready: dataCoverage.ai_ready, todolist_count: (dataCoverage.todolist || []).length, statuses: Object.fromEntries(Object.entries(dataCoverage.sources || {}).map(([k, v]) => [k, v.status])) } : null,
  };

  const prompt = DEEP_PROMPT_TEMPLATE.replace('{INPUTS_JSON}', JSON.stringify(inputsJson, null, 2));

  let result;
  try {
    result = backend ? await runAiSingle(prompt, backend, model) : await runAiCascade(prompt);
  } catch (err) {
    return { brief: null, error: err.message, duration_ms: Date.now() - start, provider: backend || 'cascade' };
  }
  const brief = extractJson(result.text);
  return {
    brief,
    raw_response: result.text.slice(0, 5000),
    provider: result.provider,
    model: result.model,
    cost_estimate: result.provider === 'ollama' ? 0 : result.provider === 'codex_cli' ? 0.5 : 1.5,
    duration_ms: Date.now() - start,
    prompt_length: prompt.length,
  };
}

/** Save deep core-extract to disk */
export function saveCoreExtract(slug, result, repoRoot = process.cwd()) {
  const outPath = path.join(repoRoot, 'clients', slug, 'v2/core-extract.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  return outPath;
}
