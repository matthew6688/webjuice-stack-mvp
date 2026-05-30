/**
 * SOP-3 Phase B3 · Generate 3 hero copy candidates from services + audit findings.
 *
 * Input:
 *   - services (from B1)
 *   - facts: { business_name, niche, city, phone, rating, review_count }
 *   - auditFindings: array of {id, severity, what_observed, fix_prescription}
 *   - currentHeroText: optional · what their existing site says in <h1>
 *
 * Output: 3 candidates each with rationale + audit-issues-addressed.
 */
import { runTask, extractJson } from '../autoresearch/llm-cascade.js';
import { buildLicensingContextBlock, buildForbiddenPhrasesBlock } from './niche-spec-loader.js';

function buildPrompt({ businessName, niche, city, state, phone, services, auditFindings, currentHeroText }) {
  const svcLines = (services || []).slice(0, 5).map((s) => `- ${s.name}: ${s.desc}`).join('\n') || '(none)';
  const auditLines = (auditFindings || []).slice(0, 8).map((f) => `- ${f.id} (${f.severity}): ${f.what_observed || ''} → fix: ${f.fix_prescription || ''}`).join('\n') || '(no specific audit issues)';
  const licensingContext = buildLicensingContextBlock({ state });
  const forbiddenPhrases = buildForbiddenPhrasesBlock();

  return `Generate 3 distinct hero copy candidates for the new website. Each candidate has:
- headline (5-9 words)
- subheadline (10-25 words)
- primary CTA (3-6 words)

${licensingContext}

${forbiddenPhrases}

Business: ${businessName}
Niche: ${niche}
City: ${city}, ${state || ''}
Phone: ${phone || '(not provided)'}

# Real services from their site

${svcLines}

# Audit issues to address (new design must improve these)

${auditLines}

${currentHeroText ? `# Existing hero text (current site)\n\n${currentHeroText}\n` : ''}

# Requirements

Write 3 hero copy candidates · each following a DIFFERENT conversion psychology framework:

## Candidate 1 · "PAS" (Problem → Agitate → Solve)
- Headline opens with the pain ("Roof leaking? · Storm damage?")
- Sub agitates the cost ("Don't wait — water gets in fast")
- CTA solves ("Free emergency quote in 24h")

## Candidate 2 · "Specificity wins" (numbers + proof)
- Headline leads with the strongest number from facts (years · warranty · rating)
- Sub stacks 2-3 concrete proof points (service area km · materials brand · review count)
- CTA: phone-direct

## Candidate 3 · "What's at stake" (loss aversion)
- Headline names what the homeowner loses by not acting ("Don't replace your roof twice")
- Sub explains why this provider eliminates that risk (warranty · materials · process)
- CTA: low-friction (free quote)

# Each candidate MUST include

- **headline**: 5-9 words · NO trailing period · MUST name the core service + the city/area (e.g. "Colorbond Roof Replacement · Ballarat")
- **subheadline**: 10-25 words · ONE sentence is safest · lead with material + area + service. Include ONE locked number (warranty / rating / radius) only when it reads naturally — do NOT force a number or the business name if it makes the line brittle (codex R110)
- **primary_cta**: { label, href, kind: "tel" } · always phone (highest intent)
- **secondary_cta**: { label, href, kind: "form" | "internal" } · form or browse
- **hero_form_fields**: ["name", "phone", "suburb", "service_interest"] (this is for the quick-quote form in hero · always 4 fields max)
- **proof_chips**: array of 3 short trust signals (e.g. "VBA Licensed", "10-yr warranty", "4.1★ · 18 reviews") · for trust strip below CTA
- **background_image_role**: "hero-roof.jpg" · "hero-aerial.jpg" · etc · from assets/
- **audit_issues_addressed**: array of audit finding IDs this hero solves
- **rationale**: 1-sentence why this candidate converts

# Hard rules

- NEVER clichés: "trusted partner", "X years of excellence", "we pride", "innovative", "tailored", "best in class", "your roofing experts"
- NEVER trailing period on headline (trade headlines are declarations, not magazine titles)
- NEVER invent or alter: licence numbers, ABN, phone, founding year, team size, awards, client quotes (codex R107 · identity facts are sacred)
- State a licence/warranty ONLY as it appears in facts — do NOT generalise or echo source self-praise ("leading", "best")
- Headline ≤ 9 words · subheadline ≤ 25 words (the audit hard-fails a subhead over 25 words)
- Numbers always specific ("20 years", "4.1★ · 18 reviews", "100km radius") · not vague ("many years", "happy customers")

# Output

\`\`\`json
{
  "candidates": [
    {
      "angle": "PAS | specificity | loss-aversion",
      "headline": "...",
      "subheadline": "...",
      "primary_cta": { "label": "Call <phone>", "href": "tel:...", "kind": "tel" },
      "secondary_cta": { "label": "...", "href": "...", "kind": "form" | "internal" },
      "hero_form_fields": ["name", "phone", "suburb", "service_interest"],
      "proof_chips": ["chip 1", "chip 2", "chip 3"],
      "background_image_role": "hero-roof.jpg",
      "audit_issues_addressed": ["..."],
      "rationale": "..."
    }
  ],
  "recommended_index": 0
}
\`\`\`

Output ONLY JSON.`;
}

export async function extractHeroCopy(opts) {
  const start = Date.now();
  const prompt = buildPrompt({
    businessName: opts.facts?.business_name,
    niche: opts.facts?.niche,
    city: opts.facts?.city,
    state: opts.facts?.state,
    phone: opts.facts?.phone,
    services: opts.services,
    auditFindings: opts.auditFindings,
    currentHeroText: opts.currentHeroText,
  });

  const res = await runTask('extract_hero_copy', { prompt, timeoutMs: 90_000 });
  if (!res.ok) return { ok: false, reason: res.reason, latency_ms: Date.now() - start, fallback_chain: res.fallback_chain };

  const parsed = extractJson(res.output);
  if (!parsed || !Array.isArray(parsed.candidates)) {
    return { ok: false, reason: 'invalid JSON', raw_output: res.output.slice(0, 500), latency_ms: Date.now() - start };
  }

  // Tag each candidate with provenance
  const candidates = parsed.candidates.map((c) => ({ ...c, _source: res._source }));

  return {
    ok: true,
    candidates,
    recommended_index: parsed.recommended_index || 0,
    _meta: {
      generator: 'B3-extract-hero · SOP-3 Phase B',
      tier_used: res.tier_used,
      tool: res.tool,
      model: res.model,
      llm_latency_ms: res.latency_ms,
      total_latency_ms: Date.now() - start,
      generated_at: new Date().toISOString(),
    },
  };
}
