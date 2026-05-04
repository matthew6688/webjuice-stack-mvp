import { execFileSync } from 'child_process';

export function normalizeDomain(domain) {
  return String(domain || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')
    .toLowerCase();
}

export function pagesTarget(projectName) {
  return `${projectName}.pages.dev`;
}

export function buildDnsInstructions({ domain, projectName }) {
  const normalized = normalizeDomain(domain);
  const target = pagesTarget(projectName);
  const isApex = normalized === apexDomain(normalized);
  return {
    domain: normalized,
    projectName,
    target,
    records: [
      {
        type: 'CNAME',
        name: normalized,
        value: target,
        proxied: false,
        note: 'Use this for subdomains such as www.example.com or menu.example.com.',
      },
      {
        type: 'CNAME',
        name: `www.${apexDomain(normalized)}`,
        value: target,
        proxied: false,
        note: 'Use this when the customer wants www on the root brand domain.',
      },
    ],
    customerMessage: dnsMessage({ domain: normalized, target, isApex }),
  };
}

export function inspectDns({ domain, projectName }) {
  const normalized = normalizeDomain(domain);
  const target = pagesTarget(projectName);
  const records = {
    ns: dig(normalized, 'NS'),
    cname: dig(normalized, 'CNAME'),
    a: dig(normalized, 'A'),
    aaaa: dig(normalized, 'AAAA'),
  };
  const cnameMatchesPages = records.cname.some((record) => stripDot(record) === target);
  return {
    domain: normalized,
    projectName,
    target,
    records,
    status: {
      hasNameservers: records.ns.length > 0,
      hasCname: records.cname.length > 0,
      cnameMatchesPages,
      hasA: records.a.length > 0,
      hasAAAA: records.aaaa.length > 0,
      readyForPagesAttach: cnameMatchesPages || records.ns.some((record) => record.includes('cloudflare.com')),
    },
    instructions: buildDnsInstructions({ domain: normalized, projectName }),
    checkedAt: new Date().toISOString(),
  };
}

function dig(domain, type) {
  try {
    const output = execFileSync('dig', ['+short', domain, type], { encoding: 'utf8', timeout: 8000 });
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function stripDot(value) {
  return String(value || '').replace(/\.$/, '');
}

function apexDomain(domain) {
  const parts = normalizeDomain(domain).split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : parts.join('.');
}

function dnsMessage({ domain, target, isApex }) {
  if (isApex) {
    return [
      `Point ${domain} to the preview/live site.`,
      `If DNS is on Cloudflare, add CNAME ${domain} -> ${target}. Cloudflare will flatten the root CNAME.`,
      `If DNS is not on Cloudflare, use www.${domain} CNAME ${target}, then redirect the root domain to www.${domain}.`,
      'After DNS propagates, WebJuice can attach the custom domain in Cloudflare Pages.',
    ].join('\n');
  }

  return [
    `Point ${domain} to the preview/live site by adding a CNAME record:`,
    `${domain} CNAME ${target}`,
    'After DNS propagates, WebJuice can attach the custom domain in Cloudflare Pages.',
  ].join('\n');
}
