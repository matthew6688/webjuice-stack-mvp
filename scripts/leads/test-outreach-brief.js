#!/usr/bin/env node

import assert from 'assert/strict';
import { createLeadIntake } from '../../core/leads/intake.js';
import { createLeadResearch } from '../../core/leads/research.js';
import { createRedesignCheck } from '../../core/leads/redesign-check.js';
import { createOutreachBrief } from '../../core/leads/outreach-brief.js';

const roofingResearch = createLeadResearch({
  intake: createLeadIntake({
    clientSlug: 'northside-roofing',
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
const roofingRedesign = createRedesignCheck({ research: roofingResearch });
const roofingBrief = createOutreachBrief({ research: roofingResearch, redesignCheck: roofingRedesign });

assert.equal(roofingBrief.familyId, 'field_service');
assert.equal(roofingBrief.previewMode, 'redesign_preview');
assert.equal(roofingBrief.channelRecommendation, 'email');
assert.ok(/quote|mobile/i.test(roofingBrief.diagnosis));
assert.equal(roofingBrief.followUps.length, 2);
assert.ok(roofingBrief.subjectLines.length >= 3);

const salonResearch = createLeadResearch({
  intake: createLeadIntake({
    clientSlug: 'soft-signal-salon',
    sourceType: 'manual',
    businessName: 'Soft Signal Salon',
    industry: 'salon',
    email: 'hello@softsignal.example',
    instagramUrl: 'https://instagram.com/softsignal',
    observations: ['Only a thin profile and social snippets are available so far.'],
    services: ['colour', 'cut'],
    currentWebsiteQuality: 'good',
  }),
  niche: 'generic',
});
const salonBrief = createOutreachBrief({ research: salonResearch });

assert.equal(salonBrief.familyId, 'studio_or_visual');
assert.equal(salonBrief.previewMode, 'starter_preview');
assert.equal(salonBrief.channelRecommendation, 'instagram_dm');
assert.ok(/mockup|version/i.test(salonBrief.coldMessage));

console.log(JSON.stringify({
  ok: true,
  assertions: {
    roofingChannel: roofingBrief.channelRecommendation,
    roofingPreviewMode: roofingBrief.previewMode,
    salonChannel: salonBrief.channelRecommendation,
    salonPreviewMode: salonBrief.previewMode,
  },
}, null, 2));
