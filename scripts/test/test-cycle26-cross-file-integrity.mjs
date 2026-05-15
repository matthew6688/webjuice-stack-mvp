/**
 * cycle-26 · TDD test 9/9 · Cross-file integrity (static-source asserts).
 *
 * Catches the kind of bug that B1 (slugArg typo) was:
 *   - silently broken cross-file invariants
 *   - missing wired calls
 *   - duplicated logic that drifts
 *
 * Strategy: greps the live source files for required strings / patterns.
 * Doesn't execute code · just verifies the wiring is in place.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 9/9 · cross-file integrity\n');

// ─── B1 regression: pl-build-from-reference uses `slug` not `slugArg` in body ─
t('pl-build-from-reference.js · uses `slug` (not `slugArg`) in body (B1 regression)',
  () => {
    const src = read('scripts/cli/pl-build-from-reference.js');
    // After my fix · publish chain + Stage 8 message uses `slug` (the const)
    assert.ok(src.includes("args: ['--slug', slug]"), 'publish chain must use `slug` const');
    assert.ok(src.includes('slug: slug,') || src.match(/stage6Message\(\{\s*slug,/), 'stage6 message must use `slug`');
    // slugArg should ONLY appear inside pickEntityFile(slugArg) function param
    const slugArgMatches = [...src.matchAll(/slugArg/g)];
    // Allow refs ONLY inside pickEntityFile function body
    const pickEntityFnStart = src.indexOf('function pickEntityFile');
    const pickEntityFnEnd = src.indexOf('\nfunction ', pickEntityFnStart + 1);
    const fnEnd = pickEntityFnEnd > 0 ? pickEntityFnEnd : src.length;
    for (const m of slugArgMatches) {
      assert.ok(m.index >= pickEntityFnStart && m.index < fnEnd,
        `slugArg ref at index ${m.index} outside pickEntityFile (between ${pickEntityFnStart} and ${fnEnd})`);
    }
  });

// ─── publish-demo wires setEntityPhase(outreach-active) after publish ───────
t('pl-publish-demo.js · transitions entity.phase → outreach-active post-publish',
  () => {
    const src = read('scripts/cli/pl-publish-demo.js');
    assert.ok(src.includes('OUTREACH_ACTIVE') || src.includes('outreach-active'),
      'publish-demo must set phase to outreach-active');
    assert.ok(src.includes('setEntityPhase'), 'must call setEntityPhase');
  });

// ─── publish-demo posts Stage 9 message to projects thread (not just leads) ─
t('pl-publish-demo.js · posts Stage 9 message to projects thread',
  () => {
    const src = read('scripts/cli/pl-publish-demo.js');
    // Should have at least 2 stage7Message calls (one for leads · one for projects)
    const count = (src.match(/stage7Message/g) || []).length;
    assert.ok(count >= 2, `expected ≥2 stage7Message calls · got ${count}`);
  });

// ─── lead-thread-sync renameThreadToCurrentTitle posts history record ──────
t('lead-thread-sync.js · renameThreadToCurrentTitle posts 🔖 title-change record',
  () => {
    const src = read('core/funnel/lead-thread-sync.js');
    assert.ok(src.includes('🔖'), 'must post 🔖 marker in thread on rename');
    assert.ok(src.includes('标题更改'), 'must include "标题更改" label');
    assert.ok(src.includes('oldTitle'), 'must reference oldTitle for diff');
  });

// ─── setEntityPhase hook calls renameThreadToCurrentTitle (cycle-26 fix) ───
t('discovery-store setEntityPhase hook calls renameThreadToCurrentTitle',
  () => {
    const src = read('core/leads/discovery-store.js');
    assert.ok(src.includes('renameThreadToCurrentTitle'),
      'phase change hook must rename title (title state machine driver)');
  });

// ─── setEntityPhase hook does NOT spam batch thread (cycle-26 P5 · KPI dashboard at end instead)
t('discovery-store setEntityPhase hook does NOT call emitBatchProgress (P5 KPI rework)',
  () => {
    const src = read('core/leads/discovery-store.js');
    // Should NOT have emitBatchProgress active call · only comment ref to removed code
    const callRe = /import\([^)]+batch-progress[^)]+\)\.then\(\s*\(\s*\{\s*emitBatchProgress\s*\}\s*\)\s*=>\s*\n?\s*emitBatchProgress/;
    assert.ok(!callRe.test(src),
      'setEntityPhase must NOT spam batch thread per-entity · use KPI dashboard at end instead');
  });

// ─── terminal-archive calls archiveLeadAsRejected + Discord rename + lock ──
t('terminal-archive.js · call order: rename → swap → archive message → archive+lock',
  () => {
    const src = read('core/leads/terminal-archive.js');
    // Find CALL sites (followed by `(entityKey` or `(entity.discord`) — skip import line
    const idxRename = src.search(/renameThreadToCurrentTitle\(entityKey/);
    const idxSwap = src.search(/swapPhaseTag\(entityKey/);
    const idxAppend = src.search(/appendThreadMessage\(\s*\n?\s*entity\.discord/);
    const idxLock = src.search(/archiveAndLockThread\(entity\.discord/);
    assert.ok(idxRename > 0, 'renameThreadToCurrentTitle(entityKey ...) call site missing');
    assert.ok(idxSwap > 0, 'swapPhaseTag(entityKey ...) call site missing');
    assert.ok(idxAppend > 0, 'appendThreadMessage(entity.discord_thread_id ...) call site missing');
    assert.ok(idxLock > 0, 'archiveAndLockThread(entity.discord_thread_id ...) call site missing');
    assert.ok(idxRename < idxSwap, 'rename call before swap call');
    assert.ok(idxSwap < idxAppend, 'swap before append');
    assert.ok(idxAppend < idxLock, 'archive+lock LAST (Discord rejects rename on locked)');
  });

// ─── build-master-md skips tiny rebuilds (B2 fix) ──────────────────────────
t('build-master-md.js · skips Discord post for tiny rebuilds (score=null or <5KB or <5 sections)',
  () => {
    const src = read('scripts/leads/build-master-md.js');
    assert.ok(src.match(/score\s*==\s*null/) || src.match(/score\s*===\s*null/) || src.match(/!\s*score/),
      'must check score == null');
    assert.ok(src.includes('5000') && src.includes('5'), 'must enforce byte/section thresholds');
  });

// ─── intent-router blocks LLM from picking scrape-docker as intake (cycle-25) ─
t('intent-router · LLM-routed kind=intake cli=pl:scrape-docker → forced pipeline-batch-start',
  () => {
    const src = read('core/tasks/intent-router.js');
    assert.ok(src.includes("kind === 'intake' && cli === 'pl:scrape-docker'"),
      'must override LLM mis-route to internal step');
    assert.ok(src.includes("cli = 'pl:pipeline-batch-start'"));
  });

// ─── all TERMINAL_FAIL_PATHS reference valid handler files ─────────────────
t('contract TERMINAL_FAIL_PATHS · all path.file exists + contains handler',
  () => {
    const src = read('core/contracts/discord-messages.js');
    const m = src.match(/export const TERMINAL_FAIL_PATHS = Object\.freeze\(\[([\s\S]+?)\]\);/);
    assert.ok(m, 'TERMINAL_FAIL_PATHS must be exported');
    // Extract files
    const fileRefs = [...m[1].matchAll(/file:\s*['"]([^'"]+)['"]/g)].map((x) => x[1]);
    const uniqFiles = [...new Set(fileRefs)];
    for (const f of uniqFiles) {
      const fp = path.join(ROOT, f);
      assert.ok(fs.existsSync(fp), `terminal-path file missing: ${f}`);
      const content = fs.readFileSync(fp, 'utf8');
      assert.ok(content.includes('archiveLeadAsRejected'),
        `${f} does not reference archiveLeadAsRejected`);
    }
  });

// ─── no legacy 0-8 stage labels in code (cycle-26 renumber 1-9) ────────────
t('no `Stage X/8` literals in code (cycle-26 renumber)',
  () => {
    // Scan core + scripts for "Stage \d+/8 ·" — should NOT exist
    function walk(dir, out = []) {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, f.name);
        if (full.includes('/_archive/') || full.includes('/test-cycle26-') || full.includes('/contracts/')) continue;
        if (f.isDirectory()) walk(full, out);
        else if (f.name.endsWith('.js') || f.name.endsWith('.mjs')) out.push(full);
      }
      return out;
    }
    const files = walk(path.join(ROOT, 'core')).concat(walk(path.join(ROOT, 'scripts')));
    for (const file of files) {
      const txt = fs.readFileSync(file, 'utf8');
      const m = txt.match(/Stage \d+\/8/);
      assert.ok(!m, `${path.relative(ROOT, file)} still has legacy "Stage X/8" label: "${m?.[0]}"`);
    }
  });

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
