import { matchTemplateFamily, listTemplateFamilies } from './template-match.js';

export function createLeadCopyBrief(input = {}) {
  const research = input.research || {};
  const readyDecision = input.readyDecision || {};
  const templateMatch = input.templateMatch || matchTemplateFamily({
    ...input,
    research,
    readyDecision,
  });
  const selectedFamily = resolveSelectedFamily({ input, templateMatch });
  const verifiedFacts = buildVerifiedFacts({ input, research, readyDecision });
  const inferredContent = buildInferredContent({ input, research, readyDecision, selectedFamily });
  const generatedDemoContent = buildGeneratedDemoContent({ verifiedFacts, inferredContent, selectedFamily });
  const factLock = buildFactLock(verifiedFacts);
  const copyBrief = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clientSlug: input.clientSlug || research.clientSlug || readyDecision.clientSlug || '',
    source: {
      templateMatchPath: input.templateMatchPath || '',
      readyToBuildPath: input.readyToBuildPath || '',
      leadProfilePath: input.leadProfilePath || '',
    },
    selectedTemplate: templateMatch.selected,
    factLock,
    verifiedFacts,
    inferredContent,
    generatedDemoContent,
    pageCopyPlan: {
      heroAngle: inferredContent.heroAngle,
      heroHeadline: generatedDemoContent.hero.headline,
      heroSubcopy: generatedDemoContent.hero.subcopy,
      primaryCta: generatedDemoContent.cta.primary,
      secondaryCta: generatedDemoContent.cta.secondary,
      services: generatedDemoContent.services,
      proofStrategy: generatedDemoContent.proofStrategy,
      process: generatedDemoContent.process,
      faq: generatedDemoContent.faq,
      finalCta: generatedDemoContent.finalCta,
      seoNotes: generatedDemoContent.seoNotes,
    },
    provenance: {
      customerVisibleLabels: false,
      frontendMustNotExpose: ['placeholder', 'inferred', 'generated', 'AI-generated', 'verified fact', 'audit', 'lead ops'],
      generatedContentPolicy: 'Customer-facing page should read as complete finished copy. Internal JSON records which content is verified, inferred, or AI-generated demo content.',
      replacementPolicy: 'Before production launch, replace generated demo proof/reviews/projects with owner-approved facts or Google/customer evidence.',
    },
    forbiddenClaims: factLock.mustNotClaim,
  };
  return copyBrief;
}

function resolveSelectedFamily({ input, templateMatch }) {
  if (input.templateFamily) return input.templateFamily;
  const selected = templateMatch?.selected;
  if (!selected) return {};
  return listTemplateFamilies({ root: input.root || process.cwd(), niche: templateMatch.niche })
    .find((family) => family.templateId === selected.templateId) || selected;
}

function buildVerifiedFacts({ input, research, readyDecision }) {
  const verified = research.facts?.verified || {};
  const handoffBusiness = readyDecision.websiteBuildHandoff?.business || {};
  return compactObject({
    businessName: firstString(input.businessName, verified.businessName, handoffBusiness.name),
    industry: firstString(input.industry, verified.industry, handoffBusiness.industry, research.niche),
    city: firstString(input.city, verified.city, handoffBusiness.city),
    phones: uniqueStrings([input.phone, ...(input.phones || []), ...(verified.phones || [])]),
    emails: uniqueStrings([input.email, ...(input.emails || []), ...(verified.emails || [])]),
    address: firstString(input.address, verified.address),
    websiteUrl: firstString(input.websiteUrl, verified.websiteUrl),
    contactPageUrl: firstString(input.contactPageUrl, verified.contactPageUrl),
    googleMapsUrl: firstString(input.googleMapsUrl, verified.googleMapsUrl),
    socialAccounts: input.socialAccounts || verified.socialDm || [],
    providedServices: uniqueStrings([...(input.services || []), ...(verified.services || [])]),
  }, { keepArrays: true });
}

