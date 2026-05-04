export async function attachPagesDomain({ accountId, token, projectName, domain }) {
  if (!accountId) throw new Error('accountId is required');
  if (!token) throw new Error('token is required');
  if (!projectName) throw new Error('projectName is required');
  if (!domain) throw new Error('domain is required');

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/domains`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    },
  );
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Cloudflare Pages domain attach failed: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

export async function listPagesDomains({ accountId, token, projectName }) {
  if (!accountId) throw new Error('accountId is required');
  if (!token) throw new Error('token is required');
  if (!projectName) throw new Error('projectName is required');

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/domains`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Cloudflare Pages domain list failed: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}
