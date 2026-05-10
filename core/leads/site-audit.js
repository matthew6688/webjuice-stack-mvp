export function createSiteAudit({ record = {}, facts = {}, artifacts = {} } = {}) {
  const text = facts.text || '';
  const lower = text.toLowerCase();
  const links = facts.links || [];
  const images = facts.images || [];
  const headings = facts.headings || [];
  const seo = buildSeoAudit({ record, facts, text, links, images, headings });
  const conversion = buildConversionAudit({ record, facts, text, lower, links, images, headings });
  const trust = buildTrustAudit({ record, facts, text, lower, links });
  const findings = prioritizeFindings([...conversion.findings, ...trust.findings, ...seo.findings]);
  const improvements = uniqueStrings(findings.map((finding) => finding.fix)).slice(0, 6);
  const score = scoreFindings(findings);
  const verdict = deriveVerdict({ score, findings });
  const topOpportunity = buildTopOpportunity({ record, findings, conversion, trust, seo, verdict, score });

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    clientSlug: record.clientSlug,
    businessName: record.company,
    websiteUrl: record.websiteUrl,
    verdict,
    score,
    salesDecision: topOpportunity.salesDecision,
    opportunityConfidence: topOpportunity.opportunityConfidence,
    summary: topOpportunity.summary,
    outreachHook: topOpportunity.outreachHook,
    openDesignDirection: topOpportunity.openDesignDirection,
    captured: {
      title: facts.title || '',
      headings,
      linkCount: links.length,
      imageCount: images.length,
      contactPageCandidates: uniqueValues(facts.contactPageCandidates || []),
      socialLinks: normalizeSocialLinks([...(facts.socialLinks || []), ...(facts.sameAs || [])]),
      textLength: text.length,
      phoneVisible: conversion.signals.phoneVisible,
      emailVisible: conversion.signals.emailVisible,
      quoteVisible: conversion.signals.quoteVisible,
      serviceVisible: conversion.signals.serviceVisible,
      primaryCta: conversion.signals.primaryCta,
    },
    audits: {
      conversion,
      trust,
      seo,
    },
    findings,
    issues: findings.map((finding) => `${finding.title}: ${finding.evidence}`),
    improvements,
    priorityActions: findings.slice(0, 5).map((finding) => ({
      title: finding.title,
      impact: finding.impactLevel,
      effort: finding.effort,
      fix: finding.fix,
    })),
    nextStepInput: {
      businessName: record.company,
      industry: record.niche || record.leadFamilyId,
      location: record.city || record.address || '',
      services: record.leadCoreServices || [],
      heroAngle: record.leadHeroAngle || topOpportunity.heroAngle,
      primaryCta: record.leadPrimaryCta || conversion.signals.primaryCta || 'Call now',
      outreachObservation: record.leadSpecificObservation || topOpportunity.outreachHook,
      auditFocus: findings.slice(0, 4).map((finding) => finding.title),
      redesignValue: improvements,
      contactProfile: {
        email: record.email || '',
        phone: record.phone || '',
        contactPageUrl: uniqueValues(facts.contactPageCandidates || [])[0] || '',
        socialLinks: normalizeSocialLinks([...(facts.socialLinks || []), ...(facts.sameAs || [])]),
      },
    },
    artifacts,
  };
}