function buildInferredContent({ input, research, readyDecision, selectedFamily }) {
  const inferred = research.facts?.inferred || {};
  const handoff = readyDecision.websiteBuildHandoff || {};
  const services = uniqueStrings([
    ...(input.services || []),
    ...(inferred.coreServices || []),
    ...(handoff.content?.services || []).map((item) => item.name || item),
    ...inferServicesFromFamily(selectedFamily),
  ]).slice(0, 8);
  const serviceArea = firstString(input.serviceArea, input.city, research.facts?.verified?.city, handoff.business?.city, 'the local area');
  return compactObject({
    serviceArea,
    audience: firstString(inferred.audience, `homeowners and property owners in ${serviceArea}`),
    heroAngle: firstString(inferred.heroAngle, inferHeroAngle({ selectedFamily, serviceArea, services })),
    tone: firstString(inferred.tone, inferTone(selectedFamily)),
    services,
    buildType: handoff.websitePlan?.type || 'one_page',
    opportunity: readyDecision.aiConclusion?.reason || '',
  }, { keepArrays: true });
}

function buildGeneratedDemoContent({ verifiedFacts, inferredContent, selectedFamily }) {
  const businessName = verifiedFacts.businessName || 'Local Roofing Team';
  const serviceArea = inferredContent.serviceArea || verifiedFacts.city || 'your local area';
  const primaryService = inferredContent.services?.[0] || 'roof repairs';
  const phoneFirst = verifiedFacts.phones?.length;
  const emailFirst = verifiedFacts.emails?.length;
  const cta = phoneFirst ? 'Call for a roof inspection' : emailFirst ? 'Request a roof quote' : 'Request an inspection';
  const serviceDescriptions = (inferredContent.services || []).slice(0, 6).map((service) => ({
    name: titleizeService(service),
    source: 'generated_demo_content',
    description: demoServiceDescription(service, serviceArea),
  }));
  return {
    hero: {
      source: 'generated_demo_content',
      headline: `${titleizeService(primaryService)} for ${serviceArea}`,
      subcopy: `${businessName} can present a clear, phone-friendly roofing page with services, trust cues, and a fast quote path for local customers.`,
    },
    cta: {
      primary: cta,
      secondary: 'View services',
      source: phoneFirst || emailFirst ? 'verified_contact_path_plus_generated_label' : 'generated_demo_content',
    },
    services: serviceDescriptions,
    proofStrategy: {
      source: 'generated_demo_content',
      summary: 'Use process clarity, service-area relevance, realistic project modules, and review placeholders until real Google/customer proof is supplied.',
      allowedProof: ['inspection process', 'before/after module structure', 'service-area language', 'demo testimonial copy'],
      replaceBeforeLaunch: ['demo testimonial copy', 'project counts', 'review ratings', 'warranty or license claims'],
    },
    process: [
      'Customer calls or sends a short enquiry.',
      'The roofer confirms the roof issue, suburb, and preferred inspection time.',
      'The site explains likely services and prepares the customer for a quote conversation.',
    ].map((step) => ({ source: 'generated_demo_content', text: step })),
    faq: buildFaq({ businessName, primaryService, serviceArea }),
    finalCta: {
      source: 'generated_demo_content',
      text: `Ready to make the roof easier to understand? ${cta}.`,
    },
    seoNotes: [
      `${primaryService} ${serviceArea}`,
      `${businessName} roofing services`,
      `roof inspection and quote ${serviceArea}`,
    ],
  };
}

function buildFactLock(verifiedFacts) {
  return {
    mustKeepExact: compactObject({
      businessName: verifiedFacts.businessName || '',
      phones: verifiedFacts.phones || [],
      emails: verifiedFacts.emails || [],
      address: verifiedFacts.address || '',
      websiteUrl: verifiedFacts.websiteUrl || '',
    }, { keepArrays: true }),
    mustNotInvent: ['businessName', 'phone', 'email', 'address', 'websiteUrl', 'real reviews', 'licenses', 'awards', 'exact years in business', 'prices'],
    mustNotClaim: [
      'Do not claim real reviews, ratings, licences, awards, exact years, project counts, warranties, or prices unless evidence provides them.',
      'Do not create fake phone, email, address, website URL, or Google Maps details.',
    ],
    canGenerateForDemo: ['service descriptions', 'FAQ', 'process copy', 'benefit copy', 'CTA labels', 'demo testimonial wording', 'project module structure', 'blog/topic ideas'],
  };
}

