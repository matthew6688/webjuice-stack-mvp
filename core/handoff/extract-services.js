/**
 * SOP-3 Phase B1 · Extract real service list from customer's page markdown.
 *
 * Input:
 *   - pagesDir: clients/<slug>/v2/multi-page-crawl/pages/
 *   - gbpCategories: array from entity.latest.places_enrichment.categories
 *   - homepageMdPath: optional · clients/<slug>/v2/enrichment/tinyfish-homepage.md
 *
 * Output: services.json shape:
 *   {
 *     services: [
 *       { id, name, desc, page_slug, icon, _source },
 *     ],
 *     _meta: { generator, sources_used, tier_used, latency_ms }
 *   }
 *
 * Strategy:
 *   1. Aggregate text from /services* pages + homepage md (capped at ~6000 chars)
 *   2. Single LLM call: "Extract service list, return JSON"
 *   3. Each service gets _source = 'verified:scraped:<page>' if extracted from real page
 *   4. If LLM returns nothing useful · fallback to niche-typical (caller's responsibility)
 */
import fs from 'node:fs';
import path from 'node:path';
import { runTask, extractJson } from '../autoresearch/llm-cascade.js';
import { buildLicensingContextBlock, buildForbiddenPhrasesBlock } from './niche-spec-loader.js';
import { cleanScrapedText } from './scrape-cleaner.js';
import { buildPersonaContextBlock } from './persona-context.js';

const RELEVANT_PAGE_PATTERNS = [
  /services?/i,
  /^index\.md$/i,
  /^home/i,
  /products?/i,
  /what-we-do/i,
];

function readRelevantPages(pagesDir) {
  if (!fs.existsSync(pagesDir)) return [];
  const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.md'));
  const relevant = files.filter((f) => RELEVANT_PAGE_PATTERNS.some((re) => re.test(f)));
  return relevant.map((f) => {
    const full = fs.readFileSync(path.join(pagesDir, f), 'utf8');
    const { clean, hadParkedDomainSignal, isMostlyJunk } = cleanScrapedText(full);
    return { file: f, body: clean, bytes: clean.length, parked: hadParkedDomainSignal, junk: isMostlyJunk };
  }).filter((p) => !p.junk);
}

function buildPrompt({ businessName, niche, city, state, pages, gbpCategories, homepageBody, personaBlock = '' }) {
  const pageContext = pages.map((p) => `### Page: ${p.file} (${p.bytes} bytes)\n\n${p.body.slice(0, 2500)}`).join('\n\n---\n\n');
  const homepageBlurb = homepageBody ? `### Homepage markdown (Tinyfish · for context)\n\n${homepageBody.slice(0, 2500)}` : '';
  const gbpStr = (gbpCategories || []).join(', ') || '(none)';
  const licensingContext = buildLicensingContextBlock({ state });
  const forbiddenPhrases = buildForbiddenPhrasesBlock();
  return `Write PERSUASION-LAYER service content for a local Australian ${niche}'s website. Output STRICT JSON only.

${licensingContext}

${forbiddenPhrases}

Business: ${businessName}
Niche: ${niche}
City: ${city}, ${state || ''}
Google Business Profile categories: ${gbpStr}

# Customer's actual website content (scraped)

${pageContext}

${homepageBlurb}
${personaBlock ? '\n' + personaBlock + '\n' : ''}
# Task

For each REAL service the business offers (based on scraped content + GBP categories), write a complete persuasion-layer content block using the PASTOR framework. Do NOT extract bland facts — write sales copy that converts.

## PASTOR framework per service

For each service, generate these fields IN ORDER:

1. **pain_hook** (50 words, 2 sentences): Open with the specific homeowner/builder pain that this service solves. Use concrete symptoms ("ceiling stains after the autumn rain", "tiles popping on the north-facing slope") not generic problems.

2. **cost_of_delay** (40 words): The NON-DOLLAR consequences of waiting — concrete physical escalation ("a cracked valley becomes a sagging ceiling", "rust spreads from one sheet to the run"). NEVER state dollar amounts, price ranges, or invented costs (codex R110 · demo honesty).

3. **transformation** (50 words): What the home/property looks like AFTER the work. Specific visual + functional outcome.

4. **why_us** (3 differentiators · 25 words each): What makes THIS business different. Pull from scraped data + GBP. Use a number ONLY if it is sourced — otherwise state the differentiator plainly. NEVER use "trusted partner / quality service" clichés.

5. **process_summary** (60 words): Brief 4-step process (quote → site visit → installation → warranty). State durations ONLY if sourced; otherwise describe each step plainly without inventing timeframes.

6. **materials_or_specifications** (40 words): Named materials (Colorbond / specific brand / certification). Pull from scraped content where possible. Do NOT invent a brand/certification not in the source.

7. **risk_reversal** (35 words): Free-quote framing + warranty ONLY as it appears in the source. Do NOT invent a guarantee or warranty length. Anti-objection.

8. **urgency_close** (30 words): Honest "when to call" guidance (e.g. "book before the storm season", "get the quote in before the roof leaks again"). NEVER fake scarcity, fake deadlines, or "limited spots" pressure.

## Output shape

Return STRICT JSON · max 6 services:

\`\`\`json
{
  "services": [
    {
      "id": "kebab-case-id",
      "name": "Service Name (3-5 words)",
      "short_desc": "1-sentence card-summary · 15 words max · for service-grid",
      "page_slug": "/services/<id>",
      "icon": "lucide-icon-name",
      "evidence_quote": "5-15 word verbatim quote from scrape (or '[no quote · derived]')",
      "evidence_page": "page filename",
      "persuasion": {
        "pain_hook": "...",
        "cost_of_delay": "...",
        "transformation": "...",
        "why_us": ["differentiator 1 · with number", "differentiator 2 · with number", "differentiator 3 · with number"],
        "process_summary": "...",
        "materials_or_specifications": "...",
        "risk_reversal": "...",
        "urgency_close": "..."
      }
    }
  ],
  "notes": "Brief observations from data"
}
\`\`\`

# Hard rules

- Australian English. Trade-honest tone. Direct, declarative sentences. No corporate fluff.
- Lead every sentence with a concrete fact (number, material brand, specific symptom). NOT adjectives.
- NEVER use "trusted partner", "quality service", "we pride ourselves", "tailored solutions", "innovative", "best in class".
- NEVER invent or alter licence numbers, ABN, phone, address, founding years, team sizes (codex R107 — identity facts are sacred). Dollar prices: never state any.
- The "short_desc" is the ONLY field rendered on the page — it MUST be a concrete, fact-locked card summary (≤18 words): what the service is + one real spec (material / warranty if sourced). No marketing adjectives.
- State licensing / warranties ONLY as they appear in scraped data. Do NOT generalise ("fully licensed", "guaranteed") beyond the source. Do NOT echo the source's self-praise ("leading", "best", "trusted").
- If a fact isn't in the scraped data, prefer a manufacturer/industry standard stated as such (e.g. "Colorbond steel carries a 36-year coating warranty") — never a business-specific stat you can't source.
- Each persuasion field is REQUIRED. No empty strings.
- If a service is recognizable from data but specifics are thin, write best-guess persuasion grounded in industry typical (e.g. roof replacement always involves removal + install + flashings + warranty).

Output ONLY the JSON. No markdown fence. No prose.`;
}

