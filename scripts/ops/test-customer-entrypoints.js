#!/usr/bin/env node

import { onRequestPost as approvalRequest } from '../../functions/api/approval-request.ts';
import { onRequestPost as revisionSubmit } from '../../functions/api/revision-submit.ts';

const calls = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options = {}) => {
  const bodyText = typeof options.body === 'string' ? options.body : '';
  let body = null;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
  }
  calls.push({ url: String(url), body, headers: options.headers || {}, method: options.method || 'GET' });
  return {
    ok: true,
    status: String(url).includes('api.github.com') ? 204 : 200,
    text: async () => '',
    json: async () => ({ ok: true }),
  };
};

try {
  const approvalContext = createJsonContext({
    url: 'https://profitslocal.com/api/approval-request',
    body: {
      order_id: 'cs_test_entrypoint_approval_001',
      email: 'owner@example.com',
      client_slug: 'opa-bar-mezze-restaurant',
      repo: 'matthew6688/opa-bar-mezze-restaurant',
      task_path: 'data/agent-tasks/opa-bar-mezze-restaurant/sale-cs_test_entrypoint_approval_001.json',
      dry_run: 'true',
    },
    env: {
      AGENT_GITHUB_TOKEN: 'ghs_test_123',
      AGENT_REPO: 'matthew6688/webjuice-stack-mvp',
      AGENT_REF: 'main',
      SALES_DISCORD_WEBHOOK_URL: 'https://discord.test/approval-webhook',
      APPROVAL_ALLOW_DRY_RUN: 'true',
    },
  });

  const approvalResponse = await approvalRequest(approvalContext);
  await Promise.all(approvalContext.waited);
  const approvalJson = await approvalResponse.json();

  const revisionForm = new FormData();
  revisionForm.set('order_id', 'cs_test_entrypoint_revision_001');
  revisionForm.set('email', 'owner@example.com');
  revisionForm.set('client_slug', 'opa-bar-mezze-restaurant');
  revisionForm.set('repo', 'matthew6688/opa-bar-mezze-restaurant');
  revisionForm.set('requested_changes', 'Please tighten the hero and swap the first gallery image.');
  revisionForm.set('confirm_revision_scope', 'on');
  revisionForm.set('submitted_at', '2026-05-07T18:30:00.000Z');

  const revisionContext = createFormContext({
    url: 'https://profitslocal.com/api/revision-submit',
    formData: revisionForm,
    env: {
      AGENT_GITHUB_TOKEN: 'ghs_test_123',
      AGENT_REPO: 'matthew6688/webjuice-stack-mvp',
      AGENT_REF: 'main',
      SALES_DISCORD_WEBHOOK_URL: 'https://discord.test/revision-webhook',
      SITE_URL: 'https://profitslocal.com',
    },
  });

  const revisionResponse = await revisionSubmit(revisionContext);
  const revisionJson = await revisionResponse.json();

  const approvalDispatch = calls.find((call) => call.url.includes('/actions/workflows/publish-approved.yml/dispatches'));
  const revisionDispatch = calls.find((call) => call.url.includes('/actions/workflows/route-funnel-event.yml/dispatches'));
  const approvalWebhook = calls.find((call) => call.url === 'https://discord.test/approval-webhook');
  const revisionWebhook = calls.find((call) => call.url === 'https://discord.test/revision-webhook');

  const assertions = {
    approvalSuccess: approvalResponse.status === 200 && approvalJson.success === true,
    approvalDispatchExists: Boolean(approvalDispatch),
    approvalDryRunPropagated: approvalDispatch?.body?.inputs?.dry_run === 'true',
    approvalTaskPathPropagated: String(approvalDispatch?.body?.inputs?.task_path || '').includes('sale-cs_test_entrypoint_approval_001.json'),
    approvalDiscordPosted: Boolean(approvalWebhook),
    revisionSuccess: revisionResponse.status === 200 && revisionJson.success === true,
    revisionDispatchExists: Boolean(revisionDispatch),
    revisionWorkflowKindCorrect: revisionDispatch?.body?.inputs?.kind === 'revision',
    revisionWorkflowProviderCorrect: revisionDispatch?.body?.inputs?.provider === 'tally',
    revisionWorkflowAutoRunAgent: revisionDispatch?.body?.inputs?.auto_run_agent === 'true',
    revisionDiscordPosted: Boolean(revisionWebhook),
  };

  const failed = Object.entries(assertions)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);

  console.log(JSON.stringify({
    ok: failed.length === 0,
    assertions,
    failed,
    approvalDispatch: approvalDispatch?.body || null,
    revisionDispatch: revisionDispatch?.body || null,
  }, null, 2));

  if (failed.length) process.exit(1);
} finally {
  globalThis.fetch = originalFetch;
}

function createJsonContext({ url, body, env }) {
  const waited = [];
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    waited,
    waitUntil(promise) {
      waited.push(Promise.resolve(promise));
    },
  };
}

function createFormContext({ url, formData, env }) {
  const waited = [];
  return {
    request: new Request(url, {
      method: 'POST',
      body: formData,
    }),
    env,
    waited,
    waitUntil(promise) {
      waited.push(Promise.resolve(promise));
    },
  };
}
