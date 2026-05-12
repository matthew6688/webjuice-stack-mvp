#!/usr/bin/env node
/**
 * scripts/cli/pl-task-api.js · SOP-0 P6-B local HTTP API
 *
 * Tiny read-only JSON API the /admin/tasks + /admin/cron Astro pages
 * fetch from. Runs on localhost:4040 behind a Cloudflare Tunnel that
 * exposes it as https://tasks.profitslocal.com (CF Access protected).
 *
 * Endpoints:
 *   GET /api/health                       liveness
 *   GET /api/tasks?status=&kind=&limit=   list tasks (active + archived)
 *   GET /api/tasks/:id                    one task full schema
 *   GET /api/cron                         list cron jobs per Hermes profile
 *   GET /api/forum-tags                   the tag-id ↔ name map
 *
 * Read-only: no POST/PATCH/DELETE. Operator actions still go via Discord.
 *
 * Run (foreground):
 *   npm run pl:task-api
 * Run (daemon · P6-B.5 launchd plist):
 *   launchctl bootstrap gui/$UID scripts/cli/pl-task-api.launchd.plist
 *
 * SOP-0 §5.3.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { listTasks, readTask, loadForumTags } from '../../core/tasks/task-store.js';

const PORT = parseInt(process.env.SOP0_API_PORT || '4040', 10);
const HOST = process.env.SOP0_API_HOST || '127.0.0.1';
const TASKS_DIR = path.resolve(process.cwd(), 'data/tasks');
const HERMES_PROFILES = path.resolve(process.env.HOME, '.hermes/profiles');
const AUTH_TOKEN = process.env.SOP0_API_AUTH_TOKEN || '';
const ALLOWED_ORIGINS = (process.env.SOP0_API_ALLOWED_ORIGINS
  || 'https://profitslocal.com,https://tasks.profitslocal.com,http://localhost:4321')
  .split(',').map((s) => s.trim()).filter(Boolean);

if (!AUTH_TOKEN) {
  console.error('CRITICAL: SOP0_API_AUTH_TOKEN unset — refusing to start (tunnel is publicly reachable, MUST have bearer gate).');
  process.exit(2);
}

function log(...args) { console.log(`[${new Date().toISOString()}]`, ...args); }

function corsHeaders(req) {
  const origin = req.headers.origin || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}

function send(res, status, payload, req) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...corsHeaders(req || { headers: {} }),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function bearer(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function isAuthed(req) {
  return bearer(req) === AUTH_TOKEN;
}

function parseQuery(url) {
  const q = url.split('?')[1] || '';
  const out = {};
  for (const part of q.split('&').filter(Boolean)) {
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

/** Walk archive sub-dirs collecting tasks. Bounded to a reasonable lookback. */
function listArchivedTasks({ limit = 100, status = null, kind = null } = {}) {
  const archive = path.join(TASKS_DIR, '_archive');
  if (!fs.existsSync(archive)) return [];
  const out = [];
  const stack = [archive];
  while (stack.length && out.length < limit) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (out.length >= limit) break;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      if (!e.name.endsWith('.json')) continue;
      try {
        const t = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (status && t.status !== status) continue;
        if (kind && t.kind !== kind) continue;
        out.push(t);
      } catch {}
    }
  }
  return out;
}

function listCronJobs() {
  if (!fs.existsSync(HERMES_PROFILES)) return [];
  const out = [];
  for (const profile of fs.readdirSync(HERMES_PROFILES)) {
    const jobsFile = path.join(HERMES_PROFILES, profile, 'cron', 'jobs.json');
    if (!fs.existsSync(jobsFile)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
      for (const j of jobs) {
        out.push({ profile, ...j });
      }
    } catch {}
  }
  return out;
}

/* ─── Routes ──────────────────────────────────────────────────────── */

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    send(res, 405, { error: 'method not allowed' }, req);
    return;
  }

  const u = req.url || '/';
  const pathname = u.split('?')[0];
  const q = parseQuery(u);

  try {
    // Public probe (no auth) — for tunnel liveness checks
    if (pathname === '/api/health') {
      send(res, 200, { ok: true, ts: new Date().toISOString(), service: 'pl-task-api' }, req);
      return;
    }

    // Everything else requires Bearer auth (token shared with admin pages via PUBLIC_SOP0_API_TOKEN)
    if (!isAuthed(req)) {
      send(res, 401, { error: 'unauthorized — missing/invalid Authorization: Bearer header' }, req);
      return;
    }

    if (pathname === '/api/tasks') {
      const status = q.status || null;
      const kind = q.kind || null;
      const limit = Math.min(parseInt(q.limit || '50', 10), 200);
      const includeArchived = q.archived === '1';
      const active = listTasks({ status, kind, limit });
      const archived = includeArchived ? listArchivedTasks({ status, kind, limit }) : [];
      // shallow projection — drop progress[] to keep list responses small
      const project = (t) => ({
        task_id: t.task_id,
        kind: t.kind,
        status: t.status,
        created_at: t.created_at,
        updated_at: t.updated_at,
        cli: t.target?.cli || null,
        args: t.target?.args || [],
        target_entity_key: t.target?.target_entity_key || null,
        thread_id: t.source?.thread_id || t.discord?.thread_id || null,
        author: t.source?.author || null,
        progress_count: (t.progress || []).length,
        exit_code: t.result?.exit_code ?? null,
        duration_ms: t.result?.duration_ms ?? null,
        error: t.error || null,
        archived: false,
      });
      send(res, 200, {
        ok: true,
        active: active.map(project),
        archived: archived.map((t) => ({ ...project(t), archived: true })),
        counts: { active: active.length, archived: archived.length },
      }, req);
      return;
    }

    const m = pathname.match(/^\/api\/tasks\/([\w-]+)$/);
    if (m) {
      const taskId = m[1];
      let t = readTask(taskId);
      if (!t) {
        const archived = listArchivedTasks({ limit: 9999 }).find((x) => x.task_id === taskId);
        t = archived || null;
      }
      if (!t) { send(res, 404, { error: 'task not found', task_id: taskId }, req); return; }
      send(res, 200, { ok: true, task: t }, req);
      return;
    }

    if (pathname === '/api/cron') {
      send(res, 200, { ok: true, jobs: listCronJobs() }, req);
      return;
    }

    if (pathname === '/api/forum-tags') {
      try { send(res, 200, { ok: true, tags: loadForumTags() }, req); }
      catch (err) { send(res, 500, { error: err.message }, req); }
      return;
    }

    if (pathname === '/' || pathname === '') {
      send(res, 200, {
        service: 'pl-task-api',
        endpoints: ['/api/health', '/api/tasks', '/api/tasks/:id', '/api/cron', '/api/forum-tags'],
      }, req);
      return;
    }

    send(res, 404, { error: 'unknown route', path: pathname }, req);
  } catch (err) {
    log('handler error', pathname, err.message);
    send(res, 500, { error: err.message }, req);
  }
});

server.listen(PORT, HOST, () => {
  log(`pl-task-api listening on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => { log('SIGTERM'); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { log('SIGINT');  server.close(() => process.exit(0)); });
