import fs from 'fs';
import path from 'path';
import { SOURCE_TYPES as EVIDENCE_SOURCE_TYPES } from '../evidence/evidence.js';
import { qualifyLead, RECOMMENDED_ACTIONS } from './qualification.js';
import { familyCoreSections, inferNicheFamily } from '../niches/families.js';

export const LEAD_SOURCE_TYPES = [
  ...new Set([
    ...EVIDENCE_SOURCE_TYPES,
    'website_inbound',
    'paid_intake',
    'imported_list',
    'maps_scraper',
    'referral',
    'provider_reply',
    'existing_project_reentry',
  ]),
];

export const BUILD_MODES = {
  STARTER: 'starter',
  REDESIGN: 'redesign',
  TEASER: 'teaser',
  OUTREACH_ONLY: 'outreach-only',
};

export const LEAD_GATE_STATUS = {
  READY_FOR_PREVIEW: 'ready_for_preview',
  READY_FOR_REDESIGN_PREVIEW: 'ready_for_redesign_preview',
  READY_FOR_TEASER: 'ready_for_teaser',
  OUTREACH_ONLY: 'outreach_only',
  NEEDS_MORE_RESEARCH: 'needs_more_research',
  BLOCKED_UNREACHABLE: 'blocked_unreachable',
};

