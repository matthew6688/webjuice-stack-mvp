export async function findZoneByName({ token, name }) {
  if (!token) throw new Error('token is required');
  if (!name) throw new Error('name is required');
  const url = new URL('https://api.cloudflare.com/client/v4/zones');
  url.searchParams.set('name', name);
  const response = await fetch(url, { headers: authHeaders(token) });
  const data = await response.json();
  if (!data.success) throw new Error(`Cloudflare zone lookup failed: ${JSON.stringify(data.errors)}`);
  return (data.result || [])[0] || null;
}

export async function upsertCnameRecord({ token, zoneId, name, target, proxied = true }) {
  if (!token) throw new Error('token is required');
  if (!zoneId) throw new Error('zoneId is required');
  if (!name) throw new Error('name is required');
  if (!target) throw new Error('target is required');
  const existing = await findAddressRecord({ token, zoneId, name });
  const body = {
    type: 'CNAME',
    name,
    content: target,
    proxied,
    ttl: 1,
  };
  if (existing) {
    return {
      action: 'updated',
      record: await updateDnsRecord({ token, zoneId, recordId: existing.id, body }),
      previousType: existing.type,
    };
  }
  return {
    action: 'created',
    record: await createDnsRecord({ token, zoneId, body }),
    previousType: '',
  };
}

export async function deleteDnsRecordByName({ token, zoneId, name, types = ['CNAME'] }) {
  if (!token) throw new Error('token is required');
  if (!zoneId) throw new Error('zoneId is required');
  if (!name) throw new Error('name is required');
  const records = await findRecordsByName({ token, zoneId, name });
  const deletable = records.filter((record) => types.includes(record.type));
  const deleted = [];
  for (const record of deletable) {
    deleted.push(await deleteDnsRecord({ token, zoneId, recordId: record.id }));
  }
  return {
    action: deleted.length ? 'deleted' : 'not_found',
    name,
    deleted,
  };
}

async function findAddressRecord({ token, zoneId, name }) {
  const records = await findRecordsByName({ token, zoneId, name });
  return records.find((record) => ['CNAME', 'A', 'AAAA'].includes(record.type)) || null;
}

async function findRecordsByName({ token, zoneId, name }) {
  const url = new URL(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`);
  url.searchParams.set('name', name);
  const response = await fetch(url, { headers: authHeaders(token) });
  const data = await response.json();
  if (!data.success) throw new Error(`Cloudflare DNS lookup failed: ${JSON.stringify(data.errors)}`);
  return data.result || [];
}

async function createDnsRecord({ token, zoneId, body }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.success) throw new Error(`Cloudflare DNS create failed: ${JSON.stringify(data.errors)}`);
  return data.result;
}

async function updateDnsRecord({ token, zoneId, recordId, body }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.success) throw new Error(`Cloudflare DNS update failed: ${JSON.stringify(data.errors)}`);
  return data.result;
}

async function deleteDnsRecord({ token, zoneId, recordId }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await response.json();
  if (!data.success) throw new Error(`Cloudflare DNS delete failed: ${JSON.stringify(data.errors)}`);
  return data.result;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
