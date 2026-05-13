#!/usr/bin/env node
// M2-D5 · 30-day staleness · audit Stage 1 reuse vs refetch
import fs from 'fs';
import path from 'path';
import { makeRunner, tryImport, REPO_ROOT } from './_test-helpers.mjs';

const r = makeRunner('m2-d5-staleness');

// Look for a dedicated staleness checker. We deliberately do NOT import
// run-audit-pipeline.js because it's a CLI entrypoint that calls process.exit.
let m2 = null;
try {
  m2 = await tryImport('core/leads/audit-stage1.js');
  if (m2?.__error) m2 = null;
} catch { m2 = null; }

if (!m2 || typeof m2.checkStaleness !== 'function') {
  r.skip('checkStaleness-exists', 'core/leads/audit-stage1.js#checkStaleness missing');
  for (const c of ['fresh', '31-day', 'env-override']) {
    r.skip(`case-${c}`, 'gated on checkStaleness');
  }
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

const FIX_DIR = path.join(REPO_ROOT, 'data', 'v2', 'fixtures', 'detailed-audit');
fs.mkdirSync(FIX_DIR, { recursive: true });
const FIX = path.join(FIX_DIR, '__test_stale__.json');

await r.assert('fresh-fixture-reused', async () => {
  fs.writeFileSync(FIX, JSON.stringify({ score: 50, fetched_at: new Date().toISOString() }));
  const logs = [];
  const decision = m2.checkStaleness
    ? m2.checkStaleness({ fixturePath: FIX, stalenessDays: 30, __log: (m) => logs.push(m) })
    : null;
  if (!decision) throw new Error('checkStaleness(opts) must be exported');
  if (decision !== 'reuse') throw new Error(`expected reuse · got ${decision}`);
  return true;
});

await r.assert('31-day-old-fixture-refetched', async () => {
  fs.writeFileSync(FIX, JSON.stringify({ score: 50 }));
  const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
  fs.utimesSync(FIX, old / 1000, old / 1000);
  const decision = m2.checkStaleness({ fixturePath: FIX, stalenessDays: 30 });
  if (decision !== 'refetch') throw new Error(`expected refetch · got ${decision}`);
  return true;
});

await r.assert('env-override-AUDIT_STALENESS_DAYS', () => {
  const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
  fs.utimesSync(FIX, old / 1000, old / 1000);
  process.env.AUDIT_STALENESS_DAYS = '7';
  const decision = m2.checkStaleness({ fixturePath: FIX });
  delete process.env.AUDIT_STALENESS_DAYS;
  if (decision !== 'refetch') throw new Error(`AUDIT_STALENESS_DAYS=7 + 8d old → expected refetch · got ${decision}`);
  return true;
});

// Cleanup
try { fs.unlinkSync(FIX); } catch {}

const s = r.summary();
process.exit(s.exitCode);
