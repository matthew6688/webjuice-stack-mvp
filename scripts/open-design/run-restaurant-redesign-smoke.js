#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import os from 'os';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(process.cwd());
const clientSlug = String(args.client || 'rich-and-rare-longterm-smoke').trim();
const sourceUrl = String(args['source-url'] || 'https://www.richandrare.com.au/').trim();
const businessType = String(args['business-type'] || 'restaurant - steak and seafood restaurant').trim();
const tone = String(args.tone || 'Luxury / refined, match existing Rich & Rare brand').trim();
const scope = String(args.scope || 'Full concept with 3-4 key pages').trim();
const timeoutMs = String(args['timeout-ms'] || '900000').trim();
const openDesignRoot = String(args['open-design-root'] || process.env.OPEN_DESIGN_ROOT || '/Users/matthew/Developer/open-design').trim();
const summaryPath = path.resolve(args.output || path.join('data', 'qa', 'open-design', `${clientSlug}-restaurant-redesign-smoke.json`));
const execute = args.execute === true || args.execute === 'true';
const prompt = String(args.prompt || defaultPrompt({ sourceUrl, businessType })).trim();
const seedDir = path.join(os.tmpdir(), `${clientSlug}-od-seed`);

const plan = {
  ok: true,
  execute,
  clientSlug,
  sourceUrl,
  businessType,
  tone,
  scope,
  timeoutMs: Number(timeoutMs),
  openDesignRoot,
  summaryPath,
  prompt,
  seedDir,
  commands: {
    runConcept: `npm run open-design:run-concept -- --client ${clientSlug} --open-design-root ${openDesignRoot} --mode app-visible --source-url ${sourceUrl} --business-type "${businessType}" --tone "${tone}" --scope "${scope}" --seed-dir ${seedDir} --prompt "<see default prompt in script>" --timeout-ms ${timeoutMs}`,
    validateConcept: `npm run open-design:validate-concept -- --client ${clientSlug} --require-source-pages true --must-contain "Rich & Rare"`,
  },
};

if (!execute) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

prepareSeedSourceMaterials({ seedDir, sourceUrl });

const runConcept = run('npm', [
  'run',
  'open-design:run-concept',
  '--',
  '--client',
  clientSlug,
  '--open-design-root',
  openDesignRoot,
  '--mode',
  'app-visible',
  '--source-url',
  sourceUrl,
  '--business-type',
  businessType,
  '--tone',
  tone,
  '--scope',
  scope,
  '--seed-dir',
  seedDir,
  '--prompt',
  prompt,
  '--timeout-ms',
  timeoutMs,
], root);

const validate = run('npm', [
  'run',
  'open-design:validate-concept',
  '--',
  '--client',
  clientSlug,
  '--require-source-pages',
  'true',
  '--must-contain',
  'Rich & Rare',
], root);

const runConceptStdout = runConcept.stdout.trim();
const conceptDir = path.join(root, 'clients', clientSlug, 'concept', 'open-design');
const manifest = JSON.parse(fs.readFileSync(path.join(conceptDir, 'concept-manifest.json'), 'utf8'));
const validation = extractJsonFromOutput(validate.stdout);
const summary = {
  ok: runConcept.status === 0 && validate.status === 0 && validation.ok === true,
  execute,
  clientSlug,
  sourceUrl,
  openDesignRoot,
  projectId: manifest.projectId,
  runId: manifest.lastRunId || manifest.runId,
  conceptDir,
  status: manifest.status?.status || null,
  completionMode: manifest.status?.completionMode || manifest.status?.completionMode || null,
  counts: validation.counts,
  validation,
  commands: plan.commands,
  prompt,
  seedDir,
};

fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

function run(command, argv, cwd) {
  const result = spawnSync(command, argv, {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${argv.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}

function defaultPrompt({ sourceUrl, businessType }) {
  return [
    '[form answers — discovery]',
    '- Primary surface: Responsive — all sizes',
    `- Who is this redesign for?: ${businessType}`,
    '- Visual tone: Luxury / refined',
    '- Brand context: Match the existing richandrare.com.au brand',
    '- What should I redesign first?: Full concept with 3–4 key pages',
    `- Source website: ${sourceUrl}`,
    '- Anything else I should know?: Preserve the existing Rich & Rare brand, logo, menu, booking/contact/location intent, current sitemap intent, and official business facts. Local source captures have already been seeded into ./source/ inside the Open Design project. Use those local files as the primary reference instead of re-crawling the website unless one of them is missing. Produce a canonical concept entry page as index.html, plus brand-spec.md and local assets, not source captures only. This is concept generation only. Do not deploy and do not edit any ProfitsLocal production repo.',
  ].join('\n');
}

function extractJsonFromOutput(stdout) {
  const text = String(stdout || '').trim();
  const start = text.lastIndexOf('\n{');
  const candidate = start >= 0 ? text.slice(start + 1) : text;
  return JSON.parse(candidate);
}

function prepareSeedSourceMaterials({ seedDir, sourceUrl }) {
  fs.rmSync(seedDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(seedDir, 'source'), { recursive: true });
  const pages = [
    { name: 'home', url: sourceUrl },
    { name: 'menu', url: new URL('/lunch-dinner', sourceUrl).toString() },
    { name: 'functions', url: new URL('/functions', sourceUrl).toString() },
    { name: 'contact', url: new URL('/contact', sourceUrl).toString() },
    { name: 'bookings', url: new URL('/bookings', sourceUrl).toString() },
  ];
  const captured = [];
  for (const page of pages) {
    const result = run('curl', ['-L', '--max-time', '30', '-A', 'Mozilla/5.0', page.url], root);
    const htmlPath = path.join(seedDir, 'source', `${page.name}.html`);
    fs.writeFileSync(htmlPath, result.stdout);
    captured.push({ name: page.name, url: page.url, path: `source/${page.name}.html`, bytes: Buffer.byteLength(result.stdout) });
  }
  const brief = [
    '# Source brief',
    '',
    'These source captures were prepared before the run. Use them as the primary redesign reference.',
    '',
    ...captured.map((item) => `- ${item.name}: ${item.url} -> ${item.path}`),
  ].join('\n');
  fs.writeFileSync(path.join(seedDir, 'source-brief.md'), `${brief}\n`);
}
