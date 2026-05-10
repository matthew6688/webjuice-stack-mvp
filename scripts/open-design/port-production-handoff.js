#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || '';

if (!clientSlug && !args.handoff) {
  console.error('Usage: node scripts/open-design/port-production-handoff.js --client slug [--handoff file] [--target-repo path] [--execute true]');
  process.exit(1);
}

const handoffPath = path.resolve(args.handoff || path.join('clients', clientSlug, 'concept', 'open-design', 'production-handoff.json'));
const handoff = JSON.parse(fs.readFileSync(handoffPath, 'utf8'));
const targetRepo = path.resolve(args['target-repo'] || handoff.target?.repo || '');
const dryRun = args.execute !== 'true';
const currentClient = clientSlug || handoff.clientSlug;

if (!targetRepo) throw new Error('target repo is required');
validateHandoff(handoff, handoffPath);
validateTargetRepo(targetRepo);

const conceptDir = handoff.concept?.conceptDir || path.dirname(handoff.concept?.indexPath || handoffPath);
const assetPrefix = args['asset-prefix'] || path.posix.join('open-design', currentClient);
const copiedAssets = copyConceptAssets({
  conceptDir,
  targetRepo,
  assetPrefix,
  assets: handoff.concept?.files?.assets || [],
  dryRun,
});
const dataTarget = path.join(targetRepo, 'src', 'data', 'open-design.production-handoff.json');
const contentTarget = path.join(targetRepo, 'src', 'data', 'content.restaurant.json');
const designTarget = path.join(targetRepo, 'src', 'data', 'design.restaurant.json');
const cssTarget = path.join(targetRepo, 'src', 'styles', 'open-design-handoff.css');
const cssImportTarget = chooseCssImportTarget(targetRepo);
const normalized = buildProductionImportData({ handoff, copiedAssets, assetPrefix });
const css = buildTokenCss({ handoff, clientSlug: currentClient });
const bridgeCss = buildInlineBridgeCss({ handoff, cssTarget });
const importResult = ensureCssBridge({ cssImportTarget, bridgeCss, dryRun });
const artifactCopies = copySupportingArtifacts({
  handoff,
  targetRepo,
  dryRun,
  targets: {
    content: contentTarget,
    design: designTarget,
  },
});

if (!dryRun) {
  writeJson(dataTarget, normalized);
  writeFile(cssTarget, css);
}

const result = {
  ok: true,
  dryRun,
  clientSlug: currentClient,
  handoffPath,
  targetRepo,
  wrote: dryRun ? [] : [
    dataTarget,
    cssTarget,
    ...artifactCopies.wrote,
    ...(importResult.updated ? [cssImportTarget] : []),
  ],
  cssImportTarget,
  cssBridge: importResult,
  copiedAssets,
  copiedArtifacts: artifactCopies.copied,
  preserved: {
    businessName: normalized.sourceOfTruth.businessName,
    phone: normalized.sourceOfTruth.phone,
    address: normalized.sourceOfTruth.address,
    reserveUrl: normalized.sourceOfTruth.reserveUrl,
    menuSourceUrl: normalized.sourceOfTruth.menuSourceUrl,
  },
  routes: normalized.routes,
  rule: 'Production repo receives structured design tokens/assets/handoff data. Open Design standalone HTML is not deployed directly.',
};

console.log(JSON.stringify(result, null, 2));

function validateHandoff(value, filePath) {
  if (value.schemaVersion !== 1) throw new Error(`Unsupported handoff schema in ${filePath}`);
  if (value.purpose !== 'open_design_concept_to_webjuice_astro_handoff') {
    throw new Error(`Not an Open Design production handoff: ${filePath}`);
  }
  if (!value.concept?.indexPath) throw new Error('handoff missing concept.indexPath');
  if (!fs.existsSync(value.concept.indexPath)) throw new Error(`concept index missing: ${value.concept.indexPath}`);
  if (!value.sourceOfTruth?.rule) throw new Error('handoff missing sourceOfTruth.rule');
}

function validateTargetRepo(repoDir) {
  if (!fs.existsSync(path.join(repoDir, 'package.json'))) throw new Error(`target repo package.json missing: ${repoDir}`);
  if (!fs.existsSync(path.join(repoDir, 'src'))) throw new Error(`target repo src/ missing: ${repoDir}`);
  if (!fs.existsSync(path.join(repoDir, 'public'))) throw new Error(`target repo public/ missing: ${repoDir}`);
}

function copyConceptAssets({ conceptDir, targetRepo, assetPrefix, assets, dryRun }) {
  const copied = [];
  for (const asset of assets) {
    const rel = typeof asset === 'string' ? asset : asset.path;
    if (!rel) continue;
    const source = path.join(conceptDir, rel);
    if (!fs.existsSync(source)) {
      copied.push({ source, skipped: true, reason: 'missing_source' });
      continue;
    }
    const targetRel = path.posix.join(assetPrefix, path.posix.basename(rel));
    const target = path.join(targetRepo, 'public', targetRel);
    copied.push({
      source,
      target,
      publicPath: `/${targetRel}`,
      bytes: fs.statSync(source).size,
    });
    if (!dryRun) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  }
  return copied;
}

