import fs from 'fs';
import path from 'path';
import { artifactTimestamp } from '../time.js';

export const DEFAULT_ENTITLEMENTS_DIR = 'data/funnel/orders';

export function createEntitlementFromOrder(order, options = {}) {
  const tier = order.tier || 'unknown';
  const now = artifactTimestamp();
  const entitlement = {
    schemaVersion: 1,
    orderId: order.orderId,
    stripeSessionId: order.provider === 'stripe' ? order.orderId : '',
    provider: order.provider || 'tally',
    clientSlug: order.clientSlug,
    repo: order.repo,
    previewUrl: order.previewUrl,
    customer: {
      company: order.company || '',
      email: order.email || '',
      domain: order.domain || '',
    },
    tier,
    status: 'active',
    revisionPolicy: revisionPolicyForTier(tier, now),
    revisionUsed: 0,
    revisionEvents: [],
    createdAt: now,
    updatedAt: now,
  };

  validateEntitlement(entitlement);
  if (!options.dryRun) saveEntitlement(entitlement, options.entitlementsDir);
  return entitlement;
}

export function consumeRevisionEntitlement(order, options = {}) {
  const entitlement = findEntitlementForOrder(order, options.entitlementsDir);
  if (!entitlement) {
    return {
      ok: false,
      reason: 'entitlement_not_found',
      message: 'No active entitlement matched both order ID and customer email.',
      entitlement: null,
    };
  }

  const reset = resetPolicyWindowIfNeeded(entitlement, options.now || artifactTimestamp());
  if (!canUseRevision(entitlement)) {
    return {
      ok: false,
      reason: 'revision_limit_reached',
      message: revisionLimitMessage(entitlement),
      entitlement,
    };
  }

  const event = {
    id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    orderId: order.orderId || '',
    requestedAt: artifactTimestamp(),
    email: order.email || '',
    feedback: order.feedback || '',
    usedBefore: entitlement.revisionUsed,
    usedAfter: entitlement.revisionUsed + 1,
  };
  entitlement.revisionUsed += 1;
  entitlement.revisionEvents.push(event);
  entitlement.updatedAt = artifactTimestamp();

  if (!options.dryRun) saveEntitlement(entitlement, options.entitlementsDir);
  return {
    ok: true,
    reason: reset ? 'revision_allowed_after_period_reset' : 'revision_allowed',
    entitlement,
    revisionEvent: event,
  };
}

export function addExtraRevisionEntitlement(order, options = {}) {
  const parentOrderId = order.parentOrderId || order.parent_order_id || '';
  if (!parentOrderId) {
    return {
      ok: false,
      reason: 'missing_parent_order_id',
      message: 'Extra revision purchase must include the original Order ID.',
      entitlement: null,
    };
  }
  const entitlement = findEntitlementForOrder({
    ...order,
    orderId: parentOrderId,
  }, options.entitlementsDir);
  if (!entitlement) {
    return {
      ok: false,
      reason: 'parent_entitlement_not_found',
      message: 'No active original order matched both parent Order ID and checkout email.',
      entitlement: null,
    };
  }
  const currentLimit = Number(entitlement.revisionPolicy?.limit || 0);
  const event = {
    id: `extra_rev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    extraOrderId: order.orderId || '',
    parentOrderId,
    purchasedAt: artifactTimestamp(),
    email: order.email || '',
    limitBefore: currentLimit,
    limitAfter: currentLimit + 1,
    amount: Number(order.amount || 0),
    currency: order.currency || 'USD',
  };
  entitlement.revisionPolicy.limit = event.limitAfter;
  entitlement.revisionPolicy.description = `${event.limitAfter} total revision request${event.limitAfter === 1 ? '' : 's'} after extra revision purchase.`;
  entitlement.extraRevisionEvents = [...(entitlement.extraRevisionEvents || []), event];
  entitlement.updatedAt = artifactTimestamp();
  if (!options.dryRun) saveEntitlement(entitlement, options.entitlementsDir);
  return {
    ok: true,
    reason: 'extra_revision_added',
    entitlement,
    extraRevisionEvent: event,
  };
}

export function findEntitlementForOrder(order, entitlementsDir = DEFAULT_ENTITLEMENTS_DIR) {
  const orderId = order.orderId || order.stripeSessionId || '';
  const clientSlug = order.clientSlug || '';
  const email = normalizeEmail(order.email);
  if (!orderId) return null;
  if (!email) return null;

  const exact = readEntitlement(path.join(entitlementsDir, clientSlug || '_unknown', `${safeId(orderId)}.json`))
    || findEntitlementByOrderId(entitlementsDir, orderId);
  if (!exact) return null;
  if (exact.status !== 'active') return null;
  if (normalizeEmail(exact.customer?.email) !== email) return null;
  if (order.repo && exact.repo !== order.repo) return null;
  return exact;
}

export function entitlementPath(entitlement, entitlementsDir = DEFAULT_ENTITLEMENTS_DIR) {
  return path.join(
    entitlementsDir,
    entitlement.clientSlug || '_unknown',
    `${safeId(entitlement.orderId)}.json`,
  );
}

function saveEntitlement(entitlement, entitlementsDir = DEFAULT_ENTITLEMENTS_DIR) {
  const outputPath = entitlementPath(entitlement, entitlementsDir);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(entitlement, null, 2)}\n`);
  return outputPath;
}

