export const DOCUMENT_MODEL_SCHEMA_VERSION = 1;

export function buildDocumentModelComparisonInput(overrides = {}) {
  return {
    leadSlug: 'roofing-restoration-greg-sign',
    businessName: 'Roofing & Restoration',
    niche: 'roofing',
    source: 'operator_image_and_text',
    verifiedFacts: {
      businessName: 'Roofing & Restoration',
      contactName: 'Greg',
      phones: ['0424 371 622'],
      emails: [],
      address: '',
      websiteUrl: '',
      serviceArea: '',
      services: [
        'roof restorations',
        'capping',
        'respray',
        'repairs',
        'gutters',
        'driveway',
        'patio',
        'external living',
        'retaining wall',
        'pressure cleaning',
      ],
      claimsFromSource: ['40 years experience', 'free in person inspection and quote'],
    },
    researchNotes: [
      'Input came from a sign/photo plus operator text, not a verified website.',
      'No website, email, address, licence, Google rating, or real review evidence is available in this fixture.',
      'The page can use generated demo copy for completeness, but it must not invent contact details or verified proof.',
    ],
    targetArtifacts: [
      'discoveryReport',
      'gapScore',
      'websiteProductionSpec',
      'copyBrief',
      'riskNotes',
    ],
    ...overrides,
  };
}

export function buildDocumentGenerationPrompt(input = buildDocumentModelComparisonInput(), options = {}) {
  const variant = options.variant || 'strict-v2';
  const base = [
    'You are preparing internal documents for a local business website mockup pipeline.',
    'Return JSON only. Do not include markdown fences, hidden reasoning, XML tags, or prose outside JSON.',
    '',
    'Critical fact rules:',
    '- Keep verified business name, phone, email, address, and website URL exact.',
    '- Do not invent an email, address, website URL, licence, award, Google rating, real review, price, or guarantee.',
    '- You may generate demo-safe service copy, FAQ, process copy, and page structure for a preview website.',
    '- Generated demo content must be tracked internally, but the customer-facing page must not say placeholder, AI-generated, inferred, audit, or internal.',
    ...variantInstructions(variant),
    '',
    'Output JSON schema:',
    JSON.stringify({
      discoveryReport: {
        businessIdentity: '',
        contactPaths: [],
        services: [],
        currentPresence: '',
        opportunityDiagnosis: '',
        recommendedAngle: '',
        evidenceUsed: [],
        missingEvidence: [],
      },
      gapScore: {
        total: 0,
        conversion: 0,
        localSeo: 0,
        designTrust: 0,
        content: 0,
        rationale: '',
      },
      websiteProductionSpec: {
        pageMode: 'one_page_preview',
        templateDirection: '',
        blockPlan: [],
        assetPlan: [],
        contactPlan: {},
        seoPlan: {},
        factLock: {
          mustKeep: [],
          mustNotClaim: [],
        },
      },
      copyBrief: {
        heroHeadline: '',
        heroSubcopy: '',
        primaryCta: '',
        serviceCopy: [],
        faq: [],
        outreachHook: '',
      },
      riskNotes: [],
    }, null, 2),
    '',
    'Lead input:',
    JSON.stringify(input, null, 2),
  ];
  return base.join('\n');
}

