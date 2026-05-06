const DEFAULT_FOLDER = 'profitslocal/main-site';

export function cloudinaryConfigured(env = {}) {
  const hasSigned = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  const hasUnsigned = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_UPLOAD_PRESET);
  return hasSigned || hasUnsigned;
}

export async function uploadAttachmentsToCloudinary(env = {}, attachments = [], options = {}) {
  if (!attachments.length) return { ok: true, configured: cloudinaryConfigured(env), assets: [], summary: '' };
  if (!cloudinaryConfigured(env)) {
    return { ok: false, configured: false, skipped: true, reason: 'cloudinary_not_configured', assets: [], summary: '' };
  }

  const maxBytes = Number(env.CLOUDINARY_UPLOAD_MAX_BYTES || 12 * 1024 * 1024);
  const assets = [];
  for (const attachment of attachments) {
    if (Number(attachment.size || 0) > maxBytes) {
      return { ok: false, configured: true, error: `${attachment.filename} exceeds Cloudinary upload limit.` };
    }
    const asset = await uploadDataUriToCloudinary(env, {
      dataUri: toDataUri(attachment),
      filename: attachment.filename,
      contentType: attachment.content_type,
      folder: cloudinaryFolder(env, options),
      publicId: publicIdFor(attachment.filename),
    });
    assets.push(asset);
  }

  return {
    ok: true,
    configured: true,
    assets,
    summary: summarizeCloudinaryAssets(assets),
  };
}

export async function uploadCloudinaryManifest(env = {}, assets = [], options = {}) {
  if (!assets.length || !cloudinaryConfigured(env)) return { ok: false, skipped: true, reason: assets.length ? 'cloudinary_not_configured' : 'no_assets' };
  const json = JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), assets }, null, 2);
  const base64 = bytesToBase64(new TextEncoder().encode(json));
  const manifest = await uploadDataUriToCloudinary(env, {
    dataUri: `data:application/json;base64,${base64}`,
    filename: `${options.orderId || 'manifest'}-assets.json`,
    contentType: 'application/json',
    folder: cloudinaryFolder(env, { ...options, submissionType: options.submissionType || 'manifest' }),
    publicId: `${safeSegment(options.orderId || 'assets')}-manifest`,
    resourceType: 'raw',
  });
  return { ok: true, asset: manifest };
}

export function summarizeCloudinaryAssets(assets = []) {
  return assets
    .map((asset) => `${asset.originalFilename || asset.filename || asset.publicId} (${asset.resourceType || 'auto'}, ${formatBytes(asset.bytes || 0)}) ${asset.secureUrl || ''}`.trim())
    .join('\n');
}

async function uploadDataUriToCloudinary(env, input) {
  const resourceType = input.resourceType || 'auto';
  const endpoint = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  const form = new FormData();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = input.folder || DEFAULT_FOLDER;
  const publicId = input.publicId || publicIdFor(input.filename);

  form.set('file', input.dataUri);
  form.set('folder', folder);
  form.set('public_id', publicId);

  if (env.CLOUDINARY_UPLOAD_PRESET && !env.CLOUDINARY_API_SECRET) {
    form.set('upload_preset', env.CLOUDINARY_UPLOAD_PRESET);
  } else {
    form.set('api_key', env.CLOUDINARY_API_KEY);
    form.set('timestamp', String(timestamp));
    form.set('signature', await cloudinarySignature({ folder, public_id: publicId, timestamp }, env.CLOUDINARY_API_SECRET));
  }

  const response = await fetch(endpoint, { method: 'POST', body: form });
  const body = await response.json().catch(async () => ({ error: { message: await response.text() } }));
  if (!response.ok) {
    throw new Error(body?.error?.message || 'Cloudinary upload failed.');
  }
  return normalizeCloudinaryAsset(body, input);
}

async function cloudinarySignature(params, apiSecret) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&') + apiSecret;
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeCloudinaryAsset(body, input) {
  return {
    filename: input.filename || '',
    originalFilename: input.filename || '',
    publicId: body.public_id || '',
    resourceType: body.resource_type || '',
    type: body.type || '',
    format: body.format || '',
    bytes: body.bytes || 0,
    secureUrl: body.secure_url || '',
    url: body.url || '',
    createdAt: body.created_at || '',
  };
}

function cloudinaryFolder(env, options = {}) {
  const base = safePath(env.CLOUDINARY_UPLOAD_FOLDER || DEFAULT_FOLDER);
  const client = safeSegment(options.clientSlug || 'unknown-client');
  const submissionType = safeSegment(options.submissionType || 'attachments');
  const order = safeSegment(options.orderId || 'unknown-order');
  return `${base}/clients/${client}/${submissionType}/${order}`;
}

function publicIdFor(filename = 'attachment') {
  const base = filename.replace(/\.[^.]+$/, '');
  return `${safeSegment(base)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDataUri(file) {
  const contentType = file.content_type || 'application/octet-stream';
  return `data:${contentType};base64,${file.content}`;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function safePath(value) {
  return String(value || DEFAULT_FOLDER)
    .split('/')
    .map(safeSegment)
    .filter(Boolean)
    .join('/') || DEFAULT_FOLDER;
}

function safeSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
