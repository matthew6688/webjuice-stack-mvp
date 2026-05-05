#!/usr/bin/env node

import fs from 'fs';
import readline from 'readline';
import { stdin as input, stdout as output } from 'process';

const args = process.argv.slice(2);
const ENV_PATH = readArg('--path') || '.env.local';
const KEYS = [
  ['GH_PAT', 'GitHub PAT for repo/workflow automation'],
  ['CF_API_TOKEN', 'Cloudflare API token'],
  ['CF_ACCOUNT_ID', 'Cloudflare account ID'],
  ['GOOGLE_PLACES_API_KEY', 'Google Places API key'],
  ['FIRECRAWL_API_KEY', 'Firecrawl API key'],
  ['OPENAI_API_KEY', 'OpenAI API key'],
  ['TALLY_API_KEY', 'Tally API key'],
  ['TALLY_WEBHOOK_SIGNING_SECRET', 'Tally webhook signing secret, if enabled'],
  ['STRIPE_PUBLISHABLE_KEY', 'Stripe publishable key'],
  ['STRIPE_SECRET_KEY', 'Stripe secret key'],
  ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook signing secret'],
  ['AGENT_GITHUB_TOKEN', 'GitHub token used by preview sites to dispatch the central workflow'],
  ['RESEND_API_KEY', 'Resend API key'],
  ['FROM_EMAIL', 'Customer-facing sender, e.g. Profits Local <hello@fengtalk.ai>'],
  ['REPLY_TO_EMAIL', 'Optional customer reply-to email'],
  ['SALES_DISCORD_WEBHOOK_URL', 'Discord sales webhook URL'],
  ['REVISE_DISCORD_WEBHOOK_URL', 'Discord revision webhook URL'],
  ['DISCORD_BOT_TOKEN', 'Discord bot token for creating true threads'],
  ['WEBSITE_TASKS_DISCORD_CHANNEL_ID', 'Discord #websites channel ID'],
  ['WEBSITE_AGENT_MENTION', 'Website agent mention, e.g. <@1501073096696664184>'],
  ['WEBSITE_TASKS_DISCORD_BOT_TOKEN', 'Discord bot token used to hand tasks to website-agent'],
  ['OLLAMA_MODEL', 'Local audit model, default qwen3.5:9b'],
  ['OLLAMA_URL', 'Local Ollama URL, default http://127.0.0.1:11434'],
];

const existing = readEnv(ENV_PATH);
const pipedAnswers = input.isTTY ? null : fs.readFileSync(0, 'utf8').split(/\r?\n/);
const rl = pipedAnswers ? null : readline.createInterface({ input, output, terminal: true });

console.log(`Writing local secrets to ${ENV_PATH}`);
console.log('Leave a value blank to keep the current value or skip it. Values are not printed back.\n');

const next = { ...existing };
for (const [key, description] of KEYS) {
  const hasValue = Boolean(existing[key]);
  const answer = await askHidden(`${key}${hasValue ? ' [configured]' : ''} - ${description}: `);
  if (answer.trim()) next[key] = answer.trim();
}

next.DEFAULT_CAMPAIGN_ID ||= 'brisbane-restaurants';
next.ROI_CURRENCY ||= 'USD';
next.GOOGLE_PLACES_TEXT_SEARCH_UNIT_COST ||= '0';
next.GOOGLE_PLACES_DETAILS_UNIT_COST ||= '0';
next.GOOGLE_PLACES_PHOTO_UNIT_COST ||= '0';
next.FIRECRAWL_SCRAPE_UNIT_COST ||= '0';
next.FIRECRAWL_PARSE_UNIT_COST ||= '0';
next.PADDLEOCR_COMMAND ||= '.venv-paddleocr/bin/paddleocr ocr -i {input} --save_path {output} --lang en';
next.OCRMYPDF_LANG ||= 'eng';
next.OLLAMA_MODEL ||= 'qwen3.5:9b';
next.OLLAMA_URL ||= 'http://127.0.0.1:11434';
next.FROM_EMAIL ||= 'Profits Local <hello@fengtalk.ai>';

fs.writeFileSync(ENV_PATH, `${formatEnv(next)}\n`, { mode: 0o600 });
rl?.close();

console.log(`\nSaved ${Object.keys(next).length} entries to ${ENV_PATH}`);
console.log('Next: npm run check:env -- --workflow funnel');

async function askHidden(prompt) {
  if (pipedAnswers) {
    output.write(prompt);
    output.write('\n');
    return pipedAnswers.shift() || '';
  }

  return new Promise((resolve) => {
    const originalWrite = rl._writeToOutput;
    output.write(prompt);
    rl._writeToOutput = function writeHidden(stringToWrite) {
      if (rl.stdoutMuted) {
        if (stringToWrite.includes('\n') || stringToWrite.includes('\r')) originalWrite.call(rl, stringToWrite);
        return;
      }
      originalWrite.call(rl, stringToWrite);
    };
    rl.stdoutMuted = true;
    rl.question('', (answer) => {
      rl.stdoutMuted = false;
      rl._writeToOutput = originalWrite;
      resolve(answer);
    });
  });
}

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    env[match[1]] = unquote(match[2].trim());
  }
  return env;
}

function formatEnv(env) {
  return Object.entries(env)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${quoteIfNeeded(value)}`)
    .join('\n');
}

function quoteIfNeeded(value) {
  const string = String(value ?? '');
  if (!string || /[\s#"'<>]/.test(string)) return JSON.stringify(string);
  return string;
}

function unquote(value) {
  if (value.length < 2) return value;
  try {
    if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  } catch {
    return value.slice(1, -1);
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) return '';
  return args[index + 1] || '';
}
