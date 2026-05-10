#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import {
  buildDiscoveryQueues,
  loadDiscoveryEntities,
  updateDiscoveryEntityStatus,
} from '../../core/leads/discovery-store.js';
import { createSiteAudit, renderSiteAuditMarkdown, sanitizeHtmlSnapshot } from '../../core/leads/site-audit.js';

const args = parseArgs(process.argv.slice(2));
const storeRoot = path.resolve(args['store-root'] || args.storeRoot || path.join('data', 'leads'));
const limit = Number(args.limit || 3);
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const entityKeys = String(args['entity-key'] || args.entityKey || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const queues = buildDiscoveryQueues({ storeRoot, limit: Math.max(limit, entityKeys.length || limit) });
const entitiesByKey = new Map(loadDiscoveryEntities({ storeRoot }).map((entity) => [entity.entityKey, entity]));
const selected = (entityKeys.length
  ? entityKeys.map((key) => entitiesByKey.get(key)).filter(Boolean)
  : queues.cheapSiteAudit.map((item) => entitiesByKey.get(item.entityKey)).filter(Boolean)
).slice(0, limit);

if (dryRun) {
  console.log(JSON.stringify({
    ok: true,
    dryRun,
    selected: selected.map(summary),
  }, null, 2));
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const entity of selected) {
  results.push(await auditEntity(browser, entity));
}
await browser.close();

console.log(JSON.stringify({
  ok: results.every((result) => result.ok),
  count: results.length,
  results,
}, null, 2));

async function auditEntity(browser, entity) {
  const latest = entity.latest || {};
  const websiteUrl = latest.website || '';
  const auditDir = path.join(storeRoot, 'audits', entity.entityKey);
  fs.mkdirSync(auditDir, { recursive: true });
  const desktopPath = path.join(auditDir, 'current-site-desktop.png');
  const mobilePath = path.join(auditDir, 'current-site-mobile.png');
  const htmlPath = path.join(auditDir, 'current-site.html');
  const textPath = path.join(auditDir, 'current-site-text.txt');
  const jsonPath = path.join(auditDir, 'current-site-audit.json');
  const mdPath = path.join(auditDir, 'current-site-audit.md');

  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  let facts = null;
  try {
    await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: desktopPath, fullPage: true });
    const html = sanitizeHtmlSnapshot(await page.content());
    fs.writeFileSync(htmlPath, html, 'utf8');
    facts = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const links = [...document.querySelectorAll('a')].map((link) => ({
        text: (link.textContent || '').trim().slice(0, 80),
        href: link.href || '',
      })).filter((link) => link.text || link.href).slice(0, 100);
      const socialLinks = links
        .filter((link) => /instagram|facebook|linkedin|tiktok|youtube|wa\.me|whatsapp|twitter|x\.com/i.test(link.href))
        .map((link) => ({ label: link.text || link.href, url: link.href }))
        .slice(0, 20);
      const contactPageCandidates = links
        .filter((link) => /contact|enquiry|quote|get.?in.?touch|booking|book|reserve|estimate/i.test(`${link.text} ${link.href}`))
        .map((link) => link.href)
        .filter(Boolean)
        .slice(0, 12);
      const headings = [...document.querySelectorAll('h1,h2,h3')].map((node) => (node.textContent || '').trim()).filter(Boolean).slice(0, 30);
      const images = [...document.querySelectorAll('img')].map((img) => ({
        alt: img.hasAttribute('alt') ? img.alt : undefined,
        src: img.currentSrc || img.src || '',
      })).slice(0, 50);
      const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
      const property = (name) => document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || '';
      const jsonLdTypes = [];
      for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')]) {
        try {
          const parsed = JSON.parse(script.textContent || '{}');
          for (const item of (Array.isArray(parsed) ? parsed : [parsed])) {
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
        sameAs: [],
        images,
        seo: {
          title: document.title || '',
          metaDescription: meta('description'),
          canonical: document.querySelector('link[rel="canonical"]')?.href || '',
          h1s: [...document.querySelectorAll('h1')].map((node) => (node.textContent || '').trim()).filter(Boolean),
          jsonLdTypes: [...new Set(jsonLdTypes.map((value) => String(value || '').trim()).filter(Boolean))],
          og: {
            title: property('og:title'),
            description: property('og:description'),
            image: property('og:image'),
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
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: mobilePath, fullPage: true });
  } catch (error) {
    await page.close();
    const failed = { ok: false, entityKey: entity.entityKey, websiteUrl, error: error.message, jsonPath };
    writeJson(jsonPath, failed);
    return failed;
  }
  await page.close();

  const record = {
    clientSlug: entity.entityKey,
    company: latest.name || entity.entityKey,
    niche: latest.niche || latest.category || '',
    city: latest.city || '',
    address: latest.address || '',
    phone: latest.phone || '',
    websiteUrl,
    leadCoreServices: latest.categories || [],
  };
  const audit = createSiteAudit({
    record,
    facts,
    artifacts: { desktopPath, mobilePath, htmlPath, textPath, jsonPath, mdPath },
  });
  writeJson(jsonPath, audit);
  fs.writeFileSync(mdPath, renderSiteAuditMarkdown(audit), 'utf8');
  const nextStatus = audit.salesDecision === 'skip_or_monitor' ? 'skipped' : 'queued_for_enrichment';
  updateDiscoveryEntityStatus({
    entityKey: entity.entityKey,
    status: nextStatus,
    note: `Cheap site audit ${audit.score}/100: ${audit.salesDecision}. ${jsonPath}`,
    storeRoot,
  });
  return {
    ok: true,
    entityKey: entity.entityKey,
    businessName: latest.name || '',
    websiteUrl,
    verdict: audit.verdict,
    score: audit.score,
    salesDecision: audit.salesDecision,
    nextStatus,
    jsonPath,
    mdPath,
    desktopPath,
    mobilePath,
  };
}

function summary(entity) {
  return {
    entityKey: entity.entityKey,
    name: entity.latest?.name || '',
    website: entity.latest?.website || '',
    score: entity.latest?.discoveryScore ?? null,
    action: entity.latest?.recommendedAction || '',
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
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
