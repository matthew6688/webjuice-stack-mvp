#!/usr/bin/env node

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || process.cwd());
const niche = normalizeId(args.niche || 'roofing');
const family = normalizeId(args.family || 'classic-premium-roftix');
const page = normalizeId(args.page || 'home');
const execute = Boolean(args.execute);
const limit = Number(args.limit || 0);
const runStamp = args['run-id'] || args.runId || new Date().toISOString().replace(/[:.]/g, '-');
const openDesignMode = args.mode ? normalizeId(args.mode) : '';
const familyDir = path.join(root, 'templates', niche, 'families', family);
const manifestPath = path.join(familyDir, 'template-manifest.json');
const experimentRoot = path.join(root, 'data', 'template-experiments', niche, family, `${page}-${runStamp}`);

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing template manifest: ${manifestPath}`);
  process.exit(1);
}

const manifest = readJson(manifestPath);
const variantFilter = args.variant ? new Set(String(args.variant).split(',').map((item) => normalizeId(item)).filter(Boolean)) : null;
const matrix = buildMatrix()
  .filter((variant) => !variantFilter || variantFilter.has(variant.id))
  .slice(0, limit > 0 ? limit : undefined);
if (!matrix.length) {
  console.error(`No experiment variants matched${args.variant ? `: ${args.variant}` : ''}.`);
  process.exit(1);
}
fs.mkdirSync(experimentRoot, { recursive: true });

const approvedAssets = collectSelectedAssets(manifest);
const baseFacts = buildBaseFacts({ manifest, niche, family, page });
const results = [];

for (const variant of matrix) {
  const startedAt = new Date();
  const variantDir = path.join(experimentRoot, variant.id);
  const seedDir = path.join(variantDir, 'seed');
  const outDir = path.join(variantDir, 'open-design');
  fs.mkdirSync(seedDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const seedAssets = writeSeedAssets({ seedDir, approvedAssets });
  const localCopy = await buildLocalCopyFactor({ variant, baseFacts, seedDir });
  const prompt = buildPrompt({
    variant,
    manifest,
    familyDir,
    baseFacts,
    seedAssets,
    localCopy,
  });
  const promptPath = path.join(variantDir, 'prompt.md');
  const configPath = path.join(variantDir, 'experiment-config.json');
  fs.writeFileSync(promptPath, `${prompt}\n`);
  fs.writeFileSync(configPath, `${JSON.stringify({
    schemaVersion: 1,
    variant,
    baseFacts,
    approvedAssets: approvedAssets.map((asset) => ({
      slot: asset.slot,
      sourcePath: asset.sourcePath,
      sha256: asset.sha256,
      bytes: asset.bytes,
    })),
    seedAssets,
    localCopy,
    execute,
    generatedAt: startedAt.toISOString(),
  }, null, 2)}\n`);

  const command = [
    process.execPath,
    'scripts/open-design/run-concept.js',
    '--client',
    `template-exp-${niche}-${family}`,
    '--project-id',
    normalizeId(`template-exp-${niche}-${family}-${page}-${variant.id}-${runStamp}`),
    '--name',
    `${manifest.displayName || family} ${page} experiment ${variant.id}`,
    '--business-type',
    `${niche} ${page} page template experiment`,
    '--scope',
    'one-page',
    '--out',
    outDir,
    '--seed-dir',
    seedDir,
    '--timeout-ms',
    '900000',
    '--prompt',
    prompt,
  ];
  if (openDesignMode) command.push('--mode', openDesignMode);
  if (!execute) command.push('--dry-run');

  const commandStarted = Date.now();
  const run = spawnSync(command[0], command.slice(1), {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Date.now() - commandStarted;
  fs.writeFileSync(path.join(variantDir, 'open-design-command.json'), `${JSON.stringify({
    command: [command[0], ...command.slice(1).map((part) => part === prompt ? '[prompt omitted: see prompt.md]' : part)],
    status: run.status,
    durationMs,
    stdout: run.stdout,
    stderr: run.stderr,
  }, null, 2)}\n`);

  const audit = auditExperiment({
    root,
    variant,
    variantDir,
    outDir,
    approvedAssets,
    durationMs,
    runStatus: run.status,
    execute,
    baseFacts,
  });
  fs.writeFileSync(path.join(variantDir, 'experiment-score.json'), `${JSON.stringify(audit, null, 2)}\n`);
  results.push({
    variant: variant.id,
    constraintMode: variant.constraintMode,
    frameworkMode: variant.frameworkMode,
    copyMode: variant.copyMode,
    localLlmModel: localCopy.model || null,
    localLlmStatus: localCopy.status,
    score: audit.score,
    ok: audit.ok,
    durationMs,
    outDir: path.relative(root, outDir),
    promptPath: path.relative(root, promptPath),
    scorePath: path.relative(root, path.join(variantDir, 'experiment-score.json')),
  });
}

const scoreboard = {
  schemaVersion: 1,
  niche,
  family,
  page,
  execute,
  runId: runStamp,
  experimentRoot: path.relative(root, experimentRoot),
  variants: results,
  best: execute ? (results.filter((item) => item.ok).sort((a, b) => b.score - a.score || a.durationMs - b.durationMs)[0] || null) : null,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(experimentRoot, 'scoreboard.json'), `${JSON.stringify(scoreboard, null, 2)}\n`);
console.log(JSON.stringify(scoreboard, null, 2));
if (execute) process.exit(0);

function buildMatrix() {
  return [
    {
      id: 'strong-framework-no-llm',
      constraintMode: 'strong',
      frameworkMode: 'strict-section-contract',
      copyMode: 'none',
      hypothesis: 'Strong framework improves structure but may suppress Open Design visual taste.',
    },
    {
      id: 'medium-framework-no-llm',
      constraintMode: 'medium',
      frameworkMode: 'design-language-plus-required-sections',
      copyMode: 'none',
      hypothesis: 'Medium constraints should preserve business structure while leaving visual freedom.',
    },
    {
      id: 'free-open-design-no-llm',
      constraintMode: 'light',
      frameworkMode: 'open-design-freeform',
      copyMode: 'none',
      hypothesis: 'Low constraints show Open Design baseline quality with the same images and facts.',
    },
    {
      id: 'screenshot-style-no-llm',
      constraintMode: 'medium',
      frameworkMode: 'reference-style-transfer',
      copyMode: 'none',
      hypothesis: 'Reference style transfer may beat explicit section contracts for visual fidelity.',
    },
    {
      id: 'medium-framework-local-brief',
      constraintMode: 'medium',
      frameworkMode: 'design-language-plus-required-sections',
      copyMode: 'local-llm-brief-first',
      hypothesis: 'Local LLM can improve copy direction before Open Design without controlling layout.',
    },
    {
      id: 'free-open-design-local-brief',
      constraintMode: 'light',
      frameworkMode: 'open-design-freeform',
      copyMode: 'local-llm-brief-first',
      hypothesis: 'Open Design plus local copy brief may be the fastest high-quality combination.',
    },
  ];
}

function buildPrompt({ variant, manifest, familyDir, baseFacts, seedAssets, localCopy }) {
  const designLanguage = readTextIfExists(path.join(familyDir, 'design-language.md'));
  const designMd = readTextIfExists(path.join(familyDir, 'DESIGN.md'));
  const sectionPatterns = readJsonIfExists(path.join(familyDir, 'section-patterns.json'));
  const qaRubric = readTextIfExists(path.join(familyDir, 'qa-rubric.json'));
  const framework = buildFrameworkContract({ variant, manifest, sectionPatterns });
  const localCopySection = localCopy.status === 'ready'
    ? `## Local LLM Copy Brief\n${JSON.stringify(localCopy.brief, null, 2)}`
    : `## Local LLM Copy Brief\nStatus: ${localCopy.status}. Reason: ${localCopy.reason || 'not requested'}.`;

  return [
    `# Fixed Home Page Experiment: ${manifest.displayName || family}`,
    '',
    `Variant: ${variant.id}`,
    `Hypothesis: ${variant.hypothesis}`,
    '',
    '## Non-negotiable Experiment Rules',
    '- Build only one polished home page: `index.html`.',
    '- Use the files in the seeded `assets/` folder as primary imagery. Do not fetch replacement stock images.',
    '- Do not use external URLs for images.',
    '- No fake licences, fake awards, fake verified reviews, fake exact addresses, fake years in business, or fake prices.',
    '- Review/testimonial modules may use AI-generated reference copy only when clearly marked in HTML metadata, e.g. `data-review-provenance="ai-reference-placeholder"` or `<meta name="review-provenance" content="ai-reference-placeholder; replace with real Google or customer reviews before live">`.',
    '- Customer-facing text must not mention Open Design, ProfitsLocal, template-lab, audit, mockup, experiment, or internal workflow.',
    '- Include one obvious phone/form quote path.',
    '- Include complete local SEO basics: descriptive title, exactly one H1 with roofing + service area, LocalBusiness/RoofingContractor JSON-LD with telephone and areaServed/address placeholder, and a real Google Maps/directions URL placeholder such as `https://www.google.com/maps/search/?api=1&query=Brisbane+roofing+contractor`.',
    '- Every raster image must have meaningful alt text; all non-hero images should use `loading="lazy"`.',
    '- The page should be visually strong enough to judge from a screenshot.',
    '- Hero quality is a hard visual requirement: the first viewport must be photo-led, roofing-specific, conversion-focused, and stronger than a generic split-card SaaS hero. If the hero image feels small, decorative, or detached from the offer, redesign the hero before finishing.',
    '',
    '## Fixed Business Facts',
    JSON.stringify(baseFacts, null, 2),
    '',
    '## Seeded Approved Assets',
    seedAssets.map((asset) => `- ${asset.slot}: assets/${asset.fileName} (${asset.sha256.slice(0, 12)})`).join('\n'),
    '',
    localCopySection,
    '',
    '## Constraint Mode',
    describeConstraintMode(variant),
    '',
    framework,
    '',
    variant.constraintMode !== 'light' ? `## Design Language\n${designLanguage}` : '',
    variant.constraintMode === 'strong' ? `## DESIGN.md Contract\n${designMd}` : '',
    variant.constraintMode === 'strong' ? `## QA Rubric\n${qaRubric}` : '',
    '',
    '## Final Self-Check Before Finishing',
    '- Screenshot mentally: does first viewport clearly look like a roofing business, not a generic text page?',
    '- Are the images large enough and placed intentionally?',
    '- Would the hero alone make a cold prospect curious enough to open the full preview?',
    '- If the hero uses a split layout, is the roofing image still dominant and premium rather than card-like?',
    '- Does the copy sound like a real local roofer, not a SaaS landing page?',
    '- Is the design stronger than a default web-prototype seed?',
  ].filter(Boolean).join('\n');
}

