import path from 'path';
import { BUILD_MODES } from './intake.js';
import { createLeadResearch } from './research.js';
import { buildWebsiteReady, READINESS } from '../intake/website-ready.js';

export const BUILD_READY_STATUS = {
  READY_FOR_OPEN_DESIGN: 'ready_for_open_design',
  READY_FOR_TEASER: 'ready_for_teaser',
  OUTREACH_ONLY: 'outreach_only',
  NEEDS_MORE_RESEARCH: 'needs_more_research',
  BLOCKED_UNREACHABLE: 'blocked_unreachable',
  NEEDS_CONFIRMATION: 'needs_customer_confirmation',
  BLOCKED_CONFLICTS: 'blocked_conflicting_evidence',
};

export function createBuildReadyDecision(input = {}) {
  const research = input.research || createLeadResearch(input);
  const clientSlug = research.clientSlug;
  const niche = input.niche || research.niche || 'generic';

  if (research.previewability.status === 'blocked_unreachable') {
    return baseDecision(research, BUILD_READY_STATUS.BLOCKED_UNREACHABLE, 'No reachable contact path exists.');
  }

  if (research.buildMode === BUILD_MODES.OUTREACH_ONLY) {
    return baseDecision(research, BUILD_READY_STATUS.OUTREACH_ONLY, 'Send outreach first before any build.');
  }

  if (research.buildMode === BUILD_MODES.TEASER && research.productionReadiness.status !== 'ready_for_open_design') {
    return {
      ...baseDecision(research, BUILD_READY_STATUS.READY_FOR_TEASER, 'Build a teaser preview with placeholders.'),
      buildPacket: {
        mode: 'teaser',
        nextAction: 'Generate a teaser demo and outreach assets, then wait for reply.',
        openDesignReady: false,
      },
    };
  }

  if (research.productionReadiness.status !== 'ready_for_open_design') {
    return baseDecision(
      research,
      BUILD_READY_STATUS.NEEDS_MORE_RESEARCH,
      research.productionReadiness.reason || 'Research still needs one more pass before build handoff.'
    );
  }

  if (niche !== 'restaurant') {
    return {
      ...baseDecision(research, BUILD_READY_STATUS.READY_FOR_OPEN_DESIGN, 'Cross-industry packet is ready for design handoff.'),
      buildPacket: {
        mode: research.buildMode,
        nextAction: 'Use the Open Design handoff draft directly for the next build module.',
        openDesignReady: true,
      },
    };
  }

  const websiteReady = buildWebsiteReady({
    clientSlug,
    niche,
    route: input.route || 'website',
    sourceType: normalizeSourceType(research.sourceType),
    customerConfirmed: input.customerConfirmed ?? input.confirmed,
    evidencePath: input.evidencePath || path.join('clients', clientSlug, 'evidence', 'evidence.json'),
    contentPath: input.contentPath || path.join('clients', clientSlug, 'content.restaurant.json'),
    designPath: input.designPath || path.join('clients', clientSlug, 'design.restaurant.json'),
    brandSpecPath: input.brandSpecPath || path.join('clients', clientSlug, 'brand-spec.md'),
    checkoutPath: input.checkoutPath || path.join('clients', clientSlug, 'funnel', 'checkout.json'),
    casePath: input.casePath || '',
    taskPath: input.taskPath || '',
    paidIntakePath: input.paidIntakePath || '',
    surveyPath: input.surveyPath || path.join('clients', clientSlug, 'intake', 'website-survey.json'),
    buildPacketPath: input.buildPacketPath || path.join('clients', clientSlug, 'intake', 'build-packet.md'),
  });

  return {
    ...baseDecision(
      research,
      mapWebsiteReadyStatus(websiteReady.survey.readiness),
      websiteReady.survey.nextAction
    ),
    websiteReady: {
      readyToBuild: websiteReady.survey.readyToBuild,
      readiness: websiteReady.survey.readiness,
      survey: websiteReady.survey,
      paths: websiteReady.paths,
    },
    buildPacket: {
      mode: research.buildMode,
      nextAction: websiteReady.survey.nextAction,
      openDesignReady: websiteReady.survey.readyToBuild,
    },
  };
}

function baseDecision(research, status, reason) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clientSlug: research.clientSlug,
    niche: research.niche,
    buildMode: research.buildMode,
    status,
    reason,
    previewability: research.previewability,
    productionReadiness: research.productionReadiness,
    contactability: research.contactability,
    openDesignHandoffDraft: research.openDesignHandoffDraft,
  };
}

function normalizeSourceType(sourceType) {
  if (sourceType === 'website_inbound') return 'inbound';
  if (sourceType === 'provider_reply') return 'manual';
  if (sourceType === 'imported_list' || sourceType === 'referral') return 'manual';
  return sourceType || 'manual';
}

function mapWebsiteReadyStatus(readiness) {
  switch (readiness) {
    case READINESS.READY:
      return BUILD_READY_STATUS.READY_FOR_OPEN_DESIGN;
    case READINESS.NEEDS_CONFIRMATION:
      return BUILD_READY_STATUS.NEEDS_CONFIRMATION;
    case READINESS.BLOCKED_CONFLICTS:
      return BUILD_READY_STATUS.BLOCKED_CONFLICTS;
    default:
      return BUILD_READY_STATUS.NEEDS_MORE_RESEARCH;
  }
}
