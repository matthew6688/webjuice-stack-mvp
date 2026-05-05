#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { handleDomainRequest } from '../../core/domain/domain-request.js';

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

const assertions = {
  freeDryRunReady: free.status === 'dry_run_ready',
  freeCreatesCnameStep: free.steps.some((item) => item.id === 'upsert-profitslocal-cname'),
  freeWritesState: fs.existsSync(path.join(root, 'data/domain/requests/opa-bar-mezze-restaurant', `${free.id}.json`)),
  customerSubdomainWaitsForDns: customerSubdomain.status === 'waiting_for_customer_dns',
  customerSubdomainHasInstructions: customerSubdomain.dns.instructions.customerMessage.includes('CNAME'),
  rootRequiresReview: rootDomain.status === 'needs_root_domain_review',
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