function buildProductionImportData({ handoff, copiedAssets, assetPrefix }) {
  const facts = handoff.extracted?.contentFacts || {};
  const concept = handoff.extracted?.conceptFacts || {};
  const routes = unique((handoff.extracted?.pages || []).map((page) => page.targetRoute)).filter(Boolean);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clientSlug: handoff.clientSlug,
    source: {
      handoffPurpose: handoff.purpose,
      handoffGeneratedAt: handoff.generatedAt,
      openDesignProjectId: handoff.concept?.projectId || '',
      openDesignRunId: handoff.concept?.runId || '',
      conceptDir: handoff.concept?.conceptDir || '',
      standaloneHtmlPolicy: 'do_not_deploy_directly',
    },
    sourceOfTruth: {
      rule: handoff.sourceOfTruth?.rule || '',
      evidencePath: handoff.sourceOfTruth?.evidencePath || '',
      contentPath: handoff.sourceOfTruth?.contentPath || '',
      designPath: handoff.sourceOfTruth?.designPath || '',
      surveyPath: handoff.sourceOfTruth?.surveyPath || '',
      businessName: facts.businessName || '',
      phone: facts.phone || '',
      address: facts.address || '',
      reserveUrl: facts.reserveUrl || '',
      menuSourceUrl: facts.menuSourceUrl || '',
    },
    designDirection: {
      title: concept.title || '',
      headings: concept.headings || [],
      tokens: handoff.extracted?.tokens || {},
      copiedAssets: copiedAssets.filter((asset) => !asset.skipped).map((asset) => ({
        publicPath: asset.publicPath,
        bytes: asset.bytes,
      })),
      assetPrefix: `/${assetPrefix}`,
    },
    routes,
    requiredPreservationChecks: handoff.requiredPreservationChecks || [],
    implementationPlan: handoff.implementationPlan || [],
  };
}

function buildTokenCss({ handoff, clientSlug }) {
  const tokens = handoff.extracted?.tokens || {};
  const rrMap = {
    '--bg': '--rr-bg',
    '--surface': '--rr-panel',
    '--fg': '--rr-fg',
    '--muted': '--rr-muted',
    '--border': '--rr-border',
    '--accent': '--rr-accent',
  };
  const mapped = Object.entries(rrMap)
    .filter(([source]) => tokens[source])
    .map(([source, target]) => `  ${target}: ${tokens[source]};`);
  const rootVars = Object.entries(tokens).map(([key, value]) => `  --od${key.slice(1)}: ${value};`);
  return [
    '/* Generated by scripts/open-design/port-production-handoff.js. */',
    `/* Client: ${clientSlug}. Open Design supplies visual tokens; business facts stay in content/evidence artifacts. */`,
    ':root {',
    ...rootVars,
    '}',
    '',
    '.rr-od {',
    ...mapped,
    '}',
    '',
  ].join('\n');
}

function buildInlineBridgeCss({ handoff, cssTarget }) {
  const tokens = handoff.extracted?.tokens || {};
  const rrMap = {
    '--bg': '--rr-bg',
    '--surface': '--rr-panel',
    '--fg': '--rr-fg',
    '--muted': '--rr-muted',
    '--border': '--rr-border',
    '--accent': '--rr-accent',
  };
  const mapped = Object.entries(rrMap)
    .filter(([source]) => tokens[source])
    .map(([source, target]) => `  ${target}: ${tokens[source]};`);
  return [
    '/* Open Design production handoff token bridge. */',
    `/* Audit source: ${cssTarget} */`,
    '.rr-od {',
    ...mapped,
    '}',
  ].join('\n');
}

function chooseCssImportTarget(repoDir) {
  const richRare = path.join(repoDir, 'src', 'styles', 'rich-rare-open-design.css');
  if (fs.existsSync(richRare)) return richRare;
  return path.join(repoDir, 'src', 'styles', 'global.css');
}

function ensureCssBridge({ cssImportTarget, bridgeCss, dryRun }) {
  const begin = '/* BEGIN OPEN DESIGN HANDOFF BRIDGE */';
  const end = '/* END OPEN DESIGN HANDOFF BRIDGE */';
  const block = `${begin}\n${bridgeCss}\n${end}`;
  const current = fs.existsSync(cssImportTarget) ? fs.readFileSync(cssImportTarget, 'utf8') : '';
  if (current.includes(begin)) {
    const next = current.replace(new RegExp(`${escapeRegExp(begin)}[\\s\\S]*?${escapeRegExp(end)}`), block);
    if (!dryRun && next !== current) fs.writeFileSync(cssImportTarget, next);
    return { updated: next !== current, alreadyPresent: next === current, mode: 'replace' };
  }
  if (!dryRun) fs.writeFileSync(cssImportTarget, `${current.trimEnd()}\n\n${block}\n`);
  return { updated: true, alreadyPresent: false, mode: 'append' };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function copySupportingArtifacts({ handoff, targetRepo, dryRun, targets }) {
  const copies = [];
  const mappings = [
    { kind: 'content', source: handoff.sourceOfTruth?.contentPath, target: targets.content },
    { kind: 'design', source: handoff.sourceOfTruth?.designPath, target: targets.design },
  ];
  const wrote = [];
  for (const mapping of mappings) {
    const source = typeof mapping.source === 'string' ? mapping.source : '';
    if (!source) {
      copies.push({ kind: mapping.kind, skipped: true, reason: 'missing_source_path' });
      continue;
    }
    const resolvedSource = path.resolve(source);
    if (!fs.existsSync(resolvedSource)) {
      copies.push({ kind: mapping.kind, source: resolvedSource, skipped: true, reason: 'missing_source_file' });
      continue;
    }
    copies.push({
      kind: mapping.kind,
      source: resolvedSource,
      target: mapping.target,
      bytes: fs.statSync(resolvedSource).size,
    });
    if (!dryRun) {
      fs.mkdirSync(path.dirname(mapping.target), { recursive: true });
      fs.copyFileSync(resolvedSource, mapping.target);
      wrote.push(mapping.target);
    }
  }
  return { copied: copies, wrote };
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
