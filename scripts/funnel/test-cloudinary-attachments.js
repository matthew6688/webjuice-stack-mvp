#!/usr/bin/env node

import { cloudinaryConfigured, uploadAttachmentsToCloudinary, uploadCloudinaryManifest } from '../../core/cloudinary/attachments.js';

const calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), body: init?.body });
  return {
    ok: true,
    async json() {
      return {
        public_id: calls.length === 1
          ? 'profitslocal/main-site/clients/smoke/intake/order/logo'
          : 'profitslocal/main-site/clients/smoke/manifest/order/order-manifest',
        resource_type: calls.length === 1 ? 'image' : 'raw',
        type: 'upload',
        format: calls.length === 1 ? 'png' : 'json',
        bytes: calls.length === 1 ? 42 : 300,
        secure_url: calls.length === 1
          ? 'https://res.cloudinary.com/demo/image/upload/logo.png'
          : 'https://res.cloudinary.com/demo/raw/upload/order-manifest.json',
        url: 'http://res.cloudinary.com/demo/uploaded',
        created_at: '2026-05-06T00:00:00Z',
      };
    },
  };
};

const missing = await uploadAttachmentsToCloudinary({}, [{
  filename: 'logo.png',
  content: 'ZmFrZQ==',
  content_type: 'image/png',
  size: 42,
}], { clientSlug: 'smoke', orderId: 'order', submissionType: 'intake' });

const env = {
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
  CLOUDINARY_UPLOAD_FOLDER: 'profitslocal/main-site',
};

const uploaded = await uploadAttachmentsToCloudinary(env, [{
  filename: 'logo.png',
  content: 'ZmFrZQ==',
  content_type: 'image/png',
  size: 42,
}], { clientSlug: 'smoke', orderId: 'order', submissionType: 'intake' });

const manifest = await uploadCloudinaryManifest(env, uploaded.assets, {
  clientSlug: 'smoke',
  orderId: 'order',
  submissionType: 'manifest',
});

globalThis.fetch = originalFetch;

const assertions = {
  missingConfigSkips: missing.ok === false && missing.reason === 'cloudinary_not_configured',
  configuredDetectsSignedMode: cloudinaryConfigured(env) === true,
  uploadReturnsAsset: uploaded.ok === true && uploaded.assets[0]?.secureUrl?.includes('cloudinary.com'),
  summaryIncludesUrl: uploaded.summary.includes('https://res.cloudinary.com/demo/image/upload/logo.png'),
  manifestReturnsRawAsset: manifest.ok === true && manifest.asset.resourceType === 'raw',
  twoCloudinaryCalls: calls.length === 2,
};
const failed = Object.entries(assertions).filter(([, ok]) => !ok).map(([key]) => key);
const result = { ok: failed.length === 0, assertions, failed, calls: calls.map((call) => call.url) };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