export function createLeadIntake(input = {}) {
  const sourceType = normalizeSourceType(input.sourceType || input.source || 'manual');
  const businessName = firstString(
    input.businessName,
    input.company,
    input.name,
  );
  const industry = firstString(
    input.industry,
    input.niche,
    input.businessType,
    input.businessScope,
  );
  const nicheFamily = inferNicheFamily(industry);
  const city = firstString(input.city, input.location?.city);
  const country = firstString(input.country, input.location?.country);
  const websiteUrl = cleanUrl(input.websiteUrl || input.website || input.officialWebsite || '');
  const googleMapsUrl = cleanUrl(input.googleMapsUrl || input.google_maps_url || input.mapUrl || '');
  const contactPageUrl = cleanUrl(input.contactPageUrl || input.contactPage || input.contactFormUrl || '');
  const emails = uniqueValues([
    input.email,
    ...(Array.isArray(input.contactEmails) ? input.contactEmails : []),
    ...(Array.isArray(input.emails) ? input.emails : []),
  ]).filter(isProbablyEmail);
  const phones = uniqueValues([
    input.phone,
    ...(Array.isArray(input.contactPhones) ? input.contactPhones : []),
    ...(Array.isArray(input.phones) ? input.phones : []),
  ]).filter(Boolean);
  const socialDm = normalizeSocialDm(
    input.social
    || input.socialDm
    || input.socialLinks
    || socialFieldsFromInput(input)
  );
  const serviceHints = normalizeStrings([
    input.businessScope,
    input.primaryOffer,
    input.coreService,
    ...(Array.isArray(input.coreServices) ? input.coreServices : []),
    ...(Array.isArray(input.services) ? input.services : []),
  ]);
  const observations = normalizeStrings([
    input.observation,
    ...(Array.isArray(input.observations) ? input.observations : []),
    ...(Array.isArray(input.notes) ? input.notes : []),
  ]);
  const hasReachableChannel = Boolean(emails.length || phones.length || contactPageUrl || socialDm.length);
  const hasWebsite = Boolean(websiteUrl);
  const qualificationLead = {
    name: businessName,
    address: firstString(input.address, input.location?.address),
    phone: phones[0] || '',
    website: websiteUrl,
    google_maps_url: googleMapsUrl,
    rating: input.rating || 0,
    review_count: input.reviewCount || input.review_count || 0,
    hours: Array.isArray(input.hours) ? input.hours : [],
    photo_references: Array.isArray(input.photoReferences) ? input.photoReferences : [],
    photo_reference: input.photoReference || '',
    niche: industry,
  };
  const qualification = businessName
    ? qualifyLead({
        lead: qualificationLead,
        websiteScan: input.websiteScan || null,
        niche: industry || 'generic',
        clientSlug: input.clientSlug,
      })
    : null;
  const redesignSignal = inferRedesignSignal(input, { hasWebsite, observations, qualification });
  const canPreview = Boolean(businessName && industry && hasReachableChannel);
  const hasStrongContext = Boolean(serviceHints.length || observations.length || googleMapsUrl || websiteUrl);
  const hasStructuredContext = Boolean(serviceHints.length || googleMapsUrl || city || phones.length || contactPageUrl);
  const buildMode = decideBuildMode(input, {
    hasWebsite,
    redesignSignal,
    canPreview,
    hasStrongContext,
    hasStructuredContext,
    qualification,
    sourceType,
  });
  const gateStatus = decideGateStatus({ hasReachableChannel, canPreview, hasStrongContext, buildMode });
  const modeDecision = explainModeDecision({ hasWebsite, hasReachableChannel, hasStrongContext, buildMode, qualification, redesignSignal });
  const placeholderCandidates = buildPlaceholderCandidates({
    businessName,
    industry,
    city,
    buildMode,
    serviceHints,
    observations,
    family: nicheFamily,
  });

  const verified = compactObject({
    businessName,
    industry,
    city,
    country,
    websiteUrl,
    googleMapsUrl,
    contactPageUrl,
    emails,
    phones,
    socialDm,
  });

  const inferred = compactObject({
    audience: inferAudience({ family: nicheFamily, observations }),
    primaryCTA: inferPrimaryCta({ family: nicheFamily, emails, phones, contactPageUrl, socialDm }),
    heroAngle: inferHeroAngle({ businessName, industry, serviceHints, observations, buildMode, city, family: nicheFamily }),
    tone: inferTone({ family: nicheFamily, buildMode }),
    coreServices: inferCoreServices({ family: nicheFamily, serviceHints }),
    designDirection: inferDesignDirection({ family: nicheFamily, buildMode, observations }),
    problemType: inferProblemType({ hasWebsite, redesignSignal, family: nicheFamily }),
  });

  const missingCritical = [];
  if (!hasReachableChannel) missingCritical.push('No reachable contact channel');
  if (!businessName) missingCritical.push('Business name missing');
  if (!industry) missingCritical.push('Industry or business scope missing');

  const record = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceType,
    buildMode,
    gateStatus,
    leadId: firstString(input.leadId, buildLeadId({ sourceType, businessName, emails })),
    clientSlug: firstString(input.clientSlug, slugify(businessName || input.clientSlug || 'unknown-lead')),
    project: {
      businessName: businessName || '',
      industry: industry || '',
      city: city || '',
      country: country || '',
      hasWebsite,
      redesignSignal,
    },
    qualification: qualification ? {
      leadType: qualification.leadType,
      grade: qualification.qualification,
      recommendedAction: qualification.recommendedAction,
      weightedScore: qualification.weightedScore,
      scores: qualification.scores,
      blockers: qualification.blockers,
      reasons: qualification.reasons,
    } : null,
    contactability: {
      status: hasReachableChannel ? 'reachable' : 'unreachable',
      channels: {
        emails,
        phones,
        contactPageUrl,
        socialDm,
      },
    },
    facts: {
      verified,
      inferred,
      placeholderCandidates,
      missingCritical,
    },
    strategy: {
      recommendedNextStep: nextStepForGate(gateStatus),
      modeDecision,
      problemType: inferred.problemType || '',
      heroAngle: inferred.heroAngle || '',
      primaryCTA: inferred.primaryCTA || '',
      audience: inferred.audience || '',
      tone: inferred.tone || '',
      coreServices: inferred.coreServices || [],
      designDirection: inferred.designDirection || [],
      familyId: nicheFamily.id,
    },
    outreach: {
      diagnosis: buildDiagnosis({ hasWebsite, redesignSignal, industry, businessName, city }),
      specificObservation: observations[0] || '',
      coldMessageAngle: buildColdAngle({ hasWebsite, redesignSignal, industry, city }),
    },
    contentPolicy: {
      allowPlaceholders: true,
      placeholdersMustBeFilled: true,
      mustNotInventContactFacts: true,
      mustLabelDummyContentInternally: true,
    },
    rawInputs: normalizeRawInputs(input),
  };

  record.openDesignHandoffDraft = buildOpenDesignHandoffDraft(record);
  return record;
}

