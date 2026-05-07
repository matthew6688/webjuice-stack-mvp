#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { listFilesRecursive, scanArtifactQuietSnapshot } from './run-concept.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'od-artifact-fallback-'));

try {
  const hiddenSkillDir = path.join(root, '.od-skills', 'web-prototype');
  fs.mkdirSync(hiddenSkillDir, { recursive: true });
  fs.writeFileSync(path.join(hiddenSkillDir, 'example.html'), '<html><body>seed</body></html>');

  let snapshot = scanArtifactQuietSnapshot(root, 1);
  assert.equal(snapshot.ready, false);
  assert.equal(snapshot.reason, 'required_artifacts_missing');

  const visibleAssetDir = path.join(root, 'assets');
  fs.mkdirSync(visibleAssetDir, { recursive: true });
  const heroPath = path.join(visibleAssetDir, 'hero.jpg');
  fs.writeFileSync(heroPath, 'binary');

  snapshot = scanArtifactQuietSnapshot(root, 1);
  assert.equal(snapshot.ready, false);
  assert.equal(snapshot.reason, 'required_artifacts_missing');

  const indexPath = path.join(root, 'index.html');
  fs.writeFileSync(indexPath, '<!doctype html><title>Smoke</title>');
  const oldTime = new Date(Date.now() - 60_000);
  fs.utimesSync(heroPath, oldTime, oldTime);
  fs.utimesSync(indexPath, oldTime, oldTime);

  snapshot = scanArtifactQuietSnapshot(root, 1);
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.htmlCount, 1);
  assert.equal(snapshot.fileCount, 2);

  const files = listFilesRecursive(root).map((file) => path.relative(root, file).split(path.sep).join('/')).sort();
  assert.deepEqual(files, ['assets/hero.jpg', 'index.html']);

  console.log(JSON.stringify({
    ok: true,
    ignoresDotDirectories: true,
    requiresRealHtmlArtifacts: true,
    visibleFiles: files,
    snapshot,
  }, null, 2));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
