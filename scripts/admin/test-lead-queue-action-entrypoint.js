import assert from 'node:assert/strict';
import { onRequestPost } from '../../functions/admin/lead-queue-action.ts';

async function run() {
  let dispatched = null;
  globalThis.fetch = async (url, init = {}) => {
    dispatched = { url: String(url), body: JSON.parse(String(init.body || '{}')) };
    return new Response(null, { status: 204 });
  };

  const form = new URLSearchParams({
    queue_action: 'run_cheap_audit',
    entity_key: 'place_smoke',
    company: 'Queue Smoke',
    actor: 'profitslocal-admin',
  });

  const response = await onRequestPost({
    env: {
      AGENT_GITHUB_TOKEN: 'ghp_test',
      AGENT_REPO: 'matthew6688/webjuice-stack-mvp',
      AGENT_REF: 'main',
    },
    request: new Request('https://profitslocal.com/admin/lead-queue-action', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    }),
  });

  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), '/admin/queue/?queue_action=queued&action=run_cheap_audit');
  assert.ok(dispatched);
  assert.match(dispatched.url, /run-lead-queue-action\.yml\/dispatches$/);
  const payload = JSON.parse(dispatched.body.inputs.payload);
  assert.equal(payload.queue_action, 'run_cheap_audit');
  assert.equal(payload.entity_key, 'place_smoke');
  assert.ok(payload.operation_id);

  dispatched = null;
  const approve = await onRequestPost({
    env: {
      AGENT_GITHUB_TOKEN: 'ghp_test',
      AGENT_REPO: 'matthew6688/webjuice-stack-mvp',
      AGENT_REF: 'main',
    },
    request: new Request('https://profitslocal.com/admin/lead-queue-action', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        queue_action: 'approve_mockup',
        client_slug: 'stage-place',
        company: 'Stage Place',
        actor: 'profitslocal-admin',
      }),
    }),
  });
  assert.equal(approve.status, 303);
  const approvePayload = JSON.parse(dispatched.body.inputs.payload);
  assert.equal(approvePayload.queue_action, 'approve_mockup');
  assert.equal(approvePayload.client_slug, 'stage-place');

  dispatched = null;
  const approveEnrichment = await onRequestPost({
    env: {
      AGENT_GITHUB_TOKEN: 'ghp_test',
      AGENT_REPO: 'matthew6688/webjuice-stack-mvp',
      AGENT_REF: 'main',
    },
    request: new Request('https://profitslocal.com/admin/lead-queue-action', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        queue_action: 'approve_enrichment_spend',
        entity_key: 'place_smoke',
        company: 'Queue Smoke',
        actor: 'profitslocal-admin',
      }),
    }),
  });
  assert.equal(approveEnrichment.status, 303);
  const enrichmentPayload = JSON.parse(dispatched.body.inputs.payload);
  assert.equal(enrichmentPayload.queue_action, 'approve_enrichment_spend');
  assert.equal(enrichmentPayload.entity_key, 'place_smoke');

  dispatched = null;
  const buildArtifacts = await onRequestPost({
    env: {
      AGENT_GITHUB_TOKEN: 'ghp_test',
      AGENT_REPO: 'matthew6688/webjuice-stack-mvp',
      AGENT_REF: 'main',
    },
    request: new Request('https://profitslocal.com/admin/lead-queue-action', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        queue_action: 'build_mockup_artifacts',
        client_slug: 'stage-place',
        company: 'Stage Place',
        actor: 'profitslocal-admin',
      }),
    }),
  });
  assert.equal(buildArtifacts.status, 303);
  const buildPayload = JSON.parse(dispatched.body.inputs.payload);
  assert.equal(buildPayload.queue_action, 'build_mockup_artifacts');
  assert.equal(buildPayload.client_slug, 'stage-place');

  dispatched = null;
  const buildDraft = await onRequestPost({
    env: {
      AGENT_GITHUB_TOKEN: 'ghp_test',
      AGENT_REPO: 'matthew6688/webjuice-stack-mvp',
      AGENT_REF: 'main',
    },
    request: new Request('https://profitslocal.com/admin/lead-queue-action', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        queue_action: 'build_outreach_email_draft',
        client_slug: 'stage-place',
        company: 'Stage Place',
        actor: 'profitslocal-admin',
      }),
    }),
  });
  assert.equal(buildDraft.status, 303);
  const draftPayload = JSON.parse(dispatched.body.inputs.payload);
  assert.equal(draftPayload.queue_action, 'build_outreach_email_draft');
  assert.equal(draftPayload.client_slug, 'stage-place');

  const bad = await onRequestPost({
    env: { AGENT_GITHUB_TOKEN: 'ghp_test' },
    request: new Request('https://profitslocal.com/admin/lead-queue-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_action: 'run_cheap_audit' }),
    }),
  });
  assert.equal(bad.status, 400);

  const badApprove = await onRequestPost({
    env: { AGENT_GITHUB_TOKEN: 'ghp_test' },
    request: new Request('https://profitslocal.com/admin/lead-queue-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_action: 'approve_mockup' }),
    }),
  });
  assert.equal(badApprove.status, 400);

  const badApproveEnrichment = await onRequestPost({
    env: { AGENT_GITHUB_TOKEN: 'ghp_test' },
    request: new Request('https://profitslocal.com/admin/lead-queue-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_action: 'approve_enrichment_spend' }),
    }),
  });
  assert.equal(badApproveEnrichment.status, 400);

  const badBuildArtifacts = await onRequestPost({
    env: { AGENT_GITHUB_TOKEN: 'ghp_test' },
    request: new Request('https://profitslocal.com/admin/lead-queue-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_action: 'build_mockup_artifacts' }),
    }),
  });
  assert.equal(badBuildArtifacts.status, 400);

  const badDraft = await onRequestPost({
    env: { AGENT_GITHUB_TOKEN: 'ghp_test' },
    request: new Request('https://profitslocal.com/admin/lead-queue-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_action: 'build_outreach_email_draft' }),
    }),
  });
  assert.equal(badDraft.status, 400);

  console.log(JSON.stringify({
    ok: true,
    workflow: 'run-lead-queue-action.yml',
    location: response.headers.get('Location'),
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
