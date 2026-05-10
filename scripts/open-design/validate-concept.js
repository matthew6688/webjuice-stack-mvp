#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || '';
const conceptDir = path.resolve(args.dir || (clientSlug ? path.join('clients', clientSlug, 'concept', 'open-design') : ''));
const requireSourcePages = booleanArg(args, 'require-source-pages');
const requireScreenshots = booleanArg(args, 'require-screenshots');
const allowArtifactFallback = booleanArg(args, 'allow-artifact-fallback');
const allowQuestionForm = booleanArg(args, 'allow-question-form');
const requireQualityAudit = booleanArg(args, 'require-quality-audit');
const requiredContains = toArray(args['must-contain']);

if (!clientSlug && !args.dir) {
  console.error('Usage: node scripts/open-design/validate-concept.js --client slug [--require-source-pages] [--require-screenshots] [--must-contain text]');
  process.exit(1);
}

const errors = [];
const warnings = [];

const manifestPath = path.join(conceptDir, 'concept-manifest.json');
const indexPath = path.join(conceptDir, 'index.html');
const statusPath = path.join(conceptDir, 'run-status.json');
const eventsPath = path.join(conceptDir, 'run-events.sse');
const runStatePath = path.join(conceptDir, 'open-design-run-state.json');
const brandSpecPath = path.join(conceptDir, 'brand-spec.md');
const qualityAuditPath = path.join(conceptDir, 'concept-quality-audit.json');

const manifest = readJson(manifestPath, 'concept manifest');
const status = readJson(statusPath, 'run status');
const runState = fs.existsSync(runStatePath) ? readJson(runStatePath, 'Open Design run state') : null;
const qualityAudit = fs.existsSync(qualityAuditPath) ? readJson(qualityAuditPath, 'concept quality audit') : null;
const indexHtml = readText(indexPath, 'index.html');

if (manifest) {
  if (manifest.version !== 1) errors.push('concept-manifest.json must have version 1');
  if (!manifest.clientSlug) errors.push('concept-manifest.json missing clientSlug');
  if (clientSlug && manifest.clientSlug !== clientSlug) {
    errors.push(`concept-manifest.json clientSlug "${manifest.clientSlug}" does not match "${clientSlug}"`);
  }
  if (!manifest.projectId) errors.push('concept-manifest.json missing projectId');
  if (!manifest.runId) errors.push('concept-manifest.json missing runId');
  if (!manifest.agentId) errors.push('concept-manifest.json missing agentId');
  if (!manifest.skillId) errors.push('concept-manifest.json missing skillId');
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    errors.push('concept-manifest.json must list exported files');
  }
  if (manifest.status?.status !== 'succeeded') {
    errors.push(`Open Design run status must be succeeded, got "${manifest.status?.status || 'missing'}"`);
  }
  if (manifest.status?.completionMode === 'artifact_quiet_fallback' && !allowArtifactFallback) {
    errors.push('Open Design run used artifact_quiet_fallback; normal validation requires native clean finish. Use --allow-artifact-fallback only for explicit rescue-mode validation.');
  }
  for (const file of manifest.files || []) {
    if (!file.path) {
      errors.push('manifest file entry missing path');
      continue;
    }
    const filePath = path.join(conceptDir, file.path);
    if (!fs.existsSync(filePath)) {
      errors.push(`manifest file is missing on disk: ${file.path}`);
    } else if (file.size && fs.statSync(filePath).size !== file.size) {
      warnings.push(`manifest size mismatch for ${file.path}; file may have been edited after export`);
    }
  }
}

if (status && status.status !== 'succeeded') {
  errors.push(`run-status.json must be succeeded, got "${status.status || 'missing'}"`);
}
if (status?.completionMode === 'artifact_quiet_fallback' && !allowArtifactFallback) {
  errors.push('run-status.json shows artifact_quiet_fallback; normal validation requires native clean finish.');
}

if (indexHtml) {
  if (!/<html[\s>]/i.test(indexHtml)) errors.push('index.html must be a full HTML document');
  if (!/<body[\s>]/i.test(indexHtml)) errors.push('index.html missing body');
  if (!/<title[\s>]/i.test(indexHtml)) warnings.push('index.html missing title');
  for (const text of requiredContains) {
    if (!indexHtml.includes(text) && !readTextOptional(brandSpecPath).includes(text)) {
      errors.push(`required text not found in concept output: ${text}`);
    }
  }
}

