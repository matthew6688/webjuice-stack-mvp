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
import { geocodeCity } from '../../core/leads/geocode.js';

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

// gosom (新版本) 要求 jobBody 带 lat/lon · 用 Google Geocoding API 把 city 转坐标
// 缓存到 data/geocode-cache.json · 同城市永不二次付费
const allowSkipGeocode = args['skip-geocode'] === true || process.env.SCRAPE_DOCKER_SKIP_GEOCODE === '1';
let geocoded = null;
if (!dryRun && !allowSkipGeocode) {
  try {
    geocoded = await geocodeCity(city);
    console.error(`geocode ${city} → ${geocoded.lat},${geocoded.lng} (${geocoded.source}) · ${geocoded.formatted_address}`);
  } catch (err) {
    die(`geocoding failed: ${err.message}`);
  }
}

const jobBody = {
  name: runId,
  keywords,
  lang,
  zoom,
  depth: count,
  max_time: maxTime,
  fast_mode: true,
  radius: 0,
  ...(geocoded ? { lat: String(geocoded.lat), lon: String(geocoded.lng) } : {}),
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
      // 2026-05-13 fix: gosom 返回 PascalCase ("Status":"ok") · 不是 "status"
      // 兼容两种写法 (老版可能是小写)
      const status = j.Status || j.status;
      if (status === 'ok') {
        process.stderr.write(' done\n');
        return j;
      }
      // 失败状态也提前退出 (避免一直 poll 死任务)
      if (status === 'failed' || status === 'error') {
        throw new Error(`gosom job ${id} status=${status} · ${j.Error || j.error || 'no error detail'}`);
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
// V3 Bug D fix (2026-05-14): pre-flight check the gosom container BEFORE
// posting a job. Previous behaviour was a confusing "fetch failed" with no
// context when the container was stopped (Docker Desktop quits frequently).
// Now: detect docker state · auto-recover via `docker start` · friendly errors.
const CONTAINER_NAME = process.env.GMAPS_SCRAPER_CONTAINER || 'gmaps-scraper-web';

async function checkContainerHealth() {
  // 1. Daemon reachable?
  const dockerInfo = spawnSync('docker', ['info'], { encoding: 'utf8', timeout: 5000 });
  if (dockerInfo.status !== 0) {
    return {
      ok: false,
      reason: 'docker_daemon_unreachable',
      friendly: `Docker daemon 没启动 · 启 Docker Desktop: \`open -a Docker\` · 等 10s 后重跑`,
    };
  }
  // 2. Container running?
  const psR = spawnSync('docker', ['inspect', '--format', '{{.State.Running}}', CONTAINER_NAME], { encoding: 'utf8', timeout: 5000 });
  if (psR.status !== 0) {
    return {
      ok: false,
      reason: 'container_missing',
      friendly: `gosom 容器 "${CONTAINER_NAME}" 不存在 · 跑: docker run -d --name ${CONTAINER_NAME} -p 8080:8080 gosom/google-maps-scraper`,
    };
  }
  const running = String(psR.stdout || '').trim() === 'true';
  if (!running) {
    // Auto-recover · try to start it
    console.error(`[pl:scrape-docker] gosom 容器停了 · 尝试重启 ${CONTAINER_NAME}...`);
    const startR = spawnSync('docker', ['start', CONTAINER_NAME], { encoding: 'utf8', timeout: 30_000 });
    if (startR.status !== 0) {
      return {
        ok: false,
        reason: 'container_start_failed',
        friendly: `gosom 容器 "${CONTAINER_NAME}" 启动失败: ${(startR.stderr || '').slice(0, 200)} · 手动跑: docker start ${CONTAINER_NAME}`,
      };
    }
    console.error(`[pl:scrape-docker] ✓ 容器已重启 · 等 3s warmup...`);
    await new Promise((res) => setTimeout(res, 3000));
  }
  // 3. HTTP endpoint reachable?
  try {
    const res = await fetch(`${DOCKER_BASE}/api/v1/jobs`, { method: 'GET', signal: AbortSignal.timeout(5000) });
    if (!res.ok && res.status !== 405 && res.status !== 404) {
      return {
        ok: false,
        reason: 'http_endpoint_unhealthy',
        friendly: `gosom HTTP API 不健康 · status=${res.status} · 重启: docker restart ${CONTAINER_NAME}`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'http_endpoint_unreachable',
      friendly: `gosom 容器活了但 HTTP API 连不上 (${DOCKER_BASE}): ${err.message} · 等几秒后重跑`,
    };
  }
  return { ok: true };
}

async function main() {
  if (dryRun) {
    printPlan();
    return;
  }

  // V3 Bug D fix · pre-flight health check + auto-recover
  const health = await checkContainerHealth();
  if (!health.ok) {
    console.error(`pl:scrape-docker: ❌ container health check failed`);
    console.error(`  reason: ${health.reason}`);
    console.error(`  fix:    ${health.friendly}`);
    process.exit(2);
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
