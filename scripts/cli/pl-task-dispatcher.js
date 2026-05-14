#!/usr/bin/env node
/**
 * scripts/cli/pl-task-dispatcher.js · SOP-0 P3
 *
 * Long-running dispatcher daemon for the SOP-0 task pipeline.
 *
 * Drivers:
 *   - fs.watch('data/tasks/') · sub-second pickup on new pending tasks
 *   - setInterval scan (60s) · safety net for missed fs.watch events
 *
 * Concurrency model:
 *   - Single-process flock via `data/tasks/.dispatcher.lock` (refused start if running)
 *   - Per-task atomic claim via tryClaim() (.claiming marker)
 *   - Subprocesses run async (parallel), each updates its own task file
 *
 * Per-task lifecycle:
 *   1. tryClaim() pending → running atomically
 *   2. PATCH forum thread tag [kind, running]
 *   3. spawn target_cli with target.args
 *   4. on exit 0:    transitionStatus → done   · PATCH tag · post summary reply
 *      on exit ≠0:   transitionStatus → failed · PATCH tag · post error reply
 *      on timeout:   kill subprocess · transitionStatus → human · PATCH tag
 *
 * Run (foreground):
 *   npm run pl:task-dispatcher
 *
 * Run (one-shot tick):
 *   npm run pl:task-dispatcher -- tick
 *
 * Run (daemon · P3.1 launchd plist):
 *   launchctl bootstrap gui/$UID scripts/cli/pl-task-dispatcher.launchd.plist
 *
 * SOP-0 §4.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  listTasks,
  readTask,
  tryClaim,
  transitionStatus,
  appendProgress,
  appliedTagsFor,
} from '../../core/tasks/task-store.js';

const ONE_SHOT = process.argv.includes('tick');
const TASKS_DIR = path.resolve(process.cwd(), 'data/tasks');
const LOCK_FILE = path.join(TASKS_DIR, '.dispatcher.lock');
const SCAN_INTERVAL_MS = parseInt(process.env.SOP0_DISPATCHER_TICK_MS || '60000', 10);
const DEFAULT_TIMEOUT_MS = parseInt(process.env.SOP0_TASK_TIMEOUT_MS || '300000', 10);
const TOKEN = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || '';
const DISCORD_API = 'https://discord.com/api/v10';

const inFlight = new Set();  // task_ids currently spawned

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

/* ─── Process lock (single-instance) ──────────────────────────────── */

function acquireProcessLock() {
  fs.mkdirSync(TASKS_DIR, { recursive: true });
  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') {
      // Check if owner is still alive
      try {
        const ownerPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
        if (ownerPid) {
          try { process.kill(ownerPid, 0); /* alive */ return false; }
          catch { /* stale lock */ fs.unlinkSync(LOCK_FILE); return acquireProcessLock(); }
        }
      } catch { /* re-attempt */ }
    }
    throw err;
  }
}

function releaseProcessLock() {
  try {
    const owner = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
    if (owner === process.pid) fs.unlinkSync(LOCK_FILE);
  } catch { /* fine */ }
}

/**
 * Parse the LAST JSON object out of a stdout blob. pl:* CLIs emit a final
 * JSON object via emit() at the end (after their human-readable log lines).
 * We scan from the end backwards looking for a balanced top-level {…} that
 * parses cleanly. Returns the parsed object or null.
 */
function parseLastJson(stdout) {
  if (!stdout) return null;
  // Quick path: find a closing `}` near end, walk back for matching `{`
  let i = stdout.lastIndexOf('}');
  while (i > 0) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    let start = -1;
    for (let j = i; j >= 0; j -= 1) {
      const c = stdout[j];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '}') depth += 1;
      else if (c === '{') {
        depth -= 1;
        if (depth === 0) { start = j; break; }
      }
    }
    if (start === -1) return null;
    try {
      return JSON.parse(stdout.slice(start, i + 1));
    } catch {
      // try preceding `}` (in case of nested objects in logs)
      i = stdout.lastIndexOf('}', i - 1);
    }
  }
  return null;
}

/* ─── Discord helpers (REST PATCH/POST via fetch) ─────────────────── */

