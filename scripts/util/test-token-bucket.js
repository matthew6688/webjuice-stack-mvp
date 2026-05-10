#!/usr/bin/env node
/**
 * Token bucket unit test — pure deterministic, no network.
 */

import assert from 'assert/strict';
import { TokenBucket, getBucket, clearAllBuckets } from '../../core/util/token-bucket.js';

// Fake clock so refill is deterministic
let now = 1_700_000_000_000;
const advance = (ms) => { now += ms; };
const clock = () => now;

// 1. Capacity defaults to ratePerMinute and starts full
{
  const b = new TokenBucket({ ratePerMinute: 30, now: clock });
  assert.equal(b.tokens, 30);
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tokens, 29);
}

// 2. Drain to zero blocks tryAcquire
{
  const b = new TokenBucket({ ratePerMinute: 3, capacity: 3, now: clock });
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tryAcquire(), false, '4th call with capacity 3 must fail');
}

// 3. Refill after time passes
{
  const b = new TokenBucket({ ratePerMinute: 60, capacity: 1, now: clock });
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tryAcquire(), false);
  advance(1_000); // 1s @ 60/min = 1 token
  assert.equal(b.tryAcquire(), true);
}

// 4. msUntilNextToken matches refill rate
{
  const b = new TokenBucket({ ratePerMinute: 60, capacity: 1, now: clock });
  b.tryAcquire(); // drain
  const wait = b.msUntilNextToken();
  // 60/min = 1/sec → ~1000ms
  assert.ok(wait >= 950 && wait <= 1050, `expected ~1000ms, got ${wait}`);
  advance(1_100);
  assert.equal(b.msUntilNextToken(), 0);
}

// 5. Capacity caps refill
{
  const b = new TokenBucket({ ratePerMinute: 60, capacity: 5, now: clock });
  // start full
  assert.equal(b.tokens, 5);
  advance(60_000); // a full minute = 60 tokens worth, but capped at 5
  b.refill();
  assert.equal(b.tokens, 5);
}

// 6. acquire() waits then succeeds
{
  // use real timer for this one
  const b = new TokenBucket({ ratePerMinute: 600, capacity: 1 });
  await b.acquire();
  const t0 = Date.now();
  await b.acquire();
  const elapsed = Date.now() - t0;
  // 600/min = 10/sec → ~100ms
  assert.ok(elapsed >= 80, `acquire() should have waited ~100ms, waited ${elapsed}`);
}

// 7. Named bucket singleton — same name returns same instance
{
  clearAllBuckets();
  const a = getBucket('test-provider', { ratePerMinute: 30 });
  const b = getBucket('test-provider');
  assert.equal(a, b, 'same name returns same instance');
}

// 8. Named bucket — second name is independent
{
  clearAllBuckets();
  const a = getBucket('p1', { ratePerMinute: 30 });
  const b = getBucket('p2', { ratePerMinute: 60 });
  assert.notEqual(a, b);
  assert.equal(b.ratePerMinute, 60);
}

// 9. Throws if asked for uninitialized bucket
{
  clearAllBuckets();
  assert.throws(() => getBucket('never-init'), /not initialized/);
}

// 10. reset:true creates fresh bucket
{
  clearAllBuckets();
  const a = getBucket('rb', { ratePerMinute: 30 });
  a.tryAcquire();
  const b = getBucket('rb', { ratePerMinute: 30, reset: true });
  assert.notEqual(a, b);
  assert.equal(b.tokens, 30, 'reset bucket starts full');
}

console.log(JSON.stringify({
  ok: true,
  assertions: {
    capacityDefaultsToRate: true,
    drainBlocks: true,
    timeRefills: true,
    msUntilNextToken: true,
    capacityCaps: true,
    acquireWaits: true,
    namedSingleton: true,
    namesIndependent: true,
    uninitThrows: true,
    resetWorks: true,
  },
}, null, 2));
