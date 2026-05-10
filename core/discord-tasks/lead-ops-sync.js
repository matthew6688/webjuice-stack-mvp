import fs from 'fs';
import path from 'path';
import { addEvidenceItem, createEvidencePack, saveEvidencePack } from '../evidence/evidence.js';
import { runLeadOps, saveLeadOpsArtifacts } from '../leads/lead-ops.js';
import { buildWebsiteTaskThreadTitle } from './thread-title.js';
import { buildDiscordThreadSnapshot, writeDiscordThreadSnapshot } from './thread-sync.js';

export function extractLeadCandidatesFromThreadMessages(messages = []) {
  const content = selectLeadSyncContent(messages);
  const blocks = splitLeadBlocks(primaryLeadSection(content));
  const candidates = blocks
    .map(parseLeadBlock)
    .filter((lead) => lead.businessName && (lead.phone || lead.address || lead.status || lead.observation))
    .filter((lead) => !/(次级|需要再确认|中强|低一点置信度|低置信度)/i.test(`${lead.status} ${lead.observation}`));
  return dedupeCandidates(candidates);
}

function selectLeadSyncContent(messages) {
  const contents = (messages || []).map((message) => String(message.content || '')).filter(Boolean);
  const preferred = [...contents].reverse().find((content) => /lead sync|sync to admin|优先跟进|整理成.*lead/i.test(content));
  return preferred || contents.join('\n\n');
}

export function syncLeadOpsCandidatesFromThread({
  clientLeads,
  thread,
  messages,
  sourceLabel = 'Discord lead-ops thread',
  clientsRoot = 'clients',
  now = new Date().toISOString(),
} = {}) {
  const synced = [];
  for (const candidate of clientLeads || []) {
    const clientSlug = resolveExistingClientSlug({ candidate, clientsRoot }) || candidate.clientSlug || slugify(candidate.businessName);
    const threadUrl = threadUrlFrom(thread);
    const evidencePath = writeLeadEvidence({ candidate, clientSlug, threadUrl, clientsRoot });
    const result = runLeadOps({
      ...candidate,
      clientSlug,
      sourceType: 'google_search',
      leadId: `discord-thread:${thread?.id || 'unknown'}:${clientSlug}`,
      evidencePath,
      paths: leadArtifactPaths({ clientsRoot, clientSlug }),
      observations: [
        candidate.observation,
        candidate.status ? `Discovery status: ${candidate.status}` : '',
        `Imported from ${sourceLabel}.`,
      ].filter(Boolean),
      notes: [
        'Imported from Discord lead-ops thread; verify public facts before customer-facing copy.',
      ],
    });
    const paths = saveLeadOpsArtifacts(result);
    writeDiscoveryLog({ candidate, result, paths, clientSlug, threadUrl, clientsRoot, now });
    const snapshot = buildDiscordThreadSnapshot({ clientSlug, thread, messages, syncedAt: now });
    const discordThreadPath = writeDiscordThreadSnapshot(snapshot, { clientsRoot });
    writeImportNote({ candidate, clientSlug, threadUrl, clientsRoot, now });
    synced.push({
      clientSlug,
      businessName: candidate.businessName,
      pipelineHint: result.summary?.readyToBuildStatus || result.summary?.previewability || '',
      paths: { ...paths, evidence: evidencePath, discordThread: discordThreadPath },
    });
  }
  return {
    ok: true,
    count: synced.length,
    synced,
    suggestedThreadTitle: buildWebsiteTaskThreadTitle({
      stage: synced.length ? 'ready_for_mockup' : 'needs_human',
      businessName: synced.length === 1 ? synced[0].businessName : `Lead ops (${synced.length})`,
      industry: clientLeads?.[0]?.industry || 'lead discovery',
      city: clientLeads?.[0]?.city || '',
    }),
  };
}

