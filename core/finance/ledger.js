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
];

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
    return true;
  });

  const totals = {
    cost: 0,
    revenue: 0,
    profit: 0,
    roi: null,
    eventCount: filtered.length,
    byCategory: {},
    byProvider: {},
  };

  for (const event of filtered) {
    totals[event.type] += event.amount;
    const signed = event.type === 'revenue' ? event.amount : -event.amount;
    totals.byCategory[event.category] = (totals.byCategory[event.category] || 0) + signed;
    totals.byProvider[event.provider] = (totals.byProvider[event.provider] || 0) + signed;
  }

  totals.profit = totals.revenue - totals.cost;
  totals.roi = totals.cost > 0 ? totals.profit / totals.cost : null;
  return totals;
}

export function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 4,
  }).format(amount);
}
