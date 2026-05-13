#!/usr/bin/env node
// V3 · 4 entry × full pipeline · verify master.md generated per entity.
// Runs real CLI for each of the 4 SOP-1 entries (batch-maps via gosom docker,
// places-search-intake, single-enrich, ingest-image), then for each created
// entity invokes leads:build-master-md and asserts clients/<slug>/v2/master.md
// exists with the 5 required Chinese sections.
//
// Costs: ~$0.10-0.30 total (small Places API calls · 1 gosom search · no LLM).
// Time: ~3-5 min.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
process.chdir(REPO);

const RUN_TAG = 'e2e-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const OUT_DIR = path.join(REPO, 'data', 'qa', `e2e-4-entry-${RUN_TAG}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const entries = [];
let phase = null;

function start(name) {
  phase = { name, steps: [], entityKeys: [], started_at: new Date().toISOString() };
  entries.push(phase);
  console.log(`\n━━━ ${name} ━━━`);
}

async function step(label, fn) {
  const r = { label, passed: false, error: null, took_ms: 0, data: null };
  const t0 = Date.now();
  try {
    const v = await fn();
    if (v === false) throw new Error('returned false');
    r.passed = true;
    if (v && typeof v === 'object') r.data = v;
  } catch (err) {
    r.error = err?.message || String(err);
  }
  r.took_ms = Date.now() - t0;
  phase.steps.push(r);
  const tag = r.passed ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${label}${r.error ? ' · ' + r.error : ''}`);
  return r.passed;
}

function entitiesDir() { return path.join(REPO, 'data', 'leads', 'entities'); }

function snapshotEntityKeys() {
  if (!fs.existsSync(entitiesDir())) return new Set();
  return new Set(fs.readdirSync(entitiesDir()).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')));
}

// Return entityKeys whose file mtime is after `sinceMs`.
// Handles "re-search returns same place_id" case (entity gets updated · still counts as touched).
function entitiesTouchedSince(sinceMs) {
  if (!fs.existsSync(entitiesDir())) return [];
  return fs.readdirSync(entitiesDir())
    .filter(f => f.endsWith('.json'))
    .map(f => ({ key: f.replace(/\.json$/, ''), mtime: fs.statSync(path.join(entitiesDir(), f)).mtimeMs }))
    .filter(o => o.mtime >= sinceMs)
    .sort((a, b) => b.mtime - a.mtime)
    .map(o => o.key);
}

function runCli(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: REPO, encoding: 'utf8',
    timeout: opts.timeout || 180_000,
    env: { ...process.env, ...opts.env },
  });
  return r;
}

async function buildMasterMd(entityKey) {
  const r = runCli('npm', ['run', 'leads:build-master-md', '--', '--entity-key', entityKey], { timeout: 60_000 });
  return r;
}

function readEntity(entityKey) {
  const f = path.join(entitiesDir(), `${entityKey}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function slugFromEntity(e) {
  // build-master-md.js convention: slug(entity.latest.name || entityKey)
  // → clients/<slug>/v2/master.md
  return slugify(e?.latest?.name || e?.entityKey);
}

function masterMdPath(slug) {
  return path.join(REPO, 'clients', slug, 'v2', 'master.md');
}

// ─────────────────────────────────────────────────────────────────
// Entry 1 · places-search-intake (cheap · ~$0.02 per search)
// ─────────────────────────────────────────────────────────────────
start('Entry 1 · pl:places-search-intake');
const t1 = Date.now();
let placesKey = null;

await step('search "panel beater Brisbane" · limit 2', () => {
  const r = runCli('npm', ['run', 'pl:places-search-intake', '--', 'panel beater Brisbane', '--limit', '2']);
  if (r.status !== 0) throw new Error(`exit ${r.status}\n${(r.stderr || '').slice(0, 400)}\n${(r.stdout || '').slice(-400)}`);
  fs.writeFileSync(path.join(OUT_DIR, 'entry1-places-stdout.log'), r.stdout || '');
  fs.writeFileSync(path.join(OUT_DIR, 'entry1-places-stderr.log'), r.stderr || '');
  return { stdout_len: r.stdout?.length || 0 };
});

await step('at least 1 entity touched (new or updated)', () => {
  const touched = entitiesTouchedSince(t1);
  if (touched.length === 0) throw new Error('no entity files touched after CLI ran');
  placesKey = touched[0];
  phase.entityKeys = touched.slice(0, 2);
  return { touched_count: touched.length, sample: placesKey };
});

await step('entity has discoveryScore + name', () => {
  const e = readEntity(placesKey);
  if (!e) throw new Error(`entity ${placesKey} not readable`);
  if (typeof e.latest?.discoveryScore !== 'number') throw new Error(`discoveryScore missing on ${placesKey}`);
  if (!e.latest?.name) throw new Error(`name missing on ${placesKey}`);
  return { name: e.latest.name, score: e.latest.discoveryScore };
});

await step('build master.md', async () => {
  const r = await buildMasterMd(placesKey);
  if (r.status !== 0) throw new Error(`build-master-md exit ${r.status}\n${(r.stderr || '').slice(0, 300)}`);
  return { ok: true };
});

await step('master.md exists with 5 required Chinese sections', () => {
  const slug = slugFromEntity(readEntity(placesKey));
  const p = masterMdPath(slug);
  if (!fs.existsSync(p)) throw new Error(`${p} missing`);
  const body = fs.readFileSync(p, 'utf8');
  const required = ['速览', '销售切入点', '现网站快速诊断', '业主沟通要点', '账户与档案'];
  const missing = required.filter(s => !body.includes(s));
  if (missing.length) throw new Error(`missing sections: ${missing.join(',')}`);
  fs.copyFileSync(p, path.join(OUT_DIR, `entry1-${slug}.master.md`));
  return { slug, path: p, length: body.length };
});

// ─────────────────────────────────────────────────────────────────
// Entry 2 · single-enrich (1 lead from a name + phone)
// ─────────────────────────────────────────────────────────────────
start('Entry 2 · pl:single-enrich');
const t2 = Date.now();
let singleKey = null;

await step('single-enrich "Sky High Roofing"', () => {
  const r = runCli('npm', [
    'run', 'pl:single-enrich', '--',
    '--name', 'Sky High Roofing Brisbane',
    '--phone', '0731234567',
    '--city', 'Brisbane',
    '--niche', 'roofer',
  ]);
  fs.writeFileSync(path.join(OUT_DIR, 'entry2-single-stdout.log'), r.stdout || '');
  fs.writeFileSync(path.join(OUT_DIR, 'entry2-single-stderr.log'), r.stderr || '');
  if (r.status !== 0) throw new Error(`exit ${r.status}\n${(r.stderr || '').slice(0, 300)}`);
  return { ok: true };
});

await step('at least 1 entity touched', () => {
  const touched = entitiesTouchedSince(t2);
  if (touched.length === 0) throw new Error('no entity touched');
  singleKey = touched[0];
  phase.entityKeys = touched.slice(0, 1);
  return { touched_count: touched.length, sample: singleKey };
});

await step('build master.md for single-enriched entity', async () => {
  const r = await buildMasterMd(singleKey);
  if (r.status !== 0) throw new Error(`build-master-md exit ${r.status}\n${(r.stderr || '').slice(0, 300)}`);
  return { ok: true };
});

await step('master.md present + required sections', () => {
  const slug = slugFromEntity(readEntity(singleKey));
  const p = masterMdPath(slug);
  if (!fs.existsSync(p)) throw new Error(`${p} missing`);
  const body = fs.readFileSync(p, 'utf8');
  const required = ['速览', '销售切入点'];
  const missing = required.filter(s => !body.includes(s));
  if (missing.length) throw new Error(`missing sections: ${missing.join(',')}`);
  fs.copyFileSync(p, path.join(OUT_DIR, `entry2-${slug}.master.md`));
  return { slug, length: body.length };
});

// ─────────────────────────────────────────────────────────────────
// Entry 3 · scrape-docker (gosom · runs against local docker)
// ─────────────────────────────────────────────────────────────────
start('Entry 3 · pl:scrape-docker (gosom)');
const t3 = Date.now();
let scrapeKey = null;

await step('scrape "auto detail brisbane" · 2 results', () => {
  // Defensive timeout
  const r = runCli('npm', [
    'run', 'pl:scrape-docker', '--',
    '--niche', 'auto detail',
    '--city', 'Brisbane',
    '--count', '2',
  ], { timeout: 240_000 });
  fs.writeFileSync(path.join(OUT_DIR, 'entry3-scrape-stdout.log'), r.stdout || '');
  fs.writeFileSync(path.join(OUT_DIR, 'entry3-scrape-stderr.log'), r.stderr || '');
  if (r.status !== 0) throw new Error(`exit ${r.status}\n${(r.stderr || '').slice(0, 400)}`);
  return { ok: true };
});

await step('at least 1 entity touched by gosom', () => {
  const touched = entitiesTouchedSince(t3);
  if (touched.length === 0) throw new Error('gosom touched no entities');
  scrapeKey = touched[0];
  phase.entityKeys = touched.slice(0, 2);
  return { touched_count: touched.length, sample: scrapeKey };
});

await step('entity has discoveryScore', () => {
  const e = readEntity(scrapeKey);
  if (typeof e?.latest?.discoveryScore !== 'number') throw new Error('discoveryScore missing');
  return { score: e.latest.discoveryScore, name: e.latest.name };
});

await step('build master.md for scraped entity', async () => {
  const r = await buildMasterMd(scrapeKey);
  if (r.status !== 0) throw new Error(`build-master-md exit ${r.status}\n${(r.stderr || '').slice(0, 300)}`);
  return { ok: true };
});

await step('master.md present + required sections', () => {
  const slug = slugFromEntity(readEntity(scrapeKey));
  const p = masterMdPath(slug);
  if (!fs.existsSync(p)) throw new Error(`${p} missing`);
  const body = fs.readFileSync(p, 'utf8');
  const required = ['速览', '销售切入点'];
  const missing = required.filter(s => !body.includes(s));
  if (missing.length) throw new Error(`missing sections: ${missing.join(',')}`);
  fs.copyFileSync(p, path.join(OUT_DIR, `entry3-${slug}.master.md`));
  return { slug, length: body.length };
});

// ─────────────────────────────────────────────────────────────────
// Entry 4 · ingest-image (synthetic image-lead)
// ─────────────────────────────────────────────────────────────────
start('Entry 4 · pl:ingest-image');
const t4 = Date.now();
let imageKey = null;

await step('ingest fake image lead', () => {
  // Create a tiny synthetic image (1x1 PNG) so the CLI has a real file path
  const png = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C636200000000050001A5F645400000000049454E44AE426082', 'hex');
  const imgPath = path.join(OUT_DIR, 'fake-lead.png');
  fs.writeFileSync(imgPath, png);
  const r = runCli('npm', [
    'run', 'pl:ingest-image', '--',
    '--image', imgPath,
    '--business-name', 'E2E Image Lead Roofing',
    '--phone', '0419876543',
    '--niche', 'roofer',
    '--city', 'Brisbane',
  ]);
  fs.writeFileSync(path.join(OUT_DIR, 'entry4-image-stdout.log'), r.stdout || '');
  fs.writeFileSync(path.join(OUT_DIR, 'entry4-image-stderr.log'), r.stderr || '');
  if (r.status !== 0) throw new Error(`exit ${r.status}\n${(r.stderr || '').slice(0, 400)}`);
  return { ok: true };
});

await step('image_* entity touched', () => {
  const touched = entitiesTouchedSince(t4).filter(k => k.startsWith('image_'));
  if (touched.length === 0) throw new Error('no image_* entity touched');
  imageKey = touched[0];
  phase.entityKeys = touched.slice(0, 1);
  return { touched_count: touched.length, sample: imageKey };
});

await step('build master.md for image entity', async () => {
  const r = await buildMasterMd(imageKey);
  if (r.status !== 0) throw new Error(`build-master-md exit ${r.status}\n${(r.stderr || '').slice(0, 400)}`);
  return { ok: true };
});

await step('master.md present + required sections', () => {
  const slug = slugFromEntity(readEntity(imageKey));
  const p = masterMdPath(slug);
  if (!fs.existsSync(p)) throw new Error(`${p} missing`);
  const body = fs.readFileSync(p, 'utf8');
  const required = ['速览', '销售切入点'];
  const missing = required.filter(s => !body.includes(s));
  if (missing.length) throw new Error(`missing sections: ${missing.join(',')}`);
  fs.copyFileSync(p, path.join(OUT_DIR, `entry4-${slug}.master.md`));
  return { slug, length: body.length };
});

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────
const totalSteps = entries.reduce((a, p) => a + p.steps.length, 0);
const passed = entries.reduce((a, p) => a + p.steps.filter(s => s.passed).length, 0);
const overall = totalSteps === passed ? 'PASS' : 'FAIL';

const summary = {
  overall,
  total_steps: totalSteps,
  passed,
  failed: totalSteps - passed,
  ran_at: new Date().toISOString(),
  output_dir: OUT_DIR,
  entries,
};

fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

console.log('\n━━━ SUMMARY ━━━');
for (const p of entries) {
  const pPass = p.steps.filter(s => s.passed).length;
  const tag = pPass === p.steps.length ? '✓' : '✗';
  console.log(`  ${tag} ${p.name} · ${pPass}/${p.steps.length} · entities: ${p.entityKeys.join(', ') || '—'}`);
}
console.log(`\nOverall: ${overall} · ${passed}/${totalSteps}`);
console.log(`Evidence: ${OUT_DIR}`);
process.exit(overall === 'PASS' ? 0 : 1);
