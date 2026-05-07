import fs from 'fs';

const REQUIRED_CHECKS = [
  'businessData',
  'nicheCompleteness',
  'design',
  'copywriting',
  'technical',
  'customerCommunication',
];

export function readDeliveryQaReport(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      ok: false,
      path: filePath || '',
      missing: ['deliveryQaReport'],
      errors: ['delivery QA report is missing'],
      report: null,
    };
  }
  try {
    return validateDeliveryQaReport(JSON.parse(fs.readFileSync(filePath, 'utf8')), { path: filePath });
  } catch (error) {
    return {
      ok: false,
      path: filePath,
      missing: [],
      errors: [`delivery QA report is invalid JSON: ${error.message}`],
      report: null,
    };
  }
}

export function validateDeliveryQaReport(report, { path = '' } = {}) {
  const missing = [];
  const errors = [];
  if (!report || typeof report !== 'object') {
    return { ok: false, path, missing: ['deliveryQaReport'], errors: ['delivery QA report must be an object'], report: null };
  }
  if (report.readyForCustomerReview !== true) errors.push('readyForCustomerReview must be true');
  if (!report.clientSlug) missing.push('clientSlug');
  if (!report.orderId) missing.push('orderId');
  if (!report.previewUrl) missing.push('previewUrl');
  if (!report.checks || typeof report.checks !== 'object') {
    missing.push('checks');
  } else {
    for (const key of REQUIRED_CHECKS) {
      const check = report.checks[key];
      if (!check) {
        missing.push(`checks.${key}`);
        continue;
      }
      if (check.status !== 'pass') errors.push(`checks.${key}.status must be pass`);
      if (Array.isArray(check.blockers) && check.blockers.length) {
        errors.push(`checks.${key}.blockers must be empty`);
      }
    }
  }
  if (Array.isArray(report.blockingIssues) && report.blockingIssues.length) {
    errors.push('blockingIssues must be empty');
  }
  const links = report.checks?.customerCommunication?.requiredLinks || {};
  for (const key of ['previewUrl', 'approveUrl', 'reviseUrl', 'domainSetupUrl']) {
    if (!links[key]) missing.push(`checks.customerCommunication.requiredLinks.${key}`);
  }
  if (links.approveUrl && !String(links.approveUrl).startsWith('https://profitslocal.com/approve?')) {
    errors.push('checks.customerCommunication.requiredLinks.approveUrl must use official https://profitslocal.com/approve');
  }
  if (links.reviseUrl && !String(links.reviseUrl).startsWith('https://profitslocal.com/revision?')) {
    errors.push('checks.customerCommunication.requiredLinks.reviseUrl must use official https://profitslocal.com/revision');
  }
  if (links.domainSetupUrl && !String(links.domainSetupUrl).startsWith('https://profitslocal.com/domain-setup?')) {
    errors.push('checks.customerCommunication.requiredLinks.domainSetupUrl must use official https://profitslocal.com/domain-setup');
  }
  return {
    ok: missing.length === 0 && errors.length === 0,
    path,
    missing,
    errors,
    report,
  };
}

export function buildOfficialCustomerLinks({
  previewUrl = '',
  orderId = '',
  email = '',
  clientSlug = '',
  repo = '',
  siteUrl = 'https://profitslocal.com',
} = {}) {
  return {
    previewUrl,
    approveUrl: officialUrl(siteUrl, '/approve', { order_id: orderId, email, client_slug: clientSlug, repo, preview_url: previewUrl }),
    reviseUrl: officialUrl(siteUrl, '/revision', { order_id: orderId, email, client_slug: clientSlug, repo, preview_url: previewUrl }),
    domainSetupUrl: officialUrl(siteUrl, '/domain-setup', { order_id: orderId, email, client_slug: clientSlug, repo, preview_url: previewUrl }),
  };
}

function officialUrl(siteUrl, pathname, params) {
  const url = new URL(pathname, siteUrl);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && String(value) !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}
