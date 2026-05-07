#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { handleDomainRequest } from '../../core/domain/domain-request.js';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { buildDomainStatusEmail, sendCustomerEmail } from '../../core/funnel/customer-email.js';
import { sendDiscordChannelMessage } from '../../core/funnel/discord.js';
import { updateForumWorkspaceStage } from '../../core/funnel/discord-workspace.js';
import { recordCaseNotification } from '../../core/cases/case-file.js';
import { DEFAULT_LEDGER_PATH } from '../../core/finance/ledger.js';

loadLocalEnv();

const args = parseArgs();
if (!args.client && !args.clientSlug) {
  console.error('Usage: node scripts/domain/request.js --client slug [--order orderId] [--email email] [--domain host] [--project project-live] [--execute true] [--output file]');
  process.exit(1);
}

const result = await handleDomainRequest({
  clientSlug: args.client || args.clientSlug,
  orderId: args.order || args.orderId || '',
  email: args.email || '',
  domain: args.domain || '',
  projectName: args.project || args.projectName || '',
  requestId: args.request || args.requestId || '',
}, {
  execute: args.execute === 'true',
  write: args.write !== 'false',
  cfToken: process.env.CF_API_TOKEN,
  cfAccountId: process.env.CF_ACCOUNT_ID,
  zoneId: args.zone || process.env.CF_ZONE_ID || '',
  rootDomain: args.root || process.env.PROFITSLOCAL_ROOT_DOMAIN || 'profitslocal.com',
  proxied: args.proxied !== 'false',
  allowRootAutoAttach: args.allowRoot === 'true',
});

let customerEmail = { ok: false, skipped: true };
if (boolArg(args, 'send-email') && args.execute === 'true') {
  const message = buildDomainStatusEmail({ domainRequest: result });
  if (message) {
    customerEmail = await sendCustomerEmail(process.env, message, {
      ledgerPath: args.ledger || DEFAULT_LEDGER_PATH,
      clientSlug: result.clientSlug || null,
      campaignId: args.campaign || null,
      emailMetadata: {
        kind: 'domain_status',
        requestId: result.id,
        status: result.status,
        domain: result.domain,
      },
    });
  }
}

const discordNotification = await maybeSendDomainDiscord({
  args,
  result,
});

if (args.output) {
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
}

console.log(JSON.stringify({
  ok: true,
  id: result.id,
  status: result.status,
  route: result.route.route,
  domain: result.domain,
  target: result.target,
  pagesActive: result.pages.active,
  customerEmail,
  discordNotification,
  steps: result.steps.map((item) => ({ id: item.id, ok: item.ok, message: item.message })),
}, null, 2));

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}

function boolArg(args, key, defaultValue = false) {
  if (args[key] === undefined) return defaultValue;
  return args[key] === true || String(args[key]).toLowerCase() === 'true';
}

async function maybeSendDomainDiscord({ args, result }) {
  if (!boolArg(args, 'send-discord', true) || args.execute !== 'true') return { ok: false, skipped: true };
  const casePath = path.join(args['cases-dir'] || args.casesDir || 'data/cases', result.clientSlug, result.orderId || 'unknown', 'case.json');
  if (!fs.existsSync(casePath)) return { ok: false, skipped: true, reason: 'case_not_found', casePath };
  const caseFile = JSON.parse(fs.readFileSync(casePath, 'utf8'));
  const threadId = caseFile.discord?.websiteTaskThreadId || '';
  const botToken = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
  if (!threadId || !botToken) return { ok: false, skipped: true, reason: 'missing_workspace_or_token' };

  let workspaceUpdate = null;
  try {
    workspaceUpdate = await updateForumWorkspaceStage({
      workspace: 'projects',
      threadId,
      channelId: caseFile.discord?.websiteWorkspaceChannelId || '',
      botToken,
      kind: result.status === 'waiting_for_customer_dns' || result.status === 'needs_root_domain_review' ? 'live' : 'live',
      order: {
        clientSlug: caseFile.clientSlug,
        company: caseFile.customer?.company || '',
        template: caseFile.template || '',
      },
      caseFile: {
        ...caseFile,
        status: result.status === 'waiting_for_customer_dns' || result.status === 'needs_root_domain_review'
          ? 'waiting_for_customer_dns'
          : caseFile.status,
      },
      revision: caseFile.revision || null,
    });
  } catch (error) {
    workspaceUpdate = { ok: false, error: error.message || String(error) };
  }

  const payload = {
    content: [
      `Domain update: ${caseFile.customer?.company || caseFile.clientSlug}`,
      `status: ${result.status}`,
      `domain: ${result.domain}`,
      `route: ${result.route.route}`,
      `target: ${result.target}`,
    ].join('\n'),
    allowed_mentions: { parse: [] },
  };
  const discord = await sendDiscordChannelMessage({
    channelId: threadId,
    botToken,
    payload,
  });
  discord.threadId = threadId;
  discord.threadReused = true;
  discord.workspaceUpdate = workspaceUpdate;
  const record = recordCaseNotification(caseFile.paths, {
    type: 'domain_status_discord_sent',
    kind: 'website_task',
    ok: true,
    discord,
  });
  return { ok: true, discord, caseRecord: record };
}
