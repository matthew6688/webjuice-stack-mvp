#!/usr/bin/env python3
"""
Set GitHub Actions secrets using libsodium sealed-box encryption.
Requires: pip3 install pynacl

Usage:
  python3 scripts/setup-github-secrets.py <repo-full-name> <secret-name> <secret-value>
"""

import sys
import os
import base64
import json
import urllib.request

try:
    from nacl import encoding, public
except ImportError:
    print("Error: pynacl not installed. Run: pip3 install pynacl")
    sys.exit(1)

GH_PAT = os.environ.get('GH_PAT')
if not GH_PAT:
    print("Error: GH_PAT env var not set")
    sys.exit(1)


def encrypt_secret(public_key: str, secret_value: str) -> str:
    """Encrypt a Unicode string using the public key."""
    public_key_bytes = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())
    sealed_box = public.SealedBox(public_key_bytes)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def set_secret(repo: str, secret_name: str, secret_value: str):
    # 1. Get public key for the repo
    req = urllib.request.Request(
        f'https://api.github.com/repos/{repo}/actions/secrets/public-key',
        headers={
            'Authorization': f'token {GH_PAT}',
            'Accept': 'application/vnd.github.v3+json'
        }
    )
    with urllib.request.urlopen(req) as resp:
        key_data = json.loads(resp.read().decode('utf-8'))

    key_id = key_data['key_id']
    public_key = key_data['key']

    # 2. Encrypt the secret
    encrypted_value = encrypt_secret(public_key, secret_value)

    # 3. Upload the secret
    payload = {
        'encrypted_value': encrypted_value,
        'key_id': key_id
    }
    req = urllib.request.Request(
        f'https://api.github.com/repos/{repo}/actions/secrets/{secret_name}',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'token {GH_PAT}',
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        method='PUT'
    )
    with urllib.request.urlopen(req) as resp:
        # 201 Created or 204 No Content = success
        if resp.status in (201, 204):
            print(f'  ✓ Secret {secret_name} set')
        else:
            print(f'  ⚠️  Unexpected status: {resp.status}')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print(f'Usage: {sys.argv[0]} <owner/repo> <secret-name> <secret-value>')
        sys.exit(1)

    repo = sys.argv[1]
    secret_name = sys.argv[2]
    secret_value = sys.argv[3]
    set_secret(repo, secret_name, secret_value)
