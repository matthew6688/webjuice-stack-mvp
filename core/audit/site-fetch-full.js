/**
 * Full site fetch via local Playwright headless Chromium.
 *
 * Used by detailed audit (Block D) when Tinyfish markdown is not enough —
 * we need raw HTML for DOM rules, performance metrics for Technical
 * dimension, and screenshots (desktop + mobile) for visual auditor (Block E).
 *
 * Cost: T0 (local Mac mini Chromium). Slower than Tinyfish (~10-20s per
 * site) but yields complete signal: rawHtml, mobileHtml, LCP, console
 * errors, sitemap probe, and screenshots saved to disk.
 *
 * Returns shape (matches detailed-audit.js fetchPayload contract):
 *   { url, finalUrl, markdown, rawHtml, mobileHtml,
 *     performance: { lcp, fcp, cwv, formSubmittable, consoleErrors },
 *     lighthouse: { mobile },     // approximation from perf metrics
 *     screenshots: { desktop, mobile },  // file paths
 *     sitemap: { hasSitemap, hasRobots },
 *     latencyMs }
 */

import fs from 'fs';
import path from 'path';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';
import { detectTechStack } from './tech-stack-detector.js';
import { analyzeSitemap } from './sitemap-analyzer.js';
import { auditActivity } from './activity-audit.js';
import { auditAiGeoReadiness } from './ai-geo-checks.js';
import { pagespeedAudit } from './pagespeed-insights.js';
import { auditFormsOnPage } from './form-audit.js';
import { auditDomainHistory } from './domain-history.js';
import { auditImageOptimization } from './image-optimization.js';
import { attachThirdPartyWeightInterceptor } from './third-party-weight.js';
import { auditTrustSignals } from './trust-signals/index.js';

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const NAV_TIMEOUT_MS = 45_000;
const SETTLE_MS = 3_000;

