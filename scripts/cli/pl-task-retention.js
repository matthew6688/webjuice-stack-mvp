#!/usr/bin/env node
/**
 * scripts/cli/pl-task-retention.js · SOP-0 P7
 *
 * Move done / failed tasks older than RETENTION_DAYS (default 30) from
 * `data/tasks/` to `data/tasks/_archive/YYYY-MM/`. Keeps the active dir
 * small so fs.watch + listTasks stay fast as throughput grows.
 *
 * Idempotent: only moves files (no edits). Safe to run anytime.
 *
 * Usage:
 *   npm run pl:task-retention                  # default 30d cutoff
 *   npm run pl:task-retention -- --days 7      # custom cutoff
 *   npm run pl:task-retention -- --dry-run     # show what would move
 *   npm run pl:task-retention -- --statuses done,failed,human  # default 'done,failed'
 *
 * Schedule:
 *   macOS launchd: see scripts/cli/pl-task-retention.launchd.plist (daily 03:00)
 *   Hermes cron:   `hermes cron create "every 24h" "npm run pl:task-retention"` from any profile
 */

import fs from 'node:fs';
import path from 'node:path';

const TASKS_DIR = path.resolve(process.cwd(), 'data/tasks');
const ARCHIVE_DIR = path.join(TASKS_DIR, '_archive');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, tok, i, arr) => {
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = arr[i + 1];
      acc.push([key, next && !next.startsWith('--') ? next : true]);
    }
    return acc;
  }, [])
);

const DAYS = parseInt(args.days, 10) || 30;
const DRY_RUN = args['dry-run'] === true;
const STATUSES = String(args.statuses || 'done,failed').split(',').map((s) => s.trim()).filter(Boolean);
const CUTOFF = Date.now() - DAYS * 86_400_000;

const GREEN = '\x1b[32m'; const YELLOW = '\x1b[33m'; const DIM = '\x1b[2m'; const RESET = '\x1b[0m';

function log(...args) { console.log(...args); }

function monthBucket(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'unknown';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

if (!fs.existsSync(TASKS_DIR)) {
  log(`${YELLOW}no data/tasks dir; nothing to do${RESET}`);
  process.exit(0);
}

const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.json'));
let scanned = 0; let moved = 0; let kept = 0; const errors = [];

log(`${DIM}pl:task-retention · cutoff=${DAYS}d · statuses=${STATUSES.join(',')} · dryRun=${DRY_RUN}${RESET}`);

for (const f of files) {
  const src = path.join(TASKS_DIR, f);
  scanned += 1;
  let t;
  try { t = JSON.parse(fs.readFileSync(src, 'utf8')); }
  catch (err) { errors.push(`parse ${f}: ${err.message}`); continue; }
  if (!t || typeof t !== 'object') continue;

  // Only archive terminal states
  if (!STATUSES.includes(t.status)) { kept += 1; continue; }

  // Cutoff: prefer updated_at, fall back to created_at
  const stampIso = t.updated_at || t.created_at;
  const stampMs = stampIso ? new Date(stampIso).getTime() : 0;
  if (!stampMs || stampMs > CUTOFF) { kept += 1; continue; }

  // Move to _archive/YYYY-MM/
  const bucket = monthBucket(stampIso);
  const destDir = path.join(ARCHIVE_DIR, bucket);
  const dest = path.join(destDir, f);
  if (DRY_RUN) {
    log(`  ${YELLOW}DRY${RESET} would move ${t.task_id} (${t.status}, ${stampIso}) → _archive/${bucket}/`);
    moved += 1;
    continue;
  }
  try {
    fs.mkdirSync(destDir, { recursive: true });
    fs.renameSync(src, dest);
    moved += 1;
    log(`  ${GREEN}→${RESET} ${t.task_id} (${t.status}) → _archive/${bucket}/`);
  } catch (err) {
    errors.push(`move ${f}: ${err.message}`);
  }
}

log('');
log(`${DIM}scanned=${scanned} · moved=${moved} · kept=${kept} · errors=${errors.length}${RESET}`);
for (const e of errors) log(`  ${YELLOW}${e}${RESET}`);
process.exit(errors.length ? 1 : 0);
