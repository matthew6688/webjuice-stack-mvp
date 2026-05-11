#!/usr/bin/env node
/**
 * Block 3.2 — One-time migration: register existing artifacts into per-client
 * asset manifest (clients/<slug>/assets/manifest.json).
 *
 * Scans graded entities and for each:
 *   1. Resolves clientSlug = entity.promotedClientSlug || slugify(entity.latest.name)
 *   2. Looks for these existing files and registers them as assets:
 *      - clients/<slug>/v2/master.md                       → type=document
 *      - clients/<slug>/v2/internal-audit-report.html      → type=report
 *      - data/v2/fixtures/detailed-audit/screenshots/<entityKey>/desktop.png  → type=screenshot
 *      - data/v2/fixtures/detailed-audit/screenshots/<entityKey>/mobile.png   → type=screenshot
 *
 * The migration is idempotent — addAsset upserts by id, so re-running is safe.
 * File contents are NOT moved or copied; manifest just registers their existing paths.
 *
 * Usage:
 *   node scripts/leads/migrate-existing-assets.js [--limit N] [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { addAsset, readManifest } from '../../core/leads/asset-manifest.js';

const argv = process.argv.slice(2);
const limit = (() => {
  const i = argv.indexOf('--limit');
  return i >= 0 ? Number(argv[i + 1]) : Infinity;
})();
const dryRun = argv.includes('--dry-run');

const ROOT = process.cwd();
const ENTITIES_DIR = path.join(ROOT, 'data', 'leads', 'entities');
const SCREENSHOTS_DIR = path.join(ROOT, 'data', 'v2', 'fixtures', 'detailed-audit', 'screenshots');

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function resolveClientSlug(entity) {
  return entity.promotedClientSlug || slugify(entity.latest?.name || '');
}

const entities = fs.readdirSync(ENTITIES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8')))
  .filter((e) => e.grade?.investment_level);

const summary = { scanned: 0, clients_touched: 0, assets_registered: 0, missing_client_dir: 0, missing_files: [] };
const detail = [];

for (const entity of entities.slice(0, limit)) {
  summary.scanned += 1;
  const slug = resolveClientSlug(entity);
  if (!slug) continue;
  const clientDir = path.join(ROOT, 'clients', slug);
  if (!fs.existsSync(clientDir)) {
    summary.missing_client_dir += 1;
    detail.push({ entityKey: entity.entityKey, slug, status: 'missing_client_dir' });
    continue;
  }

  const v2Dir = path.join(clientDir, 'v2');
  const candidates = [
    {
      id: 'master-md',
      type: 'document',
      label: 'Master MD',
      absolutePath: path.join(v2Dir, 'master.md'),
      localPath: 'v2/master.md',
    },
    {
      id: 'internal-audit-report',
      type: 'report',
      label: 'Internal audit report',
      absolutePath: path.join(v2Dir, 'internal-audit-report.html'),
      localPath: 'v2/internal-audit-report.html',
    },
    {
      id: 'screenshot-desktop',
      type: 'screenshot',
      label: '现状首页 - 桌面',
      absolutePath: path.join(SCREENSHOTS_DIR, entity.entityKey, 'desktop.png'),
      // Screenshots live outside the client dir — store an absolute-ish hint
      localPath: path.relative(clientDir, path.join(SCREENSHOTS_DIR, entity.entityKey, 'desktop.png')),
      tags: ['audit-evidence', 'hero'],
    },
    {
      id: 'screenshot-mobile',
      type: 'screenshot',
      label: '现状首页 - 移动',
      absolutePath: path.join(SCREENSHOTS_DIR, entity.entityKey, 'mobile.png'),
      localPath: path.relative(clientDir, path.join(SCREENSHOTS_DIR, entity.entityKey, 'mobile.png')),
      tags: ['audit-evidence'],
    },
  ];

  const entityDetail = { entityKey: entity.entityKey, slug, registered: [], missing: [] };
  let touched = false;
  for (const c of candidates) {
    if (!fs.existsSync(c.absolutePath)) {
      entityDetail.missing.push(c.id);
      summary.missing_files.push(`${slug}/${c.id}`);
      continue;
    }
    if (!dryRun) {
      addAsset(slug, {
        id: c.id,
        type: c.type,
        label: c.label,
        localPath: c.localPath,
        tags: c.tags,
        entityKey: entity.entityKey,
      });
    }
    entityDetail.registered.push(c.id);
    summary.assets_registered += 1;
    touched = true;
  }
  if (touched) summary.clients_touched += 1;
  detail.push(entityDetail);
}

console.log(JSON.stringify({
  ok: true,
  dry_run: dryRun,
  summary,
  per_entity: detail,
}, null, 2));
