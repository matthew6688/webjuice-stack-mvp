#!/usr/bin/env node
/**
 * pl:scrape-docker — Bridge the gosom Docker scraper to the V2 entity store.
 *
 * Flow:
 *   1. POST a job to the local gosom container (http://localhost:8080).
 *   2. Poll until status === 'ok'.
 *   3. Download the CSV, save it to data/maps-scraper/webdata/<job_id>.csv.
 *   4. Convert to JSONL (with the historical field renames downstream expects)
 *      at data/maps-scraper/runs/<runId>/results.maps.json.
 *   5. Shell out to `npm run leads:maps-scrape` to upsert into the entity store.
 *
 * Usage:
 *   npm run pl:scrape-docker -- --niche roofing --city sydney --count 20
 *   npm run pl:scrape-docker -- --niche roofing --city sydney --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DOCKER_BASE = 'http://localhost:8080';

// ---------------------------------------------------------------------------
// arg parsing (tiny, no deps)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const key = tok.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function die(msg) {
  console.error(`pl:scrape-docker: ${msg}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

const niche = args.niche;
const city = args.city;
if (!niche) die('--niche required');
if (!city) die('--city required');

const keywords = (args.keywords
  ? String(args.keywords).split(',').map((s) => s.trim()).filter(Boolean)
  : [`${niche} in ${city}`]);

const count = Number.parseInt(args.count || '20', 10);
const maxTimeRaw = Number.parseInt(args['max-time'] || '240', 10);
const maxTime = Math.max(180, maxTimeRaw);
const zoom = Number.parseInt(args.zoom || '15', 10);
const lang = String(args.lang || 'en');
const batchId = args['batch-id'] ? String(args['batch-id']) : null;
const dryRun = Boolean(args['dry-run']);

const isoStamp = new Date().toISOString().replace(/[:.]/g, '-');
const runId = `${niche}-${city}-${isoStamp}`;
const runDir = path.join(REPO_ROOT, 'data/maps-scraper/runs', runId);
const webDataDir = path.join(REPO_ROOT, 'data/maps-scraper/webdata');
const runOutputPath = path.join(runDir, 'results.maps.json');

const jobBody = {
  name: runId,
  keywords,
  lang,
  zoom,
  depth: count,
  max_time: maxTime,
  fast_mode: true,
  radius: 0,
};

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields with commas, escaped quotes, CRLF.
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cur.push(field); field = '';
      } else if (ch === '\n') {
        cur.push(field); field = '';
        rows.push(cur); cur = [];
      } else if (ch === '\r') {
        // swallow; \n handles row break
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  if (rows.length === 0) return [];
  const header = rows.shift();
  return rows
    .filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''))
    .map((r) => {
      const o = {};
      header.forEach((h, idx) => { o[h] = r[idx] !== undefined ? r[idx] : ''; });
      return o;
    });
}

// ---------------------------------------------------------------------------
// CSV row → downstream JSONL shape (field renames per spec).
// ---------------------------------------------------------------------------
function csvRowToLead(row) {
  const out = { ...row };
  if ('website' in out) { out.web_site = out.website; delete out.website; }
  if ('longitude' in out) { out.longtitude = out.longitude; delete out.longitude; }
  if ('descriptions' in out) { out.description = out.descriptions; delete out.descriptions; }
  out.sourceQuery = keywords.join(' | ');
  return out;
}

// ---------------------------------------------------------------------------
// dry-run: print plan and exit.
// ---------------------------------------------------------------------------
function printPlan() {
  const plan = {
    mode: 'dry-run',
    niche,
    city,
    keywords,
    batch_id: batchId,
    runId,
    job_body: jobBody,
    curl_post: `curl -sS -X POST ${DOCKER_BASE}/api/v1/jobs -H 'content-type: application/json' -d '${JSON.stringify(jobBody)}'`,
    curl_poll: `curl -sS ${DOCKER_BASE}/api/v1/jobs/<job_id>`,
    curl_download: `curl -sS ${DOCKER_BASE}/api/v1/jobs/<job_id>/download -o ${path.relative(REPO_ROOT, path.join(webDataDir, '<job_id>.csv'))}`,
    run_path: path.relative(REPO_ROOT, runOutputPath),
    downstream_cmd: [
      'npm', 'run', 'leads:maps-scrape', '--',
      '--input', path.relative(REPO_ROOT, runOutputPath),
      '--query', keywords.join(' | '),
      '--niche', niche,
      '--city', city,
      ...(batchId ? ['--batch-id', batchId] : []),
    ].join(' '),
  };
  console.log(JSON.stringify(plan, null, 2));
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function postJob() {
  const res = await fetch(`${DOCKER_BASE}/api/v1/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(jobBody),
  });
  if (!res.ok) throw new Error(`POST /api/v1/jobs failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  if (!j.id) throw new Error(`POST /api/v1/jobs: no id in response: ${JSON.stringify(j)}`);
  return j.id;
}

async function pollJob(id) {
  const deadline = Date.now() + (maxTime + 60) * 1000;
  process.stderr.write(`polling job ${id} `);
  while (Date.now() < deadline) {
    const res = await fetch(`${DOCKER_BASE}/api/v1/jobs/${id}`);
    if (res.ok) {
      const j = await res.json();
      if (j.status === 'ok') {
        process.stderr.write(' done\n');
        return j;
      }
    }
    process.stderr.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`timeout waiting for job ${id} after ${maxTime + 60}s`);
}

async function downloadCsv(id) {
  fs.mkdirSync(webDataDir, { recursive: true });
  const dest = path.join(webDataDir, `${id}.csv`);
  const res = await fetch(`${DOCKER_BASE}/api/v1/jobs/${id}/download`);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(dest, text);
  return { path: dest, text };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  if (dryRun) {
    printPlan();
    return;
  }

  fs.mkdirSync(runDir, { recursive: true });

  const jobId = await postJob();
  console.error(`job_id=${jobId}`);

  await pollJob(jobId);

  const { path: csvPath, text: csvText } = await downloadCsv(jobId);
  console.error(`csv saved: ${csvPath}`);

  const rows = parseCsv(csvText);
  const leads = rows.map(csvRowToLead);
  const jsonl = leads.map((l) => JSON.stringify(l)).join('\n') + (leads.length ? '\n' : '');
  fs.writeFileSync(runOutputPath, jsonl);
  console.error(`wrote ${leads.length} leads → ${runOutputPath}`);

  const npmArgs = [
    'run', 'leads:maps-scrape', '--',
    '--input', runOutputPath,
    '--query', keywords.join(' | '),
    '--niche', niche,
    '--city', city,
  ];
  if (batchId) npmArgs.push('--batch-id', batchId);

  const proc = spawnSync('npm', npmArgs, { stdio: 'inherit', cwd: REPO_ROOT });
  if (proc.status !== 0) {
    die(`leads:maps-scrape exited with code ${proc.status}`);
  }

  const summary = {
    ok: true,
    job_id: jobId,
    lead_count: leads.length,
    run_path: path.relative(REPO_ROOT, runOutputPath),
    niche,
    city,
    keywords,
    batch_id: batchId,
    queues_path: 'data/leads/queues/',
  };
  console.log(JSON.stringify(summary));
}

main().catch((err) => {
  console.error(`pl:scrape-docker failed: ${err.message}`);
  process.exit(1);
});
