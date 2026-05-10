/**
 * Per-process token bucket for client-side rate limiting.
 *
 * Used by V2 enrichment providers (Tinyfish, Dokobot, future paid APIs)
 * to stay under per-minute rate limits without having to hit a 429 first.
 *
 * Refill is continuous: capacity = ratePerMinute, refill = ratePerMinute/60 per second.
 * tryAcquire() is sync — returns false if no token available.
 * acquire() awaits until a token is free.
 */

const buckets = new Map();

export class TokenBucket {
  constructor({ ratePerMinute, capacity, now = () => Date.now() }) {
    if (!Number.isFinite(ratePerMinute) || ratePerMinute <= 0) {
      throw new Error('ratePerMinute must be a positive number');
    }
    this.ratePerMinute = ratePerMinute;
    this.capacity = capacity ?? ratePerMinute;
    this.tokens = this.capacity;
    this.lastRefillMs = now();
    this.now = now;
  }

  refill() {
    const t = this.now();
    const elapsedSec = (t - this.lastRefillMs) / 1000;
    if (elapsedSec <= 0) return;
    const tokensToAdd = elapsedSec * (this.ratePerMinute / 60);
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillMs = t;
  }

  tryAcquire() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Milliseconds until next token is available. 0 if one is ready now. */
  msUntilNextToken() {
    this.refill();
    if (this.tokens >= 1) return 0;
    const tokensNeeded = 1 - this.tokens;
    const tokensPerMs = this.ratePerMinute / 60_000;
    return Math.ceil(tokensNeeded / tokensPerMs);
  }

  async acquire() {
    while (!this.tryAcquire()) {
      const wait = this.msUntilNextToken();
      await new Promise((r) => setTimeout(r, Math.max(wait, 10)));
    }
  }
}

/**
 * Per-process named bucket. Multiple extractor instances of the same provider
 * share one rate budget. Pass `reset: true` in tests to start fresh.
 */
export function getBucket(name, { ratePerMinute, capacity, reset = false } = {}) {
  if (reset && buckets.has(name)) buckets.delete(name);
  if (!buckets.has(name)) {
    if (!Number.isFinite(ratePerMinute)) {
      throw new Error(`token bucket "${name}" not initialized; pass ratePerMinute on first call`);
    }
    buckets.set(name, new TokenBucket({ ratePerMinute, capacity }));
  }
  return buckets.get(name);
}

export function clearAllBuckets() {
  buckets.clear();
}
