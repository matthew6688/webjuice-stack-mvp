#!/usr/bin/env node

import {
  buildAgentReviewEmail,
  buildFunnelCustomerEmail,
  buildLivePublishedEmail,
} from '../../core/funnel/customer-email.js';

const order = {
  orderId: 'cs_test_domain_email_001',
  clientSlug: 'opa-bar-mezze-restaurant',
  company: 'Opa Bar & Mezze',
  email: 'owner@example.com',
  tier: 'one_time',
  amount: 399,
  currency: 'USD',
  domain: 'opa.example.com',
  previewUrl: 'https://opa-bar-mezze-restaurant-dev.pages.dev',
};
const entitlement = {
  entitlement: {
    revisionPolicy: {
      limit: 3,
      description: '3 included revision rounds',
    },
  },
};
const caseFile = {
  clientSlug: order.clientSlug,
  previewUrl: order.previewUrl,
  order: { id: order.orderId },
  customer: {
    company: order.company,
    email: order.email,
    domain: order.domain,
  },
  revision: {
    used: 1,
    policy: { limit: 3 },
  },
};
const sale = buildFunnelCustomerEmail({ kind: 'sale', order, entitlement });
const review = buildAgentReviewEmail({
  caseFile,
  runResult: { previewUrl: order.previewUrl, changedFiles: ['src/pages/index.astro'] },
  deployResult: { status: 'completed', conclusion: 'success' },
});
const live = buildLivePublishedEmail({
  caseFile,
  publishResult: { commit: 'livecommit123', liveUrl: `https://${order.domain}` },
  deployResult: { status: 'completed', conclusion: 'success' },
});

const assertions = {
  saleIncludesPreferredDomain: sale?.text?.includes(order.domain),
  saleIncludesOfficialDomainSetup: sale?.text?.includes('https://profitslocal.com/domain-setup?'),
  reviewIncludesOfficialDomainSetup: review?.text?.includes('https://profitslocal.com/domain-setup?'),
  reviewIncludesOfficialApproval: review?.text?.includes('https://profitslocal.com/approve?'),
  reviewIncludesOfficialRevision: review?.text?.includes('https://profitslocal.com/revision?'),
  noCustomerDomainHelp: !`${sale?.text}\n${review?.text}\n${live?.text}`.includes('/domain-help'),
  noCustomerRevise: !`${sale?.text}\n${review?.text}\n${live?.text}`.includes('pages.dev/revise'),
  liveIncludesOfficialRevisionSupport: live?.text?.includes('https://profitslocal.com/revision?'),
  liveIncludesDomainSupport: live?.text?.includes('Domain/subdomain support'),
};
const failed = Object.entries(assertions)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  assertions,
  failed,
  samples: {
    sale: sale?.text,
    review: review?.text,
    live: live?.text,
  },
}, null, 2));

if (failed.length) process.exit(1);
