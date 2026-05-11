/**
 * AI / GEO (Generative Engine Optimization) readiness audit.
 *
 * Checks whether a website is set up to be discovered, parsed, and quoted
 * by AI agents (ChatGPT browsing, Perplexity, Google AI Overviews,
 * Claude search) in addition to traditional Google.
 *
 * Tier T0. Inputs: rawHtml + finalUrl. Optional: robots.txt content
 * (provided by sitemap-analyzer if available).
 *
 * 12 checks across 3 themes:
 *   - Crawl access:  llms.txt / robots.txt AI-bot policy / clean HTML
 *   - Structured data: LocalBusiness / Service / FAQPage / AggregateRating /
 *                      BreadcrumbList JSON-LD
 *   - E-E-A-T:       semantic HTML landmarks / NAP / license / years /
 *                    author / FAQ Q&A pattern in copy
 *
 * Output: { dimension_score 0-100, rules: [...], summary }
 */

const FETCH_TIMEOUT_MS = 8_000;

async function fetchText(url, fetchImpl = globalThis.fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetchImpl(url, { redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(timer); }
}

function findJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch {
      // partial / invalid JSON — note presence but not parseable
      blocks.push({ __invalid: true, raw_excerpt: m[1].slice(0, 200) });
    }
  }
  // Some sites wrap arrays of objects
  return blocks.flatMap((b) => (Array.isArray(b) ? b : [b])).flatMap((b) =>
    Array.isArray(b?.['@graph']) ? b['@graph'] : [b]
  );
}

function hasSchemaType(blocks, type) {
  return blocks.some((b) => {
    if (!b || typeof b !== 'object') return false;
    const t = b['@type'];
    if (!t) return false;
    if (Array.isArray(t)) return t.some((x) => String(x).toLowerCase().includes(type.toLowerCase()));
    return String(t).toLowerCase().includes(type.toLowerCase());
  });
}

function checkRobotsAiBots(robotsTxt) {
  if (!robotsTxt) return { mentions: [], explicit_policy: false };
  const aiBots = ['GPTBot', 'ClaudeBot', 'Claude-Web', 'CCBot', 'PerplexityBot', 'Google-Extended', 'anthropic-ai', 'Bytespider', 'Amazonbot', 'YouBot', 'Applebot-Extended'];
  const mentions = aiBots.filter((bot) => new RegExp(`User-agent:\\s*${bot}`, 'im').test(robotsTxt));
  return { mentions, explicit_policy: mentions.length > 0 };
}

function checkSemanticLandmarks(html) {
  const tags = ['<main', '<nav', '<header', '<footer', '<article', '<section', '<address'];
  return tags.filter((t) => html.includes(t));
}

function checkFaqPattern(html, plainText) {
  // Heuristic: H2/H3 ending in "?" + paragraph below = FAQ-style content
  const qHeadings = (html.match(/<h[23][^>]*>([^<]+\?)<\/h[23]>/gi) || []).length;
  const generalQuestions = ((plainText || '').match(/\?\s/g) || []).length;
  return { qHeadingCount: qHeadings, generalQuestions };
}

