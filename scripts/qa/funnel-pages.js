#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const distDir = args['dist-dir'] ? path.resolve(args['dist-dir']) : '';
const baseUrl = args['base-url'] || '';
const expectedClient = args.client || args['client-name'] || '';
const pages = ['/'];
const removedUtilityPages = [
  '/demo-faq',
  '/checkout',
  '/thank-you',
  '/contact-us',
  '/revise',
  '/approve',
  '/domain-setup',
  '/domain-help',
];

if (!distDir && !baseUrl) {
  throw new Error('Usage: npm run qa:funnel-pages -- --dist-dir /path/to/dist OR --base-url https://client-dev.pages.dev');
}
if (distDir && !fs.existsSync(distDir)) throw new Error(`Missing dist dir: ${distDir}`);

const checks = [];
const pageResults = [];

if (distDir) {
  for (const pagePath of pages) {
    const filePath = resolveStaticHtml(distDir, pagePath);
    const html = filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    pageResults.push(validatePage({
      mode: 'dist',
      pagePath,
      source: filePath || '',
      status: filePath ? 200 : 404,
      html,
      expectedClient,
    }));
  }
  for (const pagePath of removedUtilityPages) {
    const filePath = resolveStaticHtml(distDir, pagePath);
    const exists = Boolean(filePath && fs.existsSync(filePath));
    pageResults.push(validateRemovedUtilityPage({
      mode: 'dist',
      pagePath,
      source: filePath || '',
      status: exists ? 200 : 404,
      html: exists ? fs.readFileSync(filePath, 'utf8') : '',
      redirects: readRedirects(distDir),
    }));
  }
}

if (baseUrl) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  for (const pagePath of pages) {
    const url = `${normalizedBase}${pagePath}`;
    let status = 0;
    let html = '';
    let finalUrl = url;
    let error = '';
    try {
      const response = await fetch(url, { redirect: 'follow' });
      status = response.status;
      finalUrl = response.url;
      html = await response.text();
    } catch (fetchError) {
      error = fetchError.message;
    }
    pageResults.push(validatePage({
      mode: 'live',
      pagePath,
      source: finalUrl,
      status,
      html,
      error,
      expectedClient,
    }));
  }
  for (const pagePath of removedUtilityPages) {
    const url = `${normalizedBase}${pagePath}`;
    let status = 0;
    let html = '';
    let finalUrl = url;
    let error = '';
    let location = '';
    try {
      const response = await fetch(url, { redirect: 'manual' });
      status = response.status;
      finalUrl = response.url;
      location = response.headers.get('location') || '';
      html = await response.text();
    } catch (fetchError) {
      error = fetchError.message;
    }
    pageResults.push(validateRemovedUtilityPage({
      mode: 'live',
      pagePath,
      source: finalUrl,
      status,
      html,
      error,
      location,
    }));
  }
}

for (const result of pageResults) {
  checks.push(...result.checks.map((check) => ({ ...check, mode: result.mode, pagePath: result.pagePath, source: result.source })));
}

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  distDir: distDir || null,
  baseUrl: baseUrl || null,
  expectedClient: expectedClient || null,
  totals: {
    pages: pageResults.length,
    checks: checks.length,
    failed: failed.length,
  },
  failed,
  pages: pageResults,
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);

function validatePage({ mode, pagePath, source, status, html, error = '', expectedClient = '' }) {
  const checks = [];

  check(checks, 'http_200_or_file_exists', status === 200, error || `status=${status}`);
  check(checks, 'has_html', html.trim().length > 0, 'page body is empty');

  if (pagePath === '/') {
    check(checks, 'sales_footer_how_it_works', html.includes('How it works'), 'missing fixed footer FAQ link');
    check(checks, 'sales_footer_faq', html.includes('FAQ'), 'missing FAQ link');
    check(checks, 'sales_footer_contact', html.includes('Contact'), 'missing contact link');
    check(checks, 'sales_footer_logo_official', html.includes('https://profitslocal.com/') && html.includes('logo-horizontal.svg'), 'banner logo does not link to official ProfitsLocal site');
    check(checks, 'sales_footer_official_funnel_links', containsAll(html, [
      'https://profitslocal.com/checkout?',
      'https://profitslocal.com/contact?',
      'client_slug=',
      'repo=',
      'preview_url=',
      'utm_',
    ]) || containsAll(html, [
      'https://profitslocal.com/checkout?',
      'https://profitslocal.com/contact?',
      'client_slug=',
      'repo=',
      'preview_url=',
      'campaign_id=',
    ]), 'pre-purchase banner does not point to official ProfitsLocal funnel with preview context');
    check(checks, 'sales_footer_claim_399', html.includes('Claim $399') || html.includes('Claim &#36;399') || html.includes('$399 one-time'), 'missing $399 claim CTA');
    check(checks, 'sales_footer_799', html.includes('$799/yr') || html.includes('&#36;799/yr') || html.includes('$799/year'), 'missing yearly CTA');
    check(checks, 'sales_footer_checkout', html.includes('Checkout') || html.includes('CHECKOUT'), 'missing checkout CTA');
    check(checks, 'sales_footer_no_pre_purchase_revision', !html.includes('$100 extra revision') && !html.includes('Request changes'), 'pre-purchase banner contains support/revision actions');
    check(checks, 'sales_footer_no_local_funnel_routes', !containsAny(html, [
      'href="/checkout',
      'href="/demo-faq',
      'href="/contact-us',
      'href="/thank-you',
      'href="/revise',
      'href="/approve',
      'href="/domain-setup',
      'href="/domain-help',
      "fetch('/api/order-status/",
      'fetch("/api/order-status/',
    ]), 'customer preview still links to local ProfitsLocal funnel routes or order-status API');
  }

  return { mode, pagePath, source, status, ok: checks.every((check) => check.ok), checks };
}

function validateRemovedUtilityPage({ mode, pagePath, source, status, html, error = '', redirects = '', location = '' }) {
  const checks = [];
  if (mode === 'dist') {
    check(checks, 'local_funnel_route_removed_or_redirected', status === 404 || redirectsToOfficial(redirects, pagePath), `${pagePath} still exists at ${source} and no official redirect was found`);
  } else {
    check(checks, 'local_funnel_route_removed_or_redirected', status === 404 || status === 410 || ([301, 302, 303, 307, 308].includes(status) && location.startsWith('https://profitslocal.com/')), error || `${pagePath} returned status=${status} location=${location}`);
  }
  check(checks, 'removed_route_not_serving_funnel', !html.includes('profitslocal-funnel') && !html.includes('data-preview-sales-bar'), `${pagePath} still serves ProfitsLocal funnel chrome`);
  return { mode, pagePath, source, status, ok: checks.every((check) => check.ok), checks };
}

function check(checks, name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail: ok ? '' : detail });
}

function resolveStaticHtml(root, pagePath) {
  const clean = pagePath.replace(/^\/+/, '');
  if (!clean) return path.join(root, 'index.html');
  return path.join(root, clean, 'index.html');
}

function readRedirects(root) {
  const filePath = path.join(root, '_redirects');
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function redirectsToOfficial(redirects, pagePath) {
  return redirects
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line.startsWith(`${pagePath} `) && line.includes(' https://profitslocal.com/'));
}

function containsAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}

function containsAll(value, needles) {
  return needles.every((needle) => value.includes(needle));
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
