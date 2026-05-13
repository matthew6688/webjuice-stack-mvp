#!/usr/bin/env node
/**
 * pl:bulk-archive — M1-D5
 *
 * One-shot V2 stale-cleanup CLI. Walks the entity store and archives entities
 * stuck in `status=queued_for_audit` with no V2 `phase` set. Always produces a
 * tarball backup before any write.
 *
 *   npm run pl:bulk-archive -- --dry-run            # preview (default safe)
 *   npm run pl:bulk-archive -- --commit             # actually archive
 *   npm run pl:bulk-archive -- --niche plumber      # restrict scope
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { parseArgs } from './_pl-shared.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..', '..');
const ENTITIES_DIR = path.join(REPO, 'data', 'leads', 'entities');

function isCandidate(entity, { niche } = {}) {
  if (!entity || typeof entity !== 'object') return false;
  if (entity.status !== 'queued_for_audit') return false;
  if (entity.phase) return false; // already has V2 phase
  if (niche && niche !== '__test__') {
    const ent_niche = (entity.latest?.niche || entity.latest?.category || '').toLowerCase();
    if (!ent_niche.includes(niche.toLowerCase())) return false;
  }
  return true;
}

function listEntityFiles() {
  if (!fs.existsSync(ENTITIES_DIR)) return [];
  return fs.readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.json'));
}

/**
 * Tar+gzip the entity store to data/leads/entities-backup-YYYYMMDD.tar.gz.
 * Idempotent: returns existing path if already created today.
 */
export function createBackup() {
  if (!fs.existsSync(ENTITIES_DIR)) {
    throw new Error(`entities dir missing: ${ENTITIES_DIR}`);
  }
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outPath = path.join(REPO, 'data', 'leads', `entities-backup-${today}.tar.gz`);
  if (fs.existsSync(outPath)) return outPath;
  // tar relative to data/leads so the archive root is "entities/"
  const cwd = path.join(REPO, 'data', 'leads');
  execSync(`tar -czf ${JSON.stringify(outPath)} entities`, { cwd, stdio: 'pipe' });
  return outPath;
}

/**
 * @param {Object} options
 * @param {boolean} options.dryRun       — when true, lists candidates only.
 * @param {string=}  options.niche        — niche filter; '__test__' = no-op filter.
 * @param {string=}  options.archiveReason
 * @returns {{candidateKeys: string[], archivedKeys: string[], backupPath: string|null}}
 */
export async function bulkArchive({ dryRun = true, niche = '', archiveReason = 'v2-stale-cleanup' } = {}) {
  const files = listEntityFiles();
  const candidateKeys = [];
  const entityCache = new Map();

  for (const f of files) {
    let e;
    try { e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8')); }
    catch { continue; }
    if (!isCandidate(e, { niche })) continue;
    candidateKeys.push(e.entityKey || f.replace(/\.json$/, ''));
    entityCache.set(e.entityKey || f.replace(/\.json$/, ''), { file: f, entity: e });
  }

  if (dryRun) {
    return { candidateKeys, archivedKeys: [], backupPath: null, dryRun: true };
  }

  const backupPath = createBackup();
  const archivedKeys = [];
  const at = new Date().toISOString();

  for (const key of candidateKeys) {
    const cached = entityCache.get(key);
    if (!cached) continue;
    const { file, entity } = cached;
    entity.phase = 'ARCHIVED';
    entity.archive_reason = archiveReason;
    entity.archivedAt = at;
    entity.history = [
      ...(entity.history || []),
      { at, event: 'bulk_archived', reason: archiveReason, by: 'pl:bulk-archive' },
    ].slice(-100);
    fs.writeFileSync(path.join(ENTITIES_DIR, file), JSON.stringify(entity, null, 2));
    archivedKeys.push(key);
  }

  return { candidateKeys, archivedKeys, backupPath, dryRun: false };
}

// CLI entry — only when run directly
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = !(args.commit === true || args.commit === 'true');
  const niche = typeof args.niche === 'string' ? args.niche : '';
  const out = await bulkArchive({ dryRun, niche });
  console.log(JSON.stringify({
    ok: true,
    mode: dryRun ? 'dry-run' : 'commit',
    niche: niche || null,
    candidate_count: out.candidateKeys.length,
    archived_count: out.archivedKeys.length,
    backup: out.backupPath,
    candidateKeys: out.candidateKeys,
  }, null, 2));
}
