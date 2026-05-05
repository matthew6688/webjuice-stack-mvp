#!/usr/bin/env node

import { deleteDnsRecordByName, findZoneByName } from '../../core/domain/cloudflare-dns.js';
import { deletePagesDomain, listPagesDomains } from '../../core/domain/cloudflare-pages.js';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

const DEFAULT_ROOT_DOMAIN = 'profitslocal.com';

const args = parseArgs();
const domain = String(args.domain || '').trim().toLowerCase();
const project = String(args.project || '').trim();
const rootDomain = String(args.rootDomain || DEFAULT_ROOT_DOMAIN).trim().toLowerCase();
const execute = args.execute === 'true';
const allowNonSmoke = args.allowNonSmoke === 'true';

if (!domain || !project) {
  console.error('Usage: node scripts/domain/cleanup.js --domain smoke.example.com --project pages-project [--execute true] [--allowNonSmoke true]');
  process.exit(1);
}

if (!allowNonSmoke && !domain.includes('smoke')) {
  throw new Error(`Refusing to clean non-smoke domain without --allowNonSmoke true: ${domain}`);
}

if (!process.env.CF_API_TOKEN) throw new Error('CF_API_TOKEN is required');
if (!process.env.CF_ACCOUNT_ID) throw new Error('CF_ACCOUNT_ID is required');

const token = process.env.CF_API_TOKEN;
const accountId = process.env.CF_ACCOUNT_ID;
const zoneId = process.env.CF_ZONE_ID || (await findZoneByName({ token, name: rootDomain }))?.id;
if (!zoneId) throw new Error(`Cloudflare zone not found for ${rootDomain}`);

const beforePagesDomains = await listPagesDomains({ accountId, token, projectName: project });
const pagesDomain = beforePagesDomains.find((item) => item.name === domain) || null;

const plan = {
  domain,
  project,
  rootDomain,
  execute,
  checks: {
    smokeGuard: allowNonSmoke || domain.includes('smoke'),
    pagesDomainFound: Boolean(pagesDomain),
    zoneIdFound: Boolean(zoneId),
  },
  actions: [
    {
      id: 'delete-pages-domain',
      execute,
      message: pagesDomain
        ? `Delete Cloudflare Pages custom domain ${domain} from ${project}.`
        : `Cloudflare Pages custom domain ${domain} is not attached to ${project}.`,
      result: null,
    },
    {
      id: 'delete-dns-cname',
      execute,
      message: `Delete CNAME ${domain} in ${rootDomain} zone if it exists.`,
      result: null,
    },
  ],
};

if (execute) {
  plan.actions[0].result = await deletePagesDomain({ accountId, token, projectName: project, domain });
  plan.actions[1].result = await deleteDnsRecordByName({ token, zoneId, name: domain, types: ['CNAME'] });
}

console.log(JSON.stringify(plan, null, 2));

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