function buildConversionAudit({ record, text, lower, links, images, headings }) {
  const serializedLinks = JSON.stringify(links);
  const phoneVisible = Boolean(record.phone && normalizePhoneText(text).includes(normalizePhoneText(record.phone)))
    || /tel:/i.test(serializedLinks);
  const emailVisible = Boolean(record.email && lower.includes(String(record.email).toLowerCase()))
    || /mailto:/i.test(serializedLinks);
  const quoteVisible = /quote|call|contact|get in touch|book|estimate|enquire|enquiry|inspection/i.test(text);
  const serviceVisible = (record.leadCoreServices || []).some((service) => lower.includes(String(service).toLowerCase()));
  const primaryCta = inferPrimaryCta({ text, links });
  const aboveFoldText = text.slice(0, 900);
  const findings = [];

  if (!phoneVisible) {
    findings.push(finding({
      category: 'conversion',
      title: 'Phone path is not obvious enough',
      evidence: 'The captured page text/link data does not show a clear phone action.',
      impact: 'Field-service visitors often want the fastest quote path; hiding the phone path can leak high-intent enquiries.',
      fix: 'Make call/quote actions persistent in the hero and mobile header.',
      severity: 'high',
      effort: 'low',
    }));
  }
  if (!quoteVisible) {
    findings.push(finding({
      category: 'conversion',
      title: 'Quote/enquiry intent is weak',
      evidence: 'The captured page does not repeat a strong quote, enquiry, booking, or inspection CTA.',
      impact: 'Visitors can understand the business but still fail to take the next step.',
      fix: 'Use one dominant quote CTA in the hero, service sections, proof sections, and final CTA.',
      severity: 'high',
      effort: 'low',
    }));
  }
  if (!serviceVisible) {
    findings.push(finding({
      category: 'conversion',
      title: 'Core services are not instantly clear',
      evidence: `Expected services were not all visible in captured text: ${(record.leadCoreServices || []).slice(0, 4).join(', ') || 'services unavailable'}.`,
      impact: 'A lead may not recognize that the business solves their specific problem.',
      fix: 'Show 3-5 core services near the top with plain-language outcomes.',
      severity: 'medium',
      effort: 'low',
    }));
  }
  if ((headings || []).length < 3) {
    findings.push(finding({
      category: 'conversion',
      title: 'Page is hard to scan',
      evidence: `Only ${(headings || []).length} readable heading(s) were captured.`,
      impact: 'Skimming visitors have fewer anchors for services, proof, service area, and CTA.',
      fix: 'Add clear section headings for services, proof, service area, and final CTA.',
      severity: 'medium',
      effort: 'low',
    }));
  }
  if ((images || []).filter((image) => image.alt).length < 2) {
    findings.push(finding({
      category: 'conversion',
      title: 'Visual proof is under-explained',
      evidence: 'Few captured images include descriptive alt text or proof context.',
      impact: 'Before/after, team, and job-site proof may not transfer trust quickly.',
      fix: 'Use before/after or job-site proof with descriptive captions and useful alt text.',
      severity: 'medium',
      effort: 'low',
    }));
  }
  if (!/review|testimonial|warranty|licensed|insured|guarantee|years|family|local/i.test(aboveFoldText)) {
    findings.push(finding({
      category: 'conversion',
      title: 'Trust signal is not strong in the first screen',
      evidence: 'The first captured text block does not clearly surface reviews, warranty, credentials, years, or local proof.',
      impact: 'For local services, trust often matters before design polish.',
      fix: 'Add a compact trust strip near the hero: reviews, warranty/licence claims when verified, service area, and response promise.',
      severity: 'medium',
      effort: 'medium',
    }));
  }

  return {
    score: Math.max(0, 100 - findings.reduce((sum, item) => sum + severityPenalty(item.severity), 0)),
    signals: { phoneVisible, emailVisible, quoteVisible, serviceVisible, primaryCta },
    findings,
  };
}

