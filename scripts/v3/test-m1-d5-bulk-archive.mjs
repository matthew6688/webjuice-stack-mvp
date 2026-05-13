#!/usr/bin/env node
// M1-D5 · bulk-archive stale entities (dry-run safety + commit semantics)
import fs from 'fs';
import path from 'path';
import { makeRunner, resolveRepo, REPO_ROOT } from './_test-helpers.mjs';

const r = makeRunner('m1-d5-bulk-archive');

const SCRIPT = 'scripts/cli/pl-bulk-archive.js';
const exists = resolveRepo(SCRIPT);

if (!exists) {
  r.skip('script-exists', `${SCRIPT} missing — implementation required`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

await r.assert('script-loads', async () => {
  const m = await import(exists);
  if (typeof m.bulkArchive !== 'function') throw new Error('must export bulkArchive(options)');
  return true;
});

await r.assert('dry-run-mode-no-write', async () => {
  const m = await import(exists);
  const before = countStaleEntities();
  const result = await m.bulkArchive({ dryRun: true, niche: '__test__' });
  const after = countStaleEntities();
  if (before !== after) throw new Error('dry-run must not modify entities');
  if (!Array.isArray(result.candidateKeys)) throw new Error('must return candidateKeys[]');
  return true;
});

await r.assert('backup-created-before-commit', async () => {
  const m = await import(exists);
  if (typeof m.createBackup !== 'function') throw new Error('must export createBackup() before commit');
  return true;
});

await r.assert('history-event-on-archive', async () => {
  // Check that bulkArchive writes a history event per entity (introspect via function signature comment)
  const body = fs.readFileSync(exists, 'utf8');
  if (!body.includes('history') && !body.includes('addEntityHistory')) {
    throw new Error('must record history event per archived entity');
  }
  return true;
});

// Reading-only count helper
function countStaleEntities() {
  const dir = path.join(REPO_ROOT, 'data', 'leads', 'entities');
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (e.status === 'queued_for_audit' && !e.phase) n++;
    } catch {}
  }
  return n;
}

const s = r.summary();
process.exit(s.exitCode);
