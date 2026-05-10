#!/usr/bin/env node

import { onRequestPost as domainRequest } from '../../functions/api/domain-request.ts';

const calls = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options = {}) => {
  const bodyText = typeof options.body === 'string' ? options.body : '';
  let body = null;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
  }
  calls.push({ url: String(url), method: options.method || 'GET', body });
  return {
    ok: true,
    status: String(url).includes('api.github.com') ? 204 : 200,
    text: async () => '',
    json: async () => ({ ok: true }),
  };
};

try {
  const profitslocal = await runRequest({
    client_slug: 'opa-bar-mezze-restaurant',
    order_id: 'cs_test_domain_entrypoint_001',
    email: 'owner@example.com',
    domain: '',
  });
  const customerSubdomain = await runRequest({
    client_slug: 'opa-bar-mezze-restaurant',
    order_id: 'cs_test_domain_entrypoint_002',
    email: 'owner@example.com',
    domain: 'menu.opabar.example',
  });
  const rootDomain = await runRequest({
    client_slug: 'opa-bar-mezze-restaurant',
    order_id: 'cs_test_domain_entrypoint_003',
    email: 'owner@example.com',
    domain: 'opabar.example',
  });

  const dispatches = calls.filter((call) => call.url.includes('/actions/workflows/domain-request.yml/dispatches'));
  const assertions = {
    profitslocalSuccess: profitslocal.response.status === 200 && profitslocal.body.success === true,
    profitslocalClassified: profitslocal.body.route?.type === 'profitslocal_subdomain',
    profitslocalDryRunDispatch: dispatches[0]?.body?.inputs?.execute === 'false',
    profitslocalProjectDefaulted: dispatches[0]?.body?.inputs?.project === 'opa-bar-mezze-restaurant-live',
    customerSubdomainClassified: customerSubdomain.body.route?.type === 'customer_subdomain',
    customerSubdomainKeepsDomain: dispatches[1]?.body?.inputs?.domain === 'menu.opabar.example',
    rootDomainClassified: rootDomain.body.route?.type === 'customer_root_domain',
    rootDomainStaysReviewOnly: rootDomain.body.route?.message?.includes('DNS/email audit') === true,
  };
  const failed = Object.entries(assertions).filter(([, value]) => value !== true).map(([key]) => key);

  console.log(JSON.stringify({
    ok: failed.length === 0,
    assertions,
    failed,
    dispatches: dispatches.map((item) => item.body),
  }, null, 2));

  if (failed.length) process.exit(1);
} finally {
  globalThis.fetch = originalFetch;
}

async function runRequest(body) {
  const response = await domainRequest(createJsonContext({
    url: 'https://profitslocal.com/api/domain-request',
    body,
    env: {
      AGENT_GITHUB_TOKEN: 'ghs_test_123',
      AGENT_REPO: 'matthew6688/webjuice-stack-mvp',
      AGENT_REF: 'main',
      DOMAIN_REQUEST_DRY_RUN: 'true',
    },
  }));
  return {
    response,
    body: await response.json(),
  };
}

function createJsonContext({ url, body, env }) {
  const waited = [];
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    waited,
    waitUntil(promise) {
      waited.push(Promise.resolve(promise));
    },
  };
}
