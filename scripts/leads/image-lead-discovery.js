#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { appendTaskLog, mirrorTaskLogToDiscord } from '../../core/discord-tasks/task-log.js';
import { createEvidencePack, addEvidenceItem, saveEvidencePack } from '../../core/evidence/evidence.js';
import { runLeadOps, saveLeadOpsArtifacts } from '../../core/leads/lead-ops.js';

const args = parseArgs(process.argv.slice(2));

if (!args.input) {
  console.error('Usage: node scripts/leads/image-lead-discovery.js --input data/lead-image.json');
  process.exit(1);
}

const inputPath = path.resolve(args.input);
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const clientSlug = input.clientSlug || slugify(input.businessName || input.phone || 'image-lead');
const clientDir = path.join('clients', clientSlug);
const leadDir = path.join(clientDir, 'lead');
const evidenceDir = path.join(clientDir, 'evidence');
const outreachDir = path.join(clientDir, 'outreach');
const logPath = path.join(leadDir, 'discovery-log.jsonl');
const taskContext = loadTaskContext(args.task);

fs.mkdirSync(leadDir, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(outreachDir, { recursive: true });

const logEntries = [];
const log = (event, data = {}) => {
  logEntries.push({
    event,
    at: new Date().toISOString(),
    tool: data.tool || 'image-lead-discovery skill',
    summary: data.summary || '',
    detail: data.detail || '',
    sourceUrl: data.sourceUrl || '',
    outputPath: data.outputPath || '',
    data: data.data || {},
  });
};

const discordSourceUrl = input.discord?.sourceUrl
  || `discord://${input.discord?.workspace || 'website-leads'}/${input.discord?.channelId || 'unknown'}/${input.discord?.messageId || 'simulated'}`;

log('discord_image_received', {
  summary: `channel=${input.discord?.workspace || 'website-leads'}；attachment=${input.image?.name || 'image'}`,
  sourceUrl: discordSourceUrl,
  data: { discord: input.discord || {}, image: input.image || {} },
});

log('ocr_text_recorded', {
  summary: summarizeOcr(input.ocrText),
  sourceUrl: discordSourceUrl,
});

for (const query of input.search?.queries || []) {
  log('web_search_query', {
    tool: 'web search',
    summary: query,
    sourceUrl: query,
  });
}

for (const result of input.search?.results || []) {
  log('web_search_result_matched', {
    tool: 'web search',
    summary: result.summary || `${result.title || result.url} matched ${result.match || 'lead evidence'}`,
    sourceUrl: result.url || '',
    data: result,
  });
}

if (input.search?.noDedicatedWebsiteFound) {
  log('web_search_result_matched', {
    tool: 'web search',
    summary: '搜索没有找到独立官网，只找到目录页/社媒；这是正向机会信号，说明 starter website 更有销售价值。',
    data: { noDedicatedWebsiteFound: true },
  });
}

for (const conflict of input.conflicts || []) {
  log('conflict_recorded', {
    summary: conflict,
  });
}

const enriched = buildLeadInput({ input, clientSlug });
const evidence = buildEvidence({ input, enriched, clientSlug, discordSourceUrl });
const evidencePath = path.join(evidenceDir, 'evidence.json');
saveEvidencePack(evidence, evidencePath);
log('evidence_written', {
  summary: `写入 ${evidence.items.length} 条证据`,
  outputPath: evidencePath,
});

const result = runLeadOps({ ...enriched, evidencePath });
const paths = saveLeadOpsArtifacts(result, {
  intake: path.join(leadDir, 'lead-intake.json'),
  research: path.join(leadDir, 'lead-research.json'),
  redesignCheck: path.join(leadDir, 'redesign-check.json'),
  readyToBuild: path.join(leadDir, 'ready-to-build.json'),
  outreachBrief: path.join(outreachDir, 'outreach-brief.json'),
  leadOps: path.join(leadDir, 'lead-ops.json'),
});
log('lead_ops_run', {
  summary: `stage=${result.summary.previewability}；ready=${result.summary.readyToBuildStatus}；channel=${result.summary.outreachChannel}`,
  outputPath: paths.leadOps,
});

fs.writeFileSync(logPath, `${logEntries.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');
const taskLogResult = await writeTaskLogs({ taskContext, logEntries, result, paths, clientSlug });

const sourceMarkdown = [
  '# Discord Image Lead Source',
  '',
  `- channel: ${input.discord?.workspace || 'website-leads'}`,
  `- channelId: ${input.discord?.channelId || ''}`,
  `- sourceUrl: ${discordSourceUrl}`,
  `- image: ${input.image?.name || ''}`,
  '',
  '## OCR / Operator Text',
  '',
  input.ocrText || '',
  '',
  '## Search Evidence',
  '',
  ...(input.search?.results || []).map((result) => `- ${result.title || result.url}: ${result.summary || result.match || ''} (${result.url || 'no url'})`),
  '',
  '## Conflicts / Verify Before Customer Copy',
  '',
  ...((input.conflicts || []).length ? input.conflicts.map((conflict) => `- ${conflict}`) : ['- None recorded']),
  '',
].join('\n');
fs.writeFileSync(path.join(leadDir, 'discord-image-source.md'), sourceMarkdown, 'utf8');

const summary = {
  ok: true,
  clientSlug,
  inputPath: path.relative(process.cwd(), inputPath),
  evidencePath,
  discoveryLogPath: logPath,
  taskLogPath: taskLogResult.taskLogPath,
  paths,
  leadOpsSummary: result.summary,
  contactability: result.research.contactability,
  previewability: result.research.previewability,
  productionReadiness: result.research.productionReadiness,
  verified: result.research.facts.verified,
  inferred: result.research.facts.inferred,
  outreach: result.outreachBrief,
};
const qaDir = path.join('data', 'qa', 'discord-image-lead', clientSlug);
fs.mkdirSync(qaDir, { recursive: true });
fs.writeFileSync(path.join(qaDir, 'skill-run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

console.log(JSON.stringify(summary, null, 2));

async function writeTaskLogs({ taskContext, logEntries, result, paths, clientSlug }) {
  if (!taskContext?.logPath) return { ok: false, skipped: true, reason: 'missing_task_log_path', taskLogPath: '' };
  const entries = logEntries.map((entry) => appendTaskLog(taskContext.logPath, {
    event: eventKind(entry.event),
    stage: '图片线索识别',
    tool: entry.tool || 'image-lead-discovery',
    input: entry.detail || entry.sourceUrl || '',
    output: entry.summary || '',
    evidencePath: entry.outputPath || '',
    sourceUrl: entry.sourceUrl || '',
    decision: '',
    reason: '',
    nextAction: '',
    data: { originalEvent: entry.event, ...(entry.data || {}) },
  }));
  const decisionEntry = appendTaskLog(taskContext.logPath, {
    event: 'decision',
    stage: 'lead-ops',
    tool: 'lead-ops',
    output: `client=${clientSlug}; previewability=${result.summary.previewability}; ready=${result.summary.readyToBuildStatus}`,
    evidencePath: paths.leadOps,
    decision: result.summary.readyToBuildStatus,
    reason: result.summary.decision || result.research?.previewability?.reason || '',
    nextAction: result.outreachBrief?.nextAction || result.summary.nextAction || '',
  });
  if (args['send-discord'] && taskContext.threadId) {
    const botToken = args.token || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
    for (const entry of [...entries, decisionEntry]) {
      await mirrorTaskLogToDiscord({ threadId: taskContext.threadId, botToken, entry });
    }
  }
  return { ok: true, taskLogPath: taskContext.logPath, entries: entries.length + 1 };
}

function loadTaskContext(taskPath) {
  if (!taskPath) return null;
  const resolved = path.resolve(taskPath);
  if (!fs.existsSync(resolved)) throw new Error(`Task file does not exist: ${resolved}`);
  const task = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return {
    task,
    taskPath: path.relative(process.cwd(), resolved),
    logPath: task.artifacts?.logPath || path.join(path.dirname(path.relative(process.cwd(), resolved)), 'task-log.jsonl'),
    threadId: task.thread?.id || '',
  };
}

function eventKind(event) {
  if (String(event || '').includes('search')) return 'tool';
  if (String(event || '').includes('evidence')) return 'evidence';
  if (String(event || '').includes('conflict')) return 'decision';
  return 'tool';
}

function buildLeadInput({ input, clientSlug }) {
  const bestSearch = (input.search?.results || []).find((item) => item.businessName || item.email || item.facebookUrl || item.address) || {};
  return {
    clientSlug,
    sourceType: 'image_ocr',
    businessName: bestSearch.businessName || input.businessName || '',
    industry: input.industry || input.businessScope || '',
    city: bestSearch.city || input.city || '',
    country: input.country || '',
    phone: input.phone || bestSearch.phone || '',
    email: bestSearch.email || input.email || '',
    facebookUrl: bestSearch.facebookUrl || input.facebookUrl || '',
    websiteUrl: bestSearch.websiteUrl || input.websiteUrl || '',
    contactPageUrl: bestSearch.contactPageUrl || input.contactPageUrl || '',
    observations: [
      ...(input.observations || []),
      ...(input.search?.results || []).map((result) => result.summary).filter(Boolean),
      ...(input.conflicts || []).map((conflict) => `Verify before using: ${conflict}`),
    ],
    services: input.services || [],
    notes: input.notes || [],
  };
}

function buildEvidence({ input, enriched, clientSlug, discordSourceUrl }) {
  const evidence = createEvidencePack({ clientSlug, niche: enriched.industry, businessName: enriched.businessName });
  const add = (key, value, sourceType, confidence, extractor, sourceUrl = discordSourceUrl, metadata = {}) => {
    if (!value) return;
    addEvidenceItem(evidence, { key, value, sourceType, confidence, extractor, sourceUrl, metadata });
  };

  add('identity.name', input.businessName, 'image_ocr', input.businessNameConfidence || 0.62, 'operator_supplied_ocr', discordSourceUrl, {
    note: input.businessNameNote || '',
  });
  add('business.niche', enriched.industry, 'image_ocr', 0.88, 'operator_supplied_ocr', discordSourceUrl);
  add('contact.phone', enriched.phone, 'image_ocr', 0.93, 'operator_supplied_ocr', discordSourceUrl);
  add('cta.call', enriched.phone ? `tel:${String(enriched.phone).replace(/[^\d+]/g, '')}` : '', 'image_ocr', 0.9, 'operator_supplied_ocr', discordSourceUrl);

  for (const service of enriched.services || []) {
    add(`services.${slugify(service).replace(/-/g, '_')}`, service, 'image_ocr', 0.84, 'operator_supplied_ocr', discordSourceUrl);
  }
  for (const item of input.evidence || []) {
    add(item.key, item.value, item.sourceType || 'manual', item.confidence ?? 0.75, item.extractor || 'operator_note', item.sourceUrl || discordSourceUrl, item.metadata || {});
  }
  for (const result of input.search?.results || []) {
    const url = result.url || '';
    add('identity.name', result.businessName, 'manual', result.confidence || 0.86, 'web_search_phone_match', url, { phoneMatched: enriched.phone || input.phone || '' });
    add('business.city', result.city, 'manual', result.confidence || 0.76, 'web_search_phone_match', url);
    add('contact.address', result.address, 'manual', result.confidence || 0.76, 'web_search_phone_match', url);
    add('contact.email', result.email, 'manual', result.confidence || 0.78, 'web_search_phone_match', url);
    add('social.facebook', result.facebookUrl, 'manual', result.confidence || 0.74, 'web_search_phone_match', url);
    for (const service of result.services || []) {
      add(`services.${slugify(service).replace(/-/g, '_')}`, service, 'manual', result.confidence || 0.78, 'web_search_phone_match', url);
    }
  }
  if (input.search?.noDedicatedWebsiteFound) {
    add('opportunity.noDedicatedWebsiteFound', 'true', 'manual', 0.82, 'web_search_review', input.search.results?.[0]?.url || discordSourceUrl, {
      note: 'Phone/name search found directory/social presence but no dedicated website.',
    });
  }
  return evidence;
}

function summarizeOcr(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > 130 ? `${text.slice(0, 130)}...` : text;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'image-lead';
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