function buildTrustAudit({ record, facts, lower, links }) {
  const findings = [];
  const socialLinks = normalizeSocialLinks([...(facts.socialLinks || []), ...(facts.sameAs || [])]);
  const hasContactPage = uniqueValues(facts.contactPageCandidates || []).length > 0;
  const hasAddressOrArea = Boolean(record.address || record.city || /service area|brisbane|gold coast|near me|local/i.test(lower));
  const hasSocial = socialLinks.length > 0;
  const hasProofLanguage = /review|testimonial|project|gallery|before|after|case stud|warranty|licensed|insured|guarantee/i.test(lower);
  const hasPrivacyOrTerms = links.some((link) => /privacy|terms/i.test(`${link.text} ${link.href}`));

  if (!hasContactPage) {
    findings.push(finding({
      category: 'trust',
      title: 'Contact page is not easy to verify',
      evidence: 'No contact/enquiry/quote page candidate was captured from visible links.',
      impact: 'A redesign needs a clear, trackable conversion endpoint.',
      fix: 'Preserve or create a clear contact/quote page and link it from header, footer, and CTA blocks.',
      severity: 'high',
      effort: 'medium',
    }));
  }
  if (!hasAddressOrArea) {
    findings.push(finding({
      category: 'trust',
      title: 'Local service area is weak',
      evidence: 'The captured facts do not clearly show address or service area.',
      impact: 'Local searchers need to know whether this business serves them.',
      fix: 'Add a visible service-area section and local proof points.',
      severity: 'medium',
      effort: 'low',
    }));
  }
  if (!hasSocial) {
    findings.push(finding({
      category: 'trust',
      title: 'Social proof channels are missing',
      evidence: 'No visible Facebook, Instagram, LinkedIn, TikTok, YouTube, X, or WhatsApp link was captured.',
      impact: 'Visual or review-heavy businesses lose an easy trust path.',
      fix: 'Add verified social links or replace with stronger on-page testimonials/gallery proof.',
      severity: 'low',
      effort: 'low',
    }));
  }
  if (!hasProofLanguage) {
    findings.push(finding({
      category: 'trust',
      title: 'Proof is not doing enough work',
      evidence: 'The captured text does not clearly surface reviews, project proof, warranty, licences, or gallery proof.',
      impact: 'The site may feel informational rather than convincing.',
      fix: 'Add a proof section with real reviews, project examples, and verified guarantees/credentials.',
      severity: 'medium',
      effort: 'medium',
    }));
  }
  if (!hasPrivacyOrTerms) {
    findings.push(finding({
      category: 'trust',
      title: 'Basic trust/legal links are thin',
      evidence: 'Privacy or terms links were not captured from visible page links.',
      impact: 'This is a minor trust and SEO hygiene gap, especially when forms collect customer data.',
      fix: 'Add privacy and terms links in the footer when forms or tracking are used.',
      severity: 'low',
      effort: 'low',
    }));
  }

  return {
    score: Math.max(0, 100 - findings.reduce((sum, item) => sum + severityPenalty(item.severity), 0)),
    signals: { hasContactPage, hasAddressOrArea, hasSocial, hasProofLanguage, hasPrivacyOrTerms },
    findings,
  };
}

