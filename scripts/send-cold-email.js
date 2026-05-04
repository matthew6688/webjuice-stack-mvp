#!/usr/bin/env node
/**
 * Send cold emails to generated leads
 * Usage: node scripts/send-cold-email.js --leads leads-restaurant-miami-outreach.json
 *
 * Requires: RESEND_API_KEY env var
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fs = require('fs');

const RESEND_KEY = process.env.RESEND_API_KEY;
if (!RESEND_KEY) {
  console.error('Error: RESEND_API_KEY not set');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    parsed[args[i].replace(/^--/, '')] = args[i + 1];
  }
  return parsed;
}

function generateEmail(lead) {
  const subject = `We built a new website for ${lead.name}`;
  
  const body = `Hi ${lead.name.split(' ')[0] || 'there'},

We came across ${lead.name} and noticed your current website could use a refresh. So we built a preview of what your new site could look like:

📘 Preview: ${lead.preview}

This is a live, working website — not a mockup. It includes:
- Mobile-responsive design
- Your business info, hours, and contact details
- Professional layout optimized for ${lead.config.domain.includes('restaurant') ? 'restaurants' : 'local businesses'}

If you like it, we can customize it further with your branding, photos, and any changes you want. The whole process takes 24-48 hours.

Want to discuss? Just reply to this email.

Best,
Matthew
WebJuice Agency
`;

  return { subject, body };
}

async function sendEmail(to, subject, body) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'WebJuice Agency <hello@fengtalk.ai>',
      to,
      subject,
      text: body,
    }),
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  
  return await res.json();
}

async function main() {
  const args = parseArgs();
  const { leads: leadsFile, dry = 'true' } = args;
  
  if (!leadsFile) {
    console.error('Usage: node scripts/send-cold-email.js --leads leads-restaurant-miami-outreach.json [--dry false]');
    process.exit(1);
  }
  
  const leads = JSON.parse(fs.readFileSync(leadsFile, 'utf-8'));
  const isDry = dry !== 'false';
  
  console.log(`${isDry ? '[DRY RUN]' : '[LIVE]'} Sending emails to ${leads.length} leads...\n`);
  
  for (const lead of leads) {
    const { subject, body } = generateEmail(lead);
    
    console.log(`To: ${lead.email || 'NO EMAIL'}`);
    console.log(`Subject: ${subject}`);
    console.log(`Preview: ${lead.preview}`);
    console.log('---');
    
    if (!isDry && lead.email) {
      try {
        await sendEmail(lead.email, subject, body);
        console.log('  ✓ Sent\n');
      } catch (e) {
        console.log(`  ✗ Failed: ${e.message}\n`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  if (isDry) {
    console.log('\nThis was a dry run. Add --dry false to send real emails.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
