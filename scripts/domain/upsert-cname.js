#!/usr/bin/env node

import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

const args = parseArgs();
if (!args.zone || !args.name || !args.target) {
  console.error('Usage: node scripts/domain/upsert-cname.js --zone zone-id --name example.com --target project.pages.dev [--proxied true]');
  process.exit(1);
}
if (!process.env.CF_API_TOKEN) throw new Error('CF_API_TOKEN is required');

const existing = await findRecord({
  zoneId: args.zone,
  name: args.name,
  token: process.env.CF_API_TOKEN,
});
const body = {
  type: 'CNAME',
  name: args.name,
  content: args.target,
  proxied: args.proxied !== 'false',
  ttl: 1,
};
const result = existing
  ? await updateRecord({ zoneId: args.zone, recordId: existing.id, token: process.env.CF_API_TOKEN, body })
  : await createRecord({ zoneId: args.zone, token: process.env.CF_API_TOKEN, body });

console.log(JSON.stringify({ action: existing ? 'updated' : 'created', result }, null, 2));

async function findRecord({ zoneId, name, token }) {
  const url = new URL(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`);
  url.searchParams.set('name', name);
  const response = await fetch(url, { headers: authHeaders(token) });
  const data = await response.json();
  if (!data.success) throw new Error(`Cloudflare DNS lookup failed: ${JSON.stringify(data.errors)}`);
  return (data.result || []).find((record) => ['CNAME', 'A', 'AAAA'].includes(record.type)) || null;
}

async function createRecord({ zoneId, token, body }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.success) throw new Error(`Cloudflare DNS create failed: ${JSON.stringify(data.errors)}`);
  return data.result;
}

async function updateRecord({ zoneId, recordId, token, body }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.success) throw new Error(`Cloudflare DNS update failed: ${JSON.stringify(data.errors)}`);
  return data.result;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    parsed[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[i + 1] || true);
  }
  return parsed;
}