function describeConstraintMode(variant) {
  if (variant.frameworkMode === 'open-design-freeform') {
    return [
      'Use your own design judgment. The fixed inputs are business facts, approved assets, and conversion goal.',
      'You may choose layout, typography, section order, and visual rhythm.',
      'Keep it tasteful, premium, and local-business appropriate.',
    ].join('\n');
  }
  if (variant.frameworkMode === 'reference-style-transfer') {
    return [
      'Prioritize reference-style transfer over literal JSON compliance.',
      'Extract the feel: cinematic roof imagery, premium editorial hierarchy, deep trust footer, and practical service proof.',
      'Do not clone a reference brand, but the screenshot should feel from the same design family.',
    ].join('\n');
  }
  if (variant.constraintMode === 'strong') {
    return [
      'Follow the framework contract closely.',
      'Use the section order and image slots exactly unless impossible.',
      'Use design tokens and section purposes as hard constraints.',
    ].join('\n');
  }
  return [
    'Follow the business and section goals, but make visual decisions freely.',
    'Use the framework as a guide, not a cage.',
    'Prefer a beautiful result over mechanically satisfying every section note.',
  ].join('\n');
}

function buildFrameworkContract({ variant, manifest, sectionPatterns }) {
  if (variant.frameworkMode === 'open-design-freeform') {
    return [
      '## Framework Contract',
      'No detailed framework injected for this variant. This tests Open Design freeform quality.',
    ].join('\n');
  }

  const commonSections = [
    {
      id: 'hero',
      job: 'Make the roofing offer obvious and visually desirable in 3 seconds.',
      imageSlot: 'hero',
      required: [
        'business name',
        'roofing category',
        'service area in H1',
        'primary phone/form CTA',
        'one short promise',
        'large roof/roofer image that dominates or strongly anchors the first viewport',
        'not a generic SaaS split hero or small decorative image card',
      ],
    },
    {
      id: 'services',
      job: 'Show the homeowner what work can be requested.',
      imageSlot: 'serviceRepair or serviceInstall',
      required: ['3-5 services', 'plain descriptions', 'no fake certifications'],
    },
    {
      id: 'proof',
      job: 'Make the work feel concrete without inventing reviews or exact metrics.',
      imageSlot: 'proof or about',
      required: ['process proof', 'material/workmanship cues', 'demo-safe project structure'],
    },
    {
      id: 'quote-process',
      job: 'Explain how a visitor gets an inspection or quote.',
      imageSlot: 'serviceInstall',
      required: ['step sequence', 'phone/form CTA'],
    },
    {
      id: 'faq-contact-footer',
      job: 'Answer common concerns and make contact easy.',
      imageSlot: 'none',
      required: ['FAQ', 'contact form', 'phone link', 'service area', 'hours', 'real Google Maps/directions URL placeholder', 'complete footer'],
    },
  ];

  return [
    '## Framework Contract',
    JSON.stringify({
      schemaVersion: 1,
      source: sectionPatterns?.sections?.length ? 'section-patterns.json' : 'generated-homepage-framework-v1',
      warning: sectionPatterns?.sections?.length ? '' : 'Existing section-patterns.json has no section detail; this generated homepage framework is the active test contract.',
      family: manifest.family || manifest.templateId,
      page: 'home',
      sections: commonSections,
    }, null, 2),
  ].join('\n');
}

