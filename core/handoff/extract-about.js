/**
 * SOP-3 Phase B2 · Extract owner/business narrative from customer's about page + enrichment.
 *
 * Input:
 *   - aboutMdPath: clients/<slug>/v2/multi-page-crawl/pages/about-us.md (or about.md)
 *   - homepageMdPath: clients/<slug>/v2/enrichment/tinyfish-homepage.md
 *   - facts: { business_name, niche, city, domain_age_years, rating, review_count, abn }
 *   - enrichment: { tinyfish_search, wayback, abn, ... } (optional · provides external mentions)
 * Output: about.md text with frontmatter; each paragraph tagged in _meta with provenance
 *
 * Strategy:
 *   1. Aggregate about + homepage md + verified facts
 *   2. LLM: "write 3-4 paragraph about narrative, faithful to scraped text, no hallucinated awards"
 *   3. LLM also returns _meta.sources_used so we know what got cited
 */
import fs from 'node:fs';
import { runTask, extractJson } from '../autoresearch/llm-cascade.js';
import { buildLicensingContextBlock, buildForbiddenPhrasesBlock } from './niche-spec-loader.js';
import { buildPersonaContextBlock } from './persona-context.js';
import { cleanScrapedText } from './scrape-cleaner.js';

function safeRead(p) {
  try { return cleanScrapedText(fs.readFileSync(p, 'utf8')).clean; } catch { return ''; }
}

