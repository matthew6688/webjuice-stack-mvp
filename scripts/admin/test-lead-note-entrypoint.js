import assert from 'node:assert/strict';
import { onRequestPost } from '../../functions/admin/lead-note.ts';

async function run() {
  let dispatched = null;
  globalThis.fetch = async (url, init = {}) => {
    dispatched = { url: String(url), body: JSON.parse(String(init.body || '{}')) };
    return new Response(null, { status: 204 });
  };

  const form = new URLSearchParams({
    client_slug: 'note-smoke-restaurant',
    order_id: 'order-123',
    company: 'Note Smoke Restaurant',
    actor: 'profitslocal-admin',
    note: 'Call again next week.',
    next_follow_up_due: '2026-05-13',
  });

  const response = await onRequestPost({
    env: {
      AGENT_GITHUB_TOKEN: 'ghp_test',
      AGENT_REPO: 'matthew6688/webjuice-stack-mvp',
      AGENT_REF: 'main',
    },
    request: new Request('https://profitslocal.com/admin/lead-note', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    }),
  });

  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), '/admin/leads/?note=queued&client=note-smoke-restaurant');
  assert.ok(dispatched);
  assert.match(dispatched.url, /record-lead-note\.yml\/dispatches$/);
  assert.equal(JSON.parse(dispatched.body.inputs.payload).client_slug, 'note-smoke-restaurant');
  assert.equal(JSON.parse(dispatched.body.inputs.payload).next_follow_up_due, '2026-05-13');

  console.log(JSON.stringify({
    ok: true,
    workflow: 'record-lead-note.yml',
    location: response.headers.get('Location'),
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
