#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { adminActionDefinition } from '../../core/funnel/paid-intake-actions.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  loadLocalEnv();
  main({ args: parseArgs() });
}

export function main({ args = {}, payload: providedPayload = null, root = null, silent = false } = {}) {
  const payload = providedPayload || readPayload(args);
  const action = String(payload.action || '').trim();
  const definition = adminActionDefinition(action);
  if (!definition) throw new Error(`Unknown admin action: ${action || '(missing)'}`);
  if (definition.needsNote && !String(payload.note || '').trim()) throw new Error(`${action} requires a note.`);

  const baseDir = root || args.root || 'data/paid-intakes';
  const orderId = safeId(payload.order_id || payload.orderId);
  const clientSlug = safeId(payload.client_slug || payload.clientSlug || findClientSlugForOrder(baseDir, orderId));
  if (!clientSlug || clientSlug === 'unknown' || !orderId || orderId === 'unknown') {
    throw new Error('Admin action requires client_slug and order_id.');
  }
  const dir = path.join(baseDir, clientSlug);
  const intakePath = path.join(dir, `${orderId}.json`);
  const timelinePath = path.join(dir, `${orderId}-timeline.jsonl`);
  const existing = readJsonIfExists(intakePath);
  if (!existing) throw new Error(`Paid intake record not found: ${intakePath}`);

  const now = new Date().toISOString();
  const timelineEvent = {
    id: `admin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: definition.eventType,
    action,
    actor: payload.actor || payload.email || 'admin',
    note: String(payload.note || '').trim(),
    clientSlug,
    orderId,
    createdAt: now,
  };
  const next = {
    ...existing,
    status: definition.status,
    adminActions: [
      ...(Array.isArray(existing.adminActions) ? existing.adminActions : []),
      timelineEvent,
    ],
    updatedAt: now,
  };
  if (definition.sets?.firstVersionStartedAt) {
    next.firstVersion = { ...(existing.firstVersion || {}), startedAt: existing.firstVersion?.startedAt || now };
  }
  if (definition.sets?.firstVersionDeliveredAt) {
    next.firstVersion = { ...(next.firstVersion || existing.firstVersion || {}), deliveredAt: existing.firstVersion?.deliveredAt || now };
  }
  if (definition.revisionStatus && Array.isArray(next.revisions) && next.revisions.length) {
    const revisions = [...next.revisions];
    const latest = { ...revisions[revisions.length - 1] };
    latest.status = definition.revisionStatus;
    latest.reviewedAt = now;
    latest.reviewedBy = timelineEvent.actor;
    latest.reviewNote = timelineEvent.note;
    latest.accepted = action !== 'reject_latest_revision';
    revisions[revisions.length - 1] = latest;
    next.revisions = revisions;
  }

  fs.writeFileSync(intakePath, `${JSON.stringify(next, null, 2)}\n`);
  fs.appendFileSync(timelinePath, `${JSON.stringify(timelineEvent)}\n`);
  const summary = {
    ok: true,
    intakePath,
    timelinePath,
    clientSlug,
    orderId,
    action,
    status: next.status,
    event: timelineEvent,
    latestRevisionStatus: Array.isArray(next.revisions) ? next.revisions.at(-1)?.status || '' : '',
  };
  if (args.output) fs.writeFileSync(args.output, `${JSON.stringify(summary, null, 2)}\n`);
  if (!silent) console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function parseArgs() {
  const parsed = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    parsed[key] = next?.startsWith('--') ? true : (next || true);
  }
  return parsed;
}

function readPayload(parsed) {
  if (parsed.input) return JSON.parse(fs.readFileSync(parsed.input, 'utf8'));
  if (parsed['payload-json']) return JSON.parse(String(parsed['payload-json']));
  if (process.env.PAID_INTAKE_ACTION_PAYLOAD) return JSON.parse(process.env.PAID_INTAKE_ACTION_PAYLOAD);
  throw new Error('Missing payload. Use --input, --payload-json, or PAID_INTAKE_ACTION_PAYLOAD.');
}

function findClientSlugForOrder(root, orderId) {
  if (!orderId || !fs.existsSync(root)) return '';
  for (const clientSlug of fs.readdirSync(root)) {
    const candidate = path.join(root, clientSlug, `${safeId(orderId)}.json`);
    if (fs.existsSync(candidate)) return clientSlug;
  }
  return '';
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeId(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'unknown';
}
