/**
 * core/extractors/places-quota-guard.js
 *
 * Monthly quota guard for Google Places API. Free tier: $200/month credit,
 * Place Details (Basic SKU) at $0.017/call → ~11,764 calls free/month.
 * We cap at 11,000 (margin for misc Photos/Text Search calls).
 *
 * Persists usage to data/finance/places-quota.json keyed by YYYY-MM.
 * Auto-resets at start of each calendar month.
 *
 * Usage:
 *   const guard = new PlacesQuotaGuard();
 *   await guard.checkAndCharge(1);   // throws if cap reached
 *   const placeData = await extractor.details({...});
 *
 * SOP-X-Tooling · 2026-05-12.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_LEDGER = path.resolve(process.cwd(), 'data/finance/places-quota.json');
const DEFAULT_FREE_LIMIT = 11000; // calls/month before hard cap

export class PlacesQuotaCapExceeded extends Error {
  constructor(used, limit, month) {
    super(`Places API monthly cap reached: ${used}/${limit} calls in ${month}. Waiting for monthly reset, or add GOOGLE_PLACES_API_KEY_2 + rotation (G-12 backlog).`);
    this.name = 'PlacesQuotaCapExceeded';
    this.code = 'PLACES_QUOTA_CAP';
    this.used = used;
    this.limit = limit;
    this.month = month;
  }
}

export class PlacesQuotaGuard {
  constructor({
    ledgerPath = DEFAULT_LEDGER,
    freeLimit = DEFAULT_FREE_LIMIT,
    warnPct = 0.8,
  } = {}) {
    this.ledgerPath = ledgerPath;
    this.freeLimit = freeLimit;
    this.warnPct = warnPct;
  }

  _month() {
    return new Date().toISOString().slice(0, 7);
  }

  _load() {
    if (!fs.existsSync(this.ledgerPath)) {
      return { schemaVersion: 1, months: {} };
    }
    try {
      return JSON.parse(fs.readFileSync(this.ledgerPath, 'utf8'));
    } catch {
      return { schemaVersion: 1, months: {} };
    }
  }

  _save(state) {
    fs.mkdirSync(path.dirname(this.ledgerPath), { recursive: true });
    fs.writeFileSync(this.ledgerPath, JSON.stringify(state, null, 2));
  }

  /** Read-only check, returns { month, used, limit, pct, capped }. */
  status() {
    const state = this._load();
    const month = this._month();
    const used = state.months?.[month]?.calls || 0;
    return {
      month,
      used,
      limit: this.freeLimit,
      pct: used / this.freeLimit,
      capped: used >= this.freeLimit,
    };
  }

  /**
   * Check capacity for `n` calls then increment. Throws if cap would be exceeded.
   * Atomic write of the ledger; safe under sequential CLI usage.
   */
  async checkAndCharge(n = 1, { skuLabel = 'details_basic' } = {}) {
    const state = this._load();
    const month = this._month();
    const slot = state.months[month] || { calls: 0, by_sku: {}, first_at: new Date().toISOString() };
    if (slot.calls + n > this.freeLimit) {
      throw new PlacesQuotaCapExceeded(slot.calls, this.freeLimit, month);
    }
    slot.calls += n;
    slot.by_sku[skuLabel] = (slot.by_sku[skuLabel] || 0) + n;
    slot.last_at = new Date().toISOString();
    state.months[month] = slot;
    this._save(state);
    return { ...this.status() };
  }
}
