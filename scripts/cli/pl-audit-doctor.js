#!/usr/bin/env node
/**
 * pl:audit-doctor · V3 D43 (2026-05-14) · 每日 audit pipeline 健康检查
 *
 * 检查:
 *   - 最近 24h audit 运行数 (data/leads/entities/*.json · audit_runs)
 *   - 卡在 audit 状态 >24h 的 entity (started but no result)
 *   - 最近 7d audit 失败率
 *   - Stage 5 qualification verdict 分布
 *   - heartbeat 新鲜度 (audit-pipeline.txt)
 *
 * Output:
 *   - data/heartbeats/audit-doctor.txt
 *   - Discord bot-log 报告 (alerts only or --report)
 *
 * Usage:
 *   npm run pl:audit-doctor              # 人读
 *   npm run pl:audit-doctor -- --json    # cron 用
 *   npm run pl:audit-doctor -- --report  # 强制日报到 Discord
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes('--json');
const FORCE_REPORT = ARGS.includes('--report');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const c = (s, color) => JSON_MODE ? s : `${color}${s}${X}`;

function readEntities() {
  const dir = path.join(REPO, 'data/leads/entities');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; }
  }).filter(Boolean);
}

function lastAuditRun(e) {
  const runs = e.audit_runs || [];
  if (!runs.length) return null;
  return runs[runs.length - 1];
}

const entities = readEntities();
const now = Date.now();
const last24h = now - 24 * 60 * 60 * 1000;
const last7d = now - 7 * 24 * 60 * 60 * 1000;

const audits24h = [];
const audits7d = [];
const stuck = [];
const verdictCounts = {};
const phaseCounts = {};

for (const e of entities) {
  phaseCounts[e.phase || 'unknown'] = (phaseCounts[e.phase || 'unknown'] || 0) + 1;

  const r = lastAuditRun(e);
  if (r) {
    const t = new Date(r.completed_at || r.started_at || 0).getTime();
    if (t >= last7d) audits7d.push({ e, r });
    if (t >= last24h) audits24h.push({ e, r });
    if (r.started_at && !r.completed_at) {
      const startedAt = new Date(r.started_at).getTime();
      if (now - startedAt > 24 * 60 * 60 * 1000) stuck.push({ key: e.entity_key, ageH: Math.round((now - startedAt) / 3600000) });
    }
  }

  if (e.qualification?.verdict) {
    const v = e.qualification.verdict;
    verdictCounts[v] = (verdictCounts[v] || 0) + 1;
  }
}

const failures7d = audits7d.filter(({ r }) => r.status === 'failed' || r.error).length;
const failRate = audits7d.length ? failures7d / audits7d.length : 0;

// heartbeat freshness
const hbPath = path.join(REPO, 'data/heartbeats/audit-pipeline.txt');
let hbAgeH = null;
if (fs.existsSync(hbPath)) {
  hbAgeH = (now - fs.statSync(hbPath).mtimeMs) / 3600000;
}

const alerts = [];
if (stuck.length) alerts.push(`${stuck.length} entity 卡在 audit >24h: ${stuck.slice(0, 3).map((s) => s.key).join(', ')}`);
if (failRate > 0.2) alerts.push(`7d 失败率 ${(failRate * 100).toFixed(0)}% > 20%`);
if (hbAgeH !== null && hbAgeH > 48) alerts.push(`audit-pipeline heartbeat ${hbAgeH.toFixed(1)}h old`);
if (audits24h.length === 0 && entities.some((e) => e.phase === 'awaiting')) alerts.push(`24h 无 audit run · 但有 awaiting entity`);

const report = {
  generated_at: new Date().toISOString(),
  total_entities: entities.length,
  audits_last_24h: audits24h.length,
  audits_last_7d: audits7d.length,
  failures_last_7d: failures7d,
  fail_rate_7d: failRate,
  stuck_entities: stuck,
  by_phase: phaseCounts,
  by_verdict: verdictCounts,
  heartbeat_age_hours: hbAgeH,
  alerts,
  alert_count: alerts.length,
};

const hbDir = path.join(REPO, 'data/heartbeats');
try {
  fs.mkdirSync(hbDir, { recursive: true });
  fs.writeFileSync(path.join(hbDir, 'audit-doctor.txt'), new Date().toISOString());
} catch {}

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
  if ((alerts.length || FORCE_REPORT) && (process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN)) {
    sendDiscord(report).catch(() => {});
  }
  process.exit(alerts.length > 0 ? 1 : 0);
}

console.log('');
console.log(c('🔍 ProfitsLocal Audit Pipeline Doctor', G));
console.log(c('─────────────────────────────────────', D));
console.log(`Total entities:     ${entities.length}`);
console.log(`Audits 24h:         ${audits24h.length}`);
console.log(`Audits 7d:          ${audits7d.length} (${failures7d} failed · ${(failRate * 100).toFixed(0)}%)`);
console.log(`Heartbeat age:      ${hbAgeH === null ? 'no heartbeat' : hbAgeH.toFixed(1) + 'h'}`);
console.log('');
console.log(c('By phase:', D));
for (const [p, n] of Object.entries(phaseCounts)) console.log(`  ${p.padEnd(20)} ${n}`);
console.log('');
console.log(c('By qualification verdict:', D));
for (const [v, n] of Object.entries(verdictCounts)) console.log(`  ${v.padEnd(20)} ${n}`);

if (stuck.length) {
  console.log('');
  console.log(c(`⚠️ Stuck entities (${stuck.length}):`, Y));
  for (const s of stuck.slice(0, 10)) console.log(`  ${s.key} · ${s.ageH}h`);
}

if (alerts.length > 0) {
  console.log('');
  console.log(c(`⚠️ ${alerts.length} ALERT(S):`, R));
  for (const a of alerts) console.log(c(`  ${a}`, R));
}

console.log('');

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
    `**ProfitsLocal · Audit Pipeline Doctor** · ${date}`,
    `─────────────────────────────`,
    `Total entities: ${r.total_entities}`,
    `Audits 24h: ${r.audits_last_24h} · 7d: ${r.audits_last_7d} (${r.failures_last_7d} failed · ${(r.fail_rate_7d * 100).toFixed(0)}%)`,
    `Heartbeat: ${r.heartbeat_age_hours === null ? 'missing' : r.heartbeat_age_hours.toFixed(1) + 'h old'}`,
    '',
    `**By phase:**`,
    ...Object.entries(r.by_phase).map(([p, n]) => `· ${p}: ${n}`),
    '',
    `**By verdict:**`,
    ...Object.entries(r.by_verdict).map(([v, n]) => `· ${v}: ${n}`),
  ];
  if (r.stuck_entities.length) {
    lines.push('', `**⚠️ Stuck >24h:**`);
    for (const s of r.stuck_entities.slice(0, 5)) lines.push(`· ${s.key} (${s.ageH}h)`);
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
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profitslocal-audit-doctor' },
      body: JSON.stringify({ content: lines.join('\n').slice(0, 2000) }),
    });
  } catch {}
}
