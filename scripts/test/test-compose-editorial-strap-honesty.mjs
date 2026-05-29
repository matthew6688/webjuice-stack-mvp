#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const slug = 'vicwest-roofing';

const run = spawnSync('node', ['--env-file-if-exists=.env.local', 'scripts/cli/pl-compose-editorial.js', '--slug', slug, '--skip-checkpoint'], {
  cwd: ROOT,
  encoding: 'utf8',
});

assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);

const htmlPath = path.join(ROOT, 'clients', slug, 'v2', 'editorial-output', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

assert.match(html, /<span class="brand-folio">Ballarat · VIC<\/span>/);
assert.match(html, /<strong>20\+<\/strong><span>Years roofing experience<\/span>/);
assert.doesNotMatch(html, /<strong>—<\/strong><span>—<\/span>/);
assert.doesNotMatch(html, /Est\. null|Est\. 2003|since 2003|since 2006|Years roofing Ballarat homes since/);