function buildSeoAudit({ record, facts, text, links, images, headings }) {
  const seo = facts.seo || {};
  const title = facts.title || seo.title || '';
  const metaDescription = seo.metaDescription || '';
  const h1s = seo.h1s || headings.filter((heading, index) => index === 0);
  const canonical = seo.canonical || '';
  const jsonLdTypes = seo.jsonLdTypes || [];
  const og = seo.og || {};
  const twitter = seo.twitter || {};
  const keyword = inferKeyword(record);
  const findings = [];
  const wordCount = countWords(text);
  const internalLinks = links.filter((link) => isInternalLink(link.href, record.websiteUrl));
  const missingAlt = images.filter((image) => image.src && image.alt === undefined);
  const emptyAlt = images.filter((image) => image.src && image.alt === '');

  if (!title) {
    findings.push(seoFinding('Title tag is missing', 'No document title was captured.', 'Search results need a clear title to explain the page.', 'Add a concise title with business name, core service, and location.', 'high'));
  } else if (!semanticIncludes(title, keyword)) {
    findings.push(seoFinding('Title does not target the main local intent', `Captured title: "${title}". Inferred keyword: "${keyword}".`, 'The page may rank or click worse for the service/location query we care about.', `Rewrite title around "${keyword}" while keeping the business name.`, 'medium'));
  }
  if (!metaDescription) {
    findings.push(seoFinding('Meta description is missing', 'No meta description was captured.', 'Search snippets may be generic or less compelling.', 'Write a specific 1-2 sentence snippet with service, location, and next action.', 'medium'));
  } else if (!semanticIncludes(metaDescription, keyword)) {
    findings.push(seoFinding('Meta description is too generic for the lead angle', `Captured meta description does not clearly include "${keyword}" or a close variant.`, 'The search snippet may not match high-intent local searches.', 'Mention service, location, and a concrete result or quote action.', 'low'));
  }
  if (h1s.length !== 1) {
    findings.push(seoFinding('H1 structure needs cleanup', `${h1s.length} H1 tag(s) captured.`, 'A single clear H1 helps both search and page comprehension.', 'Use one H1 focused on the primary service/location promise.', 'medium'));
  } else if (!semanticIncludes(h1s[0], keyword)) {
    findings.push(seoFinding('H1 misses the main local intent', `Captured H1: "${h1s[0]}". Inferred keyword: "${keyword}".`, 'Visitors and search engines may not see the core service immediately.', `Make the H1 naturally cover "${keyword}" or a close variant.`, 'medium'));
  }
  if (!canonical) {
    findings.push(seoFinding('Canonical tag is missing', 'No canonical URL was captured.', 'Duplicate or redirected URLs can dilute signals.', 'Add a canonical URL matching the final preferred page URL.', 'low'));
  }
  if (wordCount < 250) {
    findings.push(seoFinding('Page content is thin', `${wordCount} words captured.`, 'Thin pages have fewer chances to explain services, locations, and trust.', 'Add concise service, proof, area, and FAQ copy without stuffing.', 'medium'));
  }
  if (internalLinks.length < 3) {
    findings.push(seoFinding('Internal linking is weak', `${internalLinks.length} internal link(s) captured.`, 'Important pages may be harder to discover and preserve during redesign.', 'Link to services, contact/quote, about/proof, and relevant location pages.', 'low'));
  }
  if (missingAlt.length || emptyAlt.length > Math.max(2, images.length / 2)) {
    findings.push(seoFinding('Image alt text is weak', `${missingAlt.length} image(s) missing alt attribute and ${emptyAlt.length} image(s) have empty alt.`, 'Images do not help accessibility, local proof, or image-search context.', 'Add descriptive alt text for content images; keep decorative images empty intentionally.', 'medium'));
  }
  if (!jsonLdTypes.length) {
    findings.push(seoFinding('Structured data is missing', 'No JSON-LD schema types were captured.', 'LocalBusiness schema can make core business facts clearer to search engines.', 'Add LocalBusiness/Organization schema with verified name, phone, area, URL, and social links.', 'medium'));
  }
  if (!og.title || !og.description || !og.image) {
    findings.push(seoFinding('Social sharing tags are incomplete', `OG title: ${Boolean(og.title)}, description: ${Boolean(og.description)}, image: ${Boolean(og.image)}.`, 'Shared previews may look weak when sent in email, SMS, or social DMs.', 'Add og:title, og:description, and og:image that match the redesigned positioning.', 'low'));
  }
  if (!twitter.card && !og.image) {
    findings.push(seoFinding('Twitter/X card preview is missing', 'No twitter:card and no OG image fallback were captured.', 'Social outreach previews may render without a strong visual.', 'Add summary_large_image or rely on a valid OG image fallback.', 'low'));
  }

  return {
    score: Math.max(0, 100 - findings.reduce((sum, item) => sum + severityPenalty(item.severity), 0)),
    keyword,
    checks: {
      title,
      metaDescription,
      h1s,
      canonical,
      wordCount,
      internalLinkCount: internalLinks.length,
      imageCount: images.length,
      missingAltCount: missingAlt.length,
      emptyAltCount: emptyAlt.length,
      jsonLdTypes,
      og,
      twitter,
      robotsMeta: seo.robotsMeta || '',
      htmlLang: seo.htmlLang || '',
    },
    findings,
  };
}

function finding({ category, title, evidence, impact, fix, severity = 'medium', effort = 'medium' }) {
  return {
    category,
    title,
    evidence,
    impact,
    fix,
    severity,
    impactLevel: severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
    effort,
  };
}

function seoFinding(title, evidence, impact, fix, severity) {
  return finding({ category: 'seo', title, evidence, impact, fix, severity, effort: severity === 'high' ? 'medium' : 'low' });
}

