/**
 * Visual Audit prompt template.
 *
 * Designed per V2 PRD Visual Auditor spec PLUS the "audit must be
 * actionable" rule (every issue needs why/what-correct/how-to-fix).
 *
 * Output is strict JSON with fields the report renderer + redesign
 * brief generator both consume.
 */

export const VISUAL_AUDIT_OUTPUT_SCHEMA_DESCRIPTION = `
{
  "freshness_score": 1-10,            // visual modernity (1=2008-style, 10=2025-best-in-class)
  "trust_score": 1-10,                // does it look like a real, current, professional business?
  "conversion_score": 1-10,           // does the design help a local-search visitor act?
  "design_age_estimate": "modern" | "slightly_outdated" | "outdated" | "severely_outdated",
  "summary": "one sentence, neutral tone, no jargon",
  "issues": [
    {
      "id": "snake_case_short_id",
      "severity": "critical" | "major" | "minor",
      "title": "<= 60 char human title",
      "what_observed": "ground in the screenshot — describe the specific visual artifact you see",
      "why_problem": "explain WHY this hurts trust or conversion in plain language; reference how a Google-searching local customer would react",
      "what_correct_looks_like": "what a well-designed alternative looks like; concrete, not 'modern and clean'",
      "how_to_fix_in_redesign": "concrete change ProfitsLocal would make in the redesign",
      "plain_explanation": "Chinese (中文) — translate the technical observation into a sentence a non-technical small-business owner can understand. Use everyday language. NO jargon.",
      "customer_impact": "Chinese (中文) — explain how this directly costs the business money or customers. Reference percentages or behavioral patterns when known (e.g. '70% of local searches are mobile', 'visitors decide in 8 seconds'). Tie back to the customer's GBP traffic when possible."
    }
  ],
  "positive_observations": ["things worth preserving in the redesign — short bullets"],
  "redesign_priorities": ["1. highest priority change", "2. second", "3. third"],
  "confidence": 0.0-1.0
}
`;

export function buildVisualAuditPrompt({ businessName, niche, city, hasMobile = true }) {
  return `You are a senior conversion-focused designer auditing the website of a local service business.

Business: ${businessName || '(unknown)'}
Industry: ${niche || '(unknown)'}
Location: ${city || '(unknown)'}
Inputs: 1 desktop screenshot${hasMobile ? ' + 1 mobile screenshot' : ''}

GOAL
Audit the screenshot(s) for visual quality, trust signals, and conversion barriers
that would affect a local-search customer (someone searching "${niche || '<service>'} ${city || '<city>'}"
on their phone or laptop).

CRITICAL OUTPUT RULES
- Output strict JSON only. No prose before or after the JSON.
- Every issue MUST include all four fields: what_observed, why_problem, what_correct_looks_like, how_to_fix_in_redesign.
- "what_observed" must reference a specific visual artifact in the screenshot (e.g. "the orange button in the top-right has a 1990s gradient bevel"). Do NOT make up things you cannot see.
- "why_problem" must explain in plain language how this hurts a real visitor's trust or willingness to act. No jargon ("SEO", "conversion rate optimization") — explain the human behavior.
- "what_correct_looks_like" must describe a concrete alternative. NOT "clean modern design" — something like "single-column on mobile with 16px+ body type, primary phone button visible without scrolling, max two accent colors".
- "how_to_fix_in_redesign" must be actionable enough to drop into a redesign brief. e.g. "replace gradient hero with flat coral CTA above fold", not "improve the hero".
- "plain_explanation" and "customer_impact" MUST be in Chinese (中文). They translate the same finding for a non-technical small-business owner. plain_explanation = WHAT it means in everyday language. customer_impact = WHY this costs money / customers, with a percentage or behavioral fact when possible.
- Severity guide: critical = breaks trust or conversion immediately (mobile broken, hidden contact, illegible text); major = noticeably degrades; minor = polish.
- positive_observations: things that ARE working and should be preserved. List 1-3.
- redesign_priorities: the top 3 changes in priority order, written as a one-line action item.
- Be specific. Vague output is worse than no output.

OUTPUT JSON SCHEMA
${VISUAL_AUDIT_OUTPUT_SCHEMA_DESCRIPTION}

Return ONLY the JSON. Begin with { and end with }.`;
}
