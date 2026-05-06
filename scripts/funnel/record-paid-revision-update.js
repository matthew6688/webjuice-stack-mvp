#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { includedRevisionsForTier } from '../../core/funnel/paid-intake-index.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  loadLocalEnv();
  main({ args: parseArgs() });
}

export function main({ args = {}, payload: providedPayload = null, root = null, silent = false } = {}) {
  const payload = providedPayload || readPayload(args);
  const now = new Date().toISOString();
  const baseDir = root || args.root || 'data/paid-intakes';
  const orderId = safeId(payload.order_id || payload.orderId);
  const clientSlug = safeId(payload.client_slug || payload.clientSlug || findClientSlugForOrder(baseDir, orderId) || 'unknown-client');
  if (!orderId || orderId === 'unknown') throw new Error('Revision payload requires order_id.');
  if (!payload.email) throw new Error('Revision payload requires email.');
  if (!payload.requested_changes && !payload.requestedChanges) throw new Error('Revision payload requires requested_changes.');

  const dir = path.join(baseDir, clientSlug);
  const intakePath = path.join(dir, `${orderId}.json`);
  const timelinePath = path.join(dir, `${orderId}-timeline.jsonl`);
  const existing = readJsonIfExists(intakePath) || {
    schemaVersion: 1,
    clientSlug,
    orderId,
    status: 'revision_without_intake_record',
    customer: {
      email: payload.email || '',
      company: payload.business_name || payload.company || clientSlug,
      phone: payload.phone || '',
      domain: payload.preferred_domain || payload.domain || '',
    },
    intake: { files: [], assets: [] },
    createdAt: now,
  };
  const revisions = Array.isArray(existing.revisions) ? existing.revisions : [];
  const acceptedCount = revisions.filter((revision) => revision.accepted !== false).length;
  const revisionLimit = Number(existing.revisionPolicy?.includedRevisions || includedRevisionsForTier(existing.order?.tier));
  const revisionNumber = acceptedCount + 1;
  const accepted = revisionNumber <= revisionLimit;
  const revision = {
    id: safeId(payload.revision_id || `rev_${Date.now()}`),
    revisionNumber,
    accepted,
    status: accepted ? 'revision_submitted' : 'revision_needs_extra_payment',
    requestedChanges: payload.requested_changes || payload.requestedChanges || '',
    scopeAcknowledged: bool(payload.confirm_revision_scope),
    email: payload.email || '',
    files: normalizeFiles(payload.files || payload.attachment_summary || []),
    assets: normalizeAssets(payload.asset_refs || payload.assetRefs || []),
    submittedAt: now,
  };
  const next = {
    ...existing,
    status: accepted ? 'revision_requested' : 'revision_over_limit',
    revisionPolicy: {
      ...(existing.revisionPolicy || {}),
      includedRevisions: revisionLimit,
      usedRevisions: accepted ? revisionNumber : acceptedCount,
      remainingRevisions: Math.max(0, revisionLimit - (accepted ? revisionNumber : acceptedCount)),
    },
    revisions: [...revisions, revision],
    updatedAt: now,
  };
  const event = {
    id: `revision_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: revision.status,
    clientSlug,
    orderId,
    revisionNumber,
    accepted,
    createdAt: now,
  };

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(intakePath, `${JSON.stringify(next, null, 2)}\n`);
  fs.appendFileSync(timelinePath, `${JSON.stringify(event)}\n`);

  const summary = {
    ok: true,
    intakePath,
    timelinePath,
    clientSlug,
    orderId,
    status: next.status,
    accepted,
    revisionNumber,
    revisionLimit,
    remainingRevisions: next.revisionPolicy.remainingRevisions,
    revisionStatus: revision.status,
    files: revision.files,
    assets: revision.assets,
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
  if (process.env.PAID_REVISION_PAYLOAD) return JSON.parse(process.env.PAID_REVISION_PAYLOAD);
  throw new Error('Missing payload. Use --input, --payload-json, or PAID_REVISION_PAYLOAD.');
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

function normalizeFiles(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || '').split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

function normalizeAssets(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function bool(value) {
  return value === true || value === 'true' || value === 'on' || value === 'yes' || value === '1';
}

function safeId(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'unknown';
}
