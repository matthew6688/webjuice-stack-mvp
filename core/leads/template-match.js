import fs from 'fs';
import path from 'path';

const DEFAULT_TEMPLATE_ROOT = 'templates';

export function matchTemplateFamily(input = {}) {
  const root = input.root || process.cwd();
  const niche = normalizeId(input.niche || input.research?.niche || input.lead?.niche || input.industry || 'generic');
  const families = input.families || listTemplateFamilies({ root, niche });
  const lead = normalizeLead(input);
  const allowInternal = Boolean(input.allowInternal || input.internal || input.allowDraft);
  const scored = families
    .map((family) => scoreFamily({ family, lead, allowInternal }))
    .sort((a, b) => b.score - a.score);
  const eligible = scored.filter((item) => item.eligible);
  const selected = eligible[0] || scored[0] || null;
  const confidence = selected ? Math.max(0.35, Math.min(0.96, selected.score / 100)) : 0;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    niche,
    lead: {
      clientSlug: lead.clientSlug,
      businessName: lead.businessName,
      industry: lead.industry,
      leadType: lead.leadType,
      buildMode: lead.buildMode,
      services: lead.services,
      hasWebsite: Boolean(lead.websiteUrl),
      hasRealContactPath: Boolean(lead.phones.length || lead.emails.length || lead.contactPageUrl || lead.socialAccounts.length),
    },
    policy: {
      allowInternal,
      publicUseRequiresApproved: true,
      reason: allowInternal
        ? 'Internal mode can use qa-ready/open-design-generated families for experimentation.'
        : 'Production matching only recommends approved or published families.',
    },
    selected: selected ? summarizeScoredFamily(selected) : null,
    confidence,
    reason: selected ? selected.reasons.join(' ') : 'No template families found.',
    rejectedFamilies: scored
      .filter((item) => !selected || item.family.family !== selected.family.family)
      .map(summarizeScoredFamily),
  };
}

export function listTemplateFamilies({ root = process.cwd(), niche = 'roofing' } = {}) {
  const familyRoot = path.join(root, DEFAULT_TEMPLATE_ROOT, normalizeId(niche), 'families');
  if (!fs.existsSync(familyRoot)) return [];
  return fs.readdirSync(familyRoot)
    .sort()
    .map((familyId) => {
      const manifestPath = path.join(familyRoot, familyId, 'template-manifest.json');
      if (!fs.existsSync(manifestPath)) return null;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return {
        manifestPath: path.relative(root, manifestPath),
        familyDir: path.relative(root, path.dirname(manifestPath)),
        templateId: manifest.templateId || `${niche}/${familyId}`,
        family: manifest.family || familyId,
        niche: manifest.niche || niche,
        displayName: manifest.displayName || titleize(familyId),
        status: manifest.status || 'draft',
        approved: Boolean(manifest.qa?.approved),
        qaScore: typeof manifest.qa?.score === 'number' ? manifest.qa.score : null,
        fit: manifest.fit || {},
        factsPolicy: manifest.factsPolicy || {},
        selectedImages: manifest.selectedImages || {},
        openDesign: manifest.openDesign || {},
        designContractPath: manifest.designContract?.path || '',
        copyAudit: manifest.copyAudit || null,
      };
    })
    .filter(Boolean);
}

