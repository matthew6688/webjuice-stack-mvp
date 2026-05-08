import fs from 'fs';
import path from 'path';
import { loadEvidencePack, validateEvidencePack } from '../evidence/evidence.js';
import { buildRestaurantContentFromEvidence, validateRestaurantContent } from '../../niches/restaurant/adapter.js';
import { buildRedesignPreservationPacket } from '../redesign/preservation.js';
import { BUILD_MODES, LEAD_GATE_STATUS, createLeadIntake } from './intake.js';

export function createLeadResearch(input = {}) {
  const intake = resolveIntake(input);
  const clientSlug = intake.clientSlug;
  if (!clientSlug) throw new Error('clientSlug is required');

  const niche = firstString(input.niche, intake.project?.industry === 'restaurant' ? 'restaurant' : '', intake.project?.industry, 'generic');
  const evidencePath = input.evidencePath || path.join('clients', clientSlug, 'evidence', 'evidence.json');
  const contentPath = input.contentPath || defaultContentPath(clientSlug, niche);
  const designPath = input.designPath || defaultDesignPath(clientSlug, niche);
  const preservationPath = input.preservationPath || path.join('clients', clientSlug, 'redesign', 'preservation-packet.json');
  const pagesPath = input.pagesPath || path.join('clients', clientSlug, 'redesign', 'pages.json');
  const googleSearchPath = input.googleSearchPath || '';

  const evidence = readJsonIfExists(evidencePath);
  const evidenceValidation = evidence ? validateEvidencePack(evidence, { niche }) : {
    ok: false,
    errors: ['Evidence pack missing'],
    warnings: [],
    resolved: {},
  };
  const contentSeed = readJsonIfExists(contentPath);
  const design = readJsonIfExists(designPath, {});
  const pages = readJsonIfExists(pagesPath, []);
  const googleSearchText = googleSearchPath && fs.existsSync(googleSearchPath)
    ? fs.readFileSync(googleSearchPath, 'utf8')
    : '';

  const generatedContent = shouldGenerateRestaurantContent({ niche, evidence })
    ? buildRestaurantContentFromEvidence(evidence, { sourceEvidencePath: evidencePath })
    : null;
  const content = contentSeed || generatedContent?.content || {};
  const contentValidation = niche === 'restaurant'
    ? validateRestaurantContent(content)
    : { ok: true, errors: [], warnings: [] };

  const preservationSeed = readJsonIfExists(preservationPath);
  const preservationContent = buildPreservationContent({ content, intake, evidenceValidation });
  const preservation = shouldBuildRedesignPacket({ intake, preservationSeed })
    ? preservationSeed || buildRedesignPreservationPacket({
        clientSlug,
        niche,
        websiteUrl: firstString(
          intake.facts?.verified?.websiteUrl,
          content.contact?.website,
          ''
        ),
        googleSearchText,
        content: preservationContent,
        design,
        pages,
      })
    : null;

  const verifiedFacts = buildVerifiedFacts({ intake, evidenceValidation, content, preservation });
  const inferredFacts = buildInferredFacts({ intake, evidenceValidation, content, preservation });
  const placeholderCandidates = buildPlaceholderCandidates({ intake, content, inferredFacts });
  const missingCritical = buildMissingCritical({ intake, verifiedFacts, evidenceValidation });
  const contactability = resolveContactability({ intake, verifiedFacts });
  const previewability = resolvePreviewability({ intake, contactability, verifiedFacts, inferredFacts });
  const productionReadiness = resolveProductionReadiness({
    intake,
    evidenceValidation,
    contentValidation,
    preservation,
    missingCritical,
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clientSlug,
    sourceType: intake.sourceType,
    buildMode: intake.buildMode,
    gateStatus: intake.gateStatus,
    niche,
    contactability,
    previewability,
    productionReadiness,
    facts: {
      verified: verifiedFacts,
      inferred: inferredFacts,
      placeholderCandidates,
      missingCritical,
    },
    researchSummary: {
      evidencePath: relativizeIfPresent(evidencePath, evidence),
      contentPath: relativizeIfPresent(contentPath, contentSeed || generatedContent?.content),
      preservationPath: relativizeIfPresent(preservationPath, preservationSeed || preservation),
      evidenceSources: evidenceSources(evidence?.items || []),
      evidenceValidation: {
        ok: evidenceValidation.ok,
        errors: evidenceValidation.errors || [],
        warnings: evidenceValidation.warnings || [],
      },
      contentValidation: {
        ok: contentValidation.ok,
        errors: contentValidation.errors || [],
        warnings: contentValidation.warnings || [],
        generatedFromEvidence: Boolean(generatedContent),
      },
    },
    redesign: buildRedesignSummary({ intake, preservation }),
    strategy: {
      recommendedAction: recommendedAction({ intake, previewability, productionReadiness }),
      outreachReady: previewability.status !== 'blocked_unreachable',
      openDesignReady: productionReadiness.status === 'ready_for_open_design',
      nextStep: nextStep({ intake, previewability, productionReadiness }),
    },
    openDesignHandoffDraft: buildOpenDesignResearchHandoff({
      intake,
      verifiedFacts,
      inferredFacts,
      placeholderCandidates,
      preservation,
      contactability,
    }),
  };
}

export function saveLeadResearch(result, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return outputPath;
}

function resolveIntake(input) {
  if (input.intake && typeof input.intake === 'object') return input.intake;
  if (input.intakePath && fs.existsSync(input.intakePath)) {
    return JSON.parse(fs.readFileSync(input.intakePath, 'utf8'));
  }
  return createLeadIntake(input);
}

function shouldGenerateRestaurantContent({ niche, evidence }) {
  return niche === 'restaurant' && evidence && Array.isArray(evidence.items) && evidence.items.length > 0;
}

function shouldBuildRedesignPacket({ intake, preservationSeed }) {
  if (preservationSeed) return true;
  return intake.buildMode === BUILD_MODES.REDESIGN;
}

function buildVerifiedFacts({ intake, evidenceValidation, content, preservation }) {
  const resolved = evidenceValidation.resolved || {};
  const verified = {
    businessName: firstString(
      intake.project?.businessName,
      content.hero?.name,
      valueAt(resolved, 'identity.name')
    ),
    industry: firstString(
      intake.project?.industry,
      valueAt(resolved, 'business.niche')
    ),
    city: firstString(
      intake.project?.city,
      valueAt(resolved, 'business.city')
    ),
    websiteUrl: firstString(
      intake.facts?.verified?.websiteUrl,
      content.contact?.website,
      verifiedEvidenceValueAt(resolved, 'contact.website')
    ),
    googleMapsUrl: firstString(
      intake.facts?.verified?.googleMapsUrl,
      content.contact?.googleMapsUrl,
      verifiedEvidenceValueAt(resolved, 'cta.map')
    ),
    contactPageUrl: firstString(
      intake.facts?.verified?.contactPageUrl
    ),
    phones: uniqueValues([
      ...(intake.facts?.verified?.phones || []),
      content.contact?.phone,
      verifiedEvidenceValueAt(resolved, 'contact.phone'),
      verifiedEvidenceValueAt(resolved, 'contact.phoneFromWebsite'),
    ]),
    emails: uniqueValues([
      ...(intake.facts?.verified?.emails || []),
      content.contact?.email,
      verifiedEvidenceValueAt(resolved, 'contact.email'),
    ]),
    socialDm: uniqueObjects(intake.facts?.verified?.socialDm || []),
    address: firstString(
      content.contact?.address,
      verifiedEvidenceValueAt(resolved, 'contact.address')
    ),
    reservationUrl: firstString(
      content.cta?.reserveUrl,
      valueAt(resolved, 'cta.reserve')
    ),
    menuUrl: firstString(
      content.menu?.sourceUrl,
      valueAt(resolved, 'menu.source')
    ),
    logoUrl: firstString(
      content.brand?.logo,
      preservation?.brandAssets?.logo
    ),
  };
  return compactObject(verified, { keepArrays: true });
}

function buildInferredFacts({ intake, evidenceValidation, content, preservation }) {
  const resolved = evidenceValidation.resolved || {};
  return compactObject({
    audience: firstString(
      intake.strategy?.audience,
      inferAudienceFromContent(content)
    ),
    primaryCTA: firstString(
      intake.strategy?.primaryCTA,
      content.cta?.reserveUrl ? 'book_now' : '',
      content.cta?.callUrl ? 'call_now' : ''
    ),
    heroAngle: firstString(
      intake.strategy?.heroAngle,
      inferHeroFromResearch({ intake, content, preservation })
    ),
    tone: firstString(
      intake.strategy?.tone,
      inferToneFromContent(content)
    ),
    coreServices: uniqueValues([
      ...(intake.strategy?.coreServices || []),
      ...extractCoreServicesFromContent(content),
    ]),
    designDirection: uniqueValues([
      ...(intake.strategy?.designDirection || []),
      ...(content.brand?.colors?.length ? ['use existing brand cues where available'] : []),
      ...(preservation?.readiness?.status === 'warning' ? ['preserve recognizable site structure while simplifying'] : []),
    ]),
    problemType: firstString(
      intake.strategy?.problemType,
      inferProblemType({ intake, preservation })
    ),
    preservationNeed: preservation ? 'preserve_core_facts_and_routes' : '',
    googleRating: valueAt(resolved, 'reviews.rating'),
    reviewCount: valueAt(resolved, 'reviews.count'),
  }, { keepArrays: true });
}

function buildPlaceholderCandidates({ intake, content, inferredFacts }) {
  const base = { ...(intake.facts?.placeholderCandidates || {}) };
  return {
    ...base,
    heroHeadline: firstString(base.heroHeadline, inferredFacts.heroAngle, `${intake.project?.businessName} deserves a clearer online presence`),
    subhead: firstString(base.subhead, `${intake.project?.businessName} can present ${intake.project?.industry} services more clearly and convert interest into enquiries.`),
    about: firstString(base.about, `${intake.project?.businessName} is presented here as a focused ${intake.project?.industry} business with a calmer, clearer customer journey.`),
    serviceSummary: firstString(base.serviceSummary, inferredFacts.coreServices?.[0], `Highlight the main ${intake.project?.industry || 'business'} offer in a short, easy-to-scan section.`),
    testimonial: firstString(base.testimonial, 'Customer story placeholder - replace with a real review after approval.'),
    faq: firstString(base.faq, `FAQ placeholder covering what ${intake.project?.businessName} does, how to enquire, and what happens next.`),
    location: firstString(base.location, verifiedLocationPlaceholder(intake, content)),
  };
}

function buildPreservationContent({ content, intake, evidenceValidation }) {
  const resolved = evidenceValidation.resolved || {};
  return {
    ...content,
    hero: {
      ...(content.hero || {}),
      name: firstString(
        content.hero?.name,
        intake.project?.businessName,
        valueAt(resolved, 'identity.name')
      ),
    },
    contact: {
      ...(content.contact || {}),
      website: firstString(
        content.contact?.website,
        intake.facts?.verified?.websiteUrl,
        verifiedEvidenceValueAt(resolved, 'contact.website')
      ),
      googleMapsUrl: firstString(
        content.contact?.googleMapsUrl,
        intake.facts?.verified?.googleMapsUrl,
        verifiedEvidenceValueAt(resolved, 'cta.map')
      ),
      phone: firstString(
        content.contact?.phone,
        intake.facts?.verified?.phones?.[0],
        verifiedEvidenceValueAt(resolved, 'contact.phone'),
        verifiedEvidenceValueAt(resolved, 'contact.phoneFromWebsite')
      ),
      email: firstString(
        content.contact?.email,
        intake.facts?.verified?.emails?.[0],
        verifiedEvidenceValueAt(resolved, 'contact.email')
      ),
      address: firstString(
        content.contact?.address,
        verifiedEvidenceValueAt(resolved, 'contact.address'),
        intake.project?.city
      ),
    },
  };
}

function buildMissingCritical({ intake, verifiedFacts, evidenceValidation }) {
  const missing = [...(intake.facts?.missingCritical || [])];
  const hasReachableChannel = Boolean(
    (verifiedFacts.emails || []).length
    || (verifiedFacts.phones || []).length
    || verifiedFacts.contactPageUrl
    || (verifiedFacts.socialDm || []).length
  );
  if (!hasReachableChannel && !missing.includes('No reachable contact channel')) {
    missing.push('No reachable contact channel');
  }
  if (!verifiedFacts.businessName && !missing.includes('Business name missing')) {
    missing.push('Business name missing');
  }
  if (!verifiedFacts.industry && !missing.includes('Industry or business scope missing')) {
    missing.push('Industry or business scope missing');
  }
  if (evidenceValidation.errors?.some((error) => /Restaurant address is required|Restaurant phone is required/i.test(error))) {
    missing.push('Evidence still lacks core contact facts for restaurant build');
  }
  return uniqueValues(missing);
}

function resolveContactability({ intake, verifiedFacts }) {
  const channels = {
    emails: verifiedFacts.emails || [],
    phones: verifiedFacts.phones || [],
    contactPageUrl: verifiedFacts.contactPageUrl || '',
    socialDm: verifiedFacts.socialDm || [],
  };
  return {
    status: channels.emails.length || channels.phones.length || channels.contactPageUrl || channels.socialDm.length
      ? 'reachable'
      : 'unreachable',
    channels,
  };
}

function resolvePreviewability({ intake, contactability, verifiedFacts, inferredFacts }) {
  if (contactability.status !== 'reachable') {
    return {
      status: 'blocked_unreachable',
      reason: 'No contact path exists, so a preview is not worth building yet.',
    };
  }
  if (!verifiedFacts.businessName || !verifiedFacts.industry) {
    return {
      status: 'needs_more_research',
      reason: 'Business identity is still too thin for a useful preview.',
    };
  }
  if (intake.buildMode === BUILD_MODES.OUTREACH_ONLY) {
    return {
      status: 'outreach_only',
      reason: 'This lead is better handled with outreach before any preview is built.',
    };
  }
  if (intake.buildMode === BUILD_MODES.TEASER) {
    return {
      status: LEAD_GATE_STATUS.READY_FOR_TEASER,
      reason: 'We have enough context to build a teaser preview with placeholders.',
    };
  }
  return {
    status: intake.gateStatus,
    reason: inferredFacts.problemType === 'no_website'
      ? 'The lead is reachable and has enough context for a starter preview.'
      : 'The lead has enough context for a redesign preview.',
  };
}

function resolveProductionReadiness({ intake, evidenceValidation, contentValidation, preservation, missingCritical }) {
  if (missingCritical.includes('No reachable contact channel')) {
    return {
      status: 'blocked_unreachable',
      reason: 'No reachable contact channel.',
    };
  }
  if (!evidenceValidation.ok) {
    return {
      status: 'needs_more_research',
      reason: 'Evidence still needs cleanup before production handoff.',
      errors: evidenceValidation.errors || [],
    };
  }
  if (intake.buildMode === BUILD_MODES.REDESIGN && preservation?.readiness?.status === 'blocked') {
    return {
      status: 'needs_preservation_review',
      reason: 'Redesign preservation packet still has blockers.',
      errors: preservation.readiness.blockers || [],
    };
  }
  if (contentValidation.ok || intake.buildMode === BUILD_MODES.TEASER) {
    return {
      status: 'ready_for_open_design',
      reason: 'The packet has enough verified facts and structured content for Open Design.',
      warnings: [
        ...(contentValidation.warnings || []),
        ...(preservation?.readiness?.warnings || []),
      ],
    };
  }
  return {
    status: 'needs_more_research',
    reason: 'Structured content still needs work before Open Design handoff.',
    errors: contentValidation.errors || [],
  };
}

function buildRedesignSummary({ intake, preservation }) {
  return {
    isRedesign: intake.buildMode === BUILD_MODES.REDESIGN,
    hasPreservationPacket: Boolean(preservation),
    readiness: preservation?.readiness?.status || '',
    blockers: preservation?.readiness?.blockers || [],
    warnings: preservation?.readiness?.warnings || [],
    currentPageCount: preservation?.currentSitemap?.length || 0,
    proposedPageCount: preservation?.proposedSitemap?.length || 0,
    redirectCount: preservation?.urlPreservation?.redirects301?.length || 0,
    value: inferRedesignValue(preservation),
  };
}

function buildOpenDesignResearchHandoff({ intake, verifiedFacts, inferredFacts, placeholderCandidates, preservation, contactability }) {
  return {
    project: {
      clientSlug: intake.clientSlug,
      businessName: verifiedFacts.businessName || intake.project?.businessName || '',
      industry: verifiedFacts.industry || intake.project?.industry || '',
      city: verifiedFacts.city || intake.project?.city || '',
      country: intake.project?.country || '',
      sourceType: intake.sourceType,
      buildMode: intake.buildMode,
    },
    contactability,
    facts: {
      verified: verifiedFacts,
      inferred: inferredFacts,
      placeholderCandidates,
      missingCritical: intake.facts?.missingCritical || [],
    },
    strategy: {
      problemType: inferredFacts.problemType || '',
      heroAngle: inferredFacts.heroAngle || '',
      primaryCTA: inferredFacts.primaryCTA || '',
      audience: inferredFacts.audience || '',
      tone: inferredFacts.tone || '',
      coreServices: inferredFacts.coreServices || [],
      coreSections: intake.openDesignHandoffDraft?.strategy?.coreSections || [],
      designDirection: inferredFacts.designDirection || [],
      avoid: intake.openDesignHandoffDraft?.strategy?.avoid || [],
    },
    redesign: {
      isRedesign: intake.buildMode === BUILD_MODES.REDESIGN,
      preservationPacket: preservation ? {
        currentPageCount: preservation.currentSitemap?.length || 0,
        proposedPageCount: preservation.proposedSitemap?.length || 0,
        keepSameUrl: preservation.urlPreservation?.keepSameUrl || [],
      } : null,
      redesignValue: inferRedesignValue(preservation),
      upgradeTargets: intake.openDesignHandoffDraft?.redesign?.upgradeTargets || [],
    },
    outreach: intake.outreach,
    contentPolicy: intake.contentPolicy,
  };
}

function recommendedAction({ intake, previewability, productionReadiness }) {
  if (previewability.status === 'blocked_unreachable') return 'skip_or_research_more_contact_paths';
  if (intake.buildMode === BUILD_MODES.OUTREACH_ONLY) return 'write_outreach_only';
  if (productionReadiness.status === 'ready_for_open_design') return 'handoff_to_open_design';
  if (previewability.status === LEAD_GATE_STATUS.READY_FOR_TEASER) return 'build_teaser_preview';
  if (previewability.status === LEAD_GATE_STATUS.READY_FOR_PREVIEW) return 'build_starter_preview';
  if (previewability.status === LEAD_GATE_STATUS.READY_FOR_REDESIGN_PREVIEW) return 'build_redesign_preview';
  return 'research_more';
}

function nextStep({ intake, previewability, productionReadiness }) {
  if (previewability.status === 'blocked_unreachable') return 'Find a reachable contact path or skip the lead.';
  if (productionReadiness.status === 'ready_for_open_design') return 'Send the handoff into Open Design or the next build module.';
  if (intake.buildMode === BUILD_MODES.TEASER) return 'Generate a teaser preview with filled placeholders, then outreach.';
  if (intake.buildMode === BUILD_MODES.OUTREACH_ONLY) return 'Send outreach first and wait for signal before building.';
  return 'Collect one more round of evidence and rerun lead-research.';
}

function inferAudienceFromContent(content) {
  if (content.hero?.cuisine) return `People looking for ${content.hero.cuisine} and an easy way to book or enquire.`;
  return '';
}

function inferHeroFromResearch({ intake, content, preservation }) {
  if (intake.buildMode === BUILD_MODES.REDESIGN && preservation?.coreBusinessFacts?.businessName) {
    return `${preservation.coreBusinessFacts.businessName} can look clearer, more trusted, and easier to act on.`;
  }
  if (content.hero?.name && intake.project?.industry) {
    return `${content.hero.name} deserves a clearer ${intake.project.industry} website that turns interest into enquiries.`;
  }
  return '';
}

function inferToneFromContent(content) {
  if (content.hero?.cuisine) return 'warm, credible, and clear';
  return '';
}

function extractCoreServicesFromContent(content) {
  const menuSections = content.menu?.sections || [];
  return menuSections.slice(0, 3).map((section) => section.name).filter(Boolean);
}

function inferProblemType({ intake, preservation }) {
  if (intake.buildMode === BUILD_MODES.REDESIGN) return 'weak_website';
  if (intake.buildMode === BUILD_MODES.STARTER) return 'no_website';
  if (preservation?.readiness?.warnings?.length) return 'missing_conversion_path';
  return intake.strategy?.problemType || '';
}

function inferRedesignValue(preservation) {
  if (!preservation) return [];
  return uniqueValues([
    ...(preservation.seoPlan?.required || []),
    ...(preservation.readiness?.warnings || []),
  ]).slice(0, 5);
}

function verifiedLocationPlaceholder(intake, content) {
  return firstString(
    content.contact?.address,
    intake.project?.city ? `${intake.project.city} area placeholder - replace with the client's confirmed address.` : '',
    'Location placeholder - replace with the client’s confirmed address.'
  );
}

function evidenceSources(items) {
  return uniqueValues(items.map((item) => item.sourceType).filter(Boolean));
}

function defaultContentPath(clientSlug, niche) {
  return path.join('clients', clientSlug, `content.${niche}.json`);
}

function defaultDesignPath(clientSlug, niche) {
  return path.join('clients', clientSlug, `design.${niche}.json`);
}

function readJsonIfExists(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function relativizeIfPresent(filePath, value) {
  return value ? path.relative(process.cwd(), filePath) : '';
}

function valueAt(target, key) {
  return key.split('.').reduce((cursor, part) => cursor?.[part], target)?.value
    ?? key.split('.').reduce((cursor, part) => cursor?.[part], target);
}

function verifiedEvidenceValueAt(target, key) {
  const node = key.split('.').reduce((cursor, part) => cursor?.[part], target);
  if (node && typeof node === 'object' && node.sourceType === 'generated') return '';
  return node?.value ?? node;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function uniqueValues(values = []) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function uniqueObjects(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const key = JSON.stringify(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function compactObject(target, options = {}) {
  const result = {};
  for (const [key, value] of Object.entries(target || {})) {
    if (Array.isArray(value)) {
      if (options.keepArrays || value.length) result[key] = value;
      continue;
    }
    if (value && typeof value === 'object') {
      if (Object.keys(value).length) result[key] = value;
      continue;
    }
    if (value !== undefined && value !== null && value !== '') result[key] = value;
  }
  return result;
}
