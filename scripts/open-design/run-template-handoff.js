#!/usr/bin/env node

import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || args['client-slug'] || '';

if (!clientSlug && !args.handoff) {
  console.error('Usage: node scripts/open-design/run-template-handoff.js --client <slug> [--handoff path] [--dry-run]');
  process.exit(1);
}

const handoffPath = path.resolve(args.handoff || path.join('clients', clientSlug, 'lead', 'open-design-handoff.json'));
if (!fs.existsSync(handoffPath)) {
  console.error(`Open Design handoff is missing: ${handoffPath}`);
  process.exit(1);
}

const handoff = readJson(handoffPath);
const effectiveClientSlug = clientSlug || handoff.clientSlug;
if (!effectiveClientSlug) {
  console.error('Handoff is missing clientSlug and --client was not provided.');
  process.exit(1);
}

const prompt = buildPrompt(handoff, args);
const copyBrief = handoff.json?.copyBrief || {};
const verifiedFacts = copyBrief.verifiedFacts || {};
const sourceUrl = args['source-url'] || verifiedFacts.websiteUrl || '';
const businessType = args['business-type'] || verifiedFacts.industry || copyBrief.selectedTemplate?.family || 'local business';
const scope = args.scope || inferScope(copyBrief);
const mode = args.mode || 'app-visible';
const timeoutMs = Number(args['timeout-ms'] || args.timeout || 30 * 60 * 1000);
const maxQuestionFormRounds = Number(args['max-question-form-rounds'] || 3);
const outDir = path.resolve(args.out || path.join('clients', effectiveClientSlug, 'concept', 'open-design'));
const runRequestPath = path.resolve(args['request-out'] || path.join('clients', effectiveClientSlug, 'lead', 'open-design-run-request.json'));
const publicRoot = path.resolve(args['public-root'] || args.publicRoot || 'public/admin-artifacts');
const dryRun = boolArg(args, 'dry-run', false);
const skipAudit = boolArg(args, 'skip-audit', false);
const skipValidate = boolArg(args, 'skip-validate', false);
const skipPublicSync = boolArg(args, 'skip-public-sync', false);
const allowArtifactFallback = boolArg(args, 'allow-artifact-fallback', false);

const runnerArgs = [
  path.resolve('scripts/open-design/run-concept.js'),
  '--client', effectiveClientSlug,
  '--prompt', prompt,
  '--business-type', businessType,
  '--scope', scope,
  '--mode', mode,
  '--out', outDir,
  '--timeout-ms', String(timeoutMs),
  '--max-question-form-rounds', String(maxQuestionFormRounds),
];

if (sourceUrl) runnerArgs.push('--source-url', sourceUrl);
if (args['open-design-root']) runnerArgs.push('--open-design-root', path.resolve(args['open-design-root']));
if (args['daemon-url']) runnerArgs.push('--daemon-url', args['daemon-url']);
if (args.agent) runnerArgs.push('--agent', args.agent);
if (args.model) runnerArgs.push('--model', args.model);
if (args.reasoning) runnerArgs.push('--reasoning', args.reasoning);
if (args['seed-dir']) runnerArgs.push('--seed-dir', path.resolve(args['seed-dir']));
if (allowArtifactFallback) runnerArgs.push('--allow-artifact-fallback');

const runRequest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  type: 'open_design_template_run_request',
  clientSlug: effectiveClientSlug,
  handoffPath,
  outDir,
  publicOutDir: path.join(publicRoot, effectiveClientSlug, 'open-design'),
  mode,
  timeoutMs,
  timeoutPolicy: {
    checkpointNotHardEnd: true,
    minimumMs: 10 * 60 * 1000,
    defaultBusinessMs: 30 * 60 * 1000,
    nativeCleanFinishRequired: !allowArtifactFallback,
  },
  maxQuestionFormRounds,
  allowArtifactFallback,
  selectedTemplate: handoff.selectedTemplate || handoff.json?.templateFamily || null,
  sourceUrl: sourceUrl || null,
  businessType,
  scope,
  promptHash: sha256(prompt),
  promptChars: prompt.length,
  commandPreview: [process.execPath, ...runnerArgs.map(redactLongPrompt)],
  status: dryRun ? 'dry_run' : 'started',
};

writeJson(runRequestPath, runRequest);

if (dryRun) {
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    clientSlug: effectiveClientSlug,
    handoffPath,
    runRequestPath,
    outDir,
    mode,
    timeoutMs,
    maxQuestionFormRounds,
    allowArtifactFallback,
    selectedTemplate: runRequest.selectedTemplate?.templateId || null,
    commandPreview: runRequest.commandPreview,
  }, null, 2));
  process.exit(0);
}

const runResult = spawnSync(process.execPath, runnerArgs, {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
});

if (runResult.status !== 0) {
  writeJson(runRequestPath, {
    ...runRequest,
    status: 'failed',
    failedAt: new Date().toISOString(),
    exitCode: runResult.status,
    signal: runResult.signal || null,
  });
  process.exit(runResult.status || 1);
}

