#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { allowedAdminActions } from '../../core/funnel/paid-intake-actions.js';
import { createEvidenceItem, resolveEvidence } from '../../core/evidence/evidence.js';
import { main as recordAdminAction } from './record-paid-intake-action.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-intake-admin-actions-'));
const clientsRoot = path.join(root, 'clients');
const casesRoot = path.join(root, 'cases');
const clientDir = path.join(root, 'admin-client');
fs.mkdirSync(clientDir, { recursive: true });
writeEvidencePack(path.join(clientsRoot, 'admin-client', 'evidence', 'evidence.json'));
const intakePath = path.join(clientDir, 'cs_test_admin.json');
fs.writeFileSync(intakePath, JSON.stringify({
  schemaVersion: 1,
  status: 'paid_intake_pending_preview',
  clientSlug: 'admin-client',
  orderId: 'cs_test_admin',
  customer: { company: 'Admin Client', email: 'owner@example.com' },
  firstVersionConfirmation: { confirmed: true },
  intake: { files: ['logo.png'], assets: [] },
  createdAt: '2026-05-06T00:00:00.000Z',
  updatedAt: '2026-05-06T00:00:00.000Z',
}), 'utf8');

const firstActions = allowedAdminActions(JSON.parse(fs.readFileSync(intakePath, 'utf8')));
const confirmed = recordAdminAction({
  root,
  silent: true,
  args: { clientsRoot, casesRoot },
  payload: {
    client_slug: 'admin-client',
    order_id: 'cs_test_admin',
    action: 'confirm_website_ready',
    actor: 'ops@example.com',
  },
});
const afterConfirmActions = allowedAdminActions(JSON.parse(fs.readFileSync(intakePath, 'utf8')));
const started = recordAdminAction({
  root,
  silent: true,
  payload: {
    client_slug: 'admin-client',
    order_id: 'cs_test_admin',
    action: 'mark_v1_started',
    actor: 'ops@example.com',
  },
});
const delivered = recordAdminAction({
  root,
  silent: true,
  payload: {
    client_slug: 'admin-client',
    order_id: 'cs_test_admin',
    action: 'mark_v1_delivered',
    actor: 'ops@example.com',
  },
});
const updated = JSON.parse(fs.readFileSync(intakePath, 'utf8'));
const timeline = fs.readFileSync(path.join(clientDir, 'cs_test_admin-timeline.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const assertions = {
  pendingAllowsConfirm: firstActions.includes('confirm_website_ready') || firstActions.includes('mark_v1_started'),
  confirmedReady: confirmed.status === 'intake_ready_for_review' && confirmed.websiteReady?.readyToBuild === true,
  writesSurvey: fs.existsSync(path.join(clientsRoot, 'admin-client', 'intake', 'website-survey.json')),
  writesBuildPacket: fs.existsSync(path.join(casesRoot, 'admin-client', 'cs_test_admin', 'build-packet.md')),
  readyAllowsStart: afterConfirmActions.includes('mark_v1_started'),
  startedStatus: started.status === 'v1_generation_started',
  deliveredStatus: delivered.status === 'v1_delivered',
  storesFirstVersionDates: Boolean(updated.firstVersion?.startedAt && updated.firstVersion?.deliveredAt),
  storesConfirmation: updated.firstVersionConfirmation?.confirmed === true && updated.websiteReady?.readyToBuild === true,
  appendsAdminActions: updated.adminActions.length === 3 && timeline.length === 3,
};
const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, root, assertions, failed, confirmed, started, delivered, firstVersion: updated.firstVersion };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

function writeEvidencePack(evidencePath) {
  const scrapedAt = '2026-05-06T00:00:00.000Z';
  const base = {
    sourceType: 'official_site',
    sourceUrl: 'https://admin-client.example',
    confidence: 0.92,
    scrapedAt,
    extractor: 'paid_intake_admin_action_test',
  };
  const items = [
    ['identity.name', 'Admin Client'],
    ['contact.address', '1 Admin Street, Brisbane QLD'],
    ['contact.phone', '+61 7 5555 1111'],
    ['contact.website', 'https://admin-client.example'],
    ['cta.call', 'tel:+61755551111'],
    ['cta.map', 'https://www.google.com/maps/search/?api=1&query=1%20Admin%20Street%20Brisbane'],
    ['menu.source', 'https://admin-client.example/menu'],
    ['menu.sections', [{ name: 'Dinner', items: [{ name: 'Halloumi', price: '18', sourceUrl: 'https://admin-client.example/menu' }] }]],
    ['offer.primary', 'Restaurant website with verified menu and booking details'],
    ['brand.designDirection', 'Formal hospitality website'],
    ['brand.colors', ['#102a33', '#f7f0e6', '#d55b32']],
  ].map(([key, value]) => createEvidenceItem({ key, value, ...base }));
  const pack = {
    schemaVersion: 1,
    clientSlug: 'admin-client',
    niche: 'restaurant',
    businessName: 'Admin Client',
    createdAt: scrapedAt,
    updatedAt: scrapedAt,
    items,
    resolved: resolveEvidence(items),
  };
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(pack, null, 2)}\n`);
}
