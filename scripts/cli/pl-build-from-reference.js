#!/usr/bin/env node
/**
 * pl:build-from-reference · M3 default V3 handoff path
 *
 * Take a real customer (slug or entity-key), build the reference-adapter
 * prompt via core/leads/reference-adapter-handoff.js, pipe it to claude CLI,
 * write the adapted HTML + copy of locked assets to:
 *
 *   clients/<slug>/v2/concept/reference-adapter/index.html
 *   clients/<slug>/v2/concept/reference-adapter/assets/   (5 PNGs)
 *
 * Cost: ~$0.30 (sonnet-4-5 · ~57k input + ~12k output tokens · ~3 min)
 *
 * Usage:
 *   npm run pl:build-from-reference -- --slug <customer-slug>
 *   npm run pl:build-from-reference -- --slug brisbane-roof-restoration-experts
 *   npm run pl:build-from-reference -- --slug fix-my-roof-total-roof-restorations --model claude-sonnet-4-5
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { buildAdapterPayload } from '../../core/leads/reference-adapter-handoff.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const args = parseArgs(process.argv.slice(2));
const slug = args.slug;
if (!slug) {
  console.error('Usage: pl:build-from-reference -- --slug <customer-slug> [--model claude-sonnet-4-5]');
  process.exit(1);
}

const masterMdPath = path.join(REPO, 'clients', slug, 'v2', 'master.md');
const entityFile = pickEntityFile(slug);
if (!entityFile) {
  console.error(`No entity file found for slug ${slug}. Looked at clients/<slug>/v2/master.md frontmatter business_id.`);
  process.exit(1);
}
const entity = JSON.parse(fs.readFileSync(entityFile, 'utf8'));
const audit = readAudit(entity.entityKey);
const masterMd = fs.existsSync(masterMdPath) ? fs.readFileSync(masterMdPath, 'utf8') : null;

const payload = buildAdapterPayload({
  slug,
  entity,
  audit,
  masterMd,
  niche: args.niche,
  family: args.family,
});

const outDir = path.join(REPO, 'clients', slug, 'v2', 'concept', 'reference-adapter');
fs.mkdirSync(outDir, { recursive: true });
const outHtml = path.join(outDir, 'index.html');
const outAssets = path.join(outDir, 'assets');
fs.mkdirSync(outAssets, { recursive: true });
for (const f of fs.readdirSync(payload.assetsDir)) {
  fs.copyFileSync(path.join(payload.assetsDir, f), path.join(outAssets, f));
}

console.log(`[pl:build-from-reference] slug:    ${slug}`);
console.log(`[pl:build-from-reference] entity:  ${entity.entityKey}`);
console.log(`[pl:build-from-reference] family:  ${payload.family}`);
console.log(`[pl:build-from-reference] out:     ${outHtml}`);
console.log(`[pl:build-from-reference] prompt:  ${payload.prompt.length} chars\n`);

const model = args.model || process.env.PL_REFERENCE_ADAPTER_MODEL || 'claude-sonnet-4-5';
const start = Date.now();
const proc = spawn('claude', ['-p', payload.prompt, '--model', model], { stdio: ['ignore', 'pipe', 'inherit'] });

// cycle-27 bug #2 (Matthew 2026-05-15): hard timeout for claude -p · prevents
// entity stuck in ready-to-build · KPI gate stalls. If timeout hits · archive
// entity as terminal failure so KPI can fire + operator sees the failure.
const BUILD_TIMEOUT_MS = parseInt(process.env.PL_BUILD_TIMEOUT_MS || (10 * 60 * 1000), 10);
let timedOut = false;
const buildTimer = setTimeout(() => {
  timedOut = true;
  console.error(`[pl:build-from-reference] BUILD TIMEOUT (${BUILD_TIMEOUT_MS}ms) · killing claude -p`);
  try { proc.kill('SIGKILL'); } catch {}
}, BUILD_TIMEOUT_MS);

let buf = '';
proc.stdout.on('data', (chunk) => { buf += chunk.toString(); process.stderr.write('.'); });
proc.on('exit', async (code) => {
  clearTimeout(buildTimer);
  process.stderr.write('\n');
  if (timedOut || code !== 0) {
    console.error(`claude CLI ${timedOut ? 'TIMED OUT' : `exit ${code}`} · archiving entity as build-failed`);
    // cycle-27 bug #2: archive entity so chain doesn't stall
    try {
      if (entity?.entityKey) {
        const { archiveLeadAsRejected } = await import('../../core/leads/terminal-archive.js');
        await archiveLeadAsRejected(entity.entityKey, {
          reason: timedOut ? `claude -p timed out after ${BUILD_TIMEOUT_MS}ms` : `claude -p exit ${code}`,
          pathId: 'stage8_build_failed',
          layer: 'Stage 8',
        });
      }
    } catch (err) {
      console.error(`[pl:build-from-reference] archive on build-fail failed: ${err.message}`);
    }
    process.exit(code || 1);
  }
  const docIdx = buf.toLowerCase().indexOf('<!doctype html');
  const cleaned = docIdx > 0 ? buf.slice(docIdx) : buf;
  fs.writeFileSync(outHtml, cleaned);
  const took = Math.round((Date.now() - start) / 1000);
  console.log(`\n[pl:build-from-reference] DONE · ${cleaned.length} bytes · ${took}s · ${outHtml}`);

  // cycle-27 Phase 4 (Matthew 2026-05-15): write build-summary.json for
  // Stage 8 message · surfaces "用哪个 reference 模板改的 + 多大 + 用了多少素材"
  try {
    const assetsCopied = (() => {
      try { return fs.readdirSync(outAssets).length; } catch { return 0; }
    })();
    const summary = {
      slug,
      entity_key: entity?.entityKey || null,
      business_name: entity?.latest?.name || null,
      family: payload?.family || null,
      html_bytes: cleaned.length,
      duration_sec: took,
      assets_copied: assetsCopied,
      index_html_path: path.relative(REPO, outHtml),
      built_at: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(REPO, 'clients', slug, 'v2', 'build-summary.json'),
      JSON.stringify(summary, null, 2));
    console.log(`[pl:build-from-reference] build-summary.json written`);
  } catch (err) {
    console.warn(`[pl:build-from-reference] build-summary write failed: ${err.message}`);
  }

  // V3 D43 cycle-21 (Matthew 2026-05-15): post Stage 8 message to entity thread.
  // cycle-27 Phase 5: capture message_id + persist to entity for Stage 9 retro-edit.
  const entityKeyForMsg = entity?.entityKey;
  if (entityKeyForMsg) {
    try {
      const { refreshThreadAndPost } = await import('../../core/funnel/lead-thread-sync.js');
      const { stage6Message } = await import('../../core/funnel/audit-stage-messages.js');
      const msg = stage6Message({ slug, indexHtmlPath: outHtml.replace(REPO + '/', ''), sizeBytes: cleaned.length });
      const r = await refreshThreadAndPost(entityKeyForMsg, msg);
      if (r?.msg?.messageId) {
        try {
          // cycle-27 bug #5: lock-protected r-m-w on entity file
          const { mutateEntity } = await import('../../core/leads/discovery-store.js');
          await mutateEntity(entityKeyForMsg, (e) => {
            e.discord_stage_message_ids = e.discord_stage_message_ids || {};
            e.discord_stage_message_ids[8] = r.msg.messageId;
          });
        } catch { /* best-effort · don't block chain */ }
      }
    } catch (err) { console.warn(`[stage8] post failed: ${err.message}`); }
  }

  // V3 D43 cycle-18 (Matthew 2026-05-14): auto-chain publish-demo AFTER build done.
  // Previously cycle-15 chained build + publish in parallel · publish raced ahead
  // and failed (no index.html yet). Now serialize: build script enqueues publish
  // at its own end · guaranteed sequential.
  if (process.env.SKIP_AUTO_PUBLISH !== '1') {
    try {
      const { createTask } = await import('../../core/tasks/task-store.js');
      const t = createTask({
        kind: 'ops',
        source: { platform: 'internal', thread_id: process.env.PL_PARENT_THREAD_ID || null, author: 'pl:build-from-reference auto-chain', message_id: null },
        input: { text: `auto: publish demo for ${slug} (after build)`, attachments: [] },
        target: { cli: 'pl:publish-demo', args: ['--slug', slug], timeout_ms: 300_000 },
      });
      console.log(`[pl:build-from-reference] ✓ chained publish task: ${t.task_id}`);
    } catch (err) {
      console.error(`[pl:build-from-reference] auto-publish enqueue failed: ${err.message}`);
    }
  }
});

function pickEntityFile(slugArg) {
  // Prefer master.md frontmatter business_id when available; fallback to scanning.
  const mdPath = path.join(REPO, 'clients', slugArg, 'v2', 'master.md');
  if (fs.existsSync(mdPath)) {
    const head = fs.readFileSync(mdPath, 'utf8').slice(0, 600);
    const m = head.match(/business_id:\s*"([^"]+)"/);
    if (m && m[1]) {
      const f = path.join(REPO, 'data', 'leads', 'entities', `${m[1]}.json`);
      if (fs.existsSync(f)) return f;
    }
  }
  // Fallback: pick any entity matching slug-like prefix
  const dir = path.join(REPO, 'data', 'leads', 'entities');
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).find(name => name.toLowerCase().includes(slugArg.toLowerCase()));
  return f ? path.join(dir, f) : null;
}

function readAudit(entityKey) {
  const auditPath = path.join(REPO, 'data', 'v2', 'fixtures', 'detailed-audit', `${entityKey}.json`);
  if (!fs.existsSync(auditPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    return raw.detailed_audit || raw;
  } catch { return null; }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 2) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[k] = true; continue; }
    out[k] = next; i++;
  }
  return out;
}
