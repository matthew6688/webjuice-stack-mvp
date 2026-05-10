import fs from 'fs';
import path from 'path';

const DEFAULT_COMPARISON_ROOT = path.join(process.cwd(), 'data', 'qa', 'document-model-comparison');
const DEFAULT_CLIENTS_ROOT = path.join(process.cwd(), 'clients');
const DEFAULT_PUBLIC_ROOT = path.join(process.cwd(), 'public');

export function loadAdminReportIndex({
  comparisonRoot = DEFAULT_COMPARISON_ROOT,
  clientsRoot = DEFAULT_CLIENTS_ROOT,
  publicRoot = DEFAULT_PUBLIC_ROOT,
} = {}) {
  const comparison = loadDocumentComparison(comparisonRoot);
  const leadReports = loadLeadReports(clientsRoot, publicRoot);
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      leadReports: leadReports.length,
      modelProviders: comparison.providers.length,
      promptChars: comparison.prompt.length,
      payloadChars: JSON.stringify(comparison.input || {}, null, 2).length,
    },
    comparison,
    leadReports,
  };
}

export function loadDocumentComparison(comparisonRoot = DEFAULT_COMPARISON_ROOT) {
  const summary = readJson(path.join(comparisonRoot, 'document-model-comparison-report.summary.json')) || {};
  const input = readJson(path.join(comparisonRoot, 'smoke-cli', 'input.json')) || {};
  const prompt = readText(path.join(comparisonRoot, 'smoke-cli', 'prompt.txt'));
  const providers = Array.isArray(summary.providers)
    ? summary.providers.map((provider) => loadProvider(comparisonRoot, provider)).filter(Boolean)
    : [];

  return {
    ok: Boolean(summary.ok),
    selectedProvider: summary.selectedProvider || providers[0]?.label || '',
    comparisonPath: summary.comparisonPath || '',
    publicComparisonPath: summary.publicComparisonPath || '',
    leadHtmlPath: summary.leadHtmlPath || '',
    leadMdPath: summary.leadMdPath || '',
    leadJsonPath: summary.leadJsonPath || '',
    input,
    prompt,
    providers,
  };
}

export function loadLeadReports(clientsRoot = DEFAULT_CLIENTS_ROOT, publicRoot = DEFAULT_PUBLIC_ROOT) {
  if (!fs.existsSync(clientsRoot)) return [];
  return fs.readdirSync(clientsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const clientSlug = entry.name;
      const reportDir = path.join(clientsRoot, clientSlug, 'reports');
      const jsonPath = path.join(reportDir, 'discovery-report-cn.json');
      const htmlPath = path.join(reportDir, 'discovery-report-cn.html');
      const mdPath = path.join(reportDir, 'discovery-report-cn.md');
      const publicReportDir = path.join(publicRoot, 'admin-artifacts', clientSlug, 'reports');
      const publicHtmlPath = path.join(publicReportDir, 'discovery-report-cn.html');
      const publicMdPath = path.join(publicReportDir, 'discovery-report-cn.md');
      const publicJsonPath = path.join(publicReportDir, 'discovery-report-cn.json');
      const data = readJson(jsonPath);
      if (!data) return null;
      const report = data.report || {};
      return {
        clientSlug,
        title: report.title || clientSlug,
        verdict: report.verdict || '',
        confidence: report.confidence || '',
        oneLine: report.oneLine || '',
        sourceModel: report.sourceModel || data.sourceProvider || '',
        sourceProvider: data.sourceProvider || '',
        sourceRunId: data.sourceRunId || '',
        generatedAt: data.generatedAt || '',
        htmlPath: relativePath(htmlPath),
        mdPath: relativePath(mdPath),
        jsonPath: relativePath(jsonPath),
        publicHtmlHref: fs.existsSync(publicHtmlPath) ? `/${relativePath(publicHtmlPath).replace(/^public\//, '')}` : '',
        publicMdHref: fs.existsSync(publicMdPath) ? `/${relativePath(publicMdPath).replace(/^public\//, '')}` : '',
        publicJsonHref: fs.existsSync(publicJsonPath) ? `/${relativePath(publicJsonPath).replace(/^public\//, '')}` : '',
        htmlExists: fs.existsSync(htmlPath),
        mdExists: fs.existsSync(mdPath),
        jsonExists: fs.existsSync(jsonPath),
        verifiedFacts: normalizeRows(report.verifiedFacts),
        missingEvidence: Array.isArray(report.missingEvidence) ? report.missingEvidence : [],
        nextSteps: Array.isArray(report.nextSteps) ? report.nextSteps : [],
        report,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
}

function loadProvider(comparisonRoot, provider) {
  const id = providerIdForLabel(provider.label);
  const runId = provider.runId || '';
  const runRoot = path.join(comparisonRoot, runId);
  const rawPath = path.join(runRoot, `${id}.raw.txt`);
  const resultPath = path.join(runRoot, `${id}.result.json`);
  const result = readJson(resultPath) || {};
  return {
    ...provider,
    id,
    rawPath: fs.existsSync(rawPath) ? relativePath(rawPath) : '',
    resultPath: fs.existsSync(resultPath) ? relativePath(resultPath) : '',
    rawPreview: truncate(readText(rawPath), 2800),
    findings: result.evaluation?.findings || [],
    normalizedScore: result.evaluation?.normalizedScore ?? null,
    model: result.model || result.provider || '',
    ok: Boolean(result.ok),
  };
}

function providerIdForLabel(label = '') {
  const lower = label.toLowerCase();
  if (lower.includes('codex')) return 'codex';
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('qwen')) return 'ollama-qwen3-6-27b';
  if (lower.includes('deepseek')) return 'ollama-deepseek-r1-14b';
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (Array.isArray(row)) return { label: row[0] || '', value: row[1] || '' };
    return { label: row.label || row.key || '', value: row.value || '' };
  }).filter((row) => row.label || row.value);
}

function readText(filePath) {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  } catch {
    return '';
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(readText(filePath));
  } catch {
    return null;
  }
}

function relativePath(filePath) {
  return path.relative(process.cwd(), filePath);
}

function truncate(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max)}\n\n... truncated ...` : text;
}
