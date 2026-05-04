import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { validateAgentTask } from './task.js';

export function buildRunPlan(task, { repoDir, assetsDir } = {}) {
  const validation = validateAgentTask(task);
  if (!validation.ok) throw new Error(`Invalid task: ${validation.errors.join('; ')}`);
  if (!repoDir) throw new Error('repoDir is required');

  return {
    taskId: task.id,
    clientSlug: task.clientSlug,
    repo: task.repo,
    branch: task.branch,
    repoDir,
    steps: [
      {
        id: 'apply-artifacts',
        command: 'npm',
        args: [
          'run',
          'apply:restaurant-artifacts',
          '--',
          '--content',
          path.resolve(task.contentPath),
          '--design',
          path.resolve(task.designPath),
          ...(assetsDir ? ['--assets-dir', path.resolve(assetsDir)] : []),
        ],
      },
      {
        id: 'build',
        command: 'npm',
        args: ['run', 'build'],
      },
    ],
  };
}

export function runAgentTask(task, options = {}) {
  const plan = buildRunPlan(task, options);
  const startedAt = new Date().toISOString();
  const result = {
    taskId: task.id,
    clientSlug: task.clientSlug,
    repo: task.repo,
    dryRun: options.dryRun !== false,
    startedAt,
    finishedAt: '',
    steps: [],
    ok: false,
  };

  ensureRunnerPreflight(plan.repoDir);

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

    try {
      stepResult.output = execFileSync(step.command, step.args, {
        cwd: plan.repoDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      stepResult.ok = false;
      stepResult.output = `${error.stdout || ''}${error.stderr || ''}`.trim();
      result.steps.push(stepResult);
      result.finishedAt = new Date().toISOString();
      return result;
    }
    result.steps.push(stepResult);
  }

  result.finishedAt = new Date().toISOString();
  result.ok = result.steps.every((step) => step.ok);
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
