export async function getLatestGithubActionsRun(repo, {
  branch = 'main',
  token = process.env.GH_PAT || process.env.GITHUB_TOKEN || '',
  timeoutMs = 10000,
} = {}) {
  if (!repo || !repo.includes('/')) throw new Error(`invalid GitHub repo: ${repo || 'missing'}`);

  const url = new URL(`https://api.github.com/repos/${repo}/actions/runs`);
  url.searchParams.set('per_page', '1');
  if (branch) url.searchParams.set('branch', branch);

  const response = await fetchWithTimeout(url, timeoutMs, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) throw new Error(`GitHub Actions lookup failed for ${repo}: HTTP ${response.status} ${await response.text()}`);

  const body = await response.json();
  const run = body.workflow_runs?.[0] || null;
  return {
    repo,
    branch,
    ok: Boolean(run && run.status === 'completed' && run.conclusion === 'success'),
    found: Boolean(run),
    status: run?.status || 'missing',
    conclusion: run?.conclusion || null,
    name: run?.name || '',
    url: run?.html_url || '',
    createdAt: run?.created_at || '',
    updatedAt: run?.updated_at || '',
  };
}

async function fetchWithTimeout(url, timeoutMs, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw new Error(`fetch failed for ${url}: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}
