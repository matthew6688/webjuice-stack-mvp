#!/usr/bin/env node
/**
 * pl:cost-doctor · V3 D43 (2026-05-14) · 每日付费 API usage + cost 报告
 *
 * Per Matthew: SOP every day 报付费用第三方服务的 usage + cost
 *
 * Reads:
 *   - data/finance/ledger.jsonl   · per-call cost record (existing)
 *   - data/finance/places-quota.json · Google Places quota
 *   - CF Pages deploy records (latest activity)
 *
 * Output:
 *   - Discord webhook to bot-log channel
 *   - data/heartbeats/cost-doctor.txt
 *
 * Usage:
 *   npm run pl:cost-doctor              # 人读
 *   npm run pl:cost-doctor -- --json    # cron 用
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes('--json');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const c = (s, color) => JSON_MODE ? s : `${color}${s}${X}`;

function readLedger() {
  const p = path.join(REPO, 'data/finance/ledger.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function readPlacesQuota() {
  const p = path.join(REPO, 'data/finance/places-quota.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function aggregateLast24h(events) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return events.filter((e) => {
    const ts = new Date(e.timestamp || e.ts || e.at || 0).getTime();
    return ts >= cutoff;
  });
}

function aggregateLast30d(events) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return events.filter((e) => {
    const ts = new Date(e.timestamp || e.ts || e.at || 0).getTime();
    return ts >= cutoff;
  });
}

function sumCost(events) {
  return events.reduce((sum, e) => sum + (e.cost_usd || e.cost || 0), 0);
}

function groupByProvider(events) {
  const out = {};
  for (const e of events) {
    const p = e.provider || e.api || 'unknown';
    if (!out[p]) out[p] = { count: 0, cost: 0 };
    out[p].count++;
    out[p].cost += (e.cost_usd || e.cost || 0);
  }
  return out;
}

// ────────────────────────────────────────────────────────────
const ledger = readLedger();
const quota = readPlacesQuota();
const last24h = aggregateLast24h(ledger);
const last30d = aggregateLast30d(ledger);

const today = sumCost(last24h);
const monthToDate = sumCost(last30d);
const byProvider24h = groupByProvider(last24h);
const byProvider30d = groupByProvider(last30d);

// Alerts
const alerts = [];
if (today > 20) alerts.push(`今日成本 $${today.toFixed(2)} > $20 阈值`);
if (monthToDate > 200) alerts.push(`月累计 $${monthToDate.toFixed(2)} > $200 阈值`);
if (quota) {
  for (const [k, q] of Object.entries(quota.keys || {})) {
    const pct = (q.used || 0) / (q.limit || 1);
    if (pct > 0.8) alerts.push(`Places API key ${k}: ${(pct * 100).toFixed(1)}% quota`);
  }
}

// ────────────────────────────────────────────────────────────
// Output
const report = {
  generated_at: new Date().toISOString(),
  today_usd: today,
  month_to_date_usd: monthToDate,
  last_24h_events: last24h.length,
  by_provider_24h: byProvider24h,
  by_provider_30d: byProvider30d,
  places_quota: quota?.keys || null,
  alerts,
  alert_count: alerts.length,
};

// Heartbeat
const hbDir = path.join(REPO, 'data/heartbeats');
try {
  fs.mkdirSync(hbDir, { recursive: true });
  fs.writeFileSync(path.join(hbDir, 'cost-doctor.txt'), new Date().toISOString());
} catch {}

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
  // Send to bot-log via webhook fallback (sendBotLogFallback equivalent)
  if (process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN) {
    sendDiscordReport(report).catch(() => {});
  }
  process.exit(alerts.length > 0 ? 1 : 0);
}

console.log('');
console.log(c('📊 ProfitsLocal Daily API Cost Report', G));
console.log(c('─────────────────────────────────────', D));
console.log(`Today (24h):       $${today.toFixed(2)} · ${last24h.length} events`);
console.log(`Month-to-date:     $${monthToDate.toFixed(2)} · ${last30d.length} events`);
console.log('');
console.log(c('By provider (last 24h):', D));
for (const [p, agg] of Object.entries(byProvider24h)) {
  console.log(`  ${p.padEnd(20)} $${agg.cost.toFixed(2)} · ${agg.count} calls`);
}
console.log('');
console.log(c('By provider (last 30d):', D));
for (const [p, agg] of Object.entries(byProvider30d)) {
  console.log(`  ${p.padEnd(20)} $${agg.cost.toFixed(2)} · ${agg.count} calls`);
}

if (quota) {
  console.log('');
  console.log(c('Places API quota:', D));
  for (const [k, q] of Object.entries(quota.keys || {})) {
    const pct = ((q.used || 0) / (q.limit || 1) * 100).toFixed(1);
    console.log(`  ${k}: ${q.used || 0}/${q.limit || 0} (${pct}%)`);
  }
}

if (alerts.length > 0) {
  console.log('');
  console.log(c(`⚠️ ${alerts.length} ALERT(S):`, R));
  for (const a of alerts) console.log(c(`  ${a}`, R));
}

console.log('');

// Daily report to Discord bot-log channel
if (process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN) {
  await sendDiscordReport(report);
}

process.exit(alerts.length > 0 ? 1 : 0);

async function sendDiscordReport(r) {
  const channelId = process.env.BOT_LOG_DISCORD_CHANNEL_ID || '1493926218574200942';
  const token = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!channelId || !token) return;
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `**ProfitsLocal · Daily API Usage** · ${date}`,
    `─────────────────────────────`,
    `Today (24h): $${r.today_usd.toFixed(2)} · ${r.last_24h_events} events`,
    `Month-to-date: $${r.month_to_date_usd.toFixed(2)}`,
    '',
    `**Last 24h by provider:**`,
    ...Object.entries(r.by_provider_24h).map(([p, a]) => `· ${p}: $${a.cost.toFixed(2)} · ${a.count} calls`),
    '',
    `**Last 30d by provider:**`,
    ...Object.entries(r.by_provider_30d).slice(0, 10).map(([p, a]) => `· ${p}: $${a.cost.toFixed(2)} · ${a.count} calls`),
  ];
  if (r.places_quota) {
    lines.push('', '**Places API quota:**');
    for (const [k, q] of Object.entries(r.places_quota)) {
      const pct = ((q.used || 0) / (q.limit || 1) * 100).toFixed(1);
      lines.push(`· ${k}: ${q.used || 0}/${q.limit || 0} (${pct}%)`);
    }
  }
  if (r.alerts.length) {
    lines.push('', `**⚠️ ALERTS:**`);
    for (const a of r.alerts) lines.push(`· ${a}`);
  } else {
    lines.push('', `Alerts: 无 · healthy`);
  }
  try {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'profitslocal-cost-doctor',
      },
      body: JSON.stringify({ content: lines.join('\n').slice(0, 2000) }),
    });
  } catch {}
}