let auditResult = null;
if (!skipAudit) {
  const auditArgs = [
    path.resolve('scripts/open-design/audit-generated-concept.js'),
    '--client', effectiveClientSlug,
    '--fail-below', String(args['fail-below'] || 85),
  ];
  const audit = spawnSync(process.execPath, auditArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  auditResult = { exitCode: audit.status, signal: audit.signal || null };
  if (audit.status !== 0) {
    writeJson(runRequestPath, {
      ...runRequest,
      status: 'audit_failed',
      completedAt: new Date().toISOString(),
      audit: auditResult,
    });
    process.exit(audit.status || 1);
  }
}

let validateResult = null;
if (!skipValidate) {
  const validateArgs = [
    path.resolve('scripts/open-design/validate-concept.js'),
    '--client', effectiveClientSlug,
    '--require-quality-audit',
  ];
  if (sourceUrl) validateArgs.push('--require-source-pages');
  const validate = spawnSync(process.execPath, validateArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  validateResult = { exitCode: validate.status, signal: validate.signal || null };
  if (validate.status !== 0) {
    writeJson(runRequestPath, {
      ...runRequest,
      status: 'validation_failed',
      completedAt: new Date().toISOString(),
      audit: auditResult,
      validation: validateResult,
    });
    process.exit(validate.status || 1);
  }
}

const publicSync = skipPublicSync
  ? { ok: true, skipped: true }
  : syncPublicConceptArtifacts(outDir, path.join(publicRoot, effectiveClientSlug, 'open-design'));

writeJson(runRequestPath, {
  ...runRequest,
  status: 'completed',
  completedAt: new Date().toISOString(),
  audit: auditResult,
  validation: validateResult,
  publicSync,
});

console.log(JSON.stringify({
  ok: true,
  clientSlug: effectiveClientSlug,
  runRequestPath,
  outDir,
  publicPreviewUrl: publicSync.previewUrl || null,
  audit: auditResult,
  validation: validateResult,
  publicSync,
}, null, 2));

function buildPrompt(handoffData, values) {
  const base = String(handoffData.prompt || '').trim();
  if (!base) throw new Error('open-design-handoff.json is missing prompt');
  const extra = values.extra || values.instruction || '';
  return [
    base,
    '',
    'Run discipline:',
    '- Treat timeout as a checkpoint, not acceptance of a partial artifact.',
    '- Do not use artifact_quiet_fallback unless the operator explicitly passed --allow-artifact-fallback.',
    '- If a question form appears, answer it from the handoff facts and continue until native completion.',
    '- Preserve verified phone, email, address, business name, and contact path exactly.',
    '- Keep customer-facing copy complete and natural; do not expose internal labels.',
    extra ? `\nAdditional operator instruction:\n${extra}` : '',
  ].filter(Boolean).join('\n');
}

function inferScope(copyBriefData) {
  const buildType = copyBriefData.inferredContent?.buildType || copyBriefData.websitePlan?.type || '';
  if (/multi|multiple|full/i.test(buildType)) return 'simple-multi-page';
  return 'one-page';
}

function redactLongPrompt(value) {
  if (typeof value !== 'string') return value;
  if (value.length < 120) return value;
  return `[prompt:${value.length} chars:${sha256(value).slice(0, 12)}]`;
}

function syncPublicConceptArtifacts(sourceDir, destinationDir) {
  const indexPath = path.join(sourceDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return { ok: false, reason: 'missing_index_html', sourceDir, destinationDir };
  }
  fs.mkdirSync(destinationDir, { recursive: true });
  copyFileIfExists(indexPath, path.join(destinationDir, 'index.html'));
  for (const fileName of [
    'concept-manifest.json',
    'concept-quality-audit.json',
    'concept-quality-audit.md',
    'open-design-run-state.json',
    'open-design-run-summary.md',
  ]) {
    copyFileIfExists(path.join(sourceDir, fileName), path.join(destinationDir, fileName));
  }

  const sourceAssets = path.join(sourceDir, 'assets');
  const destinationAssets = path.join(destinationDir, 'assets');
  if (fs.existsSync(sourceAssets)) {
    fs.mkdirSync(destinationAssets, { recursive: true });
    for (const fileName of fs.readdirSync(sourceAssets)) {
      const source = path.join(sourceAssets, fileName);
      if (fs.statSync(source).isFile()) {
        copyFileIfExists(source, path.join(destinationAssets, fileName));
      }
    }
  }

  const relative = path.relative(path.resolve('public'), path.join(destinationDir, 'index.html'));
  return {
    ok: true,
    destinationDir,
    previewUrl: `/${relative.split(path.sep).join('/')}`,
  };
}

function copyFileIfExists(source, destination) {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function boolArg(values, key, defaultValue = false) {
  if (values[key] === undefined) return defaultValue;
  return values[key] === true || String(values[key]).toLowerCase() === 'true' || values[key] === '1';
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