const eventsText = fs.existsSync(eventsPath) ? fs.readFileSync(eventsPath, 'utf8') : '';
if (!eventsText) errors.push('run-events.sse is missing');
if (eventsText && !/event:\s*end\b/.test(eventsText) && !allowArtifactFallback) {
  errors.push('run-events.sse does not contain native event:end; normal validation requires native clean finish.');
}
const questionFormCount = (eventsText.match(/<question-form\b/gi) || []).length
  + (Array.isArray(runState?.questionForms) ? runState.questionForms.length : 0);
if (questionFormCount > 0 && !allowQuestionForm) {
  errors.push(`Open Design emitted ${questionFormCount} question form marker(s); automation must answer them and rerun before this concept can pass.`);
}
if (manifest?.sourceUrl && !fs.existsSync(brandSpecPath)) {
  errors.push('sourceUrl is present, so brand-spec.md must exist');
}
if (requireQualityAudit && !qualityAudit) {
  errors.push('concept-quality-audit.json is required. Run npm run open-design:audit-concept -- --client <client> before accepting the concept.');
}
if (qualityAudit && qualityAudit.ok !== true) {
  errors.push(`concept-quality-audit.json did not pass. Score ${qualityAudit.score}; findings: ${(qualityAudit.findings || []).map((item) => item.code).join(', ') || 'unknown'}`);
}

const files = manifest?.files || [];
const htmlFiles = files.filter((file) => file.kind === 'html' || file.path?.endsWith('.html'));
const assetFiles = files.filter((file) => file.kind === 'image' || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.path || ''));
const sourcePages = files.filter((file) => {
  const normalized = String(file.path || '').replace(/\\/g, '/');
  return /^source-.*\.html$/i.test(normalized) || /^source\/[^/]+\.html$/i.test(normalized);
});

if (!htmlFiles.some((file) => file.path === 'index.html')) errors.push('manifest must include index.html');
if (manifest?.sourceUrl && assetFiles.length === 0) warnings.push('source redesign concept has no exported image assets');
if (requireSourcePages && sourcePages.length === 0) errors.push('expected captured source-*.html pages');

if (requireScreenshots) {
  const screenshots = manifest?.screenshots || [];
  if (!Array.isArray(screenshots) || screenshots.length === 0) {
    errors.push('manifest screenshots array is required');
  } else {
    for (const screenshot of screenshots) {
      const screenshotPath = path.join(conceptDir, screenshot);
      if (!fs.existsSync(screenshotPath)) errors.push(`screenshot missing on disk: ${screenshot}`);
    }
  }
}

const result = {
  ok: errors.length === 0,
  conceptDir,
  clientSlug: manifest?.clientSlug || clientSlug || null,
  projectId: manifest?.projectId || null,
  runId: manifest?.lastRunId || manifest?.runId || null,
  initialRunId: manifest?.runId || null,
  status: manifest?.status?.status || status?.status || null,
  nativeCleanFinish: Boolean((runState?.nativeCleanFinish) || (eventsText && /event:\s*end\b/.test(eventsText) && !manifest?.status?.completionMode && !status?.completionMode)),
  completionMode: manifest?.status?.completionMode || status?.completionMode || null,
  questionFormCount,
  qualityAudit: qualityAudit ? {
    ok: qualityAudit.ok,
    score: qualityAudit.score,
    findingCount: Array.isArray(qualityAudit.findings) ? qualityAudit.findings.length : 0,
  } : null,
  counts: {
    files: files.length,
    htmlFiles: htmlFiles.length,
    sourcePages: sourcePages.length,
    imageAssets: assetFiles.length,
    screenshots: Array.isArray(manifest?.screenshots) ? manifest.screenshots.length : 0,
    requiredTextChecks: requiredContains.length,
  },
  warnings,
  errors,
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label} is missing: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label} is invalid JSON: ${error.message}`);
    return null;
  }
}

function readText(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label} is missing: ${filePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readTextOptional(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function toArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function booleanArg(argsObject, key) {
  return argsObject[key] === true || argsObject[key] === 'true' || argsObject[key] === '1';
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? next : true;
    if (parsed[key] === undefined) {
      parsed[key] = value;
    } else if (Array.isArray(parsed[key])) {
      parsed[key].push(value);
    } else {
      parsed[key] = [parsed[key], value];
    }
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
