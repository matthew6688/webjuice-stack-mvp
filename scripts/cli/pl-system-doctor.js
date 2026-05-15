#!/usr/bin/env node
/**
 * V3 cycle-26 P7 · System health doctor.
 *
 * Runs comprehensive 6-section dependency check:
 *   A · Daemons    (task-listener · dispatcher · api · profile-card-heartbeat · task-retention)
 *   B · External APIs (Discord bot · Cloudflare · Firecrawl · PageSpeed · Cloudinary)
 *   C · Local services (Docker · gosom · Playwright · LLM CLIs codex/claude/ollama)
 *   D · Filesystem (disk · clients/ · data/tasks/_logs/)
 *   E · Discord channels (5 IDs accessible by bot)
 *   F · Internal gates (cycle:doctor · lint:messages · test:cycle26 status)
 *
 * Exit codes: 0 (all pass) · 1 (issues found · fixable) · 2 (fatal · env missing)
 *
 * Usage:
 *   npm run pl:system-doctor
 *   npm run pl:system-doctor -- --json     # machine-readable
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');

const checks = []; // { section, name, ok, detail }
function record(section, name, ok, detail = '') {
  checks.push({ section, name, ok: !!ok, detail });
}

// ─── A · Daemons ───────────────────────────────────────────────────────────
async function checkDaemons() {
  const SEC = 'A · Daemons';
  const r = spawnSync('launchctl', ['list'], { encoding: 'utf8' });
  const out = r.stdout || '';
  const daemons = [
    { label: 'task-listener',           pat: /ai\.profitslocal\.v3\.task-listener/ },
    { label: 'task-dispatcher',         pat: /ai\.profitslocal\.v3\.task-dispatcher/ },
    { label: 'task-api',                pat: /ai\.profitslocal\.v3\.task-api/ },
    { label: 'profile-card-heartbeat',  pat: /ai\.profitslocal\.v3\.profile-card-heartbeat/ },
    { label: 'task-retention',          pat: /ai\.profitslocal\.v3\.task-retention/ },
  ];
  for (const d of daemons) {
    const line = (out.match(new RegExp(`^.*${d.pat.source}.*$`, 'm')) || [''])[0];
    if (!line) { record(SEC, d.label, false, 'not loaded · check ~/Library/LaunchAgents'); continue; }
    const [pid, code] = line.trim().split(/\s+/);
    const alive = pid !== '-' && !isNaN(Number(pid));
    record(SEC, d.label, alive, alive ? `PID ${pid}` : `not running (exit ${code})`);
  }
}

// ─── B · External APIs ────────────────────────────────────────────────────
async function checkExternalAPIs() {
  const SEC = 'B · External APIs';
  // Discord bot
  const dToken = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!dToken) {
    record(SEC, 'Discord bot', false, 'no DISCORD_BOT_TOKEN env');
  } else {
    try {
      const r = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${dToken}` },
      });
      if (r.ok) {
        const d = await r.json();
        record(SEC, 'Discord bot', true, `${d.username}#${d.discriminator || ''}`);
      } else {
        record(SEC, 'Discord bot', false, `HTTP ${r.status}`);
      }
    } catch (e) { record(SEC, 'Discord bot', false, e.message); }
  }
  // Cloudflare
  const cfToken = process.env.CF_API_TOKEN;
  const cfAcct = process.env.CF_ACCOUNT_ID;
  if (!cfToken || !cfAcct) {
    record(SEC, 'Cloudflare API', false, 'CF_API_TOKEN or CF_ACCOUNT_ID missing');
  } else {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAcct}/pages/projects?per_page=1`, {
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      record(SEC, 'Cloudflare API', r.ok, r.ok ? 'CF Pages reachable' : `HTTP ${r.status}`);
    } catch (e) { record(SEC, 'Cloudflare API', false, e.message); }
  }
  // Firecrawl
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!fcKey) {
    record(SEC, 'Firecrawl API', false, 'no FIRECRAWL_API_KEY env');
  } else {
    record(SEC, 'Firecrawl API', true, `key configured (${fcKey.slice(0, 6)}...)`);
  }
  // PageSpeed Insights (optional · doesn't block pipeline)
  const psiKey = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY;
  record(SEC, 'PageSpeed Insights', !!psiKey, psiKey ? 'key configured' : '(optional · skipped if not used)');
  // Cloudinary (optional)
  const cKey = process.env.CLOUDINARY_API_KEY;
  record(SEC, 'Cloudinary', !!cKey, cKey ? 'key configured' : '(optional)');
}

// ─── C · Local services ────────────────────────────────────────────────────
async function checkLocalServices() {
  const SEC = 'C · Local services';
  // Docker
  const dr = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8', timeout: 5000 });
  record(SEC, 'Docker', dr.status === 0, dr.status === 0 ? dr.stdout.trim() : 'not running / not installed');
  // gosom container (look for the maps-scraper)
  if (dr.status === 0) {
    const ps = spawnSync('docker', ['ps', '--filter', 'name=gosom', '--format', '{{.Names}}'], { encoding: 'utf8' });
    const lr = spawnSync('docker', ['ps', '--filter', 'name=maps-scraper', '--format', '{{.Names}}'], { encoding: 'utf8' });
    const running = (ps.stdout?.trim() || lr.stdout?.trim());
    record(SEC, 'gosom container', !!running, running || 'not running · start: docker compose up -d');
  } else {
    record(SEC, 'gosom container', false, '(Docker not available)');
  }
  // Playwright
  try {
    const pr = spawnSync('node', ['-e', "import('playwright').then(p => console.log('OK')).catch(e => { console.error(e.message); process.exit(1); })"], { encoding: 'utf8', cwd: REPO, timeout: 10000 });
    record(SEC, 'Playwright', pr.status === 0, pr.status === 0 ? 'installed' : pr.stderr?.slice(0, 80));
  } catch (e) { record(SEC, 'Playwright', false, e.message); }
  // LLM CLIs
  for (const cli of ['codex', 'claude']) {
    const r = spawnSync('which', [cli], { encoding: 'utf8' });
    record(SEC, `${cli}_cli`, r.status === 0, r.status === 0 ? r.stdout.trim() : 'not in PATH');
  }
  // ollama (HTTP probe)
  try {
    const r = await fetch('http://localhost:11434/api/tags', {});
    record(SEC, 'ollama', r.ok, r.ok ? 'reachable (fallback for LLM)' : `HTTP ${r.status}`);
  } catch (e) {
    record(SEC, 'ollama', false, '(optional · not running locally)');
  }
}

// ─── D · Filesystem ────────────────────────────────────────────────────────
function checkFilesystem() {
  const SEC = 'D · Filesystem';
  // Disk usage
  const dr = spawnSync('df', ['-h', '.'], { encoding: 'utf8', cwd: REPO });
  let diskOk = true;
  let diskNote = '?';
  if (dr.status === 0) {
    const line = dr.stdout.split('\n')[1];
    const m = line?.match(/(\d+)%/);
    if (m) {
      const pct = Number(m[1]);
      diskOk = pct < 90;
      diskNote = `${pct}% used`;
    }
  }
  record(SEC, 'Disk space', diskOk, diskNote);
  // Writable dirs
  for (const d of ['clients', 'data/tasks/_logs', 'data/leads/entities', 'data/qa']) {
    const p = path.join(REPO, d);
    let ok = false;
    try {
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      fs.accessSync(p, fs.constants.W_OK);
      ok = true;
    } catch {}
    record(SEC, `${d}/ writable`, ok, ok ? '' : 'not writable');
  }
}

// ─── E · Discord channels ─────────────────────────────────────────────────
async function checkChannels() {
  const SEC = 'E · Discord channels';
  const token = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!token) { record(SEC, 'channels', false, 'no token'); return; }
  const targets = [
    { label: '#website-tasks', env: 'WEBSITE_TASKS_FORUM_CHANNEL_ID' },
    { label: '#lead-discovery-runs', env: 'LEAD_DISCOVERY_RUNS_DISCORD_CHANNEL_ID' },
    { label: '#website-leads', env: 'WEBSITE_LEADS_DISCORD_CHANNEL_ID' },
    { label: '#website-projects', env: 'WEBSITE_PROJECTS_DISCORD_CHANNEL_ID' },
    { label: 'bot-log', env: 'BOT_LOG_DISCORD_CHANNEL_ID' },
  ];
  for (const c of targets) {
    const id = process.env[c.env];
    if (!id) { record(SEC, c.label, false, `${c.env} env missing`); continue; }
    try {
      const r = await fetch(`https://discord.com/api/v10/channels/${id}`, {
        headers: { Authorization: `Bot ${token}` },
      });
      record(SEC, c.label, r.ok, r.ok ? `id=${id.slice(-6)}` : `HTTP ${r.status}`);
    } catch (e) { record(SEC, c.label, false, e.message); }
  }
}

// ─── F · Internal gates ────────────────────────────────────────────────────
function checkInternal() {
  const SEC = 'F · Internal';
  // lint:messages
  const lr = spawnSync('node', ['scripts/ops/lint-message-literals.js'], { cwd: REPO, encoding: 'utf8', timeout: 30000 });
  record(SEC, 'lint:messages', lr.status === 0, lr.status === 0 ? '0 violations' : (lr.stdout || '').split('\n')[0]);
  // cycle:doctor (light · just lint check inside)
  // Skip heavy test:cycle26 in regular doctor run · only on --full flag
  if (args.includes('--full')) {
    const tr = spawnSync('node', ['scripts/test/run-cycle26-tests.mjs'], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
    record(SEC, 'test:cycle26 (full)', tr.status === 0, tr.status === 0 ? 'all passed' : 'fail · see logs');
  } else {
    record(SEC, 'test:cycle26', true, '(--full to run · skipped by default)');
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    await checkDaemons();
    await checkExternalAPIs();
    await checkLocalServices();
    checkFilesystem();
    await checkChannels();
    checkInternal();
  } catch (err) {
    if (JSON_MODE) console.log(JSON.stringify({ fatal: err.message }, null, 2));
    else console.error('FATAL:', err.message);
    process.exit(2);
  }

  if (JSON_MODE) {
    const by = {};
    for (const c of checks) { (by[c.section] ??= []).push(c); }
    console.log(JSON.stringify({ checks, by_section: by, pass: checks.every((c) => c.ok) }, null, 2));
  } else {
    let totalIssues = 0;
    let lastSection = '';
    for (const c of checks) {
      if (c.section !== lastSection) {
        const inSec = checks.filter((x) => x.section === c.section);
        const okIn = inSec.filter((x) => x.ok).length;
        console.log(`\n━━━ ${c.section} (${okIn}/${inSec.length}) ━━━`);
        lastSection = c.section;
      }
      const mark = c.ok ? '✓' : '✗';
      console.log(`${mark} ${c.name}${c.detail ? ' · ' + c.detail : ''}`);
      if (!c.ok) totalIssues++;
    }
    console.log('\n═════════════════════════');
    if (totalIssues === 0) console.log('SYSTEM STATUS: ✓ all green');
    else console.log(`SYSTEM STATUS: ✗ ${totalIssues} issues`);
  }
  if (checks.every((c) => c.ok)) process.exit(0);
  process.exit(1);
})().catch((err) => { console.error('FATAL:', err.stack || err.message); process.exit(2); });
