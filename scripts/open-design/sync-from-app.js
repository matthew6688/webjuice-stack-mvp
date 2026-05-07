#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || '';

if (!clientSlug) {
  console.error('Usage: node scripts/open-design/sync-from-app.js --client slug [--manifest file]');
  process.exit(1);
}

const manifestPath = path.resolve(args.manifest || path.join('clients', clientSlug, 'concept', 'open-design', 'concept-manifest.json'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const dataDir = path.resolve(args['data-dir'] || manifest.dataDir || '/Users/matthew/Developer/open-design/.od');
const projectId = args.project || manifest.projectId;
const projectDir = path.join(dataDir, 'projects', projectId);
const outDir = path.resolve(args.out || manifest.outDir || path.dirname(manifestPath));

if (!fs.existsSync(projectDir)) {
  throw new Error(`Open Design project folder not found: ${projectDir}`);
}

fs.mkdirSync(outDir, { recursive: true });
const files = [];
copyProjectFiles(projectDir, outDir, files, outDir);

const nextManifest = {
  ...manifest,
  updatedAt: new Date().toISOString(),
  syncedFromOpenDesignAt: new Date().toISOString(),
  dataDir,
  outDir,
  files,
};

writeJson(manifestPath, nextManifest);
writeJson(path.join(projectDir, '.profitslocal-sync.json'), {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  clientSlug,
  conceptManifestPath: manifestPath,
  productionHandoffPath: path.join(outDir, 'production-handoff.json'),
  openDesignProjectId: projectId,
  openDesignRunId: manifest.lastRunId || manifest.runId || '',
  mode: manifest.mode || 'app-visible',
  dataDir,
  rule: 'Open Design project is the design concept source. Production changes must be ported to Webjuice/Astro, pushed to dev, and recorded in the ProfitsLocal case/Discord thread.',
});

console.log(JSON.stringify({
  ok: true,
  clientSlug,
  projectId,
  projectDir,
  outDir,
  files: files.length,
  manifestPath,
}, null, 2));

function copyProjectFiles(sourceDir, targetDir, files, rootTargetDir = targetDir) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === '.od-skills' || entry.name === '.profitslocal-sync.json') continue;
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyProjectFiles(source, target, files, rootTargetDir);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    const rel = path.relative(rootTargetDir, target);
    files.push({
      path: rel,
      size: fs.statSync(target).size,
      kind: kindFor(rel),
      mime: mimeFor(rel),
      artifactKind: artifactKindFor(rel),
    });
  }
}

function kindFor(filePath) {
  if (/\.html?$/i.test(filePath)) return 'html';
  if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(filePath)) return 'image';
  if (/\.md$/i.test(filePath)) return 'text';
  if (/\.json$/i.test(filePath)) return 'json';
  return 'file';
}

function mimeFor(filePath) {
  if (/\.html?$/i.test(filePath)) return 'text/html; charset=utf-8';
  if (/\.md$/i.test(filePath)) return 'text/markdown; charset=utf-8';
  if (/\.json$/i.test(filePath)) return 'application/json';
  if (/\.png$/i.test(filePath)) return 'image/png';
  if (/\.jpe?g$/i.test(filePath)) return 'image/jpeg';
  if (/\.webp$/i.test(filePath)) return 'image/webp';
  if (/\.svg$/i.test(filePath)) return 'image/svg+xml';
  return null;
}

function artifactKindFor(filePath) {
  if (/\.html?$/i.test(filePath)) return 'html';
  if (/\.md$/i.test(filePath)) return 'markdown-document';
  return null;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
