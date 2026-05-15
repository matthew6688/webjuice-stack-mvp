#!/usr/bin/env node
/**
 * V3 cycle-26 · One-shot data migration: entity.phase 'design-ready' → 'audit-ready'.
 *
 * Idempotent. Re-runs cheap (scans + counts 0 on second run).
 *
 * Usage:
 *   node scripts/ops/migrate-phase-rename.js --dry-run
 *   node scripts/ops/migrate-phase-rename.js
 *
 * Programmatic:
 *   import { runMigration } from './migrate-phase-rename.js';
 *   const r = await runMigration({ storeRoot, dryRun: true });
 */
import fs from 'node:fs';
import path from 'node:path';
import { ENTITY_PHASE } from '../../core/contracts/discord-messages.js';

const OLD_VALUE = 'design-ready';
const NEW_VALUE = ENTITY_PHASE.AUDIT_READY;

export async function runMigration({ storeRoot = 'data/leads', dryRun = false } = {}) {
  const dir = path.join(storeRoot, 'entities');
  if (!fs.existsSync(dir)) {
    return { ok: false, reason: 'entities_dir_missing', dir, scanned: 0, migrated: 0, samples: [] };
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  let migrated = 0;
  const samples = [];

  for (const f of files) {
    const p = path.join(dir, f);
    let e;
    try { e = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { continue; }
    if (e.phase !== OLD_VALUE) continue;

    if (samples.length < 5) samples.push({ key: e.key || f.replace(/\.json$/, ''), from: e.phase, to: NEW_VALUE });
    if (!dryRun) {
      e.phase = NEW_VALUE;
      e.history = [
        ...(e.history || []),
        { at: new Date().toISOString(), event: 'phase_migrated', from: OLD_VALUE, to: NEW_VALUE, note: 'cycle-26 rename' },
      ];
      fs.writeFileSync(p, JSON.stringify(e, null, 2));
    }
    migrated++;
  }

  return { ok: true, scanned: files.length, migrated, samples, dryRun };
}

// CLI entry
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const dryRun = process.argv.includes('--dry-run');
  const storeRoot = (process.argv.find((a) => a.startsWith('--store=')) || '').replace('--store=', '') || 'data/leads';
  const r = await runMigration({ storeRoot, dryRun });
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}
