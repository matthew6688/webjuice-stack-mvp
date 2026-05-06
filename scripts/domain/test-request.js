#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { handleDomainRequest } from '../../core/domain/domain-request.js';
import { buildDomainStatusEmail } from '../../core/funnel/customer-email.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-request-'));

const free = await handleDomainRequest({
  clientSlug: 'opa-bar-mezze-restaurant',
  orderId: 'cs_test_domain_001',
  email: 'owner@example.com',
  domain: 'opa-controlled.profitslocal.com',
}, {
  root,
  execute: false,
});

const customerSubdomain = await handleDomainRequest({
  clientSlug: 'opa-bar-mezze-restaurant',
  orderId: 'cs_test_domain_002',
  email: 'owner@example.com',
  domain: 'menu.opabar.example',
}, {
  root,
  execute: false,
});

const rootDomain = await handleDomainRequest({
  clientSlug: 'opa-bar-mezze-restaurant',
  orderId: 'cs_test_domain_003',
  email: 'owner@example.com',
  domain: 'opabar.example',
}, {
  root,
  execute: false,
});

let missingZoneError = '';
try {
  await handleDomainRequest({
    clientSlug: 'opa-bar-mezze-restaurant',
    orderId: 'cs_test_domain_004',
    email: 'owner@example.com',
    domain: 'opa-controlled.profitslocal.com',
  }, {
    root,
    execute: true,
    cfToken: 'test-token',
    cfAccountId: 'test-account',
  });
} catch (error) {
  missingZoneError = error.message;
}

const assertions = {
  freeDryRunReady: free.status === 'dry_run_ready',
  freeCreatesCnameStep: free.steps.some((item) => item.id === 'upsert-profitslocal-cname'),
  freeWritesState: fs.existsSync(path.join(root, 'data/domain/requests/opa-bar-mezze-restaurant', `${free.id}.json`)),
  activeEmailSaysConnected: buildDomainStatusEmail({ domainRequest: { ...free, status: 'active' } })?.text.includes('Your domain is connected'),
  customerSubdomainWaitsForDns: customerSubdomain.status === 'waiting_for_customer_dns',
  customerSubdomainHasInstructions: customerSubdomain.dns.instructions.customerMessage.includes('CNAME'),
  customerSubdomainEmailHasCname: buildDomainStatusEmail({ domainRequest: customerSubdomain })?.text.includes('CNAME menu.opabar.example -> opa-bar-mezze-restaurant-live.pages.dev'),
  rootRequiresReview: rootDomain.status === 'needs_root_domain_review',
  rootEmailWarnsBeforeDnsChange: buildDomainStatusEmail({ domainRequest: rootDomain })?.text.includes('do not change root DNS'),
  executeProfitsLocalRequiresZoneId: missingZoneError.includes('CF_ZONE_ID is required'),
};
const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([key]) => key);
console.log(JSON.stringify({
  ok: failed.length === 0,
  root,
  assertions,
  failed,
  free: { id: free.id, status: free.status, domain: free.domain, target: free.target },
  customerSubdomain: { status: customerSubdomain.status, domain: customerSubdomain.domain },
  rootDomain: { status: rootDomain.status, domain: rootDomain.domain },
}, null, 2));

if (failed.length) process.exit(1);
