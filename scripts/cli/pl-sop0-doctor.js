#!/usr/bin/env node
/**
 * pl:sop0-doctor — 一行总检 SOP-0 是否健康。
 *
 * 5 个独立检查，每个 ≤ 5s 超时：
 *   1. 5 daemon 在跑（launchd PID 不是 -）
 *   2. tasks.profitslocal.com 可达（tunnel + API）
 *   3. Discord listener heartbeat < 60s
 *   4. Ollama router 可达 + 返回 valid kind
 *   5. data/tasks 没有 stuck (running > 15min)
 *
 * 退出 0 = 全绿，1 = 任意 ❌（CI / cron 可读）。
 *
 * Usage:
 *   npm run pl:sop0-doctor
 *   npm run pl:sop0-doctor -- --json   # 机器可读
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes('--json');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const c = (s, color) => JSON_MODE ? s : `${color}${s}${X}`;

const checks = [];
function record(name, ok, detail, fix = null) {
  checks.push({ name, ok, detail, fix });
}

// ---------- 1. 5 daemon 在跑 ----------
{
  const expected = [
    'ai.profitslocal.task-listener',
    'ai.profitslocal.task-dispatcher',
    'ai.profitslocal.task-api',
    'ai.profitslocal.sop0-tunnel',
    'ai.profitslocal.task-retention',
  ];
  const r = spawnSync('launchctl', ['list'], { encoding: 'utf8', timeout: 5000 });
  const lines = (r.stdout || '').split('\n');
  const status = {};
  for (const label of expected) {
    const line = lines.find((l) => l.endsWith(label));
    if (!line) { status[label] = 'missing'; continue; }
    const [pid] = line.trim().split(/\s+/);
    status[label] = pid === '-' ? 'stopped' : `pid=${pid}`;
  }
  const running = expected.filter((l) => status[l].startsWith('pid='));
  // retention 是 calendar-interval (StartCalendarInterval 03:00)，平时 pid=-，只在 03:00 跑
  // 所以它不算 daemon 全跑的硬条件
  const isRetention = (l) => l === 'ai.profitslocal.task-retention';
  const otherRunning = expected.filter((l) => !isRetention(l) && status[l].startsWith('pid='));
  const ok = otherRunning.length === 4;
  record(
    '5 daemon 在跑 (listener · dispatcher · api · tunnel · retention)',
    ok,
    `${running.length}/5 在跑 · ${expected.filter((l) => !status[l].startsWith('pid=')).map((l) => `${l.split('.').pop()}=${status[l]}`).join(' · ') || 'all up'}`,
    !ok ? 'launchctl kickstart -k gui/$UID/ai.profitslocal.<label>' : null
  );
}

// ---------- 2. tunnel + API 可达 ----------
{
  const token = process.env.SOP0_API_AUTH_TOKEN;
  if (!token) {
    record('tasks.profitslocal.com tunnel + API', false, 'SOP0_API_AUTH_TOKEN 未设置', '检查 .env.local · 或先跑 source .env.local');
  } else {
    const t0 = Date.now();
    const r = spawnSync('/usr/bin/curl', [
      '-sS', '-m', '5',
      '-o', '/dev/null',
      '-w', '%{http_code}',
      '-H', `Authorization: Bearer ${token}`,
      'https://tasks.profitslocal.com/api/tasks?limit=1',
    ], { encoding: 'utf8', timeout: 6000 });
    const code = (r.stdout || '').trim();
    const ms = Date.now() - t0;
    const ok = code === '200';
    record(
      'tasks.profitslocal.com 可达',
      ok,
      ok ? `HTTP 200 · ${ms}ms` : `HTTP ${code || 'no-response'}`,
      !ok ? 'launchctl kickstart -k gui/$UID/ai.profitslocal.sop0-tunnel · 或 ai.profitslocal.task-api' : null
    );
  }
}

// ---------- 3. Discord listener heartbeat ----------
// Listener 是 WS-driven daemon · 没消息时 log 静默是正常的。
// 真实信号 = launchd PID 还活着（check #1 已覆盖）+ log 没在喷 error。
// 这里查 error.log 最近 5min 有没有新错误，作为"在线"的补充信号。
{
  const errLog = path.resolve('data/tasks/_logs/task-listener.error.log');
  const log = path.resolve('data/tasks/_logs/task-listener.log');
  if (!fs.existsSync(log)) {
    record('Discord listener 健康', false, 'log 文件不存在', 'launchctl bootstrap … task-listener · 或 npm run pl:task-listener (前台)');
  } else {
    let recentErrors = 0;
    if (fs.existsSync(errLog)) {
      const stat = fs.statSync(errLog);
      const age = (Date.now() - stat.mtimeMs) / 1000;
      if (age < 300) {
        // 5min 内 error.log 有更新 → 数最后几行
        const tail = fs.readFileSync(errLog, 'utf8').split('\n').slice(-20).filter((l) => l.trim());
        recentErrors = tail.length;
      }
    }
    const ok = recentErrors === 0;
    record(
      'Discord listener 健康',
      ok,
      ok ? `error.log 5min 内无新错误 · log mtime=${new Date(fs.statSync(log).mtimeMs).toISOString()}` : `error.log 5min 内 ${recentErrors} 条新 error`,
      !ok ? `tail -n 20 ${errLog}` : null
    );
  }
}

// ---------- 4. Ollama router ----------
{
  try {
    const { routeIntent } = await import(path.resolve('core/tasks/intent-router.js'));
    const t0 = Date.now();
    const out = await Promise.race([
      routeIntent({ text: 'find brisbane plumbers' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 20s · 模型可能冷启动')), 20000)),
    ]);
    const ms = Date.now() - t0;
    const ok = ['intake', 'places-intake', 'single-enrich'].includes(out.kind);
    record(
      'Ollama router 可达',
      ok,
      `provider=${out.provider} · kind=${out.kind} · ${ms}ms`,
      !ok && out.provider !== 'ollama' ? 'ollama serve · 或 ollama pull qwen3.5:9b' : null
    );
  } catch (err) {
    record('Ollama router 可达', false, err.message, 'ollama serve · 或 ollama pull qwen3.5:9b');
  }
}

// ---------- 5. 没有 stuck task ----------
{
  try {
    const { listTasks } = await import(path.resolve('core/tasks/task-store.js'));
    const STUCK_MS = 15 * 60 * 1000;
    const now = Date.now();
    const running = listTasks({ status: 'running' });
    const stuck = running.filter((t) => now - new Date(t.updated_at).getTime() > STUCK_MS);
    const human = listTasks({ status: 'human' });
    const pending = listTasks({ status: 'pending' });
    const ok = stuck.length === 0;
    record(
      '没有 stuck task',
      ok,
      `pending=${pending.length} · running=${running.length} · human=${human.length} · stuck=${stuck.length}`,
      stuck.length > 0
        ? `stuck task ids: ${stuck.slice(0, 3).map((t) => t.task_id).join(', ')}${stuck.length > 3 ? '…' : ''} · 看 data/tasks/<id>.json progress 末尾`
        : null
    );
  } catch (err) {
    record('没有 stuck task', false, err.message, null);
  }
}

// ---------- 输出 ----------
const passed = checks.filter((c) => c.ok).length;
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
  const summary = allOk ? c(`✅ ${passed}/${total} 健康`, G) : c(`❌ ${passed}/${total} 通过`, R);
  console.log(summary);
  console.log('');
}

process.exit(allOk ? 0 : 1);
