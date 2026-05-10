#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { buildWebsiteReady, READINESS } from '../../core/intake/website-ready.js';
import { createEvidenceItem, resolveEvidence } from '../../core/evidence/evidence.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'website-ready-'));

try {
  const complete = writeEvidence('complete-client', completeItems());
  const outbound = buildWebsiteReady({
    clientSlug: 'complete-client',
    evidencePath: complete,
    sourceType: 'outbound',
  });
  assert.equal(outbound.survey.readiness, READINESS.READY);
  assert.equal(outbound.survey.readyToBuild, true);
  assert.match(outbound.buildPacket, /Astro \+ Cloudflare Pages/);
  assert.match(outbound.buildPacket, /Discord website-tasks thread/);
  assert.match(outbound.buildPacket, /huashu-design \/ open-design/);

  const paid = buildWebsiteReady({
    clientSlug: 'complete-client',
    evidencePath: complete,
    sourceType: 'paid_intake',
  });
  assert.equal(paid.survey.readiness, READINESS.NEEDS_CONFIRMATION);
  assert.equal(paid.survey.readyToBuild, false);

  const confirmed = buildWebsiteReady({
    clientSlug: 'complete-client',
    evidencePath: complete,
    sourceType: 'paid_intake',
    customerConfirmed: true,
  });
  assert.equal(confirmed.survey.readiness, READINESS.READY);

  const missing = writeEvidence('missing-client', completeItems().filter((item) => item.key !== 'contact.phone'));
  const missingResult = buildWebsiteReady({
    clientSlug: 'missing-client',
    evidencePath: missing,
    sourceType: 'outbound',
  });
  assert.equal(missingResult.survey.readiness, READINESS.NEEDS_INFO);
  assert.ok(missingResult.survey.missing.some((item) => item.includes('phone') || item.includes('contact')));

  console.log('website-ready tests passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

function writeEvidence(clientSlug, items) {
  const evidencePath = path.join(tmp, 'clients', clientSlug, 'evidence', 'evidence.json');
  const pack = {
    schemaVersion: 1,
    clientSlug,
    niche: 'restaurant',
    businessName: clientSlug,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
    resolved: resolveEvidence(items),
  };
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(pack, null, 2)}\n`);
  return evidencePath;
}

function completeItems() {
  const scrapedAt = '2026-05-06T00:00:00.000Z';
  const base = {
    sourceType: 'official_site',
    sourceUrl: 'https://example.test',
    confidence: 0.92,
    scrapedAt,
    extractor: 'website_ready_test',
  };
  return [
    ['identity.name', 'Example Bistro'],
    ['contact.address', '1 Test Street, Brisbane QLD'],
    ['contact.phone', '+61 7 5555 0000'],
    ['contact.website', 'https://example.test'],
    ['cta.call', 'tel:+61755550000'],
    ['cta.map', 'https://www.google.com/maps/search/?api=1&query=1%20Test%20Street%20Brisbane'],
    ['menu.source', 'https://example.test/menu'],
    ['menu.sections', [{ name: 'Snacks', items: [{ name: 'Olives', price: '12', sourceUrl: 'https://example.test/menu' }] }]],
    ['offer.primary', 'Modern restaurant website with verified menu and booking details'],
    ['brand.designDirection', 'Quiet premium hospitality website'],
    ['brand.colors', ['#102a33', '#f7f0e6', '#d55b32']],
    ['brand.logo', '/images/logo.png'],
  ].map(([key, value]) => createEvidenceItem({ key, value, ...base }));
}
