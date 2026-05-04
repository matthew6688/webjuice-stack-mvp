import fs from 'fs';
import { buildDiscordMessage, sendDiscordWebhook } from '../../core/funnel/discord.js';

const args = parseArgs(process.argv.slice(2));
if (!args.case) {
  console.error('Usage: node scripts/discord/case-thread.js --case data/cases/<client>/<order>/case.json [--kind sale|revision] [--dry-run true]');
  process.exit(1);
}

const caseFile = JSON.parse(fs.readFileSync(args.case, 'utf8'));
const kind = args.kind || (caseFile.latestTask?.kind === 'revision' ? 'revision' : 'sale');
const order = {
  clientSlug: caseFile.clientSlug,
  repo: caseFile.repo,
  orderId: caseFile.order?.id,
  tier: caseFile.order?.tier,
  amount: caseFile.order?.amount,
  currency: caseFile.order?.currency,
  email: caseFile.customer?.email,
  domain: caseFile.customer?.domain,
  company: caseFile.customer?.company,
  previewUrl: caseFile.previewUrl,
  feedback: '',
};
const payload = buildDiscordMessage({
  kind,
  order,
  task: {
    id: caseFile.latestTask?.id || '',
    taskPath: caseFile.latestTask?.path || '',
    case: { casePath: args.case },
  },
});
const threadName = discordThreadName(kind, order);

if (args['dry-run'] !== 'false' && args.dryRun !== 'false') {
  console.log(JSON.stringify({ ok: true, dryRun: true, threadName, payload }, null, 2));
  process.exit(0);
}

const webhookUrl = args.webhook || (kind === 'sale'
  ? process.env.SALES_DISCORD_WEBHOOK_URL
  : process.env.REVISE_DISCORD_WEBHOOK_URL);
if (!webhookUrl) {
  console.error('Discord webhook URL is required. Pass --webhook or set SALES_DISCORD_WEBHOOK_URL/REVISE_DISCORD_WEBHOOK_URL.');
  process.exit(1);
}

const result = await sendDiscordWebhook(webhookUrl, payload, { threadName });
console.log(JSON.stringify({ ok: true, threadName, result }, null, 2));

function discordThreadName(kind, order) {
  const label = kind === 'sale' ? 'sale' : 'revision';
  const client = order.clientSlug || order.company || 'client';
  const orderId = order.orderId || '';
  return `${label}-${client}-${orderId}`
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
