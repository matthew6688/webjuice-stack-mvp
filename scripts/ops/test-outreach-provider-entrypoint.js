#!/usr/bin/env node

import assert from 'assert/strict';
import { onRequestPost as outreachProviderEvent } from '../../functions/api/outreach-provider-event.ts';

const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url, init });
  return new Response(null, { status: 204 });
};

const secret = 'secret-123';
const request = new Request('https://profitslocal.com/api/outreach-provider-event', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify({
    provider: 'agentic-email',
    client_slug: 'entrypoint-smoke',
    event: {
      status: 'replied',
      timestamp: '2026-05-08T14:30:00.000Z',
    },
  }),
});

const response = await outreachProviderEvent({
  request,
  env: {
    AGENT_GITHUB_TOKEN: 'ghs_test',
    AGENT_REPO: 'matthew6688/webjuice-stack-mvp',
    AGENT_REF: 'main',
    OUTREACH_PROVIDER_WEBHOOK_SECRET: secret,
  },
});

const body = await response.json();
assert.equal(response.status, 200);
assert.equal(body.success, true);
assert.equal(body.workflow, 'sync-outreach-provider-event.yml');
assert.equal(calls.length, 1);
assert.ok(String(calls[0].url).includes('/actions/workflows/sync-outreach-provider-event.yml/dispatches'));

console.log(JSON.stringify({
  ok: true,
  assertions: {
    status: response.status,
    workflow: body.workflow,
    dispatchUrl: calls[0].url,
  },
}, null, 2));
