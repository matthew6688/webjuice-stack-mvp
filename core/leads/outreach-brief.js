import { createLeadResearch } from './research.js';
import { createRedesignCheck, REDESIGN_CHECK_DECISIONS } from './redesign-check.js';
import { BUILD_MODES } from './intake.js';
import { inferNicheFamily } from '../niches/families.js';

export function createOutreachBrief(input = {}) {
  const research = input.research || createLeadResearch(input);
  const redesignCheck = input.redesignCheck || createRedesignCheck({ research });
  const family = inferNicheFamily(research.facts?.verified?.industry || research.niche || '');
  const businessName = research.facts?.verified?.businessName || research.clientSlug;
  const city = research.facts?.verified?.city || '';
  const industry = research.facts?.verified?.industry || research.niche || 'local business';
  const previewMode = inferPreviewMode(research, redesignCheck);
  const channelRecommendation = recommendChannel({ family, research });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clientSlug: research.clientSlug,
    niche: research.niche,
    familyId: family.id,
    buildMode: research.buildMode,
    previewMode,
    outreachReady: research.previewability?.status !== 'blocked_unreachable',
    diagnosis: buildDiagnosis({ businessName, research, redesignCheck, family }),
    siteBrief: buildSiteBrief({ businessName, city, industry, research, redesignCheck, family }),
    coldMessage: buildColdMessage({ businessName, city, research, redesignCheck }),
    followUps: buildFollowUps({ businessName, family, research, redesignCheck }),
    channelRecommendation,
    subjectLines: buildSubjectLines(businessName),
    proofPoints: buildProofPoints({ research, redesignCheck, family }),
  };
}

function inferPreviewMode(research, redesignCheck) {
  if (research.buildMode === BUILD_MODES.OUTREACH_ONLY) return 'outreach_only';
  if (research.buildMode === BUILD_MODES.TEASER) return 'teaser';
  if (redesignCheck.decision === REDESIGN_CHECK_DECISIONS.REDESIGN_PREVIEW) return 'redesign_preview';
  if (research.buildMode === BUILD_MODES.STARTER) return 'starter_preview';
  return 'research_only';
}

function buildDiagnosis({ businessName, research, redesignCheck, family }) {
  const diagnosis = firstString(
    redesignCheck.outreachAngle?.diagnosis,
    research.openDesignHandoffDraft?.outreach?.diagnosis
  );
  const valueLines = (redesignCheck.redesignValue || []).slice(0, 2);
  return compactSentence([diagnosis, ...valueLines, defaultValueLine(family)].filter(Boolean).join(' '));
}

function buildSiteBrief({ businessName, city, industry, research, redesignCheck, family }) {
  const heroAngle = research.openDesignHandoffDraft?.strategy?.heroAngle || `${businessName} deserves a clearer first impression online.`;
  const services = (research.openDesignHandoffDraft?.strategy?.coreServices || []).slice(0, 3);
  const tone = research.openDesignHandoffDraft?.strategy?.tone || family.tones?.default || 'clear, human, locally credible';
  const cta = normalizeSiteBriefCta(research.openDesignHandoffDraft?.strategy?.primaryCTA, family);
  const designChoice = (research.openDesignHandoffDraft?.strategy?.designDirection || [])[0] || 'calm hierarchy';
  return compactSentence(
    `${businessName} is a ${industry} ${city ? `in ${city}` : ''}. Lead with ${heroAngle} Highlight ${services.join(', ') || 'the core offer'}. Keep the tone ${tone}. The main CTA should be ${cta}. One design choice that should stand out is ${designChoice}.`
  );
}

function buildColdMessage({ businessName, city, research, redesignCheck }) {
  const firstName = firstWord(businessName);
  const observation = firstString(
    redesignCheck.outreachAngle?.observation,
    research.openDesignHandoffDraft?.outreach?.specificObservation,
    research.openDesignHandoffDraft?.outreach?.diagnosis
  );
  const hook = firstString(
    redesignCheck.outreachAngle?.hook,
    'I mocked up a quick version that makes the offer clearer and the next step easier.'
  );
  return compactSentence(
    `Hey ${firstName}, I looked at ${businessName}${city ? ` in ${city}` : ''}. ${observation} ${hook} Happy to send the mockup if you want to see it.`
  );
}