function prioritizeFindings(findings) {
  const order = { high: 0, medium: 1, low: 2 };
  return [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
}

function scoreFindings(findings) {
  return Math.max(35, 96 - findings.reduce((sum, item) => sum + severityPenalty(item.severity), 0));
}

function severityPenalty(severity) {
  return { high: 18, medium: 10, low: 5 }[severity] || 8;
}

function deriveVerdict({ score, findings }) {
  const high = findings.filter((finding) => finding.severity === 'high').length;
  if (high >= 2 || score < 60) return 'clear_redesign_opportunity';
  if (score <= 80) return 'moderate_redesign_opportunity';
  return 'weak_redesign_opportunity';
}

function buildTopOpportunity({ record, findings, conversion, trust, seo, verdict, score }) {
  const meaningfulFindings = findings.filter((finding) => finding.severity !== 'low');
  const top = meaningfulFindings[0];
  const industry = record.niche || record.leadFamilyId || 'local business';
  const location = record.city || record.address || 'their local area';
  const business = record.company || record.clientSlug || 'this business';
  const salesDecision = deriveSalesDecision({ verdict, score, meaningfulFindings });
  const opportunityConfidence = salesDecision === 'build_mockup'
    ? 'high'
    : salesDecision === 'human_review'
      ? 'medium'
      : 'low';
  const summary = top
    ? `${business} has an existing website, and the strongest useful gap is: ${top.title.toLowerCase()}.`
    : `${business} already has a reasonably solid website. Only low-impact gaps were found, so this should not auto-advance to a mockup.`;
  const outreachHook = top
    ? `I noticed your site has a fixable ${humanCategory(top.category)} gap: ${top.evidence}`
    : 'No strong outreach hook found from the current homepage audit. Treat as skip or human review unless another source shows a sharper opportunity.';
  const heroAngle = `${business} should feel like the obvious ${industry} choice in ${location}.`;
  const designFixes = [conversion, trust, seo]
    .map((section) => section.findings.find((finding) => finding.severity !== 'low')?.fix)
    .filter(Boolean);
  const openDesignDirection = top
    ? [heroAngle, ...designFixes].join(' ')
    : 'Do not create a redesign mockup from this audit alone. If manually approved, focus on preserving the existing strengths while making only small trust/SEO hygiene improvements.';
  return { summary, outreachHook, heroAngle, openDesignDirection, salesDecision, opportunityConfidence };
}

function deriveSalesDecision({ verdict, score, meaningfulFindings }) {
  if (score < 60) return 'build_mockup';
  if (score <= 80) return 'human_review';
  if (score > 80) return 'skip_or_monitor';
  if (verdict === 'clear_redesign_opportunity' && meaningfulFindings.length >= 2) return 'build_mockup';
  return 'human_review';
}

function humanCategory(category) {
  return { seo: 'SEO', trust: 'trust', conversion: 'conversion' }[category] || category;
}

function inferPrimaryCta({ text, links }) {
  const candidates = [
    ...links.map((link) => link.text),
    ...String(text || '').split('\n').slice(0, 30),
  ].map((item) => String(item || '').trim()).filter(Boolean);
  return candidates.find((item) => /quote|call|contact|get in touch|book|estimate|enquire|inspection/i.test(item)) || '';
}

function inferKeyword(record) {
  const niche = cleanKeywordPart(record.niche || record.leadFamilyId || '');
  const service = cleanKeywordPart((record.leadCoreServices || []).find(Boolean) || '');
  const location = cleanKeywordPart(record.city || '');
  const serviceTerm = service || niche;
  const base = serviceTerm && niche && serviceTerm.toLowerCase().includes(niche.toLowerCase())
    ? serviceTerm
    : [niche, serviceTerm].filter(Boolean).join(' ');
  return uniqueStrings([base, location]).join(' ') || record.company || 'local business';
}

function cleanKeywordPart(value) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function semanticIncludes(value, keyword) {
  const haystack = normalizeTerm(value);
  const needle = normalizeTerm(keyword);
  if (!needle) return true;
  if (haystack.includes(needle)) return true;
  const terms = needle.split(' ').filter((term) => term.length > 2);
  if (!terms.length) return true;
  return terms.filter((term) => haystack.includes(term)).length >= Math.ceil(terms.length * 0.6);
}

function normalizeTerm(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhoneText(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function isInternalLink(href, baseUrl) {
  try {
    if (!href) return false;
    const base = new URL(baseUrl);
    const url = new URL(href, base);
    return url.hostname === base.hostname;
  } catch {
    return false;
  }
}

export function renderSiteAuditMarkdown(audit) {
  return [
    `# Current Site Audit: ${audit.businessName}`,
    '',
    `- Website: ${audit.websiteUrl}`,
    `- Verdict: ${audit.verdict}`,
    `- Score: ${audit.score}`,
    `- Sales decision: ${audit.salesDecision}`,
    `- Opportunity confidence: ${audit.opportunityConfidence}`,
    `- Generated: ${audit.generatedAt}`,
    `- Summary: ${audit.summary}`,
    '',
    '## Captured Evidence',
    '',
    `- Desktop screenshot: ${audit.artifacts.desktopPath}`,
    `- Mobile screenshot: ${audit.artifacts.mobilePath}`,
    `- HTML snapshot: ${audit.artifacts.htmlPath}`,
    `- Text snapshot: ${audit.artifacts.textPath}`,
    '',
    '## Findings',
    '',
    ...audit.findings.map((item) => [
      `### ${item.title}`,
      '',
      `- Category: ${item.category}`,
      `- Severity: ${item.severity}`,
      `- Evidence: ${item.evidence}`,
      `- Impact: ${item.impact}`,
      `- Fix: ${item.fix}`,
      '',
    ].join('\n')),
    '## SEO Snapshot',
    '',
    `- Inferred keyword: ${audit.audits.seo.keyword}`,
    `- Title: ${audit.audits.seo.checks.title || 'missing'}`,
    `- Meta description: ${audit.audits.seo.checks.metaDescription || 'missing'}`,
    `- H1 count: ${audit.audits.seo.checks.h1s.length}`,
    `- Canonical: ${audit.audits.seo.checks.canonical || 'missing'}`,
    `- Word count: ${audit.audits.seo.checks.wordCount}`,
    `- Internal links: ${audit.audits.seo.checks.internalLinkCount}`,
    `- JSON-LD types: ${audit.audits.seo.checks.jsonLdTypes.join(', ') || 'none'}`,
    '',
    '## Improvements For Mockup',
    '',
    ...audit.improvements.map((item) => `- ${item}`),
    '',
    '## Outreach Hook',
    '',
    audit.outreachHook || 'N/A',
    '',
    '## Open Design Direction',
    '',
    audit.openDesignDirection || 'N/A',
    '',
    '## Next Step Input',
    '',
    `- Industry: ${audit.nextStepInput.industry || 'N/A'}`,
    `- Location: ${audit.nextStepInput.location || 'N/A'}`,
    `- Services: ${(audit.nextStepInput.services || []).join(', ') || 'N/A'}`,
    `- Hero angle: ${audit.nextStepInput.heroAngle || 'N/A'}`,
    `- Primary CTA: ${audit.nextStepInput.primaryCta || 'N/A'}`,
    `- Observation: ${audit.nextStepInput.outreachObservation || 'N/A'}`,
    '',
  ].join('\n');
}

export function sanitizeHtmlSnapshot(html) {
  return String(html || '')
    .replace(/pk\.eyJ[A-Za-z0-9._-]+/g, '[REDACTED_MAPBOX_PUBLIC_TOKEN]')
    .replace(/(common\.here\.appId["']?\]?\s*=\s*)['"][^'"]+['"]/g, '$1"[REDACTED_HERE_APP_ID]"')
    .replace(/(common\.here\.appCode["']?\]?\s*=\s*)['"][^'"]+['"]/g, '$1"[REDACTED_HERE_APP_CODE]"');
}

export function normalizeSocialLinks(values) {
  return values
    .map((item) => {
      const url = typeof item === 'string' ? item : item?.url || '';
      const label = typeof item === 'string' ? platformLabel(item) : item?.label || platformLabel(url);
      return { label, url };
    })
    .filter((item) => item.url && isSocialUrl(item.url))
    .filter((item, index, array) => array.findIndex((candidate) => candidate.url === item.url) === index);
}

function isSocialUrl(value) {
  try {
    const hostname = new URL(String(value || '')).hostname.replace(/^www\./, '').toLowerCase();
    return [
      'instagram.com',
      'facebook.com',
      'linkedin.com',
      'tiktok.com',
      'youtube.com',
      'x.com',
      'twitter.com',
      'wa.me',
      'whatsapp.com',
    ].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function platformLabel(value) {
  const url = String(value || '').toLowerCase();
  if (url.includes('instagram')) return 'Instagram';
  if (url.includes('facebook')) return 'Facebook';
  if (url.includes('linkedin')) return 'LinkedIn';
  if (url.includes('tiktok')) return 'TikTok';
  if (url.includes('youtube')) return 'YouTube';
  if (url.includes('twitter') || url.includes('x.com')) return 'X';
  if (url.includes('whatsapp') || url.includes('wa.me')) return 'WhatsApp';
  return 'Social';
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function uniqueValues(values) {
  return uniqueStrings(values);
}
