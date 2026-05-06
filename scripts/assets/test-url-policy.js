#!/usr/bin/env node

import assert from 'assert/strict';
import { auditAssetUrls, normalizeAssetUrls } from '../../core/assets/url-policy.js';

const content = {
  brand: {
    logo: 'http://static1.squarespace.com/static/logo.png',
  },
  gallery: [
    { url: 'http://unknown.example/photo.jpg' },
    { url: 'https://good.example/photo.jpg' },
  ],
};

const audit = auditAssetUrls(content);
assert.equal(audit.ok, false);
assert.equal(audit.warnings.length, 0);
assert.equal(audit.errors.length, 2);
assert.equal(audit.errors[0].path, 'brand.logo');
assert.equal(audit.errors[0].fixable, true);
assert.equal(audit.errors[1].path, 'gallery[0].url');
assert.equal(audit.errors[1].fixable, false);

const normalized = normalizeAssetUrls(content);
assert.equal(normalized.brand.logo, 'https://static1.squarespace.com/static/logo.png');
assert.equal(normalized.gallery[0].url, 'http://unknown.example/photo.jpg');

console.log(JSON.stringify({
  ok: true,
  assertions: {
    safeHttpCdnWarnsAndUpgrades: true,
    unknownHttpAssetErrorsAndDoesNotUpgrade: true,
  },
}, null, 2));
