import fs from 'fs';
import path from 'path';
import { createLeadResearch } from './research.js';
import { BUILD_MODES } from './intake.js';
import { inferNicheFamily } from '../niches/families.js';

export const REDESIGN_CHECK_DECISIONS = {
  REDESIGN_PREVIEW: 'redesign_preview',
  MANUAL_REVIEW: 'manual_review',
  OUTREACH_ONLY: 'outreach_only',
  NOT_APPLICABLE: 'not_applicable',
  BLOCKED_UNREACHABLE: 'blocked_unreachable',
};

export function createRedesignCheck(input = {}) {
  const research = input.research || createLeadResearch(input);
  const family = inferNicheFamily(research.facts?.verified?.industry || research.niche || '');
  const preservationPacket = resolvePreservationPacket(input, research);
  const preservationReadiness = preservationPacket?.readiness?.status || '';
  const blockers = normalizeBlockers(uniqueStrings([
    ...(research.redesign?.blockers || []),
    ...(preservationPacket?.readiness?.blockers || []),
  ]), research);
  const warnings = uniqueStrings([
    ...(research.redesign?.warnings || []),
    ...(preservationPacket?.readiness?.warnings || []),
  ]);

  const decision = decideRedesignCheck({
    research,
    preservationPacket,
    preservationReadiness,
    blockers,
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clientSlug: research.clientSlug,
    niche: research.niche,
    familyId: family.id,
    buildMode: research.buildMode,
    decision: decision.id,
    reason: decision.reason,
    riskLevel: inferRiskLevel({ decision: decision.id, blockers, warnings }),
    previewability: research.previewability,
    productionReadiness: research.productionReadiness,
    currentSite: buildCurrentSiteSummary(preservationPacket),
    preservation: buildPreservationSummary(preservationPacket),
    redesignValue: inferRedesignValue({ family, research, preservationPacket }),
    upgradeTargets: inferUpgradeTargets({ family, research, preservationPacket }),
    outreachAngle: buildOutreachAngle({ family, research }),
    blockers,
    warnings,
  };
}

function resolvePreservationPacket(input, research) {
  if (input.preservationPacket && typeof input.preservationPacket === 'object') return input.preservationPacket;
  const researchPath = input.preservationPath || research.researchSummary?.preservationPath;
  if (!researchPath) return null;
  const filePath = path.isAbsolute(researchPath) ? researchPath : path.resolve(researchPath);
  if (!fs.existsSync(filePath)) return fallbackPreservationPacket(research);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fallbackPreservationPacket(research) {
  if (!research.redesign?.hasPreservationPacket) return null;
  const currentCount = research.redesign?.currentPageCount || 0;
  const proposedCount = research.redesign?.proposedPageCount || 0;
  const redirectCount = research.redesign?.redirectCount || 0;
  return {
    sourceWebsiteUrl: research.facts?.verified?.websiteUrl || '',
    currentSitemap: Array.from({ length: currentCount }, () => ({ importance: 'must_keep' })),
    proposedSitemap: Array.from({ length: proposedCount }, () => ({})),
    urlPreservation: {
      keepSameUrl: [],
      redirects301: Array.from({ length: redirectCount }, () => ({})),
      needsManualRedirectReview: [],
    },
    brandAssets: {
      needsConfirmation: [],
    },
    readiness: {
      status: research.redesign?.readiness || '',
      blockers: research.redesign?.blockers || [],
      warnings: research.redesign?.warnings || [],
    },
  };
}

function decideRedesignCheck({ research, preservationPacket, preservationReadiness, blockers }) {
  if (research.previewability?.status === 'blocked_unreachable') {
    return {
      id: REDESIGN_CHECK_DECISIONS.BLOCKED_UNREACHABLE,
      reason: 'No reachable contact path exists, so redesign work should stop here.',
    };
  }
  if (research.buildMode === BUILD_MODES.OUTREACH_ONLY) {
    return {
      id: REDESIGN_CHECK_DECISIONS.OUTREACH_ONLY,
      reason: 'This lead should be contacted before any redesign work is prepared.',
    };
  }
  if (research.buildMode !== BUILD_MODES.REDESIGN) {
    return {
      id: REDESIGN_CHECK_DECISIONS.NOT_APPLICABLE,
      reason: 'This lead is not currently in redesign mode.',
    };
  }
  if (!preservationPacket) {
    return {
      id: REDESIGN_CHECK_DECISIONS.MANUAL_REVIEW,
      reason: 'Preservation evidence is missing, so the redesign case needs one manual pass.',
    };
  }
  if (blockers.length) {
    return {
      id: REDESIGN_CHECK_DECISIONS.MANUAL_REVIEW,
      reason: 'The redesign opportunity is real, but preservation still has blockers to resolve.',
    };
  }
  return {
    id: REDESIGN_CHECK_DECISIONS.REDESIGN_PREVIEW,
    reason: research.productionReadiness?.status === 'ready_for_open_design'
      ? 'The redesign packet preserves the core site and is ready for a stronger replacement preview.'
      : 'The redesign opportunity is strong enough for a preview, even though production handoff still needs another research pass.',
  };
}

function buildCurrentSiteSummary(packet) {
  return {
    sourceWebsiteUrl: packet?.sourceWebsiteUrl || '',
    currentPageCount: packet?.currentSitemap?.length || 0,
    proposedPageCount: packet?.proposedSitemap?.length || 0,
    mustKeepPageCount: (packet?.currentSitemap || []).filter((item) => item.importance === 'must_keep').length,
  };
}

function buildPreservationSummary(packet) {
  if (!packet) return null;
  return {
    readiness: packet.readiness?.status || '',
    keepSameUrlCount: packet.urlPreservation?.keepSameUrl?.length || 0,
    redirectCount: packet.urlPreservation?.redirects301?.length || 0,
    manualRedirectReviewCount: packet.urlPreservation?.needsManualRedirectReview?.length || 0,
    missingBrandAssets: packet.brandAssets?.needsConfirmation || [],
  };
}

function inferRedesignValue({ family, research, preservationPacket }) {
  const values = [];
  const problemType = research.openDesignHandoffDraft?.strategy?.problemType || '';
  const websiteUrl = preservationPacket?.sourceWebsiteUrl || research.facts?.verified?.websiteUrl || '';
  if (websiteUrl) values.push('Make the current site feel more credible than the existing version.');
  if (problemType === 'missing_conversion_path') values.push('Clarify the next step so mobile visitors can act faster.');
  if (problemType === 'missing_trust_signal') values.push('Add trust signals that match how people choose this kind of business.');
  if (problemType === 'weak_website' || problemType === 'mismatch_website') values.push('Make the offer easier to understand at a glance.');

  switch (family.id) {
    case 'field_service':
      values.push('Show service coverage, fast response, and quote intent more clearly.');
      values.push('Turn phone or quote actions into the dominant path on mobile.');
      break;
    case 'professional_service':
      values.push('Make expertise, credibility, and consultation intent feel immediate.');
      values.push('Reduce ambiguity around what the firm actually helps with.');
      break;
    case 'clinic':
      values.push('Strengthen patient trust and make booking feel calmer and clearer.');
      break;
    case 'studio_or_visual':
      values.push('Let visual proof and booking flow do more of the selling.');
      break;
    case 'venue':
      values.push('Help atmosphere and enquiry intent land faster than the current site.');
      break;
    default:
      values.push('Give the business a clearer first impression and a cleaner path to action.');
      break;
  }

  return uniqueStrings(values).slice(0, 5);
}

function inferUpgradeTargets({ family, research, preservationPacket }) {
  const targets = uniqueStrings([
    ...(research.openDesignHandoffDraft?.redesign?.upgradeTargets || []),
  ]);

  switch (family.id) {
    case 'field_service':
      targets.push('service-area clarity', 'quote or call CTA', 'mobile trust strip', 'project proof');
      break;
    case 'professional_service':
      targets.push('practice-area clarity', 'consultation CTA', 'credentials framing', 'trust hierarchy');
      break;
    case 'clinic':
      targets.push('treatment hierarchy', 'booking CTA', 'team credibility', 'trust-first hero');
      break;
    case 'studio_or_visual':
      targets.push('gallery quality', 'booking CTA', 'social proof rhythm', 'visual hierarchy');
      break;
    case 'venue':
      targets.push('venue highlights', 'gallery pacing', 'enquiry CTA', 'capacity/logistics clarity');
      break;
    default:
      targets.push('hero clarity', 'CTA path', 'trust presentation', 'mobile usability');
      break;
  }

  if ((preservationPacket?.urlPreservation?.redirects301 || []).length) targets.push('URL migration clarity');
  return uniqueStrings(targets).slice(0, 6);
}

function buildOutreachAngle({ family, research }) {
  const observation = firstString(
    research.openDesignHandoffDraft?.outreach?.specificObservation,
    research.openDesignHandoffDraft?.outreach?.diagnosis
  );
  return {
    hook: firstString(
      research.openDesignHandoffDraft?.outreach?.coldMessageAngle,
      defaultHookForFamily(family)
    ),
    observation,
    diagnosis: firstString(
      research.openDesignHandoffDraft?.outreach?.diagnosis,
      'The current site likely undersells the real business and makes the next step weaker than it needs to be.'
    ),
  };
}

function defaultHookForFamily(family) {
  switch (family.id) {
    case 'field_service':
      return 'I mocked up a version that makes the service area, trust, and quote path much clearer on mobile.';
    case 'professional_service':
      return 'I mocked up a version that makes the offer clearer and the consultation step feel more credible.';
    case 'clinic':
      return 'I mocked up a version that helps patients understand the offer and book with less friction.';
    case 'studio_or_visual':
      return 'I mocked up a version that lets the work and booking path sell more naturally.';
    case 'venue':
      return 'I mocked up a version that makes the venue feel stronger and the enquiry step more immediate.';
    default:
      return 'I mocked up a version that makes the business clearer and the next step easier to take.';
  }
}

function inferRiskLevel({ decision, blockers, warnings }) {
  if (decision === REDESIGN_CHECK_DECISIONS.BLOCKED_UNREACHABLE) return 'high';
  if (decision === REDESIGN_CHECK_DECISIONS.MANUAL_REVIEW) return blockers.length ? 'high' : 'medium';
  if (warnings.length) return 'medium';
  return 'low';
}

function normalizeBlockers(blockers, research) {
  return blockers.filter((item) => {
    if (item === 'business name missing' && research.facts?.verified?.businessName) return false;
    if (item === 'no customer contact or CTA method found' && research.contactability?.status === 'reachable') return false;
    return true;
  });
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
