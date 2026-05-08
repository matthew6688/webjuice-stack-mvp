#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { createEvidenceItem, resolveEvidence } from '../../core/evidence/evidence.js';
import { buildRestaurantDesignBrief } from '../../core/design/restaurant-brief.js';
import { createLeadResearch } from '../../core/leads/research.js';
import { createBuildReadyDecision, BUILD_READY_STATUS } from '../../core/leads/build-ready.js';
import { buildRestaurantContentFromEvidence } from '../../niches/restaurant/adapter.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-ready-'));
const previousCwd = process.cwd();
process.chdir(tmp);

try {
  const restaurantClient = 'sunset-noodle-house';
  const evidencePath = writeRestaurantEvidence(restaurantClient);
  const contentResult = buildRestaurantContentFromEvidence(readJson(evidencePath), { sourceEvidencePath: evidencePath });
  writeJson(path.join('clients', restaurantClient, 'content.restaurant.json'), contentResult.content);
  writeJson(
    path.join('clients', restaurantClient, 'design.restaurant.json'),
    buildRestaurantDesignBrief(contentResult.content, { sourceContentPath: evidencePath })
  );

  const readyDecision = createBuildReadyDecision({
    clientSlug: restaurantClient,
    sourceType: 'google_places',
    businessName: 'Sunset Noodle House',
    industry: 'restaurant',
    city: 'Brisbane',
    email: 'hello@sunset.example',
    evidencePath,
    contentPath: path.join('clients', restaurantClient, 'content.restaurant.json'),
    designPath: path.join('clients', restaurantClient, 'design.restaurant.json'),
  });

  assert.equal(readyDecision.status, BUILD_READY_STATUS.READY_FOR_OPEN_DESIGN);
  assert.equal(readyDecision.websiteReady?.readyToBuild, true);

  const teaserDecision = createBuildReadyDecision({
    research: createLeadResearch({
      sourceType: 'manual',
      businessName: 'Thin Context Studio',
      industry: 'interior design',
      email: 'hello@thin.example',
    }),
  });
  assert.equal(teaserDecision.status, BUILD_READY_STATUS.READY_FOR_TEASER);

  const blockedDecision = createBuildReadyDecision({
    research: createLeadResearch({
      sourceType: 'manual',
      businessName: 'Ghost Prospect',
      industry: 'salon',
    }),
  });
  assert.equal(blockedDecision.status, BUILD_READY_STATUS.BLOCKED_UNREACHABLE);

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      readyStatus: readyDecision.status,
      readyReadiness: readyDecision.websiteReady?.readiness,
      teaserStatus: teaserDecision.status,
      blockedStatus: blockedDecision.status,
    },
  }, null, 2));
} finally {
  process.chdir(previousCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}

function writeRestaurantEvidence(clientSlug) {
  const evidencePath = path.join('clients', clientSlug, 'evidence', 'evidence.json');
  const scrapedAt = '2026-05-08T09:00:00.000Z';
  const base = {
    sourceType: 'official_site',
    sourceUrl: 'https://sunset.example',
    confidence: 0.92,
    scrapedAt,
    extractor: 'build_ready_test',
  };
  const items = [
    ['identity.name', 'Sunset Noodle House'],
    ['business.niche', 'restaurant'],
    ['business.city', 'Brisbane'],
    ['contact.address', '55 Wharf St, Brisbane QLD'],
    ['contact.phone', '+61 7 3555 4444'],
    ['contact.email', 'hello@sunset.example'],
    ['contact.website', 'https://sunset.example'],
    ['cta.call', 'tel:+61735554444'],
    ['cta.map', 'https://www.google.com/maps/search/?api=1&query=55%20Wharf%20St%20Brisbane'],
    ['menu.source', 'https://sunset.example/menu'],
    ['menu.sections', [{ name: 'Noodles', items: [{ name: 'Beef Brisket', price: '24', sourceUrl: 'https://sunset.example/menu' }] }]],
    ['offer.primary', 'A polished noodle house website with menu and bookings'],
    ['brand.designDirection', 'Warm hospitality with clear booking flow'],
    ['brand.logo', 'https://sunset.example/logo.png'],
    ['brand.colors', ['#102a33', '#f4ede1', '#ce6f40']],
  ].map(([key, value]) => createEvidenceItem({ key, value, ...base }));

  writeJson(evidencePath, {
    schemaVersion: 1,
    clientSlug,
    niche: 'restaurant',
    businessName: 'Sunset Noodle House',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
    resolved: resolveEvidence(items),
  });
  return evidencePath;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
