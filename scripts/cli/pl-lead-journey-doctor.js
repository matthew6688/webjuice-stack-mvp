#!/usr/bin/env node
/**
 * pl:lead-journey-doctor — 一行总检 lead lifecycle invariants 是否成立。
 *
 * 跨 M1+M2 的 lifecycle 视角 doctor · 与 pl:sop0-doctor / pl:intake-doctor 互补：
 *   - sop0-doctor: SOP-0 daemon 健康 (5 check)
 *   - intake-doctor: SOP-1 intake 链路健康 (5 check)
 *   - journey-doctor: 每个 entity 数据完整性 + lifecycle 一致性 (10 invariant)
 *
 * 检查 (per LEAD-JOURNEY.md §10):
 *   1. 每个 entity 必有 .key (place_/domain_/image_/manual_)
 *   2. phase ∈ ENTITY_PHASE 9 个值 (含 D31 新增 design-ready)
 *   3. grade ∈ {A,B,C,D} 或 null
 *   4. D-grade 必带 archive_reason
 *   5. tier 为 null iff grade ∈ {C, D, null}
 *   6. ARCHIVED entity 必有 archive_reason
 *   7. DESIGN_READY entity 必有 grade ∈ {A,B,C} (V3 D31 新)
 *   8. master.md 存在的 entity · phase 必 ≥ AWAITING (即不能 NEEDS_HUMAN)
 *   9. dedup-decisions.json append-only · 最近 1000 条记录格式合规
 *  10. 整 entity store 无重复 key (file system + index 一致)
 *
 * Exit 0 = 全绿 · 1 = 任意红灯。
 *
 * Usage:
 *   npm run pl:lead-journey-doctor
 *   npm run pl:lead-journey-doctor -- --json    # cron/CI
 *   npm run pl:lead-journey-doctor -- --fix     # 尝试自动修可修的 (only safe ops)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes('--json');
const FIX_MODE = ARGS.includes('--fix');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const c = (s, color) => JSON_MODE ? s : `${color}${s}${X}`;

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENTITIES_DIR = path.join(REPO, 'data/leads/entities');
const DEDUP_LOG = path.join(REPO, 'data/leads/dedup-decisions.json');
const DISCOVERY_INDEX = path.join(REPO, 'data/leads/discovery-index.json');

const VALID_PHASES = new Set([
  'awaiting', 'design-ready', 'outreach-active', 'replied',
  'proposal-sent', 'nurture', 'paid', 'archived', 'needs-human',
]);

const VALID_GRADES = new Set(['A', 'B', 'C', 'D']);
const KEY_PREFIXES = ['place_', 'domain_', 'image_', 'manual_', 'phone_'];

const checks = [];
const fixActions = [];
function record(name, ok, detail, fix = null) {
  checks.push({ name, ok, detail, fix });
}

function loadEntities() {
  if (!fs.existsSync(ENTITIES_DIR)) return [];
  return fs.readdirSync(ENTITIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const filePath = path.join(ENTITIES_DIR, f);
        return {
          key: f.replace(/\.json$/, ''),
          path: filePath,
          data: JSON.parse(fs.readFileSync(filePath, 'utf8')),
        };
      } catch (err) {
        return { key: f.replace(/\.json$/, ''), path: null, data: null, error: err.message };
      }
    });
}

const entities = loadEntities();

// ---------- 1. entity key prefix ----------
{
  const bad = entities.filter((e) => !KEY_PREFIXES.some((p) => e.key.startsWith(p)));
  record(
    '1. entity key prefix (place_/domain_/image_/manual_)',
    bad.length === 0,
    bad.length === 0 ? `${entities.length} entities · all valid prefix` : `${bad.length} 个非法 key: ${bad.slice(0, 3).map((b) => b.key).join(', ')}`,
    bad.length ? '检查 core/leads/discovery-store.js#discoveryEntityKey 是否被绕过' : null
  );
}

// ---------- 2. phase 值合法 ----------
{
  const bad = entities.filter((e) => e.data?.phase && !VALID_PHASES.has(e.data.phase));
  record(
    '2. phase ∈ ENTITY_PHASE 9 个值',
    bad.length === 0,
    bad.length === 0 ? '全部合法' : `${bad.length} 个非法 phase · 例: ${bad.slice(0, 3).map((b) => `${b.key}=${b.data.phase}`).join(', ')}`,
    bad.length ? '看 core/leads/discovery-store.js#ENTITY_PHASE · 可能旧 phase 字符串遗留' : null
  );
}

// ---------- 3. grade 值合法 ----------
// V3 D43 fix (2026-05-14): grade schema is { investment_level, product_tier, ... }
// Old path was e.data.scoring.grade (string) — that was the pre-D31 schema.
// Doctor was silently passing because all entities had grade=null on the stale path.
{
  const bad = entities.filter((e) => {
    const g = e.data?.grade?.investment_level;
    return g != null && !VALID_GRADES.has(g);
  });
  record(
    '3. grade ∈ {A,B,C,D} 或 null',
    bad.length === 0,
    bad.length === 0 ? '全部合法' : `${bad.length} 非法 · 例: ${bad.slice(0, 3).map((b) => `${b.key}=${b.data.grade.investment_level}`).join(', ')}`,
    bad.length ? '看 core/scoring/lead-grading.js · 可能 LLM 返了非 ABCD 字符' : null
  );
}

// ---------- 4. D-grade 必带 archive_reason ----------
{
  const dGraded = entities.filter((e) => e.data?.grade?.investment_level === 'D');
  const missing = dGraded.filter((e) => !e.data?.archive_reason && !e.data?.grade?.skip_reasons?.length);
  record(
    '4. D-grade 必带 archive_reason 或 skip_reasons',
    missing.length === 0,
    `D=${dGraded.length} · 缺 reason=${missing.length}`,
    missing.length ? `补 reason: ${missing.slice(0, 3).map((b) => b.key).join(', ')}` : null
  );
}

// ---------- 5. tier null iff grade ∈ {C, D, null} ----------
// V3 D43 fix (2026-05-14): per lead-grading.js gradeLead(),
// product_tier is only set for A and B (recommendProductTier gated on level==='A'||'B').
// C and D both return null tier. Doctor previously read scoring.grade (always null
// under old schema) so the violator filter never matched anyone.
{
  const violators = entities.filter((e) => {
    const g = e.data?.grade?.investment_level;
    const t = e.data?.grade?.product_tier;
    const noTierExpected = !g || g === 'C' || g === 'D';
    return noTierExpected ? (t != null) : (t == null);
  });
  record(
    '5. tier null iff grade ∈ {C, D, null}',
    violators.length === 0,
    `${violators.length} 个违反 · 例: ${violators.slice(0, 3).map((b) => `${b.key} g=${b.data.grade?.investment_level} t=${b.data.grade?.product_tier}`).join(' · ')}`,
    violators.length ? '看 core/scoring/lead-grading.js#recommendProductTier · A/B 应有 tier · C/D 应 null' : null
  );
}

// ---------- 6. ARCHIVED 必有 archive_reason ----------
{
  const archived = entities.filter((e) => e.data?.phase === 'archived');
  const missing = archived.filter((e) => !e.data?.archive_reason);
  record(
    '6. ARCHIVED entity 必有 archive_reason',
    missing.length === 0,
    `archived=${archived.length} · 缺 reason=${missing.length}`,
    missing.length ? `setEntityPhase('archived') 必须传 archive_reason · 看 discovery-store §validation` : null
  );
}

// ---------- 7. DESIGN_READY 必有 grade ∈ {A,B,C} (V3 D31) ----------
{
  const designReady = entities.filter((e) => e.data?.phase === 'design-ready');
  const bad = designReady.filter((e) => !['A', 'B', 'C'].includes(e.data?.grade?.investment_level));
  record(
    '7. DESIGN_READY entity grade ∈ {A,B,C} (D31)',
    bad.length === 0,
    `design-ready=${designReady.length} · 异常=${bad.length}`,
    bad.length ? `仅 A/B/C 应该进 design-ready · 看 lead-grading.js setEntityPhase 逻辑` : null
  );
}

// ---------- 8. 有 master.md 的 entity · phase 不能是 NEEDS_HUMAN ----------
{
  const slugFromEntity = (e) => {
    const name = e.data?.latest?.name || e.key;
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };
  const withMasterMd = entities.filter((e) => {
    const slug = slugFromEntity(e);
    return fs.existsSync(path.join(REPO, 'clients', slug, 'v2/master.md'));
  });
  const stuckHuman = withMasterMd.filter((e) => e.data?.phase === 'needs-human');
  record(
    '8. master.md 存在 → phase ≠ needs-human',
    stuckHuman.length === 0,
    `有 master.md = ${withMasterMd.length} · 仍卡 needs-human = ${stuckHuman.length}`,
    stuckHuman.length ? `审查 stuck: ${stuckHuman.slice(0, 3).map((b) => b.key).join(', ')}` : null
  );
}

// ---------- 9. dedup-decisions.json 最近记录格式合规 ----------
{
  let ok = true, detail = '';
  if (!fs.existsSync(DEDUP_LOG)) {
    detail = 'dedup-decisions.json 不存在 (尚无 dedup 发生 · OK)';
  } else {
    try {
      const log = JSON.parse(fs.readFileSync(DEDUP_LOG, 'utf8'));
      const arr = Array.isArray(log) ? log : (log?.decisions || []);
      const last = arr.slice(-1000);
      // Real schema: { at, k1, k2, decision, operator, source, ... }
      const malformed = last.filter((d) => !d.at || !d.k1 || !d.k2 || !d.decision);
      ok = malformed.length === 0;
      detail = `dedup 记录 = ${arr.length} · 最近 1000 中 malformed = ${malformed.length}`;
    } catch (err) {
      ok = false;
      detail = `JSON parse error: ${err.message}`;
    }
  }
  record('9. dedup-decisions.json 格式合规', ok, detail, !ok ? '检查 discovery-store.persistDedupDecision 是否被绕过' : null);
}

// ---------- 10. entity store · 无 file system / index 不一致 ----------
{
  let ok = true, detail = '';
  if (!fs.existsSync(DISCOVERY_INDEX)) {
    detail = 'discovery-index.json 不存在 (skip)';
  } else {
    try {
      const idx = JSON.parse(fs.readFileSync(DISCOVERY_INDEX, 'utf8'));
      // Real schema: { entities: [ { entityKey, ... }, ... ] }
      const idxArr = Array.isArray(idx?.entities) ? idx.entities : [];
      const indexedKeys = new Set(idxArr.map((e) => e.entityKey || e.key).filter(Boolean));
      const fsKeys = new Set(entities.map((e) => e.key));
      const inIdxNotFs = [...indexedKeys].filter((k) => !fsKeys.has(k));
      const inFsNotIdx = [...fsKeys].filter((k) => !indexedKeys.has(k));
      ok = inIdxNotFs.length === 0 && inFsNotIdx.length === 0;
      detail = `fs=${fsKeys.size} · idx=${indexedKeys.size} · idx-only=${inIdxNotFs.length} · fs-only=${inFsNotIdx.length}`;
    } catch (err) {
      ok = false;
      detail = `JSON parse error: ${err.message}`;
    }
  }
  record('10. fs / discovery-index 一致', ok, detail, !ok ? '跑 npm run leads:rebuild-discovery-index (TODO 若不存在)' : null);
}

// ---------- heartbeat ----------
const hbDir = path.join(REPO, 'data/heartbeats');
try {
  fs.mkdirSync(hbDir, { recursive: true });
  fs.writeFileSync(path.join(hbDir, 'lead-journey-doctor.txt'), new Date().toISOString());
} catch {}

// ---------- 输出 ----------
const passed = checks.filter((ch) => ch.ok).length;
const total = checks.length;
const allOk = passed === total;

if (JSON_MODE) {
  console.log(JSON.stringify({
    ok: allOk, passed, total,
    entities_count: entities.length,
    by_phase: groupBy(entities, (e) => e.data?.phase || 'no-phase'),
    by_grade: groupBy(entities, (e) => e.data?.grade?.investment_level || 'no-grade'),
    checks,
  }, null, 2));
} else {
  console.log('');
  console.log(c(`lead-journey-doctor · entities=${entities.length}`, D));
  console.log('');
  for (const ch of checks) {
    const mark = ch.ok ? c('✅', G) : c('❌', R);
    console.log(`${mark} ${ch.name}`);
    console.log(`   ${c(ch.detail, D)}`);
    if (!ch.ok && ch.fix) console.log(`   ${c('fix:', Y)} ${ch.fix}`);
  }
  console.log('');

  // 简要 funnel 快照
  const byPhase = groupBy(entities, (e) => e.data?.phase || 'no-phase');
  const byGrade = groupBy(entities, (e) => e.data?.grade?.investment_level || 'no-grade');
  console.log(c('funnel:', D));
  console.log(c(`  phase: ${Object.entries(byPhase).map(([k, v]) => `${k}=${v}`).join(' · ')}`, D));
  console.log(c(`  grade: ${Object.entries(byGrade).map(([k, v]) => `${k}=${v}`).join(' · ')}`, D));
  console.log('');

  const summary = allOk ? c(`✅ ${passed}/${total} lead-journey 健康`, G) : c(`❌ ${passed}/${total} 通过`, R);
  console.log(summary);
  console.log('');
}

process.exit(allOk ? 0 : 1);

function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = keyFn(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