function resolveExistingClientSlug({ candidate, clientsRoot }) {
  if (!candidate?.businessName || !fs.existsSync(clientsRoot)) return '';
  const targetName = normalizeName(candidate.businessName);
  const matches = [];
  for (const entry of fs.readdirSync(clientsRoot)) {
    const intakePath = path.join(clientsRoot, entry, 'lead', 'lead-intake.json');
    if (!fs.existsSync(intakePath)) continue;
    try {
      const intake = JSON.parse(fs.readFileSync(intakePath, 'utf8'));
      const name = normalizeName(intake.project?.businessName || intake.facts?.verified?.businessName || '');
      if (name && name === targetName) matches.push(entry);
    } catch {
      // Ignore broken partial lead folders; lead registry validation will catch them elsewhere.
    }
  }
  if (!matches.length) return '';
  const cityHint = slugify(candidate.city || '');
  if (cityHint) {
    const cityMatch = matches.find((entry) => entry.includes(cityHint) || (cityHint.includes('brisbane') && entry.includes('brisbane')));
    if (cityMatch) return cityMatch;
  }
  return matches.sort((a, b) => b.length - a.length)[0] || '';
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function leadArtifactPaths({ clientsRoot, clientSlug }) {
  return {
    intake: path.join(clientsRoot, clientSlug, 'lead', 'lead-intake.json'),
    research: path.join(clientsRoot, clientSlug, 'lead', 'lead-research.json'),
    redesignCheck: path.join(clientsRoot, clientSlug, 'lead', 'redesign-check.json'),
    readyToBuild: path.join(clientsRoot, clientSlug, 'lead', 'ready-to-build.json'),
    outreachBrief: path.join(clientsRoot, clientSlug, 'outreach', 'outreach-brief.json'),
    leadOps: path.join(clientsRoot, clientSlug, 'lead', 'lead-ops.json'),
  };
}

function splitLeadBlocks(content) {
  const normalized = String(content || '').replace(/\r/g, '');
  const headingBlocks = normalized.split(/\n(?=#{2,3}\s*\d+\)|#{2,3}\s*\d+\.|\d+\.\s+\*\*)/g);
  const useful = headingBlocks.filter((block) => /(?:地址|电话|状态|备注|Google Maps|Add website|官网|facebook|未见)/i.test(block));
  if (useful.length) return useful;
  return normalized.split(/\n(?=\d+\.\s+\*\*)/g);
}

function primaryLeadSection(content) {
  const text = String(content || '');
  const priorityStart = text.search(/(?:优先跟进|优先候选|强候选)/i);
  if (priorityStart < 0) return text;
  const rest = text.slice(priorityStart);
  const nextSection = rest.search(/\n\s*(?:#{1,3}\s*)?(?:\d+\)?\.?\s*)?(?:次级候选|已跳过|低一点置信度)/i);
  return nextSection > 0 ? rest.slice(0, nextSection) : rest;
}

function parseLeadBlock(block) {
  const title = firstMatch(block, [
    /#{2,3}\s*\d+\)?\.?\s+([^\n]+)/,
    /\d+\.\s+\*\*([^*]+)\*\*/,
    /###\s+([^\n]+)/,
  ]);
  const businessName = cleanTitle(title);
  const address = firstMatch(block, [
    /地址[:：]\s*([^\n]+)/,
    /可见地址[:：]\s*([^\n]+)/,
  ]);
  const phone = firstMatch(block, [
    /电话[:：]\s*([^\n]+)/,
    /Phone[:：]\s*([^\n]+)/i,
  ]);
  const status = firstMatch(block, [
    /状态[:：]\s*([^\n]+)/,
    /Google Maps[:：]\s*([^\n]+)/,
  ]);
  const note = firstMatch(block, [
    /备注[:：]\s*([^\n]+)/,
    /结论[:：]\s*([^\n]+)/,
  ]);
  const city = inferCity(address || block);
  const socialLinks = /facebook/i.test(block) ? ['https://facebook.com/'] : [];
  const industry = inferIndustry(block, businessName);
  return {
    clientSlug: slugify(businessName),
    businessName,
    industry,
    city,
    country: city ? 'Australia' : '',
    address: cleanInline(address),
    phone: cleanInline(phone),
    socialLinks,
    services: inferServices({ businessName, block, industry }),
    status: cleanInline(status),
    observation: cleanInline(note || status || 'Discord lead discovery candidate.'),
  };
}

function writeLeadEvidence({ candidate, clientSlug, threadUrl, clientsRoot }) {
  const evidence = createEvidencePack({ clientSlug, niche: candidate.industry, businessName: candidate.businessName });
  const add = (key, value, confidence = 0.76) => {
    if (!value) return;
    addEvidenceItem(evidence, {
      key,
      value,
      sourceType: 'manual',
      confidence,
      extractor: 'discord_lead_ops_sync',
      sourceUrl: threadUrl,
      metadata: { status: candidate.status || '', observation: candidate.observation || '' },
    });
  };
  add('identity.name', candidate.businessName, 0.84);
  add('business.niche', candidate.industry, 0.8);
  add('business.city', candidate.city, 0.76);
  add('contact.address', candidate.address, 0.76);
  add('contact.phone', candidate.phone, 0.8);
  for (const social of candidate.socialLinks || []) add('social.facebook', social, 0.68);
  if (/add website|未见|no independent|无独立官网|只有 facebook/i.test(`${candidate.status} ${candidate.observation}`)) {
    add('opportunity.noDedicatedWebsiteFound', 'true', 0.72);
  }
  for (const service of candidate.services || []) {
    add(`services.${slugify(service).replace(/-/g, '_')}`, service, 0.68);
  }
  const outputPath = path.join(clientsRoot, clientSlug, 'evidence', 'evidence.json');
  saveEvidencePack(evidence, outputPath);
  return outputPath;
}

function writeDiscoveryLog({ candidate, result, paths, clientSlug, threadUrl, clientsRoot, now }) {
  const leadDir = path.join(clientsRoot, clientSlug, 'lead');
  fs.mkdirSync(leadDir, { recursive: true });
  const entries = [
    {
      event: 'discord_search_task_received',
      at: now,
      tool: 'website-agent / Discord',
      summary: 'Lead imported from Discord lead-ops thread.',
      sourceUrl: threadUrl,
      outputPath: '',
      data: { businessName: candidate.businessName },
    },
    {
      event: 'web_search_result_matched',
      at: now,
      tool: 'Discord lead discovery',
      summary: `${candidate.businessName}: ${candidate.status || candidate.observation || 'candidate recorded'}`,
      sourceUrl: threadUrl,
      outputPath: paths.leadOps,
      data: { address: candidate.address, phone: candidate.phone },
    },
    {
      event: 'lead_ops_run',
      at: now,
      tool: 'lead-ops skill',
      summary: `stage=${result.summary.previewability}; ready=${result.summary.readyToBuildStatus}; channel=${result.summary.outreachChannel}`,
      sourceUrl: threadUrl,
      outputPath: paths.leadOps,
      data: result.summary,
    },
  ];
  fs.writeFileSync(path.join(leadDir, 'discovery-log.jsonl'), `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');
}

function writeImportNote({ candidate, clientSlug, threadUrl, clientsRoot, now }) {
  const notePath = path.join(clientsRoot, clientSlug, 'outreach', 'lead-notes.jsonl');
  fs.mkdirSync(path.dirname(notePath), { recursive: true });
  fs.appendFileSync(notePath, `${JSON.stringify({
    id: `lead_note_discord_sync_${Date.now()}_${clientSlug}`,
    type: 'lead_note',
    actor: 'website-agent-discord-sync',
    action: '',
    note: `Imported from Discord lead-ops thread ${threadUrl}. ${candidate.observation || ''}`.trim(),
    createdAt: now,
  })}\n`, 'utf8');
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = slugify(`${candidate.businessName}-${candidate.phone || candidate.address || ''}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferIndustry(block, businessName = '') {
  const explicit = firstMatch(block, [
    /行业[:：]\s*([^\n]+)/,
    /业务类型[:：]\s*([^\n]+)/,
    /Industry[:：]\s*([^\n]+)/i,
  ]);
  if (explicit) return cleanInline(explicit);
  const text = `${businessName} ${block}`.toLowerCase();
  if (/roof|gutter|restoration|pressure clean/.test(text)) return 'roofing';
  if (/plumb/.test(text)) return 'plumber';
  if (/landscap|garden/.test(text)) return 'landscaper';
  if (/fence/.test(text)) return 'fence installer';
  if (/hvac|air conditioning|heating/.test(text)) return 'HVAC';
  if (/dental|dentist/.test(text)) return 'dental practice';
  if (/salon|hair|beauty/.test(text)) return 'salon';
  if (/law|legal|lawyer/.test(text)) return 'law firm';
  if (/real estate|realtor/.test(text)) return 'real estate agent';
  if (/photograph/.test(text)) return 'photographer';
  if (/venue|wedding|event/.test(text)) return 'event venue';
  if (/restaurant|vietnamese|chicken|ramen|cafe|bar|bistro/.test(text)) return 'restaurant';
  return 'local business';
}

function inferServices({ businessName, block, industry }) {
  const explicit = firstMatch(block, [
    /服务[:：]\s*([^\n]+)/,
    /主营[:：]\s*([^\n]+)/,
    /Services[:：]\s*([^\n]+)/i,
  ]);
  if (explicit) return cleanInline(explicit).split(/[,，、/]+/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
  if (industry !== 'restaurant') return inferGenericServices(industry, block);
  return inferRestaurantServices(businessName, block);
}

function inferGenericServices(industry, block) {
  const text = `${industry} ${block}`.toLowerCase();
  if (text.includes('roof')) return ['roof repairs', 'roof restoration', 'gutters', 'quote / inspection'];
  if (text.includes('plumb')) return ['plumbing repairs', 'emergency service', 'quote / inspection'];
  if (text.includes('landscap')) return ['landscaping', 'garden maintenance', 'outdoor improvements'];
  if (text.includes('fence')) return ['fence installation', 'fence repairs', 'quote / inspection'];
  if (text.includes('dental')) return ['general dentistry', 'appointments', 'patient enquiries'];
  if (text.includes('salon')) return ['hair services', 'colour', 'booking'];
  if (text.includes('law')) return ['consultations', 'practice areas', 'client enquiries'];
  if (text.includes('venue')) return ['events', 'functions', 'enquiries'];
  return ['core service', 'service area', 'get in touch'];
}

function inferRestaurantServices(name, block) {
  const text = `${name} ${block}`.toLowerCase();
  if (text.includes('vietnamese')) return ['Vietnamese restaurant', 'casual dining', 'takeaway'];
  if (text.includes('chicken') || text.includes('haeduri')) return ['Korean chicken', 'casual dining', 'takeaway'];
  if (text.includes('ramen')) return ['ramen', 'casual dining', 'takeaway'];
  return ['restaurant', 'casual dining', 'takeaway'];
}

function inferCity(value) {
  const text = String(value || '');
  if (/Fortitude Valley/i.test(text)) return 'Fortitude Valley';
  if (/South Brisbane/i.test(text)) return 'South Brisbane';
  if (/Brisbane/i.test(text)) return 'Brisbane City';
  return '';
}

function threadUrlFrom(thread) {
  return thread?.guild_id && thread?.id ? `https://discord.com/channels/${thread.guild_id}/${thread.id}` : '';
}

function cleanTitle(value) {
  return cleanInline(value)
    .replace(/^\d+\)?\.?\s*/, '')
    .replace(/\*\*/g, '')
    .trim();
}

function cleanInline(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(value, patterns) {
  for (const pattern of patterns) {
    const match = String(value || '').match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
