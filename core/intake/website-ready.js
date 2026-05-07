import fs from 'fs';
import path from 'path';
import { defaultEvidencePath, loadEvidencePack, validateEvidencePack } from '../evidence/evidence.js';
import { artifactTimestamp } from '../time.js';
import { validateRestaurantContent } from '../../niches/restaurant/adapter.js';
import { validateRestaurantDesignBrief } from '../design/restaurant-brief.js';

export const READINESS = {
  READY: 'website_ready_to_build',
  NEEDS_CONFIRMATION: 'needs_customer_confirmation',
  NEEDS_INFO: 'needs_more_info',
  BLOCKED_CONFLICTS: 'blocked_conflicting_evidence',
};

const CUSTOMER_CONFIRMATION_SOURCES = new Set(['paid_intake', 'inbound']);
const REQUIRED_CORE_FIELDS = [
  ['businessName', 'Business name'],
  ['contact.addressOrServiceArea', 'Address or service area'],
  ['contact.primaryContact', 'At least one contact method'],
  ['offer.primary', 'Primary website offer/content'],
  ['design.direction', 'Design direction or brand context'],
];

export function buildWebsiteReady(input = {}) {
  const clientSlug = input.clientSlug || clientSlugFromPath(input.evidencePath || '');
  if (!clientSlug) throw new Error('clientSlug is required');

  const evidencePath = input.evidencePath || defaultEvidencePath(clientSlug);
  const contentPath = input.contentPath || path.join('clients', clientSlug, 'content.restaurant.json');
  const designPath = input.designPath || path.join('clients', clientSlug, 'design.restaurant.json');
  const brandSpecPath = input.brandSpecPath || path.join('clients', clientSlug, 'brand-spec.md');
  const checkoutPath = input.checkoutPath || path.join('clients', clientSlug, 'funnel', 'checkout.json');
  const surveyPath = input.surveyPath || path.join('clients', clientSlug, 'intake', 'website-survey.json');
  const buildPacketPath = input.buildPacketPath || path.join('clients', clientSlug, 'intake', 'build-packet.md');

  const evidence = loadEvidencePack(evidencePath);
  const evidenceValidation = validateEvidencePack(evidence, { niche: input.niche || evidence.niche });
  const resolved = evidenceValidation.resolved || evidence.resolved || {};
  const content = readJsonIfExists(contentPath);
  const design = readJsonIfExists(designPath);
  const checkout = readJsonIfExists(checkoutPath);
  const caseFile = readJsonIfExists(input.casePath);
  const paidIntake = readJsonIfExists(input.paidIntakePath);
  const task = readJsonIfExists(input.taskPath);

  const sourceType = input.sourceType || input.source || inferSourceType({ paidIntake, caseFile });
  const niche = input.niche || evidence.niche || content?.niche || 'restaurant';
  const customerConfirmed = booleanFrom(input.customerConfirmed ?? input.confirmed ?? input.confirm);
  const route = input.route || 'website';
  const framework = frameworkContract({ niche, route, clientSlug });

  const survey = {
    schemaVersion: 1,
    clientSlug,
    niche,
    route,
    sourceType,
    generatedAt: artifactTimestamp(),
    readiness: null,
    readyToBuild: false,
    customerConfirmationRequired: CUSTOMER_CONFIRMATION_SOURCES.has(sourceType),
    customerConfirmed,
    businessName: firstString(
      input.businessName,
      content?.hero?.name,
      evidence.businessName,
      valueAt(resolved, 'identity.name'),
      paidIntake?.customer?.company,
      caseFile?.customer?.company,
    ),
    contact: buildContact({ resolved, content }),
    offer: buildOffer({ resolved, content, niche, route }),
    design: buildDesign({ resolved, content, design, brandSpecPath }),
    assets: buildAssets({ resolved, content, design }),
    evidence: {
      path: evidencePath,
      validation: {
        ok: evidenceValidation.ok,
        errors: evidenceValidation.errors || [],
        warnings: evidenceValidation.warnings || [],
      },
      sourceCount: Array.isArray(evidence.items) ? evidence.items.length : 0,
      sources: evidenceSources(evidence.items || []),
      conflicts: evidenceConflicts(evidence.items || []),
    },
    artifacts: validateArtifacts({ niche, content, design }),
    framework,
    sourceOfTruth: {
      evidence: relativize(evidencePath),
      content: relativize(contentPath),
      design: relativize(designPath),
      brandSpec: relativize(brandSpecPath),
      checkout: relativize(checkoutPath),
      websiteSurvey: relativize(surveyPath),
      buildPacket: relativize(buildPacketPath),
      case: relativize(input.casePath || caseFile?.paths?.casePath || ''),
      task: relativize(input.taskPath || task?.path || ''),
    },
    case: caseFile ? {
      id: caseFile.caseId,
      status: caseFile.status,
      orderId: caseFile.order?.id || '',
      repo: caseFile.repo || '',
      previewUrl: caseFile.previewUrl || '',
      discordThreadId: caseFile.discord?.websiteTaskThreadId || caseFile.discord?.salesThreadId || '',
    } : null,
    missing: [],
    warnings: [],
    decisions: [],
    nextAction: '',
  };

  const assessment = assessReadiness(survey);
  Object.assign(survey, assessment);

  const buildPacket = renderBuildPacket(survey);
  return {
    ok: survey.readyToBuild,
    survey,
    buildPacket,
    paths: {
      surveyPath,
      buildPacketPath,
    },
  };
}

