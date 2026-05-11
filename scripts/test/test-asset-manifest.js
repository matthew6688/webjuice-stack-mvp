#!/usr/bin/env node
/**
 * Block 3.1 hard evidence — asset manifest CRUD.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import {
  ASSET_TYPES,
  addAsset,
  readManifest,
  listByType,
  getAsset,
  getCloudinaryUrl,
  removeAsset,
  manifestPath,
} from '../../core/leads/asset-manifest.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-asset-test-'));
const slug = 'test-client';
const opts = { clientsRoot: tmp };

// 1 — empty manifest is materialized on read
const empty = readManifest(slug, opts);
assert.equal(empty.assets.length, 0);
assert.equal(empty.clientSlug, slug);

// 2 — add one of each of 6 types
const samples = [
  { id: 'home-desktop', type: 'screenshot', label: 'Home desktop', localPath: 'screenshots/home-desktop.png', cloudinaryUrl: 'https://res.cloudinary.com/x/home-desktop.png', tags: ['hero'] },
  { id: 'walkthrough', type: 'video', label: 'Site walkthrough', localPath: 'videos/walkthrough.mp4' },
  { id: 'proposal-v1', type: 'presentation', label: 'Proposal v1', localPath: 'presentations/proposal-v1.pdf' },
  { id: 'master-md', type: 'document', label: 'Master MD', localPath: 'documents/master.md' },
  { id: 'ref-1', type: 'reference', label: 'Reference site', localPath: 'references/ref-1.png', tags: ['inspiration'] },
  { id: 'audit-html', type: 'report', label: 'Audit report', localPath: 'documents/audit-report.html' },
];
for (const s of samples) addAsset(slug, { ...s, entityKey: 'place_test_001' }, opts);

const manifest = readManifest(slug, opts);
assert.equal(manifest.assets.length, 6);
assert.equal(manifest.entityKey, 'place_test_001');
assert.equal(manifest.schemaVersion, 1);

// 3 — listByType filters
for (const t of ASSET_TYPES) {
  const list = listByType(slug, t, opts);
  assert.equal(list.length, 1, `expected 1 asset of type ${t}`);
  assert.equal(list[0].type, t);
}

// 4 — listByType with no type returns all
assert.equal(listByType(slug, null, opts).length, 6);

// 5 — getAsset / getCloudinaryUrl
assert.equal(getAsset(slug, 'home-desktop', opts).label, 'Home desktop');
assert.equal(getCloudinaryUrl(slug, 'home-desktop', opts), 'https://res.cloudinary.com/x/home-desktop.png');
assert.equal(getCloudinaryUrl(slug, 'walkthrough', opts), null);

// 6 — upsert (re-add same id updates in place, preserves extra fields)
const before = readManifest(slug, opts);
before.assets.find((a) => a.id === 'walkthrough').custom_field = 'preserved';
fs.writeFileSync(manifestPath(slug, opts), JSON.stringify(before, null, 2) + '\n', 'utf8');
addAsset(slug, { id: 'walkthrough', type: 'video', label: 'Updated walkthrough', localPath: 'videos/walkthrough-v2.mp4' }, opts);
const after = readManifest(slug, opts);
const walkthrough = after.assets.find((a) => a.id === 'walkthrough');
assert.equal(walkthrough.label, 'Updated walkthrough', 'upsert updated label');
assert.equal(walkthrough.localPath, 'videos/walkthrough-v2.mp4');
assert.equal(walkthrough.custom_field, 'preserved', 'unknown fields preserved (forward compat)');
assert.equal(after.assets.length, 6, 'no duplicate');

// 7 — invalid type rejected
assert.throws(() => addAsset(slug, { id: 'bad', type: 'bogus' }, opts), /asset.type must be one of/);

// 8 — missing id rejected
assert.throws(() => addAsset(slug, { type: 'screenshot' }, opts), /asset.id required/);

// 9 — removeAsset
const removed = removeAsset(slug, 'walkthrough', opts);
assert.equal(removed, 1);
assert.equal(readManifest(slug, opts).assets.length, 5);

fs.rmSync(tmp, { recursive: true, force: true });

console.log(JSON.stringify({
  ok: true,
  asset_types_count: ASSET_TYPES.size,
  assertions: {
    empty_manifest_materialized: true,
    six_types_registered: true,
    list_by_type_filters: true,
    list_by_type_all: true,
    get_asset_and_cloudinary_url: true,
    upsert_preserves_unknown_fields: true,
    invalid_type_rejected: true,
    missing_id_rejected: true,
    remove_asset: true,
  },
}, null, 2));
