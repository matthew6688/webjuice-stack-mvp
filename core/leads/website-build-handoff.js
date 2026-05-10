import { BUILD_MODES } from './intake.js';
import { inferNicheFamily, familyCoreSections } from '../niches/families.js';

export function createWebsiteBuildHandoff(input = {}) {
  const research = input.research || {};
  const intake = input.intake || {};
  const redesignCheck = input.redesignCheck || {};
  const outreachBrief = input.outreachBrief || {};
  const currentSiteAudit = input.currentSiteAudit || {};
  const facts = research.facts || {};
  const verified = facts.verified || {};
  const inferred = facts.inferred || {};
  const placeholders = facts.placeholderCandidates || {};
  const project = intake.project || research.openDesignHandoffDraft?.project || {};
  const businessName = firstString(verified.businessName, project.businessName, research.clientSlug, 'Local Business');
  const industry = firstString(verified.industry, project.industry, research.niche, 'local business');
  const family = inferNicheFamily(industry);
  const buildMode = research.buildMode || intake.buildMode || BUILD_MODES.TEASER;
  const contact = buildContact({ verified, intake });
  const contactable = hasReachableContact(contact);
  const scorecard = buildScorecard({ research, intake, redesignCheck, currentSiteAudit, contact, contactable, buildMode });
  const conclusion = conclude({ scorecard, contactable, currentSiteAudit, buildMode });
  const websiteType = chooseWebsiteType({ family, buildMode, scorecard, currentSiteAudit });
  const content = buildContent({ businessName, industry, family, verified, inferred, placeholders, contact, buildMode, websiteType });
  const conversion = buildConversion({ family, contact });
  const questionnaireAnswers = buildQuestionnaireAnswers({ family, contact, content, conversion });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clientSlug: research.clientSlug || intake.clientSlug || project.clientSlug || '',
    business: {
      name: businessName,
      industry,
      familyId: family.id,
      city: firstString(verified.city, project.city),
      country: firstString(project.country),
      sourceType: research.sourceType || intake.sourceType || '',
      buildMode,
    },
    aiConclusion: conclusion,
    scorecard,
    websitePlan: {
      type: websiteType,
      label: websiteType === 'simple_multi_page' ? 'simple multiple-page website' : 'one-page website',
      route: 'website',
      pages: buildPages({ websiteType, content, family }),
      sections: buildSections({ content, family, buildMode }),
      seoFocus: buildSeoFocus({ businessName, industry, family, verified, inferred }),
      conversionFocus: conversion,
      questionnaireAnswers,
      contactForm: {
        required: true,
        provider: 'resend',
        recipient: 'hi@profitslocal.com',
        sender: 'ProfitsLocal <hi@profitslocal.com>',
        fields: ['name', 'email', 'phone', 'message', 'service interest'],
        note: 'Production sites should route form submissions through the existing Resend transactional email flow; do not expose Resend secrets in client repos.',
      },
    },
    content,
    evidencePolicy: {
      verifiedFactsMustStayReal: ['email', 'phone', 'address', 'website', 'contact page', 'social account'],
      generatedContentAllowedFor: ['services explanation', 'about copy', 'FAQ copy', 'testimonial placeholder', 'blog topic ideas', 'SEO supporting copy'],
      generatedContentRule: 'Use AI/common-sense content to complete the demo, but label it internally as inferred or placeholder and replace it with owner-approved facts before launch.',
      blockers: contactable ? [] : ['No real contact path found; do not build outreach mockup until email, phone, contact page, or social DM exists.'],
    },
    openDesignPayload: buildOpenDesignPayload({
      businessName,
      industry,
      family,
      verified,
      inferred,
      contact,
      content,
      conversion,
      questionnaireAnswers,
      buildMode,
      websiteType,
      scorecard,
      conclusion,
      currentSiteAudit,
      redesignCheck,
      outreachBrief,
    }),
  };
}

function buildContact({ verified, intake }) {
  const channels = intake.contactability?.channels || {};
  const socialDm = uniqueObjects([
    ...(verified.socialDm || []),
    ...(channels.socialDm || []),
  ]);
  return {
    emails: uniqueStrings([...(verified.emails || []), ...(channels.emails || [])]),
    phones: uniqueStrings([...(verified.phones || []), ...(channels.phones || [])]),
    address: firstString(verified.address, intake.rawInputs?.address),
    serviceArea: firstString(verified.city, intake.project?.city, intake.rawInputs?.serviceArea),
    websiteUrl: firstString(verified.websiteUrl, intake.facts?.verified?.websiteUrl),
    contactPageUrl: firstString(verified.contactPageUrl, channels.contactPageUrl, intake.facts?.verified?.contactPageUrl),
    googleMapsUrl: firstString(verified.googleMapsUrl, intake.facts?.verified?.googleMapsUrl),
    socialAccounts: socialDm,
  };
}