export function evaluateDocumentOutput(rawOutput, input = buildDocumentModelComparisonInput()) {
  const parsed = parseModelJson(rawOutput);
  const findings = [];
  let score = 0;

  if (!parsed.ok) {
    return {
      schemaVersion: DOCUMENT_MODEL_SCHEMA_VERSION,
      ok: false,
      score: 0,
      grade: 'F',
      parse: parsed,
      findings: [
        finding('hard_fail', 'invalid_json', -100, 'Output was not parseable JSON.'),
      ],
      metrics: {},
    };
  }

  const doc = parsed.value;
  const text = JSON.stringify(doc);
  const lower = text.toLowerCase();
  const customerCopyLower = JSON.stringify({
    copyBrief: doc.copyBrief || {},
    blockPlan: doc.websiteProductionSpec?.blockPlan || [],
  }).toLowerCase();
  const rawLower = String(rawOutput || '').toLowerCase();

  score += award(Boolean(doc.discoveryReport), 12, findings, 'missing_discovery_report', 'Missing discoveryReport.');
  score += award(Boolean(doc.gapScore), 10, findings, 'missing_gap_score', 'Missing gapScore.');
  score += award(Boolean(doc.websiteProductionSpec), 18, findings, 'missing_production_spec', 'Missing websiteProductionSpec.');
  score += award(Boolean(doc.copyBrief), 16, findings, 'missing_copy_brief', 'Missing copyBrief.');
  score += award(Array.isArray(doc.riskNotes), 6, findings, 'missing_risk_notes', 'Missing riskNotes array.');

  score += checkVerifiedPhone({ text, input, findings });
  score += checkNoInventedContact({ text, input, findings });
  score += checkEvidenceAndMissingEvidence({ doc, findings });
  score += checkGapScoreRanges({ doc, findings });
  score += checkBlockPlan({ doc, findings });
  score += checkAssetPlan({ doc, findings });
  score += checkConversionCopy({ doc, findings });
  score += checkForbiddenCustomerLanguage({ lower: customerCopyLower, findings });
  score += checkReasoningLeak({ lower: `${rawLower}\n${lower}`, findings });
  score += checkFactLock({ doc, findings });

  const hardFails = findings.filter((item) => item.severity === 'hard_fail');
  const normalizedScore = Math.round((score / 132) * 100);
  const finalScore = hardFails.length ? Math.min(normalizedScore, 49) : Math.max(0, Math.min(100, normalizedScore));
  return {
    schemaVersion: DOCUMENT_MODEL_SCHEMA_VERSION,
    ok: finalScore >= 80 && hardFails.length === 0,
    score: finalScore,
    grade: grade(finalScore),
    parse: parsed,
    findings,
    metrics: {
      outputCharacters: String(rawOutput || '').length,
      blockCount: Array.isArray(doc.websiteProductionSpec?.blockPlan) ? doc.websiteProductionSpec.blockPlan.length : 0,
      assetCount: Array.isArray(doc.websiteProductionSpec?.assetPlan) ? doc.websiteProductionSpec.assetPlan.length : 0,
      serviceCopyCount: Array.isArray(doc.copyBrief?.serviceCopy) ? doc.copyBrief.serviceCopy.length : 0,
      faqCount: Array.isArray(doc.copyBrief?.faq) ? doc.copyBrief.faq.length : 0,
    },
  };
}

export function parseModelJson(rawOutput) {
  const raw = String(rawOutput || '').trim();
  if (!raw) return { ok: false, error: 'empty_output' };

  const candidates = [
    raw,
    raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''),
    extractFirstJsonObject(raw),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate), rawJson: candidate };
    } catch {
      // Try next candidate.
    }
  }
  return { ok: false, error: 'json_parse_failed', excerpt: raw.slice(0, 500) };
}

function extractFirstJsonObject(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return '';
  return raw.slice(start, end + 1);
}

function award(condition, points, findings, code, message) {
  if (condition) return points;
  findings.push(finding('major', code, -points, message));
  return 0;
}

function checkVerifiedPhone({ text, input, findings }) {
  const phone = input.verifiedFacts?.phones?.[0] || '';
  if (!phone) return 5;
  if (text.includes(phone)) return 5;
  findings.push(finding('hard_fail', 'verified_phone_missing_or_changed', -20, `Verified phone ${phone} is missing or changed.`));
  return 0;
}

