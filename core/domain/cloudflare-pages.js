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

export async function deletePagesDomain({ accountId, token, projectName, domain }) {
  if (!accountId) throw new Error('accountId is required');
  if (!token) throw new Error('token is required');
  if (!projectName) throw new Error('projectName is required');
  if (!domain) throw new Error('domain is required');

  const domains = await listPagesDomains({ accountId, token, projectName });
  const existing = domains.find((item) => item.name === domain);
  if (!existing) return { action: 'not_found', domain };

  const identifiers = [domain, existing.id, existing.domain_id].filter(Boolean);
  let lastError = null;
  for (const identifier of identifiers) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/domains/${encodeURIComponent(identifier)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const data = await response.json();
    if (data.success) return { action: 'deleted', domain, identifier, result: data.result || null };
    lastError = data.errors;
  }
  throw new Error(`Cloudflare Pages domain delete failed: ${JSON.stringify(lastError)}`);
}
