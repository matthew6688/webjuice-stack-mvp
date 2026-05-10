import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
export const DEFAULT_LEDGER_PATH = path.join(repoRoot, 'data/finance/ledger.jsonl');

export const LEDGER_CATEGORIES = [
  'google_places',
  'firecrawl',
  'openai',
  'image_generation',
  'ocr',
  'resend',
  'domain',
  'cloudflare',
  'tally',
  'labor_estimate',
  'sale',
  'other',
  // V2 enrichment + LLM stack (added 2026-05-10)
  'tinyfish',           // legacy generic; existing TinyFishExtractor.fetchPages writes this
  'perplexity',
  'dokobot',
  'tinyfish_search',
  'tinyfish_fetch',
  'ddg_local',
  'kimi',
  'anthropic',
  'provider_rate_limited',
  'provider_unavailable',
];

export const LEDGER_TIERS = ['T0', 'T1', 'T2', 'T3'];

export function createLedgerEvent(input) {
  const amount = Number(input.amount ?? Number(input.units ?? 0) * Number(input.unitCost ?? 0));
  const event = {
    id: input.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    clientSlug: input.clientSlug || null,
    campaignId: input.campaignId || null,
    type: input.type,
    category: input.category,
    units: Number(input.units ?? 1),
    unitCost: Number(input.unitCost ?? amount),
    amount,
    currency: input.currency || 'USD',
    provider: input.provider || 'manual',
    metadata: input.metadata || {},
    createdAt: input.createdAt || new Date().toISOString(),
    // V2 fields — all optional, default null for backward compatibility
    leadId: input.leadId || null,
    stage: input.stage || null,
    purpose: input.purpose || null,
    tier: input.tier || null,
    keyId: input.keyId || null,
    requestHash: input.requestHash || null,
  };

  validateLedgerEvent(event);
  return event;
}

export function validateLedgerEvent(event) {
  const errors = [];
  if (!event.type || !['cost', 'revenue'].includes(event.type)) {
    errors.push('type must be cost or revenue');
  }
  if (!event.category || !LEDGER_CATEGORIES.includes(event.category)) {
    errors.push(`category must be one of: ${LEDGER_CATEGORIES.join(', ')}`);
  }
  if (!Number.isFinite(event.units)) errors.push('units must be a number');
  if (!Number.isFinite(event.unitCost)) errors.push('unitCost must be a number');
  if (!Number.isFinite(event.amount)) errors.push('amount must be a number');
  if (!event.currency) errors.push('currency is required');
  if (!event.provider) errors.push('provider is required');
  if (!event.createdAt || Number.isNaN(Date.parse(event.createdAt))) {
    errors.push('createdAt must be an ISO date string');
  }
  // V2 optional-field validation: only enforce shape when present
  if (event.tier != null && !LEDGER_TIERS.includes(event.tier)) {
    errors.push(`tier must be one of: ${LEDGER_TIERS.join(', ')}`);
  }
  if (event.leadId != null && typeof event.leadId !== 'string') {
    errors.push('leadId must be a string when provided');
  }
  if (event.stage != null && typeof event.stage !== 'string') {
    errors.push('stage must be a string when provided');
  }
  if (event.purpose != null && typeof event.purpose !== 'string') {
    errors.push('purpose must be a string when provided');
  }
  if (event.keyId != null && typeof event.keyId !== 'string') {
    errors.push('keyId must be a string when provided');
  }
  if (event.requestHash != null && typeof event.requestHash !== 'string') {
    errors.push('requestHash must be a string when provided');
  }
  if (errors.length) {
    throw new Error(`Invalid ledger event: ${errors.join('; ')}`);
  }
}

