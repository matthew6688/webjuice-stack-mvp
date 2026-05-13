#!/usr/bin/env node
// Invoke Open Design's `critique` skill on a single HTML file.
// Output: a 5-dimension critique HTML report next to the artifact.
//
// Usage:
//   node scripts/template-lab/run-od-critique.mjs \
//     --artifact templates/roofing/families/classic-premium-roftix/reference-site/index.html \
//     [--out templates/.../reference-site/critique-report.html] \
//     [--agent claude|codex] [--open-design-root /Users/matthew/Developer/open-design]
//
// Strategy: copy artifact into a transient OD client workspace, then call
// existing `npm run open-design:run-concept -- --skill critique`. Returns the
// critique HTML emitted by OD daemon, then symlinks/copies it back beside the
// source artifact for review.
//
// Why this exists: round 0 reference-site iteration loop. Run after every
// material change to get a fresh 5-dim score before deciding next move.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq >= 0) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[k] = true; continue; }
    out[k] = next; i++;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const artifactRel = args.artifact;
if (!artifactRel) {
  console.error('Missing --artifact <path-to-html>');
  process.exit(1);
}
const artifactAbs = path.resolve(REPO, artifactRel);
if (!fs.existsSync(artifactAbs)) {
  console.error(`Artifact not found: ${artifactAbs}`);
  process.exit(1);
}

const agent = args.agent || 'claude';
const slug = `critique-${Date.now()}`;
const clientDir = path.join(REPO, 'clients', slug);
const odOut = path.join(clientDir, 'concept', 'open-design');
fs.mkdirSync(odOut, { recursive: true });

// Seed the OD workspace with the artifact we want reviewed.
fs.copyFileSync(artifactAbs, path.join(odOut, 'index.html'));
fs.writeFileSync(path.join(odOut, 'review-prompt.txt'),
  `Run the critique skill on index.html in this folder. Score 5 dimensions (Philosophy / Hierarchy / Detail / Functionality / Innovation), each 0-10, with cited evidence (class names, section ids). Output Keep / Fix / Quick-wins lists. Emit a single self-contained critique HTML report.`);

const finalOut = args.out
  ? path.resolve(REPO, args.out)
  : path.join(path.dirname(artifactAbs), 'critique-report.html');

console.log(`[od-critique] artifact: ${artifactAbs}`);
console.log(`[od-critique] workspace: ${clientDir}`);
console.log(`[od-critique] agent: ${agent}`);
console.log(`[od-critique] report -> ${finalOut}\n`);

const proc = spawn('npm', [
  'run', 'open-design:run-concept', '--',
  '--client', slug,
  '--skill', 'critique',
  '--agent', agent,
  '--prompt', `Critique index.html across 5 dimensions and emit a single-file HTML report. Be specific: cite section ids (data-od-id="..."), color tokens, font choices. Do not grade-inflate.`,
], { cwd: REPO, stdio: 'inherit' });

proc.on('exit', (code) => {
  if (code !== 0) {
    console.error(`[od-critique] OD run failed (exit ${code})`);
    process.exit(code || 1);
  }
  // Look for critique report in the OD output dir.
  const candidates = [
    path.join(odOut, 'critique-report.html'),
    path.join(odOut, 'critique.html'),
    path.join(odOut, 'index.html'),  // OD may overwrite with the report
  ];
  let found = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const body = fs.readFileSync(c, 'utf8');
      if (body.includes('radar') || body.includes('critique') || body.includes('5 dimension')) {
        found = c; break;
      }
    }
  }
  if (!found) {
    console.error('[od-critique] could not locate critique report in', odOut);
    console.error('    inspect manually then re-run.');
    process.exit(2);
  }
  fs.copyFileSync(found, finalOut);
  console.log(`\n[od-critique] DONE · report saved to ${finalOut}`);
});