function scoreFamily({ family, lead, allowInternal }) {
  const reasons = [];
  const penalties = [];
  let score = 0;
  const approvedLike = family.approved || family.status === 'published' || family.status === 'approved';
  const internalReady = family.status === 'qa-ready' || family.status === 'open-design-generated';
  const eligible = approvedLike || (allowInternal && internalReady);

  if (approvedLike) {
    score += 25;
    reasons.push('family is approved/published');
  } else if (allowInternal && internalReady) {
    score += 12;
    reasons.push('family is available for internal experimentation');
  } else {
    penalties.push('not approved for production use');
    score -= 20;
  }

  if (Number.isFinite(family.qaScore)) {
    score += Math.min(12, Math.round(family.qaScore / 10));
    reasons.push(`qa score ${family.qaScore}`);
  }

  const haystack = [
    family.family,
    family.displayName,
    ...(family.fit.subNiches || []),
    ...(family.fit.bestFor || []),
    ...(family.fit.priceTiers || []),
  ].join(' ').toLowerCase();
  const notFor = (family.fit.notFor || []).join(' ').toLowerCase();
  const leadWords = [
    lead.leadType,
    lead.buildMode,
    lead.industry,
    ...lead.services,
    lead.websiteUrl ? 'website redesign existing site' : 'no website low info',
    lead.phones.length ? 'phone first fast quote' : '',
  ].join(' ').toLowerCase();

  for (const service of lead.services) {
    if (haystack.includes(service.toLowerCase())) {
      score += 8;
      reasons.push(`matches service "${service}"`);
    }
  }

  if (/commercial|industrial|metal/.test(leadWords) && /commercial|metal|bold/.test(haystack)) {
    score += 24;
    reasons.push('matches commercial/metal/bold lead');
  }
  if (/restoration|repair|gutter|pressure|low info|phone first|no website/.test(leadWords) && /restoration|repair|lead capture|low-info|phone/.test(haystack)) {
    score += 26;
    reasons.push('matches low-info or repair/restoration lead');
  }
  if (/redesign|existing site|website/.test(leadWords) && /premium|redesign|gallery|established/.test(haystack)) {
    score += 18;
    reasons.push('matches redesign or established website lead');
  }
  if (/inspection|material|solar|bundle|product|system/.test(leadWords) && /material|product|inspection|system|bundle/.test(haystack)) {
    score += 20;
    reasons.push('matches productized/materials service structure');
  }
  if (/teaser|one_page|starter/.test(lead.buildMode) && /one-page|lead capture|fast/.test(haystack)) {
    score += 10;
    reasons.push('fits one-page/starter build mode');
  }
  if (/multi|premium|standard/.test(lead.buildMode) && /standard|premium|multi-page|gallery/.test(haystack)) {
    score += 8;
    reasons.push('fits standard/premium build mode');
  }

  for (const service of lead.services) {
    if (notFor.includes(service.toLowerCase())) {
      score -= 12;
      penalties.push(`notFor conflicts with "${service}"`);
    }
  }
  if (/low-info|only a phone|tiny local repair/.test(notFor) && lead.isLowInfo) {
    score -= 20;
    penalties.push('family explicitly rejects low-info leads');
  }
  if (/phone-first conversion/.test(notFor) && lead.phones.length && !lead.websiteUrl) {
    score -= 10;
    penalties.push('family is weaker for phone-first no-website leads');
  }

  if (!reasons.length) reasons.push('generic fallback match');
  return {
    family,
    eligible,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    penalties,
  };
}

function summarizeScoredFamily(item) {
  return {
    templateId: item.family.templateId,
    family: item.family.family,
    displayName: item.family.displayName,
    status: item.family.status,
    approved: item.family.approved,
    eligible: item.eligible,
    score: item.score,
    reasons: item.reasons,
    penalties: item.penalties,
    manifestPath: item.family.manifestPath,
    familyDir: item.family.familyDir,
    designContractPath: item.family.designContractPath,
    selectedImages: item.family.selectedImages,
  };
}

function normalizeLead(input) {
  const research = input.research || {};
  const readyDecision = input.readyDecision || {};
  const verified = research.facts?.verified || input.verifiedFacts || {};
  const inferred = research.facts?.inferred || input.inferredFacts || {};
  const contact = readyDecision.websiteBuildHandoff?.content ? readyDecision.websiteBuildHandoff?.openDesignPayload?.json?.contact : {};
  const services = uniqueStrings([
    ...(input.services || []),
    ...(verified.services || []),
    ...(inferred.coreServices || []),
    ...(readyDecision.websiteBuildHandoff?.content?.services || []).map((item) => item.name || item),
  ]).filter(Boolean);
  const phones = uniqueStrings([input.phone, ...(input.phones || []), ...(verified.phones || []), ...(contact?.phones || [])]);
  const emails = uniqueStrings([input.email, ...(input.emails || []), ...(verified.emails || []), ...(contact?.emails || [])]);
  const websiteUrl = firstString(input.websiteUrl, verified.websiteUrl, contact?.websiteUrl);
  return {
    clientSlug: input.clientSlug || research.clientSlug || readyDecision.clientSlug || '',
    businessName: firstString(input.businessName, verified.businessName, readyDecision.websiteBuildHandoff?.business?.name, 'Local Business'),
    industry: firstString(input.industry, verified.industry, research.niche, readyDecision.niche, 'local business'),
    leadType: normalizeId(input.leadType || inferLeadType({ websiteUrl, services, phones })),
    buildMode: normalizeId(input.buildMode || research.buildMode || readyDecision.buildMode || readyDecision.websiteBuildHandoff?.business?.buildMode || 'teaser'),
    services,
    phones,
    emails,
    websiteUrl,
    contactPageUrl: firstString(input.contactPageUrl, verified.contactPageUrl, contact?.contactPageUrl),
    socialAccounts: input.socialAccounts || verified.socialDm || [],
    isLowInfo: !websiteUrl && services.length <= 3,
  };
}

function inferLeadType({ websiteUrl, services, phones }) {
  const serviceText = services.join(' ').toLowerCase();
  if (websiteUrl) return 'redesign';
  if (/emergency|repair|restoration|gutter|pressure/.test(serviceText)) return 'emergency_service';
  if (phones?.length) return 'no_website_phone_first';
  return 'low_info';
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleize(value) {
  return String(value || '').split(/[-_\s]+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}
