#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import { assessPaidIntakeReadiness } from '../../core/funnel/paid-intake-readiness.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  loadLocalEnv();
  main({ args: parseArgs() });
}

export function main({ args = {}, payload: providedPayload = null, outputDir = null, silent = false } = {}) {
  const payload = providedPayload || readPayload(args);
  const now = new Date().toISOString();
  const clientSlug = safeId(payload.client_slug || payload.clientSlug || slugify(payload.business_name || payload.company || 'paid-intake'));
  const orderId = safeId(payload.order_id || payload.orderId || 'unknown-order');
  const dir = path.join(outputDir || args.outputDir || 'data/paid-intakes', clientSlug);
  const intakePath = path.join(dir, `${orderId}.json`);
  const timelinePath = path.join(dir, `${orderId}-timeline.jsonl`);
  const existing = readJsonIfExists(intakePath);

  const nextBase = {
    schemaVersion: 1,
    ...(existing || {}),
    status: 'intake_submitted',
    clientSlug,
    orderId,
    customer: {
      ...(existing?.customer || {}),
      company: payload.business_name || payload.company || existing?.customer?.company || '',
      email: payload.email || existing?.customer?.email || '',
      phone: payload.phone || existing?.customer?.phone || '',
      domain: payload.preferred_domain || payload.domain || existing?.customer?.domain || '',
    },
    intake: {
      ...(existing?.intake || {}),
      businessType: payload.business_type || payload.businessType || '',
      address: payload.address || '',
      hours: payload.hours || '',
      services: payload.services || '',
      primaryAction: payload.primary_action || payload.primaryAction || '',
      visualDirection: payload.visual_direction || payload.visualDirection || '',
      references: payload.references || '',
      notes: payload.notes || '',
      files: normalizeFiles(payload.files || payload.attachment_summary || payload.attachments || []),
      lastSubmissionSource: 'structured_intake_form',
    },
    leadDelivery: {
      ...(existing?.leadDelivery || {}),
      recipientEmail: payload.lead_recipient_email || payload.leadRecipientEmail || existing?.leadDelivery?.recipientEmail || payload.email || '',
      fallbackEmail: payload.email || existing?.leadDelivery?.fallbackEmail || '',
      senderMode: existing?.leadDelivery?.senderMode || 'profitslocal_default',
    },
    firstVersionConfirmation: buildFirstVersionConfirmation(payload, existing),
    updatedAt: now,
    createdAt: existing?.createdAt || now,
  };

  const readiness = assessPaidIntakeReadiness(nextBase);
  const next = {
    ...nextBase,
    status: statusForReadiness(readiness.status),
    readiness,
  };

  const event = {
    id: `intake_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: 'intake_submitted',
    clientSlug,
    orderId,
    email: next.customer.email,
    readiness: next.readiness,
    files: next.intake.files,
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
    readiness: next.readiness,
    leadDelivery: next.leadDelivery,
    firstVersionConfirmation: next.firstVersionConfirmation,
    files: next.intake.files.length,
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
  if (process.env.PAID_INTAKE_PAYLOAD) return JSON.parse(process.env.PAID_INTAKE_PAYLOAD);
  throw new Error('Missing payload. Use --input, --payload-json, or PAID_INTAKE_PAYLOAD.');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeFiles(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || '').split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

function buildFirstVersionConfirmation(payload, existing) {
  const previous = existing?.firstVersionConfirmation || {};
  const confirmed = bool(payload.confirm_generate_v1) && bool(payload.confirm_one_page_scope) && bool(payload.confirm_refund_policy);
  if (!confirmed && previous.confirmed) return previous;
  return {
    confirmed,
    confirmedAt: confirmed ? new Date().toISOString() : '',
    confirmedByEmail: confirmed ? payload.email || previous.confirmedByEmail || '' : '',
    onePageScopeAccepted: bool(payload.confirm_one_page_scope),
    refundPolicyAccepted: bool(payload.confirm_refund_policy),
    generationAccepted: bool(payload.confirm_generate_v1),
  };
}

function statusForReadiness(status) {
  if (status === 'ready_for_agent_task') return 'intake_ready_for_review';
  if (status === 'needs_generation_confirmation') return 'intake_needs_generation_confirmation';
  return 'intake_needs_more_info';
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

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
