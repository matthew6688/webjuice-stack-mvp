#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { createEvidenceItem, resolveEvidence } from '../../core/evidence/evidence.js';
import { createLeadIntake, BUILD_MODES } from '../../core/leads/intake.js';
import { createLeadResearch } from '../../core/leads/research.js';
import { buildRestaurantContentFromEvidence } from '../../niches/restaurant/adapter.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-research-'));

try {
  const clientSlug = 'harbour-glow-bistro';
  const evidencePath = writeRestaurantEvidence(clientSlug, restaurantEvidenceItems());
  const content = buildRestaurantContentFromEvidence(JSON.parse(fs.readFileSync(evidencePath, 'utf8')));
  writeJson(path.join(tmp, 'clients', clientSlug, 'content.restaurant.json'), content.content);

  const starterIntake = createLeadIntake({
    clientSlug,
    sourceType: 'google_places',
    businessName: 'Harbour Glow Bistro',
    industry: 'restaurant',
    city: 'Brisbane',
    websiteUrl: '',
    email: 'hello@harbourglow.example',
    googleMapsUrl: 'https://maps.google.com/?cid=harbour-glow',
    observations: ['Strong Google presence but no official site linked.'],
    services: ['all-day dining', 'cocktails'],
  });

  const starterResearch = createLeadResearch({
    intake: starterIntake,
    niche: 'restaurant',
    evidencePath,
    contentPath: path.join(tmp, 'clients', clientSlug, 'content.restaurant.json'),
  });

  assert.equal(starterResearch.buildMode, BUILD_MODES.STARTER);
  assert.equal(starterResearch.previewability.status, 'ready_for_preview');
  assert.equal(starterResearch.productionReadiness.status, 'ready_for_open_design');
  assert.ok(starterResearch.facts.verified.menuUrl.includes('/menu'));
  assert.ok(starterResearch.facts.placeholderCandidates.heroHeadline);

  const redesignClient = 'northside-roofing';
  const redesignIntake = createLeadIntake({
    clientSlug: redesignClient,
    sourceType: 'manual',
    businessName: 'Northside Roofing',
    industry: 'roofing contractor',
    websiteUrl: 'https://northside.example',
    email: 'hello@northside.example',
    observations: ['Current site feels dated and mobile CTA is weak'],
    services: ['roof replacement', 'storm repair'],
  });

  const redesignResearch = createLeadResearch({
    intake: redesignIntake,
    niche: 'generic',
  });

  assert.equal(redesignResearch.buildMode, BUILD_MODES.REDESIGN);
  assert.equal(redesignResearch.redesign.isRedesign, true);
  assert.equal(redesignResearch.redesign.hasPreservationPacket, true);
  assert.ok(Array.isArray(redesignResearch.redesign.value));

  const blockedResearch = createLeadResearch({
    intake: createLeadIntake({
      sourceType: 'manual',
      businessName: 'Ghost Prospect',
      industry: 'salon',
      observations: ['No contact path anywhere.'],
    }),
    niche: 'generic',
  });

  assert.equal(blockedResearch.previewability.status, 'blocked_unreachable');
  assert.equal(blockedResearch.productionReadiness.status, 'blocked_unreachable');

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      starterPreviewability: starterResearch.previewability.status,
      starterProductionReadiness: starterResearch.productionReadiness.status,
      redesignPreservation: redesignResearch.redesign.hasPreservationPacket,
      blockedStatus: blockedResearch.previewability.status,
    },
  }, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

function writeRestaurantEvidence(clientSlug, items) {
  const evidencePath = path.join(tmp, 'clients', clientSlug, 'evidence', 'evidence.json');
  writeJson(evidencePath, {
    schemaVersion: 1,
    clientSlug,
    niche: 'restaurant',
    businessName: 'Harbour Glow Bistro',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
    resolved: resolveEvidence(items),
  });
  return evidencePath;
}

function restaurantEvidenceItems() {
  const scrapedAt = '2026-05-08T08:00:00.000Z';
  const base = {
    sourceType: 'official_site',
    sourceUrl: 'https://harbourglow.example',
    confidence: 0.92,
    scrapedAt,
    extractor: 'lead_research_test',
  };
  return [
    ['identity.name', 'Harbour Glow Bistro'],
    ['business.niche', 'restaurant'],
    ['business.city', 'Brisbane'],
    ['contact.address', '11 River Terrace, Brisbane QLD'],
    ['contact.phone', '+61 7 3555 0101'],
    ['contact.email', 'hello@harbourglow.example'],
    ['contact.website', 'https://harbourglow.example'],
    ['cta.call', 'tel:+61735550101'],
    ['cta.map', 'https://www.google.com/maps/search/?api=1&query=11%20River%20Terrace%20Brisbane'],
    ['menu.source', 'https://harbourglow.example/menu'],
    ['menu.sections', [{ name: 'Dinner', items: [{ name: 'Market Fish', price: '36', sourceUrl: 'https://harbourglow.example/menu' }] }]],
    ['brand.logo', 'https://harbourglow.example/logo.png'],
    ['brand.colors', ['#18222c', '#f5efe6', '#c66b3d']],
    ['reviews.rating', 4.7],
    ['reviews.count', 148],
  ].map(([key, value]) => createEvidenceItem({ key, value, ...base }));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
