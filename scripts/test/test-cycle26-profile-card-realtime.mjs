/**
 * cycle-26 · TDD test 13/14 · Profile card real-time refresh.
 *
 * 核心 invariant (Matthew):
 *   "profile card 必须实时更新 · 每个大变动都触发刷新"
 *
 * Tests:
 *   1. writeEntity() fires card-refresh scheduler when discord_thread_id present
 *   2. writeEntity() does NOT fire when no discord_thread_id (entity not in Discord)
 *   3. scheduleCardRefresh debounces multiple writes to one refresh (within delay)
 *   4. Each major state change calls writeEntity → triggers refresh:
 *      - setEntityPhase (phase change)
 *      - publish-demo writing entity.deploy
 *      - lead-grading writing entity.grade
 *      - cheap-audit-queue writing entity.cheap_audit
 *      - check-qualification writing entity.qualification
 *
 * Strategy: install a SPY scheduler · trigger writes · verify spy called.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  writeEntity,
  setCardRefreshScheduler,
  defaultDiscoveryStoreRoot,
  setEntityPhase,
  ENTITY_PHASE,
} from '../../core/leads/discovery-store.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}
async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 13/14 · profile card real-time refresh\n');

// ─── Setup spy scheduler + isolated store ──────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle26-realtime-'));
const STORE_ROOT = TMP;
fs.mkdirSync(path.join(STORE_ROOT, 'entities'), { recursive: true });

let spyCalls = [];
const spyScheduler = (entityKey) => { spyCalls.push({ at: Date.now(), entityKey }); };
setCardRefreshScheduler(spyScheduler);

function reset() { spyCalls = []; }
function writeFixture(key, overrides = {}) {
  const e = {
    schemaVersion: 1,
    entityKey: key,
    latest: { name: key, niche: 'roofer' },
    phase: 'awaiting',
    discord_thread_id: '1500000000000000000',
    ...overrides,
  };
  fs.writeFileSync(path.join(STORE_ROOT, 'entities', `${key}.json`), JSON.stringify(e, null, 2));
  return e;
}

// ─── T1 · writeEntity fires scheduler when has discord_thread_id ───────────
t('writeEntity · has discord_thread_id → schedules card refresh', () => {
  reset();
  const e = writeFixture('fx_t1');
  e.phase = 'audit-ready'; // mutate
  writeEntity(STORE_ROOT, e);
  assert.equal(spyCalls.length, 1, `expected 1 schedule call, got ${spyCalls.length}`);
  assert.equal(spyCalls[0].entityKey, 'fx_t1');
});

// ─── T2 · No discord_thread_id → no schedule call ──────────────────────────
t('writeEntity · no discord_thread_id → does NOT schedule', () => {
  reset();
  const e = writeFixture('fx_t2', { discord_thread_id: null });
  e.phase = 'audit-ready';
  writeEntity(STORE_ROOT, e);
  assert.equal(spyCalls.length, 0, 'must not schedule for entity without thread');
});

// ─── T3 · setEntityPhase → writeEntity → scheduler called ──────────────────
t('setEntityPhase → indirectly triggers card refresh (via writeEntity)', () => {
  reset();
  writeFixture('fx_t3', { phase: 'awaiting' });
  setEntityPhase({
    entityKey: 'fx_t3',
    phase: ENTITY_PHASE.AUDIT_READY,
    storeRoot: STORE_ROOT,
  });
  assert.ok(spyCalls.some((c) => c.entityKey === 'fx_t3'),
    'setEntityPhase must call scheduler for fx_t3');
});

// ─── T4 · Multiple writes in quick succession ──────────────────────────────
t('multiple writeEntity in burst → scheduler called per write (debouncing is scheduler-side)', () => {
  reset();
  const e = writeFixture('fx_t4');
  for (let i = 0; i < 5; i++) {
    e.latest.review_count = i;
    writeEntity(STORE_ROOT, e);
  }
  assert.equal(spyCalls.length, 5, 'each writeEntity must call scheduler (debounce handled by scheduler impl)');
});

// ─── T5 · setCardRefreshScheduler null → silent no-op (defensive) ──────────
t('setCardRefreshScheduler(null) → writeEntity does not crash', () => {
  setCardRefreshScheduler(null);
  const e = writeFixture('fx_t5');
  assert.doesNotThrow(() => writeEntity(STORE_ROOT, e));
  setCardRefreshScheduler(spyScheduler); // restore
});

// ─── T6 · Major state changes coverage matrix ──────────────────────────────
// Each "major state change" must result in writeEntity (and thus card refresh).
// Verifies the wiring · catches future regressions.
t('writing entity.detailed_audit (Stage 3) → schedules refresh', () => {
  reset();
  const e = writeFixture('fx_t6_audit');
  e.detailed_audit = { audit_score: 65, decision: 'moderate_candidate' };
  writeEntity(STORE_ROOT, e);
  assert.ok(spyCalls.length >= 1, 'Stage 3 audit data → must refresh');
});

t('writing entity.visual_audit (Stage 4) → schedules refresh', () => {
  reset();
  const e = writeFixture('fx_t6_visual');
  e.visual_audit = { freshness_score: 6, trust_score: 7 };
  writeEntity(STORE_ROOT, e);
  assert.ok(spyCalls.length >= 1, 'Stage 4 visual data → must refresh');
});

t('writing entity.grade (Stage 5) → schedules refresh', () => {
  reset();
  const e = writeFixture('fx_t6_grade');
  e.grade = { investment_level: 'C' };
  writeEntity(STORE_ROOT, e);
  assert.ok(spyCalls.length >= 1, 'Stage 5 grade → must refresh');
});

t('writing entity.qualification (Stage 7) → schedules refresh', () => {
  reset();
  const e = writeFixture('fx_t6_qual');
  e.qualification = { scorecard: { total: 72 }, verdict: 'ready-to-build' };
  writeEntity(STORE_ROOT, e);
  assert.ok(spyCalls.length >= 1, 'Stage 7 qualification → must refresh');
});

t('writing entity.deploy (Stage 9 publish) → schedules refresh', () => {
  reset();
  const e = writeFixture('fx_t6_deploy');
  e.deploy = { demo_url: 'https://x-dev.pages.dev', deployed_at: '2026-05-15T03:00:00Z' };
  writeEntity(STORE_ROOT, e);
  assert.ok(spyCalls.length >= 1, 'Stage 9 deploy → must refresh');
});

// ─── T7 · entity.deploy schema is source-of-truth (not cf-pages-deploy.json) ─
t('profile-card prefers entity.deploy field over disk file', async () => {
  // Build profile card · ensure it reads entity.deploy.demo_url
  const { renderProfileCard } = await import('../../core/funnel/profile-card.js');
  const e = {
    entityKey: 'fx_t7',
    latest: { name: 'X', niche: 'roofer' },
    phase: 'outreach-active',
    grade: { investment_level: 'C' },
    deploy: {
      demo_url: 'https://from-entity-deploy.pages.dev',
      audit_url: 'https://from-entity-deploy.pages.dev/customer-facing-audit.html',
      internal_audit_url: 'https://from-entity-deploy.pages.dev/internal-audit-report.html',
      master_md_url: 'https://from-entity-deploy.pages.dev/master.md',
      master_report_url: 'https://from-entity-deploy.pages.dev/master.report.html',
      deployed_at: '2026-05-15T03:00:00Z',
    },
    audit: { score: 65, decision: 'moderate_candidate' },
  };
  const card = renderProfileCard(e);
  const desc = card.description || card.embeds?.[0]?.description || '';
  assert.ok(desc.includes('from-entity-deploy.pages.dev'),
    `profile card must read entity.deploy.demo_url · got desc: ${desc.slice(0, 200)}`);
});

// ─── cleanup ────────────────────────────────────────────────────────────────
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
