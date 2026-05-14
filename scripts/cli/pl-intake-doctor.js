#!/usr/bin/env node
/**
 * pl:intake-doctor — 一行总检 SOP-1 (intake → entity → master.md enqueue) 是否健康。
 *
 * 复用 pl:sop0-doctor 的结构 · 5 个独立检查，每个 ≤ 10s 超时：
 *   1. data/leads/entities/ 最近 24h 有新文件（intake 活着的最强信号）
 *   2. Docker daemon up + gmaps-scraper-web container Running + HTTP 200
 *   3. GOOGLE_PLACES_API_KEY 存在（或备用 key GOOGLE_PLACES_API_KEY_2..N）
 *   4. master.md refresh 任务积压 < 10（enqueue 没堵）
 *   5. intent-router regex 路径返回 valid kind（不花钱 · ollama/paid 失败时回落 regex 必须保底）
 *
 * 退出 0 = 全绿，1 = 任意 ❌（CI / cron 可读）。
 *
 * Usage:
 *   npm run pl:intake-doctor
 *   npm run pl:intake-doctor -- --json   # 机器可读
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// V3 D43 fix (2026-05-14): defensive .env.local loader.
// Operators invoke `node scripts/cli/pl-intake-doctor.js` directly (without
// --env-file=.env.local) all the time. Without it, GOOGLE_PLACES_API_KEY is
// missing → false negative. Load .env.local at the repo root if no key set.
if (!process.env.GOOGLE_PLACES_API_KEY) {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes('--json');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const c = (s, color) => JSON_MODE ? s : `${color}${s}${X}`;

const checks = [];
function record(name, ok, detail, fix = null) {
  checks.push({ name, ok, detail, fix });
}

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

// ---------- 1. entities dir 24h 内有新文件 ----------
{
  const dir = path.join(REPO, 'data/leads/entities');
  if (!fs.existsSync(dir)) {
    record('intake 活着 (entities/ 24h 新文件)', false, 'data/leads/entities/ 目录不存在', '运行任意 intake 一次');
  } else {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    const fresh = files.filter((f) => {
      try { return fs.statSync(path.join(dir, f)).mtimeMs >= cutoff; } catch { return false; }
    });
    const ok = fresh.length > 0;
    record(
      'intake 活着 (entities/ 24h 新文件)',
      ok,
      `${fresh.length} 个 24h 内更新 · total=${files.length}`,
      !ok ? '24h 无 intake · 跑 npm run pl:places-search-intake -- "plumber brisbane" --limit 1 验证' : null
    );
  }
}

// ---------- 2. Docker + gmaps-scraper-web ----------
{
  const CONTAINER = process.env.GMAPS_SCRAPER_CONTAINER || 'gmaps-scraper-web';
  const BASE = process.env.GMAPS_SCRAPER_BASE || 'http://localhost:8080';
  let fail = null;
  let detail = '';
  // 2a daemon
  const di = spawnSync('docker', ['info'], { encoding: 'utf8', timeout: 5000 });
  if (di.status !== 0) {
    fail = 'docker_daemon';
    detail = 'docker daemon 不可达';
  } else {
    // 2b container running
    const ins = spawnSync('docker', ['inspect', '--format', '{{.State.Running}}', CONTAINER], { encoding: 'utf8', timeout: 5000 });
    if (ins.status !== 0) {
      fail = 'container_missing';
      detail = `容器 ${CONTAINER} 不存在`;
    } else if (String(ins.stdout || '').trim() !== 'true') {
      fail = 'container_stopped';
      detail = `容器 ${CONTAINER} 停了`;
    } else {
      // 2c HTTP probe
      try {
        const res = await fetch(`${BASE}/api/v1/jobs`, { method: 'GET', signal: AbortSignal.timeout(5000) });
        if (!res.ok && res.status !== 405 && res.status !== 404) {
          fail = 'http_unhealthy';
          detail = `HTTP ${res.status}`;
        } else {
          detail = `daemon ok · container running · HTTP ${res.status}`;
        }
      } catch (err) {
        fail = 'http_unreachable';
        detail = `HTTP 不通: ${err.message}`;
      }
    }
  }
  record(
    'Docker scraper 健康',
    !fail,
    detail,
    fail === 'docker_daemon' ? 'open -a Docker · 等 10s'
      : fail === 'container_missing' ? `docker run -d --name ${CONTAINER} -p 8080:8080 gosom/google-maps-scraper`
      : fail === 'container_stopped' ? `docker start ${CONTAINER}`
      : fail ? `docker restart ${CONTAINER}` : null
  );
}

// ---------- 3. GOOGLE_PLACES_API_KEY 存在 ----------
{
  const primary = process.env.GOOGLE_PLACES_API_KEY;
  const extras = [];
  for (let i = 2; i <= 5; i++) {
    if (process.env[`GOOGLE_PLACES_API_KEY_${i}`]) extras.push(i);
  }
  const ok = !!primary;
  record(
    'GOOGLE_PLACES_API_KEY 配置',
    ok,
    ok ? `primary set${extras.length ? ` · extras=${extras.join(',')}` : ' · 无 backup key'}` : 'GOOGLE_PLACES_API_KEY 未设置',
    !ok ? '检查 .env.local · 加 GOOGLE_PLACES_API_KEY=<key>' : null
  );
}

// ---------- 4. master.md refresh 任务积压 ----------
{
  try {
    const { listTasks } = await import(path.join(REPO, 'core/tasks/task-store.js'));
    const pending = listTasks({ kind: 'ops' }).filter((t) =>
      ['pending', 'running'].includes(t.status)
      && t.target?.cli === 'leads:build-master-md'
    );
    const ok = pending.length < 10;
    record(
      'master.md refresh 积压 < 10',
      ok,
      `pending/running build-master-md = ${pending.length}`,
      !ok ? `dispatcher 没消化 · 检查 launchctl list | grep task-dispatcher · pending task ids: ${pending.slice(0, 3).map((t) => t.task_id).join(', ')}` : null
    );
  } catch (err) {
    record('master.md refresh 积压 < 10', false, err.message, null);
  }
}

// ---------- 5. intent-router regex 路径 ----------
// 用 regex provider 直接路由 · 不花钱 · regex 必须永远保底。
{
  try {
    // Force regex-only cascade (cheap · always-available safety net)
    const prevCascade = process.env.INTENT_ROUTER_CASCADE;
    process.env.INTENT_ROUTER_CASCADE = 'regex';
    const mod = await import(path.join(REPO, 'core/tasks/intent-router.js'));
    const route = mod.routeIntent || mod.default;
    const t0 = Date.now();
    const out = await Promise.race([
      route({ text: 'find brisbane plumbers' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 10s')), 10000)),
    ]);
    if (prevCascade) process.env.INTENT_ROUTER_CASCADE = prevCascade;
    else delete process.env.INTENT_ROUTER_CASCADE;
    const ms = Date.now() - t0;
    const kindOk = ['intake', 'places-intake', 'single-enrich'].includes(out?.kind);
    // args 是数组 ['--niche', 'plumber', '--city', 'brisbane']
    const argList = Array.isArray(out?.args) ? out.args : [];
    const argMap = {};
    for (let i = 0; i < argList.length; i += 2) {
      if (argList[i]?.startsWith('--')) argMap[argList[i].slice(2)] = argList[i + 1];
    }
    const argsOk = !!argMap.niche && !!argMap.city;
    const ok = kindOk && argsOk;
    record(
      'intent-router regex 保底',
      ok,
      `kind=${out?.kind} · niche=${argMap.niche} · city=${argMap.city} · ${ms}ms`,
      !ok ? '检查 core/tasks/intent-router.js NICHE_KEYWORDS / CITY_KEYWORDS' : null
    );
  } catch (err) {
    record('intent-router regex 保底', false, err.message, null);
  }
}

// ---------- heartbeat ----------
const hbDir = path.join(REPO, 'data/heartbeats');
try {
  fs.mkdirSync(hbDir, { recursive: true });
  fs.writeFileSync(path.join(hbDir, 'intake-doctor.txt'), new Date().toISOString());
} catch { /* heartbeat 失败不阻断 doctor 输出 */ }

// ---------- 输出 ----------
const passed = checks.filter((ch) => ch.ok).length;
const total = checks.length;
const allOk = passed === total;

if (JSON_MODE) {
  console.log(JSON.stringify({ ok: allOk, passed, total, checks }, null, 2));
} else {
  console.log('');
  for (const ch of checks) {
    const mark = ch.ok ? c('✅', G) : c('❌', R);
    console.log(`${mark} ${ch.name}`);
    console.log(`   ${c(ch.detail, D)}`);
    if (!ch.ok && ch.fix) console.log(`   ${c('fix:', Y)} ${ch.fix}`);
  }
  console.log('');
  const summary = allOk ? c(`✅ ${passed}/${total} SOP-1 健康`, G) : c(`❌ ${passed}/${total} 通过`, R);
  console.log(summary);
  console.log('');
}

process.exit(allOk ? 0 : 1);
