/**
 * Shared utilities for pl-* CLIs.
 * Used by Hermes `profitslocal-lead-ops` skill + Discord-driven workflow.
 */

import fs from 'fs';
import path from 'path';

export const ROOT = process.cwd();
export const ENTITIES_DIR = path.join(ROOT, 'data', 'leads', 'entities');
export const DETAILED_DIR = path.join(ROOT, 'data', 'v2', 'fixtures', 'detailed-audit');

export function readEntity(entityKey) {
  const p = path.join(ENTITIES_DIR, `${entityKey}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function readDetailedAudit(entityKey) {
  const p = path.join(DETAILED_DIR, `${entityKey}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

export function listEntities() {
  if (!fs.existsSync(ENTITIES_DIR)) return [];
  return fs.readdirSync(ENTITIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readEntity(f.replace(/\.json$/, '')))
    .filter(Boolean);
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[k] = true;
      else { out[k] = next; i += 1; }
    } else out._.push(a);
  }
  return out;
}

export function die(reason, code = 1) {
  console.error(JSON.stringify({ ok: false, reason }, null, 2));
  process.exit(code);
}

export function emit(data) {
  console.log(JSON.stringify(data, null, 2));
}
