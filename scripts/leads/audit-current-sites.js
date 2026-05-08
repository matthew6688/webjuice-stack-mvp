#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';

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
  .filter((record) => record.websiteUrl)
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
    await page.goto(record.websiteUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: desktopPath, fullPage: true });
    fs.copyFileSync(desktopPath, publicDesktopPath);
    const html = await page.content();
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
        alt: img.alt || '',
        src: img.currentSrc || img.src || '',
      })).slice(0, 40);
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
      };
    });
    fs.writeFileSync(textPath, facts.text, 'utf8');
    fs.copyFileSync(textPath, publicTextPath);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(record.websiteUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: mobilePath, fullPage: true });
    fs.copyFileSync(mobilePath, publicMobilePath);
  } catch (error) {
    await page.close();
    const failed = {
      ok: false,
      clientSlug: record.clientSlug,
      websiteUrl: record.websiteUrl,
      error: error.message,
      jsonPath,
    };
    writeJson(jsonPath, failed);
    return failed;
  }
  await page.close();

  const audit = buildAudit(record, facts, {
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
  });
  writeJson(jsonPath, audit);
  writeJson(publicJsonPath, audit);
  fs.writeFileSync(mdPath, renderAuditMarkdown(audit), 'utf8');
  fs.copyFileSync(mdPath, publicMdPath);
  return {
    ok: true,
    clientSlug: record.clientSlug,
    websiteUrl: record.websiteUrl,
    verdict: audit.verdict,
    score: audit.score,
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

function buildAudit(record, facts, artifacts) {
  const text = facts.text || '';
  const lower = text.toLowerCase();
  const links = facts.links || [];
  const phoneVisible = Boolean(record.phone && text.includes(record.phone)) || /tel:/i.test(JSON.stringify(links));
  const emailVisible = Boolean(record.email && lower.includes(String(record.email).toLowerCase())) || /mailto:/i.test(JSON.stringify(links));
  const quoteVisible = /quote|call|contact|get in touch|book|estimate|enquire|enquiry/i.test(text);
  const serviceVisible = (record.leadCoreServices || []).some((service) => lower.includes(String(service).toLowerCase()));
  const issues = [];
  const improvements = [];

  if (!phoneVisible) {
    issues.push('Phone/contact action is not obvious from captured page text.');
    improvements.push('Make phone or quote action sticky and visible on mobile.');
  }
  if (!quoteVisible) {
    issues.push('Primary quote/enquiry CTA is weak or not repeated.');
    improvements.push('Use one dominant quote CTA in hero, service sections, and final section.');
  }
  if (!serviceVisible) {
    issues.push('Core services are not immediately clear from captured page text.');
    improvements.push('Show 3-5 core services with plain-language outcomes near the top.');
  }
  if ((facts.headings || []).length < 3) {
    issues.push('Page structure has few readable headings.');
    improvements.push('Add scannable section headings for services, proof, service area, and CTA.');
  }
  if ((facts.images || []).filter((image) => image.alt).length < 2) {
    issues.push('Images have limited descriptive alt text or proof context.');
    improvements.push('Use before/after or job-site proof with descriptive captions.');
  }

  if (!issues.length) {
    issues.push('Existing site has usable basics; opportunity is mostly sharper positioning and conversion path.');
    improvements.push('Differentiate the mockup with stronger proof hierarchy, local service-area clarity, and simpler mobile CTA.');
  }

  const score = Math.max(35, 92 - issues.length * 10);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clientSlug: record.clientSlug,
    businessName: record.company,
    websiteUrl: record.websiteUrl,
    verdict: issues.length >= 4 ? 'clear_redesign_opportunity' : 'moderate_redesign_opportunity',
    score,
    captured: {
      title: facts.title,
      headings: facts.headings,
      linkCount: facts.links.length,
      imageCount: facts.images.length,
      contactPageCandidates: uniqueValues(facts.contactPageCandidates || []),
      socialLinks: normalizeSocialLinks([...(facts.socialLinks || []), ...(facts.sameAs || [])]),
      textLength: text.length,
      phoneVisible,
      emailVisible,
      quoteVisible,
      serviceVisible,
    },
    issues,
    improvements,
    nextStepInput: {
      businessName: record.company,
      industry: record.niche || record.leadFamilyId,
      location: record.city || record.address || '',
      services: record.leadCoreServices || [],
      heroAngle: record.leadHeroAngle || '',
      primaryCta: record.leadPrimaryCta || 'Call now',
      outreachObservation: record.leadSpecificObservation || '',
      contactProfile: {
        email: record.email || '',
        phone: record.phone || '',
        contactPageUrl: uniqueValues(facts.contactPageCandidates || [])[0] || '',
        socialLinks: normalizeSocialLinks([...(facts.socialLinks || []), ...(facts.sameAs || [])]),
      },
    },
    artifacts,
  };
}

function renderAuditMarkdown(audit) {
  return [
    `# Current Site Audit: ${audit.businessName}`,
    '',
    `- Website: ${audit.websiteUrl}`,
    `- Verdict: ${audit.verdict}`,
    `- Score: ${audit.score}`,
    `- Generated: ${audit.generatedAt}`,
    '',
    '## Captured Evidence',
    '',
    `- Desktop screenshot: ${audit.artifacts.desktopPath}`,
    `- Mobile screenshot: ${audit.artifacts.mobilePath}`,
    `- HTML snapshot: ${audit.artifacts.htmlPath}`,
    `- Text snapshot: ${audit.artifacts.textPath}`,
    '',
    '## Findings',
    '',
    ...audit.issues.map((issue) => `- ${issue}`),
    '',
    '## Improvements For Mockup',
    '',
    ...audit.improvements.map((item) => `- ${item}`),
    '',
    '## Next Step Input',
    '',
    `- Industry: ${audit.nextStepInput.industry || 'N/A'}`,
    `- Location: ${audit.nextStepInput.location || 'N/A'}`,
    `- Services: ${(audit.nextStepInput.services || []).join(', ') || 'N/A'}`,
    `- Hero angle: ${audit.nextStepInput.heroAngle || 'N/A'}`,
    `- Primary CTA: ${audit.nextStepInput.primaryCta || 'N/A'}`,
    `- Observation: ${audit.nextStepInput.outreachObservation || 'N/A'}`,
    '',
  ].join('\n');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeSocialLinks(values) {
  return values
    .map((item) => {
      const url = typeof item === 'string' ? item : item?.url || '';
      const label = typeof item === 'string' ? platformLabel(item) : item?.label || platformLabel(url);
      return { label, url };
    })
    .filter((item) => item.url && isSocialUrl(item.url))
    .filter((item, index, array) => array.findIndex((candidate) => candidate.url === item.url) === index);
}

function isSocialUrl(value) {
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
}

function platformLabel(value) {
  const url = String(value || '').toLowerCase();
  if (url.includes('instagram')) return 'Instagram';
  if (url.includes('facebook')) return 'Facebook';
  if (url.includes('linkedin')) return 'LinkedIn';
  if (url.includes('tiktok')) return 'TikTok';
  if (url.includes('youtube')) return 'YouTube';
  if (url.includes('twitter') || url.includes('x.com')) return 'X';
  if (url.includes('whatsapp') || url.includes('wa.me')) return 'WhatsApp';
  return 'Social';
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
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
