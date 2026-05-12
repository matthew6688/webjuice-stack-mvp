#!/usr/bin/env node
/**
 * pl:ops-health-check — periodic system health monitor.
 *
 * Runs 9 health checks. For each failure (severity error|critical), pushes
 * an alert via core/ops/alert-pusher.js to SYSTEM_ALERTS_DISCORD_WEBHOOK_URL.
 *
 * Designed to be called by cron (every N minutes) but works standalone:
 *   npm run ops:health-check                  # run all + push failures
 *   npm run ops:health-check -- --dry-run     # run + report, NO push
 *   npm run ops:health-check -- --only docker # run just one check
 *
 * SOP-X-Health · 2026-05-12 · G-10.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pushAlert } from '../../core/ops/alert-pusher.js';

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

const DRY_RUN = !!args['dry-run'];
const ONLY = args.only || null;

const CHECKS = [
  {
    id: 'docker_gosom',
    name: 'gosom Docker (localhost:8080)',
    severity_on_fail: 'error',
    suggested_fix: '`docker restart gmaps-scraper-web`',
    run: async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      try {
        const r = await fetch('http://localhost:8080/api/v1/jobs', { signal: ctrl.signal });
        clearTimeout(t);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return { ok: true, detail: 'reachable' };
      } catch (e) {
        return { ok: false, detail: `unreachable — ${e.message}` };
      }
    },
  },
  {
    id: 'discord_bot',
    name: 'Discord Bot API',
    severity_on_fail: 'error',
    suggested_fix: 'Check DISCORD_BOT_TOKEN in .env.local + regenerate if rotated',
    run: async () => {
      const token = process.env.DISCORD_BOT_TOKEN;
      if (!token) return { ok: false, detail: 'DISCORD_BOT_TOKEN not set' };
      try {
        const r = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bot ${token}` },
        });
        if (r.status === 401) return { ok: false, detail: 'token rejected (401)' };
        if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
        const me = await r.json();
        return { ok: true, detail: `auth ok (${me.username})` };
      } catch (e) {
        return { ok: false, detail: e.message };
      }
    },
  },
  {
    id: 'psi_api',
    name: 'PageSpeed Insights (PSI)',
    severity_on_fail: 'warn',
    suggested_fix: 'Check PAGESPEED_API_KEY in .env.local + GCP quota',
    run: async () => {
      const key = process.env.PAGESPEED_API_KEY || process.env.PSI_API_KEY;
      if (!key) return { ok: false, detail: 'PAGESPEED_API_KEY not set' };
      const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=${key}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      try {
        const r = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (r.status === 403) return { ok: false, detail: 'API key invalid (403)' };
        if (r.status === 429) return { ok: false, detail: 'quota exceeded (429)' };
        if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
        return { ok: true, detail: 'reachable' };
      } catch (e) {
        return { ok: false, detail: e.name === 'AbortError' ? 'timeout >15s' : e.message };
      }
    },
  },
  {
    id: 'disk_free',
    name: 'Disk free (data/)',
    severity_on_fail: 'warn',
    suggested_fix: 'Run cleanup on data/v2/fixtures/ or data/maps-scraper/webdata/',
    run: async () => {
      try {
        const dataDir = path.resolve(process.cwd(), 'data');
        const r = spawnSync('df', ['-Pk', dataDir], { encoding: 'utf8' });
        if (r.status !== 0) return { ok: false, detail: `df failed: ${r.stderr}` };
        const line = r.stdout.trim().split('\n').pop();
        const availKb = parseInt(line.split(/\s+/)[3], 10);
        const availGb = (availKb / (1024 * 1024)).toFixed(1);
        if (availKb < 5 * 1024 * 1024) {
          return { ok: false, detail: `only ${availGb} GB available — need > 5 GB` };
        }
        return { ok: true, detail: `${availGb} GB available` };
      } catch (e) {
        return { ok: false, detail: e.message };
      }
    },
  },
  {
    id: 'entity_store_integrity',
    name: 'Entity store integrity',
    severity_on_fail: 'error',
    suggested_fix: 'Inspect the corrupt entity file + restore from git',
    run: async () => {
      const dir = path.resolve(process.cwd(), 'data/leads/entities');
      if (!fs.existsSync(dir)) return { ok: true, detail: 'no entity store yet' };
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      const corrupt = [];
      for (const f of files) {
        try {
          JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        } catch {
          corrupt.push(f);
          if (corrupt.length >= 5) break;
        }
      }
      if (corrupt.length > 0) {
        return { ok: false, detail: `${corrupt.length} corrupt: ${corrupt.slice(0, 3).join(', ')}` };
      }
      return { ok: true, detail: `${files.length} entities valid` };
    },
  },
  {
    id: 'places_quota',
    name: 'Google Places API quota',
    severity_on_fail: 'warn',
    suggested_fix: 'Wait for monthly reset (1st of month) or add GOOGLE_PLACES_API_KEY_2',
    run: async () => {
      const ledger = path.resolve(process.cwd(), 'data/finance/places-quota.json');
      if (!fs.existsSync(ledger)) return { ok: true, detail: 'quota file not yet created (Places dormant)' };
      try {
        const j = JSON.parse(fs.readFileSync(ledger, 'utf8'));
        const month = new Date().toISOString().slice(0, 7);
        const used = j.months?.[month]?.calls || 0;
        const FREE_LIMIT = 11000; // ~$200 / $0.017 per Details Basic call
        const pct = (used / FREE_LIMIT) * 100;
        if (used >= FREE_LIMIT) return { ok: false, detail: `${used}/${FREE_LIMIT} calls (CAPPED)` };
        if (pct >= 80) return { ok: false, detail: `${used}/${FREE_LIMIT} calls (${pct.toFixed(0)}% used)` };
        return { ok: true, detail: `${used}/${FREE_LIMIT} calls (${pct.toFixed(0)}%)` };
      } catch (e) {
        return { ok: false, detail: `ledger corrupt: ${e.message}` };
      }
    },
  },
  {
    id: 'claude_cli',
    name: 'claude_cli (visual audit)',
    severity_on_fail: 'warn',
    suggested_fix: 'Install Claude CLI or check PATH',
    run: async () => {
      const r = spawnSync('which', ['claude'], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return { ok: true, detail: `path: ${r.stdout.trim()}` };
      return { ok: false, detail: 'not on PATH (visual fallback degraded)' };
    },
  },
  {
    id: 'ollama',
    name: 'ollama (T0 vision fallback)',
    severity_on_fail: 'warn',
    suggested_fix: '`brew install ollama` + `ollama pull llama3.2-vision`',
    run: async () => {
      const r = spawnSync('which', ['ollama'], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return { ok: true, detail: `path: ${r.stdout.trim()}` };
      return { ok: false, detail: 'not installed' };
    },
  },
  {
    id: 'recent_batch_failures',
    name: 'Recent batch failure rate',
    severity_on_fail: 'error',
    suggested_fix: 'Inspect data/v2/pipeline-batches/ for stage failures',
    run: async () => {
      const dir = path.resolve(process.cwd(), 'data/v2/pipeline-batches');
      if (!fs.existsSync(dir)) return { ok: true, detail: 'no batch history yet' };
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      const recent = files
        .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 10);
      const oneDayAgo = Date.now() - 24 * 3600 * 1000;
      const recentBatches = recent.filter((r) => r.mtime > oneDayAgo);
      if (recentBatches.length === 0) return { ok: true, detail: 'no batches in last 24h' };
      let failed = 0;
      for (const r of recentBatches) {
        try {
          const j = JSON.parse(fs.readFileSync(path.join(dir, r.f), 'utf8'));
          const finalTag = j.swap_tag || j.tag || '';
          if (finalTag === 'aborted' || finalTag === 'partial-failed') failed += 1;
        } catch {}
      }
      const pct = (failed / recentBatches.length) * 100;
      if (pct > 10) {
        return { ok: false, detail: `${failed}/${recentBatches.length} batches failed (${pct.toFixed(0)}%) in last 24h` };
      }
      return { ok: true, detail: `${failed}/${recentBatches.length} failed (${pct.toFixed(0)}%) — within 10% threshold` };
    },
  },
];

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

console.log(`\n${YELLOW}pl:ops-health-check${RESET}  ·  SOP-X-Health · ${new Date().toISOString()}${DRY_RUN ? `  ${DIM}(dry-run, no push)${RESET}` : ''}\n`);

const results = [];
for (const check of CHECKS) {
  if (ONLY && !check.id.includes(ONLY)) continue;
  const t0 = Date.now();
  const r = await check.run();
  const dt = Date.now() - t0;
  results.push({ ...check, ...r, dt });
  const tag = r.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  console.log(`  ${tag} ${check.name.padEnd(38)} ${DIM}${r.detail} · ${dt}ms${RESET}`);
}

const failed = results.filter((r) => !r.ok);
console.log('');
if (failed.length === 0) {
  console.log(`${GREEN}✓ All ${results.length} checks passed.${RESET}\n`);
  process.exit(0);
}

console.log(`${RED}✗ ${failed.length}/${results.length} checks failed${RESET}`);
const errorLevel = failed.filter((f) => f.severity_on_fail === 'error' || f.severity_on_fail === 'critical');
const warnLevel = failed.filter((f) => f.severity_on_fail === 'warn');

if (!DRY_RUN && failed.length > 0) {
  console.log(`\n${DIM}Pushing alert to Discord webhook ...${RESET}`);
  const sev = errorLevel.length > 0 ? 'error' : 'warn';
  const title = `Health check: ${failed.length}/${results.length} failed`;
  const detail = failed
    .map((f) => `**${f.name}**\n  → ${f.detail}\n  fix: ${f.suggested_fix}`)
    .join('\n\n');
  const fields = [
    { name: 'errors', value: String(errorLevel.length), inline: true },
    { name: 'warnings', value: String(warnLevel.length), inline: true },
    { name: 'host', value: process.env.USER || 'unknown', inline: true },
  ];
  const push = await pushAlert({
    title,
    detail,
    severity: sev,
    source: 'pl:ops-health-check',
    fields,
    url: 'https://profitslocal.com/admin/settings',
  });
  console.log(`  ${push.ok ? GREEN + '✓' : RED + '✗'}${RESET} push status: ${push.status || push.reason}`);
}

console.log('');
process.exit(errorLevel.length > 0 ? 1 : 0);
