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
let buf = '';
proc.stdout.on('data', (chunk) => { buf += chunk.toString(); process.stderr.write('.'); });
proc.on('exit', async (code) => {
  process.stderr.write('\n');
  if (code !== 0) {
    console.error(`claude CLI exit ${code}`);
    process.exit(code || 1);
  }
  const docIdx = buf.toLowerCase().indexOf('<!doctype html');
  const cleaned = docIdx > 0 ? buf.slice(docIdx) : buf;
  fs.writeFileSync(outHtml, cleaned);
  const took = Math.round((Date.now() - start) / 1000);
  console.log(`\n[pl:build-from-reference] DONE · ${cleaned.length} bytes · ${took}s · ${outHtml}`);

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
        input: { text: `auto: publish demo for ${slugArg} (after build)`, attachments: [] },
        target: { cli: 'pl:publish-demo', args: ['--slug', slugArg], timeout_ms: 300_000 },
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
