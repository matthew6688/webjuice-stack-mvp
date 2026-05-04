#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    parsed[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : (args[i + 1] || true);
  }
  return parsed;
}

const args = parseArgs();

if (!args.client || !args['repo-dir']) {
  console.error('Usage: node scripts/clients/sync-artifacts.js --client slug --repo-dir /path/client-repo [--assets-dir /path/public/images] [--build true]');
  process.exit(1);
}

const clientSlug = args.client;
const repoDir = path.resolve(args['repo-dir']);
const contentPath = path.resolve('clients', clientSlug, 'content.restaurant.json');
const designPath = path.resolve('clients', clientSlug, 'design.restaurant.json');
const checkoutPath = path.resolve('clients', clientSlug, 'funnel', 'checkout.json');
const assetsDir = args['assets-dir'] || args.assetsDir || '';

ensureFile(contentPath);
ensureFile(designPath);
ensureFile(checkoutPath);
ensureFile(path.join(repoDir, 'package.json'));

const applyArgs = [
  'run',
  'apply:restaurant-artifacts',
  '--',
  '--content',
  contentPath,
  '--design',
  designPath,
  ...(assetsDir ? ['--assets-dir', path.resolve(assetsDir)] : []),
];

execFileSync('npm', applyArgs, { cwd: repoDir, stdio: 'inherit' });
copyFile(checkoutPath, path.join(repoDir, 'src', 'data', 'checkout.json'));

if (args.build === 'true') {
  execFileSync('npm', ['run', 'build'], { cwd: repoDir, stdio: 'inherit' });
}

console.log(`Client artifacts synced: ${clientSlug}`);
console.log(`Repo: ${repoDir}`);
console.log('- src/data/content.restaurant.json');
console.log('- src/data/design.restaurant.json');
console.log('- src/data/checkout.json');
if (assetsDir) console.log('- public/images');

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
