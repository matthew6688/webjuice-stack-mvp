#!/usr/bin/env node
/**
 * pl:daemon-doctor · V3 D43 (2026-05-14)
 *
 * launchd state audit · prevent V2/V3 drift and test-flag leakage:
 *   · All loaded labels are `ai.profitslocal.v3.*` (no V2 残留)
 *   · Production plists don't carry LISTENER_ALLOW_BOTS / DRY_RUN / *_TEST flags
 *   · WorkingDirectory paths point to V3 repo
 *   · Expected daemon set is alive (listener / dispatcher / task-api · 3 doctors)
 *   · No orphan V2 plists in ~/Library/LaunchAgents/
 *
 * Output:
 *   · stdout · human or JSON
 *   · alerts to bot-log Discord on --report or on any error
 *   · heartbeat data/heartbeats/daemon-doctor.txt
 *
 * Usage:
 *   npm run pl:daemon-doctor              # human
 *   npm run pl:daemon-doctor -- --json    # cron
 *   npm run pl:daemon-doctor -- --report  # 强制日报到 Discord
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const V3_DIR = '/Users/matthew/Developer/google-map-website-v3';
const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes('--json');
const FORCE_REPORT = ARGS.includes('--report');

const PLIST_DIR = path.join(os.homedir(), 'Library/LaunchAgents');
const EXPECTED_DAEMONS = [
  'ai.profitslocal.v3.task-listener',
  'ai.profitslocal.v3.task-dispatcher',
  'ai.profitslocal.v3.task-api',
];
const FORBIDDEN_ENV = ['LISTENER_ALLOW_BOTS', 'DRY_RUN', 'PL_TEST_MODE', 'OVERRIDE_AUTH'];

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const c = (s, color) => JSON_MODE ? s : `${color}${s}${X}`;

// ────── Helpers ──────
function runSh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }); } catch { return ''; }
}

function parsePlistEnv(plistPath) {
  if (!fs.existsSync(plistPath)) return { env: {}, workingDir: null, programArgs: [], label: null };
  const xml = fs.readFileSync(plistPath, 'utf8');
  const env = {};
  const envBlock = xml.match(/<key>EnvironmentVariables<\/key>\s*<dict>([\s\S]*?)<\/dict>/);
  if (envBlock) {
    const pairs = [...envBlock[1].matchAll(/<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g)];
    for (const [, k, v] of pairs) env[k] = v;
  }
  const workingDirM = xml.match(/<key>WorkingDirectory<\/key>\s*<string>([^<]+)<\/string>/);
  const labelM = xml.match(/<key>Label<\/key>\s*<string>([^<]+)<\/string>/);
  const argsMatches = [...xml.matchAll(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/g)];
  const programArgs = argsMatches.length ? [...argsMatches[0][1].matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]) : [];
  return { env, workingDir: workingDirM?.[1] || null, programArgs, label: labelM?.[1] || null };
}

// ────── Checks ──────
const findings = [];
const alerts = [];

// 1. Loaded launchd agents
const loaded = runSh('launchctl list').split('\n').filter(Boolean).map((l) => {
  const parts = l.split(/\s+/);
  return { pid: parts[0], status: parts[1], label: parts[2] };
}).filter((l) => l.label?.startsWith('ai.profitslocal'));

// 2. Plist files on disk
const plists = fs.existsSync(PLIST_DIR)
  ? fs.readdirSync(PLIST_DIR).filter((f) => f.startsWith('ai.profitslocal') && f.endsWith('.plist'))
  : [];

// 3. Each plist: parse, audit
const plistDetails = plists.map((f) => {
  const full = path.join(PLIST_DIR, f);
  const meta = parsePlistEnv(full);
  return { file: f, ...meta };
});

// 4. Find issues

// 4a. V2 plists on disk (any without `.v3.` in label)
for (const p of plistDetails) {
  if (!p.label) continue;
  if (!p.label.includes('.v3.') && !['ai.profitslocal.sop0-tunnel', 'ai.profitslocal.open-design', 'ai.profitslocal.intake-doctor-daily'].includes(p.label)) {
    alerts.push(`V2 plist on disk: ${p.file} (label=${p.label})`);
    findings.push({ severity: 'error', code: 'V2_PLIST', detail: p.file });
  }
}

// 4b. Working directory mismatch
for (const p of plistDetails) {
  if (!p.workingDir) continue;
  if (p.workingDir.endsWith('/google-map-website') && !p.workingDir.endsWith('/google-map-website-v3')) {
    alerts.push(`Plist ${p.file} pointing at V2 path: ${p.workingDir}`);
    findings.push({ severity: 'error', code: 'V2_WORKDIR', file: p.file, path: p.workingDir });
  }
}

// 4c. Forbidden env vars in plists (test-only flags in production)
for (const p of plistDetails) {
  for (const flag of FORBIDDEN_ENV) {
    if (p.env[flag] === '1' || p.env[flag] === 'true') {
      alerts.push(`Test flag ${flag}=1 in ${p.file}`);
      findings.push({ severity: 'error', code: 'TEST_FLAG_IN_PROD', file: p.file, flag });
    }
  }
}

// 4d. Expected daemons all alive
for (const label of EXPECTED_DAEMONS) {
  const entry = loaded.find((l) => l.label === label);
  if (!entry) {
    alerts.push(`Expected daemon not loaded: ${label}`);
    findings.push({ severity: 'error', code: 'MISSING_DAEMON', label });
  } else if (entry.pid === '-') {
    alerts.push(`Daemon loaded but not running: ${label}`);
    findings.push({ severity: 'warn', code: 'DAEMON_NOT_RUNNING', label });
  }
}

// 4e. Process actually running matches PID claim
const psOut = runSh('ps auxww | grep -E "pl-task-(listener|dispatcher|api)" | grep -v grep');
const runningPids = psOut.split('\n').filter(Boolean).map((l) => {
  const parts = l.split(/\s+/);
  return { pid: parts[1], cwd: l.match(/google-map-website(?:-v3)?/)?.[0] };
});
for (const proc of runningPids) {
  if (proc.cwd === 'google-map-website') {
    alerts.push(`V2 process still running: PID ${proc.pid}`);
    findings.push({ severity: 'error', code: 'V2_PROCESS_ALIVE', pid: proc.pid });
  }
}

const errors = findings.filter((f) => f.severity === 'error').length;
const warns = findings.filter((f) => f.severity === 'warn').length;

const report = {
  generated_at: new Date().toISOString(),
  loaded_count: loaded.length,
  plist_count: plistDetails.length,
  expected_daemons: EXPECTED_DAEMONS.length,
  alerts,
  alert_count: alerts.length,
  errors,
  warns,
  findings,
};

// Heartbeat
try {
  fs.mkdirSync(path.join(REPO, 'data/heartbeats'), { recursive: true });
  fs.writeFileSync(path.join(REPO, 'data/heartbeats/daemon-doctor.txt'), new Date().toISOString());
} catch {}

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
  if ((alerts.length || FORCE_REPORT) && (process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN)) {
    sendDiscord(report).catch(() => {});
  }
  process.exit(errors > 0 ? 1 : 0);
}

console.log('');
console.log(c('🛡️  ProfitsLocal Daemon Doctor', G));
console.log(c('─────────────────────────────', D));
console.log(`Loaded launchd agents (ai.profitslocal.*): ${loaded.length}`);
console.log(`Plist files on disk:                       ${plistDetails.length}`);
console.log(`Expected V3 daemons:                       ${EXPECTED_DAEMONS.length} (${EXPECTED_DAEMONS.length - findings.filter((f) => f.code === 'MISSING_DAEMON').length} alive)`);
console.log('');
console.log(c('Loaded labels:', D));
for (const l of loaded) {
  const tag = l.pid === '-' ? c('(cron · idle)', D) : c(`PID ${l.pid}`, G);
  console.log(`  ${tag.padEnd(20)} ${l.label}`);
}

if (alerts.length > 0) {
  console.log('');
  console.log(c(`⚠️ ${alerts.length} ALERT(S):`, R));
  for (const a of alerts) console.log(c(`  · ${a}`, R));
}

console.log('');
console.log(errors === 0 ? c('✓ all good', G) : c(`✗ ${errors} errors · ${warns} warns`, R));

if ((alerts.length || FORCE_REPORT) && (process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN)) {
  await sendDiscord(report);
}

process.exit(errors > 0 ? 1 : 0);

async function sendDiscord(r) {
  const channelId = process.env.BOT_LOG_DISCORD_CHANNEL_ID || '1493926218574200942';
  const token = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!channelId || !token) return;
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `**ProfitsLocal · Daemon Doctor** · ${date}`,
    `─────────────────────────────`,
    `Loaded: ${r.loaded_count} · Plists: ${r.plist_count} · Errors: ${r.errors} · Warns: ${r.warns}`,
  ];
  if (r.alerts.length) {
    lines.push('', `**⚠️ ALERTS:**`);
    for (const a of r.alerts.slice(0, 10)) lines.push(`· ${a}`);
  } else {
    lines.push('', 'Alerts: 无 · healthy');
  }
  try {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profitslocal-daemon-doctor' },
      body: JSON.stringify({ content: lines.join('\n').slice(0, 2000) }),
    });
  } catch {}
}
