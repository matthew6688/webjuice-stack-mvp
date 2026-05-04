import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { recordAgentRun } from '../cases/case-file.js';
import { validateAgentTask } from './task.js';

export function buildRunPlan(task, { repoDir, assetsDir, repoRoot = process.cwd(), checkout = false, push = false } = {}) {
  const validation = validateAgentTask(task);
  if (!validation.ok) throw new Error(`Invalid task: ${validation.errors.join('; ')}`);
  if (!repoDir) throw new Error('repoDir is required');

  const context = loadTaskContext(task, { repoRoot });
  const contentPath = context.required.content;
  const designPath = context.required.design;
  const mode = task.kind || task.type || 'unknown';
  const steps = [];
  if (checkout) {
    steps.push({
      id: 'checkout-branch',
      command: 'git',
      args: ['checkout', task.branch || 'dev'],
      cwd: repoDir,
    });
  }
  steps.push({
    id: 'apply-artifacts',
    command: 'npm',
    args: [
      'run',
      'apply:restaurant-artifacts',
      '--',
      '--content',
      contentPath,
      '--design',
      designPath,
      ...(assetsDir ? ['--assets-dir', path.resolve(assetsDir)] : []),
    ],
    cwd: repoDir,
  });
  steps.push({
    id: 'build',
    command: 'npm',
    args: ['run', 'build'],
    cwd: repoDir,
  });
  if (push) {
    steps.push({
      id: 'stage-changes',
      command: 'git',
      args: ['add', '-A'],
      cwd: repoDir,
      skipIfNoChanges: true,
    });
    steps.push({
      id: 'commit-dev',
      command: 'git',
      args: ['commit', '-m', commitMessage(task)],
      cwd: repoDir,
      allowNoChanges: true,
    });
    steps.push({
      id: 'push-dev',
      command: 'git',
      args: ['push', 'origin', task.branch || 'dev'],
      cwd: repoDir,
    });
  }

  return {
    taskId: task.id,
    mode,
    clientSlug: task.clientSlug,
    repo: task.repo,
    branch: task.branch,
    repoDir,
    context,
    steps,
  };
}

