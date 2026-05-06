#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { allowedAdminActions } from '../../core/funnel/paid-intake-actions.js';
import { main as recordAdminAction } from './record-paid-intake-action.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-intake-admin-actions-'));
const clientDir = path.join(root, 'admin-client');
fs.mkdirSync(clientDir, { recursive: true });
const intakePath = path.join(clientDir, 'cs_test_admin.json');
fs.writeFileSync(intakePath, JSON.stringify({
  schemaVersion: 1,
  status: 'intake_ready_for_review',
  clientSlug: 'admin-client',
  orderId: 'cs_test_admin',
  customer: { company: 'Admin Client', email: 'owner@example.com' },
  firstVersionConfirmation: { confirmed: true },
  intake: { files: ['logo.png'], assets: [] },
  createdAt: '2026-05-06T00:00:00.000Z',
  updatedAt: '2026-05-06T00:00:00.000Z',
}), 'utf8');

const firstActions = allowedAdminActions(JSON.parse(fs.readFileSync(intakePath, 'utf8')));
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
  readyAllowsStart: firstActions.includes('mark_v1_started'),
  startedStatus: started.status === 'v1_generation_started',
  deliveredStatus: delivered.status === 'v1_delivered',
  storesFirstVersionDates: Boolean(updated.firstVersion?.startedAt && updated.firstVersion?.deliveredAt),
  appendsAdminActions: updated.adminActions.length === 2 && timeline.length === 2,
};
const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, root, assertions, failed, started, delivered, firstVersion: updated.firstVersion };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
