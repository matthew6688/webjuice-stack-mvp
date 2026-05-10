#!/usr/bin/env node

import assert from 'assert/strict';
import { loadAdminSettingsIndex } from '../../core/admin/settings-index.js';

const settings = loadAdminSettingsIndex({
  ADMIN_ACCESS_TOKEN: 'admin-secret-token',
  WEBSITE_LEADS_DISCORD_CHANNEL_ID: '1501187038706401290',
  WEBSITE_PROJECTS_DISCORD_CHANNEL_ID: '1501945763650080899',
  WEBSITE_TASKS_DISCORD_BOT_TOKEN: 'discord-bot-token-1234',
  WEBSITE_AGENT_MENTION: '<@1501073096696664184>',
  SPECIAL_ALERTS_DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1502564006789906472/test-webhook-token-1234',
  OPEN_DESIGN_WATCHER_CHECKPOINT_MS: '600000',
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
assert.ok(settings.sections.some((section) => section.title === '冷邮件拓客'));
assert.ok(settings.sections.some((section) => section.title === '核心运营'));
assert.ok(settings.sections.some((section) => section.title === '特殊提醒'));

const specialAlerts = settings.sections.find((section) => section.title === '特殊提醒');
assert.ok(specialAlerts.items.some((item) => item.label === 'Discord 特殊提醒入口' && item.status === 'configured'));
assert.ok(specialAlerts.items.some((item) => item.label === 'Open Design 监控模式' && item.display.includes('runner-integrated')));

console.log(JSON.stringify({
  ok: true,
  assertions: {
    sectionCount: settings.sections.length,
    configured: settings.counts.configured,
    missing: settings.counts.missing,
    hasColdOutreach: settings.sections.some((section) => section.title === '冷邮件拓客'),
    hasCoreOps: settings.sections.some((section) => section.title === '核心运营'),
    hasSpecialAlerts: settings.sections.some((section) => section.title === '特殊提醒'),
  },
}, null, 2));
