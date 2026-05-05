#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { stdin as input, stdout as output } from 'process';

const args = parseArgs(process.argv.slice(2));
const profile = args.profile || 'website-agent';
const channel = args.channel || args['channel-id'] || '1501072883001065614';
const hermesRoot = args['hermes-root'] || path.join(process.env.HOME || '', '.hermes');
const envPath = path.join(hermesRoot, 'profiles', profile, '.env');

if (!fs.existsSync(envPath)) {
  throw new Error(`Missing profile env: ${envPath}`);
}

const token = args.token || await askHidden('DISCORD_BOT_TOKEN: ');
if (!String(token || '').trim()) {
  throw new Error('DISCORD_BOT_TOKEN is required');
}

const allowedUsers = args['allowed-users'] || '';
const env = readEnv(envPath);
env.DISCORD_BOT_TOKEN = String(token).trim();
env.DISCORD_HOME_CHANNEL = channel;
if (allowedUsers) env.DISCORD_ALLOWED_USERS = allowedUsers;

fs.writeFileSync(envPath, `${formatEnv(env)}\n`, { mode: 0o600 });
console.log(`Updated ${envPath}`);
console.log(`Home channel: ${channel}`);

async function askHidden(prompt) {
  if (!input.isTTY) return fs.readFileSync(0, 'utf8').trim();
  const rl = readline.createInterface({ input, output, terminal: true });
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
      rl.close();
      resolve(answer);
    });
  });
}

function readEnv(filePath) {
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
  const header = [
    '# ProfitsLocal Website Agent',
    '# Use a dedicated Discord bot token. Do not reuse a token used by another running Hermes profile.',
  ];
  const order = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_ALLOWED_USERS',
    'DISCORD_HOME_CHANNEL',
    'KIMI_API_KEY',
    'KIMI_BASE_URL',
    'LLM_MODEL',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
  ];
  const seen = new Set(order);
  const lines = [
    ...header,
    ...order.map((key) => `${key}=${quoteIfNeeded(env[key] || '')}`),
    ...Object.entries(env)
      .filter(([key]) => !seen.has(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${quoteIfNeeded(value)}`),
  ];
  return lines.join('\n');
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

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