export async function siteFetchFull({
  url,
  screenshotDir,
  videoDir,                 // when set, records mobile-throttled loading video
  recordVideo = true,       // toggle off if caller doesn't want video
  niche,                    // passed to sitemap-analyzer for service/area classification
  ledgerPath,
  leadId,
  clientSlug,
  stage = 'detailed_audit',
  purpose = 'detailed_audit_full_fetch',
  campaignId,
} = {}) {
  const entityNiche = niche;
  if (!url) throw new Error('url is required');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const start = Date.now();

  let payload = { url };
  let consoleErrors = 0;

  try {
    // ─── Desktop pass ────────────────────────────────────────────────
    const desktopCtx = await browser.newContext({ viewport: DESKTOP_VIEWPORT, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
    const desktopPage = await desktopCtx.newPage();
    desktopPage.on('pageerror', () => { consoleErrors += 1; });
    desktopPage.on('console', (msg) => { if (msg.type() === 'error') consoleErrors += 1; });

    // ─── 3rd-party tracker / weight interceptor ──────────────────────
    // Must be attached BEFORE goto() so it captures all requests.
    const tpInterceptor = attachThirdPartyWeightInterceptor(desktopPage, url);

    const navStart = Date.now();
    const response = await desktopPage.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS }).catch(() => null);
    await desktopPage.waitForTimeout(SETTLE_MS);

    payload.finalUrl = desktopPage.url();
    payload.httpStatus = response?.status() || 0;

    // Performance metrics via Performance API
    const perf = await desktopPage.evaluate(() => {
      const navEntry = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find((p) => p.name === 'first-contentful-paint')?.startTime;
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lcpRaw = lcpEntries.length ? lcpEntries[lcpEntries.length - 1].startTime : null;
      // CLS approximation skipped (requires PerformanceObserver pre-load)
      return {
        fcp: fcp ? Math.round(fcp) : null,
        lcp: lcpRaw ? Math.round(lcpRaw) : null,
        loadEventEnd: navEntry?.loadEventEnd ? Math.round(navEntry.loadEventEnd) : null,
        domContentLoaded: navEntry?.domContentLoadedEventEnd ? Math.round(navEntry.domContentLoadedEventEnd) : null,
        transferSize: navEntry?.transferSize || null,
      };
    }).catch(() => ({}));

    payload.rawHtml = await desktopPage.content();
    payload.markdown = await markdownishExtract(desktopPage);
    payload.tech_stack = detectTechStack({ rawHtml: payload.rawHtml, finalUrl: payload.finalUrl });
    payload.form_audit = await auditFormsOnPage({ page: desktopPage }).catch(() => null);

    // ─── Image optimization (pure parse on already-fetched HTML) ─────
    payload.image_optimization = auditImageOptimization({ rawHtml: payload.rawHtml });

    // ─── Trust signals (industry-aware adapter; pure on rawHtml + md) ─
    payload.trust_signals = auditTrustSignals({
      rawHtml: payload.rawHtml,
      markdown: payload.markdown,
      niche: entityNiche,
    });

    // ─── 3rd-party weight (finalize interceptor; captured during goto) ─
    payload.third_party_weight = tpInterceptor.finalize();

    payload.performance = {
      lcp: perf.lcp != null ? perf.lcp / 1000 : null,           // seconds
      fcp: perf.fcp != null ? perf.fcp / 1000 : null,
      loadEventEnd: perf.loadEventEnd != null ? perf.loadEventEnd / 1000 : null,
      transferSizeBytes: perf.transferSize,
      consoleErrors,
      cwv: perf.lcp != null ? perf.lcp <= 2500 : null,           // simplified: LCP <= 2.5s = pass
      formSubmittable: await detectFormSubmittable(desktopPage),
    };

    // Approximate Lighthouse mobile score from page weight + LCP (rough heuristic)
    payload.lighthouse = { mobile: approxMobileScore(perf, payload.rawHtml) };

    // Screenshots
    if (screenshotDir) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      const desktopShot = path.join(screenshotDir, 'desktop.png');
      await desktopPage.screenshot({ path: desktopShot, fullPage: false });
      payload.screenshots = { desktop: desktopShot };
    }

    await desktopPage.close();
    await desktopCtx.close();

    // ─── Mobile pass (with throttled-network video recording) ────────
    const videoOutDir = videoDir || (screenshotDir ? path.join(screenshotDir, '..', 'video') : null);
    const wantVideo = recordVideo && videoOutDir;
    if (wantVideo) fs.mkdirSync(videoOutDir, { recursive: true });

    const mobileCtxOpts = {
      viewport: MOBILE_VIEWPORT,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    };
    if (wantVideo) {
      mobileCtxOpts.recordVideo = {
        dir: videoOutDir,
        size: { width: MOBILE_VIEWPORT.width, height: MOBILE_VIEWPORT.height },
      };
    }
    const mobileCtx = await browser.newContext(mobileCtxOpts);
    const mobilePage = await mobileCtx.newPage();

    // Emulate slow 4G network — gives operator/customer a clear "this is what
    // your visitors actually see" experience for the loading video.
    if (wantVideo) {
      try {
        const cdp = await mobileCtx.newCDPSession(mobilePage);
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: (1.6 * 1024 * 1024) / 8,  // 1.6 Mbps slow 4G
          uploadThroughput: (750 * 1024) / 8,
          latency: 150,                                 // 150ms RTT
        });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      } catch {}
    }

    await mobilePage.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS }).catch(() => null);
    await mobilePage.waitForTimeout(SETTLE_MS);
    payload.mobileHtml = await mobilePage.content();
    if (screenshotDir) {
      const mobileShot = path.join(screenshotDir, 'mobile.png');
      await mobilePage.screenshot({ path: mobileShot, fullPage: false });
      payload.screenshots = { ...payload.screenshots, mobile: mobileShot };
    }
    await mobilePage.close();
    await mobileCtx.close();

    // Video file is written when context closes — find it and rename to a
    // predictable filename so downstream report generator can embed it.
    if (wantVideo) {
      try {
        const files = fs.readdirSync(videoOutDir).filter((f) => f.endsWith('.webm'));
        if (files.length) {
          const newest = files.map((f) => ({ f, mtime: fs.statSync(path.join(videoOutDir, f)).mtimeMs })).sort((a, b) => b.mtime - a.mtime)[0].f;
          const dst = path.join(videoOutDir, 'mobile-throttled.webm');
          if (path.basename(newest) !== 'mobile-throttled.webm') {
            fs.renameSync(path.join(videoOutDir, newest), dst);
          }
          payload.video = { mobileThrottled: dst };
        }
      } catch {}
    }

    // ─── Sitemap + robots probe ──────────────────────────────────────
    const probeBase = new URL(payload.finalUrl || url);
    payload.sitemap = await Promise.all([
      probe(`${probeBase.origin}/sitemap.xml`),
      probe(`${probeBase.origin}/robots.txt`),
    ]).then(([s, r]) => ({ hasSitemap: s, hasRobots: r }));

    // ─── Deep sitemap analysis (page count, redirect plan) ──────────
    payload.sitemap_analysis = await analyzeSitemap({
      baseUrl: probeBase.origin,
      niche: entityNiche,
    }).catch(() => null);

    // ─── Activity / freshness audit (last_modified, blog dates, socials) ─
    payload.activity = await auditActivity({
      baseUrl: payload.finalUrl || url,
      rawHtml: payload.rawHtml,
      sitemapAnalysis: payload.sitemap_analysis,
    }).catch(() => null);

    // ─── AI / GEO readiness ──────────────────────────────────────────
    payload.ai_geo = await auditAiGeoReadiness({
      rawHtml: payload.rawHtml,
      markdown: payload.markdown,
      finalUrl: payload.finalUrl || url,
    }).catch(() => null);

    // ─── PageSpeed Insights (mobile + desktop) ──────────────────────
    if (process.env.PAGESPEED_API_KEY) {
      payload.pagespeed = await pagespeedAudit({
        url: payload.finalUrl || url,
        leadId, clientSlug, ledgerPath,
        stage: 'detailed_audit',
      }).catch(() => null);
    }

    // ─── Domain history (whois + Wayback + DNS for SPF/DMARC/DKIM) ──
    payload.domain_history = await auditDomainHistory({
      baseUrl: payload.finalUrl || url,
    }).catch(() => null);

  } finally {
    await browser.close();
  }

  payload.latencyMs = Date.now() - start;

  // Ledger entry — T0 free (local Chromium)
  if (ledgerPath || leadId || clientSlug) {
    const requestHash = await hashRequest({ provider: 'playwright', endpoint: 'site-fetch-full', url });
    appendLedgerEvent({
      type: 'cost',
      category: 'other',
      provider: 'playwright_local',
      tier: 'T0',
      leadId, clientSlug, stage, purpose,
      requestHash,
      campaignId,
      units: 1,
      unitCost: 0,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'site-fetch-full', url,
        final_url: payload.finalUrl,
        http_status: payload.httpStatus,
        raw_html_length: payload.rawHtml?.length || 0,
        mobile_html_length: payload.mobileHtml?.length || 0,
        lcp_seconds: payload.performance?.lcp,
        lighthouse_mobile_approx: payload.lighthouse?.mobile,
        latency_ms: payload.latencyMs,
        screenshots_saved: Boolean(payload.screenshots),
      },
    }, ledgerPath);
  }

  return payload;
}

