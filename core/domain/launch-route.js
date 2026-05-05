const DEFAULT_ROOT_DOMAIN = 'profitslocal.com';

export function resolveLaunchRoute({
  clientSlug,
  requestedDomain = '',
  rootDomain = DEFAULT_ROOT_DOMAIN,
} = {}) {
  const slug = safeSlug(clientSlug || 'client');
  const root = normalizeHost(rootDomain || DEFAULT_ROOT_DOMAIN);
  const raw = String(requestedDomain || '').trim();
  const parsed = parseRequestedDomain(raw);

  if (!parsed.value) {
    return {
      route: 'profitslocal_subdomain',
      domain: `${slug}.${root}`,
      requiresCustomerDns: false,
      requiresCloudflareAttach: true,
      utilityPagesStayOnPreview: true,
      reason: 'default_no_customer_domain',
      nextStep: `Attach ${slug}.${root} to the approved Pages project.`,
    };
  }

  if (parsed.kind === 'path' && parsed.host === root) {
    return {
      route: 'profitslocal_subpage',
      domain: root,
      path: parsed.path || `/${slug}`,
      requiresCustomerDns: false,
      requiresCloudflareAttach: false,
      utilityPagesStayOnPreview: true,
      reason: 'customer_requested_profitslocal_subpage',
      nextStep: 'Route the subpage through the ProfitsLocal site/router when that public site is ready.',
    };
  }

  if (parsed.host === root || parsed.host.endsWith(`.${root}`)) {
    return {
      route: parsed.host === root ? 'profitslocal_root' : 'profitslocal_subdomain',
      domain: parsed.host === root ? `${slug}.${root}` : parsed.host,
      requiresCustomerDns: false,
      requiresCloudflareAttach: true,
      utilityPagesStayOnPreview: true,
      reason: parsed.host === root ? 'root_reserved_use_subdomain' : 'customer_requested_profitslocal_subdomain',
      nextStep: `Attach ${parsed.host === root ? `${slug}.${root}` : parsed.host} to the approved Pages project.`,
    };
  }

  const isLikelyApex = isApexLike(parsed.host);
  return {
    route: isLikelyApex ? 'customer_root_domain' : 'customer_subdomain',
    domain: parsed.host,
    requiresCustomerDns: true,
    requiresCloudflareAttach: true,
    utilityPagesStayOnPreview: true,
    reason: isLikelyApex ? 'customer_requested_root_domain' : 'customer_requested_subdomain',
    nextStep: isLikelyApex
      ? `Send DNS instructions for ${parsed.host}; prefer a Cloudflare CNAME flattening setup or www fallback.`
      : `Send CNAME instructions: ${parsed.host} -> <client-pages-project>.pages.dev.`,
  };
}

function parseRequestedDomain(value) {
  if (!value) return { value: '' };
  const withScheme = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    const host = normalizeHost(url.hostname);
    const path = url.pathname && url.pathname !== '/' ? normalizePath(url.pathname) : '';
    return { value, kind: path ? 'path' : 'host', host, path };
  } catch {
    return { value, kind: 'host', host: normalizeHost(value), path: '' };
  }
}

function normalizeHost(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

function normalizePath(value) {
  const normalized = `/${String(value || '').replace(/^\/+/, '')}`;
  return normalized.replace(/\/+$/, '') || '/';
}

function safeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63) || 'client';
}

function isApexLike(host) {
  const parts = String(host || '').split('.').filter(Boolean);
  if (parts.length === 2) return true;
  const twoLevelSuffixes = new Set(['com.au', 'net.au', 'org.au', 'co.uk', 'com.cn', 'com.hk', 'co.nz']);
  return parts.length === 3 && twoLevelSuffixes.has(parts.slice(1).join('.'));
}
