#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../core/env/load-local-env.js';

loadLocalEnv();

const args = parseArgs();

if (!args.client && !args.leads) {
  console.error('Usage: node scripts/send-cold-email.js --client slug [--to you@example.com] [--dry true]');
  console.error('   or: node scripts/send-cold-email.js --leads leads.json [--dry true]');
  process.exit(1);
}

const dryRun = args.dry !== 'false';
const messages = args.client ? [buildClientMessage(args.client, args)] : buildLeadMessages(args.leads);
const outDir = args.outputDir || args['output-dir'] || (args.client ? path.join('clients', args.client, 'outreach', 'email') : 'outreach/email');
fs.mkdirSync(outDir, { recursive: true });

console.log(`${dryRun ? '[DRY RUN]' : '[LIVE]'} Prepared ${messages.length} cold email(s)\n`);

for (const [index, message] of messages.entries()) {
  const artifactPath = path.join(outDir, `${String(index + 1).padStart(2, '0')}-${slugify(message.businessName || 'lead')}.json`);
  fs.writeFileSync(artifactPath, `${JSON.stringify({
    ...message,
    dryRun,
    generatedAt: new Date().toISOString(),
  }, null, 2)}\n`);

  console.log(`To: ${message.to || '(missing)'}`);
  console.log(`Subject: ${message.subject}`);
  console.log(`Preview: ${message.previewUrl}`);
  console.log(`Artifact: ${artifactPath}`);
  console.log('---');

  if (!dryRun) {
    if (!message.to) throw new Error(`Missing recipient for ${message.businessName}`);
    const result = await sendResendEmail(message);
    console.log(`Sent: ${result.id || JSON.stringify(result)}`);
  }
}

if (dryRun) console.log('\nDry run complete. Use --dry false only for an intentional live send.');

function buildClientMessage(clientSlug, options) {
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

  return {
    provider: 'resend',
    to,
    from: options.from || process.env.FROM_EMAIL || 'Profits Local <hello@fengtalk.ai>',
    replyTo: options.replyTo || options['reply-to'] || process.env.REPLY_TO_EMAIL || '',
    businessName,
    clientSlug,
    subject,
    text: body,
    previewUrl,
    proofAssets: pack.assets,
    audit: audit ? {
      verdict: audit.verdict,
      score: audit.score,
      summary: audit.summary,
    } : null,
  };
}

function buildLeadMessages(leadsPath) {
  return readJson(leadsPath).map((lead) => {
    const businessName = lead.name || lead.businessName || 'your restaurant';
    const previewUrl = lead.preview || lead.previewUrl || '';
    return {
      provider: 'resend',
      to: lead.email || '',
      from: process.env.FROM_EMAIL || 'Profits Local <hello@fengtalk.ai>',
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
