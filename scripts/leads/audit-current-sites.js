#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';
import { createSiteAudit, renderSiteAuditMarkdown, sanitizeHtmlSnapshot } from '../../core/leads/site-audit.js';

const args = parseArgs(process.argv.slice(2));
const stage = args.stage || 'ready_for_mockup';
const clientList = String(args.clients || args.client || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const limit = Number(args.limit || 20);
const publicRoot = args['public-root'] || args.publicRoot || 'public/admin-artifacts';

const index = loadLeadOutreachIndex();
const selected = index.records
  .filter((record) => clientList.length ? clientList.includes(record.clientSlug) : record.pipelineStage === stage)
  .filter((record) => record.officialWebsiteUrl || record.websiteUrl)
  .slice(0, limit);

const browser = await chromium.launch({ headless: true });
const results = [];
for (const record of selected) {
  const result = await auditRecord(browser, record, { publicRoot });
  results.push(result);
}
await browser.close();

console.log(JSON.stringify({
  ok: results.every((result) => result.ok),
  count: results.length,
  results,
}, null, 2));

async function auditRecord(browser, record, { publicRoot }) {
  const auditUrl = record.officialWebsiteUrl || record.websiteUrl;
  const auditRecord = {
    ...record,
    websiteUrl: auditUrl,
  };
  const auditDir = path.join('clients', record.clientSlug, 'audit');
  const publicDir = path.join(publicRoot, record.clientSlug);
  fs.mkdirSync(auditDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  const desktopPath = path.join(auditDir, 'current-site-desktop.png');
  const mobilePath = path.join(auditDir, 'current-site-mobile.png');
  const publicDesktopPath = path.join(publicDir, 'current-site-desktop.png');
  const publicMobilePath = path.join(publicDir, 'current-site-mobile.png');
  const publicHtmlPath = path.join(publicDir, 'current-site.html');
  const publicTextPath = path.join(publicDir, 'current-site-text.txt');
  const publicJsonPath = path.join(publicDir, 'current-site-audit.json');
  const publicMdPath = path.join(publicDir, 'current-site-audit.md');
  const htmlPath = path.join(auditDir, 'current-site.html');
  const textPath = path.join(auditDir, 'current-site-text.txt');
  const jsonPath = path.join(auditDir, 'current-site-audit.json');
  const mdPath = path.join(auditDir, 'current-site-audit.md');

  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  let facts = null;
  try {
    await page.goto(auditUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: desktopPath, fullPage: true });
    fs.copyFileSync(desktopPath, publicDesktopPath);
    const html = sanitizeHtmlSnapshot(await page.content());
    fs.writeFileSync(htmlPath, html, 'utf8');
    fs.copyFileSync(htmlPath, publicHtmlPath);
    facts = await page.evaluate(() => {
      const isSocialHref = (value) => {
        try {
          const hostname = new URL(String(value || '')).hostname.replace(/^www\./, '').toLowerCase();
          return [
            'instagram.com',
            'facebook.com',
            'linkedin.com',
            'tiktok.com',
            'youtube.com',
            'x.com',
            'twitter.com',
            'wa.me',
            'whatsapp.com',
          ].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
        } catch {
          return false;
        }
      };
      const text = document.body?.innerText || '';
      const links = [...document.querySelectorAll('a')].map((link) => ({
        text: (link.textContent || '').trim().slice(0, 80),
        href: link.href || '',
      })).filter((link) => link.text || link.href).slice(0, 80);
      const socialLinks = links
        .filter((link) => isSocialHref(link.href))
        .map((link) => ({ label: link.text || link.href, url: link.href }))
        .slice(0, 20);
      const contactPageCandidates = links
        .filter((link) => /contact|enquiry|quote|get.?in.?touch|booking|book|estimate/i.test(`${link.text} ${link.href}`))
        .map((link) => link.href)
        .filter(Boolean)
        .slice(0, 10);
      const sameAs = [];
      for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')]) {
        try {
          const parsed = JSON.parse(script.textContent || '{}');
          const values = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of values) {
            const links = Array.isArray(item.sameAs) ? item.sameAs : [];
            sameAs.push(...links.filter(Boolean));
          }
        } catch {}
      }
      const headings = [...document.querySelectorAll('h1,h2,h3')].map((node) => (node.textContent || '').trim()).filter(Boolean).slice(0, 30);
      const buttons = [...document.querySelectorAll('button,a')].map((node) => (node.textContent || '').trim()).filter(Boolean).slice(0, 80);
      const images = [...document.querySelectorAll('img')].map((img) => ({
        alt: img.hasAttribute('alt') ? img.alt : undefined,
        src: img.currentSrc || img.src || '',
      })).slice(0, 40);
      const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
      const property = (name) => document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || '';
      const jsonLdTypes = [];
      for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')]) {
        try {
          const parsed = JSON.parse(script.textContent || '{}');
          const values = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of values) {
            const type = item['@type'];
            if (Array.isArray(type)) jsonLdTypes.push(...type);
            else if (type) jsonLdTypes.push(type);
          }
        } catch {}
      }
      return {
        title: document.title || '',
        text,
        headings,
        links,
        socialLinks,
        contactPageCandidates,
        sameAs,
        buttons,
        images,
        seo: {
          title: document.title || '',
          metaDescription: meta('description'),
          canonical: document.querySelector('link[rel="canonical"]')?.href || '',
          robotsMeta: meta('robots'),
          htmlLang: document.documentElement?.getAttribute('lang') || '',
          h1s: [...document.querySelectorAll('h1')].map((node) => (node.textContent || '').trim()).filter(Boolean),
          jsonLdTypes: [...new Set(jsonLdTypes.map((value) => String(value || '').trim()).filter(Boolean))],
          og: {
            title: property('og:title'),
            description: property('og:description'),
            image: property('og:image'),
            type: property('og:type'),
            url: property('og:url'),
          },
          twitter: {
            card: meta('twitter:card'),
            title: meta('twitter:title'),
            description: meta('twitter:description'),
            image: meta('twitter:image'),
          },
        },
      };
    });
    fs.writeFileSync(textPath, facts.text, 'utf8');
    fs.copyFileSync(textPath, publicTextPath);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(auditUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: mobilePath, fullPage: true });
    fs.copyFileSync(mobilePath, publicMobilePath);
  } catch (error) {
    await page.close();
    const failed = {
      ok: false,
      clientSlug: record.clientSlug,
      websiteUrl: auditUrl,
      error: error.message,
      jsonPath,
    };
    writeJson(jsonPath, failed);
    return failed;
  }
  await page.close();

  const audit = createSiteAudit({ record: auditRecord, facts, artifacts: {
    desktopPath,
    mobilePath,
    publicDesktopUrl: `/${path.relative('public', publicDesktopPath)}`,
    publicMobileUrl: `/${path.relative('public', publicMobilePath)}`,
    publicHtmlUrl: `/${path.relative('public', publicHtmlPath)}`,
    publicTextUrl: `/${path.relative('public', publicTextPath)}`,
    publicAuditJsonUrl: `/${path.relative('public', publicJsonPath)}`,
    publicAuditUrl: `/${path.relative('public', publicMdPath)}`,
    htmlPath,
    textPath,
    jsonPath,
    mdPath,
  } });
  writeJson(jsonPath, audit);
  writeJson(publicJsonPath, audit);
  fs.writeFileSync(mdPath, renderSiteAuditMarkdown(audit), 'utf8');
  fs.copyFileSync(mdPath, publicMdPath);
  return {
    ok: true,
    clientSlug: record.clientSlug,
    websiteUrl: auditUrl,
    verdict: audit.verdict,
    score: audit.score,
    salesDecision: audit.salesDecision,
    opportunityConfidence: audit.opportunityConfidence,
    jsonPath,
    mdPath,
    desktopPath,
    mobilePath,
    publicDesktopUrl: audit.artifacts.publicDesktopUrl,
    publicMobileUrl: audit.artifacts.publicMobileUrl,
    publicAuditUrl: audit.artifacts.publicAuditUrl,
    publicTextUrl: audit.artifacts.publicTextUrl,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    parsed[key] = value;
    if (value !== true) i += 1;
  }
  return parsed;
}