function buildFollowUps({ family, research, redesignCheck }) {
  const firstGap = redesignCheck.upgradeTargets?.[0] || 'the next step';
  const secondGap = redesignCheck.upgradeTargets?.[1] || defaultCompetitorGap(family);
  return [
    compactSentence(`Quick follow-up: the clearest gap I noticed is ${firstGap}. I can send over the mockup if it would help.`),
    compactSentence(`One more thought: nearby competitors usually do a better job showing ${secondGap}. I already mocked up a tighter version if you want to compare it.`),
  ];
}

function recommendChannel({ family, research }) {
  const hasEmail = (research.facts?.verified?.emails || []).length > 0;
  const hasPhone = (research.facts?.verified?.phones || []).length > 0;
  const hasSocial = (research.facts?.verified?.socialDm || []).length > 0;

  if (family.id === 'field_service' && hasPhone) return 'sms_or_call';
  if (family.id === 'studio_or_visual' && hasSocial) return 'instagram_dm';
  if (family.id === 'professional_service') return hasEmail ? 'email' : hasPhone ? 'call' : 'manual_review';
  if (family.id === 'venue') return hasEmail ? 'email' : hasSocial ? 'social_dm' : 'manual_review';
  if (hasEmail) return 'email';
  if (hasPhone) return 'call';
  if (hasSocial) return 'social_dm';
  return 'manual_review';
}

function buildSubjectLines(businessName) {
  return [
    `Built something for ${businessName}`,
    `Quick mockup for ${businessName}`,
    `Saw your listing and made this for ${businessName}`,
  ];
}

function buildProofPoints({ research, redesignCheck, family }) {
  const facts = research.facts?.verified || {};
  const proofs = [
    facts.websiteUrl ? 'Current website reviewed' : '',
    facts.googleMapsUrl ? 'Google listing / map path captured' : '',
    facts.emails?.length ? 'Direct contact route found' : '',
    redesignCheck.upgradeTargets?.[0] ? `Main improvement angle: ${redesignCheck.upgradeTargets[0]}` : '',
    family.id === 'field_service' ? 'Service-area and quote path can be made clearer on mobile' : '',
  ];
  return proofs.filter(Boolean).slice(0, 4);
}

function normalizeSiteBriefCta(cta, family) {
  if (cta && !/email for details/i.test(cta)) return cta;
  switch (family.id) {
    case 'field_service':
      return 'Request a quote';
    case 'professional_service':
      return 'Book a consultation';
    case 'clinic':
      return 'Book an appointment';
    case 'studio_or_visual':
      return 'Book or enquire';
    case 'venue':
      return 'Send an enquiry';
    default:
      return cta || 'Get in touch';
  }
}

function defaultValueLine(family) {
  switch (family.id) {
    case 'field_service':
      return 'The biggest revenue leak is usually weak quote intent and unclear trust on mobile.';
    case 'professional_service':
      return 'The biggest leak is usually credibility and consultation friction.';
    case 'clinic':
      return 'The biggest leak is usually trust and booking friction.';
    default:
      return 'The biggest leak is usually unclear positioning and a weak next step.';
  }
}

function defaultCompetitorGap(family) {
  switch (family.id) {
    case 'field_service':
      return 'service area and quote clarity';
    case 'professional_service':
      return 'practice area clarity';
    case 'clinic':
      return 'booking clarity';
    default:
      return 'a clearer next step';
  }
}

function compactSentence(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s([,.!?;:])/g, '$1')
    .trim();
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstWord(value) {
  return String(value || 'there').split(/\s+/)[0].replace(/[^A-Za-z0-9'&-]/g, '') || 'there';
}