export function appendLedgerEvent(input, ledgerPath = DEFAULT_LEDGER_PATH) {
  const event = createLedgerEvent(input);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(event)}\n`);
  return event;
}

export function readLedger(ledgerPath = DEFAULT_LEDGER_PATH) {
  if (!fs.existsSync(ledgerPath)) return [];
  return fs.readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        const event = JSON.parse(line);
        validateLedgerEvent(event);
        return event;
      } catch (error) {
        throw new Error(`Invalid ledger line ${index + 1}: ${error.message}`);
      }
    });
}

export function summarizeLedger(events, filters = {}) {
  const filtered = events.filter((event) => {
    if (filters.clientSlug && event.clientSlug !== filters.clientSlug) return false;
    if (filters.campaignId && event.campaignId !== filters.campaignId) return false;
    if (filters.currency && event.currency !== filters.currency) return false;
    if (filters.leadId && event.leadId !== filters.leadId) return false;
    if (filters.stage && event.stage !== filters.stage) return false;
    if (filters.tier && event.tier !== filters.tier) return false;
    if (filters.purpose && event.purpose !== filters.purpose) return false;
    return true;
  });

  const totals = {
    cost: 0,
    revenue: 0,
    profit: 0,
    roi: null,
    costEventCount: 0,
    revenueEventCount: 0,
    eventCount: filtered.length,
    byCategory: {},
    byProvider: {},
    byClient: {},
    // V2 rollups — let admin and per-lead reports slice cost by these
    byLead: {},
    byStage: {},
    byTier: {},
    byPurpose: {},
    byKeyId: {},
  };

  for (const event of filtered) {
    totals[event.type] += event.amount;
    if (event.type === 'cost') totals.costEventCount += 1;
    if (event.type === 'revenue') totals.revenueEventCount += 1;
    const signed = event.type === 'revenue' ? event.amount : -event.amount;
    totals.byCategory[event.category] = (totals.byCategory[event.category] || 0) + signed;
    totals.byProvider[event.provider] = (totals.byProvider[event.provider] || 0) + signed;
    const clientKey = event.clientSlug || 'unassigned';
    totals.byClient[clientKey] = (totals.byClient[clientKey] || 0) + signed;
    // V2 optional rollups — only bucket events that carry the field
    if (event.leadId) totals.byLead[event.leadId] = (totals.byLead[event.leadId] || 0) + signed;
    if (event.stage) totals.byStage[event.stage] = (totals.byStage[event.stage] || 0) + signed;
    if (event.tier) totals.byTier[event.tier] = (totals.byTier[event.tier] || 0) + signed;
    if (event.purpose) totals.byPurpose[event.purpose] = (totals.byPurpose[event.purpose] || 0) + signed;
    if (event.keyId) totals.byKeyId[event.keyId] = (totals.byKeyId[event.keyId] || 0) + signed;
  }

  totals.profit = totals.revenue - totals.cost;
  totals.roi = totals.cost > 0 ? totals.profit / totals.cost : null;
  return totals;
}

/**
 * Per-lead cost rollup for /admin/leads/<slug> and per-lead reports.
 * Returns the spend (cost only, not net) bucketed by tier/category/purpose.
 */
export function summarizeLeadSpend(events, leadId) {
  const leadEvents = events.filter((e) => e.leadId === leadId && e.type === 'cost');
  const summary = {
    leadId,
    eventCount: leadEvents.length,
    totalCost: 0,
    byTier: { T0: 0, T1: 0, T2: 0, T3: 0, untracked: 0 },
    byCategory: {},
    byPurpose: {},
    byStage: {},
  };
  for (const e of leadEvents) {
    summary.totalCost += e.amount;
    const tierKey = e.tier && LEDGER_TIERS.includes(e.tier) ? e.tier : 'untracked';
    summary.byTier[tierKey] += e.amount;
    summary.byCategory[e.category] = (summary.byCategory[e.category] || 0) + e.amount;
    if (e.purpose) summary.byPurpose[e.purpose] = (summary.byPurpose[e.purpose] || 0) + e.amount;
    if (e.stage) summary.byStage[e.stage] = (summary.byStage[e.stage] || 0) + e.amount;
  }
  return summary;
}

/**
 * sha256 helper for V2 requestHash field. Lets us dedupe identical calls
 * (same provider + same prompt) so a retry doesn't double-bill in reports.
 */
export async function hashRequest(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  const { createHash } = await import('crypto');
  return createHash('sha256').update(text).digest('hex');
}

export function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 4,
  }).format(amount);
}
