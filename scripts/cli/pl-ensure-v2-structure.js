#!/usr/bin/env node
/**
 * M2-D10 · Ensure v2/ folder structure for a customer slug.
 *
 * Creates:
 *   clients/<slug>/v2/sales/.gitkeep
 *   clients/<slug>/v2/marketing/.gitkeep
 *   clients/<slug>/v2/outreach/.gitkeep
 *   clients/<slug>/v2/funnel/.gitkeep
 *   clients/<slug>/v2/intake/.gitkeep
 *   clients/<slug>/v2/audit/  (symlink to data/v2/fixtures/ if available, else empty dir)
 *
 * Pattern A customers (flat root layout, e.g. opa-bar-mezze-restaurant,
 * rich-and-rare-restaurant) are NOT migrated.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const PATTERN_A_SLUGS = new Set([
  'opa-bar-mezze-restaurant',
  'rich-and-rare-restaurant',
]);

const REQUIRED_SUBDIRS = ['sales', 'marketing', 'outreach', 'funnel', 'intake'];

export async function ensureV2Structure(slug) {
  if (!slug) throw new Error('slug required');
  if (PATTERN_A_SLUGS.has(slug)) {
    return { ok: true, skipped: 'pattern-a', slug };
  }
  const v2 = path.join(REPO_ROOT, 'clients', slug, 'v2');
  fs.mkdirSync(v2, { recursive: true });
  for (const sub of REQUIRED_SUBDIRS) {
    const dir = path.join(v2, sub);
    fs.mkdirSync(dir, { recursive: true });
    const keep = path.join(dir, '.gitkeep');
    if (!fs.existsSync(keep)) fs.writeFileSync(keep, '');
  }

  // audit/ — try symlink to data/v2/fixtures; fall back to plain dir.
  const auditDir = path.join(v2, 'audit');
  const fixtures = path.join(REPO_ROOT, 'data', 'v2', 'fixtures');
  if (!fs.existsSync(auditDir)) {
    if (fs.existsSync(fixtures)) {
      try {
        fs.symlinkSync(fixtures, auditDir, 'dir');
      } catch {
        fs.mkdirSync(auditDir, { recursive: true });
      }
    } else {
      fs.mkdirSync(auditDir, { recursive: true });
    }
  }
  return { ok: true, slug, created: REQUIRED_SUBDIRS.length };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  let slug = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slug') slug = args[++i];
    else if (!args[i].startsWith('--')) slug = args[i];
  }
  if (!slug) { console.error('usage: pl-ensure-v2-structure --slug <slug>'); process.exit(1); }
  ensureV2Structure(slug).then((r) => console.log(JSON.stringify(r, null, 2))).catch((err) => {
    console.error(err.message); process.exit(1);
  });
}