function hasReachableContact(contact) {
  return Boolean(contact.emails.length || contact.phones.length || contact.contactPageUrl || contact.socialAccounts.length);
}

function buildScorecard({ research, intake, redesignCheck, currentSiteAudit, contact, contactable, buildMode }) {
  const qualification = intake.qualification || {};
  const evidenceSources = research.researchSummary?.evidenceSources || [];
  const verifiedFacts = research.facts?.verified || {};
  const inferredFacts = research.facts?.inferred || {};
  const currentSiteScore = Number.isFinite(currentSiteAudit.score) ? currentSiteAudit.score : null;
  const contactScore = contactable ? Math.min(100, 45 + contact.emails.length * 20 + contact.phones.length * 20 + (contact.contactPageUrl ? 15 : 0) + (contact.socialAccounts.length ? 10 : 0)) : 0;
  const evidenceScore = Math.min(100, evidenceSources.length * 18 + Object.keys(verifiedFacts).length * 6);
  const opportunityScore = scoreOpportunity({ buildMode, redesignCheck, currentSiteAudit, qualification });
  const buildFeasibility = Math.min(100, 35 + Object.keys(inferredFacts).length * 7 + (evidenceSources.length ? 20 : 0) + (contactable ? 20 : 0));
  const overall = Math.round(contactScore * 0.3 + opportunityScore * 0.3 + evidenceScore * 0.2 + buildFeasibility * 0.2);
  return {
    overall,
    contactability: contactScore,
    opportunity: opportunityScore,
    evidence: evidenceScore,
    buildFeasibility,
    qualificationScore: Number.isFinite(qualification.weightedScore) ? qualification.weightedScore : null,
    currentSiteAuditScore: currentSiteScore,
    reasons: [
      contactable ? `Reachable contact path found: ${summarizeContact(contact)}.` : 'No verified reachable contact path found.',
      evidenceSources.length ? `Evidence sources: ${evidenceSources.join(', ')}.` : 'No external evidence pack yet; using intake and inferred content only.',
      buildMode === BUILD_MODES.REDESIGN ? 'Existing website/redesign signal exists.' : 'Starter/teaser build can use AI-completed supporting copy.',
      currentSiteScore !== null ? `Current site audit score is ${currentSiteScore}.` : '',
      qualification.recommendedAction ? `Qualification recommended ${qualification.recommendedAction}.` : '',
    ].filter(Boolean),
  };
}

function scoreOpportunity({ buildMode, redesignCheck, currentSiteAudit, qualification }) {
  if (Number.isFinite(currentSiteAudit.score)) {
    if (currentSiteAudit.score >= 80) return 25;
    if (currentSiteAudit.score >= 60) return 55;
    return 88;
  }
  if (buildMode === BUILD_MODES.STARTER) return 86;
  if (buildMode === BUILD_MODES.REDESIGN) return redesignCheck.decision === 'redesign_preview' ? 82 : 66;
  if (buildMode === BUILD_MODES.TEASER) return 68;
  if (Number.isFinite(qualification.weightedScore)) return qualification.weightedScore;
  return 55;
}

