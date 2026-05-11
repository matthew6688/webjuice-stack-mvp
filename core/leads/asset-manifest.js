/**
 * Asset manifest — single index per client of all customer-facing artifacts.
 * DISCORD_OUTREACH_PRD.md §6.2.
 *
 * Path: clients/<slug>/assets/manifest.json
 * Sub-dirs (created on demand): screenshots/ videos/ presentations/ documents/ references/
 *
 * Asset record shape:
 *   {
 *     id: string,                  // stable slug; unique within manifest
 *     type: string,                // one of ASSET_TYPES
 *     label: string,               // human label, used in Discord profile card
 *     localPath: string,           // relative to manifest dir
 *     cloudinaryUrl?: string,      // optional public URL
 *     addedAt: ISO string,
 *     tags: string[],              // free-form, used for filtering
 *   }
 *
 * The shape is intentionally additive — new asset types only require enumerating
 * them in ASSET_TYPES. Adding new fields (e.g. duration_seconds) is a non-break.
 */

import fs from 'fs';
import path from 'path';

export const ASSET_TYPES = new Set([
  'screenshot',
  'video',
  'presentation',
  'document',
  'reference',
  'report',
]);

export const SCHEMA_VERSION = 1;

export function manifestPath(clientSlug, { clientsRoot = 'clients' } = {}) {
  return path.join(clientsRoot, clientSlug, 'assets', 'manifest.json');
}

export function readManifest(clientSlug, opts = {}) {
  const p = manifestPath(clientSlug, opts);
  if (!fs.existsSync(p)) {
    return { schemaVersion: SCHEMA_VERSION, clientSlug, entityKey: null, assets: [] };
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeManifest(manifest, opts = {}) {
  const p = manifestPath(manifest.clientSlug, opts);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return p;
}

export function addAsset(clientSlug, asset, opts = {}) {
  if (!asset?.id) throw new Error('asset.id required');
  if (!ASSET_TYPES.has(asset.type)) {
    throw new Error(`asset.type must be one of: ${[...ASSET_TYPES].join(', ')}`);
  }
  const manifest = readManifest(clientSlug, opts);
  const existing = manifest.assets.findIndex((a) => a.id === asset.id);
  const record = {
    id: asset.id,
    type: asset.type,
    label: asset.label || asset.id,
    localPath: asset.localPath || null,
    cloudinaryUrl: asset.cloudinaryUrl || null,
    addedAt: asset.addedAt || new Date().toISOString(),
    tags: Array.isArray(asset.tags) ? asset.tags : [],
  };
  // preserve any unknown fields from existing record (forward compat)
  if (existing >= 0) {
    const before = manifest.assets[existing];
    manifest.assets[existing] = { ...before, ...record };
  } else {
    manifest.assets.push(record);
  }
  if (asset.entityKey) manifest.entityKey = asset.entityKey;
  writeManifest(manifest, opts);
  return record;
}

export function listByType(clientSlug, type, opts = {}) {
  const manifest = readManifest(clientSlug, opts);
  if (!type) return manifest.assets;
  if (!ASSET_TYPES.has(type)) throw new Error(`unknown asset type '${type}'`);
  return manifest.assets.filter((a) => a.type === type);
}

export function getAsset(clientSlug, assetId, opts = {}) {
  const manifest = readManifest(clientSlug, opts);
  return manifest.assets.find((a) => a.id === assetId) || null;
}

export function getCloudinaryUrl(clientSlug, assetId, opts = {}) {
  return getAsset(clientSlug, assetId, opts)?.cloudinaryUrl || null;
}

export function removeAsset(clientSlug, assetId, opts = {}) {
  const manifest = readManifest(clientSlug, opts);
  const before = manifest.assets.length;
  manifest.assets = manifest.assets.filter((a) => a.id !== assetId);
  writeManifest(manifest, opts);
  return before - manifest.assets.length;
}
