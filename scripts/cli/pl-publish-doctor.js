#!/usr/bin/env node
/**
 * pl:publish-doctor · V3 D43 (2026-05-14) · 每日 demo publish 健康检查
 *
 * 检查:
 *   - cf-pages-deploy.json 新鲜度 per published entity
 *   - 抽样 5 个最近 deploy 的 evidence URL · 检测 404
 *   - 已发布但缺失 master.md 的 entity
 *   - 已发布但缺失 demo URL 的 entity
 *   - heartbeat 新鲜度
 *
 * Output:
 *   - data/heartbeats/publish-doctor.txt
 *   - Discord bot-log 报告 (alerts only or --report)
 *
 * Usage:
 *   npm run pl:publish-doctor              # 人读
 *   npm run pl:publish-doctor -- --json    # cron
 *   npm run pl:publish-doctor -- --report  # 强制日报
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

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function checkUrl(url, timeoutMs = 8000) {
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(tm);
    return { url, status: r.status, ok: r.ok };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.message };
  }
}

const entities = readEntities();
const now = Date.now();

const published = [];
const missingMaster = [];
const missingDemo = [];
const staleDeploys = [];

for (const e of entities) {
  const slug = slugify(e.latest?.name || (e.entityKey || e.entity_key));
  const deployPath = path.join(REPO, 'clients', slug, 'v2/concept/reference-adapter/cf-pages-deploy.json');
  if (!fs.existsSync(deployPath)) continue;
  let deploy;
  try { deploy = JSON.parse(fs.readFileSync(deployPath, 'utf8')); } catch { continue; }
  const deployedAt = new Date(deploy.deployed_at || deploy.created_on || 0).getTime();
  const ageDays = (now - deployedAt) / (24 * 3600 * 1000);
  const url = deploy.demo_url || deploy.url || deploy.deployment_url;
  published.push({ key: (e.entityKey || e.entity_key), slug, url, ageDays, deployedAt });

  const masterPath = path.join(REPO, 'clients', slug, 'v2/master.md');
  if (!fs.existsSync(masterPath)) missingMaster.push((e.entityKey || e.entity_key));
  if (!url) missingDemo.push((e.entityKey || e.entity_key));
  if (ageDays > 30) staleDeploys.push({ key: (e.entityKey || e.entity_key), ageDays: Math.round(ageDays) });
}

// Sample-check 5 recent URLs
const recent = published.filter((p) => p.url).sort((a, b) => b.deployedAt - a.deployedAt).slice(0, 5);
const urlChecks = [];
for (const p of recent) {
  const result = await checkUrl(p.url);
  urlChecks.push({ key: p.key, ...result });
}
const broken = urlChecks.filter((u) => !u.ok);

const hbPath = path.join(REPO, 'data/heartbeats/cf-pages-deploy.txt');
let hbAgeH = null;
if (fs.existsSync(hbPath)) hbAgeH = (now - fs.statSync(hbPath).mtimeMs) / 3600000;

const alerts = [];
if (broken.length) alerts.push(`${broken.length}/${urlChecks.length} sampled demo URL 404/error`);
if (missingMaster.length) alerts.push(`${missingMaster.length} published entity 缺 master.md`);
if (missingDemo.length) alerts.push(`${missingDemo.length} entity 有 deploy 记录但无 URL`);
if (hbAgeH !== null && hbAgeH > 48) alerts.push(`cf-pages-deploy heartbeat ${hbAgeH.toFixed(1)}h old`);

const report = {
  generated_at: new Date().toISOString(),
  total_published: published.length,
  url_checks: urlChecks,
  broken_count: broken.length,
  missing_master: missingMaster,
  missing_demo_url: missingDemo,
  stale_deploys: staleDeploys.slice(0, 10),
  heartbeat_age_hours: hbAgeH,
  alerts,
  alert_count: alerts.length,
};

const hbDir = path.join(REPO, 'data/heartbeats');
try {
  fs.mkdirSync(hbDir, { recursive: true });
  fs.writeFileSync(path.join(hbDir, 'publish-doctor.txt'), new Date().toISOString());
} catch {}

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
  if ((alerts.length || FORCE_REPORT) && (process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN)) {
    sendDiscord(report).catch(() => {});
  }
  process.exit(alerts.length > 0 ? 1 : 0);
}

console.log('');
console.log(c('🚀 ProfitsLocal Publish Doctor', G));
console.log(c('─────────────────────────────────────', D));
console.log(`Total published:    ${published.length}`);
console.log(`URL spot-check:     ${urlChecks.length - broken.length}/${urlChecks.length} OK`);
console.log(`Missing master.md:  ${missingMaster.length}`);
console.log(`Missing demo URL:   ${missingDemo.length}`);
console.log(`Stale deploys >30d: ${staleDeploys.length}`);
console.log(`Heartbeat age:      ${hbAgeH === null ? 'missing' : hbAgeH.toFixed(1) + 'h'}`);

if (urlChecks.length) {
  console.log('');
  console.log(c('Spot-checked URLs:', D));
  for (const u of urlChecks) {
    const mark = u.ok ? c('✓', G) : c('✗', R);
    console.log(`  ${mark} ${u.key} · ${u.status} · ${u.url}`);
  }
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
    `**ProfitsLocal · Publish Doctor** · ${date}`,
    `─────────────────────────────`,
    `Published demos: ${r.total_published}`,
    `URL spot-check: ${r.url_checks.length - r.broken_count}/${r.url_checks.length} OK`,
    `Missing master.md: ${r.missing_master.length}`,
    `Missing demo URL: ${r.missing_demo_url.length}`,
    `Stale deploys >30d: ${r.stale_deploys.length}`,
    `Heartbeat: ${r.heartbeat_age_hours === null ? 'missing' : r.heartbeat_age_hours.toFixed(1) + 'h old'}`,
  ];
  if (r.broken_count) {
    lines.push('', `**⚠️ Broken URLs:**`);
    for (const u of r.url_checks.filter((x) => !x.ok)) lines.push(`· ${u.key}: ${u.status} ${u.url}`);
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
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profitslocal-publish-doctor' },
      body: JSON.stringify({ content: lines.join('\n').slice(0, 2000) }),
    });
  } catch {}
}