function conclude({ scorecard, contactable, currentSiteAudit, buildMode }) {
  if (!contactable) {
    return {
      result: 'skip',
      label: '跳过',
      confidence: 'high',
      score: scorecard.overall,
      reason: '没有真实邮箱、电话、联系页或社媒 DM，无法触达。AI 可以补内容，但不能补一个假的联系方式。',
      nextAction: '继续搜索真实联系方式；找不到就跳过。',
    };
  }
  if (Number.isFinite(currentSiteAudit.score) && currentSiteAudit.score >= 80) {
    return {
      result: 'skip',
      label: '跳过',
      confidence: 'high',
      score: scorecard.overall,
      reason: '现有网站超过 80 分，除非人工发现非常强的销售突破口，否则不要为了做而做。',
      nextAction: '跳过或放入观察名单。',
    };
  }
  if (Number.isFinite(currentSiteAudit.score) && currentSiteAudit.score >= 60) {
    return {
      result: 'needs_human',
      label: '需人工',
      confidence: 'medium',
      score: scorecard.overall,
      reason: '现有网站 60-80 分，AI 不应自动判断。需要人看审计问题是否足够痛，再决定 mockup 或跳过。',
      nextAction: '人工选择：创建 mockup / 跳过。',
    };
  }
  if (scorecard.overall >= 60 || [BUILD_MODES.STARTER, BUILD_MODES.REDESIGN, BUILD_MODES.TEASER].includes(buildMode)) {
    return {
      result: 'ready_for_mockup',
      label: '可做 Mockup',
      confidence: scorecard.overall >= 76 ? 'high' : 'medium',
      score: scorecard.overall,
      reason: '已有真实联系路径和足够业务范围。缺失的营销文案、FAQ、服务说明可以由 AI 基于行业最佳实践补全，用于 demo 完整性。',
      nextAction: '生成 Open Design mockup payload，并创建一页或简单多页网站预览。',
    };
  }
  return {
    result: 'needs_human',
    label: '需人工',
    confidence: 'low',
    score: scorecard.overall,
    reason: '信息可以补全，但当前价值突破口不够明确。',
    nextAction: '人工判断是否先联系，或继续补 evidence。',
  };
}

function chooseWebsiteType({ family, buildMode, scorecard }) {
  if (buildMode === BUILD_MODES.TEASER) return 'one_page';
  if (family.id === 'professional_service' && scorecard.overall >= 72) return 'simple_multi_page';
  if (family.id === 'clinic' && scorecard.overall >= 72) return 'simple_multi_page';
  if (family.id === 'venue' && scorecard.overall >= 76) return 'simple_multi_page';
  return 'one_page';
}

function buildContent({ businessName, industry, family, verified, inferred, placeholders, contact, buildMode, websiteType }) {
  const services = uniqueStrings([...(inferred.coreServices || []), ...(family.defaultServices || [])]).slice(0, 6);
  const serviceArea = firstString(contact.serviceArea, verified.city, 'the local area');
  return {
    hero: {
      headline: firstString(placeholders.heroHeadline, inferred.heroAngle, `${businessName} for ${serviceArea}`),
      subhead: firstString(placeholders.heroSubhead, `${services[0] || industry} with clear information, proof, and a fast way to enquire.`),
      primaryCta: firstString(inferred.primaryCTA, contact.phones.length ? 'Call now' : 'Send an enquiry'),
      secondaryCta: contact.websiteUrl ? 'View current site' : 'See services',
    },
    services: services.map((service) => ({
      name: service,
      description: `${service} explained in practical language for people comparing ${industry} options in ${serviceArea}.`,
    })),
    about: firstString(placeholders.about, `${businessName} is positioned as a focused ${industry} option for ${serviceArea}, with the site designed to make trust and enquiry simple.`),
    trust: buildTrustSignals({ family, verified, buildMode }),
    faq: buildFaq({ businessName, industry, family }),
    blogIdeas: websiteType === 'simple_multi_page' ? buildBlogIdeas({ industry, serviceArea, services }) : [],
  };
}

function buildTrustSignals({ family, verified, buildMode }) {
  return uniqueStrings([
    verified.googleMapsUrl ? 'Google profile available' : '',
    verified.address ? 'Local address or service area visible' : '',
    buildMode === BUILD_MODES.REDESIGN ? 'Before/after redesign clarity' : '',
    family.id === 'field_service' ? 'Quote path and fast response emphasis' : '',
    family.id === 'clinic' ? 'Calm trust and booking clarity' : '',
    family.id === 'professional_service' ? 'Credibility and consultation clarity' : '',
  ]).slice(0, 4);
}

function buildFaq({ businessName, industry, family }) {
  const action = family.primaryCtaType?.includes('quote') ? 'request a quote' : family.primaryCtaType?.includes('book') ? 'book or enquire' : 'send an enquiry';
  return [
    { question: `What does ${businessName} help with?`, answer: `${businessName} can present its core ${industry} services clearly here, with final wording replaced by owner-approved details.` },
    { question: 'How do customers get started?', answer: `The page should make it easy to ${action} from the hero, service sections, and final CTA.` },
    { question: 'Is this content final?', answer: 'Demo supporting copy can be AI-completed, while contact facts, claims, pricing, and legal/medical details must be verified before launch.' },
  ];
}

