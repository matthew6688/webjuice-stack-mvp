#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { createLeadIntake } from '../../core/leads/intake.js';
import { createLeadResearch } from '../../core/leads/research.js';
import { createRedesignCheck, REDESIGN_CHECK_DECISIONS } from '../../core/leads/redesign-check.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'redesign-check-'));

try {
  const roofingClient = 'northside-roofing';
  const roofingResearch = createLeadResearch({
    intake: createLeadIntake({
      clientSlug: roofingClient,
      sourceType: 'manual',
      businessName: 'Northside Roofing',
      industry: 'roofing contractor',
      websiteUrl: 'https://northside.example',
      email: 'hello@northside.example',
      observations: ['Current site feels dated and mobile CTA is weak'],
      services: ['roof replacement', 'storm repair'],
    }),
    niche: 'generic',
  });
  const roofingCheck = createRedesignCheck({ research: roofingResearch });

  assert.equal(roofingCheck.familyId, 'field_service');
  assert.equal(roofingCheck.decision, REDESIGN_CHECK_DECISIONS.REDESIGN_PREVIEW);
  assert.ok(roofingCheck.redesignValue.some((item) => /service area|quote/i.test(item)));
  assert.ok(roofingCheck.upgradeTargets.includes('quote or call CTA'));

  const lawClient = 'crown-legal';
  const lawResearch = createLeadResearch({
    intake: createLeadIntake({
      clientSlug: lawClient,
      sourceType: 'manual',
      businessName: 'Crown Legal',
      industry: 'law firm',
      websiteUrl: 'https://crownlegal.example',
      email: 'hello@crownlegal.example',
      observations: ['The current site looks generic and makes practice areas hard to scan.'],
      services: ['commercial law', 'dispute resolution'],
    }),
    niche: 'generic',
  });
  const lawCheck = createRedesignCheck({ research: lawResearch });

  assert.equal(lawCheck.familyId, 'professional_service');
  assert.equal(lawCheck.decision, REDESIGN_CHECK_DECISIONS.REDESIGN_PREVIEW);
  assert.ok(lawCheck.redesignValue.some((item) => /expertise|credible|consultation/i.test(item)));
  assert.ok(lawCheck.upgradeTargets.includes('practice-area clarity'));

  const teaserCheck = createRedesignCheck({
    research: createLeadResearch({
      intake: createLeadIntake({
        clientSlug: 'soft-signal-salon',
        sourceType: 'manual',
        businessName: 'Soft Signal Salon',
        industry: 'salon',
        email: 'hello@softsignal.example',
        observations: ['Only a thin profile and social snippets are available so far.'],
        services: ['colour', 'cut'],
        currentWebsiteQuality: 'good',
      }),
      niche: 'generic',
    }),
  });

  assert.equal(teaserCheck.decision, REDESIGN_CHECK_DECISIONS.NOT_APPLICABLE);

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      roofingDecision: roofingCheck.decision,
      lawDecision: lawCheck.decision,
      teaserDecision: teaserCheck.decision,
    },
  }, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
