#!/usr/bin/env node
/**
 * pl:publish-demo · M3 publish · push reference-adapter HTML to Cloudflare Pages
 *
 * Source:  clients/<slug>/v2/concept/reference-adapter/index.html + assets/
 * Target:  <slug>-dev.pages.dev (auto-created if not exists)
 *
 * Also includes ../customer-facing-audit.html in deploy (so the "Read full report"
 * banner link works on the live URL).
 *
 * Cost: $0 · Cloudflare Pages free tier (1 deploy unit each).
 *
 * Usage:
 *   npm run pl:publish-demo -- --slug <customer-slug>
 *
 * Env required:
 *   CF_API_TOKEN     - Cloudflare API token (Pages:Edit scope)
 *   CF_ACCOUNT_ID    - Cloudflare account ID
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const args = parseArgs(process.argv.slice(2));
const slug = args.slug;
if (!slug) {
  console.error('Usage: pl:publish-demo -- --slug <customer-slug>');
  process.exit(1);
}

const CF_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT = process.env.CF_ACCOUNT_ID;
if (!CF_TOKEN || !CF_ACCOUNT) {
  console.error('CF_API_TOKEN and CF_ACCOUNT_ID must be set in env');
  process.exit(1);
}

const adapterDir = path.join(REPO, 'clients', slug, 'v2', 'concept', 'reference-adapter');
const adapterHtml = path.join(adapterDir, 'index.html');
if (!fs.existsSync(adapterHtml)) {
  console.error(`reference-adapter HTML not found: ${adapterHtml}`);
  console.error(`  run: npm run pl:build-from-reference -- --slug ${slug}`);
  process.exit(1);
}

// Project name: <slug>-dev. CF Pages requires lowercase, hyphens, ≤58 chars.
const projectName = `${slug}-dev`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 58);

// Stage deploy dir: copy adapter HTML + assets + customer-facing-audit.html
const stageDir = path.join(REPO, 'data', 'qa', `cf-pages-stage-${slug}-${Date.now()}`);
fs.mkdirSync(stageDir, { recursive: true });

console.log(`[pl:publish-demo] slug:    ${slug}`);
console.log(`[pl:publish-demo] project: ${projectName}`);
console.log(`[pl:publish-demo] stage:   ${stageDir}`);

// 1. Copy adapter HTML (renamed to index.html at project root)
fs.copyFileSync(adapterHtml, path.join(stageDir, 'index.html'));

// 2. Copy assets dir
const adapterAssets = path.join(adapterDir, 'assets');
if (fs.existsSync(adapterAssets)) {
  const dest = path.join(stageDir, 'assets');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(adapterAssets)) {
    fs.copyFileSync(path.join(adapterAssets, f), path.join(dest, f));
  }
  console.log(`[pl:publish-demo] copied ${fs.readdirSync(adapterAssets).length} asset files`);
}

// 3. Copy customer-facing-audit.html (banner link target ../customer-facing-audit.html)
const customerAudit = path.join(REPO, 'clients', slug, 'v2', 'customer-facing-audit.html');
if (fs.existsSync(customerAudit)) {
  // adapter HTML uses href="../customer-facing-audit.html" — at the deployed root
  // we need both index.html (the demo) AND a customer-facing-audit.html accessible.
  // Strategy: put adapter HTML at /index.html and customer-audit at /audit/index.html,
  // then the banner link "../customer-facing-audit.html" resolves to root /customer-facing-audit.html.
  // Simpler: put customer-audit at /customer-facing-audit.html at root.
  fs.copyFileSync(customerAudit, path.join(stageDir, 'customer-facing-audit.html'));
  // Rewrite adapter HTML to use ./customer-facing-audit.html (sibling) instead of ../
  const html = fs.readFileSync(path.join(stageDir, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(stageDir, 'index.html'),
    html.replace(/\.\.\/customer-facing-audit\.html/g, './customer-facing-audit.html'));
  console.log(`[pl:publish-demo] included customer-facing-audit.html`);
}

// V3 D28 (2026-05-13) · 把 master.md (internal source-of-truth) + master.report.html
// 也部署到 CF Pages · 操作员/Matthew 能远程查任意 entity 完整 audit (含 Chinese version)
const masterMd = path.join(REPO, 'clients', slug, 'v2', 'master.md');
const masterReportHtml = path.join(REPO, 'clients', slug, 'v2', 'master.report.html');
const internalAuditHtml = path.join(REPO, 'clients', slug, 'v2', 'internal-audit-report.html');
if (fs.existsSync(masterMd)) {
  fs.copyFileSync(masterMd, path.join(stageDir, 'master.md'));
  console.log(`[pl:publish-demo] included master.md`);
}
if (fs.existsSync(masterReportHtml)) {
  fs.copyFileSync(masterReportHtml, path.join(stageDir, 'master.report.html'));
  console.log(`[pl:publish-demo] included master.report.html`);
}
if (fs.existsSync(internalAuditHtml)) {
  fs.copyFileSync(internalAuditHtml, path.join(stageDir, 'internal-audit-report.html'));
  console.log(`[pl:publish-demo] included internal-audit-report.html`);
}
// V3 (2026-05-14): include optimized internal audit (multi-round autoresearch)
// if pl:optimize-internal-report ran for this entity.
const optimizedHtml = path.join(REPO, 'clients', slug, 'v2', 'internal-audit-report.optimized.html');
if (fs.existsSync(optimizedHtml)) {
  fs.copyFileSync(optimizedHtml, path.join(stageDir, 'internal-audit-report.optimized.html'));
  console.log(`[pl:publish-demo] included internal-audit-report.optimized.html`);
}
// Also copy screenshots/evidence/video dirs so they render inline
for (const sub of ['screenshots', 'evidence', 'video']) {
  const srcDir = path.join(REPO, 'clients', slug, 'v2', sub);
  if (!fs.existsSync(srcDir)) continue;
  const destDir = path.join(stageDir, sub);
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir)) {
    fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  }
}

// 4. Try to create project (idempotent · ignore if exists)
console.log(`\n[pl:publish-demo] ensuring project exists...`);
const createRes = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/pages/projects`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: projectName,
      production_branch: 'main',
    }),
  }
);
const createBody = await createRes.json();
if (createRes.ok) {
  console.log(`[pl:publish-demo] ✓ project created`);
} else if (createBody?.errors?.[0]?.message?.includes('already exists')) {
  console.log(`[pl:publish-demo] ✓ project already exists · reusing`);
} else {
  console.error(`[pl:publish-demo] ✗ project create failed: ${JSON.stringify(createBody?.errors || createBody).slice(0, 500)}`);
  process.exit(1);
}

// 5. Deploy via wrangler CLI
console.log(`\n[pl:publish-demo] deploying ${stageDir} → ${projectName}.pages.dev\n`);
const env = {
  ...process.env,
  CLOUDFLARE_API_TOKEN: CF_TOKEN,
  CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT,
};
const proc = spawn('wrangler', [
  'pages', 'deploy', stageDir,
  '--project-name', projectName,
  '--branch', 'main',
  '--commit-dirty=true',
  '--commit-message', `pl-publish-demo ${slug} ${new Date().toISOString()}`,
], { env, stdio: 'inherit' });

proc.on('exit', async (code) => {
  if (code !== 0) {
    console.error(`\n[pl:publish-demo] ✗ wrangler exit ${code}`);
    process.exit(code || 1);
  }
  const url = `https://${projectName}.pages.dev`;
  console.log(`\n[pl:publish-demo] ✅ DONE`);
  console.log(`  Demo URL:           ${url}`);
  console.log(`  Customer audit URL: ${url}/customer-facing-audit.html`);
  console.log(`  master.md URL:      ${url}/master.md`);
  console.log(`  Internal HTML URL:  ${url}/internal-audit-report.html`);
  // Persist deploy record · cf-pages-deploy.json (legacy disk file for back-compat)
  // AND entity.deploy field (cycle-26 source-of-truth · triggers card refresh)
  const record = {
    slug, projectName,
    deployed_at: new Date().toISOString(),
    demo_url: url,
    audit_url: `${url}/customer-facing-audit.html`,
    master_md_url: `${url}/master.md`,
    internal_audit_url: `${url}/internal-audit-report.html`,
    master_report_url: `${url}/master.report.html`,
    stage_dir: stageDir,
  };
  const recordDir = path.join(REPO, 'clients', slug, 'v2', 'concept', 'reference-adapter');
  fs.writeFileSync(path.join(recordDir, 'cf-pages-deploy.json'), JSON.stringify(record, null, 2));
  console.log(`  Record:             ${path.join(recordDir, 'cf-pages-deploy.json')}`);

  // V3 D43 cycle-21 (Matthew 2026-05-15): post Stage 7 to lead thread BEFORE
  // graduate-to-projects (so #website-leads thread gets a final "published" msg).
  try {
    const entitiesDir = path.join(REPO, 'data/leads/entities');
    let foundKeyEarly = null;
    if (fs.existsSync(entitiesDir)) {
      for (const f of fs.readdirSync(entitiesDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const e = JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8'));
          const nm = e?.latest?.name || '';
          const s = String(nm).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          if (s === slug) { foundKeyEarly = f.replace(/\.json$/, ''); break; }
        } catch { /* skip */ }
      }
    }
    if (foundKeyEarly) {
      const { refreshThreadAndPost } = await import('../../core/funnel/lead-thread-sync.js');
      const { stage7Message } = await import('../../core/funnel/audit-stage-messages.js');
      const msg = stage7Message({ slug, deployUrl: url, deployedAt: record.deployed_at });
      await refreshThreadAndPost(foundKeyEarly, msg);
    }
  } catch (err) { console.warn(`[stage7] post failed: ${err.message}`); }

  // V3 D34 (2026-05-14): auto-graduate to #website-projects channel · idempotent
  // Find entity by slug → openProjectThread (skips if already open · returns same id)
  try {
    const entitiesDir = path.join(REPO, 'data/leads/entities');
    let foundKey = null;
    if (fs.existsSync(entitiesDir)) {
      for (const f of fs.readdirSync(entitiesDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const e = JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8'));
          const nm = e?.latest?.name || '';
          const s = String(nm).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          if (s === slug) { foundKey = f.replace(/\.json$/, ''); break; }
        } catch { /* skip */ }
      }
    }
    if (foundKey) {
      const { openProjectThread, upsertProjectProfileCard, appendThreadMessage, archiveAndLockThread } =
        await import('../../core/funnel/lead-thread-sync.js');
      const entity = JSON.parse(fs.readFileSync(path.join(entitiesDir, foundKey + '.json'), 'utf8'));
      const oldLeadThreadId = entity.discord_thread_id;

      // cycle-26 · write entity.deploy (source-of-truth · triggers writeEntity → card refresh)
      // + transition phase → outreach-active (also triggers card refresh).
      try {
        const entityPath = path.join(entitiesDir, foundKey + '.json');
        const e = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
        e.deploy = {
          demo_url: url,
          audit_url: `${url}/customer-facing-audit.html`,
          internal_audit_url: `${url}/internal-audit-report.html`,
          master_md_url: `${url}/master.md`,
          master_report_url: `${url}/master.report.html`,
          deployed_at: record.deployed_at,
        };
        const { writeEntity: writeE } = await import('../../core/leads/discovery-store.js');
        const { defaultDiscoveryStoreRoot } = await import('../../core/leads/discovery-store.js');
        writeE(defaultDiscoveryStoreRoot(), e);
        const { setEntityPhase, ENTITY_PHASE } = await import('../../core/leads/discovery-store.js');
        const pr = setEntityPhase({
          entityKey: foundKey,
          phase: ENTITY_PHASE.OUTREACH_ACTIVE,
          note: 'cycle-26 publish-done · graduate to #website-projects',
        });
        if (!pr.ok) console.warn(`[publish] setEntityPhase outreach-active failed: ${pr.reason}`);
      } catch (err) {
        console.warn(`[publish] entity.deploy write or setEntityPhase failed: ${err.message}`);
      }

      // cycle-26 · emit batch progress: published
      try {
        const { emitBatchProgress } = await import('../../core/funnel/batch-progress.js');
        await emitBatchProgress(foundKey, { event: 'published', deployUrl: url });
      } catch { /* non-blocking */ }

      const r = await openProjectThread(foundKey);
      if (r.ok) {
        console.log(`  #website-projects thread: ${r.reused ? 'reused' : 'opened'} ${r.threadId || ''}`);
        // cycle-26 · post Stage 9 publish-done message to PROJECTS thread (not just leads)
        // so customer-facing channel has the live URL + 4 hyperlinks visible.
        try {
          const { stage7Message } = await import('../../core/funnel/audit-stage-messages.js');
          await appendThreadMessage(
            r.threadId,
            stage7Message({ slug, deployUrl: url, deployedAt: record.deployed_at }),
          );
        } catch (err) { console.warn(`[publish] stage9 → projects failed: ${err.message}`); }
        if (r.reused) {
          try { await upsertProjectProfileCard(foundKey); console.log('  profile card refreshed'); } catch {}
          try {
            await appendThreadMessage(r.threadId,
              `🌐 **Demo 已重新发布** · ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC\n${url}`);
            console.log('  update message posted');
          } catch {}
        }

        // V3 D43 cycle-21 + cycle-26 race fix · 1 entity = 1 active thread.
        // BEFORE archive+lock the old leads thread · await renameThreadToCurrentTitle
        // so its title reflects current phase (otherwise locked thread can't rename).
        // Also await upsertProfileCard to flush the deferred hook.
        if (oldLeadThreadId && oldLeadThreadId !== r.threadId) {
          try {
            const { renameThreadToCurrentTitle, upsertProfileCard } =
              await import('../../core/funnel/lead-thread-sync.js');
            // Explicitly flush rename + card refresh BEFORE lock
            await renameThreadToCurrentTitle(foundKey).catch((e) =>
              console.warn(`  rename before lock failed (non-blocking): ${e.message}`));
            await upsertProfileCard(foundKey).catch(() => {});
            const projUrl = `https://discord.com/channels/${process.env.DISCORD_GUILD_ID || '1493925728570310756'}/${r.threadId}`;
            await archiveAndLockThread(oldLeadThreadId, {
              reason: `Graduated to #website-projects · 后续看 ${projUrl}`,
            });
            console.log(`  archived old leads thread ${oldLeadThreadId} · graduated to projects`);
          } catch (err) {
            console.warn(`  archive old leads thread failed: ${err.message}`);
          }
        }
      } else {
        console.log(`  #website-projects thread: skip · ${r.reason}`);
      }
    }
  } catch (err) {
    console.warn(`  #website-projects hook 失败 (不阻塞 publish): ${err.message}`);
  }

  // cycle-26 · pipeline-end summary message · fix-of-record
  // Posts comprehensive checklist to BOTH old leads thread (before archive)
  // and new projects thread. operator trusts THIS message · not profile card.
  try {
    const { buildPipelineSummary } = await import('../../core/funnel/pipeline-summary.js');
    const { verifyAssetsRemote } = await import('../../core/reports/asset-integrity.js');
    const entitiesDir = path.join(REPO, 'data/leads/entities');
    let foundKey = null;
    for (const f of fs.readdirSync(entitiesDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8'));
        const s = String(e?.latest?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (s === slug) { foundKey = f.replace(/\.json$/, ''); break; }
      } catch {}
    }
    if (foundKey) {
      const e = JSON.parse(fs.readFileSync(path.join(entitiesDir, foundKey + '.json'), 'utf8'));
      // Asset stats from disk
      const clientV2 = path.join(REPO, 'clients', slug, 'v2');
      function fileBytes(p) { try { return fs.statSync(p).size; } catch { return 0; } }
      function countFiles(dir, ext) {
        try { return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).length; } catch { return 0; }
      }
      const assets = {
        master_md_bytes: fileBytes(path.join(clientV2, 'master.md')),
        master_md_sections: ((fs.readFileSync(path.join(clientV2, 'master.md'), 'utf8').match(/^## /gm) || []).length) || 0,
        master_report_bytes: fileBytes(path.join(clientV2, 'master.report.html')),
        internal_audit_bytes: fileBytes(path.join(clientV2, 'internal-audit-report.html')),
        customer_audit_bytes: fileBytes(path.join(clientV2, 'customer-facing-audit.html')),
        screenshot_count: countFiles(path.join(clientV2, 'screenshots'), '.png'),
        evidence_count: countFiles(path.join(clientV2, 'evidence'), '.png'),
        video_present: fs.existsSync(path.join(clientV2, 'video', 'mobile-throttled.webm')),
        cloudinary_upload_count: 0,
      };
      try {
        const cm = JSON.parse(fs.readFileSync(path.join(clientV2, 'cloudinary-manifest.json'), 'utf8'));
        assets.cloudinary_upload_count = Object.keys(cm.evidenceUrls || {}).length + (cm.videoUrl ? 1 : 0) + Object.keys(cm.screenshotUrls || {}).length;
      } catch {}

      // Integrity check (remote HTTP HEAD)
      let integrity = null;
      try {
        const md = fs.readFileSync(path.join(clientV2, 'master.md'), 'utf8');
        integrity = await verifyAssetsRemote({ md, baseUrl: url });
      } catch (err) {
        console.warn(`[pipeline-summary] integrity check failed: ${err.message}`);
      }

      const summary = buildPipelineSummary({
        entity: e,
        assets,
        integrity,
        cost: { firecrawl_usd: 0, vision_llm_usd: 0, ai_brief_usd: 0 },
        duration_sec: null,
      });

      // Post to project thread + old leads thread + ORIGINAL task thread (#website-tasks)
      // so operator who launched the task sees the fix-of-record summary too.
      const { appendThreadMessage } = await import('../../core/funnel/lead-thread-sync.js');
      const targets = [
        e.project_thread_id,
        e.discord_thread_id,
        process.env.PL_PARENT_THREAD_ID, // original task thread in #website-tasks
      ].filter(Boolean);
      // de-dup (no point posting twice)
      const uniq = [...new Set(targets)];
      for (const tid of uniq) {
        try { await appendThreadMessage(tid, summary); } catch {}
      }
      console.log(`  pipeline summary posted to ${uniq.length} thread(s) · ${uniq.join(', ')}`);
    }
  } catch (err) {
    console.warn(`  pipeline summary post failed: ${err.message}`);
  }
});

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