export function createLeadIntakeFromLeadRecord(input = {}) {
  const lead = input.lead || {};
  return createLeadIntake({
    sourceType: input.sourceType || lead.website ? 'google_places' : 'google_places',
    clientSlug: input.clientSlug,
    leadId: input.leadId || lead.place_id || '',
    businessName: lead.name || '',
    industry: input.industry || input.niche || lead.niche || firstTypeLabel(lead.types),
    city: input.city || lead.city || '',
    country: input.country || lead.country || '',
    websiteUrl: lead.website || '',
    googleMapsUrl: lead.google_maps_url || '',
    phone: lead.phone || '',
    address: lead.address || '',
    rating: lead.rating || 0,
    reviewCount: lead.review_count || 0,
    hours: Array.isArray(lead.hours) ? lead.hours : [],
    photoReferences: Array.isArray(lead.photo_references) ? lead.photo_references : [],
    photoReference: lead.photo_reference || '',
    observations: normalizeStrings([
      input.observation,
      lead.unique_note,
      lead.note,
    ]),
    services: normalizeStrings(input.services || []),
    websiteScan: input.websiteScan || null,
  });
}

export function saveLeadIntake(result, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return outputPath;
}

export function buildOpenDesignHandoffDraft(record) {
  return {
    project: {
      clientSlug: record.clientSlug,
      businessName: record.project.businessName,
      industry: record.project.industry,
      familyId: inferNicheFamily(record.project.industry).id,
      city: record.project.city,
      country: record.project.country,
      sourceType: record.sourceType,
      buildMode: record.buildMode,
    },
    contactability: {
      status: record.contactability.status,
      channels: {
        emails: record.contactability.channels.emails,
        phones: record.contactability.channels.phones,
        contactPageUrl: record.contactability.channels.contactPageUrl,
        socialDm: record.contactability.channels.socialDm,
      },
    },
    facts: record.facts,
    strategy: {
      problemType: record.strategy.problemType,
      heroAngle: record.strategy.heroAngle,
      primaryCTA: record.strategy.primaryCTA,
      audience: record.strategy.audience,
      tone: record.strategy.tone,
      coreServices: record.strategy.coreServices,
      coreSections: defaultCoreSections(record.buildMode, inferNicheFamily(record.project.industry)),
      designDirection: record.strategy.designDirection,
      avoid: [
        'Generic stock-photo feel',
        'AI-looking gradients',
        'Buzzword-heavy local marketing copy',
      ],
    },
    redesign: {
      isRedesign: record.buildMode === BUILD_MODES.REDESIGN,
      preservationPacket: null,
      redesignValue: record.buildMode === BUILD_MODES.REDESIGN
        ? [
            'Improve clarity of offer and service hierarchy',
            'Improve trust and premium feel',
            'Strengthen mobile conversion path',
          ]
        : [],
      upgradeTargets: record.buildMode === BUILD_MODES.REDESIGN
        ? ['hero clarity', 'CTA path', 'mobile usability', 'trust presentation']
        : [],
    },
    outreach: record.outreach,
    evidence: {
      sources: record.rawInputs.sources || [],
      confidence: confidenceFor(record),
      assets: [],
    },
    contentPolicy: record.contentPolicy,
  };
}

function decideBuildMode(input, context) {
  if (!context.canPreview) return BUILD_MODES.OUTREACH_ONLY;
  if (input.forceBuildMode && Object.values(BUILD_MODES).includes(input.forceBuildMode)) return input.forceBuildMode;
  if (!context.hasWebsite) {
    if (context.sourceType === 'provider_reply' && !context.hasStructuredContext) {
      return BUILD_MODES.TEASER;
    }
    return context.hasStrongContext ? BUILD_MODES.STARTER : BUILD_MODES.TEASER;
  }
  if (context.redesignSignal === 'strong') return BUILD_MODES.REDESIGN;
  if (context.qualification?.recommendedAction === RECOMMENDED_ACTIONS.BUILD_STARTER) return BUILD_MODES.STARTER;
  if (context.qualification?.recommendedAction === RECOMMENDED_ACTIONS.BUILD_REDESIGN) return BUILD_MODES.REDESIGN;
  if (context.qualification?.recommendedAction === RECOMMENDED_ACTIONS.OUTREACH_ONLY) return BUILD_MODES.OUTREACH_ONLY;
  if (context.qualification?.recommendedAction === RECOMMENDED_ACTIONS.SKIP) return BUILD_MODES.OUTREACH_ONLY;
  if (context.redesignSignal === 'weak') return BUILD_MODES.TEASER;
  return BUILD_MODES.OUTREACH_ONLY;
}

