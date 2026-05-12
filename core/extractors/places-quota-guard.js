/**
 * core/extractors/places-quota-guard.js
 *
 * Monthly quota guard for Google Places API. Free tier: $200/month credit per
 * GCP account, Place Details (Basic SKU) at $0.017/call → ~11,764 calls/month.
 * We cap at 11,000 per key (margin for misc Photos/Text Search calls).
 *
 * **Multi-key rotation (G-12, 2026-05-12)**:
 *   - Env: GOOGLE_PLACES_API_KEY (primary), GOOGLE_PLACES_API_KEY_2,
 *     GOOGLE_PLACES_API_KEY_3, ... (each = separate GCP account = own $200 quota)
 *   - Guard tracks per-key usage in data/finance/places-quota.json
 *     under months.<YYYY-MM>.by_key[keyId]
 *   - `selectAvailableKey()` returns the first key with capacity remaining
 *   - `checkAndCharge(n, { keyId })` charges against the chosen key
 *
 * Auto-resets at start of each calendar month.
 *
 * Usage (single-key, legacy):
 *   const guard = new PlacesQuotaGuard();
 *   await guard.checkAndCharge(1);
 *
 * Usage (multi-key):
 *   const guard = new PlacesQuotaGuard();
 *   const { apiKey, keyId } = guard.selectAvailableKey();   // throws PlacesQuotaCapExceeded if all capped
 *   await guard.checkAndCharge(1, { keyId });
 *   // ... use apiKey for actual Places API call ...
 *
 * SOP-X-Tooling · G-7 (single-key) + G-12 (multi-key rotation).
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_LEDGER = path.resolve(process.cwd(), 'data/finance/places-quota.json');
const DEFAULT_FREE_LIMIT = 11000; // calls/month per key before hard cap

export class PlacesQuotaCapExceeded extends Error {
  constructor(message, { used, limit, month, keyIds } = {}) {
    super(message);
    this.name = 'PlacesQuotaCapExceeded';
    this.code = 'PLACES_QUOTA_CAP';
    this.used = used;
    this.limit = limit;
    this.month = month;
    this.keyIds = keyIds;
  }
}

/**
 * Discover all GOOGLE_PLACES_API_KEY* env vars and return { keyId, apiKey } list.
 * Primary key (GOOGLE_PLACES_API_KEY) is 'primary'; rotations are '2', '3', ...
 */
export function discoverPlacesKeys(env = process.env) {
  const keys = [];
  if (env.GOOGLE_PLACES_API_KEY) {
    keys.push({ keyId: 'primary', apiKey: env.GOOGLE_PLACES_API_KEY });
  }
  // Discover GOOGLE_PLACES_API_KEY_2 / _3 / ...
  for (let i = 2; i <= 10; i += 1) {
    const v = env[`GOOGLE_PLACES_API_KEY_${i}`];
    if (v) keys.push({ keyId: String(i), apiKey: v });
  }
  return keys;
}

export class PlacesQuotaGuard {
  constructor({
    ledgerPath = DEFAULT_LEDGER,
    freeLimit = DEFAULT_FREE_LIMIT,
    warnPct = 0.8,
    env = process.env,
  } = {}) {
    this.ledgerPath = ledgerPath;
    this.freeLimit = freeLimit;
    this.warnPct = warnPct;
    this.env = env;
  }

  _month() {
    return new Date().toISOString().slice(0, 7);
  }

  _load() {
    if (!fs.existsSync(this.ledgerPath)) {
      return { schemaVersion: 2, months: {} };
    }
    try {
      const j = JSON.parse(fs.readFileSync(this.ledgerPath, 'utf8'));
      // Migrate schemaVersion 1 → 2 (top-level calls → by_key.primary.calls)
      if ((j.schemaVersion || 1) === 1 && j.months) {
        const migrated = { schemaVersion: 2, months: {} };
        for (const [m, slot] of Object.entries(j.months)) {
          if (slot.by_key) {
            migrated.months[m] = slot;
          } else {
            migrated.months[m] = {
              by_key: { primary: { calls: slot.calls || 0, by_sku: slot.by_sku || {}, first_at: slot.first_at, last_at: slot.last_at } },
            };
          }
        }
        return migrated;
      }
      return j;
    } catch {
      return { schemaVersion: 2, months: {} };
    }
  }

