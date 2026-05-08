#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../core/env/load-local-env.js';
import { renderProfitsLocalEmail } from '../core/funnel/email-template.js';

loadLocalEnv();

const args = parseArgs();
const provider = String(args.provider || 'resend').toLowerCase();

if (!args.client && !args.leads) {
  console.error('Usage: node scripts/send-cold-email.js --client slug [--to you@example.com] [--provider resend|agentic-email|instantly|smartlead] [--dry true]');
  console.error('   or: node scripts/send-cold-email.js --leads leads.json [--provider resend|agentic-email|instantly|smartlead] [--dry true]');
  process.exit(1);
}

const dryRun = args.dry !== 'false';
const messages = args.client ? [buildClientMessage(args.client, args, provider)] : buildLeadMessages(args.leads, provider);
const outDir = args.outputDir || args['output-dir'] || (args.client ? path.join('clients', args.client, 'outreach', 'email') : 'outreach/email');
fs.mkdirSync(outDir, { recursive: true });

console.log(`${dryRun ? '[DRY RUN]' : '[LIVE]'} Prepared ${messages.length} cold email(s)\n`);

for (const [index, message] of messages.entries()) {
  const artifactPath = path.join(outDir, `${String(index + 1).padStart(2, '0')}-${slugify(message.businessName || 'lead')}.json`);
  const artifact = {
    ...message,
    dryRun,
    generatedAt: new Date().toISOString(),
    sendResult: dryRun ? {
      status: 'draft',
      provider: message.provider,
      sourceSystem: message.provider,
      sentAt: '',
      id: '',
      externalCampaignId: '',
      externalLeadId: '',
      externalMessageId: '',
      externalThreadUrl: '',
      nextFollowUpDue: '',
      replyState: '',
      bounceState: '',
    } : null,
  };
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(`To: ${message.to || '(missing)'}`);
  console.log(`Subject: ${message.subject}`);
  console.log(`Preview: ${message.previewUrl}`);
  console.log(`Artifact: ${artifactPath}`);
  console.log('---');

  if (!dryRun) {
    if (!message.to) throw new Error(`Missing recipient for ${message.businessName}`);
    if (message.provider === 'agentic-email') {
      artifact.sendResult = {
        status: 'draft',
        provider: message.provider,
        sourceSystem: 'agentic-email',
        sentAt: '',
        id: '',
        externalCampaignId: '',
        externalLeadId: '',
        externalMessageId: '',
        externalThreadUrl: process.env.AGENTIC_INBOX_URL || 'https://mail.profitslocal.com',
        nextFollowUpDue: '',
        replyState: '',
        bounceState: '',
        note: 'Prepared for operator review in Agentic Inbox/manual cold outreach flow. No automatic send was attempted.',
      };
      fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
      console.log(`Prepared for Agentic Inbox/manual send: ${process.env.AGENTIC_INBOX_URL || 'https://mail.profitslocal.com'}`);
      continue;
    }
    if (message.provider !== 'resend') {
      throw new Error(`Live send for provider "${message.provider}" is not implemented yet. Use --dry true and hand off to the provider integration layer.`);
    }
    const result = await sendResendEmail(message);
    artifact.sendResult = {
      status: 'sent',
      provider: message.provider,
      sourceSystem: message.provider,
      sentAt: new Date().toISOString(),
      id: result.id || '',
      externalCampaignId: '',
      externalLeadId: '',
      externalMessageId: result.id || '',
      externalThreadUrl: '',
      nextFollowUpDue: '',
      replyState: '',
      bounceState: '',
    };
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`Sent: ${result.id || JSON.stringify(result)}`);
  }
}

if (dryRun) console.log('\nDry run complete. Use --dry false only for an intentional live send.');

