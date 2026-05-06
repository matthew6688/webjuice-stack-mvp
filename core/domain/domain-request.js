import fs from 'fs';
import path from 'path';
import { resolveLaunchRoute } from './launch-route.js';
import { buildDnsInstructions, inspectDns, normalizeDomain, pagesTarget } from './dns.js';
import { attachPagesDomain, listPagesDomains } from './cloudflare-pages.js';
import { upsertCnameRecord } from './cloudflare-dns.js';

const DEFAULT_ROOT_DOMAIN = 'profitslocal.com';

export async function handleDomainRequest(input, options = {}) {
  const request = buildDomainRequest(input, options);
  const provision = await provisionDomainRequest(request, options);
  const result = {
    ...request,
    ...provision,
    updatedAt: new Date().toISOString(),
  };
  if (options.write !== false) writeDomainRequest(result, options);
  return result;
}

export function buildDomainRequest(input, options = {}) {
  const clientSlug = safeId(input.clientSlug || input.client_slug || '');
  const orderId = safeId(input.orderId || input.order_id || '');
  const email = String(input.email || '').trim().toLowerCase();
  const requestedDomain = normalizeDomain(input.domain || input.requestedDomain || input.preferred_domain || '');
  if (!clientSlug) throw new Error('clientSlug is required');
  const projectName = input.projectName || input.project || `${clientSlug}-live`;
  const rootDomain = options.rootDomain || input.rootDomain || DEFAULT_ROOT_DOMAIN;
  const route = resolveLaunchRoute({ clientSlug, requestedDomain, rootDomain });
  const domain = route.domain;
  const target = pagesTarget(projectName);
  const id = safeId(input.requestId || [clientSlug, orderId || 'no-order', domain].filter(Boolean).join('__'));
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id,
    status: 'created',
    clientSlug,
    orderId,
    email,
    requestedDomain,
    domain,
    projectName,
    target,
    route,
    dns: {
      instructions: buildDnsInstructions({ domain, projectName }),
      inspection: null,
    },
    pages: {
      domains: [],
      active: false,
    },
    steps: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function provisionDomainRequest(request, options = {}) {
  const execute = options.execute === true;
  const steps = [];
  const status = requestStatusBase(request);
  let dnsInspection = null;
  let pagesDomains = [];
  let pagesActive = false;

  if (request.route.route === 'profitslocal_subpage') {
    steps.push(step('router-pending', true, 'ProfitsLocal path routing is not active yet; keep this as a future router request.'));
    return finalizeStatus({ request, status: 'needs_router', steps, dnsInspection, pagesDomains, pagesActive });
  }

  if (request.route.route === 'customer_root_domain' && options.allowRootAutoAttach !== true) {
    dnsInspection = inspectDns({ domain: request.domain, projectName: request.projectName });
    steps.push(step('root-domain-audit', true, 'Root domain requires DNS/email audit before automatic attach.', {
      readyForPagesAttach: dnsInspection.status.readyForPagesAttach,
    }));
    return finalizeStatus({ request, status: 'needs_root_domain_review', steps, dnsInspection, pagesDomains, pagesActive });
  }

  if (request.route.route === 'profitslocal_subdomain' || request.route.route === 'profitslocal_root') {
    if (execute) {
      const zoneId = options.zoneId;
      if (!zoneId) {
        throw new Error('CF_ZONE_ID is required for automatic ProfitsLocal-owned domain provisioning.');
      }
      const dnsResult = await upsertCnameRecord({
        token: options.cfToken,
        zoneId,
        name: request.domain,
        target: request.target,
        proxied: options.proxied !== false,
      });
      steps.push(step('upsert-profitslocal-cname', true, 'Created or updated ProfitsLocal DNS CNAME.', {
        action: dnsResult.action,
        name: dnsResult.record?.name,
        target: dnsResult.record?.content,
        proxied: dnsResult.record?.proxied,
      }));
    } else {
      steps.push(step('upsert-profitslocal-cname', true, `Dry run: would create CNAME ${request.domain} -> ${request.target}.`));
    }
  } else {
    dnsInspection = inspectDns({ domain: request.domain, projectName: request.projectName });
    const ready = dnsInspection.status.cnameMatchesPages;
    steps.push(step('customer-dns-check', ready, ready
      ? 'Customer DNS points at the Pages target.'
      : 'Waiting for customer to add the CNAME record.', {
        cname: dnsInspection.records.cname,
        target: request.target,
      }));
    if (!ready) {
      return finalizeStatus({ request, status: 'waiting_for_customer_dns', steps, dnsInspection, pagesDomains, pagesActive });
    }
  }

  if (execute) {
    pagesDomains = await ensurePagesDomain({
      accountId: options.cfAccountId,
      token: options.cfToken,
      projectName: request.projectName,
      domain: request.domain,
      pollAttempts: options.pagesPollAttempts,
      pollIntervalMs: options.pagesPollIntervalMs,
    });
    pagesActive = pagesDomains.some((item) => item.name === request.domain && item.status === 'active');
    steps.push(step('attach-pages-domain', true, 'Cloudflare Pages custom domain is attached.', {
      active: pagesActive,
      domain: request.domain,
    }));
  } else {
    steps.push(step('attach-pages-domain', true, `Dry run: would attach ${request.domain} to ${request.projectName}.`));
  }

  const finalStatus = execute ? (pagesActive ? 'active' : 'pages_pending') : 'dry_run_ready';
  return finalizeStatus({ request, status: finalStatus, steps, dnsInspection, pagesDomains, pagesActive });

  function requestStatusBase(value) {
    return value.status || 'created';
  }
}

export function writeDomainRequest(result, options = {}) {
  const root = options.root || process.cwd();
  const outputPath = domainRequestPath(result, root);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return outputPath;
}

export function domainRequestPath(request, root = process.cwd()) {
  return path.join(root, 'data/domain/requests', safeId(request.clientSlug), `${safeId(request.id)}.json`);
}

async function ensurePagesDomain({ accountId, token, projectName, domain, pollAttempts = 12, pollIntervalMs = 10000 }) {
  const before = await listPagesDomains({ accountId, token, projectName });
  if (!before.some((item) => item.name === domain)) {
    await attachPagesDomain({ accountId, token, projectName, domain });
  }
  let domains = await listPagesDomains({ accountId, token, projectName });
  for (let attempt = 1; attempt < pollAttempts && !isPagesDomainActive(domains, domain); attempt += 1) {
    await sleep(pollIntervalMs);
    domains = await listPagesDomains({ accountId, token, projectName });
  }
  return domains;
}

function isPagesDomainActive(domains, domain) {
  return domains.some((item) => item.name === domain && item.status === 'active');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finalizeStatus({ request, status, steps, dnsInspection, pagesDomains, pagesActive }) {
  return {
    status,
    dns: {
      ...request.dns,
      inspection: dnsInspection,
    },
    pages: {
      domains: pagesDomains,
      active: pagesActive,
    },
    steps,
  };
}

function step(id, ok, message, data = {}) {
  return {
    id,
    ok,
    message,
    data,
    at: new Date().toISOString(),
  };
}

function safeId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}
