#!/usr/bin/env node

import assert from 'assert/strict';
import { BUILD_MODES, LEAD_GATE_STATUS, createLeadIntake, createLeadIntakeFromLeadRecord } from '../../core/leads/intake.js';

const starter = createLeadIntake({
  sourceType: 'google_places',
  businessName: 'Starter Dental',
  industry: 'dental clinic',
  city: 'Brisbane',
  phone: '+61 7 3000 1111',
  observations: ['Strong local reviews but no website link on Google profile'],
});

assert.equal(starter.buildMode, BUILD_MODES.STARTER);
assert.equal(starter.gateStatus, LEAD_GATE_STATUS.READY_FOR_PREVIEW);
assert.equal(starter.contactability.status, 'reachable');
assert.ok(starter.facts.placeholderCandidates.about, 'starter should generate placeholder about content');
assert.equal(starter.strategy.problemType, 'no_website');

const redesign = createLeadIntake({
  sourceType: 'manual',
  businessName: 'Northside Roofing',
  industry: 'roofing contractor',
  websiteUrl: 'https://northside.example/',
  contactPageUrl: 'https://northside.example/contact',
  observations: ['Current site feels dated and mobile CTA is weak'],
  services: ['roof replacement', 'storm repair'],
});

assert.equal(redesign.buildMode, BUILD_MODES.REDESIGN);
assert.equal(redesign.gateStatus, LEAD_GATE_STATUS.READY_FOR_REDESIGN_PREVIEW);
assert.equal(redesign.openDesignHandoffDraft.redesign.isRedesign, true);
assert.ok(redesign.strategy.heroAngle.includes('website'), 'redesign hero angle should be business-specific');
assert.equal(redesign.strategy.familyId, 'field_service');
assert.deepEqual(redesign.openDesignHandoffDraft.strategy.coreSections, ['hero', 'services', 'service-area', 'proof', 'cta']);

const roofRestoration = createLeadIntake({
  sourceType: 'manual',
  businessName: 'Skyline Roofing Restorations',
  industry: 'roof restoration',
  websiteUrl: 'https://skylineroofingrestorations.example/',
  email: 'hello@skyline.example',
  phone: '0415 346 001',
  observations: ['Current page could make the quote path clearer'],
  services: ['roof restoration', 'ridge cap repointing'],
});

assert.equal(roofRestoration.strategy.familyId, 'field_service');
assert.equal(roofRestoration.strategy.primaryCTA, 'Call now');

const teaser = createLeadIntake({
  sourceType: 'imported_list',
  businessName: 'Quiet Stone Law',
  industry: 'law firm',
  email: 'hello@quietstone.example',
});

assert.equal(teaser.buildMode, BUILD_MODES.TEASER);
assert.equal(teaser.gateStatus, LEAD_GATE_STATUS.READY_FOR_TEASER);
assert.ok(teaser.facts.placeholderCandidates.testimonial, 'teaser should still generate complete placeholder content');
assert.equal(teaser.strategy.familyId, 'professional_service');

const blocked = createLeadIntake({
  sourceType: 'manual',
  businessName: 'Mystery Salon',
  industry: 'salon',
  observations: ['Looks promising but no public contact path yet'],
});

assert.equal(blocked.gateStatus, LEAD_GATE_STATUS.BLOCKED_UNREACHABLE);
assert.equal(blocked.buildMode, BUILD_MODES.OUTREACH_ONLY);
assert.ok(blocked.facts.missingCritical.includes('No reachable contact channel'));
assert.equal(blocked.strategy.familyId, 'studio_or_visual');

const googlePlacesLead = createLeadIntakeFromLeadRecord({
  lead: {
    name: 'Riverfront Dental',
    address: '10 Eagle St, Brisbane',
    phone: '+61 7 3111 2222',
    website: '',
    google_maps_url: 'https://maps.google.com/?cid=riverfront',
    rating: 4.8,
    review_count: 180,
    niche: 'dental clinic',
    types: ['dentist'],
  },
});

assert.equal(googlePlacesLead.sourceType, 'google_places');
assert.equal(googlePlacesLead.buildMode, BUILD_MODES.STARTER);
assert.equal(googlePlacesLead.project.businessName, 'Riverfront Dental');
assert.equal(googlePlacesLead.facts.verified.googleMapsUrl, 'https://maps.google.com/?cid=riverfront');

console.log(JSON.stringify({
  ok: true,
  assertions: {
    starterMode: starter.buildMode,
    redesignMode: redesign.buildMode,
    roofRestorationFamily: roofRestoration.strategy.familyId,
    teaserMode: teaser.buildMode,
    blockedStatus: blocked.gateStatus,
    googlePlacesMode: googlePlacesLead.buildMode,
    placeholderHero: teaser.facts.placeholderCandidates.heroHeadline,
  },
}, null, 2));
