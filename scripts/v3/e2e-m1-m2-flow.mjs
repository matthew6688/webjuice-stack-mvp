#!/usr/bin/env node
// V3 M1+M2 E2E · synthetic entity walks full pipeline (intake → dedup → score →
// master.md → audit staleness → reviews cascade → grade route → v2/ structure
// → OD prep). Mocks external services (Discord, Places, gosom, agentic-inbox).
//
// Usage: node scripts/v3/e2e-m1-m2-flow.mjs
// Exit 0 = all phases PASS · evidence: data/qa/e2e-m1-m2-flow.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
process.chdir(REPO);

const TEST_SLUG = '__e2e_m1_m2__';
const TEST_KEY = TEST_SLUG;
const E2E_DIR = path.join(REPO, 'data', 'qa', 'e2e-m1-m2');
fs.mkdirSync(E2E_DIR, { recursive: true });

const phases = [];
let currentPhase = null;

function startPhase(name) {
  currentPhase = { name, steps: [], started_at: new Date().toISOString() };
  phases.push(currentPhase);
  console.log(`\n━━━ ${name} ━━━`);
}

async function step(label, fn) {
  const r = { label, passed: false, error: null, took_ms: 0, data: null };
  const t0 = Date.now();
  try {
    const out = await fn();
    if (out === false) throw new Error('returned false');
    r.passed = true;
    if (out && typeof out === 'object') r.data = out;
  } catch (err) {
    r.error = err?.message || String(err);
    r.stack = err?.stack;
  }
  r.took_ms = Date.now() - t0;
  currentPhase.steps.push(r);
  const tag = r.passed ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${label}${r.error ? ' · ' + r.error : ''}`);
  return r.passed;
}

function cleanup() {
  // Remove test entity + clients folder
  const entityFile = path.join(REPO, 'data', 'leads', 'entities', `${TEST_KEY}.json`);
  if (fs.existsSync(entityFile)) fs.unlinkSync(entityFile);
  const clientDir = path.join(REPO, 'clients', TEST_SLUG);
  if (fs.existsSync(clientDir)) fs.rmSync(clientDir, { recursive: true, force: true });
  // Purge any __e2e_* from cold-outreach queue
  const queueFile = path.join(REPO, 'data', 'leads', 'cold-outreach-queue.json');
  if (fs.existsSync(queueFile)) {
    try {
      const items = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
      const filtered = items.filter(it => !String(it.entityKey || '').startsWith('__e2e_'));
      fs.writeFileSync(queueFile, JSON.stringify(filtered, null, 2));
    } catch {}
  }
  // Cleanup any stale staleness test fixture
  const fxFile = path.join(REPO, 'data', 'v2', 'fixtures', 'detailed-audit', `${TEST_KEY}.json`);
  if (fs.existsSync(fxFile)) fs.unlinkSync(fxFile);
}

cleanup(); // ensure clean state

// ─────────────────────────────────────────────────────────────────────
// PHASE 1 · M1 · Dedup scoring
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 1 · M1 · Dedup scoring');

const dedupMod = await import(path.join(REPO, 'core/leads/dedup-scorer.js'));

await step('scoreDedup contract: phone + name fuzzy → 30-60 LLM band', () => {
  const { score, verdict } = dedupMod.scoreDedup(
    { phone: '0412345678', name: 'Joe Plumbing' },
    { phone: '0412345678', name: 'Joes Plumbing' },
  );
  if (score < 30 || score > 60) throw new Error(`score=${score} expected 30-60`);
  if (verdict !== 'llm-decide') throw new Error(`verdict=${verdict} expected llm-decide`);
  return { score, verdict };
});

await step('scoreDedup: phone + email → ≥60 auto-merge', () => {
  const { score, verdict } = dedupMod.scoreDedup(
    { phone: '0412345678', email: 'a@x.com' },
    { phone: '0412345678', email: 'a@x.com' },
  );
  if (score < 60) throw new Error(`score=${score} expected ≥60`);
  if (verdict !== 'auto-merge') throw new Error(`verdict=${verdict}`);
  return { score, verdict };
});

await step('scoreDedup: no signals → <30 pass', () => {
  const { score, verdict } = dedupMod.scoreDedup({}, {});
  if (score !== 0) throw new Error(`score=${score} expected 0`);
  if (verdict !== 'pass') throw new Error(`verdict=${verdict}`);
  return { score, verdict };
});

await step('getThresholds env override works', () => {
  process.env.DEDUP_AUTO_MERGE_THRESHOLD = '70';
  const t = dedupMod.getThresholds();
  delete process.env.DEDUP_AUTO_MERGE_THRESHOLD;
  if (t.autoMerge !== 70) throw new Error(`expected 70, got ${t.autoMerge}`);
  return t;
});

// ─────────────────────────────────────────────────────────────────────
// PHASE 2 · M1 · Discovery score
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 2 · M1 · Discovery score');

const scoreMod = await import(path.join(REPO, 'core/leads/discovery-score.js'));

await step('full gosom entity → score ≥ 25', () => {
  const s = scoreMod.computeDiscoveryScore({
    sourceType: 'gosom',
    websiteStatus: 'https',
    phone: '0412',
    review_count: 100,
    rating: 4.5,
  });
  if (s < 25) throw new Error(`score=${s} expected ≥25`);
  return { score: s };
});

await step('image_lead with no signals → 0', () => {
  const s = scoreMod.computeDiscoveryScore({ sourceType: 'image_lead' });
  if (s !== 0) throw new Error(`expected 0, got ${s}`);
  return { score: s };
});

await step('NO_WEBSITE bonus +40', () => {
  const s = scoreMod.computeDiscoveryScore({
    sourceType: 'gosom',
    websiteStatus: 'NO_WEBSITE',
    phone: '0412',
  });
  if (s < 40) throw new Error(`expected ≥40, got ${s}`);
  return { score: s };
});

await step('classifyWebsiteStatus exposed', () => {
  if (typeof scoreMod.classifyWebsiteStatus !== 'function') {
    throw new Error('classifyWebsiteStatus must be exported');
  }
  return true;
});

// ─────────────────────────────────────────────────────────────────────
// PHASE 3 · M1 · Entity upsert + master.md skeleton hook
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 3 · M1 · Entity upsert pipeline');

const storeMod = await import(path.join(REPO, 'core/leads/discovery-store.js'));

await step('upsertDiscoveryRun persists synthetic entity', () => {
  // discovery-store convention: leads use `name` (gosom shape), persists to entity.latest.name
  const run = {
    sourceType: 'gosom',
    runId: '__e2e_run_' + Date.now(),
    query: 'roofing brisbane e2e test',
    leads: [{
      entityKey: TEST_KEY,
      name: 'E2E Test Roofing',
      niche: 'roofing',
      city: 'Brisbane',
      phone: '0412000000',
      email: 'e2e@example.test',
      website: 'https://e2e-test-roofing.test',
      address: '1 Test St, Brisbane QLD 4000',
      websiteStatus: 'https',
      rating: 4.5,
      review_count: 10,
      sourceType: 'gosom',
    }],
  };
  storeMod.upsertDiscoveryRun(run, { storeRoot: undefined });
  const entityFile = path.join(REPO, 'data', 'leads', 'entities', `${TEST_KEY}.json`);
  if (!fs.existsSync(entityFile)) throw new Error(`entity file not written: ${entityFile}`);
  const entity = JSON.parse(fs.readFileSync(entityFile, 'utf8'));
  if (entity.latest?.name !== 'E2E Test Roofing') {
    throw new Error(`entity.latest.name=${JSON.stringify(entity.latest?.name)} expected E2E Test Roofing`);
  }
  return { entityKey: entity.entityKey, latestName: entity.latest.name };
});

await step('entity.latest.discoveryScore set by mergeLeadIntoEntity (M1-D2 wiring)', () => {
  const entityFile = path.join(REPO, 'data', 'leads', 'entities', `${TEST_KEY}.json`);
  const e = JSON.parse(fs.readFileSync(entityFile, 'utf8'));
  const score = e.latest?.discoveryScore;
  if (typeof score !== 'number') {
    throw new Error(`entity.latest.discoveryScore missing or non-number: ${JSON.stringify(score)}`);
  }
  if (score <= 0) throw new Error(`expected positive score, got ${score}`);
  return { discoveryScore: score };
});

// ─────────────────────────────────────────────────────────────────────
// PHASE 4 · M2 · audit staleness
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 4 · M2 · Audit staleness');

const staleMod = await import(path.join(REPO, 'core/leads/audit-stage1.js'));
const fxPath = path.join(REPO, 'data', 'v2', 'fixtures', 'detailed-audit', `${TEST_KEY}.json`);
fs.mkdirSync(path.dirname(fxPath), { recursive: true });

await step('fresh fixture → reuse', () => {
  fs.writeFileSync(fxPath, JSON.stringify({ score: 60 }));
  const d = staleMod.checkStaleness({ fixturePath: fxPath, stalenessDays: 30 });
  if (d !== 'reuse') throw new Error(`expected reuse, got ${d}`);
  return { decision: d };
});

await step('31-day-old fixture → refetch', () => {
  const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
  fs.utimesSync(fxPath, old / 1000, old / 1000);
  const d = staleMod.checkStaleness({ fixturePath: fxPath, stalenessDays: 30 });
  if (d !== 'refetch') throw new Error(`expected refetch, got ${d}`);
  return { decision: d };
});

await step('env override AUDIT_STALENESS_DAYS=7', () => {
  const eightDayOld = Date.now() - 8 * 24 * 60 * 60 * 1000;
  fs.utimesSync(fxPath, eightDayOld / 1000, eightDayOld / 1000);
  process.env.AUDIT_STALENESS_DAYS = '7';
  const d = staleMod.checkStaleness({ fixturePath: fxPath });
  delete process.env.AUDIT_STALENESS_DAYS;
  if (d !== 'refetch') throw new Error(`expected refetch with 7-day env, got ${d}`);
  return { decision: d };
});

// ─────────────────────────────────────────────────────────────────────
// PHASE 5 · M2 · Reviews cascade
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 5 · M2 · Reviews cascade');

const reviewsMod = await import(path.join(REPO, 'core/leads/reviews-adapter.js'));

await step('normalizeReviews(docker) → places shape', () => {
  const out = reviewsMod.normalizeReviews(
    [{ Name: 'Alice', Rating: 5, Description: 'great' }, { Name: 'Bob', Rating: 4, Description: 'good' }],
    'docker',
  );
  if (out.length !== 2) throw new Error(`expected 2, got ${out.length}`);
  if (out[0].author_name !== 'Alice') throw new Error('author_name not normalized');
  if (out[0].text !== 'great') throw new Error('text not normalized');
  return { count: out.length };
});

await step('C-grade skips fetching', async () => {
  const out = await reviewsMod.fetchReviewsForEntity({ grade: 'C', entityKey: TEST_KEY, __mock: true });
  if (out && out.reviews?.length) throw new Error('C should skip');
  return { skipped: true };
});

await step('A-grade with docker fail → places fallback', async () => {
  const out = await reviewsMod.fetchReviewsForEntity({
    grade: 'A', entityKey: TEST_KEY, __mock: true, __forceDockerFail: true,
  });
  if (!out || out.source !== 'places') throw new Error(`expected places fallback, got ${JSON.stringify(out)}`);
  return { source: out.source };
});

// ─────────────────────────────────────────────────────────────────────
// PHASE 6 · M2 · Grade router + cold-outreach queue
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 6 · M2 · Grade router');

const gradeMod = await import(path.join(REPO, 'core/leads/grade-router.js'));
const QUEUE = path.join(REPO, 'data', 'leads', 'cold-outreach-queue.json');

function readQueue() {
  if (!fs.existsSync(QUEUE)) return [];
  try { return JSON.parse(fs.readFileSync(QUEUE, 'utf8')); } catch { return []; }
}

await step('C-grade opens Discord thread + enqueues', async () => {
  let opened = false;
  await gradeMod.persistLeadGrade({
    entityKey: '__e2e_c__',
    grade: 'C',
    __mockDiscord: { openLeadThread: () => { opened = true; return { threadId: 'e2e_thread' }; } },
  });
  if (!opened) throw new Error('discord openLeadThread not called');
  const q = readQueue();
  if (!q.find(e => e.entityKey === '__e2e_c__' && e.status === 'pending')) {
    throw new Error('__e2e_c__ not in queue');
  }
  return { thread_opened: opened };
});

await step('C-grade dedup (calling twice → 1 entry)', async () => {
  const beforeCount = readQueue().filter(e => e.entityKey === '__e2e_dedup__').length;
  for (let i = 0; i < 2; i++) {
    await gradeMod.persistLeadGrade({
      entityKey: '__e2e_dedup__',
      grade: 'C',
      __mockDiscord: { openLeadThread: () => ({ threadId: 't' }) },
    });
  }
  const afterCount = readQueue().filter(e => e.entityKey === '__e2e_dedup__').length;
  if (afterCount - beforeCount !== 1) throw new Error(`expected 1 net add, got ${afterCount - beforeCount}`);
  return { net_added: afterCount - beforeCount };
});

await step('A-grade NOT in cold-outreach queue', async () => {
  await gradeMod.persistLeadGrade({
    entityKey: '__e2e_a__',
    grade: 'A',
    __mockDiscord: { openLeadThread: () => ({ threadId: 'a_thread' }) },
  });
  const q = readQueue();
  if (q.find(e => e.entityKey === '__e2e_a__')) throw new Error('A grade leaked into cold queue');
  return { ok: true };
});

// ─────────────────────────────────────────────────────────────────────
// PHASE 7 · M2 · master.md (5 required sections + reorder)
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 7 · M2 · master.md');

const mdMod = await import(path.join(REPO, 'core/reports/master-md-builder.js'));

await step('empty audit → 5 required Chinese sections', () => {
  const md = mdMod.buildMasterMd({
    entity: { entityKey: TEST_KEY, businessName: 'E2E Test Roofing' },
    audit: null,
  });
  const required = ['速览', '销售切入点', '现网站快速诊断', '业主沟通要点', '账户与档案'];
  const missing = required.filter(sec => !md.includes(sec));
  if (missing.length) throw new Error(`missing sections: ${missing.join(', ')}`);
  return { found: required.length };
});

await step('section 7 (销售切入点) appears after section 1 (速览)', () => {
  const md = mdMod.buildMasterMd({
    entity: { entityKey: TEST_KEY, businessName: 'E2E', niche: 'roofing' },
    audit: { score: 60 },
  });
  const i1 = md.indexOf('速览');
  const i7 = md.indexOf('销售切入点');
  if (i1 < 0 || i7 < 0) throw new Error('1 or 7 missing');
  if (i7 < i1) throw new Error(`销售切入点(${i7}) appears BEFORE 速览(${i1})`);
  return { idx_1: i1, idx_7: i7 };
});

await step('full real-customer master.md (regression: brisbane-roof renders)', () => {
  const real = path.join(REPO, 'clients', 'brisbane-roof-restoration-experts', 'v2', 'master.md');
  if (!fs.existsSync(real)) return true; // skip if missing
  const body = fs.readFileSync(real, 'utf8');
  if (!body.includes('速览')) throw new Error('real master.md missing required section');
  return { real_file_lines: body.split('\n').length };
});

// ─────────────────────────────────────────────────────────────────────
// PHASE 8 · M2 · v2/ folder structure
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 8 · M2 · v2/ structure');

const ensureMod = await import(path.join(REPO, 'scripts/cli/pl-ensure-v2-structure.js'));

await step('ensureV2Structure creates 5 subdirs', async () => {
  await ensureMod.ensureV2Structure(TEST_SLUG);
  const v2 = path.join(REPO, 'clients', TEST_SLUG, 'v2');
  for (const sub of ['sales', 'marketing', 'outreach', 'funnel', 'intake']) {
    if (!fs.existsSync(path.join(v2, sub))) throw new Error(`missing v2/${sub}`);
  }
  return { v2_path: v2 };
});

await step('Pattern A flat customer untouched (opa-bar-mezze)', () => {
  const opaV2 = path.join(REPO, 'clients', 'opa-bar-mezze-restaurant', 'v2');
  if (fs.existsSync(opaV2)) throw new Error('Pattern A customer must not have v2/');
  return { ok: true };
});

// ─────────────────────────────────────────────────────────────────────
// PHASE 9 · M2 · od-prep (derives OD payload from master.md)
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 9 · M2 · od-prep');

const odPrepMod = await import(path.join(REPO, 'scripts/cli/pl-od-invoke-prep.js'));

await step('deriveOdPrep(rich-and-rare) returns sourceUrl/tone/scope/businessType', async () => {
  const out = await odPrepMod.deriveOdPrep({ entityKey: 'rich-and-rare-restaurant', __dryRun: true });
  if (!out?.sourceUrl?.includes('richandrare')) throw new Error(`sourceUrl wrong: ${out?.sourceUrl}`);
  if (!out?.businessType?.toLowerCase().includes('restaurant')) throw new Error('businessType missing niche');
  if (!out?.tone) throw new Error('tone missing');
  if (!out?.scope) throw new Error('scope missing');
  return out;
});

await step('image_lead fallback tone', async () => {
  const out = await odPrepMod.deriveOdPrep({
    entityKey: '__e2e_image_test__',
    __mockSourceType: 'image_lead',
    __dryRun: true,
  });
  if (!out?.tone?.toLowerCase().includes('professional')) {
    throw new Error(`tone fallback wrong: ${out?.tone}`);
  }
  return out;
});

// ─────────────────────────────────────────────────────────────────────
// PHASE 10 · M2 · bulk-archive
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 10 · M1 · bulk-archive');

const archiveMod = await import(path.join(REPO, 'scripts/cli/pl-bulk-archive.js'));

await step('bulkArchive dry-run lists candidates without modifying', async () => {
  const before = readEntityFile(TEST_KEY);
  const result = await archiveMod.bulkArchive({ dryRun: true });
  const after = readEntityFile(TEST_KEY);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('dry-run modified an entity');
  }
  if (!Array.isArray(result.candidateKeys)) throw new Error('candidateKeys must be array');
  return { candidates: result.candidateKeys.length };
});

function readEntityFile(key) {
  const f = path.join(REPO, 'data', 'leads', 'entities', `${key}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

// ─────────────────────────────────────────────────────────────────────
// PHASE 11 · cross-module · entity → master.md → od-prep
// ─────────────────────────────────────────────────────────────────────
startPhase('Phase 11 · cross-module integration');

await step('full pipeline: entity persists with discoveryScore', () => {
  const e = readEntityFile(TEST_KEY);
  if (!e) throw new Error('test entity disappeared');
  const score = e.latest?.discoveryScore;
  if (typeof score !== 'number') throw new Error(`discoveryScore not set at entity.latest.discoveryScore: ${JSON.stringify(e.latest)}`);
  return { discoveryScore: score, phase: e.phase, status: e.status };
});

await step('build master.md from real persisted entity', () => {
  const e = readEntityFile(TEST_KEY);
  const md = mdMod.buildMasterMd({
    entity: e,
    audit: { score: 65, decision: 'medium_priority' },
  });
  if (!md.includes('E2E Test Roofing')) throw new Error(`business name not in master.md (sampled: ${md.slice(0, 200)})`);
  if (!md.includes('速览')) throw new Error('required section missing');
  return { md_length: md.length };
});

// ─────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────
const totalSteps = phases.reduce((acc, p) => acc + p.steps.length, 0);
const passedSteps = phases.reduce((acc, p) => acc + p.steps.filter(s => s.passed).length, 0);
const overall = totalSteps === passedSteps ? 'PASS' : 'FAIL';

const summary = {
  overall,
  total_steps: totalSteps,
  passed: passedSteps,
  failed: totalSteps - passedSteps,
  ran_at: new Date().toISOString(),
  phases,
};

const outPath = path.join(REPO, 'data', 'qa', 'e2e-m1-m2-flow.json');
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

console.log(`\n━━━ E2E SUMMARY ━━━`);
for (const p of phases) {
  const pPass = p.steps.filter(s => s.passed).length;
  const tag = pPass === p.steps.length ? '✓' : '✗';
  console.log(`  ${tag} ${p.name} · ${pPass}/${p.steps.length}`);
}
console.log(`\nOverall: ${overall} · ${passedSteps}/${totalSteps} steps`);
console.log(`Summary: ${outPath}`);

cleanup();
process.exit(overall === 'PASS' ? 0 : 1);