export function saveWebsiteReadyOutputs(result, { dryRun = false } = {}) {
  if (!result?.survey || !result?.buildPacket) throw new Error('website-ready result is required');
  if (!dryRun) {
    writeText(result.paths.surveyPath, `${JSON.stringify(result.survey, null, 2)}\n`);
    writeText(result.paths.buildPacketPath, result.buildPacket);
  }
  return result.paths;
}

export function renderBuildPacket(survey) {
  const lines = [
    `# Website Build Packet: ${survey.businessName || survey.clientSlug}`,
    '',
    `Generated: ${survey.generatedAt}`,
    `Client: ${survey.clientSlug}`,
    `Niche: ${survey.niche}`,
    `Route: ${survey.route}`,
    `Readiness: ${survey.readiness}`,
    `Next action: ${survey.nextAction}`,
    '',
    '## Build Contract',
    '',
    `- Template/framework: ${survey.framework.templateRepo} (${survey.framework.stack})`,
    `- Target repo: ${survey.framework.repo || '<assigned per client>'}`,
    `- Working branch: ${survey.framework.branch}`,
    `- Build command: ${survey.framework.buildCommand}`,
    `- Deploy route: ${survey.framework.deployRoute}`,
    `- Agent handoff: ${survey.framework.agentHandoff}`,
    '',
    '## Required Read Order',
    '',
    `1. ${survey.sourceOfTruth.websiteSurvey}`,
    `2. ${survey.sourceOfTruth.evidence}`,
    `3. ${survey.sourceOfTruth.content}`,
    `4. ${survey.sourceOfTruth.design}`,
    `5. ${survey.sourceOfTruth.brandSpec}`,
    `6. ${survey.sourceOfTruth.case || 'case file when present'}`,
    '',
    '## Business Facts',
    '',
    `- Name: ${survey.businessName || 'missing'}`,
    `- Address/service area: ${survey.contact.addressOrServiceArea || 'missing'}`,
    `- Phone: ${survey.contact.phone || 'missing'}`,
    `- Email: ${survey.contact.email || 'missing'}`,
    `- Website: ${survey.contact.website || 'missing'}`,
    `- Reservation/contact link: ${survey.contact.primaryCtaUrl || 'missing'}`,
    '',
    '## Offer / Content',
    '',
    `- Primary: ${survey.offer.primary || 'missing'}`,
    `- Menu/source: ${survey.offer.menuSource || 'missing'}`,
    `- Sections/services: ${survey.offer.sectionCount}`,
    '',
    '## Design Direction',
    '',
    `- Required skill: ${survey.framework.requiredDesignSkill}`,
    `- Direction: ${survey.design.direction || 'missing'}`,
    `- Palette: ${(survey.design.colors || []).join(', ') || 'missing'}`,
    `- Logo: ${survey.assets.logo || 'missing'}`,
    `- Primary photo: ${survey.assets.primaryPhoto || 'missing'}`,
    '',
    '## Guardrails',
    '',
    '- Website and menu are different products. Build a formal website only when route=website.',
    '- Use real evidence for address, phone, hours, menu, reservation links, logo, and photos.',
    '- Do not invent menu prices or business facts. Generated images are visual assets, not evidence.',
    '- Keep customer/order/payment/internal notes out of the public website repo.',
    '- Push implementation changes to dev first; publish live only after approval.',
    '- If work happens in Open Design, Codex, Claude Code, OpenCode, or another IDE, sync the final repo changes back before Discord/Hermes continues.',
    '',
    '## Missing / Decisions',
    '',
    ...(survey.missing.length ? survey.missing.map((item) => `- Missing: ${item}`) : ['- Missing: none']),
    ...(survey.warnings.length ? survey.warnings.map((item) => `- Warning: ${item}`) : []),
    ...(survey.decisions.length ? survey.decisions.map((item) => `- Decision: ${item}`) : []),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function assessReadiness(survey) {
  const missing = [];
  const warnings = [...survey.evidence.validation.warnings, ...survey.artifacts.warnings];
  const decisions = [];

  for (const [key, label] of REQUIRED_CORE_FIELDS) {
    if (!valueAt(survey, key)) missing.push(label);
  }
  if (!survey.evidence.validation.ok) {
    for (const error of survey.evidence.validation.errors) missing.push(`Evidence validation: ${error}`);
  }
  if (!survey.artifacts.ok) {
    for (const error of survey.artifacts.errors) missing.push(`Artifact validation: ${error}`);
  }
  if (survey.evidence.conflicts.length) {
    return {
      readiness: READINESS.BLOCKED_CONFLICTS,
      readyToBuild: false,
      missing,
      warnings,
      decisions: survey.evidence.conflicts.map((conflict) => `Resolve conflicting evidence for ${conflict.key}`),
      nextAction: 'Resolve evidence conflicts before any build work.',
    };
  }
  if (missing.length) {
    return {
      readiness: READINESS.NEEDS_INFO,
      readyToBuild: false,
      missing: unique(missing),
      warnings,
      decisions,
      nextAction: 'Collect missing source-of-truth fields, then rerun website-ready.',
    };
  }
  if (survey.customerConfirmationRequired && !survey.customerConfirmed) {
    decisions.push('Customer-originated paid/inbound projects need confirmation before first build.');
    return {
      readiness: READINESS.NEEDS_CONFIRMATION,
      readyToBuild: false,
      missing: [],
      warnings,
      decisions,
      nextAction: 'Send the survey summary to the customer or operator for confirmation.',
    };
  }
  return {
    readiness: READINESS.READY,
    readyToBuild: true,
    missing: [],
    warnings,
    decisions,
    nextAction: 'Create or continue the website task thread and build on dev.',
  };
}

function frameworkContract({ niche, route, clientSlug }) {
  const templateRepo = niche === 'restaurant' ? 'matthew6688/webjuice-restaurant' : `matthew6688/webjuice-${niche}`;
  return {
    stack: 'Astro + Cloudflare Pages + artifact-driven content/design JSON',
    templateRepo,
    repo: `matthew6688/${clientSlug}`,
    branch: 'dev',
    route,
    buildCommand: 'npm run build',
    deployRoute: 'Cloudflare Pages dev preview first, live publish after explicit approval',
    agentHandoff: 'Discord website-tasks thread backed by local Hermes website-agent; other tools may edit the repo if they preserve this packet.',
    requiredDesignSkill: 'huashu-design / open-design design protocol',
    syncRule: 'All builders must keep clients/<client>/ evidence/content/design/brand files as source of truth and push repo changes back to dev.',
  };
}

function validateArtifacts({ niche, content, design }) {
  const errors = [];
  const warnings = [];
  if (niche === 'restaurant') {
    if (content) {
      const contentValidation = validateRestaurantContent(content);
      errors.push(...contentValidation.errors.map((error) => `content: ${error}`));
      warnings.push(...contentValidation.warnings.map((warning) => `content: ${warning}`));
    }
    if (design) {
      const designValidation = validateRestaurantDesignBrief(design);
      errors.push(...designValidation.errors.map((error) => `design: ${error}`));
      warnings.push(...designValidation.warnings.map((warning) => `design: ${warning}`));
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function buildContact({ resolved, content }) {
  const phone = firstString(content?.contact?.phone, valueAt(resolved, 'contact.phone'));
  const email = firstString(content?.contact?.email, valueAt(resolved, 'contact.email'));
  const address = firstString(content?.contact?.address, valueAt(resolved, 'contact.address'));
  const serviceArea = firstString(valueAt(resolved, 'business.serviceArea'), valueAt(resolved, 'business.city'));
  const primaryCtaUrl = firstString(
    content?.cta?.reserveUrl,
    content?.cta?.callUrl,
    content?.cta?.mapUrl,
    valueAt(resolved, 'cta.reserve'),
    valueAt(resolved, 'cta.call'),
    valueAt(resolved, 'cta.map'),
  );
  return {
    phone,
    email,
    address,
    serviceArea,
    addressOrServiceArea: firstString(address, serviceArea),
    website: firstString(content?.contact?.website, valueAt(resolved, 'contact.website')),
    primaryContact: firstString(phone, email, primaryCtaUrl),
    primaryCtaUrl,
  };
}

function buildOffer({ resolved, content, niche, route }) {
  const sections = content?.menu?.sections || valueAt(resolved, 'menu.sections') || [];
  const serviceItems = valueAt(resolved, 'services.items') || valueAt(resolved, 'offer.items') || [];
  const primary = firstString(
    content?.hero?.tagline,
    valueAt(resolved, 'offer.primary'),
    niche === 'restaurant' ? 'Restaurant website with verified menu/contact information' : `${niche} business website`,
  );
  return {
    primary,
    route,
    menuSource: firstString(content?.menu?.sourceUrl, valueAt(resolved, 'menu.source')),
    sectionCount: Array.isArray(sections) ? sections.length : 0,
    serviceCount: Array.isArray(serviceItems) ? serviceItems.length : 0,
  };
}

function buildDesign({ resolved, content, design, brandSpecPath }) {
  const colors = design?.tokens?.colors || valueAt(resolved, 'brand.colors') || [];
  const directions = design?.directions || [];
  const direction = firstString(
    directions[0]?.name,
    valueAt(resolved, 'brand.designDirection'),
    content?.hero?.cuisine ? `${content.hero.cuisine} hospitality website` : '',
  );
  return {
    direction,
    colors: Array.isArray(colors) ? colors : String(colors).split(',').map((color) => color.trim()).filter(Boolean),
    designSkill: design?.designSkill || 'huashu-design',
    brandSpecPath: relativize(brandSpecPath),
  };
}

function buildAssets({ resolved, content, design }) {
  const requiredAssets = design?.assetProtocol?.requiredAssets || [];
  const assetById = (id) => requiredAssets.find((asset) => asset.id === id)?.value || '';
  return {
    logo: firstString(assetById('logo'), valueAt(resolved, 'brand.logo')),
    primaryPhoto: firstString(assetById('heroFoodPhoto'), content?.photos?.[0]?.url, valueAt(resolved, 'photos.primary')),
    menuSource: firstString(assetById('menuSource'), content?.menu?.sourceUrl, valueAt(resolved, 'menu.source')),
  };
}

function evidenceSources(items) {
  const seen = new Map();
  for (const item of items) {
    const key = `${item.sourceType}|${item.sourceUrl || ''}|${item.extractor || ''}`;
    if (!seen.has(key)) {
      seen.set(key, {
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl || '',
        extractor: item.extractor || '',
        count: 0,
      });
    }
    seen.get(key).count += 1;
  }
  return [...seen.values()].sort((a, b) => b.count - a.count);
}

function evidenceConflicts(items) {
  const highRiskKeys = new Set([
    'identity.name',
    'contact.address',
    'contact.phone',
    'contact.email',
    'cta.reserve',
    'menu.source',
  ]);
  const grouped = new Map();
  for (const item of items) {
    if (!highRiskKeys.has(item.key)) continue;
    if (Number(item.confidence || 0) < 0.85) continue;
    const value = normalizeComparable(item.value);
    if (!value) continue;
    if (!grouped.has(item.key)) grouped.set(item.key, new Map());
    const values = grouped.get(item.key);
    if (!values.has(value)) values.set(value, []);
    values.get(value).push(item);
  }
  const conflicts = [];
  for (const [key, values] of grouped.entries()) {
    if (values.size <= 1) continue;
    conflicts.push({
      key,
      values: [...values.entries()].map(([value, candidates]) => ({
        value,
        sources: candidates.map((item) => item.sourceType),
      })),
    });
  }
  return conflicts;
}

function inferSourceType({ paidIntake, caseFile }) {
  if (paidIntake) return 'paid_intake';
  if (caseFile?.order?.provider) return 'paid_intake';
  return 'outbound';
}

function booleanFrom(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return false;
  return ['1', 'true', 'yes', 'y', 'confirmed'].includes(String(value).toLowerCase());
}

function firstString(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return '';
}

function valueAt(target, key) {
  const value = key.split('.').reduce((cursor, part) => cursor?.[part], target);
  if (value && typeof value === 'object' && 'value' in value) return value.value;
  return value;
}

function normalizeComparable(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function relativize(filePath) {
  if (!filePath) return '';
  return path.isAbsolute(filePath) ? path.relative(process.cwd(), filePath) : filePath;
}

function clientSlugFromPath(filePath) {
  if (!filePath) return '';
  const parts = path.normalize(filePath).split(path.sep);
  const clientsIndex = parts.lastIndexOf('clients');
  return clientsIndex >= 0 ? parts[clientsIndex + 1] : '';
}