function checkEEATSignals(html, plainText) {
  const lc = (plainText || html || '').toLowerCase();
  const signals = {};
  signals.has_abn = /abn[:\s][\d ]{8,14}/i.test(html) || /\babn\b/i.test(lc);
  signals.has_qbcc = /qbcc/i.test(lc);
  signals.has_license = /licen[cs]e[:#\s]+\d/i.test(lc) || /licen[cs]ed/.test(lc);
  signals.has_years = /\b\d{1,2}\+?\s*years?\s*(?:of\s+)?(?:experience|in\s+business|trading)/i.test(lc) || /\bestablished\s+\d{4}/i.test(lc);
  signals.has_insurance = /public\s+liability|fully\s+insured|insurance/i.test(lc);
  signals.has_warranty = /warranty|guarantee/i.test(lc);
  return signals;
}

export async function auditAiGeoReadiness({
  rawHtml,
  markdown,
  finalUrl,
  robotsTxt: robotsTxtArg,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!rawHtml || !finalUrl) {
    return { ok: false, reason: 'rawHtml + finalUrl required', dimension_score: 0, rules: [] };
  }
  const origin = new URL(finalUrl).origin;

  // Probe llms.txt + (re-fetch robots if not given)
  const [llmsTxt, robotsTxt] = await Promise.all([
    fetchText(`${origin}/llms.txt`, fetchImpl),
    robotsTxtArg ? Promise.resolve(robotsTxtArg) : fetchText(`${origin}/robots.txt`, fetchImpl),
  ]);

  const blocks = findJsonLdBlocks(rawHtml);
  const aiBotPolicy = checkRobotsAiBots(robotsTxt || '');
  const landmarks = checkSemanticLandmarks(rawHtml);
  const faqPattern = checkFaqPattern(rawHtml, markdown);
  const eeat = checkEEATSignals(rawHtml, markdown);

  // 12 rules with weights summing to 100
  const rules = [
    { id: 'llms_txt_present', max: 5, hit: Boolean(llmsTxt),
      rationale: llmsTxt ? `llms.txt found (${llmsTxt.length} bytes)` : 'no /llms.txt at standard path' },

    { id: 'ai_bot_robots_policy', max: 5, hit: aiBotPolicy.explicit_policy,
      rationale: aiBotPolicy.explicit_policy
        ? `robots.txt mentions: ${aiBotPolicy.mentions.join(', ')}`
        : 'robots.txt has no explicit policy for AI crawlers (GPTBot/ClaudeBot/etc)' },

    { id: 'localbusiness_schema', max: 15, hit: hasSchemaType(blocks, 'LocalBusiness') || hasSchemaType(blocks, 'Organization'),
      rationale: hasSchemaType(blocks, 'LocalBusiness') ? 'LocalBusiness JSON-LD present'
        : hasSchemaType(blocks, 'Organization') ? 'Organization JSON-LD present (LocalBusiness preferred for local services)'
        : 'no LocalBusiness or Organization JSON-LD' },

    { id: 'service_schema', max: 10, hit: hasSchemaType(blocks, 'Service'),
      rationale: hasSchemaType(blocks, 'Service') ? 'Service JSON-LD present' : 'no Service JSON-LD' },

    { id: 'faqpage_schema', max: 10, hit: hasSchemaType(blocks, 'FAQPage'),
      rationale: hasSchemaType(blocks, 'FAQPage') ? 'FAQPage JSON-LD present' : 'no FAQPage JSON-LD (loses AI Overview / featured snippet eligibility)' },

    { id: 'aggregaterating_schema', max: 5, hit: hasSchemaType(blocks, 'AggregateRating'),
      rationale: hasSchemaType(blocks, 'AggregateRating') ? 'AggregateRating JSON-LD present' : 'no AggregateRating JSON-LD (★ rating not shown in search snippets)' },

    { id: 'breadcrumb_schema', max: 5, hit: hasSchemaType(blocks, 'BreadcrumbList'),
      rationale: hasSchemaType(blocks, 'BreadcrumbList') ? 'BreadcrumbList JSON-LD present' : 'no BreadcrumbList JSON-LD' },

    { id: 'semantic_landmarks', max: 10, hit: landmarks.length >= 4,
      rationale: `${landmarks.length} semantic landmarks present: ${landmarks.join(', ') || 'none'}` },

    { id: 'faq_qa_pattern', max: 10, hit: faqPattern.qHeadingCount >= 3,
      rationale: `${faqPattern.qHeadingCount} question-style heading(s) found (Q&A format helps AI extraction)` },

    { id: 'eeat_business_credentials', max: 10,
      hit: (eeat.has_abn ? 1 : 0) + (eeat.has_license || eeat.has_qbcc ? 1 : 0) + (eeat.has_years ? 1 : 0) + (eeat.has_insurance ? 1 : 0) >= 2,
      rationale: (() => {
        const counted = [
          eeat.has_abn && 'ABN',
          (eeat.has_license || eeat.has_qbcc) && 'license/QBCC',
          eeat.has_years && 'years-in-business',
          eeat.has_insurance && 'insurance',
        ].filter(Boolean);
        return counted.length >= 2
          ? `${counted.length}/4 credentials in copy: ${counted.join(', ')}`
          : `only ${counted.length}/4 credentials found${counted.length ? ` (${counted.join(', ')})` : ''} — need ≥2 of: ABN, license/QBCC, years-in-business, insurance`;
      })() },

    { id: 'eeat_warranty_trust', max: 5, hit: eeat.has_warranty,
      rationale: eeat.has_warranty ? 'warranty/guarantee mentioned' : 'no warranty/guarantee in copy' },

    { id: 'jsonld_at_least_one', max: 10, hit: blocks.length >= 1,
      rationale: `${blocks.length} JSON-LD block(s) detected on page` },
  ];

  const earned = rules.reduce((a, r) => a + (r.hit ? r.max : 0), 0);
  const max = rules.reduce((a, r) => a + r.max, 0);
  const dimension_score = Math.round((earned / max) * 100);

  // Summary one-liner
  let summary;
  if (dimension_score >= 70) summary = 'AI agent / 生成式搜索抓取与引用基础齐全';
  else if (dimension_score >= 40) summary = 'AI agent 抓取部分支持，但关键 schema / 凭证 / FAQ 缺失';
  else summary = 'AI agent / ChatGPT 几乎无法准确引用此网站 — 在生成式搜索时代等于隐身';

  return {
    ok: true,
    dimension_score,
    rules,
    summary,
    detail: {
      llms_txt: Boolean(llmsTxt),
      ai_bot_mentions: aiBotPolicy.mentions,
      jsonld_block_count: blocks.length,
      jsonld_types: [...new Set(blocks.map((b) => b?.['@type']).flat().filter(Boolean))],
      semantic_landmarks: landmarks,
      faq_q_headings: faqPattern.qHeadingCount,
      eeat,
    },
  };
}
