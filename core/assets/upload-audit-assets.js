/**
 * Upload audit-pipeline assets (per-issue evidence PNGs + mobile-throttled
 * video) to Cloudinary so reports can reference public CDN URLs instead of
 * local paths.
 *
 * Tier: T1 (Cloudinary free tier — 25GB storage + 25GB bandwidth/mo).
 * Each upload is logged to the ledger so we can track usage.
 *
 * Output: { evidenceUrls: { [issueId]: secureUrl }, videoUrl, manifestPath }
 *
 * Folder layout on Cloudinary:
 *   profitslocal/main-site/audits/<entityKey>/evidence/<issueId>
 *   profitslocal/main-site/audits/<entityKey>/video/mobile-throttled
 *
 * Idempotency: every upload uses a stable publicId so re-uploading the
 * same issue overwrites in place (Cloudinary defaults to new versions
 * but keeps the URL stable). Pass `force: false` to skip uploads when a
 * manifest already exists locally.
 */

import fs from 'fs';
import path from 'path';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';

const FOLDER_ROOT = 'profitslocal/main-site/audits';

function isConfigured(env = process.env) {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

async function sha1(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signedUpload({ filePath, folder, publicId, resourceType, env = process.env }) {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const timestamp = Math.floor(Date.now() / 1000);
  const overwrite = 'true';
  const invalidate = 'true';

  // Cloudinary signs alphabetically-sorted params + secret.
  const params = { folder, invalidate, overwrite, public_id: publicId, timestamp: String(timestamp) };
  const sigBase = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + apiSecret;
  const signature = await sha1(sigBase);

  const form = new FormData();
  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf]);
  form.set('file', blob, path.basename(filePath));
  form.set('api_key', apiKey);
  form.set('timestamp', String(timestamp));
  form.set('signature', signature);
  form.set('folder', folder);
  form.set('public_id', publicId);
  form.set('overwrite', overwrite);
  form.set('invalidate', invalidate);

  const url = `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`;
  const res = await fetch(url, { method: 'POST', body: form });
  const body = await res.json().catch(async () => ({ error: { message: await res.text() } }));
  if (!res.ok) throw new Error(body?.error?.message || `cloudinary HTTP ${res.status}`);
  return body;
}

export async function uploadAuditAssets({
  entityKey,
  evidenceDir,
  videoPath,
  screenshotDir,        // optional — uploads desktop.png + mobile.png too
  ledgerPath,
  clientSlug,
  campaignId,
  env = process.env,
} = {}) {
  if (!entityKey) throw new Error('entityKey required');
  if (!isConfigured(env)) {
    return { ok: false, reason: 'cloudinary not configured', skipped: true };
  }

  const folderBase = `${FOLDER_ROOT}/${entityKey.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)}`;
  const evidenceUrls = {};
  const screenshotUrls = {};
  let videoUrl = null;
  const uploads = [];

  // ── Full desktop / mobile screenshots ──
  if (screenshotDir && fs.existsSync(screenshotDir)) {
    for (const variant of ['desktop', 'mobile']) {
      const filePath = path.join(screenshotDir, `${variant}.png`);
      if (!fs.existsSync(filePath)) continue;
      try {
        const body = await signedUpload({
          filePath,
          folder: `${folderBase}/screenshots`,
          publicId: variant,
          resourceType: 'image',
          env,
        });
        screenshotUrls[variant] = body.secure_url;
        uploads.push({ kind: 'screenshot', variant, bytes: body.bytes, secureUrl: body.secure_url });
      } catch (err) {
        uploads.push({ kind: 'screenshot', variant, error: err.message });
      }
    }
  }

  // ── Evidence PNGs ──
  if (evidenceDir && fs.existsSync(evidenceDir)) {
    const files = fs.readdirSync(evidenceDir).filter((f) => f.endsWith('.png'));
    for (const file of files) {
      const filePath = path.join(evidenceDir, file);
      const issueId = file.replace(/^issue-/, '').replace(/\.png$/, '');
      const publicId = `evidence-${issueId}`;
      try {
        const body = await signedUpload({
          filePath,
          folder: `${folderBase}/evidence`,
          publicId,
          resourceType: 'image',
          env,
        });
        evidenceUrls[issueId] = body.secure_url;
        uploads.push({ kind: 'evidence', issueId, bytes: body.bytes, secureUrl: body.secure_url });
      } catch (err) {
        uploads.push({ kind: 'evidence', issueId, error: err.message });
      }
    }
  }

  // ── Video ──
  if (videoPath && fs.existsSync(videoPath)) {
    try {
      const body = await signedUpload({
        filePath: videoPath,
        folder: `${folderBase}/video`,
        publicId: 'mobile-throttled',
        resourceType: 'video',
        env,
      });
      videoUrl = body.secure_url;
      uploads.push({ kind: 'video', bytes: body.bytes, secureUrl: body.secure_url });
    } catch (err) {
      uploads.push({ kind: 'video', error: err.message });
    }
  }

  // ── Ledger ──
  if (ledgerPath || clientSlug) {
    const requestHash = await hashRequest({ provider: 'cloudinary', endpoint: 'upload', entityKey });
    appendLedgerEvent({
      type: 'cost',
      category: 'other',
      provider: 'cloudinary',
      tier: 'T1',
      leadId: entityKey,
      clientSlug,
      stage: 'asset_publish',
      purpose: 'audit_asset_upload',
      requestHash,
      campaignId,
      units: uploads.filter((u) => !u.error).length,
      // Free tier — book at $0 but track the unit count for free-tier accounting
      unitCost: 0,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        entity_key: entityKey,
        evidence_count: Object.keys(evidenceUrls).length,
        video_uploaded: Boolean(videoUrl),
        upload_failures: uploads.filter((u) => u.error).length,
      },
    }, ledgerPath);
  }

  return {
    ok: true,
    entityKey,
    evidenceUrls,
    screenshotUrls,
    videoUrl,
    uploads,
    folderBase,
  };
}
