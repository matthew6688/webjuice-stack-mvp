/**
 * Trust signals for Australian roofing contractors.
 *
 * QLD-specific signals based on consumer-protection regulations:
 *   - QBCC license (required for any roofing work in QLD; consumers verify)
 *   - ABN (every Australian business must have)
 *   - Public liability insurance (most homeowners ask about)
 *   - Years in business (heuristic — longer = trust)
 *   - Workers comp / WHS certification
 *   - Industry membership (Master Builders, HIA)
 *   - Warranty / guarantee
 *
 * Signal weights reflect what an actual roofing customer cares about
 * before letting strangers on their roof.
 */

const SIGNALS = [
  {
    id: 'qbcc_license',
    name: 'QBCC 执照号',
    weight: 25,
    required_by_law: true,
    patterns: [
      /qbcc\s*(?:license|lic|licen[cs]e)?[\s:#]*\d{4,10}/i,
      /\bqbcc[\s#:-]+\d{4,10}/i,
    ],
  },
  {
    id: 'abn',
    name: 'ABN',
    weight: 15,
    required_by_law: true,
    patterns: [
      /\babn[\s:#]*\d{2}[\s.]*\d{3}[\s.]*\d{3}[\s.]*\d{3}/i,
      /\babn[\s:#]+\d{11}/i,
    ],
  },
  {
    id: 'public_liability',
    name: '公共责任险',
    weight: 15,
    required_by_law: false,
    patterns: [
      /\$[\d,.]+[mM]?\s+public\s+liability/i,
      /public\s+liability\s+(?:insurance|cover|insured)/i,
      /\$10\s*million\s+insurance/i,
      /\$20\s*million\s+insurance/i,
      /fully\s+insured/i,
    ],
  },
  {
    id: 'years_in_business',
    name: '从业年限',
    weight: 10,
    required_by_law: false,
    patterns: [
      /\b(\d{1,2}\+?)\s*years?\s*(?:of\s+)?(?:experience|in\s+(?:the\s+)?business|trading|servicing|family\s+owned|family-?run)/i,
      /\bestablished\s+(?:in\s+)?(\d{4})/i,
      /\bover\s+(\d{1,2})\s*years/i,
      /\bsince\s+(\d{4})/i,
    ],
  },
  {
    id: 'whs_workers_comp',
    name: '工伤 / WHS 合规',
    weight: 10,
    required_by_law: true,
    patterns: [
      /workers?[\s'-]?compensation/i,
      /workcover\s+(?:certified|insured|registered)/i,
      /WHS\s+(?:compliant|certified)/i,
      /OH&S\s+(?:compliant|certified)/i,
    ],
  },
  {
    id: 'industry_membership',
    name: '行业协会会员',
    weight: 10,
    required_by_law: false,
    patterns: [
      /master\s+builders/i,
      /\bhia\b/i,
      /housing\s+industry\s+association/i,
      /\bmaster\s+plumbers/i,
      /roofing\s+(?:industry\s+)?association/i,
    ],
  },
  {
    id: 'warranty_guarantee',
    name: '保修 / 工艺保证',
    weight: 10,
    required_by_law: false,
    patterns: [
      /\b\d{1,2}[-\s]year\s+(?:warranty|guarantee)/i,
      /lifetime\s+warranty/i,
      /workmanship\s+(?:warranty|guarantee)/i,
      /written\s+(?:warranty|guarantee)/i,
    ],
  },
  {
    id: 'free_quote',
    name: '免费报价 / 上门估价',
    weight: 5,
    required_by_law: false,
    patterns: [
      /free\s+(?:quote|estimate|inspection|measure)/i,
      /no\s+obligation\s+quote/i,
    ],
  },
];

function findFirstMatch(text, patterns) {
  if (!text) return null;
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return m[0].slice(0, 120);
  }
  return null;
}

export function auditTrustSignalsRoofingAU({ rawHtml = '', markdown = '', city = '' } = {}) {
  const haystack = `${rawHtml}\n${markdown}`;
  const results = [];
  let earned = 0;
  let max = 0;
  const missing_required = [];

  for (const sig of SIGNALS) {
    const evidence = findFirstMatch(haystack, sig.patterns);
    const present = Boolean(evidence);
    results.push({
      id: sig.id,
      name: sig.name,
      present,
      weight: sig.weight,
      required_by_law: sig.required_by_law,
      evidence_excerpt: evidence,
    });
    max += sig.weight;
    if (present) earned += sig.weight;
    else if (sig.required_by_law) missing_required.push(sig.name);
  }

  return {
    ok: true,
    industry_label: 'AU 屋顶服务',
    score: max ? Math.round((earned / max) * 100) : 0,
    signals: results,
    required_missing: missing_required,
    notes: missing_required.length
      ? [`客户网站缺少 ${missing_required.length} 个法律 / 行业要求的信任凭证：${missing_required.join('、')}。QLD 屋顶服务由 QBCC 监管，客户在花钱前会查这些；缺失等于直接给同行让单。`]
      : [],
  };
}