function decideGateStatus({ hasReachableChannel, canPreview, hasStrongContext, buildMode }) {
  if (!hasReachableChannel) return LEAD_GATE_STATUS.BLOCKED_UNREACHABLE;
  if (!canPreview) return LEAD_GATE_STATUS.NEEDS_MORE_RESEARCH;
  if (buildMode === BUILD_MODES.STARTER) return LEAD_GATE_STATUS.READY_FOR_PREVIEW;
  if (buildMode === BUILD_MODES.REDESIGN) return LEAD_GATE_STATUS.READY_FOR_REDESIGN_PREVIEW;
  if (buildMode === BUILD_MODES.TEASER) return LEAD_GATE_STATUS.READY_FOR_TEASER;
  if (hasStrongContext) return LEAD_GATE_STATUS.OUTREACH_ONLY;
  return LEAD_GATE_STATUS.NEEDS_MORE_RESEARCH;
}

function buildPlaceholderCandidates({ businessName, industry, city, buildMode, serviceHints, observations, family }) {
  const service = serviceHints[0] || genericServiceForFamily(family);
  const locationLabel = city || 'your local area';
  return compactObject({
    heroHeadline: `${businessName || 'This business'} deserves a clearer ${industry || 'local service'} presence online`,
    heroSubhead: `${service} presented with a cleaner first impression, faster trust, and a stronger path to enquiry.`,
    about: `${businessName || 'This business'} appears to serve ${locationLabel} with a focus on ${service}. This placeholder copy is here to make the demo feel complete until real owner-approved details are supplied.`,
    serviceSummary: `${service} explained in a concise, customer-friendly way for a first-pass demo.`,
    testimonial: `Placeholder social proof for ${businessName || 'the business'} that will be replaced by verified customer wording after approval.`,
    location: `Location placeholder for ${businessName || 'the business'} in ${locationLabel}. Replace with verified address or service area before launch.`,
    faq: `Short placeholder answers covering bookings, service expectations, and contact flow for a ${industry || 'local business'} website.`,
    observationEcho: observations[0] || '',
    modeIntent: buildMode,
  });
}

function inferAudience({ family, observations }) {
  if (observations.some((item) => /family|group|private dining|event/i.test(item))) return 'people looking for a trusted local option with a clear next step';
  return family.audience || 'local people comparing a few options and deciding who feels most credible';
}

function inferPrimaryCta({ family, emails, phones, contactPageUrl, socialDm }) {
  if (phones.length && ['field_service', 'professional_service', 'clinic'].includes(family.id)) return 'Call now';
  if (contactPageUrl) return 'Send an enquiry';
  if (socialDm.length) return `Message on ${socialDm[0].label}`;
  if (emails.length) return 'Email for details';
  return 'Get in touch';
}

function inferHeroAngle({ businessName, industry, serviceHints, observations, buildMode, city, family }) {
  const service = serviceHints[0] || genericServiceForFamily(family);
  if (buildMode === BUILD_MODES.REDESIGN) {
    return `${businessName || 'This business'} already has real-world traction; the website should finally feel as strong as the service.`;
  }
  if (observations[0]) {
    return `${service} presented around one clear local advantage: ${trimSentence(observations[0])}`;
  }
  return `${service} for ${city || 'local customers'}, with a clearer first impression and a simpler path to action.`;
}

function inferTone({ family, buildMode }) {
  if (buildMode === BUILD_MODES.REDESIGN) return family.tones?.redesign || 'confident, refined, locally credible';
  return family.tones?.default || 'clear, human, quietly premium';
}

function inferCoreServices({ family, serviceHints }) {
  if (serviceHints.length) return serviceHints.slice(0, 6);
  return family.defaultServices || ['Primary service', 'Supporting service', 'Get in touch'];
}