  _save(state) {
    fs.mkdirSync(path.dirname(this.ledgerPath), { recursive: true });
    fs.writeFileSync(this.ledgerPath, JSON.stringify(state, null, 2));
  }

  /** Per-key usage in current month. */
  statusForKey(keyId) {
    const state = this._load();
    const month = this._month();
    const slot = state.months?.[month]?.by_key?.[keyId] || { calls: 0 };
    const used = slot.calls || 0;
    return {
      keyId,
      month,
      used,
      limit: this.freeLimit,
      pct: used / this.freeLimit,
      capped: used >= this.freeLimit,
    };
  }

  /** Aggregate usage across all known keys this month. */
  status() {
    const state = this._load();
    const month = this._month();
    const byKey = state.months?.[month]?.by_key || {};
    const keys = discoverPlacesKeys(this.env);
    const perKey = keys.map((k) => this.statusForKey(k.keyId));
    const totalUsed = perKey.reduce((sum, s) => sum + s.used, 0);
    const totalLimit = keys.length * this.freeLimit;
    return {
      month,
      keys: perKey,
      total_used: totalUsed,
      total_limit: totalLimit,
      total_pct: totalLimit ? totalUsed / totalLimit : 0,
      all_capped: perKey.length > 0 && perKey.every((k) => k.capped),
    };
  }

  /**
   * Select the first available key (capacity > 0). Throws if all keys capped.
   * @returns {{ keyId: string, apiKey: string }}
   */
  selectAvailableKey() {
    const keys = discoverPlacesKeys(this.env);
    if (keys.length === 0) {
      throw new Error('No GOOGLE_PLACES_API_KEY* set in env');
    }
    const month = this._month();
    for (const k of keys) {
      const s = this.statusForKey(k.keyId);
      if (!s.capped) return k;
    }
    throw new PlacesQuotaCapExceeded(
      `All ${keys.length} Places API key(s) capped in ${month}. Add GOOGLE_PLACES_API_KEY_${keys.length + 1} for more capacity, or wait for monthly reset.`,
      { used: keys.length * this.freeLimit, limit: keys.length * this.freeLimit, month, keyIds: keys.map((k) => k.keyId) }
    );
  }

  /**
   * Check capacity + atomically increment for the given key.
   * If keyId not specified, defaults to 'primary' (legacy behavior).
   */
  async checkAndCharge(n = 1, { skuLabel = 'details_basic', keyId = 'primary' } = {}) {
    const state = this._load();
    const month = this._month();
    const monthSlot = state.months[month] || { by_key: {} };
    monthSlot.by_key = monthSlot.by_key || {};
    const slot = monthSlot.by_key[keyId] || { calls: 0, by_sku: {}, first_at: new Date().toISOString() };
    if (slot.calls + n > this.freeLimit) {
      throw new PlacesQuotaCapExceeded(
        `Places API key '${keyId}' cap reached: ${slot.calls}/${this.freeLimit} calls in ${month}. Try other keys via selectAvailableKey().`,
        { used: slot.calls, limit: this.freeLimit, month, keyIds: [keyId] }
      );
    }
    slot.calls += n;
    slot.by_sku[skuLabel] = (slot.by_sku[skuLabel] || 0) + n;
    slot.last_at = new Date().toISOString();
    monthSlot.by_key[keyId] = slot;
    state.months[month] = monthSlot;
    this._save(state);
    return this.statusForKey(keyId);
  }
}