function buildPrompt({ businessName, niche, city, facts, aboutBody, homepageBody, externalMentions, style = 'safe', personaBlock = '' }) {
  // Rich locked facts (services / suburbs / licence / radius / material) make the copy SPECIFIC.
  // R93 finding: a thin factsBlock forces the LLM back onto vague scraped text and it pads.
  const svcNames = (facts.services || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean);
  const suburbs = facts.suburbs_covered || facts.suburbs || [];
  const lic = facts.license && (facts.license.number || facts.license.authority)
    ? `${facts.license.authority || ''} ${facts.license.number || ''} (${facts.license.status || 'status unknown'})`.trim()
    : (typeof facts.license === 'string' ? facts.license : null);
  const factsBlock = [
    `- Business: ${facts.business_name || businessName}`,
    `- Niche: ${facts.niche || niche}`,
    `- City / primary service area: ${facts.city || city}${facts.state ? ', ' + facts.state : ''}`,
    `- Address: ${facts.address || '(not provided)'}`,
    `- Phone: ${facts.phone || '(not provided)'}`,
    `- Rating: ${facts.rating ?? '?'}★ (${facts.review_count ?? 0} reviews) — do NOT derive exact job/project counts from this`,
    facts.service_radius_km ? `- Service radius: ${facts.service_radius_km} km` : null,
    suburbs.length ? `- Service suburbs (${suburbs.length}): ${suburbs.slice(0, 16).join(', ')}` : null,
    svcNames.length ? `- Services: ${svcNames.join('; ')}` : null,
    facts.primary_material ? `- Materials: ${facts.primary_material}` : null,
    lic ? `- Licence: ${lic} (state EXACTLY as written · do not generalise)` : null,
    `- ABN: ${facts.abn || '(not provided)'}`,
    facts.entity_type ? `- Entity type: ${facts.entity_type}` : null,
    facts.year_founded ? `- Founded: ${facts.year_founded}` : `- Founding year: UNKNOWN — do NOT state any founding year or "since YYYY"`,
  ].filter(Boolean).join('\n');

  const mentions = (externalMentions || []).slice(0, 6).map((m) => `- ${m.title} · ${m.domain}`).join('\n') || '(none)';

  const licensingContext = buildLicensingContextBlock(facts);
  const forbiddenPhrases = buildForbiddenPhrasesBlock();

  // R93 bake-off (codex R99/R102/R103): the fact-locked CONTRACT is what fixed the copy, not the
  // generation strategy. Direct generation (this builder) + the contract below. Two styles share ONE
  // contract: 'safe' (default · flat/audit-safe/low-variance · for unattended scale) and 'flagship'
  // (richer real-tradesperson voice · opt-in for Matthew-reviewed flagship/calibration clients).
  const isFlagship = style === 'flagship';
  const voiceLine = isFlagship
    ? 'Write in a confident, concrete real-tradesperson voice — specific and lightly persuasive. Lead each paragraph with the strongest concrete fact.'
    : 'Plain, factual, scannable. State what they do, where, and what makes it concrete. No flourish, no salesmanship.';
  const wordBudget = isFlagship ? '180-240' : '130-200';
  const paraCount = isFlagship ? '3 paragraphs' : '3 short paragraphs';

  return `Write the About section for ${facts.business_name || businessName}'s new website.

${licensingContext}

${forbiddenPhrases}

# LOCKED FACTS (the ONLY hard facts you may state · never add to this list)

${factsBlock}

# SCRAPED SOURCE (ground every sentence here or in a locked fact · paraphrase honestly · do not copy verbatim, do not invent beyond it)

## About page
${aboutBody.slice(0, 2600) || '(none)'}

## Homepage
${homepageBody.slice(0, 1400) || '(none)'}

## External mentions
${mentions}
${personaBlock ? '\n' + personaBlock + '\n' : ''}
# OUTPUT CONTRACT (non-negotiable · identical safety policy for both styles)
- EXACTLY ${paraCount} · ~${wordBudget} words TOTAL (HARD CEILING 320) · EACH paragraph ≤ 85 words.
- Do NOT write a closing paragraph about your "approach", "process", "commitment", "flexibility",
  "client relationships", or "why choose us" — that is generic filler that could describe any trade and
  WILL be rejected. End on concrete facts (services / licence / contact). When the concrete facts run out,
  STOP — fewer paragraphs is correct, padding is a failure.
- Australian English. Declarative. ${voiceLine}
- Ground EVERY sentence in a LOCKED FACT or the scraped source. Phrase AROUND facts; never own new facts.
- HARD FACTS: licence authority/number/status, business name, ABN, phone, and address MUST be exact from
  LOCKED FACTS/source. Never invent or generalise these.
- DEMO PLACEHOLDERS: project/job counts, review counts, years-in-business estimates, AI-style testimonials,
  and other soft marketing stats are allowed only as demo placeholders. Prefer pass-through from
  LOCKED FACTS/source. Do NOT proactively invent exact counts such as "500 roofs" or "120 reviews".
  If useful and not sourced, use vague scale language ("many", "a broad range of", "homes across <city>")
  and include a demo_placeholders entry so provenance can mark it for customer replacement.
- WARRANTY: may be stated when present in LOCKED FACTS/source. Do not invent a warranty length or scope.
- FORBIDDEN — invented awards, named people, dollar prices, licence/identity facts, or exact review/job counts.
- DO NOT ECHO SOURCE SELF-PRAISE. Even if the scraped source says "one of the largest", "leading", "best",
  "high-quality workmanship", "superior service/responsiveness", "industry-leading", "trusted" — do NOT
  repeat it. Take only CHECKABLE facts from the source (suburbs, services, licence, materials), never its
  marketing adjectives or boasts. Every sentence must carry a concrete fact, not a quality claim.
- FORBIDDEN — commitment-style promises stated as guarantees. Do NOT state a response time / SLA in the
  About section at all (it belongs in services/contact). If you must reference responsiveness, phrase it
  strictly as a target ("aims to respond within …"), never as a guarantee.
- COUNTS MUST MATCH: if you state a number of suburbs/services/years, it must EXACTLY equal what you then
  list. Safer: name the suburbs/services without claiming a count. Never write "16 suburbs" then list 15.
- Do NOT repeat the same service list or idea across multiple paragraphs. Each paragraph earns its place.
- LICENCE: state licensing ONLY exactly as it appears in the locked facts/source (authority + number).
  Do NOT generalise ("fully licensed", "single licensed operation", "all work is licensed") beyond the source.
- FORBIDDEN clichés: "trusted partner", "your trusted X", "quality workmanship you can trust",
  "we pride ourselves", "welcome to", "innovative solutions", "tailored to your needs", "best in class".
- FORBIDDEN internal/workflow/AI words: "concept", "preserve", "placeholder", "template",
  "verified:scraped", "niche typical".
- If a section's data is thin, write LESS — never pad.

# OUTPUT (JSON only · no prose before/after)
{
  "paragraphs": [
    { "text": "<paragraph · ≤85 words>", "sources": ["facts.<field>", "scraped:about-us.md"], "_source_label": "verified:scraped | mixed:verified+ai-completed" }
  ],
  "demo_placeholders": [
    { "claim": "<placeholder phrase>", "type": "project_count | review_count | years_estimate | testimonial | soft_stat", "replace_policy": "replace_required" }
  ],
  "summary_line": "12-18 word elevator pitch",
  "tone_descriptor": "short tone label"
}`;
}