function inferDesignDirection({ family, buildMode, observations }) {
  const tags = [...(family.designDirection || ['quiet premium layout', 'clear hierarchy', 'fast contact path'])];
  if (buildMode === BUILD_MODES.REDESIGN) tags.push('visible before/after uplift');
  if (observations.some((item) => /luxury|premium|high-end/i.test(item))) tags.push('premium restraint');
  return tags.slice(0, 4);
}

function inferProblemType({ hasWebsite, redesignSignal, family }) {
  if (!hasWebsite) return family.problemTypes?.noWebsite || 'no_website';
  if (redesignSignal === 'strong') return family.problemTypes?.redesign || 'weak_website';
  if (redesignSignal === 'weak') return family.problemTypes?.weakSignal || 'missing_conversion_path';
  return family.problemTypes?.default || 'outreach_probe';
}

function buildDiagnosis({ hasWebsite, redesignSignal, industry, businessName, city }) {
  if (!hasWebsite) {
    return `${businessName || 'This business'} appears to have no meaningful website presence, which means search and referral traffic has nowhere strong to land. A simple, credible ${industry || 'local business'} site would likely improve trust and enquiry conversion.`;
  }
  if (redesignSignal === 'strong') {
    return `${businessName || 'This business'} already has a website, but it likely undersells the real business. The redesign opportunity is to improve clarity, trust, and the path from interest to booking or enquiry.`;
  }
  return `${businessName || 'This business'} may still benefit from a sharper online presentation for ${city || 'its local market'}, but this lead should be validated through outreach before heavier build work.`;
}

function buildColdAngle({ hasWebsite, redesignSignal, industry, city }) {
  if (!hasWebsite) return `Noticed there is no dedicated website experience for your ${industry || 'business'} in ${city || 'your area'}, so I mocked up what a clearer first impression could look like.`;
  if (redesignSignal === 'strong') return `I took a look at the current site and mocked up a version that makes the offer clearer and the next step easier for mobile visitors.`;
  return `I looked into the business and put together a quick concept that sharpens how the value shows up online.`;
}

function nextStepForGate(gateStatus) {
  switch (gateStatus) {
    case LEAD_GATE_STATUS.READY_FOR_PREVIEW:
      return 'Build a starter preview and prepare outreach assets.';
    case LEAD_GATE_STATUS.READY_FOR_REDESIGN_PREVIEW:
      return 'Run redesign-check, capture preservation, then build a redesign preview.';
    case LEAD_GATE_STATUS.READY_FOR_TEASER:
      return 'Build a teaser preview with placeholders and clear internal labels.';
    case LEAD_GATE_STATUS.OUTREACH_ONLY:
      return 'Prepare outreach copy first and wait for signal before building.';
    case LEAD_GATE_STATUS.BLOCKED_UNREACHABLE:
      return 'Do not build. Find a real contact channel first.';
    default:
      return 'Research missing business identity, service scope, or contactability.';
  }
}

function explainModeDecision({ hasWebsite, hasReachableChannel, hasStrongContext, buildMode, qualification, redesignSignal }) {
  const reasons = [];
  if (!hasReachableChannel) reasons.push('No reliable contact channel was found.');
  if (!hasWebsite && hasReachableChannel) reasons.push('No website exists, so a preview can create immediate visible value.');
  if (redesignSignal === 'strong') reasons.push('Existing website shows strong redesign opportunity.');
  if (qualification?.recommendedAction && qualification.recommendedAction !== actionForBuildMode(buildMode)) {
    reasons.push(`Qualification suggested ${qualification.recommendedAction}, but intake kept ${buildMode} because demo completeness can still be useful when contactability exists.`);
  }
  if (buildMode === BUILD_MODES.TEASER) reasons.push('Information is thin, so placeholder-backed teaser mode is safer than a full preview.');
  if (buildMode === BUILD_MODES.OUTREACH_ONLY) reasons.push('The lead should be contacted before any build work.');
  if (!reasons.length && hasStrongContext) reasons.push('Enough context exists to move into preview work.');
  return reasons;
}

function actionForBuildMode(buildMode) {
  if (buildMode === BUILD_MODES.STARTER) return RECOMMENDED_ACTIONS.BUILD_STARTER;
  if (buildMode === BUILD_MODES.REDESIGN) return RECOMMENDED_ACTIONS.BUILD_REDESIGN;
  if (buildMode === BUILD_MODES.OUTREACH_ONLY) return RECOMMENDED_ACTIONS.OUTREACH_ONLY;
  return 'teaser';
}