function buildBlogIdeas({ industry, serviceArea, services }) {
  return services.slice(0, 3).map((service) => `${service} in ${serviceArea}: what to know before choosing a ${industry}`);
}

function buildPages({ websiteType, content }) {
  if (websiteType === 'one_page') return [{ path: '/', purpose: 'All core details, services, proof, FAQ, and contact form in one conversion page.' }];
  return [
    { path: '/', purpose: 'Primary conversion page with hero, services, proof, and CTA.' },
    { path: '/services', purpose: 'Expanded service explanations and SEO-supporting copy.' },
    { path: '/about', purpose: 'Credibility, local positioning, and trust story.' },
    { path: '/contact', purpose: 'Contact form, phone/email, service area, and map/contact links.' },
    { path: '/blog', purpose: 'Simple SEO article index seeded with relevant local topics.' },
  ];
}

function buildSections({ content, family, buildMode }) {
  return familyCoreSections(family, buildMode).map((section) => ({
    key: section,
    required: true,
    contentHint: sectionContentHint(section, content),
  }));
}

function sectionContentHint(section, content) {
  if (section === 'hero') return content.hero.headline;
  if (section.includes('services') || section.includes('offer')) return content.services.map((item) => item.name).join(', ');
  if (section.includes('trust') || section.includes('proof')) return content.trust.join(', ');
  if (section === 'about') return content.about;
  if (section === 'cta') return content.hero.primaryCta;
  return section;
}

function buildSeoFocus({ businessName, industry, family, verified }) {
  const location = firstString(verified.city, verified.address, 'local');
  return {
    primaryKeyword: `${industry} ${location}`,
    titleIdea: `${businessName} | ${industry} in ${location}`,
    localIntent: family.id === 'field_service' || family.id === 'clinic' || family.id === 'professional_service',
    supportingTopics: [
      `${industry} services in ${location}`,
      `How to choose a ${industry}`,
      `${businessName} contact and enquiry information`,
    ],
  };
}

function buildConversion({ family, contact }) {
  const primary = contact.phones.length && family.primaryCtaType?.includes('call') ? 'phone call' : 'contact form lead';
  return {
    primaryGoal: primary,
    secondaryGoal: contact.phones.length ? 'phone call' : contact.emails.length ? 'email enquiry' : 'social DM',
    ctaPattern: family.primaryCtaType || 'enquiry',
    stickyMobileCta: Boolean(contact.phones.length),
  };
}

function buildQuestionnaireAnswers({ family, contact, content, conversion }) {
  return {
    primarySurface: 'Responsive - all sizes, with mobile-first contact actions',
    audience: family.audience || 'local people comparing credible options and deciding who to contact',
    visualTone: family.tones?.default || 'clear, human, locally credible',
    brandContext: 'Pick a tasteful direction from the industry and any verified evidence; do not wait for a brand spec.',
    ctaContactDetail: contact.phones[0] || contact.emails[0] || contact.contactPageUrl || 'Use contact form only; no invented phone/email.',
    contactFormFields: ['Name', conversion.stickyMobileCta ? 'Phone' : 'Email', 'Service needed', 'Message', 'Preferred call time'],
    constraints: [
      'Do not ask the operator for more input.',
      'Use verified contact details only.',
      `Hero: ${content.hero.headline}`,
      `Primary CTA: ${content.hero.primaryCta}`,
    ],
  };
}

function buildOpenDesignPayload(input) {
  const {
    businessName,
    industry,
    family,
    verified,
    contact,
    content,
    conversion,
    buildMode,
    websiteType,
    scorecard,
    conclusion,
    currentSiteAudit,
    redesignCheck,
    outreachBrief,
    questionnaireAnswers,
  } = input;
  const sections = familyCoreSections(family, buildMode);
  return {
    prompt: renderOpenDesignPrompt({ businessName, industry, verified, contact, content, conversion, websiteType, sections, currentSiteAudit }),
    json: {
      businessName,
      industry,
      location: firstString(verified.city, verified.address),
      buildMode,
      websiteType,
      score: conclusion.score,
      decision: conclusion.result,
      decisionReason: conclusion.reason,
      contact,
      sections,
      content,
      conversion,
      questionnaireAnswers,
      audit: currentSiteAudit?.score ? {
        score: currentSiteAudit.score,
        verdict: currentSiteAudit.verdict || '',
        findings: currentSiteAudit.findings || [],
        priorityActions: currentSiteAudit.priorityActions || [],
      } : null,
      redesign: {
        decision: redesignCheck.decision || '',
        value: redesignCheck.redesignValue || [],
        upgradeTargets: redesignCheck.upgradeTargets || [],
      },
      outreach: {
        diagnosis: outreachBrief.diagnosis || '',
        siteBrief: outreachBrief.siteBrief || '',
        coldMessage: outreachBrief.coldMessage || '',
      },
      scorecard,
      avoid: ['AI-looking gradients', 'generic stock-photo feel', 'empty placeholders', 'fake contact facts', 'corporate buzzwords'],
    },
  };
}