async function patchThreadTags(threadId, tagIds) {
  if (!TOKEN || !threadId) return false;
  const res = await fetch(`${DISCORD_API}/channels/${threadId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'sop0-task-dispatcher',
    },
    body: JSON.stringify({ applied_tags: tagIds }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    log('patchThreadTags FAIL', threadId, res.status, text.slice(0, 200));
  }
  return res.ok;
}

async function postThreadReply(threadId, content) {
  if (!TOKEN || !threadId) return null;
  const res = await fetch(`${DISCORD_API}/channels/${threadId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'sop0-task-dispatcher',
    },
    body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    log('postThreadReply FAIL', threadId, res.status, text.slice(0, 200));
    return null;
  }
  const data = await res.json().catch(() => null);
  return data?.id || null;
}

/* ─── Core: spawn a task's target CLI ─────────────────────────────── */

async function runTask(taskId) {
  if (inFlight.has(taskId)) return;
  inFlight.add(taskId);
  let task = readTask(taskId);
  if (!task) { inFlight.delete(taskId); return; }

  const cli = task.target?.cli;
  let args = Array.isArray(task.target?.args) ? task.target.args.slice() : [];
  const timeoutMs = task.target?.timeout_ms || DEFAULT_TIMEOUT_MS;
  const threadId = task.discord?.thread_id || task.source?.thread_id;
  const entityKey = task.target?.target_entity_key;

  if (!cli) {
    log('skip', taskId, '— no target.cli');
    inFlight.delete(taskId);
    return;
  }

  // Auto-inject --entity-key if task has target_entity_key but args missing it.
  // Caught during test plan T11 (photos kind): router captured target_entity_key
  // but LLM didn't echo it into args[]. CLIs that REQUIRE --entity-key:
  // pl:download-places-photos, leads:run-pipeline. Injecting is idempotent.
  const KIND_NEEDS_ENTITY_KEY = new Set(['photos', 'audit']);
  if (entityKey && KIND_NEEDS_ENTITY_KEY.has(task.kind) && !args.includes('--entity-key')) {
    args = ['--entity-key', entityKey, ...args];
    log('args.injected', taskId, '+ --entity-key', entityKey);
  }

  // Try to claim (atomic pending → running)
  const claimed = tryClaim(taskId);
  if (!claimed) {
    inFlight.delete(taskId);
    return; // someone else got it, or status changed
  }
  log('claim', taskId, '→ running · cli=', cli, 'args=', args.join(' '));

  // PATCH tag to running
  const [kindTag, runningTag] = appliedTagsFor(task.kind, 'running');
  await patchThreadTags(threadId, [kindTag, runningTag]);
  appendProgress(taskId, 'cli.spawning', `${cli} ${args.join(' ')}`);

  // Spawn via npm run (so package.json env-file pre-flags apply correctly)
  // V3 D43 · pass parent thread_id + task_id through env so chained tasks (e.g.
  // pl:single-enrich → audit) can post to the SAME Discord thread
  const npmArgs = ['run', cli, '--', ...args];
  const child = spawn('npm', npmArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PL_PARENT_TASK_ID:    taskId,
      PL_PARENT_THREAD_ID:  threadId || '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const start = Date.now();
  const stdoutChunks = []; const stderrChunks = [];
  let killedByTimeout = false;
  const timer = setTimeout(() => {
    killedByTimeout = true;
    try { child.kill('SIGTERM'); } catch {}
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 5000);
  }, timeoutMs);

  // ── P4 · Throttled stdout/stderr tee → task.progress[] ───────────────
  // Live progress visible while the CLI runs without modifying any CLI.
  // Flush rule: every STREAM_FLUSH_MS OR when buffer grows past STREAM_FLUSH_BYTES.
  // Detail field = last 200 chars of accumulated buffer since last flush
  // (keeps progress[] entries readable, full output still captured at exit).
  const STREAM_FLUSH_MS = parseInt(process.env.SOP0_STREAM_FLUSH_MS || '5000', 10);
  const STREAM_FLUSH_BYTES = parseInt(process.env.SOP0_STREAM_FLUSH_BYTES || '2048', 10);
  let pendingBuf = '';   // accumulated text since last flush
  let lastFlushAt = Date.now();
  let flushTimer = null;

  function flushStream(force = false) {
    if (!pendingBuf) return;
    const now = Date.now();
    if (!force
        && now - lastFlushAt < STREAM_FLUSH_MS
        && Buffer.byteLength(pendingBuf, 'utf8') < STREAM_FLUSH_BYTES) {
      return; // not time yet
    }
    // Take last 200 chars (most-recent signal), strip ANSI for readability
    const cleaned = pendingBuf.replace(/\x1b\[[0-9;]*m/g, '');
    const detail = cleaned.slice(-200).trim();
    try {
      appendProgress(taskId, 'cli.stream', detail);
    } catch (err) {
      log('stream-flush appendProgress error', taskId, err.message);
    }
    pendingBuf = '';
    lastFlushAt = now;
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushStream();
    }, STREAM_FLUSH_MS);
  }

  child.stdout.on('data', (b) => {
    stdoutChunks.push(b);
    pendingBuf += b.toString('utf8');
    if (Buffer.byteLength(pendingBuf, 'utf8') >= STREAM_FLUSH_BYTES) {
      flushStream();
    } else {
      scheduleFlush();
    }
  });
  child.stderr.on('data', (b) => {
    stderrChunks.push(b);
    pendingBuf += b.toString('utf8');
    if (Buffer.byteLength(pendingBuf, 'utf8') >= STREAM_FLUSH_BYTES) {
      flushStream();
    } else {
      scheduleFlush();
    }
  });

  child.on('exit', async (code, signal) => {
    clearTimeout(timer);
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flushStream(true);  // final tail flush
    const durationMs = Date.now() - start;
    const stdout = Buffer.concat(stdoutChunks).toString('utf8');
    const stderr = Buffer.concat(stderrChunks).toString('utf8');
    // Compact summary for the thread reply (last 1500 chars of combined)
    const tail = (stdout + (stderr ? `\n[stderr]\n${stderr}` : '')).slice(-1500);

    // Cross-ref: parse final JSON from stdout (pl:* CLIs use emit() = JSON.stringify).
    // Pick up downstream identifiers we want to surface to the operator:
    //   - audit_chained (single-enrich → audit task_id)
    //   - thread_id / thread_url (intake → batch thread in #lead-discovery-runs)
    //   - batch_id (intake → SOP-1 batch state file)
    //   - entity_key (single-enrich resolved entity)
    // V3 D43 (2026-05-14): 人话版 xref · 去掉 entity_key 哈希 / admin URL / batch_id 等
    // Matthew: "提示信息还是很多专业的内容"
    let xref = '';
    try {
      const lastJson = parseLastJson(stdout);
      if (lastJson && typeof lastJson === 'object') {
        const lines = [];
        if (lastJson.audit_chained) {
          lines.push(`· 正在为客户网站做 audit · 完了再发这里`);
        }
        if (lastJson.thread_url) {
          lines.push(`· 批次讨论串: ${lastJson.thread_url}`);
        } else if (lastJson.thread_id) {
          lines.push(`· 批次讨论串: <#${lastJson.thread_id}>`);
        }
        if (lines.length) xref = lines.join('\n');
      }
    } catch { /* xref best-effort */ }

    // V3 D25 (2026-05-13): 人话通知 · business-first · 技术细节折叠 in <details>
    const { renderTimeoutMessage, renderDoneMessage, renderFailedMessage } = await import('../../core/discord-tasks/humanize.js');
    if (killedByTimeout) {
      log('timeout', taskId, `(${timeoutMs}ms)`);
      transitionStatus(taskId, 'human', { reason: `timeout after ${timeoutMs}ms` });
      appendProgress(taskId, 'cli.timeout', `signal=${signal} code=${code}`);
      const [k, t] = appliedTagsFor(task.kind, 'human');
      await patchThreadTags(threadId, [k, t]);
      await postThreadReply(threadId, renderTimeoutMessage({ task, timeoutMs, tail }));
    } else if (code === 0) {
      log('done', taskId, `(${durationMs}ms exit=0)`);
      transitionStatus(taskId, 'done', { result: { exit_code: 0, duration_ms: durationMs } });
      appendProgress(taskId, 'cli.complete', `exit=0 dur=${durationMs}ms`);
      const [k, t] = appliedTagsFor(task.kind, 'done');
      await patchThreadTags(threadId, [k, t]);
      await postThreadReply(threadId, renderDoneMessage({ task, durationMs, tail, xref }));
    } else {
      log('failed', taskId, `(exit=${code} sig=${signal})`);
      transitionStatus(taskId, 'failed', { reason: `exit=${code} signal=${signal}`, result: { exit_code: code, duration_ms: durationMs } });
      appendProgress(taskId, 'cli.failed', `exit=${code} signal=${signal} dur=${durationMs}ms`);
      const [k, t] = appliedTagsFor(task.kind, 'failed');
      await patchThreadTags(threadId, [k, t]);
      await postThreadReply(threadId, renderFailedMessage({ task, exitCode: code, stderr: tail, tail }));
    }
    inFlight.delete(taskId);
  });

  child.on('error', async (err) => {
    clearTimeout(timer);
    log('spawn error', taskId, err.message);
    transitionStatus(taskId, 'failed', { reason: `spawn error: ${err.message}` });
    appendProgress(taskId, 'cli.spawn_error', err.message);
    const [k, t] = appliedTagsFor(task.kind, 'failed');
    await patchThreadTags(threadId, [k, t]);
    const { renderFailedMessage } = await import('../../core/discord-tasks/humanize.js');
    await postThreadReply(threadId, renderFailedMessage({ task, exitCode: -1, stderr: `spawn error: ${err.message}`, tail: '' }));
    inFlight.delete(taskId);
  });
}

