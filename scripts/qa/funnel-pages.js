#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const distDir = args['dist-dir'] ? path.resolve(args['dist-dir']) : '';
const baseUrl = args['base-url'] || '';
const expectedClient = args.client || args['client-name'] || '';
const pages = [
  '/',
  '/demo-faq',
  '/checkout',
  '/thank-you',
  '/contact-us',
  '/revise',
  '/approve',
  '/domain-setup',
  '/domain-help',
];
const utilityPages = pages.filter((page) => page !== '/');

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
  const isUtility = utilityPages.includes(pagePath);
  const text = stripTags(html);

  check(checks, 'http_200_or_file_exists', status === 200, error || `status=${status}`);
  check(checks, 'has_html', html.trim().length > 0, 'page body is empty');

  if (pagePath === '/') {
    check(checks, 'sales_footer_how_it_works', html.includes('How it works'), 'missing fixed footer FAQ link');
    check(checks, 'sales_footer_faq', html.includes('FAQ'), 'missing FAQ link');
    check(checks, 'sales_footer_contact', html.includes('Contact'), 'missing contact link');
    check(checks, 'sales_footer_logo_official', html.includes('https://profitslocal.com/') && html.includes('logo-horizontal.svg'), 'banner logo does not link to official ProfitsLocal site');
    check(checks, 'sales_footer_claim_399', html.includes('Claim $399') || html.includes('Claim &#36;399') || html.includes('$399 one-time'), 'missing $399 claim CTA');
    check(checks, 'sales_footer_799', html.includes('$799/yr') || html.includes('&#36;799/yr') || html.includes('$799/year'), 'missing yearly CTA');
    check(checks, 'sales_footer_checkout', html.includes('Checkout') || html.includes('CHECKOUT'), 'missing checkout CTA');
    check(checks, 'sales_footer_no_pre_purchase_revision', !html.includes('$100 extra revision') && !html.includes('Request changes'), 'pre-purchase banner contains support/revision actions');
  }

  if (isUtility) {
    check(checks, 'profitslocal_chrome', html.includes('profitslocal-funnel') && html.includes('ProfitsLocal'), 'utility page is not using ProfitsLocal chrome');
    check(checks, 'no_customer_sales_bar_inside_utility', !html.includes('data-preview-sales-bar'), 'utility page contains fixed preview sales bar');
    check(checks, 'no_template_footer_leak', !containsAny(html, [
      'Built with WebJuice Stack',
      'hello@bistro.template',
      'Bistro Template. Built',
    ]), 'utility page leaks template footer or support identity');
  }

  if (pagePath === '/demo-faq') {
    check(checks, 'demo_faq_pricing', containsAll(text, ['$399', '$799/yr']), 'missing offer prices');
    check(checks, 'demo_faq_after_payment', text.includes('What happens after payment?'), 'missing after-payment objection handling');
    check(checks, 'demo_faq_domain', text.includes('ProfitsLocal subdomain') && text.includes('root domain'), 'missing domain route explanation');
  }

  if (pagePath === '/checkout') {
    check(checks, 'checkout_fields', containsAll(text, ['Package', 'Business name', 'Email', 'Preferred domain']), 'checkout form missing key fields');
    check(checks, 'checkout_secure_payment', text.includes('Continue to secure payment'), 'missing payment CTA');
    check(checks, 'checkout_preview_context', html.includes('data-preview-context') && containsAll(html, ['name="client_slug"', 'name="repo"', 'name="preview_url"']), 'checkout does not preserve preview/source context');
  }

  if (pagePath === '/contact-us') {
    check(checks, 'contact_page_routes', containsAll(text, ['Ask before you claim this preview', 'Prepare email', 'Request a callback']), 'contact page missing customer support paths');
    check(checks, 'contact_support_email', html.includes('hello@fengtalk.ai'), 'contact page missing support email');
    check(checks, 'contact_preview_context', html.includes('data-preview-context') && containsAll(html, ['name="client_slug"', 'name="repo"', 'name="preview_url"']), 'contact page does not preserve preview/source context');
  }

  if (pagePath === '/thank-you') {
    check(checks, 'thank_you_next_steps', containsAll(text, ['Payment received', 'Start domain setup', 'Submit revision request', 'Approve the dev preview']), 'thank-you page missing next steps');
    check(checks, 'thank_you_support_email', html.includes('hello@fengtalk.ai'), 'missing ProfitsLocal support email');
  }

  if (pagePath === '/revise') {
    check(checks, 'revision_identity_match', containsAll(text, ['Order ID', 'Checkout email', 'Check remaining revisions']), 'revision page missing order/email quota match');
    check(checks, 'revision_extra_purchase', text.includes('Buy extra revision'), 'missing extra revision purchase link');
    check(checks, 'revision_uploads', html.includes('type="file"') && html.includes('multiple'), 'missing multi-file upload input');
  }

  if (pagePath === '/approve') {
    check(checks, 'approval_identity_match', containsAll(text, ['Order ID', 'Checkout email', 'Approve and publish live']), 'approval page missing identity check or CTA');
  }

  if (pagePath === '/domain-setup') {
    check(checks, 'domain_setup_routes', containsAll(text, ['Free ProfitsLocal subdomain', 'My own subdomain', 'My root domain']), 'domain setup form missing launch routes');
  }

  if (pagePath === '/domain-help') {
    check(checks, 'domain_help_guidance', containsAll(text, ['Free ProfitsLocal subdomain', 'Your subdomain', 'Your root domain', 'ProfitsLocal subpage']), 'domain help missing route guidance');
    check(checks, 'domain_help_support_email', html.includes('hello@fengtalk.ai'), 'domain help missing support email');
  }

  if (expectedClient && ['/demo-faq', '/checkout', '/revise', '/approve'].includes(pagePath)) {
    check(checks, 'expected_client_visible', html.includes(escapeHtml(expectedClient)) || text.includes(expectedClient), `missing expected client name: ${expectedClient}`);
  }

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

function containsAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}

function containsAll(value, needles) {
  return needles.every((needle) => value.includes(needle));
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
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
