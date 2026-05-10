#!/usr/bin/env node
/**
 * Build internal audit report HTML for one or more leads.
 *
 * Loads cheap-audit-v2 + detailed-audit (from fixtures dir) and writes
 * a self-contained HTML report to clients/<slug>/v2/internal-audit-report.html.
 *
 * Usage:
 *   npm run leads:build-internal-report -- --entity-key place_xxx
 *   npm run leads:build-internal-report -- --all
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cheapAuditV2 } from '../../core/scoring/cheap-audit-v2.js';
import { renderInternalAuditHtml } from '../../core/reports/internal-audit-html.js';
import { captureIssueEvidence } from '../../core/audit/issue-evidence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const args = parseArgs(process.argv.slice(2));
const entitiesDir = path.join(repoRoot, 'data/leads/entities');
const detailedDir = path.join(repoRoot, 'data/v2/fixtures/detailed-audit');
const screenshotsRoot = path.join(detailedDir, 'screenshots');
const visualResultsRoot = path.join(repoRoot, 'data/v2/fixtures/visual-autoresearch');

let targets = [];
if (args.all) {
  targets = fs.readdirSync(detailedDir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('ledger-'))
    .map((f) => f.replace(/\.json$/, ''));
} else if (args['entity-key']) {
  targets = [args['entity-key']];
} else {
  console.error('Usage: --entity-key <key> OR --all');
  process.exit(1);
}

console.log(`[build-internal-report] targets=${targets.length}`);

const captureEvidence = args['capture-evidence'] !== false && args['no-evidence'] !== true;

const written = [];
for (const entityKey of targets) {
  const entityPath = path.join(entitiesDir, `${entityKey}.json`);
  if (!fs.existsSync(entityPath)) {
    console.warn(`[skip] no entity: ${entityKey}`);
    continue;
  }
  const entity = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
  const slugRoot = slug(entity.latest?.name || entityKey);
  const clientV2Dir = path.join(repoRoot, 'clients', slugRoot, 'v2');
  fs.mkdirSync(clientV2Dir, { recursive: true });

  const cheapAudit = cheapAuditV2({ entity, sourceQuery: entity.latest?.sourceQuery });

  let detailedAudit = null;
  const detailedPath = path.join(detailedDir, `${entityKey}.json`);
  if (fs.existsSync(detailedPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(detailedPath, 'utf8'));
      detailedAudit = raw.detailed_audit || null;
    } catch {}
  }

  // Try to find visual_audit fixture (Block E output, may not yet exist)
  const visualAudit = findLatestVisualAudit(entityKey, visualResultsRoot);

  // Copy screenshots into client v2 dir for self-contained HTML
  const srcShotDir = path.join(screenshotsRoot, entityKey);
  const dstShotDir = path.join(clientV2Dir, 'screenshots');
  if (fs.existsSync(srcShotDir)) {
    fs.mkdirSync(dstShotDir, { recursive: true });
    for (const f of fs.readdirSync(srcShotDir)) {
      fs.copyFileSync(path.join(srcShotDir, f), path.join(dstShotDir, f));
    }
  }

  // Per-issue evidence + mobile-throttled video. T0 (local Playwright).
  let evidenceById = {};
  let videoRel = null;
  const websiteUrl = entity.latest?.website;
  if (captureEvidence && websiteUrl && detailedAudit) {
    const evidenceDir = path.join(clientV2Dir, 'evidence');
    const videoDir = path.join(clientV2Dir, 'video');
    try {
      const out = await captureForLead({ url: websiteUrl, detailedAudit, visualAudit, evidenceDir, videoDir });
      evidenceById = out.evidenceById;
      // Make evidence paths relative to the HTML location
      for (const id of Object.keys(evidenceById)) {
        const ev = evidenceById[id];
        if (ev?.path) ev.relPath = `evidence/${path.basename(ev.path)}`;
      }
      if (out.videoPath) videoRel = `video/${path.basename(out.videoPath)}`;
    } catch (err) {
      console.warn(`  ⚠ evidence capture failed: ${err.message}`);
    }
  }

  const html = renderInternalAuditHtml({
    entity, cheapAudit, detailedAudit, visualAudit,
    screenshotDir: 'screenshots',
    evidenceById,
    videoUrl: videoRel,
  });
  const outPath = path.join(clientV2Dir, 'internal-audit-report.html');
  fs.writeFileSync(outPath, html);

  // Also publish under public/ so Astro serves it at /audit-reports/<entityKey>/...
  const publicDir = path.join(repoRoot, 'public/audit-reports', entityKey);
  fs.mkdirSync(path.join(publicDir, 'screenshots'), { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'internal-audit-report.html'), html);
  if (fs.existsSync(srcShotDir)) {
    for (const f of fs.readdirSync(srcShotDir)) {
      fs.copyFileSync(path.join(srcShotDir, f), path.join(publicDir, 'screenshots', f));
    }
  }
  // Copy evidence + video into public/
  for (const sub of ['evidence', 'video']) {
    const src = path.join(clientV2Dir, sub);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(publicDir, sub);
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      fs.copyFileSync(path.join(src, f), path.join(dst, f));
    }
  }

  written.push({ entityKey, slug: slugRoot, path: outPath, public_url: `/audit-reports/${entityKey}/internal-audit-report.html`, hasDetailed: Boolean(detailedAudit), hasVisual: Boolean(visualAudit) });
  console.log(`  ✓ ${entity.latest?.name?.slice(0, 50)} → ${path.relative(repoRoot, outPath)}${detailedAudit ? '' : ' [cheap-only]'}${visualAudit ? ' +visual' : ''}`);
}

console.log('\n' + JSON.stringify({ ok: true, count: written.length, written }, null, 2));

function findLatestVisualAudit(entityKey, root) {
  if (!fs.existsSync(root)) return null;
  const runs = fs.readdirSync(root).sort().reverse();
  for (const run of runs) {
    const runDir = path.join(root, run);
    if (!fs.statSync(runDir).isDirectory()) continue;
    // Each run has subdirs per candidate; we want the consensus / preferred candidate
    // For now take qwen3.6 if present, else first non-error
    const candDirs = fs.readdirSync(runDir).filter((d) => fs.statSync(path.join(runDir, d)).isDirectory());
    // Prefer qwen-nothink over gemma3: qwen honestly admits blank/insufficient inputs;
    // gemma3 was observed hallucinating 4 issues on a blank screenshot. See
    // docs/v2/autoresearch-results/visual-auditor.md for the comparison.
    const preferOrder = ['ollama-qwen3.6-27b-nothink', 'ollama-qwen3.6-27b', 'ollama-gemma3-27b'];
    const ordered = [...preferOrder.filter((p) => candDirs.includes(p)), ...candDirs.filter((d) => !preferOrder.includes(d))];
    for (const cand of ordered) {
      const candFile = path.join(runDir, cand, `${entityKey}.json`);
      if (fs.existsSync(candFile)) {
        try {
          const r = JSON.parse(fs.readFileSync(candFile, 'utf8'));
          if (r.parsedJson) return r.parsedJson;
        } catch {}
      }
    }
  }
  return null;
}

async function captureForLead({ url, detailedAudit, visualAudit, evidenceDir, videoDir }) {
  const issues = [
    ...(detailedAudit.issues?.critical || []).map((i) => ({ ...i, severity: 'critical' })),
    ...(detailedAudit.issues?.major || []).map((i) => ({ ...i, severity: 'major' })),
    ...((visualAudit?.issues || []).map((i) => ({ ...i, severity: i.severity || 'major' }))),
  ];
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(videoDir, { recursive: true });

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  let evidenceById = {};
  let videoPath = null;
  try {
    // Mobile context with video + throttled network
    const mobileCtx = await browser.newContext({
      viewport: { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      recordVideo: { dir: videoDir, size: { width: 375, height: 667 } },
    });
    const mobilePage = await mobileCtx.newPage();
    try {
      const cdp = await mobileCtx.newCDPSession(mobilePage);
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
        latency: 150,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    } catch {}
    await mobilePage.goto(url, { waitUntil: 'load', timeout: 45_000 }).catch(() => null);
    await mobilePage.waitForTimeout(3000);
    await mobilePage.close();
    await mobileCtx.close();

    const videos = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'));
    if (videos.length) {
      const newest = videos.map((f) => ({ f, m: fs.statSync(path.join(videoDir, f)).mtimeMs })).sort((a, b) => b.m - a.m)[0].f;
      const dst = path.join(videoDir, 'mobile-throttled.webm');
      if (newest !== 'mobile-throttled.webm') fs.renameSync(path.join(videoDir, newest), dst);
      videoPath = dst;
    }

    // Desktop context for per-issue cropped screenshots
    if (issues.length) {
      const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const desktopPage = await desktopCtx.newPage();
      const navResp = await desktopPage.goto(url, { waitUntil: 'load', timeout: 45_000 }).catch(() => null);
      await desktopPage.waitForTimeout(2000);

      // Detect broken/blank sites: HTTPS hang, blank body, near-empty render.
      // For these, every cropped screenshot would just be empty white — replace
      // with a single "site failed to load" evidence type instead.
      const pageState = await desktopPage.evaluate(() => ({
        textLen: (document.body?.innerText || '').trim().length,
        scrollH: document.documentElement.scrollHeight,
        title: document.title,
      })).catch(() => ({ textLen: 0, scrollH: 0, title: '' }));
      const httpStatus = navResp?.status() || 0;
      const isBroken = pageState.textLen < 50 || pageState.scrollH < 200 || (httpStatus && httpStatus >= 400);

      if (isBroken) {
        const reasonBits = [];
        if (httpStatus >= 400) reasonBits.push(`HTTP ${httpStatus}`);
        if (pageState.textLen < 50) reasonBits.push(`仅 ${pageState.textLen} 字符正文`);
        if (pageState.scrollH < 200) reasonBits.push(`页面高度 ${pageState.scrollH}px`);
        const reason = reasonBits.join(' · ') || '站点未渲染任何内容';
        for (const issue of issues) {
          evidenceById[issue.id] = {
            type: 'broken-site',
            label: '站点加载失败 — 客户在浏览器里看到空白页',
            reason,
          };
        }
      } else {
        const results = await captureIssueEvidence({ page: desktopPage, issues, outputDir: evidenceDir });
        for (const r of results) evidenceById[r.id] = r.evidence;
      }
      await desktopPage.close();
      await desktopCtx.close();
    }
  } finally {
    await browser.close();
  }
  return { evidenceById, videoPath };
}

function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    out[k] = v;
  }
  return out;
}
