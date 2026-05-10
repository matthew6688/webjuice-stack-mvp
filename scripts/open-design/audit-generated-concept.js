#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || '';
const conceptDir = path.resolve(args.dir || (clientSlug ? path.join('clients', clientSlug, 'concept', 'open-design') : ''));
const failBelow = Number(args['fail-below'] || 85);

if (!clientSlug && !args.dir) {
  console.error('Usage: node scripts/open-design/audit-generated-concept.js --client slug [--fail-below 85]');
  process.exit(1);
}

const manifestPath = path.join(conceptDir, 'concept-manifest.json');
const statePath = path.join(conceptDir, 'open-design-run-state.json');
const handoffPath = path.join(conceptDir, 'production-handoff.json');
const htmlPath = path.join(conceptDir, 'index.html');
const auditPath = path.join(conceptDir, 'concept-quality-audit.json');
const auditMdPath = path.join(conceptDir, 'concept-quality-audit.md');

const manifest = readJsonOptional(manifestPath) || {};
const runState = readJsonOptional(statePath) || {};
const handoff = readJsonOptional(handoffPath) || {};
const html = readTextOptional(htmlPath);
const eventsText = readTextOptional(path.join(conceptDir, 'run-events.sse'));
const text = stripHtml(html);
const lower = text.toLowerCase();
const findings = [];

const internalTerms = [
  'demo',
  'mockup',
  'pre-sale',
  'resend',
  'hi@profitslocal.com',
  'verified',
  'not verified',
  'final details',
  'owner-approved',
  'placeholder',
  'audit',
  'internal',
  'connect /api',
];
const internalHits = internalTerms.filter((term) => lower.includes(term));
if (internalHits.length) {
  finding('customer_facing_internal_language', 'critical', 28, `Customer-visible page contains internal/operator language: ${internalHits.join(', ')}.`, 'Rewrite customer-facing copy so it never mentions mockup/demo/internal/Resend/verification workflow.');
}

