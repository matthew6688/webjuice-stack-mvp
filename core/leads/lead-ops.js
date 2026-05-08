import fs from 'fs';
import path from 'path';
import { createLeadIntake, saveLeadIntake } from './intake.js';
import { createLeadResearch, saveLeadResearch } from './research.js';
import { createRedesignCheck } from './redesign-check.js';
import { createBuildReadyDecision } from './build-ready.js';
import { createOutreachBrief } from './outreach-brief.js';

export function runLeadOps(input = {}) {
  const intake = input.intake || createLeadIntake(input);
  const clientSlug = input.clientSlug || input.client || intake.clientSlug;
  const paths = resolvePaths(clientSlug, input.paths || {});

  const research = input.research || createLeadResearch({
    ...input,
    clientSlug,
    intake,
    intakePath: paths.intake,
  });

  const redesignCheck = input.redesignCheck || createRedesignCheck({
    ...input,
    clientSlug,
    research,
    intakePath: paths.intake,
  });

  const readyToBuild = input.readyToBuild || createBuildReadyDecision({
    ...input,
    clientSlug,
    research,
  });

  const outreachBrief = input.outreachBrief || createOutreachBrief({
    ...input,
    clientSlug,
    research,
    redesignCheck,
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clientSlug,
    sourceType: intake.sourceType,
    buildMode: intake.buildMode,
    gateStatus: intake.gateStatus,
    paths,
    intake,
    research,
    redesignCheck,
    readyToBuild,
    outreachBrief,
    summary: {
      familyId: intake.strategy?.familyId || '',
      previewability: research.previewability?.status || '',
      productionReadiness: research.productionReadiness?.status || '',
      redesignDecision: redesignCheck.decision || '',
      readyToBuildStatus: readyToBuild.status || '',
      outreachChannel: outreachBrief.channelRecommendation || '',
      outreachPreviewMode: outreachBrief.previewMode || '',
    },
  };
}

export function saveLeadOps(result, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return outputPath;
}

export function saveLeadOpsArtifacts(result, outputPaths = {}) {
  const paths = {
    intake: outputPaths.intake || result.paths?.intake || '',
    research: outputPaths.research || result.paths?.research || '',
    redesignCheck: outputPaths.redesignCheck || result.paths?.redesignCheck || '',
    readyToBuild: outputPaths.readyToBuild || result.paths?.readyToBuild || '',
    outreachBrief: outputPaths.outreachBrief || result.paths?.outreachBrief || '',
    leadOps: outputPaths.leadOps || result.paths?.leadOps || '',
  };

  result.paths = paths;

  if (paths.intake) saveLeadIntake(result.intake, paths.intake);
  if (paths.research) saveLeadResearch(result.research, paths.research);
  if (paths.redesignCheck) writeJson(paths.redesignCheck, result.redesignCheck);
  if (paths.readyToBuild) writeJson(paths.readyToBuild, result.readyToBuild);
  if (paths.outreachBrief) writeJson(paths.outreachBrief, result.outreachBrief);
  if (paths.leadOps) saveLeadOps(result, paths.leadOps);
  return paths;
}

function resolvePaths(clientSlug, overrides = {}) {
  if (!clientSlug) return { ...overrides };
  return {
    intake: overrides.intake || path.join('clients', clientSlug, 'lead', 'lead-intake.json'),
    research: overrides.research || path.join('clients', clientSlug, 'lead', 'lead-research.json'),
    redesignCheck: overrides.redesignCheck || path.join('clients', clientSlug, 'lead', 'redesign-check.json'),
    readyToBuild: overrides.readyToBuild || path.join('clients', clientSlug, 'lead', 'ready-to-build.json'),
    outreachBrief: overrides.outreachBrief || path.join('clients', clientSlug, 'outreach', 'outreach-brief.json'),
    leadOps: overrides.leadOps || path.join('clients', clientSlug, 'lead', 'lead-ops.json'),
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