/**
 * @param {object} opts
 *   - pagesDir, homepageMdPath, businessName, niche, city, gbpCategories
 */
export async function extractServices(opts) {
  const start = Date.now();
  const pages = readRelevantPages(opts.pagesDir);

  let homepageBody = '';
  if (opts.homepageMdPath && fs.existsSync(opts.homepageMdPath)) {
    const raw = fs.readFileSync(opts.homepageMdPath, 'utf8');
    homepageBody = cleanScrapedText(raw).clean;
  }

  if (!pages.length && !homepageBody) {
    return { ok: false, reason: 'no pages and no homepage md', latency_ms: Date.now() - start };
  }

  // R108 step 6: persona-aware generation (env-gated · default off until step-7 comparison passes).
  const personaBlock = buildPersonaContextBlock(opts.facts || {}, {
    brief: opts.brief || {}, section: 'services', enabled: process.env.PERSONA_CONTEXT === '1',
  });

  const prompt = buildPrompt({
    businessName: opts.businessName,
    niche: opts.niche,
    city: opts.city,
    state: opts.state,
    pages,
    gbpCategories: opts.gbpCategories,
    homepageBody,
    personaBlock,
  });

  const res = await runTask('extract_services_from_site', { prompt, timeoutMs: 120_000 });

  if (!res.ok) {
    return { ok: false, reason: res.reason || 'LLM cascade failed', latency_ms: Date.now() - start, fallback_chain: res.fallback_chain };
  }

  const parsed = extractJson(res.output);
  if (!parsed || !Array.isArray(parsed.services)) {
    // Write full raw output to debug file so future failures are diagnosable instead of silently
    // truncating to 500 chars. Path mirrors run-level _enrich-handoff-run.json colocation.
    const debugPath = opts.debugPath || null;
    if (debugPath) {
      try {
        const fs = await import('node:fs');
        fs.writeFileSync(debugPath, JSON.stringify({
          step: 'B1.extract-services',
          at: new Date().toISOString(),
          parseFailed: true,
          rawOutput: res.output,
          parsedShape: parsed ? Object.keys(parsed) : null,
          latency_ms: Date.now() - start,
        }, null, 2));
      } catch { /* ignore */ }
    }
    return {
      ok: false,
      reason: parsed ? 'parsed but services[] missing or non-array' : 'output not valid JSON',
      raw_output: res.output.slice(0, 500),
      raw_full_path: debugPath,
      parsed_shape: parsed ? Object.keys(parsed) : null,
      latency_ms: Date.now() - start,
    };
  }

  // Tag each service's provenance
  const services = parsed.services.map((s, idx) => {
    const hasQuote = s.evidence_quote && !s.evidence_quote.startsWith('[no quote');
    const isNicheTypical = (s.desc || '').startsWith('[niche typical]');
    return {
      id: s.id || `service-${idx + 1}`,
      name: s.name,
      short_desc: s.short_desc || s.desc || '',
      long_desc: s.long_desc || s.desc || '',
      desc: s.short_desc || s.desc || '',
      persuasion: s.persuasion || null,
      page_slug: s.page_slug || `/${s.id || `service-${idx + 1}`}`,
      icon: s.icon || 'sparkles',
      evidence_quote: hasQuote ? s.evidence_quote : null,
      evidence_page: s.evidence_page || null,
      _source: isNicheTypical
        ? `niche-optimized:${opts.niche}`
        : (hasQuote
          ? `verified:scraped:${s.evidence_page || 'site'}`
          : res._source),
    };
  });

  return {
    ok: true,
    services,
    notes: parsed.notes || '',
    _meta: {
      generator: 'B1-extract-services · SOP-3 Phase B',
      pages_used: pages.map((p) => p.file),
      homepage_md_used: !!homepageBody,
      tier_used: res.tier_used,
      tool: res.tool,
      model: res.model,
      llm_latency_ms: res.latency_ms,
      total_latency_ms: Date.now() - start,
      generated_at: new Date().toISOString(),
    },
  };
}
