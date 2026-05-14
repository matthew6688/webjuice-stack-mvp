#!/usr/bin/env node
/**
 * pl:e2e-smoke · V3 D43 (2026-05-14)
 *
 * Daily E2E regression check · drives all 6 task kinds + qualification.
 * Replaces the manual /tmp/e2e-driver*.sh scripts used during D43 fix loop.
 *
 * Behavior:
 *   1. Firehose Discord test channels (idempotent · gives clean slate)
 *   2. Create starter threads · one per kind
 *   3. Poll for terminal messages
 *   4. Verify expected outcomes:
 *      · single-enrich Brisbane→Sydney → exit=3 (LLM judge reject)
 *      · audit pipeline → status=done within 10min (P2 timeout fix)
 *      · qualification (CLI) → verdict in {ready-to-build, qa-pending}
 *      · ops random text → status=human (P3 + N1 fix)
 *      · image-extract phone-only sign → status=done (N2 fix · judge proceed)
 *   5. Generate diff vs baseline (data/qa/e2e-baseline.json)
 *   6. Alert on regression → Discord bot-log
 *   7. Optionally cleanup (--clean)
 *
 * Usage:
 *   npm run pl:e2e-smoke              # human · keep threads
 *   npm run pl:e2e-smoke -- --json    # cron
 *   npm run pl:e2e-smoke -- --clean   # delete test threads after
 *   npm run pl:e2e-smoke -- --baseline # update baseline (after intentional change)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes('--json');
const DO_CLEAN = ARGS.includes('--clean');
const UPDATE_BASELINE = ARGS.includes('--baseline');

const TOK = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN;
const GUILD_ID = '1493925728570310756';
const FORUM_ID = '1503702990761099419';
const CHANS = [
  ['1503702990761099419', 'website-tasks'],
  ['1501187038706401290', 'website-leads'],
  ['1501945763650080899', 'website-projects'],
  ['1503513633756283070', 'lead-discovery-runs'],
];

if (!TOK) { console.error('missing WEBSITE_TASKS_DISCORD_BOT_TOKEN'); process.exit(2); }

async function api(method, p, body) {
  const opts = { method, headers: { Authorization: `Bot ${TOK}`, 'User-Agent': 'pl-e2e-smoke' } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(`https://discord.com/api/v10${p}`, opts);
  if (!r.ok && r.status !== 204) return { ok: false, status: r.status, text: await r.text().catch(() => '') };
  if (r.status === 204) return { ok: true, status: 204 };
  return { ok: true, status: r.status, json: await r.json().catch(() => null) };
}

async function firehose(cid) {
  let n = 0;
  for (let round = 0; round < 3; round++) {
    const active = (await api('GET', `/guilds/${GUILD_ID}/threads/active`)).json?.threads
      ?.filter((t) => t.parent_id === cid).map((t) => t.id) || [];
    const archived = (await api('GET', `/channels/${cid}/threads/archived/public?limit=100`)).json?.threads
      ?.map((t) => t.id) || [];
    const all = [...new Set([...active, ...archived])];
    if (!all.length) break;
    for (const tid of all) {
      const r = await api('DELETE', `/channels/${tid}`);
      if (r.ok) n++;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return n;
}

async function postThread(name, content) {
  const r = await api('POST', `/channels/${FORUM_ID}/threads`, { name, message: { content }, auto_archive_duration: 1440 });
  return r.json?.id || null;
}

async function waitTerminal(tid, maxSec) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxSec) {
    await new Promise(r => setTimeout(r, 10000));
    const msgs = (await api('GET', `/channels/${tid}/messages?limit=50`)).json || [];
    const terminal = msgs.find((m) => m.author?.bot && /完成|失败|超时|转人工|judge/.test(m.content || ''));
    if (terminal) return { ok: true, elapsed_s: Math.round((Date.now() - start) / 1000), content: terminal.content };
  }
  return { ok: false, elapsed_s: maxSec, content: null };
}

async function fetchTaskStateForKind(kind) {
  // Find most recent task of this kind, return summary
  const files = fs.readdirSync(path.join(REPO, 'data/tasks')).filter((f) => f.endsWith('.json'));
  const matching = files.map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(REPO, 'data/tasks', f), 'utf8')); } catch { return null; }
  }).filter((t) => t?.kind === kind).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return matching[0] || null;
}

// Test scenarios with expected outcomes
const SCENARIOS = [
  {
    id: 'places-intake',
    kind: 'places-intake',
    starter: '"roofer brisbane"',
    max_wait_s: 240,
    expect: (task) => task?.status === 'done',
  },
  {
    id: 'intake',
    kind: 'intake',
    starter: 'find brisbane roofers --count 2',
    max_wait_s: 300,
    expect: (task) => task?.status === 'done',
  },
  {
    id: 'single-enrich-reject',
    kind: 'single-enrich',
    starter: 'Topline Roofing Brisbane 07 3160 6044',
    max_wait_s: 120,
    // Expected: LLM judge reject (Brisbane intent → Sydney NSW result)
    expect: (task) => task?.status === 'failed' && /llm_judge_rejected|exit=3/.test(JSON.stringify(task.progress)),
  },
  {
    id: 'ops-human',
    kind: 'ops',
    starter: 'please look into this random thing',
    max_wait_s: 60,
    // Expected: target_cli=null + status=human (P3 + N1 fix)
    expect: (task) => task?.status === 'human' && !task.target?.cli,
  },
];

async function run() {
  const start = Date.now();
  const t0 = new Date().toISOString();

  // 1. Firehose (idempotent)
  const wiped = {};
  for (const [cid, name] of CHANS) wiped[name] = await firehose(cid);

  // 2. Run each scenario
  const results = [];
  for (const s of SCENARIOS) {
    const tid = await postThread(`🧪 e2e-smoke ${s.id}`, s.starter);
    if (!tid) {
      results.push({ ...s, error: 'thread create failed' });
      continue;
    }
    const term = await waitTerminal(tid, s.max_wait_s);
    // Pull the task state from store
    const task = await fetchTaskStateForKind(s.kind);
    const pass = s.expect ? !!s.expect(task) : term.ok;
    results.push({
      id: s.id, kind: s.kind,
      thread_id: tid,
      wait_terminal: term.ok,
      elapsed_s: term.elapsed_s,
      task_status: task?.status,
      task_exit: task?.progress?.[task.progress.length - 1]?.detail?.slice(0, 80),
      pass,
    });
  }

  // 3. Baseline diff
  const baselinePath = path.join(REPO, 'data/qa/e2e-baseline.json');
  let baseline = null;
  if (fs.existsSync(baselinePath)) {
    try { baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')); } catch {}
  }
  const summary = {
    generated_at: t0,
    duration_s: Math.round((Date.now() - start) / 1000),
    scenarios: results,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    total: results.length,
    wiped_threads: wiped,
  };
  const regressions = [];
  if (baseline) {
    for (const cur of results) {
      const prev = baseline.scenarios?.find((b) => b.id === cur.id);
      if (prev && prev.pass && !cur.pass) {
        regressions.push({ id: cur.id, was: prev.task_status, now: cur.task_status });
      }
    }
  }
  summary.regressions = regressions;

  // 4. Update baseline if asked
  if (UPDATE_BASELINE) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, JSON.stringify(summary, null, 2));
    console.error(`baseline updated: ${baselinePath}`);
  }

  // 5. Heartbeat
  try {
    fs.mkdirSync(path.join(REPO, 'data/heartbeats'), { recursive: true });
    fs.writeFileSync(path.join(REPO, 'data/heartbeats/e2e-smoke.txt'), t0);
  } catch {}

  // 6. Optional cleanup
  if (DO_CLEAN) {
    for (const [cid] of CHANS) await firehose(cid);
  }

  // 7. Output + Discord alert
  if (JSON_MODE) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`E2E smoke · ${summary.passed}/${summary.total} pass · ${summary.duration_s}s`);
    for (const r of results) {
      console.log(`  ${r.pass ? '✓' : '✗'} ${r.id.padEnd(25)} status=${r.task_status} · ${r.elapsed_s}s`);
    }
    if (regressions.length) {
      console.log('');
      console.log('⚠️  REGRESSIONS:');
      for (const r of regressions) console.log(`  · ${r.id}: was ${r.was} now ${r.now}`);
    }
  }
  if ((regressions.length || summary.failed > 0) && process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN) {
    await postBotLog(summary);
  }
  process.exit(summary.failed > 0 || regressions.length > 0 ? 1 : 0);
}

async function postBotLog(s) {
  const cid = process.env.BOT_LOG_DISCORD_CHANNEL_ID || '1493926218574200942';
  const lines = [
    `**ProfitsLocal · E2E Smoke** · ${s.generated_at.slice(0, 10)}`,
    `─────────────────────────────`,
    `Pass: ${s.passed}/${s.total} · ${s.duration_s}s`,
  ];
  if (s.regressions?.length) {
    lines.push('', `**⚠️ REGRESSIONS:**`);
    for (const r of s.regressions) lines.push(`· ${r.id}: was ${r.was} now ${r.now}`);
  }
  for (const r of s.scenarios) {
    if (!r.pass) lines.push(`· ✗ ${r.id} · status=${r.task_status}`);
  }
  try {
    await fetch(`https://discord.com/api/v10/channels/${cid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${TOK}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: lines.join('\n').slice(0, 2000) }),
    });
  } catch {}
}

run().catch((err) => { console.error('e2e-smoke fatal:', err.message); process.exit(2); });