function readEntitlement(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const entitlement = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  validateEntitlement(entitlement);
  return entitlement;
}

function findEntitlementByOrderId(entitlementsDir, orderId) {
  if (!fs.existsSync(entitlementsDir)) return null;
  const fileName = `${safeId(orderId)}.json`;
  for (const clientSlug of fs.readdirSync(entitlementsDir)) {
    const candidate = readEntitlement(path.join(entitlementsDir, clientSlug, fileName));
    if (candidate) return candidate;
  }
  return null;
}

function revisionPolicyForTier(tier, now) {
  if (tier === 'yearly_maintenance') {
    return {
      type: 'monthly',
      limit: 1,
      periodStart: now,
      periodEnd: addMonths(now, 1),
      description: 'One maintenance request per monthly period.',
    };
  }
  return {
    type: 'lifetime',
    limit: tier === 'one_time' ? 3 : 0,
    periodStart: null,
    periodEnd: null,
    description: 'Three lifetime revision requests after purchase.',
  };
}

function resetPolicyWindowIfNeeded(entitlement, now) {
  const policy = entitlement.revisionPolicy;
  if (policy?.type !== 'monthly') return false;
  if (!policy.periodEnd || Date.parse(now) < Date.parse(policy.periodEnd)) return false;
  policy.periodStart = now;
  policy.periodEnd = addMonths(now, 1);
  entitlement.revisionUsed = 0;
  entitlement.revisionEvents = [];
  entitlement.updatedAt = now;
  return true;
}

function canUseRevision(entitlement) {
  const limit = Number(entitlement.revisionPolicy?.limit || 0);
  if (limit <= 0) return false;
  return Number(entitlement.revisionUsed || 0) < limit;
}

function revisionLimitMessage(entitlement) {
  const policy = entitlement.revisionPolicy || {};
  if (policy.type === 'monthly') {
    return `Monthly maintenance request limit reached (${entitlement.revisionUsed}/${policy.limit}). Next period starts after ${policy.periodEnd}.`;
  }
  return `Revision limit reached (${entitlement.revisionUsed}/${policy.limit}).`;
}

function validateEntitlement(entitlement) {
  const errors = [];
  if (!entitlement.orderId) errors.push('orderId is required');
  if (!entitlement.clientSlug) errors.push('clientSlug is required');
  if (!entitlement.repo) errors.push('repo is required');
  if (!entitlement.tier) errors.push('tier is required');
  if (!entitlement.status) errors.push('status is required');
  if (!entitlement.revisionPolicy?.type) errors.push('revisionPolicy.type is required');
  if (!Number.isFinite(Number(entitlement.revisionPolicy?.limit))) errors.push('revisionPolicy.limit is required');
  if (!Number.isFinite(Number(entitlement.revisionUsed))) errors.push('revisionUsed is required');
  if (!Array.isArray(entitlement.revisionEvents)) errors.push('revisionEvents must be an array');
  if (errors.length) throw new Error(`Invalid entitlement: ${errors.join('; ')}`);
}

function addMonths(value, months) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function safeId(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'unknown';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}
