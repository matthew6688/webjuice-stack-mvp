#!/usr/bin/env node

import fs from 'fs';
import https from 'https';
import { execFileSync } from 'child_process';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const profile = args.profile || 'website-agent';
const hermesRoot = args['hermes-root'] || path.join(process.env.HOME || '', '.hermes');
const profileDir = path.join(hermesRoot, 'profiles', profile);
const tokenEnvPath = args.env || path.join(profileDir, '.env');
const tokenName = args['token-name'] || 'DISCORD_BOT_TOKEN';
const plist = args.plist || path.join(process.env.HOME || '', 'Library/LaunchAgents', `ai.hermes.gateway-${profile}.plist`);
const shouldStart = args.start === true || args.start === 'true';

const token = readEnv(tokenEnvPath, tokenName);
if (!token) {
  console.error(`Missing ${tokenName} in ${tokenEnvPath}`);
  process.exit(2);
}

const status = await checkDiscordBot(token);
console.log(JSON.stringify(status));

if (status.status !== 200) {
  console.error(`Discord is not ready for ${profile}; leaving LaunchAgent stopped.`);
  process.exit(1);
}

if (shouldStart) {
  if (!fs.existsSync(plist)) {
    console.error(`LaunchAgent plist not found: ${plist}`);
    process.exit(2);
  }
  execFileSync('launchctl', ['bootstrap', `gui/${process.getuid()}`, plist], { stdio: 'inherit' });
  console.log(`Started ${profile} from ${plist}`);
}

function readEnv(filePath, key) {
  if (!fs.existsSync(filePath)) return '';
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
    if (!match || match[1] !== key) continue;
    return match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return '';
}

function checkDiscordBot(token) {
  return new Promise((resolve) => {
    const req = https.request('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = {};
        }
        resolve({
          ok: res.statusCode === 200,
          status: res.statusCode,
          retryAfter: res.headers['retry-after'] || parsed.retry_after || null,
          global: parsed.global ?? null,
          code: parsed.code ?? null,
          message: parsed.message || null,
          bot: parsed.username ? `${parsed.username}#${parsed.discriminator || '0'}` : null,
        });
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('Discord healthcheck timed out'));
    });
    req.on('error', (error) => {
      resolve({ ok: false, status: 0, message: error.message });
    });
    req.end();
  });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}
