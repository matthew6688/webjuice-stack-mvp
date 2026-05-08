#!/usr/bin/env node

import assert from 'assert/strict';
import { loadAdminSettingsIndex } from '../../core/admin/settings-index.js';

const settings = loadAdminSettingsIndex({
  ADMIN_ACCESS_TOKEN: 'admin-secret-token',
  WEBSITE_LEADS_DISCORD_CHANNEL_ID: '1501187038706401290',
  WEBSITE_PROJECTS_DISCORD_CHANNEL_ID: '1501945763650080899',
  WEBSITE_TASKS_DISCORD_BOT_TOKEN: 'discord-bot-token-1234',
  WEBSITE_AGENT_MENTION: '<@1501073096696664184>',
  RESEND_API_KEY: 're_test_123456789',
  FROM_EMAIL: 'Profits Local <hello@fengtalk.ai>',
  STRIPE_SECRET_KEY: 'sk_test_123456789',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_123456789',
  STRIPE_WEBHOOK_SECRET: 'whsec_123456789',
  CLOUDINARY_CLOUD_NAME: 'profitslocal',
  CLOUDINARY_API_KEY: 'cloudinary-key',
  CLOUDINARY_API_SECRET: 'cloudinary-secret',
  GOOGLE_PLACES_API_KEY: 'google-places-key',
  GH_PAT: 'github_pat_example',
  CF_API_TOKEN: 'cf_token_example',
  CF_ACCOUNT_ID: 'cf-account-id',
  OLLAMA_MODEL: 'qwen3.5:9b',
});

assert.ok(settings.sections.length >= 6);
assert.equal(settings.counts.missing, 0);
assert.ok(settings.sections.some((section) => section.title === 'Cold outreach'));
assert.ok(settings.sections.some((section) => section.title === 'Core ops'));

console.log(JSON.stringify({
  ok: true,
  assertions: {
    sectionCount: settings.sections.length,
    configured: settings.counts.configured,
    missing: settings.counts.missing,
    hasColdOutreach: settings.sections.some((section) => section.title === 'Cold outreach'),
    hasCoreOps: settings.sections.some((section) => section.title === 'Core ops'),
  },
}, null, 2));
