/**
 * Hermes cron wrapper — registers paused per-lead heartbeat jobs.
 * DISCORD_OUTREACH_PRD.md §9.3 (Hermes cron registration).
 *
 * Dev phase: all jobs created paused (decision D3). User enables via
 * `npm run cron:pl:enable` when ready.
 */

import { spawnSync } from 'child_process';
import path from 'path';
import os from 'os';

const HERMES_PY = path.join(os.homedir(), 'Developer/Hermes Agent/venv/bin/python');
const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

export function hermesCron(args, { dryRun = false, profile = 'website-agent' } = {}) {
  const cmd = [HERMES_PY, '-m', 'hermes_cli.main', '--profile', profile, 'cron', ...args];
  if (dryRun) {
    return { ok: true, dry_run: true, command: cmd.join(' ') };
  }
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8', cwd: REPO_ROOT });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    command: cmd.join(' '),
  };
}

export function registerLeadCron(entityKey, { grade = 'A', dryRun = false } = {}) {
  // 'every' prefix makes the job recurring (vs one-shot). Hermes schedule formats:
  //   'every 4h'    — recurring every 4 hours
  //   '4h'          — one-shot in 4 hours
  //   '0 9 * * *'   — cron expression
  const schedule = grade === 'A' ? 'every 4h' : 'every 12h';
  const name = `lead-${entityKey}`;
  const prompt = `cd ${REPO_ROOT} && npm run pl:context -- ${entityKey}. Then decide ONE next action (idle / draft email / advance phase / archive). If proposing action, post draft to lead thread for operator ✅.`;
  // hermes cron create's positional args are: schedule [prompt]
  // The prompt MUST come right after schedule, BEFORE any --flags.
  return hermesCron(['create',
    schedule,
    prompt,
    '--name', name,
    '--skill', 'profitslocal-lead-ops',
    '--workdir', REPO_ROOT,
  ], { dryRun });
}

// Hermes cron pause/remove require a job ID, not a name. We list --all,
// parse the table, find the row matching our `lead-<entityKey>` name, then
// act on the discovered id.
function findJobIdByName(name, { dryRun = false } = {}) {
  if (dryRun) return { dry_run: true, would_query: 'list --all' };
  const r = hermesCron(['list', '--all']);
  if (!r.ok) return { ok: false, reason: 'list_failed', stderr: r.stderr };
  const lines = (r.stdout || '').split('\n');
  let pendingId = null;
  for (const line of lines) {
    const idMatch = line.match(/^\s+([0-9a-f]{12})\s+\[/);
    if (idMatch) { pendingId = idMatch[1]; continue; }
    if (pendingId && /Name:\s+(\S+)/.test(line)) {
      const matchName = line.match(/Name:\s+(\S+)/)[1];
      if (matchName === name) return { ok: true, id: pendingId };
      pendingId = null;
    }
  }
  return { ok: false, reason: 'not_found', name };
}

export function pauseLeadCron(entityKey, { dryRun = false } = {}) {
  const name = `lead-${entityKey}`;
  if (dryRun) return hermesCron(['pause', name], { dryRun });
  const lookup = findJobIdByName(name);
  if (!lookup.ok) return lookup;
  return hermesCron(['pause', lookup.id]);
}

export function removeLeadCron(entityKey, { dryRun = false } = {}) {
  const name = `lead-${entityKey}`;
  if (dryRun) return hermesCron(['remove', name], { dryRun });
  const lookup = findJobIdByName(name);
  if (!lookup.ok) return lookup;
  return hermesCron(['remove', lookup.id]);
}

export function listLeadCrons({ dryRun = false } = {}) {
  return hermesCron(['list', '--all'], { dryRun });
}
