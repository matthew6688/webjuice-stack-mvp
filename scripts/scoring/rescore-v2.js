#!/usr/bin/env node
/**
 * M2-D1 · V2 rescore driver supporting --all-niches.
 *
 * - Reads distinct niches from entity store
 * - Normalizes (roofing → roofer, plumbers → plumber, etc) before deduping
 * - Skips empty / blank niches
 * - --dry-run lists distinct niches without running the per-niche pipeline
 * - For each remaining niche, shells out to rescore-v2-cli.js
 *
 * Hermes cron (0 every-4-hours every-day-of-month every-month every-day-of-week) invokes this script.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const ENTITIES_DIR = path.join(REPO_ROOT, 'data', 'leads', 'entities');
const CLI = path.join(__dirname, 'rescore-v2-cli.js');

// Niche normalize map (matches PRD §6 issue #1).
const NICHE_NORMALIZE = {
  roofing: 'roofer',
  roofer: 'roofer',
  roofers: 'roofer',
  plumbing: 'plumber',
  plumber: 'plumber',
  plumbers: 'plumber',
  electrical: 'electrician',
  electrician: 'electrician',
  electricians: 'electrician',
  dentistry: 'dentist',
  dentist: 'dentist',
  dentists: 'dentist',
  cafe: 'cafe',
  cafes: 'cafe',
  restaurant: 'restaurant',
  restaurants: 'restaurant',
};

function normalizeNiche(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (NICHE_NORMALIZE[s]) return NICHE_NORMALIZE[s];
  // Heuristic fallbacks for unmapped variants.
  if (s.includes('roof')) return 'roofer';
  if (s.includes('plumb')) return 'plumber';
  if (s.includes('electric')) return 'electrician';
  if (s.includes('dent')) return 'dentist';
  return s;
}

function parseArgs(argv) {
  const out = { allNiches: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all-niches') out.allNiches = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--niche') out.niche = argv[++i];
  }
  return out;
}

function distinctNiches() {
  if (!fs.existsSync(ENTITIES_DIR)) return [];
  const seen = new Set();
  for (const f of fs.readdirSync(ENTITIES_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8'));
      const raw = e.latest?.niche || e.latest?.category || '';
      const n = normalizeNiche(raw);
      if (n) seen.add(n);
    } catch {}
  }
  return [...seen].sort();
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.allNiches) {
    const niches = distinctNiches();
    console.log(`[rescore-v2] mode=all-niches distinct niches=${niches.length}: ${niches.join(', ')}`);
    if (args.dryRun) {
      console.log(JSON.stringify({ ok: true, dryRun: true, niches }, null, 2));
      process.exit(0);
    }
    let failures = 0;
    for (const niche of niches) {
      console.log(`\n[rescore-v2] → niche=${niche}`);
      const out = spawnSync('node', [CLI, '--niche', niche], { cwd: REPO_ROOT, stdio: 'inherit' });
      if (out.status !== 0) failures += 1;
    }
    process.exit(failures === 0 ? 0 : 1);
  }

  // Single-niche pass-through.
  const niche = args.niche || 'roofer';
  const out = spawnSync('node', [CLI, '--niche', niche], { cwd: REPO_ROOT, stdio: 'inherit' });
  process.exit(out.status || 0);
}

main();
