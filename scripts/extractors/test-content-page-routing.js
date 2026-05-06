#!/usr/bin/env node

import assert from 'assert/strict';
import { isCriticalContentPage } from '../../core/extractors/tinyfish.js';

assert.equal(isCriticalContentPage({
  url: 'https://www.richandrare.com.au/lunch-dinner',
  niche: 'restaurant',
  pageType: 'menu',
}), true);

assert.equal(isCriticalContentPage({
  url: 'https://example-roofing.com/services',
  niche: 'roofing',
  pageType: 'service',
}), true);

assert.equal(isCriticalContentPage({
  url: 'https://example.com/about',
  niche: 'restaurant',
  pageType: 'about',
}), false);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    restaurantMenuRoutesToTinyFish: true,
    genericServiceRoutesToTinyFish: true,
    aboutPageCanUseDiscoveryCrawler: true,
  },
}, null, 2));
