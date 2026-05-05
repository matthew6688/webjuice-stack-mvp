#!/usr/bin/env node

import { resolveLaunchRoute } from '../../core/domain/launch-route.js';

const cases = [
  {
    name: 'blank defaults to our subdomain',
    input: { clientSlug: 'opa-bar-mezze-restaurant' },
    expect: { route: 'profitslocal_subdomain', domain: 'opa-bar-mezze-restaurant.profitslocal.com', requiresCustomerDns: false },
  },
  {
    name: 'requested ProfitsLocal subdomain stays under our control',
    input: { clientSlug: 'opa-bar-mezze-restaurant', requestedDomain: 'opa-controlled.profitslocal.com' },
    expect: { route: 'profitslocal_subdomain', domain: 'opa-controlled.profitslocal.com', requiresCustomerDns: false },
  },
  {
    name: 'root ProfitsLocal request is normalized to client subdomain',
    input: { clientSlug: 'opa-bar-mezze-restaurant', requestedDomain: 'profitslocal.com' },
    expect: { route: 'profitslocal_root', domain: 'opa-bar-mezze-restaurant.profitslocal.com', requiresCustomerDns: false },
  },
  {
    name: 'ProfitsLocal subpage is allowed but waits for the public router',
    input: { clientSlug: 'opa-bar-mezze-restaurant', requestedDomain: 'https://profitslocal.com/opa' },
    expect: { route: 'profitslocal_subpage', domain: 'profitslocal.com', path: '/opa', requiresCloudflareAttach: false },
  },
  {
    name: 'customer apex domain requires DNS handoff',
    input: { clientSlug: 'opa-bar-mezze-restaurant', requestedDomain: 'opabar.com.au' },
    expect: { route: 'customer_root_domain', domain: 'opabar.com.au', requiresCustomerDns: true },
  },
  {
    name: 'customer subdomain requires CNAME handoff',
    input: { clientSlug: 'opa-bar-mezze-restaurant', requestedDomain: 'menu.opabar.com.au' },
    expect: { route: 'customer_subdomain', domain: 'menu.opabar.com.au', requiresCustomerDns: true },
  },
];

const results = cases.map((item) => {
  const actual = resolveLaunchRoute(item.input);
  const failed = Object.entries(item.expect)
    .filter(([key, value]) => actual[key] !== value)
    .map(([key, value]) => ({ key, expected: value, actual: actual[key] }));
  return { name: item.name, ok: failed.length === 0, failed, actual };
});
const failed = results.filter((result) => !result.ok);

console.log(JSON.stringify({
  ok: failed.length === 0,
  results,
}, null, 2));

if (failed.length) process.exit(1);
