#!/usr/bin/env node
/**
 * pl:cascade-doctor · V3 D43 (2026-05-14)
 *
 * Surface silent LLM cascade degradation. Catches the "P5 codex failing
 * silently, ollama doing all the work" pattern.
 *
 * Reads data/finance/cascade-trace.jsonl (appended by runCascade) and
 * computes per-tier success/failure rates over last 24h / 7d.
 *
 * Alert thresholds:
 *   · codex_cli error rate > 30% in 24h → alert
 *   · ollama fallback rate > 50% in 24h → alert (codex/claude not pulling weight)
 *   · final_provider = ollama for > 70% of judgments → alert
 *
 * Usage:
 *   npm run pl:cascade-doctor              # human
 *   npm run pl:cascade-doctor -- --json
 *   npm run pl:cascade-doctor -- --report  # 强制发 Discord
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes('--json');
const FORCE_REPORT = ARGS.includes('--report');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const c = (s, color) => JSON_MODE ? s : `${color}${s}${X}`;

function readTraces() {
  const p = path.join(REPO, 'data/finance/cascade-trace.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function aggregateWindow(entries, sinceMs) {
  const cutoff = Date.now() - sinceMs;
  const filtered = entries.filter((e) => new Date(e.at).getTime() >= cutoff);
  const tierAttempts = {};
  const tierFailures = {};
  const finalProviders = {};
  for (const e of filtered) {
    finalProviders[e.final_provider] = (finalProviders[e.final_provider] || 0) + 1;
    for (const t of e.trace || []) {
      tierAttempts[t.tier] = (tierAttempts[t.tier] || 0) + 1;
      if (!t.ok) tierFailures[t.tier] = (tierFailures[t.tier] || 0) + 1;
    }
  }
  return {
    total_invocations: filtered.length,
    tier_attempts: tierAttempts,
    tier_failures: tierFailures,
    tier_failure_rate: Object.fromEntries(Object.entries(tierAttempts).map(([k, v]) => [k, v ? (tierFailures[k] || 0) / v : 0])),
    final_providers: finalProviders,
  };
}

const all = readTraces();
const last24h = aggregateWindow(all, 24 * 60 * 60 * 1000);
const last7d  = aggregateWindow(all,  7 * 24 * 60 * 60 * 1000);

// Alerts
const alerts = [];
const codexFail24h = last24h.tier_failure_rate.codex_cli || 0;
if (codexFail24h > 0.3 && (last24h.tier_attempts.codex_cli || 0) >= 3) {
  alerts.push(`codex_cli 24h 失败率 ${(codexFail24h * 100).toFixed(0)}% (${last24h.tier_failures.codex_cli || 0}/${last24h.tier_attempts.codex_cli}) > 30%`);
}
const ollamaFinalRate24h = last24h.total_invocations
  ? (last24h.final_providers.ollama || 0) / last24h.total_invocations
  : 0;
if (ollamaFinalRate24h > 0.7 && last24h.total_invocations >= 3) {
  alerts.push(`ollama 兜底率 ${(ollamaFinalRate24h * 100).toFixed(0)}% 24h · codex/claude 没干活`);
}

const report = {
  generated_at: new Date().toISOString(),
  total_invocations_all_time: all.length,
  last_24h: last24h,
  last_7d: last7d,
  alerts,
  alert_count: alerts.length,
};

// Heartbeat
try {
  fs.mkdirSync(path.join(REPO, 'data/heartbeats'), { recursive: true });
  fs.writeFileSync(path.join(REPO, 'data/heartbeats/cascade-doctor.txt'), new Date().toISOString());
} catch {}

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
  if ((alerts.length || FORCE_REPORT) && (process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN)) {
    sendDiscord(report).catch(() => {});
  }
  process.exit(alerts.length > 0 ? 1 : 0);
}

console.log('');
console.log(c('🔁 ProfitsLocal Cascade Doctor', G));
console.log(c('─────────────────────────────', D));
console.log(`Total invocations:      ${all.length}`);
console.log(`Last 24h invocations:   ${last24h.total_invocations}`);
console.log('');
console.log(c('Last 24h · tier success rate:', D));
for (const [tier, attempts] of Object.entries(last24h.tier_attempts)) {
  const failures = last24h.tier_failures[tier] || 0;
  const ok = attempts - failures;
  const pct = attempts ? ((ok / attempts) * 100).toFixed(0) : '-';
  console.log(`  ${tier.padEnd(15)} ${ok}/${attempts} ok (${pct}%)`);
}
console.log('');
console.log(c('Last 24h · final provider distribution:', D));
for (const [prov, n] of Object.entries(last24h.final_providers)) {
  console.log(`  ${prov.padEnd(15)} ${n}`);
}

if (alerts.length > 0) {
  console.log('');
  console.log(c(`⚠️ ${alerts.length} ALERT(S):`, R));
  for (const a of alerts) console.log(c(`  · ${a}`, R));
}

console.log('');
console.log(alerts.length === 0 ? c('✓ cascade healthy', G) : c(`✗ degradation detected`, R));

if ((alerts.length || FORCE_REPORT) && (process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN)) {
  await sendDiscord(report);
}

process.exit(alerts.length > 0 ? 1 : 0);

async function sendDiscord(r) {
  const channelId = process.env.BOT_LOG_DISCORD_CHANNEL_ID || '1493926218574200942';
  const token = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!channelId || !token) return;
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `**ProfitsLocal · Cascade Doctor** · ${date}`,
    `─────────────────────────────`,
    `24h invocations: ${r.last_24h.total_invocations}`,
    '',
    `**Final provider 分布 (24h):**`,
    ...Object.entries(r.last_24h.final_providers).map(([k, v]) => `· ${k}: ${v}`),
  ];
  if (r.alerts.length) {
    lines.push('', `**⚠️ ALERTS:**`);
    for (const a of r.alerts) lines.push(`· ${a}`);
  } else {
    lines.push('', 'Alerts: 无');
  }
  try {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profitslocal-cascade-doctor' },
      body: JSON.stringify({ content: lines.join('\n').slice(0, 2000) }),
    });
  } catch {}
}