const imageRefs = [...html.matchAll(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
const cssBackgroundImages = [...html.matchAll(/background(?:-image)?\s*:\s*[^;]*url\(([^)]+)\)/gi)].map((match) => match[1]);
const visualAssets = (manifest.files || []).filter((file) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(file.path || ''));
if (imageRefs.length + cssBackgroundImages.length + visualAssets.length === 0) {
  finding('no_visual_assets', 'critical', 18, 'No real image or generated visual asset was found in the exported concept.', 'Use verified business photos, Google/website/social photos, or a clearly project-local AI-generated industry visual before accepting the mockup.');
}

const placeholderHits = [
  'roof profile visual',
  'feature one',
  'feature two',
  'lorem',
  'stock photo',
].filter((term) => lower.includes(term));
if (placeholderHits.length) {
  finding('placeholder_visual_or_copy', 'high', 16, `Placeholder language is visible: ${placeholderHits.join(', ')}.`, 'Replace placeholders with customer-facing copy or real/generated assets.');
}

const hasPhone = /href=["']tel:[^"']+["']/i.test(html);
const hasForm = /<form\b/i.test(html);
const hasServices = (html.match(/<h3\b/gi) || []).length >= 3 || /services?/i.test(text);
if (!hasPhone && !hasForm) {
  finding('weak_conversion_path', 'critical', 20, 'No clear phone CTA or contact form was found.', 'Local service pages must make phone/form enquiry visible in hero and final CTA.');
}
if (!hasServices) {
  finding('weak_service_content', 'high', 12, 'Service content is too thin or missing.', 'Show the actual services from evidence/input in a scannable section.');
}

const looksEditorial = /serif|iowan|charter|georgia/i.test(html)
  && imageRefs.length + cssBackgroundImages.length + visualAssets.length === 0
  && /deserves a clearer|presence online|visitors the jobs/i.test(text);
if (looksEditorial) {
  finding('wrong_local_business_style', 'high', 18, 'The page reads like an editorial text prototype rather than a practical local business site.', 'Use a stronger local-service visual system: real/AI job imagery, bolder CTA band, proof/quote flow, practical service cards, and fewer abstract essay headings.');
}

const nativeCleanFinish = Boolean(runState.nativeCleanFinish || manifest.lifecycle?.nativeCleanFinish || /event:\s*end\b/.test(eventsText));
if (!nativeCleanFinish && manifest.status?.completionMode === 'artifact_quiet_fallback') {
  finding('not_native_clean_finish', 'critical', 25, 'Open Design did not finish natively; artifact_quiet_fallback was used.', 'Rerun without --allow-artifact-fallback and wait for event:end before accepting.');
}
if ((runState.questionForms || []).length > 0) {
  finding('question_form_unresolved', 'critical', 20, `${runState.questionForms.length} Open Design question form(s) were detected.`, 'Answer question forms from the AI handoff payload and rerun until no question form blocks artifact generation.');
}

if (manifest.sourceUrl) {
  const redesignChecks = auditRedesignFollowThrough({ html, handoff });
  for (const item of redesignChecks) finding(item.code, item.severity, item.penalty, item.evidence, item.fix);
}

let score = 100 - findings.reduce((sum, item) => sum + item.penalty, 0);
score = Math.max(0, Math.min(100, score));
const result = {
  ok: score >= failBelow && !findings.some((item) => item.severity === 'critical'),
  score,
  failBelow,
  generatedAt: new Date().toISOString(),
  clientSlug: manifest.clientSlug || clientSlug || null,
  conceptDir,
  nativeCleanFinish,
  completionMode: manifest.status?.completionMode || null,
  counts: {
    images: imageRefs.length,
    cssBackgroundImages: cssBackgroundImages.length,
    visualAssets: visualAssets.length,
    internalTermHits: internalHits.length,
    findings: findings.length,
  },
  findings,
  gates: {
    customerFacingCopyClean: internalHits.length === 0,
    hasVisualAsset: imageRefs.length + cssBackgroundImages.length + visualAssets.length > 0,
    nativeCleanFinish,
    noQuestionForms: (runState.questionForms || []).length === 0,
    conversionPathPresent: hasPhone || hasForm,
  },
};

writeJson(auditPath, result);
fs.writeFileSync(auditMdPath, renderMarkdown(result));
if (fs.existsSync(statePath)) {
  const state = readJsonOptional(statePath) || {};
  state.audit = {
    score: result.score,
    ok: result.ok,
    path: path.relative(path.dirname(statePath), auditPath),
    generatedAt: result.generatedAt,
    findingCount: findings.length,
  };
  writeJson(statePath, state);
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

function finding(code, severity, penalty, evidence, fix) {
  findings.push({ code, severity, penalty, evidence, fix });
}

function auditRedesignFollowThrough({ html, handoff }) {
  const out = [];
  const targets = handoff?.redesign?.upgradeTargets || handoff?.sourceOfTruth?.redesign?.upgradeTargets || [];
  if (targets.length) {
    const matched = targets.filter((target) => stripHtml(html).toLowerCase().includes(String(target).toLowerCase().split(/\s+/)[0]));
    if (matched.length < Math.min(2, targets.length)) {
      out.push({
        code: 'redesign_targets_not_visible',
        severity: 'high',
        penalty: 18,
        evidence: `Only ${matched.length}/${targets.length} planned redesign target(s) are visibly reflected in the concept.`,
        fix: 'Map each planned audit improvement to a visible page section and list it in the production handoff.',
      });
    }
  }
  return out;
}

function renderMarkdown(result) {
  return [
    `# Concept Quality Audit: ${result.clientSlug}`,
    '',
    `- Score: ${result.score}`,
    `- Pass: ${result.ok}`,
    `- Native clean finish: ${result.nativeCleanFinish}`,
    `- Completion mode: ${result.completionMode || 'native'}`,
    `- Visual assets: ${result.counts.visualAssets + result.counts.images + result.counts.cssBackgroundImages}`,
    `- Internal term hits: ${result.counts.internalTermHits}`,
    '',
    '## Findings',
    ...(result.findings.length ? result.findings.map((item) => [
      `### ${item.code}`,
      `- Severity: ${item.severity}`,
      `- Penalty: ${item.penalty}`,
      `- Evidence: ${item.evidence}`,
      `- Fix: ${item.fix}`,
      '',
    ].join('\n')) : ['No findings.']),
  ].join('\n');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readJsonOptional(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readTextOptional(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
