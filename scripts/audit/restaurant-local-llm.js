#!/usr/bin/env node

import path from 'path';
import { auditRestaurantWithLocalLlm } from '../../core/audit/restaurant-local-llm.js';

const args = parseArgs();
const clientSlug = args.client || '';
const contentPath = args.content || (clientSlug ? path.join('clients', clientSlug, 'content.restaurant.json') : '');
const evidencePath = args.evidence || (clientSlug ? path.join('clients', clientSlug, 'evidence', 'evidence.json') : '');
const outputPath = args.output || (clientSlug ? path.join('clients', clientSlug, 'audit', 'local-llm-audit.json') : '');
const failOn = args['fail-on'] || args.failOn || 'high';

if (!contentPath) {
  console.error('Usage: node scripts/audit/restaurant-local-llm.js --client slug [--model qwen3.6:27b] [--output clients/slug/audit/local-llm-audit.json]');
  console.error('   or: node scripts/audit/restaurant-local-llm.js --content content.restaurant.json [--evidence evidence.json] [--output audit.json]');
  process.exit(1);
}

const report = await auditRestaurantWithLocalLlm({
  contentPath,
  evidencePath,
  outputPath,
  model: args.model || process.env.OLLAMA_MODEL,
  ollamaUrl: args['ollama-url'] || args.ollamaUrl || process.env.OLLAMA_URL,
  timeoutMs: Number(args.timeout || 180000),
});

console.log(`Restaurant local LLM audit: ${clientSlug || contentPath}`);
console.log(`Model: ${report.model}`);
console.log(`Status: ${report.ok ? 'ok' : 'failed'} (${report.verdict}, score ${report.score ?? 'n/a'})`);
console.log(`Menu: ${report.business.menuSections} sections / ${report.business.menuItems} items`);
console.log(`Output: ${outputPath || '(not written)'}`);
console.log(`Findings: critical=${report.summary.critical} high=${report.summary.high} medium=${report.summary.medium} low=${report.summary.low}`);

for (const finding of report.findings.slice(0, 12)) {
  console.log(`- [${finding.severity}] ${finding.category}: ${finding.message}${finding.evidence ? ` (${finding.evidence})` : ''}`);
}
if (report.findings.length > 12) console.log(`... ${report.findings.length - 12} more finding(s)`);

process.exit(shouldFail(report, failOn) ? 1 : 0);

function shouldFail(report, failOn) {
  if (failOn === 'none') return false;
  if (failOn === 'critical') return report.summary.critical > 0;
  if (failOn === 'medium') return report.summary.critical > 0 || report.summary.high > 0 || report.summary.medium > 0;
  return report.summary.critical > 0 || report.summary.high > 0;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
