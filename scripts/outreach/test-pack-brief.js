#!/usr/bin/env node

import assert from 'assert/strict';
import { buildOutreachPack } from '../../core/outreach/pack.js';

const pack = buildOutreachPack({
  clientSlug: 'northside-roofing',
  manifest: {
    rendererContract: {
      allowedInputs: {
        content: 'clients/northside-roofing/content.generic.json',
        design: 'clients/northside-roofing/design.generic.json',
        brandSpec: '',
      },
    },
  },
  content: {
    hero: { name: 'Northside Roofing' },
    contact: { address: 'Brisbane' },
    cta: {},
    menu: {},
  },
  design: { directions: [{ name: 'Practical trust' }], assetProtocol: { warnings: [] } },
  previewUrl: 'https://northside-roofing-dev.pages.dev',
  outreachBrief: {
    diagnosis: 'Current site undersells the service area and makes quotes feel harder than they should.',
    coldMessage: 'Hey Northside, I mocked up a version that makes the quote path clearer on mobile.',
    subjectLines: ['Built something for Northside Roofing'],
    proofPoints: ['Main improvement angle: quote or call CTA'],
    channelRecommendation: 'email',
    previewMode: 'redesign_preview',
  },
});

assert.equal(pack.emailBrief.subject, 'Built something for Northside Roofing');
assert.ok(pack.emailBrief.proofPoints.includes('Main improvement angle: quote or call CTA'));
assert.equal(pack.outreachBrief.channelRecommendation, 'email');
assert.equal(pack.outreachBrief.previewMode, 'redesign_preview');

console.log(JSON.stringify({
  ok: true,
  assertions: {
    subjectFromBrief: true,
    proofPointsFromBrief: true,
    briefPersisted: true,
  },
}, null, 2));
