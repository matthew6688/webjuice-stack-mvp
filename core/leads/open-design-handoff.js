import { createLeadCopyBrief } from './copy-brief.js';
import { matchTemplateFamily } from './template-match.js';

export function createTemplateOpenDesignHandoff(input = {}) {
  const templateMatch = input.templateMatch || matchTemplateFamily(input);
  const copyBrief = input.copyBrief || createLeadCopyBrief({
    ...input,
    templateMatch,
  });
  const selected = templateMatch.selected || {};
  const handoff = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    type: 'template_open_design_handoff',
    clientSlug: copyBrief.clientSlug || input.clientSlug || '',
    selectedTemplate: selected,
    copyBriefPath: input.copyBriefPath || '',
    templateMatchPath: input.templateMatchPath || '',
    prompt: buildPrompt({ templateMatch, copyBrief }),
    json: {
      templateFamilyManifest: selected.manifestPath || '',
      templateFamily: selected,
      copyBrief,
      guardrails: {
        useVerifiedFactsExactly: copyBrief.factLock.mustKeepExact,
        neverInvent: copyBrief.factLock.mustNotInvent,
        customerVisibleLabelsForbidden: copyBrief.provenance.frontendMustNotExpose,
        generatedDemoContentIsAllowed: copyBrief.factLock.canGenerateForDemo,
      },
      qualityGate: ['ui-audit', 'copy-audit', 'mobile-audit', 'seo-basic-audit', 'fact-safety-audit'],
      runRequirements: {
        nativeCleanFinishRequired: true,
        artifactQuietFallbackIsRescueOnly: true,
        mobileFirstClass: true,
        recordQuestionFormAnswers: true,
      },
    },
  };
  return handoff;
}

function buildPrompt({ templateMatch, copyBrief }) {
  const selected = templateMatch.selected || {};
  const verified = copyBrief.verifiedFacts || {};
  const plan = copyBrief.pageCopyPlan || {};
  const lines = [
    'Build a local-business website mockup using the approved niche template workflow.',
    '',
    'Template family:',
    `- Use: ${selected.displayName || selected.family || 'selected family'}`,
    `- Manifest: ${selected.manifestPath || 'n/a'}`,
    '- Preserve the family design language, section rhythm, image style, and conversion pattern.',
    '',
    'Verified facts to preserve exactly:',
    `- Business name: ${verified.businessName || 'missing'}`,
    `- Phone: ${(verified.phones || []).join(', ') || 'missing'}`,
    `- Email: ${(verified.emails || []).join(', ') || 'missing'}`,
    `- Address: ${verified.address || 'missing'}`,
    `- Website: ${verified.websiteUrl || 'missing'}`,
    '',
    'Generated demo content policy:',
    '- The customer-facing page must look complete and natural.',
    '- Do not print labels like placeholder, inferred, generated, audit, or Open Design on the frontend.',
    '- It is okay to use generated demo copy for services, FAQ, process, benefits, CTA labels, and demo proof modules.',
    '- Do not claim real reviews, licences, awards, exact years, prices, warranties, or project counts unless provided as verified facts.',
    '',
    'Copy plan:',
    `- Hero angle: ${plan.heroAngle || ''}`,
    `- Hero headline: ${plan.heroHeadline || ''}`,
    `- Hero subcopy: ${plan.heroSubcopy || ''}`,
    `- Primary CTA: ${plan.primaryCta || ''}`,
    `- Secondary CTA: ${plan.secondaryCta || ''}`,
    `- Services: ${(plan.services || []).map((item) => item.name || item).join(', ')}`,
    `- Proof strategy: ${plan.proofStrategy?.summary || plan.proofStrategy || ''}`,
    `- Final CTA: ${plan.finalCta?.text || plan.finalCta || ''}`,
    '',
    'Requirements:',
    '- Make mobile first-class, not an afterthought.',
    '- Include clear CTA/contact path.',
    '- Include LocalBusiness-ready content structure.',
    '- Use selected template images/assets if provided.',
    '- Output real HTML/CSS assets and screenshots for QA.',
  ];
  return lines.join('\n');
}

