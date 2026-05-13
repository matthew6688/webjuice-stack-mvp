#!/usr/bin/env node
/**
 * pl:archive-non-customer-entities · 把非真客户的 entity 移到 _archive/
 *
 * Why: SOP-1 压测沉淀了大量测试 entity · 让 funnel doctor 看不到真信号。
 *       清理后 entities/ 只保留 10 个真客户 · 干净 state · 真客户的 master.md
 *       + audit assets + M3 live URL 全不动 (在 clients/<slug>/v2/ 下)。
 *
 * Safe ops (default · dry-run):
 *   - 列出 keepers + archive 候选
 *   - 不动任何文件
 *
 * Apply (--apply):
 *   - 移 entity JSON 到 data/leads/_archive/non-customer-<ISO>/entities/
 *   - 不删 master.md / audit assets / discovery-events 历史
 *   - 不动 dedup-decisions.json (那是历史决策留底 · 有训练价值)
 *   - 不动 finance/ledger.jsonl (成本审计)
 *   - 移动后 doctor 重跑应该 funnel 干净
 *
 * Usage:
 *   npm run pl:archive-non-customer-entities                # dry-run
 *   npm run pl:archive-non-customer-entities -- --apply     # 实际移动
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENTITIES_DIR = path.join(REPO, 'data/leads/entities');

// 10 真客户 slug 白名单 (实测自 clients/<slug>/v2/master.md 全在)
const KEEP_SLUGS = new Set([
  'brisbane-roof-restoration-experts',
  'brisbane-roofing-solutions-roof-restoration-repairs',
  'diamond-roof-tiling-restoration',
  'fix-my-roof-total-roof-restorations',
  'gutter-and-roof-repairs',
  'hurricane-digital-seo-brisbane',
  'queensland-roofing-pty-ltd',
  'roof-space-renovators',
  'roofshield-roof-restorations',
  'weatherproof-restorations',
]);

function slugify(n) {
  return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Scan entities
const files = fs.readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.json')).sort();
const keepers = [];
const archive = [];

for (const f of files) {
  const filePath = path.join(ENTITIES_DIR, f);
  let entity;
  try { entity = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { archive.push({ key: f.replace(/\.json$/, ''), reason: 'unparseable' }); continue; }

  const name = entity?.latest?.name || '';
  const slug = slugify(name);
  const key = f.replace(/\.json$/, '');

  if (KEEP_SLUGS.has(slug)) {
    keepers.push({ key, slug, name });
  } else {
    archive.push({ key, slug, name });
  }
}

console.log('\n=== KEEPERS · 真客户 entity (留) ===');
console.log(`count: ${keepers.length}`);
for (const k of keepers) {
  console.log(`  ${k.key.padEnd(48)} → ${k.slug.padEnd(48)} (${k.name})`);
}

console.log('\n=== ARCHIVE 候选 (移到 _archive/) ===');
console.log(`count: ${archive.length}`);

// Summary by type
const byType = {};
for (const a of archive) {
  const t = a.key.split('_')[0];
  byType[t] = (byType[t] || 0) + 1;
}
console.log('  by key prefix:', byType);

const noMaster = archive.filter((a) => {
  const slug = a.slug || slugify(a.name);
  return !fs.existsSync(path.join(REPO, 'clients', slug, 'v2/master.md'));
}).length;
console.log(`  无 master.md (stubs): ${noMaster}`);
console.log(`  有 master.md (intake artifacts): ${archive.length - noMaster}`);

if (!APPLY) {
  console.log('\n[DRY-RUN] 仅列举 · 不动文件 · 加 --apply 实际归档');
  process.exit(0);
}

// Apply
const iso = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const archiveDir = path.join(REPO, 'data/leads/_archive', `non-customer-${iso}`, 'entities');
fs.mkdirSync(archiveDir, { recursive: true });

let moved = 0, failed = 0;
for (const a of archive) {
  const src = path.join(ENTITIES_DIR, `${a.key}.json`);
  const dst = path.join(archiveDir, `${a.key}.json`);
  try {
    fs.renameSync(src, dst);
    moved++;
  } catch (err) {
    console.error(`  ✗ ${a.key}: ${err.message}`);
    failed++;
  }
}

// Write manifest
const manifest = {
  archived_at: new Date().toISOString(),
  reason: 'V3 D33 (2026-05-14): 留 10 真客户 · clean state for funnel doctor signal',
  kept_count: keepers.length,
  archived_count: moved,
  failed_count: failed,
  kept_keys: keepers.map((k) => ({ key: k.key, slug: k.slug, name: k.name })),
  archived_keys: archive.map((a) => ({ key: a.key, slug: a.slug, name: a.name })),
  recovery_command: `mv ${archiveDir}/*.json ${ENTITIES_DIR}/`,
};
fs.writeFileSync(path.join(path.dirname(archiveDir), 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

console.log(`\n[APPLIED]`);
console.log(`  moved:    ${moved}`);
console.log(`  failed:   ${failed}`);
console.log(`  archive:  ${archiveDir}`);
console.log(`  manifest: ${path.dirname(archiveDir)}/MANIFEST.json`);
console.log(`  recovery: ${manifest.recovery_command}`);
console.log(`\n  next:`);
console.log(`    1. rebuild discovery-index (TODO 若有 CLI · 或手动 node 一行)`);
console.log(`    2. npm run pl:lead-journey-doctor  → 应该 entities=${keepers.length}`);
