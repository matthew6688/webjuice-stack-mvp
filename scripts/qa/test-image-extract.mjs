#!/usr/bin/env node
/**
 * qa:test-image-extract · V3 D43 (2026-05-14)
 *
 * Run vision LLM extract pipeline on a local image file and print result.
 * Standalone — does NOT touch entity store, does NOT call Discord.
 *
 * Usage:
 *   npm run qa:test-image-extract -- data/fixtures/image-extract/tradie-sign-roofing-0424-371-622.png
 *   npm run qa:test-image-extract -- --json data/fixtures/...
 */

import path from 'node:path';
import fs from 'node:fs';
import { extractBusinessFromImage } from '../../core/tasks/image-task-prep.js';

const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('usage: qa:test-image-extract <image-path> [--json]');
  process.exit(2);
}

const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error(`not found: ${abs}`);
  process.exit(1);
}

console.log(`[qa:test-image-extract] ${abs}`);
const start = Date.now();
const result = await extractBusinessFromImage(abs);
const dur = ((Date.now() - start) / 1000).toFixed(1);

if (JSON_MODE) {
  console.log(JSON.stringify({ file: abs, duration_s: dur, result }, null, 2));
  process.exit(result ? 0 : 1);
}

console.log(`duration: ${dur}s`);
console.log('result:', JSON.stringify(result, null, 2));
process.exit(result ? 0 : 1);