function buildClientMessage(clientSlug, options, provider) {
  const packPath = path.join('clients', clientSlug, 'outreach', 'outreach-pack.json');
  const contentPath = path.join('clients', clientSlug, 'content.restaurant.json');
  const auditPath = path.join('clients', clientSlug, 'audit', 'local-llm-audit.json');
  const pack = readJson(packPath);
  const content = readJson(contentPath);
  const audit = fs.existsSync(auditPath) ? readJson(auditPath) : null;
  const to = options.to || options.email || '';
  const businessName = content.hero?.name || pack.business?.name || clientSlug;
  const firstName = firstWord(businessName);
  const menuItemCount = countMenuItems(content);
  const subject = options.subject || `${businessName}: mobile menu + website preview`;
  const previewUrl = options.previewUrl || options['preview-url'] || pack.previewUrl;
  const lines = [
    `Hi ${firstName},`,
    '',
    `I put together a live preview for ${businessName}:`,
    previewUrl,
    '',
    'What I checked before sending this:',
    `- The menu is based on your official menu source: ${content.menu?.sourceUrl || pack.emailBrief?.proofPoints?.[0] || 'official source'}`,
    `- The mobile menu currently has ${menuItemCount} cleaned items across ${(content.menu?.sections || []).length} sections.`,
    `- Call, map, and reservation actions are set up for mobile visitors.`,
    audit ? `- Local AI audit: ${audit.verdict}, score ${audit.score}, ${audit.summary.total} finding(s).` : null,
    '',
    'I also generated proof assets for review:',
    `- Desktop screenshot: ${pack.assets?.screenshots?.desktop}`,
    `- Mobile screenshot: ${pack.assets?.screenshots?.mobile}`,
    `- Scroll demo video: ${pack.assets?.video}`,
    '',
    'If you like the direction, we can launch it as-is or make up to 3 rounds of changes before going live.',
    '',
    'Best,',
    'Matthew',
    'Profits Local',
  ].filter((line) => line !== null);
  const body = lines.join('\n');
  const html = buildOutreachHtml({
    businessName,
    previewUrl,
    proofPoints: [
      `Official menu source: ${content.menu?.sourceUrl || 'verified source'}`,
      `${menuItemCount} cleaned menu items across ${(content.menu?.sections || []).length} sections`,
      'Mobile actions for call, maps, and reservation are wired',
      audit ? `Local AI audit: ${audit.verdict}, score ${audit.score}, ${audit.summary.total} finding(s)` : '',
    ].filter(Boolean),
    assets: pack.assets,
    audit,
  });

  return {
    provider,
    to,
    from: options.from || process.env.FROM_EMAIL || 'Profits Local <hi@profitslocal.com>',
    replyTo: options.replyTo || options['reply-to'] || process.env.REPLY_TO_EMAIL || '',
    businessName,
    clientSlug,
    subject,
    text: body,
    html,
    previewUrl,
    proofAssets: pack.assets,
    audit: audit ? {
      verdict: audit.verdict,
      score: audit.score,
      summary: audit.summary,
    } : null,
  };
}

function buildLeadMessages(leadsPath, provider) {
  return readJson(leadsPath).map((lead) => {
    const businessName = lead.name || lead.businessName || 'your restaurant';
    const previewUrl = lead.preview || lead.previewUrl || '';
    return {
      provider,
      to: lead.email || '',
      from: process.env.FROM_EMAIL || 'Profits Local <hi@profitslocal.com>',
      replyTo: process.env.REPLY_TO_EMAIL || '',
      businessName,
      clientSlug: lead.slug || '',
      subject: `${businessName}: website preview`,
      text: [
        `Hi ${firstWord(businessName)},`,
        '',
        `I put together a live preview for ${businessName}:`,
        previewUrl,
        '',
        'It is a working preview, with mobile-friendly contact and menu links.',
        '',
        'Best,',
        'Matthew',
        'Profits Local',
      ].join('\n'),
      html: buildOutreachHtml({
        businessName,
        previewUrl,
        proofPoints: ['Working preview prepared for review', 'Mobile-friendly core contact path is included'],
        assets: {},
        audit: null,
      }),
      previewUrl,
      proofAssets: {},
      audit: null,
    };
  });
}

async function sendResendEmail(message) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const payload = {
    from: message.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  };
  if (message.replyTo) payload.reply_to = message.replyTo;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend email failed: ${res.status} ${body}`);
  return body ? JSON.parse(body) : {};
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function countMenuItems(content) {
  return (content.menu?.sections || []).reduce((sum, section) => sum + (section.items?.length || 0), 0);
}

function firstWord(value) {
  return String(value || 'there').split(/\s+/)[0].replace(/[^A-Za-z0-9'&-]/g, '') || 'there';
}

function slugify(value) {
  return String(value || 'email').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'email';
}

function buildOutreachHtml({ businessName, previewUrl, proofPoints = [], assets = {}, audit = null }) {
  return renderProfitsLocalEmail({
    eyebrow: 'Preview prepared',
    subject: `${businessName}: website preview`,
    intro: `I put together a live preview for ${businessName}. This is meant to make the decision easy: you can review the actual direction first, then decide if you want us to launch or refine it.`,
    details: [
      { label: 'Business', value: businessName },
      { label: 'Preview', value: previewUrl, url: previewUrl },
      { label: 'Desktop screenshot', value: assets?.screenshots?.desktop || '', url: assets?.screenshots?.desktop || '' },
      { label: 'Mobile screenshot', value: assets?.screenshots?.mobile || '', url: assets?.screenshots?.mobile || '' },
      { label: 'Demo video', value: assets?.video || '', url: assets?.video || '' },
    ].filter((item) => item.value),
    sections: [
      {
        title: 'What was checked',
        items: proofPoints,
      },
      audit ? {
        title: 'Local AI audit',
        items: [
          `Verdict: ${audit.verdict}`,
          `Score: ${audit.score}`,
          `Findings: ${audit.summary?.total ?? 0}`,
        ],
      } : null,
    ].filter(Boolean),
    cta: previewUrl ? { label: 'Open live preview', url: previewUrl } : null,
    closing: 'If the direction feels right, we can launch it as-is or make a few practical revisions before it goes live.',
    footerNote: 'ProfitsLocal outreach preview. Reply if you want us to stop, revise, or scope a full launch.',
    preheader: `Website preview ready for ${businessName}`,
  });
}