/* ─── Scan loop ───────────────────────────────────────────────────── */

async function scanAndDispatch() {
  const pending = listTasks({ status: 'pending' });
  if (pending.length === 0) return;
  log('scan: pending=', pending.length, '· inflight=', inFlight.size);
  for (const t of pending) {
    if (!t.target?.cli) continue;
    if (inFlight.has(t.task_id)) continue;
    runTask(t.task_id).catch((err) => log('runTask error', t.task_id, err.message));
  }
}

/* ─── fs.watch driver ─────────────────────────────────────────────── */

function startFsWatch() {
  fs.mkdirSync(TASKS_DIR, { recursive: true });
  fs.watch(TASKS_DIR, (event, filename) => {
    if (!filename || !filename.endsWith('.json')) return;
    if (filename.startsWith('_') || filename.startsWith('.')) return;
    // Small debounce — file may still be writing
    setTimeout(() => {
      const taskId = filename.replace(/\.json$/, '');
      const t = readTask(taskId);
      if (t && t.status === 'pending' && t.target?.cli && !inFlight.has(taskId)) {
        log('fs.watch fired · maybe-pending', taskId);
        runTask(taskId).catch((err) => log('runTask error', taskId, err.message));
      }
    }, 200);
  });
  log('fs.watch active on', TASKS_DIR);
}