function renderOpenDesignPrompt({ businessName, industry, verified, contact, content, conversion, websiteType, sections, currentSiteAudit }) {
  const location = firstString(verified.city, verified.address, contact.serviceArea, 'the local area');
  const auditLine = Number.isFinite(currentSiteAudit?.score)
    ? `Current site audit: ${currentSiteAudit.score}/100. Use the audit findings to show clear uplift; if the site is already strong, keep the concept restrained.`
    : 'No complete current-site audit is available; use verified facts plus industry best practices and clearly filled demo copy.';
  return [
    'Do not ask follow-up questions. Make reasonable assumptions from the payload and build the concept files now.',
    'This is a pre-sale mockup, so complete the page with internally safe demo copy instead of waiting for missing minor details.',
    '',
    `Build a ${websiteType === 'simple_multi_page' ? 'simple multi-page website' : 'one-page website'} for ${businessName}, a ${industry} in ${location}.`,
    '',
    `Audience: ${content.hero.subhead}`,
    `Hero angle: ${content.hero.headline}`,
    `Primary CTA: ${content.hero.primaryCta}`,
    `Visible contact detail: ${contact.phones[0] || contact.emails[0] || contact.contactPageUrl || 'contact form only; no invented phone/email'}.`,
    contact.phones[0] ? `All call buttons must use href="tel:${normalizeTel(contact.phones[0])}" and visible text should include ${contact.phones[0]}.` : 'Do not create empty tel: links.',
    `Conversion goal: ${conversion.primaryGoal}; include a contact form routed through the existing Resend transactional email flow to hi@profitslocal.com.`,
    'Questionnaire answers: if your design workflow expects a questionnaire, use these answers automatically:',
    `- Primary surface: Responsive - all sizes, mobile-first contact actions.`,
    `- Audience: ${content.hero.subhead}`,
    `- Visual tone: ${firstString(content.tone, 'clear, human, locally credible')}`,
    `- Brand context: Pick a tasteful industry-appropriate direction; do not wait for a brand spec.`,
    `- CTA contact detail: ${contact.phones[0] || contact.emails[0] || contact.contactPageUrl || 'contact form only; no invented phone/email'}.`,
    `- Contact form fields: Name, ${contact.phones.length ? 'Phone' : 'Email'}, Service needed, Message, Preferred call time.`,
    auditLine,
    '',
    `Sections/pages to cover: ${sections.join(', ')}.`,
    `Services to show: ${content.services.map((item) => item.name).join(', ')}.`,
    `Trust signals: ${content.trust.join(', ') || 'clear local credibility and easy contact path'}.`,
    '',
    'Use tasteful, conversion-focused design. Fill demo copy completely using common-sense industry best practices where verified details are missing.',
    'Create the actual HTML/CSS/JS artifact. Do not return a question form, questionnaire, plan-only response, or request for more input.',
    'Do not invent phone, email, address, awards, prices, certifications, medical/legal claims, or review quotes.',
    'Avoid AI-looking gradients, generic stock photos, empty placeholder blocks, "Welcome to" headlines, and "Your trusted partner" copy.',
  ].join('\n');
}

function summarizeContact(contact) {
  const parts = [];
  if (contact.emails.length) parts.push('email');
  if (contact.phones.length) parts.push('phone');
  if (contact.contactPageUrl) parts.push('contact page');
  if (contact.socialAccounts.length) parts.push('social DM');
  return parts.join(', ') || 'none';
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function uniqueStrings(values = []) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function uniqueObjects(values = []) {
  const seen = new Set();
  const output = [];
  for (const value of values || []) {
    const key = JSON.stringify(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function normalizeTel(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}
