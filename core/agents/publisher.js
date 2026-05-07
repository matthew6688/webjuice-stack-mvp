import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { recordAgentRun } from '../cases/case-file.js';

export function publishApprovedTask(task, options = {}) {
  const repoDir = options.repoDir;
  if (!repoDir) throw new Error('repoDir is required');
  const dryRun = options.dryRun !== false;
  const sourceBranch = options.sourceBranch || task.branch || 'dev';
  const targetBranch = options.targetBranch || 'main';
  const startedAt = new Date().toISOString();
  const result = {
    taskId: task.id || '',
    mode: 'publish',
    clientSlug: task.clientSlug || '',
    repo: task.repo || '',
    sourceBranch,
    targetBranch,
    repoDir,
    dryRun,
    startedAt,
    finishedAt: '',
    steps: [],
    changedFiles: [],
    audit: {
      contextRead: {
        case: Boolean(task.case?.casePath),
        caseContext: Boolean(task.case?.contextPath),
        evidence: Boolean(task.requiredContext?.evidence || task.evidencePath),
        content: Boolean(task.requiredContext?.content || task.contentPath),
        design: Boolean(task.requiredContext?.design || task.designPath),
        brandSpec: Boolean(task.requiredContext?.brandSpec || task.brandSpecPath),
        checkout: Boolean(task.requiredContext?.checkout || task.checkoutPath),
      },
      designProtocolUsed: {
        requiredSkill: task.designProtocol?.requiredSkill || '',
        openDesignSkills: task.designProtocol?.openDesignSkills || [],
        mode: task.designProtocol?.mode || '',
      },
      qaScreenshots: normalizeList(options.qaScreenshots),
      devDeployUrl: task.previewUrl || '',
      customerEmailId: options.customerEmailId || '',
    },
    pushed: false,
    commit: '',
    devCommit: '',
    ok: false,
  };

  runStep(result, {
    id: 'preflight-clean',
    command: 'git',
    args: ['status', '--porcelain'],
    cwd: repoDir,
    check: (output) => {
      if (output.trim()) throw new Error(`Repo has uncommitted changes:\n${output}`);
    },
  }, dryRun);
  if (result.steps.some((step) => !step.ok)) return finalize(task, result, options);

  runStep(result, { id: 'fetch', command: 'git', args: ['fetch', 'origin', sourceBranch, targetBranch], cwd: repoDir }, dryRun);
  runStep(result, { id: 'checkout-source', command: 'git', args: ['checkout', sourceBranch], cwd: repoDir }, dryRun);
  runStep(result, { id: 'pull-source', command: 'git', args: ['pull', '--ff-only', 'origin', sourceBranch], cwd: repoDir }, dryRun);
  if (shouldInstallDependencies(repoDir)) {
    runStep(result, {
      id: 'install-deps',
      command: installCommand(repoDir).command,
      args: installCommand(repoDir).args,
      cwd: repoDir,
    }, dryRun);
  }
  runStep(result, { id: 'build-source', command: 'npm', args: ['run', 'build'], cwd: repoDir }, dryRun);
  if (!dryRun && result.steps.every((step) => step.ok)) {
    result.devCommit = gitOutput(repoDir, ['rev-parse', sourceBranch]);
  }
  runStep(result, { id: 'checkout-target', command: 'git', args: ['checkout', targetBranch], cwd: repoDir }, dryRun);
  runStep(result, { id: 'pull-target', command: 'git', args: ['pull', '--ff-only', 'origin', targetBranch], cwd: repoDir }, dryRun);
  runStep(result, { id: 'copy-source-tree', command: 'git', args: ['read-tree', '--reset', '-u', sourceBranch], cwd: repoDir }, dryRun);
  if (!dryRun) ensureGitIdentity(repoDir);
  runStep(result, { id: 'commit-live', command: 'git', args: ['commit', '-m', commitMessage(task, sourceBranch)], cwd: repoDir, allowNoChanges: true }, dryRun);
  if (!dryRun && result.steps.every((step) => step.ok)) {
    result.commit = gitOutput(repoDir, ['rev-parse', targetBranch]);
    result.changedFiles = [];
  }
  if (options.push) {
    runStep(result, { id: 'push-live', command: 'git', args: ['push', 'origin', targetBranch], cwd: repoDir }, dryRun);
    result.pushed = !dryRun && result.steps.every((step) => step.ok);
  }

  return finalize(task, result, options);
}

function runStep(result, step, dryRun) {
  const stepResult = {
    id: step.id,
    command: [step.command, ...step.args].join(' '),
    ok: true,
    output: '',
  };
  if (dryRun) {
    stepResult.output = 'dry-run';
    result.steps.push(stepResult);
    return;
  }
  try {
    const output = execFileSync(step.command, step.args, {
      cwd: step.cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (step.check) step.check(output);
    stepResult.output = output;
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}${error.message ? `\n${error.message}` : ''}`.trim();
    if (step.allowNoChanges && /nothing to commit|no changes added/i.test(output)) {
      stepResult.output = output || 'no changes to commit';
      result.steps.push(stepResult);
      return;
    }
    stepResult.ok = false;
    stepResult.output = output;
  }
  result.steps.push(stepResult);
}

function finalize(task, result, options) {
  result.finishedAt = new Date().toISOString();
  result.ok = result.steps.every((step) => step.ok);
  if (task.case) {
    const repoRoot = options.repoRoot || process.cwd();
    const casePaths = {
      casePath: resolvePath(task.case.casePath, repoRoot),
      contextPath: resolvePath(task.case.contextPath, repoRoot),
      timelinePath: resolvePath(task.case.timelinePath, repoRoot),
      agentRunsPath: resolvePath(task.case.agentRunsPath, repoRoot),
    };
    result.caseRecord = recordAgentRun(casePaths, {
      ...result,
      branch: result.targetBranch,
      previewUrl: options.liveUrl || task.liveUrl || '',
    }, { dryRun: result.dryRun });
  }
  return result;
}

function gitOutput(repoDir, args) {
  return execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function commitMessage(task, sourceBranch) {
  return `publish: ${task.clientSlug || task.id || 'approved site'} from ${sourceBranch}`;
}

function resolvePath(filePath, repoRoot) {
  if (!filePath) return '';
  return path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function shouldInstallDependencies(repoDir) {
  return fs.existsSync(path.join(repoDir, 'package.json'));
}

function installCommand(repoDir) {
  if (fs.existsSync(path.join(repoDir, 'package-lock.json'))) {
    return { command: 'npm', args: ['ci'] };
  }
  return { command: 'npm', args: ['install'] };
}

function ensureGitIdentity(repoDir) {
  const name = safeGitConfig(repoDir, ['config', '--get', 'user.name']);
  const email = safeGitConfig(repoDir, ['config', '--get', 'user.email']);
  if (!name) {
    execFileSync('git', ['config', 'user.name', 'webjuice-agent'], {
      cwd: repoDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  if (!email) {
    execFileSync('git', ['config', 'user.email', 'webjuice-agent@users.noreply.github.com'], {
      cwd: repoDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
}

function safeGitConfig(repoDir, args) {
  try {
    return execFileSync('git', args, {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

export function savePublishResult(result, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return outputPath;
}
