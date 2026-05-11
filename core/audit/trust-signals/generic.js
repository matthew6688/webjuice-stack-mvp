/**
 * Generic trust signal audit — applies for niches we don't yet have
 * industry-specific adapters for.
 *
 * Covers the universal trust markers any local business benefits from:
 * ABN, insurance, years, awards, warranty, certifications.
 */

const SIGNALS = [
  { id: 'abn', name: 'ABN', weight: 20, patterns: [/\babn[\s:#]*\d{11}|\babn[\s:#]*\d{2}[\s.]*\d{3}[\s.]*\d{3}[\s.]*\d{3}/i] },
  { id: 'insurance', name: '保险', weight: 15, patterns: [/public\s+liability|fully\s+insured/i] },
  { id: 'years', name: '从业年限', weight: 15, patterns: [/\d{1,2}\+?\s*years?\s+(?:experience|trading|in\s+business)|established\s+\d{4}|since\s+\d{4}/i] },
  { id: 'warranty', name: '保修', weight: 15, patterns: [/\d{1,2}[-\s]year\s+(?:warranty|guarantee)|workmanship\s+(?:warranty|guarantee)/i] },
  { id: 'certifications', name: '行业证书', weight: 15, patterns: [/certified|accredited|licensed/i] },
  { id: 'awards', name: '荣誉 / 奖项', weight: 10, patterns: [/award[-\s]winning|best\s+of|finalist/i] },
  { id: 'free_quote', name: '免费报价', weight: 10, patterns: [/free\s+(?:quote|estimate|consultation)/i] },
];

export function auditTrustSignalsGeneric({ rawHtml = '', markdown = '' } = {}) {
  const haystack = `${rawHtml}\n${markdown}`;
  const results = [];
  let earned = 0;
  let max = 0;
  for (const sig of SIGNALS) {
    const found = sig.patterns.some((p) => p.test(haystack));
    results.push({
      id: sig.id,
      name: sig.name,
      present: found,
      weight: sig.weight,
      evidence_excerpt: found ? sig.patterns.find((p) => p.test(haystack))?.exec(haystack)?.[0]?.slice(0, 120) : null,
    });
    max += sig.weight;
    if (found) earned += sig.weight;
  }
  return {
    ok: true,
    industry_label: 'generic',
    score: max ? Math.round((earned / max) * 100) : 0,
    signals: results,
    required_missing: [],
    notes: [],
  };
}
