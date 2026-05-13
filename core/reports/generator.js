/**
 * M2-D9 · Report generator preambles.
 *
 * Two audiences:
 *   - internal · ProfitsLocal sales operator (information-dense, technical)
 *   - customer · local small-business owner (plain language, 5-min scan, no jargon, no prices)
 *
 * Consumed by autoresearch-loop.js (`audience` arg) and CLI pl:report-optimize.
 */

export const SYSTEM_PREAMBLES = {
  internal: [
    'You are writing an INTERNAL audit report for a ProfitsLocal sales operator.',
    'Audience: ProfitsLocal sales / operations · technical fluency assumed.',
    '',
    'Style rules:',
    '- Information-dense · every data point traceable to audit fixtures',
    '- Preserve raw scores, fired triggers, technical terms (LCP, CRUX, sitemap, pixel)',
    '- Numbers in English, body prose in Chinese (per typography rule)',
    '- Include $-pricing recommendations and grading rationale',
  ].join('\n'),

  // customer audience preamble — see also docs/v3/M2-D9-CUSTOMER-AUDIENCE-REPORT.md
  // V3 D26 (2026-05-13): customer-facing reports MUST be in ENGLISH (Australian
  // local businesses · no Chinese characters). Internal stays Chinese (operator-facing).
  customer: [
    'You are writing a CUSTOMER-FACING audit report for a local Australian small-business owner.',
    '// audience: customer (plain-language · English)',
    'Audience: Australian roofing, restaurant, dental, cafe, plumbing, etc. owners · no web/tech background.',
    '',
    'Style rules:',
    '- LANGUAGE: ENGLISH ONLY · plain Australian-friendly English · no Chinese characters anywhere',
    '- Use Australian spelling (colour, optimise, behaviour) not American',
    '- Plain language · 5-minute scan-friendly · no jargon (no GTM, pixel, sitemap, CRUX, LCP)',
    '- Translate technical findings into customer impact ("more calls", "easier to book")',
    '- Do NOT mention prices or quote figures — close with an invitation to a 30-min walkthrough',
    '- Aim for Flesch reading ease ≥ 60 (Grade 7-8 level)',
    '- Friendly, non-salesy tone · honest about what is working, gentle about what is not',
  ].join('\n'),
};

export function getPreamble(audience) {
  const key = String(audience || 'internal').toLowerCase();
  return SYSTEM_PREAMBLES[key] || SYSTEM_PREAMBLES.internal;
}

export function listAudiences() {
  return Object.keys(SYSTEM_PREAMBLES);
}
