#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';

const args = parseArgs(process.argv.slice(2));
const clientSlug = clean(args['client-slug'] || args.clientSlug || args.client_slug);
const clientsRoot = args['clients-root'] || args.clientsRoot || 'clients';
const casesRoot = args['cases-root'] || args.casesRoot || 'data/cases';
const paidIntakesRoot = args['paid-intakes-root'] || args.paidIntakesRoot || 'data/paid-intakes';
const discoveryRoot = args['discovery-root'] || args.discoveryRoot || 'data/leads';
const dryRun = args['dry-run'] === true || args['dry-run'] === 'true' || args.dryRun === true || args.dryRun === 'true';

if (!clientSlug) {
  console.error(JSON.stringify({ ok: false, error: 'client_slug is required' }, null, 2));
  process.exit(1);
}

const index = loadLeadOutreachIndex({ clientsRoot, casesRoot, paidIntakesRoot, discoveryRoot });
const record = index.records.find((item) => item.clientSlug === clientSlug);
if (!record) {
  console.error(JSON.stringify({ ok: false, error: `Lead not found: ${clientSlug}` }, null, 2));
  process.exit(1);
}
if (!['mockup_ready', 'draft_ready'].includes(record.pipelineStage)) {
  console.error(JSON.stringify({
    ok: false,
    error: `Lead is not ready for outreach draft: ${record.pipelineStage}`,
    clientSlug,
    pipelineStage: record.pipelineStage,
  }, null, 2));
  process.exit(1);
}
if (!record.outreachPackPath || !record.previewUrl || !record.assetsReady) {
  console.error(JSON.stringify({
    ok: false,
    error: 'outreach pack, previewUrl, and proof assets are required before drafting outreach',
    clientSlug,
    outreachPackPath: record.outreachPackPath || '',
    previewUrl: record.previewUrl || '',
    assetsReady: Boolean(record.assetsReady),
  }, null, 2));
  process.exit(1);
}

const pack = readJsonIfExists(record.outreachPackPath) || {};
const emailDir = path.join(clientsRoot, clientSlug, 'outreach', 'email');
const slug = slugify(record.company || record.businessName || clientSlug);
const artifactPath = path.join(emailDir, `01-${slug}.json`);
const markdownPath = path.join(emailDir, `01-${slug}.md`);
const draft = buildDraft(record, pack);

if (!dryRun) {
  fs.mkdirSync(emailDir, { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(draft, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, buildMarkdown(draft), 'utf8');
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  clientSlug,
  previousStage: record.pipelineStage,
  nextExpectedStage: 'draft_ready',
  artifactPath,
  markdownPath,
  subject: draft.subject,
  to: draft.to,
}, null, 2));

function buildDraft(record, pack) {
  const businessName = record.company || record.businessName || pack.business?.name || clientSlug;
  const firstName = firstWord(businessName);
  const previewUrl = record.previewUrl || pack.previewUrl || '';
  const proofPoints = uniqueValues([
    record.outreachPrimaryProofPoint,
    ...(Array.isArray(pack.emailBrief?.proofPoints) ? pack.emailBrief.proofPoints : []),
    ...(Array.isArray(pack.outreachBrief?.proofPoints) ? pack.outreachBrief.proofPoints : []),
  ]).slice(0, 5);
  const diagnosis = clean(record.outreachDiagnosis || pack.outreachBrief?.diagnosis || record.currentSiteAuditSummary || record.customerOpportunitySummary);
  const hook = clean(record.outreachColdMessage || pack.outreachBrief?.coldMessage || record.currentSiteOutreachHook);
  const subject = clean(args.subject || pack.emailBrief?.subject || pack.outreachBrief?.subjectLines?.[0])
    || `${businessName}: website preview`;
  const text = [
    `Hi ${firstName},`,
    '',
    hook || `I put together a website preview for ${businessName}.`,
    '',
    `Preview: ${previewUrl}`,
    diagnosis ? `What stood out: ${diagnosis}` : '',
    '',
    'Proof points I checked before drafting this:',
    ...proofPoints.map((item) => `- ${item}`),
    pack.assets?.screenshots?.desktop ? `- Desktop screenshot: ${pack.assets.screenshots.desktop}` : '',
    pack.assets?.screenshots?.mobile ? `- Mobile screenshot: ${pack.assets.screenshots.mobile}` : '',
    pack.assets?.video ? `- Demo video: ${pack.assets.video}` : '',
    '',
    'If this direction is useful, we can refine it or turn it into a live site.',
    '',
    'Best,',
    'Matthew',
    'Profits Local',
  ].filter((line) => line !== '').join('\n');
  return {
    schemaVersion: 1,
    kind: 'cold_outreach_draft',
    provider: args.provider || 'manual',
    dryRun: true,
    generatedAt: new Date().toISOString(),
    clientSlug,
    businessName,
    to: clean(args.to || args.email || record.email || record.customerEmail || record.leadRecipientEmail),
    from: args.from || 'Profits Local <hi@profitslocal.com>',
    replyTo: args['reply-to'] || args.replyTo || '',
    subject,
    text,
    html: buildHtml({ businessName, subject, text, previewUrl, proofPoints }),
    previewUrl,
    proofAssets: pack.assets || {},
    audit: pack.audit || null,
    source: {
      outreachPackPath: record.outreachPackPath,
      previewUrl,
      generatedBy: 'scripts/leads/build-outreach-email-draft.js',
    },
    sendResult: {
      status: 'draft',
      provider: args.provider || 'manual',
      sourceSystem: 'manual',
      sentAt: '',
      id: '',
      externalCampaignId: '',
      externalLeadId: '',
      externalMessageId: '',
      externalThreadUrl: '',
      nextFollowUpDue: '',
      replyState: '',
      bounceState: '',
      note: 'Draft only. No email was sent.',
    },
  };
}

function buildHtml({ businessName, subject, text, previewUrl, proofPoints }) {
  const paragraphs = text.split('\n\n').map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('\n');
  const bullets = proofPoints.length
    ? `<ul>${proofPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#fff8ed;color:#17191c;font-family:Arial,sans-serif;">
    <main style="max-width:680px;margin:0 auto;background:#fffdf8;border:2px solid #17191c;padding:28px;">
      <p style="margin:0 0 8px;color:#ff5a3d;font-weight:800;text-transform:uppercase;font-size:12px;">Website preview prepared</p>
      <h1 style="margin:0 0 18px;font-size:32px;line-height:1.1;">${escapeHtml(businessName)}</h1>
      ${paragraphs}
      ${bullets}
      ${previewUrl ? `<p><a href="${escapeAttribute(previewUrl)}" style="display:inline-block;background:#ff5a3d;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:800;">Open preview</a></p>` : ''}
    </main>
  </body>
</html>
`;
}

function buildMarkdown(draft) {
  return [
    `# ${draft.subject}`,
    '',
    `To: ${draft.to || '(missing)'}`,
    `Preview: ${draft.previewUrl || '(missing)'}`,
    '',
    '```text',
    draft.text,
    '```',
    '',
  ].join('\n');
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => clean(value)).filter(Boolean))];
}

function firstWord(value) {
  return clean(value).split(/\s+/)[0] || 'there';
}

function slugify(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lead';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function clean(value) {
  return String(value || '').trim();
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
