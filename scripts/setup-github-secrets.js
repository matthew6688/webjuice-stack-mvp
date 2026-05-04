#!/usr/bin/env node
/**
 * Set GitHub Actions secrets using tweetnacl (no Python needed)
 * Usage: node scripts/setup-github-secrets.js <repo-full-name> <secret-name> <secret-value>
 *
 * Requires: npm install tweetnacl
 */

const nacl = require('tweetnacl');

const GH_PAT = process.env.GH_PAT;
if (!GH_PAT) {
  console.error('Error: GH_PAT env var not set');
  process.exit(1);
}

async function githubRequest(path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${GH_PAT}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
      ...opts.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function encryptSecret(publicKey, secretValue) {
  const pk = Buffer.from(publicKey, 'base64');
  const message = Buffer.from(secretValue);
  const encrypted = nacl.sealedbox.seal(message, pk);
  return Buffer.from(encrypted).toString('base64');
}

async function setSecret(repo, secretName, secretValue) {
  const keyData = await githubRequest(`/repos/${repo}/actions/secrets/public-key`);
  const encryptedValue = encryptSecret(keyData.key, secretValue);
  await githubRequest(`/repos/${repo}/actions/secrets/${secretName}`, {
    method: 'PUT',
    body: JSON.stringify({
      encrypted_value: encryptedValue,
      key_id: keyData.key_id,
    }),
  });
  console.log(`  Secret ${secretName} set`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.log(`Usage: node scripts/setup-github-secrets.js <owner/repo> <secret-name> <secret-value>`);
    process.exit(1);
  }
  const [repo, secretName, secretValue] = args;
  await setSecret(repo, secretName, secretValue);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