async function markdownishExtract(page) {
  // Extract main text content as a markdown-like flat string.
  // Used by detailed-audit content rules and parity with Tinyfish output.
  return await page.evaluate(() => {
    const skip = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'];
    const lines = [];
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        const text = node.textContent.replace(/\s+/g, ' ').trim();
        if (text) lines.push(text);
        return;
      }
      if (node.nodeType !== 1) return;
      if (skip.includes(node.tagName)) return;
      const tag = node.tagName;
      if (/^H[1-6]$/.test(tag)) {
        const t = node.textContent.replace(/\s+/g, ' ').trim();
        if (t) { lines.push('\n' + '#'.repeat(Number(tag[1])) + ' ' + t + '\n'); return; }
      }
      for (const child of node.childNodes) walk(child);
      if (tag === 'P' || tag === 'LI' || tag === 'DIV') lines.push('');
    }
    walk(document.body);
    return lines.filter(Boolean).join('\n').slice(0, 50_000);
  }).catch(() => '');
}

async function detectFormSubmittable(page) {
  try {
    return await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      if (!forms.length) return null;
      // Has at least one form with non-disabled submit and action OR onsubmit
      return forms.some((f) => {
        const submitBtn = f.querySelector('button[type=submit], input[type=submit], button:not([type])');
        const hasAction = Boolean(f.action) || Boolean(f.getAttribute('onsubmit'));
        return submitBtn && hasAction;
      });
    });
  } catch {
    return null;
  }
}

function approxMobileScore(perf, html) {
  // Heuristic: viewport meta + LCP threshold + page weight
  if (!html) return null;
  let score = 50;
  if (/<meta[^>]+name=["']viewport["']/i.test(html)) score += 25;
  if (perf.lcp != null) {
    if (perf.lcp <= 2500) score += 15;
    else if (perf.lcp <= 4000) score += 5;
    else score -= 10;
  }
  if (perf.transferSize != null) {
    if (perf.transferSize < 1_000_000) score += 5;
    else if (perf.transferSize > 3_000_000) score -= 10;
  }
  return Math.max(0, Math.min(100, score));
}

async function probe(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok;
  } catch {
    return false;
  }
}