/* ─── Entry ───────────────────────────────────────────────────────── */

if (!acquireProcessLock()) {
  console.error(`Another dispatcher is already running (lock owner ${fs.readFileSync(LOCK_FILE, 'utf8').toString()}); refusing to start.`);
  process.exit(1);
}

process.on('SIGTERM', () => { log('SIGTERM'); releaseProcessLock(); process.exit(0); });
process.on('SIGINT',  () => { log('SIGINT');  releaseProcessLock(); process.exit(0); });
process.on('exit',    () => { releaseProcessLock(); });

if (ONE_SHOT) {
  log('one-shot tick');
  await scanAndDispatch();
  // CRITICAL: must wait for ALL spawned children to settle. If parent exits
  // while child is still running, child gets reparented to launchd but our
  // exit handler never fires → task stuck in `running`. Poll inFlight set.
  await new Promise((resolve) => {
    const startedAt = Date.now();
    const tick = () => {
      if (inFlight.size === 0) { resolve(); return; }
      // Safety: don't wait beyond 2× longest task timeout (in case child hangs).
      if (Date.now() - startedAt > DEFAULT_TIMEOUT_MS * 2) {
        log('one-shot: ABANDONING — in-flight=', inFlight.size, 'after', Date.now() - startedAt, 'ms');
        resolve(); return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
  releaseProcessLock();
  process.exit(0);
} else {
  log('dispatcher starting · tick=', SCAN_INTERVAL_MS, 'ms · timeout=', DEFAULT_TIMEOUT_MS, 'ms');
  startFsWatch();
  await scanAndDispatch();
  setInterval(() => { scanAndDispatch().catch((err) => log('scan error', err.message)); }, SCAN_INTERVAL_MS);
}