/**
 * @param {object} opts
 *   - aboutMdPath, homepageMdPath
 *   - facts: { business_name, niche, city, ... }
 *   - externalMentions: optional [{title, url, domain}]
 */
export async function extractAbout(opts) {
  const start = Date.now();
  const aboutBody = safeRead(opts.aboutMdPath);
  const homepageBody = safeRead(opts.homepageMdPath);
  if (!aboutBody && !homepageBody) {
    return { ok: false, reason: 'no scraped content available', latency_ms: Date.now() - start };
  }

  // R108 step 6: persona-aware generation (env-gated · default off until step-7 comparison passes).
  const personaBlock = buildPersonaContextBlock(opts.facts || {}, {
    brief: opts.brief || {}, section: 'about', enabled: process.env.PERSONA_CONTEXT === '1',
  });

  const prompt = buildPrompt({
    businessName: opts.facts?.business_name,
    niche: opts.facts?.niche,
    city: opts.facts?.city,
    facts: opts.facts || {},
    aboutBody,
    homepageBody,
    externalMentions: opts.externalMentions,
    style: opts.style === 'flagship' ? 'flagship' : 'safe',
    personaBlock,
  });

  const res = await runTask('extract_about_narrative', { prompt, timeoutMs: 120_000 });
  if (!res.ok) {
    return { ok: false, reason: res.reason, latency_ms: Date.now() - start, fallback_chain: res.fallback_chain };
  }
  const parsed = extractJson(res.output);
  if (!parsed || !Array.isArray(parsed.paragraphs)) {
    return { ok: false, reason: 'invalid JSON', raw_output: res.output.slice(0, 500), latency_ms: Date.now() - start };
  }

  // Build markdown with frontmatter listing per-paragraph provenance
  const sources = parsed.paragraphs.map((p, i) => ({ idx: i + 1, sources: p.sources || [], label: p._source_label || res._source }));
  const demoPlaceholders = Array.isArray(parsed.demo_placeholders) ? parsed.demo_placeholders : [];
  const md = [
    '---',
    `business_name: ${opts.facts?.business_name || ''}`,
    `niche: ${opts.facts?.niche || ''}`,
    `city: ${opts.facts?.city || ''}`,
    `generated_at: ${new Date().toISOString()}`,
    `tone_descriptor: ${parsed.tone_descriptor || ''}`,
    `summary_line: ${parsed.summary_line || ''}`,
    `_meta_generator: B2-extract-about · SOP-3 Phase B · R93 contract`,
    `_meta_about_style: ${opts.style === 'flagship' ? 'flagship' : 'safe'}`,
    `_meta_tier_used: ${res.tier_used}`,
    `_meta_tool: ${res.tool}`,
    `_meta_model: ${res.model}`,
    `_meta_about_md_used: ${!!aboutBody}`,
    `_meta_homepage_md_used: ${!!homepageBody}`,
    `_meta_per_paragraph_sources: ${JSON.stringify(sources)}`,
    `_meta_demo_placeholders: ${JSON.stringify(demoPlaceholders)}`,
    '---',
    '',
    `# About ${opts.facts?.business_name || ''}`,
    '',
    ...parsed.paragraphs.map((p, i) => `${p.text}\n\n<!-- source: ${p._source_label || res._source} | refs: ${(p.sources || []).join(', ')} -->\n`),
  ].join('\n');

  return {
    ok: true,
    markdown: md,
    summary_line: parsed.summary_line,
    tone_descriptor: parsed.tone_descriptor,
    _meta: {
      generator: 'B2-extract-about · SOP-3 Phase B',
      tier_used: res.tier_used,
      tool: res.tool,
      model: res.model,
      llm_latency_ms: res.latency_ms,
      total_latency_ms: Date.now() - start,
      per_paragraph_sources: sources,
      demo_placeholders: demoPlaceholders,
      generated_at: new Date().toISOString(),
    },
  };
}
