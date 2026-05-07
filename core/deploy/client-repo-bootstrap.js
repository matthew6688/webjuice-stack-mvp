import { execFileSync } from 'child_process';

export function buildClientRepoBootstrapPlan({
  repo,
  repoDir,
  pagesProjectName,
  defaultBranch = 'main',
  devBranch = 'dev',
  privateRepo = true,
  waitForActions = false,
} = {}) {
  if (!repo || !repo.includes('/')) throw new Error('repo must be owner/name');
  if (!repoDir) throw new Error('repoDir is required');
  const project = pagesProjectName || repo.split('/')[1];
  return {
    repo,
    repoDir,
    pagesProjectName: project,
    defaultBranch,
    devBranch,
    privateRepo,
    waitForActions,
    steps: [
      { id: 'create-github-repo', command: ['gh', 'repo', 'create', repo, privateRepo ? '--private' : '--public'] },
      { id: 'set-pages-project-variable', command: ['gh', 'variable', 'set', 'PAGES_PROJECT_NAME', '--repo', repo, '--body', project] },
      { id: 'set-cloudflare-api-token-secret', secret: 'CF_API_TOKEN', command: ['gh', 'secret', 'set', 'CLOUDFLARE_API_TOKEN', '--repo', repo] },
      { id: 'set-cloudflare-account-secret', secret: 'CF_ACCOUNT_ID', command: ['gh', 'secret', 'set', 'CLOUDFLARE_ACCOUNT_ID', '--repo', repo] },
      { id: 'create-pages-dev-project', command: ['npx', 'wrangler', 'pages', 'project', 'create', `${project}-dev`, '--production-branch', devBranch] },
      { id: 'create-pages-live-project', command: ['npx', 'wrangler', 'pages', 'project', 'create', `${project}-live`, '--production-branch', defaultBranch] },
      { id: 'ensure-origin', command: ['git', 'remote', 'add', 'origin', `https://github.com/${repo}.git`], allowFailure: true },
      { id: 'push-main', command: ['git', 'push', '-u', 'origin', defaultBranch] },
      { id: 'ensure-dev-branch', command: ['git', 'checkout', '-B', devBranch] },
      { id: 'push-dev', command: ['git', 'push', '-u', 'origin', devBranch] },
      ...(waitForActions ? [
        { id: 'wait-live-action', command: ['node', 'scripts/deploy/wait-github-action.js', '--repo', repo, '--branch', defaultBranch] },
        { id: 'wait-dev-action', command: ['node', 'scripts/deploy/wait-github-action.js', '--repo', repo, '--branch', devBranch] },
      ] : []),
    ],
  };
}

export function validateBootstrapEnvironment(env = process.env) {
  const required = ['GH_PAT', 'CF_API_TOKEN', 'CF_ACCOUNT_ID'];
  return {
    ok: required.every((key) => Boolean(env[key])),
    missing: required.filter((key) => !env[key]),
  };
}

export function buildClientRepoBootstrapReference({
  repo,
  repoDir,
  pagesProjectName,
  defaultBranch = 'main',
  devBranch = 'dev',
  waitForActions = true,
} = {}) {
  const project = pagesProjectName || repo?.split('/')?.[1] || '';
  const resolvedRepoDir = repoDir || `/Users/matthew/Developer/webjuice-generated/${project || '<client-repo>'}`;
  const command = [
    'npm run deploy:bootstrap-client-repo --',
    `--repo ${shellToken(repo || '<owner/client-repo>')}`,
    `--repo-dir ${shellToken(resolvedRepoDir)}`,
    project ? `--pages-project-name ${shellToken(project)}` : '',
    `--main ${shellToken(defaultBranch)}`,
    `--dev ${shellToken(devBranch)}`,
    waitForActions ? '--wait true' : '--wait false',
    '--execute true',
  ].filter(Boolean).join(' ');
  return {
    status: repo ? 'ready' : 'needs_repo',
    repo: repo || '',
    repoDir: resolvedRepoDir,
    pagesProjectName: project,
    defaultBranch,
    devBranch,
    waitForActions,
    command,
    rule: 'Run this once before agent completion when the customer repo or Pages projects do not exist yet.',
  };
}

export function executeClientRepoBootstrapPlan(plan, {
  env = process.env,
  dryRun = true,
  stdio = 'inherit',
} = {}) {
  const executed = [];
  for (const step of plan.steps) {
    executed.push({ id: step.id, command: redactCommand(step.command), dryRun });
    if (dryRun) continue;
    try {
      const input = step.secret ? env[step.secret] : undefined;
      execFileSync(step.command[0], step.command.slice(1), {
        cwd: commandCwd(step, plan),
        env,
        stdio: input ? ['pipe', stdio, stdio] : stdio,
        input,
      });
    } catch (error) {
      if (step.allowFailure) continue;
      throw error;
    }
  }
  return { ok: true, dryRun, executed };
}

function commandCwd(step, plan) {
  return step.id.startsWith('push-') || step.id.startsWith('ensure-')
    ? plan.repoDir
    : process.cwd();
}

function redactCommand(command = []) {
  return command.map((part) => String(part).includes('TOKEN') ? '<secret>' : part);
}

function shellToken(value) {
  const raw = String(value || '');
  if (/^[a-zA-Z0-9._:/@-]+$/.test(raw)) return raw;
  return JSON.stringify(raw);
}