function checkNoInventedContact({ text, input, findings }) {
  let points = 10;
  const hasNoEmail = !(input.verifiedFacts?.emails || []).length;
  const hasNoAddress = !input.verifiedFacts?.address;
  const hasNoWebsite = !input.verifiedFacts?.websiteUrl;
  if (hasNoEmail && /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
    findings.push(finding('hard_fail', 'invented_email', -20, 'Output invented an email address.'));
    points -= 8;
  }
  if (hasNoWebsite && /https?:\/\/|www\./i.test(text)) {
    findings.push(finding('hard_fail', 'invented_website_url', -20, 'Output invented a website URL.'));
    points -= 8;
  }
  if (hasNoAddress && /\b\d{1,5}\s+[A-Za-z][A-Za-z\s.'-]{2,40}\s+(street|st\.|road|rd\.|avenue|ave\.|lane|ln\.|drive|dr\.|court|ct\.)\b/i.test(text)) {
    findings.push(finding('major', 'possibly_invented_address_or_area', -8, 'Output appears to invent an address or service area.'));
    points -= 5;
  }
  return Math.max(0, points);
}

function checkEvidenceAndMissingEvidence({ doc, findings }) {
  const evidence = doc.discoveryReport?.evidenceUsed || [];
  const missing = doc.discoveryReport?.missingEvidence || [];
  let points = 8;
  if (!Array.isArray(evidence) || evidence.length < 2) {
    findings.push(finding('minor', 'thin_evidence_used', -4, 'Evidence used is too thin.'));
    points -= 4;
  }
  if (!Array.isArray(missing) || missing.length < 2) {
    findings.push(finding('minor', 'thin_missing_evidence', -4, 'Missing evidence is not clearly listed.'));
    points -= 4;
  }
  return Math.max(0, points);
}

function checkGapScoreRanges({ doc, findings }) {
  const gap = doc.gapScore || {};
  const ranges = {
    total: 100,
    conversion: 25,
    localSeo: 25,
    designTrust: 25,
    content: 25,
  };
  const outOfRange = Object.entries(ranges).filter(([key, max]) => Number(gap[key] || 0) > max);
  if (!outOfRange.length) return 6;
  findings.push(finding('major', 'gap_score_out_of_range', -6, `Gap score dimensions exceed expected ranges: ${outOfRange.map(([key]) => key).join(', ')}.`));
  return 0;
}

function checkBlockPlan({ doc, findings }) {
  const blocks = doc.websiteProductionSpec?.blockPlan || [];
  if (!Array.isArray(blocks) || blocks.length < 5) {
    findings.push(finding('major', 'weak_block_plan', -10, 'Block plan should include at least hero, services, proof/trust, process/FAQ, and contact.'));
    return 0;
  }
  const joined = JSON.stringify(blocks).toLowerCase();
  const required = ['hero', 'service', 'contact'];
  const missing = required.filter((item) => !joined.includes(item));
  if (missing.length) {
    findings.push(finding('major', 'missing_core_blocks', -8, `Block plan misses: ${missing.join(', ')}.`));
    return 4;
  }
  return 10;
}

function checkAssetPlan({ doc, findings }) {
  const assets = doc.websiteProductionSpec?.assetPlan || [];
  if (!Array.isArray(assets) || assets.length < 3) {
    findings.push(finding('minor', 'thin_asset_plan', -6, 'Asset plan should specify hero, service/detail, and proof/contact imagery.'));
    return 0;
  }
  return 6;
}

function checkConversionCopy({ doc, findings }) {
  let points = 9;
  const copy = doc.copyBrief || {};
  const combined = JSON.stringify(copy).toLowerCase();
  if (!copy.heroHeadline || String(copy.heroHeadline).length < 16) {
    findings.push(finding('major', 'weak_hero_headline', -5, 'Hero headline is missing or too weak.'));
    points -= 5;
  }
  if (!combined.includes('0424 371 622') && !combined.includes('call')) {
    findings.push(finding('major', 'weak_contact_cta', -4, 'Copy does not make the phone/contact CTA clear.'));
    points -= 4;
  }
  return Math.max(0, points);
}

function checkForbiddenCustomerLanguage({ lower, findings }) {
  const forbidden = ['placeholder', 'ai-generated', 'inferred', 'audit', 'lead ops'];
  const hits = forbidden.filter((word) => lower.includes(word));
  if (!hits.length) return 6;
  findings.push(finding('major', 'customer_facing_internal_language', -8, `Output includes internal/customer-facing unsafe words: ${hits.join(', ')}.`));
  return 0;
}

function checkReasoningLeak({ lower, findings }) {
  const leakPatterns = ['<think>', '</think>', 'we need answer', 'let me think', 'reasoning:', 'analysis:'];
  const hits = leakPatterns.filter((word) => lower.includes(word));
  if (!hits.length) return 5;
  findings.push(finding('hard_fail', 'reasoning_leak', -20, `Output leaked reasoning markers: ${hits.join(', ')}.`));
  return 0;
}

function checkFactLock({ doc, findings }) {
  const factLock = doc.websiteProductionSpec?.factLock || {};
  const mustKeep = JSON.stringify(factLock.mustKeep || []);
  const mustNotClaim = JSON.stringify(factLock.mustNotClaim || []);
  if (mustKeep.includes('0424 371 622') && /email|address|licen[cs]e|review|award|rating/i.test(mustNotClaim)) return 5;
  findings.push(finding('major', 'weak_fact_lock', -5, 'Fact lock does not protect contact details and forbidden claims clearly.'));
  return 0;
}

function finding(severity, code, points, message) {
  return { severity, code, points, message };
}

function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function variantInstructions(variant) {
  if (variant === 'baseline') return [];
  return [
    '',
    `Prompt variant: ${variant}`,
    'Strict completion rules:',
    '- If email is not verified, output email as an empty string or null. Never use demo@example.com or any invented email.',
    '- If address is not verified, output address as an empty string or null. Never use Demo Address or an invented street address.',
    '- If website URL is not verified, output websiteUrl as an empty string or null.',
    '- Do not use the words placeholder, AI-generated, inferred, audit, internal, or lead ops in copyBrief or customer-visible block copy.',
    '- Do not include testimonial/review modules unless real review evidence exists. Use process clarity, service scope, and inspection offer as trust instead.',
    '- websiteProductionSpec.blockPlan must contain at least these six block ids: hero, services, trust, process, faq, contact.',
    '- copyBrief.primaryCta must include the verified phone number or the word Call.',
    '- websiteProductionSpec.factLock.mustKeep must include the exact verified phone number.',
    '- websiteProductionSpec.factLock.mustNotClaim must include email, address, website URL, real reviews, licence, award, rating, price, and guarantee.',
  ];
}