export function runAgentTask(task, options = {}) {
  const plan = buildRunPlan(task, options);
  const startedAt = new Date().toISOString();
  const result = {
    taskId: task.id,
    mode: plan.mode,
    clientSlug: task.clientSlug,
    repo: task.repo,
    branch: task.branch,
    repoDir: plan.repoDir,
    previewUrl: task.previewUrl || '',
    dryRun: options.dryRun !== false,
    startedAt,
    finishedAt: '',
    steps: [],
    context: summarizeContext(plan.context),
    changedFiles: [],
    pushed: false,
    commit: '',
    ok: false,
  };

  ensureRunnerPreflight(plan.repoDir);
  writeAgentBrief(task, plan.context, options);

  for (const step of plan.steps) {
    const stepResult = {
      id: step.id,
      command: [step.command, ...step.args].join(' '),
      ok: true,
      output: '',
    };

    if (result.dryRun) {
      stepResult.output = 'dry-run';
      result.steps.push(stepResult);
      continue;
    }

    if (step.skipIfNoChanges && !hasGitChanges(plan.repoDir)) {
      stepResult.output = 'skipped: no git changes';
      result.steps.push(stepResult);
      continue;
    }

    try {
      stepResult.output = execFileSync(step.command, step.args, {
        cwd: step.cwd || plan.repoDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
      if (step.allowNoChanges && /nothing to commit|no changes added/i.test(output)) {
        stepResult.output = output || 'no changes to commit';
        result.steps.push(stepResult);
        continue;
      }
      stepResult.ok = false;
      stepResult.output = output;
      result.steps.push(stepResult);
      result.finishedAt = new Date().toISOString();
      finalizeRun(task, result, options);
      return result;
    }
    if (step.id === 'commit-dev') result.commit = currentCommit(plan.repoDir);
    if (step.id === 'push-dev') result.pushed = true;
    result.steps.push(stepResult);
  }

  result.finishedAt = new Date().toISOString();
  result.changedFiles = gitChangedFiles(plan.repoDir);
  result.ok = result.steps.every((step) => step.ok);
  finalizeRun(task, result, options);
  return result;
}

export function saveRunResult(result, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return outputPath;
}

function ensureRunnerPreflight(repoDir) {
  const packagePath = path.join(repoDir, 'package.json');
  if (!fs.existsSync(packagePath)) throw new Error(`Missing package.json in repoDir: ${repoDir}`);
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (!pkg.scripts?.['apply:restaurant-artifacts']) {
    throw new Error(`Repo is not artifact-runner ready: missing npm script apply:restaurant-artifacts in ${packagePath}`);
  }
  if (!pkg.scripts?.build) {
    throw new Error(`Repo is not build-ready: missing npm script build in ${packagePath}`);
  }
}

function loadTaskContext(task, { repoRoot }) {
  const required = {
    evidence: resolveRepoPath(task.evidencePath || task.requiredContext?.evidence, repoRoot),
    content: resolveRepoPath(task.contentPath || task.requiredContext?.content, repoRoot),
    design: resolveRepoPath(task.designPath || task.requiredContext?.design, repoRoot),
    brandSpec: resolveRepoPath(task.brandSpecPath || task.requiredContext?.brandSpec, repoRoot, false),
    checkout: resolveRepoPath(task.checkoutPath || task.requiredContext?.checkout, repoRoot, false),
  };
  for (const [key, filePath] of Object.entries(required)) {
    if (['brandSpec', 'checkout'].includes(key) && !filePath) continue;
    if (!filePath || !fs.existsSync(filePath)) throw new Error(`Missing required context ${key}: ${filePath || '(unset)'}`);
  }
  const caseContextPath = task.case?.contextPath ? resolveRepoPath(task.case.contextPath, repoRoot, false) : '';
  const casePath = task.case?.casePath ? resolveRepoPath(task.case.casePath, repoRoot, false) : '';
  return {
    caseContextPath,
    casePath,
    caseContext: readJsonIfExists(caseContextPath),
    caseFile: readJsonIfExists(casePath),
    required,
    designProtocol: task.designProtocol || {},
    allowedFiles: task.allowedFiles || [],
    activeConstraints: task.activeConstraints || [],
  };
}

function resolveRepoPath(filePath, repoRoot, required = true) {
  if (!filePath) {
    if (required) return '';
    return '';
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeAgentBrief(task, context, options) {
  const artifactsDir = task.case?.dir ? path.join(resolveRepoPath(task.case.dir, options.repoRoot || process.cwd()), 'artifacts') : '';
  if (!artifactsDir || options.dryRun !== false) return;
  fs.mkdirSync(artifactsDir, { recursive: true });
  const briefPath = path.join(artifactsDir, `${task.id}.agent-brief.md`);
  const lines = [
    `# Agent Brief: ${task.id}`,
    '',
    `Client: ${task.clientSlug}`,
    `Repo: ${task.repo}`,
    `Branch: ${task.branch}`,
    `Mode: ${task.kind || task.type || 'unknown'}`,
    '',
    '## Required Read Order',
    '',
    `1. ${task.case?.contextPath || 'case context packet'}`,
    `2. ${task.case?.timelinePath || 'timeline.jsonl'}`,
    `3. ${task.requiredContext?.evidence || task.evidencePath || 'evidence'}`,
    `4. ${task.requiredContext?.content || task.contentPath || 'content'}`,
    `5. ${task.requiredContext?.design || task.designPath || 'design'}`,
    `6. ${task.requiredContext?.brandSpec || 'brand spec'}`,
    '',
    '## Customer Request',
    '',
    task.requestedChanges || '(none)',
    '',
    '## Design Protocol',
    '',
    `Required skill: ${context.designProtocol.requiredSkill || 'huashu-design'}`,
    ...(context.designProtocol.rules || []).map((rule) => `- ${rule}`),
    '',
    '## Constraints',
    '',
    ...(context.activeConstraints || []).map((rule) => `- ${rule}`),
  ];
  fs.writeFileSync(briefPath, `${lines.join('\n')}\n`);
}

function finalizeRun(task, result, options) {
  const casePaths = task.case ? {
    casePath: resolveRepoPath(task.case.casePath, options.repoRoot || process.cwd(), false),
    contextPath: resolveRepoPath(task.case.contextPath, options.repoRoot || process.cwd(), false),
    timelinePath: resolveRepoPath(task.case.timelinePath, options.repoRoot || process.cwd(), false),
    agentRunsPath: resolveRepoPath(task.case.agentRunsPath, options.repoRoot || process.cwd(), false),
  } : null;
  result.caseRecord = recordAgentRun(casePaths, result, { dryRun: options.dryRun !== false });
}

function summarizeContext(context) {
  return {
    hasCaseContext: Boolean(context.caseContext),
    hasCaseFile: Boolean(context.caseFile),
    required: context.required,
    designSkill: context.designProtocol.requiredSkill || '',
    allowedFiles: context.allowedFiles,
  };
}

function gitChangedFiles(repoDir) {
  const output = execFileSync('git', ['status', '--short'], {
    cwd: repoDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (!output) return [];
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function hasGitChanges(repoDir) {
  return gitChangedFiles(repoDir).length > 0;
}

function currentCommit(repoDir) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function commitMessage(task) {
  const type = task.kind || task.type || 'task';
  return `chore: run ${type} task ${task.id}`;
}
