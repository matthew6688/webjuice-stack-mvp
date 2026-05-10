#!/usr/bin/env node

import { spawnSync } from 'child_process';

const result = spawnSync('npm', [
  'run',
  'template-lab:run-open-design',
  '--',
  '--niche',
  'roofing',
  '--family',
  'classic-premium-roftix',
  '--dry-run',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

const data = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
const assertions = {
  clientSlug: data.clientSlug === 'template-roofing-classic-premium-roftix',
  outDir: String(data.outDir).includes('templates/roofing/families/classic-premium-roftix/open-design'),
  noFallback: data.allowArtifactFallback === false,
  longTimeout: data.timeoutPolicy?.timeoutMs >= 600000,
  promptHasTemplateRules: String(data.prompt || '').includes('Template Library Requirements'),
};

if (!Object.values(assertions).every(Boolean)) {
  console.error(JSON.stringify({ ok: false, assertions, data }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, assertions }, null, 2));
