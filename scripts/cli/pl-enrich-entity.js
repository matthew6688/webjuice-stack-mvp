#!/usr/bin/env node
/**
 * pl:enrich-entity · single entity 跑 4 路 enrichment + 写回 entity.enrichment.* + 可选重生 master.md
 *
 * Usage:
 *   npm run pl:enrich-entity -- --entity-key <key> [--render]
 *   npm run pl:enrich-entity -- --all-active [--render]
 *   npm run pl:enrich-entity -- --entity-key <key> --dry-run     # plan only · 0 write / 0 paid call
 *
 * `--render` 会调 leads:build-master-md 重生 master.md (含新加的"公司注册 · 域名"段)
 * `--dry-run` 列出目标 + planned provider · skip enrichEntity() · skip writes (Codex Response 11)
 *
 * 设计原则 (V3-ENRICHMENT-PLAN):
 * - 全 additive · enrichment 失败不阻塞写盘 (entity.enrichment._meta.trace 记录)
 * - LOCKED 字段直接复制 · 不经 LLM 中转
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { enrichEntity } from '../../core/enrichment/index.js';
import { lookupLicense } from '../../core/enrichment/license-lookup.js';

const REPO = process.cwd();
const ENTITIES_DIR = path.join(REPO, 'data/leads/entities');
const ACTIVE_PHASES = new Set(['ready-to-build', 'outreach-active', 'replied', 'proposal-sent', 'nurture', 'paid', 'qa-pending', 'audit-ready']);

function args() {
  const out = {}; const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2); const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) out[k] = true; else { out[k] = v; i += 1; }
  }
  return out;
}

function die(msg) { console.error(`pl:enrich-entity: ${msg}`); process.exit(1); }

async function run() {
  const a = args();
  const targets = [];
  if (a['entity-key']) {
    const f = path.join(ENTITIES_DIR, `${a['entity-key']}.json`);
    if (!fs.existsSync(f)) die(`entity not found: ${a['entity-key']}`);
    targets.push(a['entity-key']);
  } else if (a['all-active']) {
    for (const f of fs.readdirSync(ENTITIES_DIR)) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8'));
        if (ACTIVE_PHASES.has(e.phase)) targets.push(f.replace('.json', ''));
      } catch { /* skip */ }
    }
  } else {
    die('Usage: --entity-key <key> | --all-active  [--render]');
  }

  const DRY_RUN = !!a['dry-run'];
  console.log(`pl:enrich-entity · ${targets.length} target(s) · ABR_GUID=${process.env.ABR_GUID ? 'set' : 'missing'}${DRY_RUN ? ' · DRY-RUN (no spend · no writes)' : ''}\n`);
  const summary = [];

  for (const key of targets) {
    const filePath = path.join(ENTITIES_DIR, `${key}.json`);
    const before = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const name = before.latest?.name || key;

    if (DRY_RUN) {
      // List planned providers based on entity state · DO NOT call enrichEntity()
      const hasPlaceId = !!before.identifiers?.place_id;
      const hasDomain = !!before.identifiers?.domain || !!before.latest?.website;
      const planned = [];
      if (hasPlaceId) planned.push('places-details');
      if (hasDomain) planned.push('whois-rdap', 'wayback', 'tinyfish-search', 'abn-lookup');
      console.log(`▶ ${name} (${key.slice(0, 32)}...) · [DRY-RUN]`);
      console.log(`    planned providers: ${planned.length ? planned.join(', ') : '(none · no place_id/domain)'}`);
      summary.push({ key, name, ok: true, dry_run: true, planned });
      continue;
    }

    process.stdout.write(`▶ ${name} (${key.slice(0, 32)}...) ... `);
    const start = Date.now();
    try {
      const enriched = await enrichEntity(before);
      fs.writeFileSync(filePath, JSON.stringify(enriched, null, 2) + '\n');

      // License lookup (Phase 1.3 wire-in · non-blocking)
      // Only run if entity doesn't already have a fresh license result
      // (skip if looked_up_at is within 30 days to avoid redundant DB queries)
      try {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const existingLookup = enriched.license?.looked_up_at;
        const isStale = !existingLookup || (Date.now() - Date.parse(existingLookup) > thirtyDaysMs);
        if (isStale) {
          const licResult = await lookupLicense(enriched, { repoRoot: REPO });
          if (licResult) {
            enriched.license = licResult;
            fs.writeFileSync(filePath, JSON.stringify(enriched, null, 2) + '\n');
          }
        }
      } catch (err) {
        console.warn(`  ⚠ license lookup failed: ${err.message}`);
      }

      const m = enriched.enrichment?._meta || {};
      const dur = Date.now() - start;
      console.log(`✓ ${m.sources_succeeded || 0}/${m.sources_attempted || 0} sources · ${dur}ms`);
      summary.push({ key, name, ok: true, sources: `${m.sources_succeeded}/${m.sources_attempted}`, latency_ms: dur });
    } catch (err) {
      console.log(`✗ ${err.message}`);
      summary.push({ key, name, ok: false, error: err.message });
    }
  }

  // Optional re-render master.md
  if (a.render) {
    console.log(`\n[render] re-running leads:build-master-md ...`);
    const keys = summary.filter((s) => s.ok).map((s) => s.key);
    if (keys.length === 0) {
      console.log(`  (no enriched entities to render)`);
    } else {
      // Use existing build-master-md.js · supports --entity-key one at a time
      for (const key of keys) {
        const r = spawnSync('node', ['--env-file-if-exists=.env.local', 'scripts/leads/build-master-md.js',
          '--entity-key', key, '--theme', 'report', '--html'],
          { cwd: REPO, encoding: 'utf8', timeout: 60_000 });
        if (r.status !== 0) console.warn(`  ⚠ render fail ${key}: ${r.stderr?.slice(0, 100)}`);
        else console.log(`  ✓ ${key}`);
      }
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`SUMMARY`);
  console.log(`══════════════════════════════════════`);
  for (const s of summary) {
    if (s.ok) console.log(`  ✓ ${s.name.padEnd(40)} ${s.sources} · ${s.latency_ms}ms`);
    else console.log(`  ✗ ${s.name.padEnd(40)} ${s.error}`);
  }
  const okCount = summary.filter((s) => s.ok).length;
  console.log(`\n${okCount}/${summary.length} entities enriched`);
  process.exit(okCount === summary.length ? 0 : 1);
}

run().catch((err) => { console.error('FATAL:', err.message); process.exit(2); });
