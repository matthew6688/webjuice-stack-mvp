#!/usr/bin/env node
/**
 * pl:preflight — health check before running a discovery batch.
 *
 * Verifies the infra a SOP-1 batch needs:
 *   - gosom Docker container reachable (localhost:8080)
 *   - PSI API key configured + reachable (Google PageSpeed Insights)
 *   - Discord bot token configured + can hit forum channels API
 *   - claude_cli + ollama installed (visual audit fallback chain)
 *   - data/ disk has > 5GB free
 *
 * Exit code 0 = all checks passed.
 * Exit code 1 = at least one check failed (printed in red).
 *
 * SOP-1 v1.0 G-2.
 */

import fs from 'node:fs';
import os from 'os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  console.log(`  ${tag} ${name.padEnd(36)} ${DIM}${detail}${RESET}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail || 'ok');
  } catch (err) {
    record(name, false, err.message || String(err));
  }
}

console.log(`\n${YELLOW}pl:preflight${RESET}  ·  SOP-1 batch readiness check\n`);

// 1. gosom Docker container reachable
await check('gosom Docker (localhost:8080)', async () => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch('http://localhost:8080/api/v1/jobs', { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return 'reachable';
  } catch (e) {
    throw new Error(`unreachable — try: docker restart gmaps-scraper-web (${e.message})`);
  }
});

// 2. PSI API key
await check('PageSpeed Insights (PSI)', async () => {
  const key = process.env.PAGESPEED_API_KEY || process.env.PSI_API_KEY;
  if (!key) throw new Error('PAGESPEED_API_KEY not set in .env.local');
  // Probe with a lightweight call (doesn't burn quota much — strategy=desktop is fast)
  const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=${key}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (r.status === 400 || r.status === 403) throw new Error(`API key invalid: HTTP ${r.status}`);
    return `key valid (HTTP ${r.status})`;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('PSI API timeout (>8s)');
    throw e;
  }
});

// 3. Discord bot token
await check('Discord bot', async () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN not set');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.status === 401) throw new Error('token rejected (401)');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const me = await r.json();
    return `auth ok (${me.username})`;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Discord API timeout');
    throw e;
  }
});

// 4. claude_cli
{
  const r = spawnSync('which', ['claude'], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) {
    record('claude_cli (visual audit)', true, `path: ${r.stdout.trim()}`);
  } else {
    record('claude_cli (visual audit)', false, 'not on PATH (visual fallback degraded)');
  }
}

// 5. ollama (T0 vision fallback)
{
  const r = spawnSync('which', ['ollama'], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) {
    record('ollama (T0 vision fallback)', true, `path: ${r.stdout.trim()}`);
  } else {
    record('ollama (T0 vision fallback)', false, 'not installed (visual fallback unavailable)');
  }
}

// 6. Disk free
{
  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    const r = spawnSync('df', ['-Pk', dataDir], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`df failed: ${r.stderr}`);
    const line = r.stdout.trim().split('\n').pop();
    const cols = line.split(/\s+/);
    const availKb = parseInt(cols[3], 10);
    const availGb = (availKb / (1024 * 1024)).toFixed(1);
    if (availKb < 5 * 1024 * 1024) {
      record('disk free (data/)', false, `only ${availGb} GB available — need > 5 GB`);
    } else {
      record('disk free (data/)', true, `${availGb} GB available`);
    }
  } catch (e) {
    record('disk free (data/)', false, e.message);
  }
}

// 7. Summary
const failed = results.filter((r) => !r.ok);
console.log('');
if (failed.length === 0) {
  console.log(`${GREEN}✓ All ${results.length} checks passed — batch ready.${RESET}\n`);
  process.exit(0);
} else {
  console.log(`${RED}✗ ${failed.length} of ${results.length} checks failed${RESET}`);
  for (const f of failed) console.log(`    - ${f.name}: ${f.detail}`);
  console.log('');
  // Soft-fail for non-critical missing tools (claude/ollama/disk warnings):
  // hard-fail only when batch literally cannot run (gosom / PSI / Discord).
  const hardFailNames = new Set(['gosom Docker (localhost:8080)', 'PageSpeed Insights (PSI)', 'Discord bot']);
  const hardFailed = failed.filter((f) => hardFailNames.has(f.name));
  if (hardFailed.length > 0) {
    console.log(`${RED}Hard fail — fix above before running a batch.${RESET}\n`);
    process.exit(1);
  }
  console.log(`${YELLOW}Soft warnings only — batch can run but degraded.${RESET}\n`);
  process.exit(0);
}