function normalizeSourceType(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '_');
  if (LEAD_SOURCE_TYPES.includes(normalized)) return normalized;
  return 'manual';
}

function normalizeSocialDm(input) {
  if (!input) return [];
  const pairs = [];
  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') pairs.push({ label: platformLabel(item), url: cleanUrl(item) });
      else if (item?.url) pairs.push({ label: item.label || platformLabel(item.url), url: cleanUrl(item.url) });
    }
  } else if (typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      if (!value) continue;
      pairs.push({ label: key, url: cleanUrl(value) });
    }
  }
  return pairs.filter((item) => item.url);
}

function socialFieldsFromInput(input) {
  return {
    instagram: input.instagramUrl || input.instagram,
    facebook: input.facebookUrl || input.facebook,
    linkedin: input.linkedinUrl || input.linkedin,
    whatsapp: input.whatsapp || input.whatsappUrl,
    tiktok: input.tiktokUrl || input.tiktok,
  };
}

function inferRedesignSignal(input, { hasWebsite, observations, qualification }) {
  if (!hasWebsite) return 'none';
  if (input.redesignSignal) return input.redesignSignal;
  if (qualification?.leadType === 'bad_website') return 'strong';
  if (qualification?.leadType === 'good_website') return 'none';
  if (input.currentWebsiteQuality === 'bad' || input.websiteQuality === 'bad') return 'strong';
  if (input.currentWebsiteQuality === 'weak' || input.websiteQuality === 'weak') return 'strong';
  if (input.existingWebsiteQuality === 'good') return 'none';
  if (observations.some((item) => /stale|old|broken|template|slow|weak|dated|confusing/i.test(item))) return 'strong';
  return 'weak';
}

function defaultCoreSections(buildMode, family) {
  return familyCoreSections(family, buildMode);
}

function confidenceFor(record) {
  if (record.gateStatus === LEAD_GATE_STATUS.BLOCKED_UNREACHABLE) return 'low';
  if (record.buildMode === BUILD_MODES.REDESIGN || record.buildMode === BUILD_MODES.STARTER) return 'medium';
  return 'medium-low';
}

function normalizeRawInputs(input) {
  return {
    sources: uniqueValues([
      input.googleMapsUrl || input.google_maps_url,
      input.websiteUrl || input.website,
      input.contactPageUrl || input.contactPage,
    ].filter(Boolean)),
    importedFrom: firstString(input.importedFrom, input.listName),
    notes: normalizeStrings(input.notes || input.observations || []),
  };
}

function genericServiceForFamily(family) {
  return (family.defaultServices || ['Primary service'])[0];
}

function buildLeadId({ sourceType, businessName, emails }) {
  const email = emails[0] || '';
  if (businessName && email) return `${slugify(businessName)}:${normalizeEmail(email)}`;
  if (businessName) return slugify(businessName);
  return `${sourceType}:${Date.now()}`;
}

function firstTypeLabel(types) {
  if (!Array.isArray(types) || !types.length) return '';
  return String(types[0] || '').replace(/_/g, ' ').trim();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function platformLabel(url) {
  const value = String(url || '').toLowerCase();
  if (value.includes('instagram')) return 'Instagram';
  if (value.includes('facebook')) return 'Facebook';
  if (value.includes('linkedin')) return 'LinkedIn';
  if (value.includes('whatsapp')) return 'WhatsApp';
  if (value.includes('tiktok')) return 'TikTok';
  return 'Social';
}

function cleanUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function normalizeStrings(values) {
  return uniqueValues((Array.isArray(values) ? values : [values]).map((value) => String(value || '').trim()).filter(Boolean));
}

function uniqueValues(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function compactObject(input) {
  const output = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (Array.isArray(value) && value.length === 0) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length) continue;
    if (value === '' || value === null || value === undefined) continue;
    output[key] = value;
  }
  return output;
}

function isProbablyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(String(value || '').trim());
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function trimSentence(value) {
  return String(value || '').trim().replace(/[.。]+$/, '');
}
