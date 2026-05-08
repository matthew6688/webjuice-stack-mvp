#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const sourceRoot = args['source-root'] || args.sourceRoot || '';
const clientsRoot = args['clients-root'] || args.clientsRoot || 'clients';
const sourceType = args['source-type'] || args.sourceType || 'google_search';
const campaignLabel = args.campaign || args['campaign-label'] || args.campaignLabel || 'Google discovery import';

if (!sourceRoot) {
  console.error('Usage: node scripts/leads/promote-discovery-run.js --source-root data/qa/roofer-discovery [--clients-root clients] [--source-type google_search] [--campaign "Google search: Brisbane roofers"]');
  process.exit(1);
}

if (!fs.existsSync(sourceRoot)) {
  console.error(`Source root does not exist: ${sourceRoot}`);
  process.exit(1);
}

const promoted = [];
for (const entry of fs.readdirSync(sourceRoot).sort()) {
  const sourceDir = path.join(sourceRoot, entry);
  if (!fs.statSync(sourceDir).isDirectory()) continue;
  const intakePath = path.join(sourceDir, 'lead-intake.json');
  const researchPath = path.join(sourceDir, 'lead-research.json');
  const leadOpsPath = path.join(sourceDir, 'lead-ops.json');
  if (!fs.existsSync(intakePath) || !fs.existsSync(researchPath) || !fs.existsSync(leadOpsPath)) continue;

  const intake = readJson(intakePath);
  const clientSlug = intake.clientSlug || entry;
  const clientDir = path.join(clientsRoot, clientSlug);
  const leadDir = path.join(clientDir, 'lead');
  const outreachDir = path.join(clientDir, 'outreach');
  fs.mkdirSync(leadDir, { recursive: true });
  fs.mkdirSync(outreachDir, { recursive: true });

  copyJsonWithMeta(intakePath, path.join(leadDir, 'lead-intake.json'), (json) => ({
    ...json,
    sourceType,
    rawInputs: {
      ...(json.rawInputs || {}),
      importedFrom: sourceRoot,
      importCampaign: campaignLabel,
    },
  }));
  copyJsonWithMeta(researchPath, path.join(leadDir, 'lead-research.json'), (json) => ({
    ...json,
    sourceType,
    importedFrom: json.importedFrom || sourceRoot,
  }));
  copyIfExists(path.join(sourceDir, 'redesign-check.json'), path.join(leadDir, 'redesign-check.json'));
  copyIfExists(path.join(sourceDir, 'ready-to-build.json'), path.join(leadDir, 'ready-to-build.json'));
  copyIfExists(path.join(sourceDir, 'outreach-brief.json'), path.join(outreachDir, 'outreach-brief.json'));
  copyJsonWithMeta(leadOpsPath, path.join(leadDir, 'lead-ops.json'), (json) => ({
    ...json,
    sourceType,
    importedFrom: json.importedFrom || sourceRoot,
    paths: {
      ...(json.paths || {}),
      intake: path.join(leadDir, 'lead-intake.json'),
      research: path.join(leadDir, 'lead-research.json'),
      redesignCheck: path.join(leadDir, 'redesign-check.json'),
      readyToBuild: path.join(leadDir, 'ready-to-build.json'),
      outreachBrief: path.join(outreachDir, 'outreach-brief.json'),
      leadOps: path.join(leadDir, 'lead-ops.json'),
    },
  }));

  const notePath = path.join(outreachDir, 'lead-notes.jsonl');
  const note = {
    id: `lead_note_promote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'lead_note',
    action: '',
    actor: 'lead-discovery-importer',
    note: `${campaignLabel} 已导入 admin pipeline。来源：${sourceRoot}`,
    nextFollowUpDue: '',
    createdAt: new Date().toISOString(),
  };
  fs.appendFileSync(notePath, `${JSON.stringify(note)}\n`, 'utf8');

  promoted.push({
    clientSlug,
    businessName: intake.project?.businessName || intake.facts?.verified?.businessName || clientSlug,
    leadDir,
    outreachDir,
  });
}

console.log(JSON.stringify({
  ok: true,
  sourceRoot,
  clientsRoot,
  sourceType,
  campaignLabel,
  promotedCount: promoted.length,
  promoted,
}, null, 2));

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function copyJsonWithMeta(from, to, map) {
  const json = map(readJson(from));
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    parsed[key] = value;
    if (value !== true) i += 1;
  }
  return parsed;
}