function inferServicesFromFamily(family) {
  const text = [
    family?.family,
    ...(family?.fit?.subNiches || []),
    ...(family?.fit?.bestFor || []),
  ].join(' ').toLowerCase();
  const services = [];
  if (text.includes('restoration')) services.push('roof restoration');
  if (text.includes('repair')) services.push('roof repairs');
  if (text.includes('gutter')) services.push('gutters');
  if (text.includes('pressure')) services.push('pressure cleaning');
  if (text.includes('metal')) services.push('metal roofing');
  if (text.includes('inspection')) services.push('roof inspections');
  if (!services.length) services.push('roof repairs', 'roof restoration', 'roof inspections');
  return services;
}

function inferHeroAngle({ selectedFamily, serviceArea, services }) {
  const family = selectedFamily?.family || '';
  if (family.includes('lead-capture')) return `Make it easy for ${serviceArea} homeowners to call for repairs, restoration, and quote-ready roof help.`;
  if (family.includes('premium')) return `Present a premium roofing team with strong visuals, project confidence, and a polished quote path.`;
  if (family.includes('productized')) return `Help homeowners compare roof systems, inspections, and materials before requesting a quote.`;
  if (family.includes('editorial')) return `Make the roofing business feel established, bold, and visually memorable.`;
  return `Make ${services?.[0] || 'roofing'} easy to understand and easy to enquire about.`;
}

function inferTone(family) {
  const id = family?.family || '';
  if (id.includes('premium')) return 'premium, calm, trustworthy';
  if (id.includes('editorial')) return 'bold, confident, trade-professional';
  if (id.includes('productized')) return 'clear, structured, helpful';
  return 'direct, local, practical';
}

function demoServiceDescription(service, serviceArea) {
  const s = service.toLowerCase();
  if (s.includes('restoration')) return `Restoration copy can explain cleaning, sealing, repainting, and roof-life improvement for homes around ${serviceArea}.`;
  if (s.includes('repair')) return `Repair copy can focus on leaks, storm damage, cracked tiles, flashing, and practical quote steps.`;
  if (s.includes('gutter')) return `Gutter copy can cover cleaning, repair, replacement, water flow, and inspection during roof work.`;
  if (s.includes('pressure')) return `Pressure cleaning copy can explain exterior cleaning for roofs, driveways, patios, and outdoor areas.`;
  if (s.includes('metal')) return `Metal roofing copy can explain durability, modern appearance, materials, and quote considerations.`;
  return `${titleizeService(service)} copy can explain the service, who it helps, and what a customer should do next.`;
}

function buildFaq({ businessName, primaryService, serviceArea }) {
  return [
    {
      source: 'generated_demo_content',
      question: `Can I request a quote for ${primaryService}?`,
      answer: `Yes. The page should make it simple to call or send an enquiry, then confirm the roof issue and service area.`,
    },
    {
      source: 'generated_demo_content',
      question: `Do you service ${serviceArea}?`,
      answer: `${businessName} can use this section to state the confirmed service areas once the owner supplies final coverage details.`,
    },
    {
      source: 'generated_demo_content',
      question: 'What details should I send first?',
      answer: 'A short description, suburb, photos if available, and whether the work is urgent are enough for the first conversation.',
    },
  ];
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function compactObject(object, { keepArrays = false } = {}) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => {
    if (Array.isArray(value)) return keepArrays || value.length > 0;
    return value !== undefined && value !== null && value !== '';
  }));
}

function titleizeService(value) {
  return String(value || '').split(/[-_\s/]+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}
