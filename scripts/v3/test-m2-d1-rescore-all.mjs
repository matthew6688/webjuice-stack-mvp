#!/usr/bin/env node
// M2-D1 · rescore --all-niches + 4h cron
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { makeRunner, REPO_ROOT, resolveRepo } from './_test-helpers.mjs';

const r = makeRunner('m2-d1-rescore-all');

const SCRIPT = 'scripts/scoring/rescore-v2.js';
const exists = resolveRepo(SCRIPT);

if (!exists) {
  r.skip('rescore-script-exists', `${SCRIPT} missing`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

await r.assert('--all-niches-flag-supported', () => {
  const body = fs.readFileSync(exists, 'utf8');
  if (!body.includes('--all-niches') && !body.includes('allNiches')) {
    throw new Error('rescore-v2.js must support --all-niches mode');
  }
  return true;
});

await r.assert('niche-normalize-map-applied', () => {
  const body = fs.readFileSync(exists, 'utf8');
  if (!body.match(/roofing.*roofer|normalize.*niche/i)) {
    throw new Error('niche normalization (roofing → roofer) required');
  }
  return true;
});

await r.assert('dry-run-mode', () => {
  const out = spawnSync('node', [path.resolve(REPO_ROOT, SCRIPT), '--all-niches', '--dry-run'], {
    cwd: REPO_ROOT, encoding: 'utf8', timeout: 60_000,
  });
  if (out.status !== 0) throw new Error(`dry-run exit ${out.status}: ${out.stderr?.slice(0, 200)}`);
  if (!out.stdout.match(/niche|distinct/i)) throw new Error('dry-run must list niches');
  return true;
});

await r.assert('hermes-cron-registered', () => {
  const cronDir = path.join(os.homedir(), '.hermes', 'cron');
  if (!fs.existsSync(cronDir)) throw new Error('Hermes cron dir missing');
  const found = fs.readdirSync(cronDir).some(f => f.includes('rescore') || f.includes('sop1-rescore'));
  if (!found) throw new Error('rescore cron not registered in Hermes');
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