async function buildLocalCopyFactor({ variant, baseFacts, seedDir }) {
  if (variant.copyMode === 'none') {
    return { status: 'not_requested', mode: variant.copyMode, model: null, reason: 'copy mode disabled' };
  }

  const model = args.model || process.env.OLLAMA_MODEL || 'qwen3.5:9b';
  const ollamaUrl = (args['ollama-url'] || args.ollamaUrl || process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const prompt = [
    'You are a direct-response local business copywriter.',
    'Return only JSON.',
    'Write a concise homepage copy brief for a roofing website.',
    'Do not invent licences, awards, exact addresses, verified reviews, years, prices, or guarantees.',
    'If a review module is useful, write it as AI-generated reference copy and mark the HTML metadata as ai-reference-placeholder so it can be replaced by Google/customer reviews before live.',
    'Use dummy-safe copy for services, FAQ, and process.',
    '',
    JSON.stringify(baseFacts, null, 2),
    '',
    'JSON schema: {"heroHeadline":"","heroSubcopy":"","primaryCta":"","serviceHeadlines":[],"proofAngle":"","reviewPolicy":"","faq":[],"toneNotes":[]}',
  ].join('\n');

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, format: 'json' }),
      signal: AbortSignal.timeout(Number(args['llm-timeout'] || 45000)),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${text}`);
    const body = JSON.parse(text);
    const brief = JSON.parse(body.response || '{}');
    const result = { status: 'ready', mode: variant.copyMode, provider: 'ollama', model, ollamaUrl, brief };
    fs.writeFileSync(path.join(seedDir, 'local-copy-brief.json'), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } catch (error) {
    const result = {
      status: 'unavailable',
      mode: variant.copyMode,
      provider: 'ollama',
      model,
      ollamaUrl,
      reason: error?.message || String(error),
      brief: buildDeterministicCopyBrief(baseFacts),
    };
    fs.writeFileSync(path.join(seedDir, 'local-copy-brief.json'), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  }
}

function buildDeterministicCopyBrief(baseFacts) {
  return {
    heroHeadline: `${baseFacts.businessName} roof work, made easy to request`,
    heroSubcopy: `A practical roofing page for ${baseFacts.serviceArea}, focused on repairs, restoration, inspections, and a clear quote path.`,
    primaryCta: 'Request a roof quote',
    serviceHeadlines: baseFacts.services.slice(0, 5),
    proofAngle: 'Show process, materials, inspection clarity, and before/after structure without pretending there are verified reviews.',
    reviewPolicy: 'Reference reviews are allowed for template/demo modules only when marked as AI placeholders and replaced by Google/customer reviews before live.',
    faq: [
      'Can I ask for a roof inspection before deciding?',
      'Do you handle repairs and restoration?',
      'What information should I send before a quote?',
    ],
    toneNotes: ['plain', 'competent', 'local', 'not corporate'],
  };
}

function auditExperiment({ root, variant, variantDir, outDir, approvedAssets, durationMs, runStatus, execute, baseFacts }) {
  if (!execute) {
    return {
      schemaVersion: 1,
      variant: variant.id,
      score: null,
      ok: true,
      execute,
      durationMs,
      experimentReliability: null,
      localBusinessWebsite: null,
      htmlFiles: [],
      provenance: {
        rasterAssetCount: 0,
        approvedAssetCount: approvedAssets.length,
        usedApprovedAssetCount: 0,
        matchedApprovedAssets: [],
        unapprovedRasterAssets: [],
      },
      findings: [
        {
          severity: 'info',
          code: 'dry_run_only',
          points: 0,
          message: 'Dry-run validates experiment inputs only. No website quality score is assigned until --execute is used.',
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  const htmlFiles = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((file) => file.endsWith('.html')).map((file) => path.join(outDir, file))
    : [];
  const statePath = path.join(outDir, 'open-design-run-state.json');
  const state = readJsonIfExists(statePath);
  const findings = [];
  let reliabilityScore = 100;

  if (runStatus !== 0) reliabilityPenalty('critical', 30, 'open_design_command_failed', 'Open Design command failed or dry-run command failed.');
  if (execute && !state?.nativeCleanFinish) reliabilityPenalty('critical', 25, 'not_native_clean_finish', 'Native clean finish was not proven.');
  if (execute && state?.completionMode && state.completionMode !== 'native') reliabilityPenalty('critical', 25, 'fallback_completion', `Completion mode was ${state.completionMode}.`);
  if (execute && !htmlFiles.length) reliabilityPenalty('critical', 25, 'missing_html', 'No generated HTML found.');

  const html = htmlFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const text = stripHtml(html);
  if (execute) {
    const imgCount = countMatches(html, /<img\b/gi);
    const sectionCount = countMatches(html, /<section\b/gi);
    if (imgCount < 3) reliabilityPenalty('high', 14, 'weak_image_density', `Only ${imgCount} <img> tags found.`);
    if (sectionCount < 5) reliabilityPenalty('medium', 8, 'weak_section_depth', `Only ${sectionCount} sections found.`);
    if (!/href=["']tel:|<form\b|request[^<]{0,30}quote|free[^<]{0,30}inspection/i.test(html)) {
      reliabilityPenalty('high', 14, 'missing_conversion_path', 'No obvious phone/form/quote path found.');
    }
    if (/open design|template-lab|experiment|internal audit|mockup|lead-ops/i.test(text)) {
      reliabilityPenalty('critical', 25, 'internal_language_visible', 'Internal workflow language appears customer-facing.');
    }
    if (/\b\d{2,4}\+?\s+(years|projects|clients|homes)\b/i.test(text)) {
      reliabilityPenalty('high', 12, 'possible_fake_proof', 'Possible fake metric/proof claim found.');
    }
  }

  const provenance = auditAssetProvenance({ outDir, approvedAssets });
  if (execute && provenance.usedApprovedAssetCount < Math.min(3, approvedAssets.length)) {
    reliabilityPenalty('high', 16, 'approved_assets_not_used', `Only ${provenance.usedApprovedAssetCount} approved asset(s) matched by hash.`);
  }
  if (execute && provenance.unapprovedRasterAssets.length) {
    reliabilityPenalty('medium', 8, 'unapproved_raster_assets', `Unapproved raster assets found: ${provenance.unapprovedRasterAssets.join(', ')}`);
  }

  if (durationMs > 12 * 60 * 1000) reliabilityPenalty('low', 3, 'slow_run', `Run took ${durationMs} ms.`);

  const websiteScore = scoreLocalBusinessWebsite({ html, text, baseFacts, provenance });
  const finalScore = Math.round((Math.max(0, reliabilityScore) * 0.25) + (websiteScore.totalScore * 0.75));

  return {
    schemaVersion: 1,
    variant: variant.id,
    score: finalScore,
    ok: finalScore >= 85 && Math.max(0, reliabilityScore) >= 85 && websiteScore.totalScore >= 80 && !findings.some((finding) => finding.severity === 'critical'),
    execute,
    durationMs,
    nativeCleanFinish: Boolean(state?.nativeCleanFinish),
    completionMode: state?.completionMode || null,
    openDesignStatus: state?.status || null,
    openDesignDurationMs: typeof state?.durationMs === 'number' ? state.durationMs : null,
    questionFormRoundCount: Array.isArray(state?.questionFormRounds) ? state.questionFormRounds.length : 0,
    experimentReliability: {
      score: Math.max(0, reliabilityScore),
      max: 100,
      issues: findings.map((finding) => finding.message),
    },
    localBusinessWebsite: websiteScore,
    htmlFiles: htmlFiles.map((file) => path.relative(root, file)),
    provenance,
    findings,
    generatedAt: new Date().toISOString(),
  };

  function reliabilityPenalty(severity, points, code, message) {
    reliabilityScore -= points;
    findings.push({ severity, code, points, message });
  }
}

function scoreLocalBusinessWebsite({ html, text, baseFacts, provenance }) {
  const title = textMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1 = textMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const footer = textMatch(html, /<footer[^>]*>([\s\S]*?)<\/footer>/i);
  const lower = `${title} ${h1} ${text}`.toLowerCase();
  const cityTerms = ['brisbane', 'gold coast', 'local', 'nearby'];
  const businessTerms = ['roof', 'roofing', 'gutter', 'restoration', 'repair', 'inspection'];
  const hasCity = cityTerms.some((term) => lower.includes(term));
  const hasBusiness = businessTerms.some((term) => lower.includes(term));
  const hasPhone = /href=["']tel:|0[2-478]\d[\d\s-]{6,}/i.test(html + text);
  const hasAddress = /address|service area|brisbane|gold coast|suburb/i.test(footer + text);
  const hasHours = /hours|mon|tue|wed|thu|fri|sat|sun|weekdays|营业|opening/i.test(footer + text);
  const hasCta = /href=["']tel:|<form\b|request[^<]{0,30}quote|book[^<]{0,30}inspection|free[^<]{0,30}inspection|contact/i.test(html);
  const hasMap = /href=["'][^"']*(?:google\.com\/maps|maps\.app\.goo\.gl|maps\/search|api=1&query=)|<iframe[^>]+(?:google\.com\/maps|maps\.app\.goo\.gl|maps\/embed)/i.test(html);
  const hasSchema = /application\/ld\+json/i.test(html);
  const schemaText = textMatch(html, /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
  const schemaComplete = /LocalBusiness|RoofingContractor|HomeAndConstructionBusiness/i.test(schemaText)
    && /telephone/i.test(schemaText)
    && /address|areaServed/i.test(schemaText);
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const responsiveCss = /@media\s*\(|clamp\(|minmax\(|grid-template-columns/i.test(html);
  const httpsApplicable = false;
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const imageAltCount = imgs.filter((img) => /\salt=["'][^"']+["']/i.test(img)).length;
  const imageLazyCount = imgs.filter((img) => /loading=["']lazy["']/i.test(img)).length;
  const hasReviewSection = /review|testimonial|客户评价|评价/i.test(text);
  const hasReviewProvenance = /google review|google maps review|place review|demo review|sample review|placeholder review|reference review|example review|review-provenance|ai-reference-placeholder|replace with real|示例评价|参考评价|占位评价/i.test(html + text);
  const hasUnmarkedDemoReviewRisk = hasReviewSection && !hasReviewProvenance && /“|”|"[^"]{20,}"/.test(text) && !/google/i.test(text);
  const headingOrder = scoreHeadingHierarchy(html);
  const serviceScope = baseFacts.services.filter((service) => lower.includes(service.toLowerCase().split(' ')[0])).length;
  const differentiation = /because|why choose|why homeowners|clear quote|inspection|material|process|before|after|no pressure|transparent/i.test(text);
  const grammarRisk = /\b(utilize|leverage|streamline|innovative solutions|trusted partner|quality services)\b/i.test(text);

  const conversion = dimension('conversion', 25, [
    points('hero_cta', 8, hasCta ? 8 : 0, hasCta ? '' : '首屏或页面缺少明显 CTA。'),
    points('local_intent_cta', 4, hasCity && hasCta ? 4 : 0, hasCity && hasCta ? '' : 'CTA 或首屏没有明显本地意图词。'),
    points('contact_completeness', 8, Math.max(0, (hasPhone ? 3 : 0) + (hasAddress ? 3 : 0) + (hasHours ? 2 : 0)), '联系方式应覆盖电话、地区/地址、营业时间。'),
    points('five_second_clarity', 5, hasBusiness && h1 ? 5 : (hasBusiness ? 2 : 0), hasBusiness && h1 ? '' : '5 秒内业务类型不够清晰。'),
  ]);
  const localSeo = dimension('local_seo', 25, [
    points('title_city_business', 6, (containsAny(title, cityTerms) ? 3 : 0) + (containsAny(title, businessTerms) ? 3 : 0), 'Title 应包含城市/地区和业务关键词。'),
    points('nap_structure', 6, Math.max(0, (hasPhone ? 2 : 0) + (hasAddress ? 2 : 0) + (hasHours ? 2 : 0)), '模板阶段检查 NAP slot；真实 lead 阶段应和 Google Place/GMB 对照一致性。'),
    points('local_business_schema', 7, schemaComplete ? 7 : (hasSchema ? 3 : 0), schemaComplete ? '' : '缺少完整 LocalBusiness/Roofing schema。'),
    points('h1_business_location', 4, containsAny(h1, businessTerms) && containsAny(h1, cityTerms) ? 4 : (containsAny(h1, businessTerms) ? 2 : 0), 'H1 应包含业务类型和地区。'),
    points('map_link', 2, hasMap ? 2 : 0, hasMap ? '' : '缺少 Google Maps 嵌入或地图链接。'),
  ]);
  const technical = dimension('technical', 20, [
    points('responsive', 6, viewport && responsiveCss ? 6 : (viewport ? 3 : 0), '需要 viewport meta 和响应式 CSS。'),
    points('lcp_proxy', 6, imgs.length && provenance.rasterAssetCount ? 4 : 2, '实验阶段不跑 PageSpeed；上线 URL 后用 PSI 测 LCP。'),
    points('https', 4, httpsApplicable ? 4 : 2, '本地 file/html 阶段 HTTPS 不适用；上线后必须验证。'),
    points('image_alt_lazy', 4, imgs.length ? Math.round(((imageAltCount / imgs.length) * 2) + ((imageLazyCount / imgs.length) * 2)) : 0, '图片需要 alt 文本和 lazy loading。'),
  ]);
  const designTrust = dimension('design_trust', 20, [
    points('industry_fit', 5, hasBusiness && provenance.usedApprovedAssetCount >= 2 ? 5 : 2, '设计和图片需要明显属于 roofing/local service。'),
    points('realistic_images', 5, provenance.usedApprovedAssetCount >= 3 ? 5 : (provenance.usedApprovedAssetCount ? 3 : 0), '应使用 approved/generated niche images，不要泛 stock/占位图。'),
    points('proof_or_reviews', 5, hasReviewSection ? (hasReviewProvenance ? 5 : (hasUnmarkedDemoReviewRisk ? 3 : 4)) : 3, hasReviewSection ? (hasUnmarkedDemoReviewRisk ? 'Review 可以是 AI/reference placeholder，但必须在 artifact metadata 标记来源，上线前换成真实或 Google review。' : '') : '可以使用 AI-generated demo/reference review，不是 critical blocker；上线需换成真实 review 或 Google review。'),
    points('typographic_hierarchy', 5, headingOrder, headingOrder >= 4 ? '' : '标题层级或排版层次不够清楚。'),
  ]);
  const content = dimension('content', 10, [
    points('service_area_scope', 4, hasCity && serviceScope >= 3 ? 4 : (hasCity || serviceScope >= 2 ? 2 : 1), '需要明确地区和服务范围。'),
    points('differentiation', 3, differentiation ? 3 : 1, differentiation ? '' : '缺少具体差异化理由。'),
    points('language_quality', 3, grammarRisk ? 1 : 3, grammarRisk ? '文案有泛营销词或 AI 味。' : ''),
  ]);

  const dimensions = { conversion, local_seo: localSeo, technical, design_trust: designTrust, content };
  const totalScore = Object.values(dimensions).reduce((sum, item) => sum + item.score, 0);
  return {
    totalScore,
    grade: grade(totalScore),
    dimensions,
    notes: [
      'Template-stage scoring allows AI-generated demo/reference reviews as placeholder proof copy.',
      'Demo/reference reviews are not critical blockers, but artifact metadata must mark provenance and live sites should replace them with real or Google reviews.',
      'Real lead scoring should compare NAP against Google Place/GMB when placeId evidence is available.',
      'PageSpeed/HTTPS are partial in local HTML experiments and become strict after deploy.',
    ],
    top3Fixes: topFixes(dimensions).slice(0, 3),
  };
}

function dimension(id, max, checks) {
  const score = Math.min(max, checks.reduce((sum, check) => sum + check.score, 0));
  return {
    score,
    max,
    issues: checks.filter((check) => check.issue).map((check) => check.issue),
    checks,
  };
}

function points(id, max, score, issue) {
  return { id, score: Math.max(0, Math.min(max, score)), max, issue: score >= max ? '' : issue };
}

function textMatch(value, pattern) {
  const match = String(value).match(pattern);
  return match ? stripHtml(match[1]) : '';
}

function containsAny(value, terms) {
  const lower = String(value).toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function scoreHeadingHierarchy(html) {
  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  if (!headings.length) return 0;
  if (headings[0] !== 1) return 2;
  const h1Count = headings.filter((level) => level === 1).length;
  if (h1Count > 1) return 3;
  return headings.some((level) => level === 2) ? 5 : 4;
}

function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function topFixes(dimensions) {
  return Object.values(dimensions)
    .flatMap((dimension) => dimension.issues)
    .filter(Boolean);
}

function auditAssetProvenance({ outDir, approvedAssets }) {
  const approvedByHash = new Map(approvedAssets.map((asset) => [asset.sha256, asset]));
  const assetDir = path.join(outDir, 'assets');
  const rasterFiles = fs.existsSync(assetDir)
    ? fs.readdirSync(assetDir).filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file))
    : [];
  const matched = [];
  const unapproved = [];
  for (const file of rasterFiles) {
    const fullPath = path.join(assetDir, file);
    const sha256 = sha256File(fullPath);
    if (approvedByHash.has(sha256)) matched.push({ file, slot: approvedByHash.get(sha256).slot, sha256 });
    else unapproved.push(file);
  }
  return {
    rasterAssetCount: rasterFiles.length,
    approvedAssetCount: approvedAssets.length,
    usedApprovedAssetCount: matched.length,
    matchedApprovedAssets: matched,
    unapprovedRasterAssets: unapproved,
  };
}

function collectSelectedAssets(manifest) {
  const selected = manifest.selectedImages || {};
  return Object.entries(selected).map(([slot, imagePath]) => {
    const sourcePath = path.resolve(root, imagePath);
    if (!fs.existsSync(sourcePath)) throw new Error(`Selected image missing for ${slot}: ${sourcePath}`);
    return {
      slot,
      sourcePath,
      fileName: `${slot}-${path.basename(sourcePath)}`,
      sha256: sha256File(sourcePath),
      bytes: fs.statSync(sourcePath).size,
    };
  });
}

function writeSeedAssets({ seedDir, approvedAssets }) {
  const assetDir = path.join(seedDir, 'assets');
  fs.mkdirSync(assetDir, { recursive: true });
  const copied = approvedAssets.map((asset) => {
    const target = path.join(assetDir, asset.fileName);
    fs.copyFileSync(asset.sourcePath, target);
    return {
      slot: asset.slot,
      fileName: asset.fileName,
      sourcePath: asset.sourcePath,
      seedPath: path.relative(seedDir, target),
      sha256: asset.sha256,
      bytes: asset.bytes,
    };
  });
  fs.writeFileSync(path.join(seedDir, 'approved-assets.json'), `${JSON.stringify(copied, null, 2)}\n`);
  return copied;
}

function buildBaseFacts({ manifest, niche, family, page }) {
  return {
    niche,
    family,
    page,
    businessName: 'RidgeLine Roof Co.',
    businessType: 'local roofing contractor',
    serviceArea: 'Brisbane and Gold Coast',
    contact: {
      phone: '0400 000 000',
      email: '',
      website: '',
    },
    services: [
      'Roof repairs',
      'Roof restoration',
      'Metal roofing',
      'Gutter repairs',
      'Roof inspections',
    ],
    primaryAction: 'request a roof inspection or quote',
    proofBoundary: manifest.factsPolicy?.mustNotInvent || [],
    demoSafeContent: manifest.factsPolicy?.dummyAllowed || [],
  };
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMatches(value, pattern) {
  return [...String(value).matchAll(pattern)].length;
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonIfExists(filePath) {
  return fs.existsSync(filePath) ? readJson(filePath) : null;
}

function normalizeId(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
